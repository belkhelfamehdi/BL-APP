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
import { SafeAreaView } from 'react-native-safe-area-context';

import { api } from '@/services/api';
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

const statusLabels: Record<ProductStatus, string> = {
  available: 'OK',
  partial: 'Partiel',
  not_available: 'Rupture',
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
      setError(e instanceof Error ? e.message : 'Erreur chargement selection');
      setSelectionRows([]);
    } finally {
      setLoadingSelection(false);
    }
  }, [targetDate, token]);

  useEffect(() => {
    void loadSelection();
  }, [loadSelection]);

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
      setError(e instanceof Error ? e.message : 'Erreur chargement produits');
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
      if (!current) {
        return prev;
      }

      const next: ProductDraft = { ...current, status };
      if (status === 'not_available') {
        next.quantityPrepared = 0;
      }
      if (status === 'available' && typeof current.quantityExpected === 'number') {
        next.quantityPrepared = current.quantityExpected;
      }

      return {
        ...prev,
        [reference]: next,
      };
    });
  };

  const setPreparedQty = (reference: string, value: string) => {
    const cleaned = value.trim();
    const parsed = cleaned === '' ? undefined : Number(cleaned.replace(',', '.'));

    setDrafts((prev) => {
      const current = prev[reference];
      if (!current) {
        return prev;
      }

      return {
        ...prev,
        [reference]: {
          ...current,
          quantityPrepared: Number.isFinite(parsed as number) ? (parsed as number) : undefined,
        },
      };
    });
  };

  const setNote = (reference: string, value: string) => {
    setDrafts((prev) => {
      const current = prev[reference];
      if (!current) {
        return prev;
      }

      return {
        ...prev,
        [reference]: {
          ...current,
          note: value,
        },
      };
    });
  };

  const sendReport = async () => {
    if (!activeBlId || sending) {
      return;
    }

    const items = Object.values(drafts);
    if (items.length === 0) {
      Alert.alert('Information', 'Chargez un BL avant denvoyer le rapport.');
      return;
    }

    for (const item of items) {
      if (item.status === 'partial' && (item.quantityPrepared === undefined || item.quantityPrepared < 0)) {
        Alert.alert('Quantite manquante', `Saisissez la quantite preperee pour ${item.reference}.`);
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
      setSuccess(`Rapport envoye pour BL #${currentBlId}`);
      setSelectionRows((prev) => prev.filter((row) => row.bl_id !== currentBlId));
      setActiveBlId(null);
      setProducts([]);
      setDrafts({});
      setGlobalComment('');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Erreur envoi rapport');
    } finally {
      setSending(false);
    }
  };

  return (
    <SafeAreaView style={styles.safe} edges={['left', 'right', 'bottom']}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.flex}>
        <ScrollView
          contentContainerStyle={styles.container}
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="on-drag">
        <View style={styles.headerCard}>
          <Text style={styles.headerTitle}>Preparation des commandes</Text>
          <Text style={styles.headerSub}>Preparateur: {fullName}</Text>
        </View>

        <View style={styles.sectionCard}>
          <Text style={styles.sectionTitle}>1. Charger les BL du jour</Text>
          <Text style={styles.label}>Date de preparation</Text>
          <TextInput
            style={styles.input}
            value={targetDate}
            onChangeText={setTargetDate}
            autoCapitalize="none"
            placeholder="AAAA-MM-JJ"
            placeholderTextColor="#8b97a8"
          />
          <Pressable style={styles.secondaryButton} onPress={loadSelection}>
            <Text style={styles.secondaryText}>Charger les BL selectionnes</Text>
          </Pressable>
        </View>

        {error ? <Text style={styles.errorText}>{error}</Text> : null}
        {success ? <Text style={styles.successText}>{success}</Text> : null}

        <View style={styles.sectionCard}>
          <Text style={styles.sectionTitle}>2. Choisir un BL</Text>
          {loadingSelection ? <ActivityIndicator color="#2563eb" /> : null}
          {selectionRows.length === 0 ? <Text style={styles.emptyText}>Aucun BL charge.</Text> : null}

          <ScrollView
            style={styles.blListWrap}
            nestedScrollEnabled
            showsVerticalScrollIndicator
            contentContainerStyle={styles.blListContent}>
            {selectionRows.map((row) => (
              <Pressable
                key={`${row.bl_id}-${row.selected_at}`}
                style={[styles.blRow, activeBlId === row.bl_id && styles.blRowActive]}
                onPress={() => openBl(row.bl_id)}>
                <Text style={[styles.blTitle, activeBlId === row.bl_id && styles.blTextActive]}>
                  {row.destinataire || 'N/A'}
                </Text>
                <Text style={[styles.blSub, activeBlId === row.bl_id && styles.blTextActive]}>
                  BL #{row.bl_id}
                </Text>
                <Text style={[styles.blMeta, activeBlId === row.bl_id && styles.blTextActive]}>
                  Selectionne par: {row.selector_name}
                </Text>
              </Pressable>
            ))}
          </ScrollView>
        </View>

        <View style={styles.sectionCard}>
          <View style={styles.sectionHeaderRow}>
            <Text style={styles.sectionTitle}>3. Controler les produits</Text>
            <Text style={styles.statsText}>{stats.total} refs</Text>
          </View>

          {activeRow ? (
            <View style={styles.activeBlCard}>
              <Text style={styles.activeBlTitle}>{activeRow.destinataire || 'N/A'}</Text>
              <Text style={styles.activeBlSub}>BL #{activeRow.bl_id}</Text>
            </View>
          ) : (
            <Text style={styles.emptyText}>Choisissez un BL pour afficher ses produits.</Text>
          )}

          <View style={styles.statsBadgesWrap}>
            <Text style={[styles.statsBadge, styles.statsBadgeOk]}>OK {stats.available}</Text>
            <Text style={[styles.statsBadge, styles.statsBadgePartial]}>Partiel {stats.partial}</Text>
            <Text style={[styles.statsBadge, styles.statsBadgeMissing]}>Rupture {stats.missing}</Text>
          </View>

          {loadingProducts ? <ActivityIndicator color="#2563eb" /> : null}
          {!loadingProducts && activeBlId && products.length === 0 ? (
            <Text style={styles.emptyText}>Aucun produit detecte pour ce BL.</Text>
          ) : null}

          <ScrollView
            style={styles.productsWrap}
            contentContainerStyle={styles.productsContent}
            nestedScrollEnabled
            showsVerticalScrollIndicator>
            {products.map((item) => {
              const draft = drafts[item.reference];
              if (!draft) {
                return null;
              }

              return (
                <View key={item.reference} style={styles.productCard}>
                  <Text style={styles.productTitle}>{item.reference}</Text>
                  <Text style={styles.productMeta}>Qte attendue: {item.quantityExpected ?? 'N/A'}</Text>

                  <View style={styles.statusRow}>
                    {(['available', 'partial', 'not_available'] as ProductStatus[]).map((status) => (
                      <Pressable
                        key={`${item.reference}-${status}`}
                        style={[styles.statusButton, draft.status === status && styles.statusButtonActive]}
                        onPress={() => setStatus(item.reference, status)}>
                        <Text style={[styles.statusText, draft.status === status && styles.statusTextActive]}>
                          {statusLabels[status]}
                        </Text>
                      </Pressable>
                    ))}
                  </View>

                  <TextInput
                    style={[styles.inputSmall, draft.status !== 'partial' && styles.inputDisabled]}
                    value={draft.quantityPrepared !== undefined ? String(draft.quantityPrepared) : ''}
                    onChangeText={(value) => setPreparedQty(item.reference, value)}
                    editable={draft.status === 'partial'}
                    keyboardType="numeric"
                    placeholder={draft.status === 'partial' ? 'Quantite preparee' : 'Auto selon statut'}
                    placeholderTextColor="#8b97a8"
                  />

                  <TextInput
                    style={[styles.inputSmall, styles.inputNote]}
                    value={draft.note || ''}
                    onChangeText={(value) => setNote(item.reference, value)}
                    placeholder="Note (optionnel)"
                    placeholderTextColor="#8b97a8"
                    multiline
                  />
                </View>
              );
            })}
          </ScrollView>
        </View>

        <View style={styles.sectionCard}>
          <Text style={styles.sectionTitle}>4. Envoyer le rapport</Text>
          <TextInput
            style={[styles.input, styles.inputNote]}
            value={globalComment}
            onChangeText={setGlobalComment}
            placeholder="Commentaire global"
            placeholderTextColor="#8b97a8"
            multiline
          />

          <Pressable
            style={[styles.primaryButton, (sending || !activeBlId || stats.total === 0) && styles.disabled]}
            onPress={sendReport}>
            {sending ? <ActivityIndicator color="#ffffff" /> : <Text style={styles.primaryText}>Envoyer rapport</Text>}
          </Pressable>
        </View>
      </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  flex: {
    flex: 1,
  },
  safe: {
    flex: 1,
    backgroundColor: '#f5f6f8',
  },
  container: {
    padding: 14,
    gap: 12,
    paddingBottom: 120,
  },
  headerCard: {
    borderRadius: 14,
    backgroundColor: '#111827',
    padding: 14,
  },
  headerTitle: {
    color: '#ffffff',
    fontWeight: '800',
    fontSize: 20,
  },
  headerSub: {
    color: '#cbd5e1',
    marginTop: 3,
  },
  sectionCard: {
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#e5e7eb',
    backgroundColor: '#ffffff',
    padding: 12,
    gap: 8,
  },
  sectionTitle: {
    color: '#111827',
    fontWeight: '800',
    fontSize: 15,
  },
  label: {
    color: '#1f2937',
    fontWeight: '700',
  },
  input: {
    borderWidth: 1,
    borderColor: '#d1d5db',
    borderRadius: 10,
    backgroundColor: '#ffffff',
    color: '#111827',
    paddingHorizontal: 10,
    paddingVertical: 9,
  },
  secondaryButton: {
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#bfdbfe',
    backgroundColor: '#eff6ff',
    paddingVertical: 10,
    alignItems: 'center',
  },
  secondaryText: {
    color: '#1d4ed8',
    fontWeight: '700',
  },
  errorText: {
    color: '#b91c1c',
    fontWeight: '700',
    paddingHorizontal: 2,
  },
  successText: {
    color: '#166534',
    fontWeight: '700',
    paddingHorizontal: 2,
  },
  emptyText: {
    color: '#6b7280',
  },
  blListWrap: {
    maxHeight: 210,
  },
  blListContent: {
    gap: 8,
    paddingBottom: 4,
  },
  blRow: {
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#dbeafe',
    backgroundColor: '#eff6ff',
    padding: 10,
    gap: 2,
  },
  blRowActive: {
    backgroundColor: '#2563eb',
    borderColor: '#2563eb',
  },
  blTitle: {
    color: '#1e3a8a',
    fontWeight: '800',
  },
  blSub: {
    color: '#1d4ed8',
    fontSize: 12,
  },
  blMeta: {
    color: '#334155',
    fontSize: 12,
  },
  blTextActive: {
    color: '#ffffff',
  },
  sectionHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  statsText: {
    color: '#2563eb',
    fontWeight: '700',
  },
  activeBlCard: {
    borderWidth: 1,
    borderColor: '#bfdbfe',
    backgroundColor: '#f0f9ff',
    borderRadius: 10,
    padding: 10,
  },
  activeBlTitle: {
    color: '#0c4a6e',
    fontWeight: '800',
  },
  activeBlSub: {
    color: '#0369a1',
    marginTop: 2,
  },
  statsBadgesWrap: {
    flexDirection: 'row',
    gap: 8,
    flexWrap: 'wrap',
  },
  statsBadge: {
    borderRadius: 999,
    borderWidth: 1,
    paddingVertical: 4,
    paddingHorizontal: 10,
    fontSize: 12,
    fontWeight: '700',
  },
  statsBadgeOk: {
    borderColor: '#a7f3d0',
    backgroundColor: '#ecfdf5',
    color: '#047857',
  },
  statsBadgePartial: {
    borderColor: '#fde68a',
    backgroundColor: '#fffbeb',
    color: '#b45309',
  },
  statsBadgeMissing: {
    borderColor: '#fecaca',
    backgroundColor: '#fef2f2',
    color: '#b91c1c',
  },
  productsWrap: {
    maxHeight: 420,
  },
  productsContent: {
    gap: 8,
    paddingBottom: 4,
  },
  productCard: {
    borderWidth: 1,
    borderColor: '#e5e7eb',
    borderRadius: 10,
    backgroundColor: '#ffffff',
    padding: 10,
    gap: 7,
  },
  productTitle: {
    color: '#111827',
    fontWeight: '800',
  },
  productMeta: {
    color: '#6b7280',
    fontSize: 12,
  },
  statusRow: {
    flexDirection: 'row',
    gap: 6,
    flexWrap: 'wrap',
  },
  statusButton: {
    borderWidth: 1,
    borderColor: '#cbd5e1',
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  statusButtonActive: {
    backgroundColor: '#2563eb',
    borderColor: '#2563eb',
  },
  statusText: {
    color: '#334155',
    fontSize: 12,
    fontWeight: '700',
  },
  statusTextActive: {
    color: '#ffffff',
  },
  inputSmall: {
    borderWidth: 1,
    borderColor: '#d1d5db',
    borderRadius: 10,
    backgroundColor: '#ffffff',
    color: '#111827',
    paddingHorizontal: 10,
    paddingVertical: 8,
  },
  inputDisabled: {
    backgroundColor: '#f8fafc',
    color: '#94a3b8',
  },
  inputNote: {
    minHeight: 42,
    textAlignVertical: 'top',
  },
  primaryButton: {
    borderRadius: 10,
    backgroundColor: '#2563eb',
    alignItems: 'center',
    paddingVertical: 11,
  },
  primaryText: {
    color: '#ffffff',
    fontWeight: '800',
  },
  disabled: {
    opacity: 0.45,
  },
});
