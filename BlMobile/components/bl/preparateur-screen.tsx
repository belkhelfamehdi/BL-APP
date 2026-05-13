import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  AppState,
  FlatList,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  RefreshControl,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { CameraView, useCameraPermissions } from 'expo-camera';
import AsyncStorage from '@react-native-async-storage/async-storage';

import { api } from '@/services/api';
import { Brand } from '@/constants/brand';
import { PreparationItemPayload, ProductStatus, SelectionRow } from '@/types/app';
import { ProductLine, mapProducts } from '@/utils/products';
import { parseLocalIso, todayIso } from '@/utils/date';
import { DatePickerModal } from '@/components/ui/date-picker-modal';

interface Props {
  token: string;
  fullName: string;
}

interface ProductDraft {
  reference: string;
  status: ProductStatus;
  quantityExpected?: number;
  quantityPrepared?: number;
  note?: string;
}

const STATUS_CONFIG: Record<ProductStatus, { label: string; bg: string; text: string; border: string }> = {
  available: { label: 'OK', bg: '#E8F5E9', text: '#1B5E20', border: '#81C784' },
  partial: { label: 'Partiel', bg: '#FFF8E1', text: '#E65100', border: '#FFB74D' },
  not_available: { label: 'Rupture', bg: '#FFEBEE', text: '#B71C1C', border: '#EF9A9A' },
};

function dedupeSelectionRows(rows: SelectionRow[]): SelectionRow[] {
  const byBl = new Map<number, SelectionRow>();
  for (const row of rows) {
    const current = byBl.get(row.bl_id);
    if (!current) { byBl.set(row.bl_id, row); continue; }
    if (new Date(row.selected_at).getTime() >= new Date(current.selected_at).getTime()) {
      byBl.set(row.bl_id, row);
    }
  }
  return [...byBl.values()].sort((a, b) => a.bl_id - b.bl_id);
}

export function PreparateurScreen({ token, fullName }: Props) {
  const insets = useSafeAreaInsets();
  const [targetDate, setTargetDate] = useState(todayIso());
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [showScanner, setShowScanner] = useState(false);
  const [isScanning, setIsScanning] = useState(true);
  const [scanFeedback, setScanFeedback] = useState<{ kind: 'matched' | 'unknown' | 'duplicate'; text: string } | null>(null);
  const [permission, requestPermission] = useCameraPermissions();
  const scanResumeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => () => { if (scanResumeTimer.current) clearTimeout(scanResumeTimer.current); }, []);
  const [selectionRows, setSelectionRows] = useState<SelectionRow[]>([]);
  const [activeBlId, setActiveBlId] = useState<number | null>(null);
  const [products, setProducts] = useState<ProductLine[]>([]);
  const [drafts, setDrafts] = useState<Record<string, ProductDraft>>({});
  const [globalComment, setGlobalComment] = useState('');

  const [loadingSelection, setLoadingSelection] = useState(false);
  const [loadingProducts, setLoadingProducts] = useState(false);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);


  const activeRow = useMemo(
    () => selectionRows.find((r) => r.bl_id === activeBlId) ?? null,
    [activeBlId, selectionRows]
  );

  const stats = useMemo(() => {
    const rows = Object.values(drafts);
    return {
      total: rows.length,
      available: rows.filter((x) => x.status === 'available').length,
      partial: rows.filter((x) => x.status === 'partial').length,
      missing: rows.filter((x) => x.status === 'not_available').length,
    };
  }, [drafts]);

  const invalidPartialRefs = useMemo(() => {
    return Object.values(drafts)
      .filter((d) => d.status === 'partial' && (d.quantityPrepared === undefined || !Number.isFinite(d.quantityPrepared) || d.quantityPrepared < 0))
      .map((d) => d.reference);
  }, [drafts]);

  const canSend = stats.total > 0 && invalidPartialRefs.length === 0 && !sending;

  const loadSelection = useCallback(async () => {
    try {
      setLoadingSelection(true);
      setError(null);
      setSuccess(null);
      const res = await api.listPreparationBls(token, targetDate);
      setSelectionRows(dedupeSelectionRows(res.data));
      setActiveBlId(null);
      setProducts([]);
      setDrafts({});
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Erreur');
      setSelectionRows([]);
    } finally {
      setLoadingSelection(false);
    }
  }, [targetDate, token]);

  const pollSelection = useCallback(async () => {
    try {
      const res = await api.listPreparationBls(token, targetDate);
      setSelectionRows(dedupeSelectionRows(res.data));
    } catch { /* silent */ }
  }, [targetDate, token]);

  useEffect(() => { void loadSelection(); }, [loadSelection]);

  useEffect(() => {
    if (activeBlId !== null) return;
    let cancelled = false;
    const tick = () => { if (!cancelled && AppState.currentState === 'active') void pollSelection(); };
    const interval = setInterval(tick, 30_000);
    const sub = AppState.addEventListener('change', (state) => { if (state === 'active') tick(); });
    return () => { cancelled = true; clearInterval(interval); sub.remove(); };
  }, [activeBlId, pollSelection]);

  useEffect(() => {
    if (activeBlId === null) return;
    const handle = setTimeout(() => {
      void AsyncStorage.setItem(
        `prep:draft:${targetDate}:${activeBlId}`,
        JSON.stringify({ drafts, comment: globalComment }),
      ).catch(() => {});
    }, 400);
    return () => clearTimeout(handle);
  }, [activeBlId, drafts, globalComment, targetDate]);

  const draftStorageKey = useCallback(
    (blId: number) => `prep:draft:${targetDate}:${blId}`,
    [targetDate]
  );

  const openBl = useCallback(async (blId: number) => {
    try {
      setLoadingProducts(true);
      setError(null);
      setSuccess(null);
      const res = await api.getBlProducts(blId);
      const lines = mapProducts(res);
      const nextDraft: Record<string, ProductDraft> = {};
      lines.forEach((line) => {
        nextDraft[line.reference] = {
          reference: line.reference,
          status: 'available',
          quantityExpected: line.quantityExpected,
          quantityPrepared: line.quantityExpected,
          note: '',
        };
      });

      let restoredComment = '';
      let restoredDrafts = nextDraft;
      try {
        const stored = await AsyncStorage.getItem(draftStorageKey(blId));
        if (stored) {
          const parsed = JSON.parse(stored) as { drafts?: Record<string, ProductDraft>; comment?: string };
          if (parsed?.drafts) {
            restoredDrafts = { ...nextDraft };
            for (const ref of Object.keys(parsed.drafts)) {
              if (restoredDrafts[ref]) restoredDrafts[ref] = parsed.drafts[ref]!;
            }
          }
          if (typeof parsed?.comment === 'string') restoredComment = parsed.comment;
        }
      } catch { /* corrupt entry, ignore */ }

      setActiveBlId(blId);
      setProducts(lines);
      setDrafts(restoredDrafts);
      setGlobalComment(restoredComment);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Erreur');
    } finally {
      setLoadingProducts(false);
    }
  }, [draftStorageKey]);

  const goBackToList = useCallback(() => {
    setActiveBlId(null);
    setProducts([]);
    setDrafts({});
    setGlobalComment('');
    setError(null);
    setSuccess(null);
  }, []);

  const openScanner = async () => {
    if (!permission?.granted) {
      const result = await requestPermission();
      if (!result.granted) {
        Alert.alert('Permission caméra', 'La caméra est nécessaire pour scanner les références.');
        return;
      }
    }
    setIsScanning(true);
    setScanFeedback(null);
    setShowScanner(true);
  };

  const normalizeCode = (s: string) => s.trim().toUpperCase().replace(/^0+/, '');

  const findLocalMatch = (code: string): ProductLine | undefined => {
    const n = normalizeCode(code);
    return products.find((p) => normalizeCode(p.reference) === n);
  };

  const applyOkToDraft = (reference: string, expectedFromProduct: number | undefined) => {
    let wasAlreadyOk = false;
    setDrafts((prev) => {
      const current = prev[reference];
      if (!current) return prev;
      if (current.status === 'available'
          && (current.quantityPrepared ?? null) === (current.quantityExpected ?? expectedFromProduct ?? null)) {
        wasAlreadyOk = true;
      }
      return {
        ...prev,
        [reference]: {
          ...current,
          status: 'available',
          quantityPrepared: current.quantityExpected ?? expectedFromProduct ?? current.quantityPrepared,
        },
      };
    });
    return wasAlreadyOk;
  };

  const handleScanResult = async (scanData: string) => {
    setIsScanning(false);
    if (scanResumeTimer.current) clearTimeout(scanResumeTimer.current);
    const code = scanData.trim();

    const scheduleResume = () => {
      scanResumeTimer.current = setTimeout(() => {
        setScanFeedback(null);
        setIsScanning(true);
      }, 900);
    };

    let match = findLocalMatch(code);

    if (!match) {
      try {
        const article = await api.getArticleByCode(code);
        if (article?.code) {
          match = findLocalMatch(article.code);
        }
      } catch { /* ignore — treat as unknown */ }
    }

    if (!match) {
      setScanFeedback({ kind: 'unknown', text: `Réf. inconnue : ${code}` });
      scheduleResume();
      return;
    }

    const wasAlreadyOk = applyOkToDraft(match.reference, match.quantityExpected);
    setScanFeedback(
      wasAlreadyOk
        ? { kind: 'duplicate', text: `Déjà OK : ${match.reference}` }
        : { kind: 'matched', text: `OK : ${match.reference}` }
    );
    scheduleResume();
  };

  const setStatus = (reference: string, status: ProductStatus) => {
    setDrafts((prev) => {
      const current = prev[reference];
      if (!current) return prev;
      const next: ProductDraft = { ...current, status };
      if (status === 'not_available') next.quantityPrepared = 0;
      if (status === 'available' && typeof current.quantityExpected === 'number') {
        next.quantityPrepared = current.quantityExpected;
      }
      return { ...prev, [reference]: next };
    });
  };

  const setPreparedQty = (reference: string, value: string) => {
    const parsed = value.trim() === '' ? undefined : Number(value.replace(',', '.'));
    setDrafts((prev) => {
      const current = prev[reference];
      if (!current) return prev;
      return {
        ...prev,
        [reference]: {
          ...current,
          quantityPrepared: Number.isFinite(parsed as number) ? (parsed as number) : undefined,
        },
      };
    });
  };

  const doSendReport = async () => {
    if (!activeBlId || sending) return;
    const items = Object.values(drafts);
    if (items.length === 0) return;
    const payload: PreparationItemPayload[] = items.map((x) => ({
      reference: x.reference,
      status: x.status,
      quantity_expected: x.quantityExpected,
      quantity_prepared: x.quantityPrepared,
      note: x.note,
    }));
    try {
      const currentBlId = activeBlId;
      setSending(true);
      setError(null);
      setSuccess(null);
      await api.sendPreparationReport(token, {
        report_date: targetDate,
        bl_id: currentBlId,
        overall_comment: globalComment,
        items: payload,
      });
      void AsyncStorage.removeItem(draftStorageKey(currentBlId)).catch(() => {});
      setSuccess(`Rapport envoyé — BL #${currentBlId}`);
      setSelectionRows((prev) => prev.filter((row) => row.bl_id !== currentBlId));
      goBackToList();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Erreur envoi');
    } finally {
      setSending(false);
    }
  };

  const sendReport = () => {
    if (!activeBlId || sending) return;
    if (stats.total === 0) return;
    const summary = [
      `${stats.available} OK`,
      stats.partial > 0 ? `${stats.partial} partiel${stats.partial > 1 ? 's' : ''}` : null,
      stats.missing > 0 ? `${stats.missing} rupture${stats.missing > 1 ? 's' : ''}` : null,
    ].filter(Boolean).join(' • ');
    Alert.alert(
      `Envoyer le rapport — BL #${activeBlId}`,
      `${summary}\n\nLe BL sera retiré de votre liste. Cette action est définitive.`,
      [
        { text: 'Annuler', style: 'cancel' },
        { text: 'Envoyer', style: 'default', onPress: () => { void doSendReport(); } },
      ]
    );
  };

  // ── BL LIST VIEW ──────────────────────────────────────────────────────────

  const renderBLItem = ({ item }: { item: SelectionRow }) => (
    <Pressable
      style={({ pressed }) => [styles.blCard, pressed && { opacity: 0.85 }]}
      onPress={() => openBl(item.bl_id)}>
      <View style={styles.blCardLeft}>
        <View style={styles.blIdBadge}>
          <Text style={styles.blIdText}>#{item.bl_id}</Text>
        </View>
        <View style={styles.blCardInfo}>
          <Text style={styles.blCardName}>{item.destinataire || 'Client'}</Text>
          {item.date_bl ? (
            <Text style={styles.blCardMeta}>
              BL du {parseLocalIso(item.date_bl).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' })}
            </Text>
          ) : null}
        </View>
      </View>
      <View style={styles.blCardArrow}>
        <Text style={styles.blCardArrowText}>›</Text>
      </View>
    </Pressable>
  );

  const renderBLHeader = () => (
    <View style={styles.blListHeader}>
      <View style={styles.dateSection}>
        <Text style={styles.dateSectionLabel}>Date de préparation</Text>
        <View style={styles.dateRow}>
          <Text style={styles.dateDisplay}>
            {parseLocalIso(targetDate).toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' })}
          </Text>
          <Pressable
            style={({ pressed }) => [styles.changeDateBtn, pressed && { opacity: 0.7 }]}
            onPress={() => setShowDatePicker(true)}>
            <Text style={styles.changeDateText}>Modifier</Text>
          </Pressable>
        </View>
      </View>

      {error ? <View style={styles.alertBox}><Text style={styles.alertText}>{error}</Text></View> : null}
      {success ? <View style={styles.successBox}><Text style={styles.successText}>{success}</Text></View> : null}

      {loadingSelection ? (
        <View style={styles.loadingRow}>
          <ActivityIndicator color={Brand.ember} size="small" />
          <Text style={styles.loadingText}>Chargement…</Text>
        </View>
      ) : null}

      <View style={styles.sectionHeader}>
        <Text style={styles.sectionTitle}>BL à préparer</Text>
        <View style={styles.countBadge}>
          <Text style={styles.countBadgeText}>{selectionRows.length}</Text>
        </View>
      </View>
    </View>
  );

  const renderBLEmpty = () => {
    if (loadingSelection) return null;
    return (
      <View style={styles.emptyState}>
        <Text style={styles.emptyText}>Aucun BL assigné</Text>
        <Text style={styles.emptySubText}>
          Le responsable n'a pas encore sélectionné de BL pour cette date
        </Text>
      </View>
    );
  };

  // ── PRODUCT ITEM ──────────────────────────────────────────────────────────

  const renderProductItem = ({ item }: { item: ProductLine }) => {
    const draft = drafts[item.reference];
    if (!draft) return null;
    const cfg = STATUS_CONFIG[draft.status];

    return (
      <View style={styles.productCard}>
        <View style={styles.productCardHeader}>
          <Text style={styles.productRef}>{item.reference}</Text>
          {item.quantityExpected !== undefined && (
            <View style={styles.productQtyBadge}>
              <Text style={styles.productQtyText}>Qté att. {item.quantityExpected}</Text>
            </View>
          )}
        </View>

        <View style={styles.segmentTrack}>
          {(['available', 'partial', 'not_available'] as ProductStatus[]).map((s) => {
            const scfg = STATUS_CONFIG[s];
            const active = draft.status === s;
            return (
              <Pressable
                key={s}
                style={[styles.segmentBtn, active && { backgroundColor: scfg.bg }]}
                onPress={() => setStatus(item.reference, s)}>
                <Text style={[styles.segmentBtnText, active && { color: scfg.text, fontWeight: '700' }]}>
                  {scfg.label}
                </Text>
              </Pressable>
            );
          })}
        </View>

        {draft.status === 'partial' && (
          <View style={styles.qtyRow}>
            <Text style={styles.qtyLabel}>Quantité préparée</Text>
            <TextInput
              style={styles.qtyInput}
              value={draft.quantityPrepared !== undefined ? String(draft.quantityPrepared) : ''}
              onChangeText={(v) => setPreparedQty(item.reference, v)}
              keyboardType="numeric"
              placeholder="0"
              placeholderTextColor="#BBBBBB"
            />
          </View>
        )}

      </View>
    );
  };

  const renderProductList = () => (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      style={styles.flex}>
      <View style={styles.productViewHeader}>
        <Pressable
          style={({ pressed }) => [styles.backBtn, pressed && { opacity: 0.7 }]}
          onPress={goBackToList}>
          <Text style={styles.backBtnText}>‹ Retour</Text>
        </Pressable>
        <View style={styles.productViewTitle}>
          <Text style={styles.activeClientName} numberOfLines={1}>
            {activeRow?.destinataire || 'Client'}
          </Text>
          <Text style={styles.activeBlId}>BL #{activeBlId}</Text>
        </View>
        <Pressable
          style={({ pressed }) => [styles.scanBtnHeader, pressed && { opacity: 0.85 }]}
          onPress={openScanner}>
          <Text style={styles.scanBtnHeaderText}>Scanner</Text>
        </Pressable>
      </View>

      <View style={styles.statsBar}>
        {(['available', 'partial', 'not_available'] as ProductStatus[]).map((s) => {
          const cfg = STATUS_CONFIG[s];
          const count = s === 'available' ? stats.available : s === 'partial' ? stats.partial : stats.missing;
          return (
            <View key={s} style={[styles.statChip, { backgroundColor: cfg.bg, borderColor: cfg.border }]}>
              <Text style={[styles.statChipText, { color: cfg.text }]}>
                {cfg.label} {count}
              </Text>
            </View>
          );
        })}
        <View style={styles.statChipTotal}>
          <Text style={styles.statChipTotalText}>{stats.total} art.</Text>
        </View>
      </View>

      {error ? <View style={[styles.alertBox, styles.alertBoxInline]}><Text style={styles.alertText}>{error}</Text></View> : null}

      {loadingProducts ? (
        <View style={styles.loadingCentered}>
          <ActivityIndicator color={Brand.ember} size="large" />
          <Text style={styles.loadingText}>Chargement des articles…</Text>
        </View>
      ) : (
        <FlatList
          data={products}
          renderItem={renderProductItem}
          keyExtractor={(item) => item.reference}
          style={styles.flex}
          contentContainerStyle={styles.productListContent}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        />
      )}

      <View style={styles.productFooter}>
        <TextInput
          style={styles.commentInput}
          value={globalComment}
          onChangeText={setGlobalComment}
          placeholder="Commentaire général sur cette préparation…"
          placeholderTextColor="#BBBBBB"
          multiline
          numberOfLines={2}
        />
        {invalidPartialRefs.length > 0 && (
          <View style={styles.validationHint}>
            <Text style={styles.validationHintText}>
              Saisissez la quantité pour {invalidPartialRefs.length > 2
                ? `${invalidPartialRefs.slice(0, 2).join(', ')} +${invalidPartialRefs.length - 2}`
                : invalidPartialRefs.join(', ')}
            </Text>
          </View>
        )}
        <Pressable
          style={({ pressed }) => [
            styles.sendBtn,
            !canSend && styles.sendBtnDisabled,
            pressed && canSend && { opacity: 0.85 },
          ]}
          onPress={sendReport}
          disabled={!canSend}>
          <Text style={styles.sendBtnText}>
            {sending ? 'Envoi en cours…' : `Envoyer le rapport  (${stats.total} articles)`}
          </Text>
        </Pressable>
      </View>
    </KeyboardAvoidingView>
  );

  // ── RENDER ────────────────────────────────────────────────────────────────

  return (
    <SafeAreaView style={styles.safe} edges={['left', 'right', 'bottom']}>
      {activeBlId === null ? (
        <FlatList
          data={selectionRows}
          renderItem={renderBLItem}
          keyExtractor={(item) => `${item.bl_id}-${item.selected_at}`}
          ListHeaderComponent={renderBLHeader}
          ListEmptyComponent={renderBLEmpty}
          contentContainerStyle={styles.blListContent}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl
              refreshing={loadingSelection}
              onRefresh={loadSelection}
              tintColor={Brand.ember}
              colors={[Brand.ember]}
            />
          }
        />
      ) : (
        renderProductList()
      )}

      <DatePickerModal
        visible={showDatePicker}
        title="Date de préparation"
        value={targetDate}
        onConfirm={(d) => { setTargetDate(d); setShowDatePicker(false); }}
        onCancel={() => setShowDatePicker(false)}
      />

      <Modal visible={showScanner} animationType="slide" statusBarTranslucent onRequestClose={() => setShowScanner(false)}>
        <View style={scannerStyles.modal}>
          <View style={[scannerStyles.header, { paddingTop: insets.top + 12 }]}>
            <View style={{ flex: 1 }}>
              <Text style={scannerStyles.title}>Scanner les références</Text>
              <Text style={scannerStyles.subtitle}>
                {stats.available}/{stats.total} marqués OK
              </Text>
            </View>
            <Pressable style={scannerStyles.closeBtn} onPress={() => setShowScanner(false)}>
              <Text style={scannerStyles.closeBtnText}>Terminé</Text>
            </Pressable>
          </View>
          <View style={scannerStyles.body}>
            <CameraView
              style={scannerStyles.camera}
              facing="back"
              barcodeScannerSettings={{ barcodeTypes: ['qr', 'ean13', 'ean8', 'code128', 'code39'] }}
              onBarcodeScanned={isScanning ? (b) => { if (b.data) handleScanResult(b.data); } : undefined}
            />
            <View style={scannerStyles.overlay} pointerEvents="none">
              <View style={scannerStyles.frame}>
                <View style={[scannerStyles.corner, scannerStyles.cornerTL]} />
                <View style={[scannerStyles.corner, scannerStyles.cornerTR]} />
                <View style={[scannerStyles.corner, scannerStyles.cornerBL]} />
                <View style={[scannerStyles.corner, scannerStyles.cornerBR]} />
              </View>
              <Text style={scannerStyles.hint}>
                {scanFeedback ? '' : 'Pointez vers la référence article'}
              </Text>
            </View>
            {scanFeedback && (
              <View pointerEvents="none" style={scannerStyles.feedbackWrap}>
                <View style={[
                  scannerStyles.feedbackPill,
                  scanFeedback.kind === 'matched' && scannerStyles.feedbackPillMatched,
                  scanFeedback.kind === 'duplicate' && scannerStyles.feedbackPillDuplicate,
                  scanFeedback.kind === 'unknown' && scannerStyles.feedbackPillUnknown,
                ]}>
                  <Text style={scannerStyles.feedbackIcon}>
                    {scanFeedback.kind === 'matched' ? '✓' : scanFeedback.kind === 'duplicate' ? '•' : '!'}
                  </Text>
                  <Text style={scannerStyles.feedbackText} numberOfLines={1}>{scanFeedback.text}</Text>
                </View>
              </View>
            )}
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#FAFAFA' },
  flex: { flex: 1 },

  // BL List
  blListContent: { paddingHorizontal: 16 },
  blListHeader: { paddingTop: 20, paddingBottom: 8 },

  dateSection: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: '#EBEBEB',
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 4,
    elevation: 1,
  },
  dateSectionLabel: { fontSize: 12, fontWeight: '600', color: Brand.muted, textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 6 },
  dateRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  dateDisplay: { fontSize: 16, fontWeight: '600', color: Brand.ink, flex: 1 },
  changeDateBtn: { backgroundColor: '#F5F5F5', borderRadius: 10, paddingVertical: 7, paddingHorizontal: 14 },
  changeDateText: { fontSize: 13, color: Brand.ink, fontWeight: '500' },


  alertBox: { backgroundColor: '#FFF0F0', borderRadius: 12, borderWidth: 1, borderColor: '#FFD0D0', padding: 12, marginBottom: 10 },
  alertBoxInline: { marginHorizontal: 16, marginBottom: 8 },
  alertText: { color: Brand.danger, fontSize: 13, fontWeight: '500' },
  successBox: { backgroundColor: '#F0FFF4', borderRadius: 12, borderWidth: 1, borderColor: '#BBF7D0', padding: 12, marginBottom: 10 },
  successText: { color: Brand.success, fontSize: 13, fontWeight: '500' },

  loadingRow: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 12, justifyContent: 'center' },
  loadingText: { fontSize: 14, color: Brand.muted },
  loadingCentered: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12 },

  sectionHeader: { flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 4, marginBottom: 10 },
  sectionTitle: { fontSize: 16, fontWeight: '700', color: Brand.ink },
  countBadge: { backgroundColor: '#EBEBEB', borderRadius: 12, paddingHorizontal: 10, paddingVertical: 3 },
  countBadgeText: { fontSize: 13, fontWeight: '600', color: Brand.muted },

  blCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    padding: 16,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: '#EBEBEB',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 4,
    elevation: 1,
  },
  blCardLeft: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 12 },
  blIdBadge: { backgroundColor: Brand.ember + '20', borderRadius: 8, paddingHorizontal: 10, paddingVertical: 6, minWidth: 52, alignItems: 'center' },
  blIdText: { fontSize: 13, fontWeight: '700', color: Brand.ember },
  blCardInfo: { flex: 1 },
  blCardName: { fontSize: 15, fontWeight: '600', color: Brand.ink },
  blCardMeta: { fontSize: 12, color: Brand.muted, marginTop: 2 },
  blCardArrow: { paddingLeft: 8 },
  blCardArrowText: { fontSize: 22, color: '#CCCCCC', lineHeight: 24 },

  emptyState: { alignItems: 'center', paddingVertical: 56, gap: 8 },
  emptyText: { fontSize: 16, fontWeight: '600', color: Brand.muted },
  emptySubText: { fontSize: 13, color: '#AAAAAA', textAlign: 'center', paddingHorizontal: 32 },

  // Product view
  productViewHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 14,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#EBEBEB',
    gap: 12,
  },
  backBtn: { paddingVertical: 6, paddingHorizontal: 4 },
  backBtnText: { fontSize: 17, color: Brand.ember, fontWeight: '600' },
  scanBtnHeader: { backgroundColor: Brand.ember, borderRadius: 10, paddingHorizontal: 14, paddingVertical: 8 },
  scanBtnHeaderText: { color: '#FFFFFF', fontSize: 13, fontWeight: '700' },
  productViewTitle: { flex: 1 },
  activeClientName: { fontSize: 16, fontWeight: '700', color: Brand.ink },
  activeBlId: { fontSize: 12, color: Brand.muted, marginTop: 2 },

  statsBar: {
    flexDirection: 'row',
    gap: 8,
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#F0F0F0',
    flexWrap: 'wrap',
  },
  statChip: { paddingHorizontal: 12, paddingVertical: 5, borderRadius: 20, borderWidth: 1 },
  statChipText: { fontSize: 12, fontWeight: '600' },
  statChipTotal: { paddingHorizontal: 12, paddingVertical: 5, borderRadius: 20, backgroundColor: '#F5F5F5' },
  statChipTotalText: { fontSize: 12, fontWeight: '600', color: Brand.muted },

  productListContent: { padding: 16, paddingBottom: 8 },

  productCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    padding: 14,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: '#EBEBEB',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 4,
    elevation: 1,
  },
  productCardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
  productRef: { fontSize: 15, fontWeight: '700', color: Brand.ink, flex: 1 },
  productQtyBadge: { backgroundColor: '#F5F5F5', borderRadius: 8, paddingHorizontal: 10, paddingVertical: 4 },
  productQtyText: { fontSize: 12, color: Brand.muted, fontWeight: '600' },

  segmentTrack: {
    flexDirection: 'row',
    backgroundColor: '#EFEFEF',
    borderRadius: 12,
    padding: 3,
    gap: 2,
  },
  segmentBtn: {
    flex: 1,
    paddingVertical: 11,
    alignItems: 'center',
    borderRadius: 10,
  },
  segmentBtnText: { fontSize: 13, color: '#999999', fontWeight: '500' },

  qtyRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 12, gap: 12 },
  qtyLabel: { fontSize: 13, color: Brand.muted, fontWeight: '500' },
  qtyInput: {
    backgroundColor: '#F7F7F7',
    borderRadius: 10,
    borderWidth: 1.5,
    borderColor: '#E8E8E8',
    paddingHorizontal: 14,
    paddingVertical: 10,
    fontSize: 16,
    fontWeight: '600',
    color: Brand.ink,
    minWidth: 90,
    textAlign: 'center',
  },

  productFooter: {
    backgroundColor: '#FFFFFF',
    borderTopWidth: 1,
    borderTopColor: '#EBEBEB',
    padding: 16,
    gap: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -2 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 8,
  },
  commentInput: {
    backgroundColor: '#F7F7F7',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E8E8E8',
    padding: 12,
    fontSize: 14,
    color: Brand.ink,
    minHeight: 56,
    textAlignVertical: 'top',
  },
  sendBtn: {
    backgroundColor: Brand.ember,
    borderRadius: 14,
    paddingVertical: 16,
    alignItems: 'center',
  },
  sendBtnDisabled: { opacity: 0.35 },
  sendBtnText: { color: '#FFFFFF', fontSize: 15, fontWeight: '700', letterSpacing: 0.2 },
  validationHint: {
    backgroundColor: '#FFF8E1',
    borderWidth: 1,
    borderColor: '#FFE0B2',
    borderRadius: 10,
    paddingVertical: 9,
    paddingHorizontal: 12,
  },
  validationHintText: { fontSize: 12, color: '#9A4F00', fontWeight: '600' },
});

const scannerStyles = StyleSheet.create({
  modal: { flex: 1, backgroundColor: '#0A0A0A' },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingBottom: 16,
    backgroundColor: Brand.ink,
  },
  title: { color: '#FFFFFF', fontSize: 18, fontWeight: '600' },
  subtitle: { color: 'rgba(255,255,255,0.65)', fontSize: 12, marginTop: 2 },
  closeBtn: { backgroundColor: 'rgba(255,255,255,0.15)', borderRadius: 8, paddingVertical: 7, paddingHorizontal: 14, marginLeft: 12 },
  closeBtnText: { color: '#FFFFFF', fontSize: 14, fontWeight: '500' },
  body: { flex: 1, position: 'relative' },
  camera: { flex: 1 },
  overlay: { ...StyleSheet.absoluteFillObject, justifyContent: 'center', alignItems: 'center', gap: 24 },
  frame: { width: 280, height: 180, position: 'relative' },
  corner: { position: 'absolute', width: 24, height: 24, borderColor: Brand.ember, borderRadius: 4 },
  cornerTL: { top: 0, left: 0, borderTopWidth: 4, borderLeftWidth: 4 },
  cornerTR: { top: 0, right: 0, borderTopWidth: 4, borderRightWidth: 4 },
  cornerBL: { bottom: 0, left: 0, borderBottomWidth: 4, borderLeftWidth: 4 },
  cornerBR: { bottom: 0, right: 0, borderBottomWidth: 4, borderRightWidth: 4 },
  hint: { color: 'rgba(255,255,255,0.8)', fontSize: 15, textAlign: 'center', fontWeight: '500' },
  feedbackWrap: { position: 'absolute', left: 0, right: 0, bottom: 60, alignItems: 'center' },
  feedbackPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 18,
    paddingVertical: 12,
    borderRadius: 999,
    maxWidth: '85%',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
  },
  feedbackPillMatched: { backgroundColor: '#1FA871' },
  feedbackPillDuplicate: { backgroundColor: '#3C3C3C' },
  feedbackPillUnknown: { backgroundColor: Brand.danger },
  feedbackIcon: { fontSize: 16, fontWeight: '800', color: '#FFFFFF' },
  feedbackText: { fontSize: 14, fontWeight: '600', color: '#FFFFFF', flexShrink: 1 },
});
