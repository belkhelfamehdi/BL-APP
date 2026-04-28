import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import DateTimePicker from '@react-native-community/datetimepicker';
import { SafeAreaView } from 'react-native-safe-area-context';

import { api } from '@/services/api';
import { Brand } from '@/constants/brand';
import { PreparationItemPayload, ProductStatus, SelectionRow } from '@/types/app';
import { ProductLine, mapProducts } from '@/utils/products';

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

const statusColors: Record<ProductStatus, { bg: string; text: string; border: string }> = {
  available: { bg: '#e8f5e9', text: '#2e7d32', border: '#a5d6a7' },
  partial: { bg: '#fff3e0', text: '#ef6c00', border: '#ffcc80' },
  not_available: { bg: '#ffebee', text: '#c62828', border: '#ef9a9a' },
};

function todayIso(): string {
  return new Date().toISOString().slice(0, 10);
}

function dedupeSelectionRows(rows: SelectionRow[]): SelectionRow[] {
  const byBl = new Map<number, SelectionRow>();
  for (const row of rows) {
    const current = byBl.get(row.bl_id);
    if (!current) {
      byBl.set(row.bl_id, row);
      continue;
    }
    const currentTime = new Date(current.selected_at).getTime();
    const candidateTime = new Date(row.selected_at).getTime();
    if (candidateTime >= currentTime) {
      byBl.set(row.bl_id, row);
    }
  }
  return [...byBl.values()].sort((a, b) => a.bl_id - b.bl_id);
}

export function PreparateurScreen({ token, fullName }: Props) {
  const [targetDate, setTargetDate] = useState(todayIso());
  const [showDatePicker, setShowDatePicker] = useState(false);
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

  const handleDateChange = useCallback((event: any, selectedDate?: Date) => {
    setShowDatePicker(false);
    if (selectedDate) {
      const iso = selectedDate.toISOString().slice(0, 10);
      setTargetDate(iso);
    }
  }, []);

  const activeRow = useMemo(
    () => selectionRows.find((row) => row.bl_id === activeBlId) ?? null,
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

  useEffect(() => { void loadSelection(); }, [loadSelection]);

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
      setActiveBlId(blId);
      setProducts(lines);
      setDrafts(nextDraft);
      setGlobalComment('');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Erreur');
      setActiveBlId(null);
      setProducts([]);
      setDrafts({});
    } finally {
      setLoadingProducts(false);
    }
  }, []);

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

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const setNote = (reference: string, value: string) => {
    setDrafts((prev) => {
      const current = prev[reference];
      if (!current) return prev;
      return { ...prev, [reference]: { ...current, note: value } };
    });
  };

  const sendReport = async () => {
    if (!activeBlId || sending) return;
    const items = Object.values(drafts);
    if (items.length === 0) {
      Alert.alert('Info', 'Chargez un BL avant.');
      return;
    }
    for (const item of items) {
      if (item.status === 'partial' && (item.quantityPrepared === undefined || item.quantityPrepared < 0)) {
        Alert.alert('Erreur', `Quantite pour ${item.reference}`);
        return;
      }
    }

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
      setSuccess(`Rapport envoye BL #${currentBlId}`);
      setSelectionRows((prev) => prev.filter((row) => row.bl_id !== currentBlId));
      setActiveBlId(null);
      setProducts([]);
      setDrafts({});
      setGlobalComment('');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Erreur');
    } finally {
      setSending(false);
    }
  };

  return (
    <SafeAreaView style={styles.safe} edges={['left', 'right', 'bottom']}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.flex}>
        <ScrollView contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled">
          <View style={styles.header}>
            <Text style={styles.headerTitle}>Preparation</Text>
            <Text style={styles.headerSub}>{fullName}</Text>
          </View>

          <View style={styles.dateRow}>
            <Text style={styles.dateLabel}>{new Date(targetDate).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long' })}</Text>
            <Pressable style={styles.dateInput} onPress={() => setShowDatePicker(true)}>
              <Text style={styles.dateInputText}>Changer</Text>
            </Pressable>
          </View>

          {showDatePicker && (
            <DateTimePicker
              value={new Date(targetDate)}
              mode="date"
              display={Platform.OS === 'ios' ? 'spinner' : 'default'}
              onChange={handleDateChange}
            />
          )}

          <Pressable style={styles.reloadButton} onPress={loadSelection}>
            <Text style={styles.reloadText}>Actualiser</Text>
          </Pressable>

          {error && <Text style={styles.error}>{error}</Text>}
          {success && <Text style={styles.success}>{success}</Text>}

          <View style={styles.blList}>
            <Text style={styles.sectionTitle}>BL a preparer ({selectionRows.length})</Text>
            {loadingSelection && <ActivityIndicator color={Brand.ink} style={styles.loader} />}
            {!loadingSelection && selectionRows.length === 0 && <Text style={styles.empty}>Aucun BL</Text>}
            <ScrollView style={styles.blScroll} showsVerticalScrollIndicator>
              {selectionRows.map((row) => (
                <Pressable
                  key={`${row.bl_id}-${row.selected_at}`}
                  style={[styles.blCard, activeBlId === row.bl_id && styles.blCardActive]}
                  onPress={() => openBl(row.bl_id)}>
                  <View>
                    <Text style={[styles.blName, activeBlId === row.bl_id && styles.blNameActive]}>{row.destinataire}</Text>
                    <Text style={styles.blId}>#{row.bl_id}</Text>
                  </View>
                </Pressable>
              ))}
            </ScrollView>
          </View>

          {activeBlId && (
            <View style={styles.productsSection}>
              <View style={styles.activeHeader}>
                <Text style={styles.activeTitle}>{activeRow?.destinataire}</Text>
                <Text style={styles.activeId}>#{activeBlId}</Text>
              </View>

              <View style={styles.statsRow}>
                <View style={[styles.statBadge, { backgroundColor: statusColors.available.bg }]}>
                  <Text style={[styles.statText, { color: statusColors.available.text }]}>OK {stats.available}</Text>
                </View>
                <View style={[styles.statBadge, { backgroundColor: statusColors.partial.bg }]}>
                  <Text style={[styles.statText, { color: statusColors.partial.text }]}>Partiel {stats.partial}</Text>
                </View>
                <View style={[styles.statBadge, { backgroundColor: statusColors.not_available.bg }]}>
                  <Text style={[styles.statText, { color: statusColors.not_available.text }]}>Rupture {stats.missing}</Text>
                </View>
              </View>

              {loadingProducts && <ActivityIndicator color={Brand.ink} style={styles.loader} />}

              <ScrollView style={styles.productsScroll} showsVerticalScrollIndicator>
                {!loadingProducts && products.map((item) => {
                  const draft = drafts[item.reference];
                  if (!draft) return null;
                  const colors = statusColors[draft.status];

                  return (
                    <View key={item.reference} style={styles.productCard}>
                      <View style={styles.productHeader}>
                        <Text style={styles.productRef}>{item.reference}</Text>
                        <Text style={styles.productQty}>→ {item.quantityExpected}</Text>
                      </View>

                      <View style={styles.statusButtons}>
                        {(['available', 'partial', 'not_available'] as ProductStatus[]).map((status) => (
                          <Pressable
                            key={status}
                            style={[styles.statusBtn, draft.status === status && { backgroundColor: colors.bg, borderColor: colors.border }]}
                            onPress={() => setStatus(item.reference, status)}>
                            <Text style={[styles.statusBtnText, draft.status === status && { color: colors.text }]}>
                              {status === 'available' ? 'OK' : status === 'partial' ? 'Partiel' : 'Rupture'}
                            </Text>
                          </Pressable>
                        ))}
                      </View>

                      {draft.status === 'partial' && (
                        <TextInput
                          style={styles.qtyInput}
                          value={draft.quantityPrepared !== undefined ? String(draft.quantityPrepared) : ''}
                          onChangeText={(v) => setPreparedQty(item.reference, v)}
                          keyboardType="numeric"
                          placeholder="Qte Preparee"
                          placeholderTextColor={Brand.muted}
                        />
                      )}
                    </View>
                  );
                })}
              </ScrollView>

              <TextInput
                style={styles.commentInput}
                value={globalComment}
                onChangeText={setGlobalComment}
                placeholder="Commentaire..."
                placeholderTextColor={Brand.muted}
                multiline
              />

              <Pressable
                style={[styles.sendButton, (sending || stats.total === 0) && styles.sendButtonDisabled]}
                onPress={sendReport}
                disabled={sending || stats.total === 0}>
                <Text style={styles.sendButtonText}>{sending ? 'Envoi...' : 'Envoyer'}</Text>
              </Pressable>
            </View>
          )}
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#fff' },
  flex: { flex: 1 },
  container: { padding: 20, paddingBottom: 100 },
  header: { marginBottom: 24 },
  headerTitle: { fontSize: 28, fontWeight: '700', color: Brand.ink },
  headerSub: { fontSize: 14, color: Brand.muted, marginTop: 4 },
  dateRow: { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 16 },
  dateLabel: { flex: 1, fontSize: 16, fontWeight: '600', color: Brand.ink },
  dateInput: {
    backgroundColor: '#f5f5f5',
    borderRadius: 8,
    paddingHorizontal: 16,
    paddingVertical: 10,
  },
  dateInputText: {
    fontSize: 14,
    color: Brand.ink,
    fontWeight: '500',
  },
  reloadButton: {
    backgroundColor: '#f5f5f5',
    borderRadius: 10,
    paddingVertical: 12,
    alignItems: 'center',
    marginBottom: 20,
  },
  reloadText: { fontSize: 14, fontWeight: '600', color: Brand.ink },
  error: { color: Brand.danger, fontSize: 13, marginBottom: 16 },
  success: { color: Brand.success, fontSize: 13, marginBottom: 16 },
  loader: { marginVertical: 20 },
  empty: { color: Brand.muted, textAlign: 'center', padding: 20 },
  blList: { marginBottom: 20 },
  blScroll: { maxHeight: 200 },
  sectionTitle: { fontSize: 14, fontWeight: '600', color: Brand.muted, marginBottom: 12 },
  blCard: {
    backgroundColor: '#fafafa',
    borderRadius: 12,
    padding: 14,
    marginBottom: 8,
  },
  blCardActive: { backgroundColor: Brand.ink },
  blName: { fontSize: 15, fontWeight: '600', color: Brand.ink },
  blNameActive: { color: '#fff' },
  blId: { fontSize: 12, color: Brand.muted, marginTop: 2 },
  productsSection: { marginTop: 8 },
  productsScroll: { maxHeight: 320 },
  activeHeader: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 16 },
  activeTitle: { fontSize: 18, fontWeight: '600', color: Brand.ink },
  activeId: { fontSize: 14, color: Brand.muted },
  statsRow: { flexDirection: 'row', gap: 8, marginBottom: 20 },
  statBadge: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 16 },
  statText: { fontSize: 12, fontWeight: '600' },
  productCard: { backgroundColor: '#fafafa', borderRadius: 12, padding: 14, marginBottom: 12 },
  productHeader: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 10 },
  productRef: { fontSize: 14, fontWeight: '600', color: Brand.ink },
  productQty: { fontSize: 14, color: Brand.muted },
  statusButtons: { flexDirection: 'row', gap: 8 },
  statusBtn: {
    flex: 1,
    paddingVertical: 8,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#eee',
    alignItems: 'center',
  },
  statusBtnText: { fontSize: 12, fontWeight: '600', color: Brand.muted },
  qtyInput: {
    marginTop: 10,
    backgroundColor: '#fff',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 14,
  },
  commentInput: {
    marginTop: 8,
    backgroundColor: '#fafafa',
    borderRadius: 12,
    padding: 14,
    fontSize: 14,
    minHeight: 80,
    textAlignVertical: 'top',
  },
  sendButton: {
    marginTop: 16,
    backgroundColor: Brand.ink,
    borderRadius: 12,
    paddingVertical: 16,
    alignItems: 'center',
  },
  sendButtonDisabled: { opacity: 0.4 },
  sendButtonText: { color: '#fff', fontSize: 16, fontWeight: '600' },
});