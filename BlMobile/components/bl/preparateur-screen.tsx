import React, { useCallback, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
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
      setSelectionRows(res.data);
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
      setSending(true);
      setError(null);
      setSuccess(null);
      await api.sendPreparationReport(token, {
        report_date: targetDate,
        bl_id: activeBlId,
        overall_comment: globalComment,
        items: payload,
      });
      setSuccess(`Rapport envoye pour BL #${activeBlId}`);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Erreur envoi rapport');
    } finally {
      setSending(false);
    }
  };

  return (
    <SafeAreaView style={styles.safe} edges={['left', 'right', 'bottom']}>
      <ScrollView contentContainerStyle={styles.container}>
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

          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chipsWrap}>
            {selectionRows.map((row) => (
              <Pressable
                key={`${row.bl_id}-${row.selected_at}`}
                style={[styles.chip, activeBlId === row.bl_id && styles.chipActive]}
                onPress={() => openBl(row.bl_id)}>
                <Text style={[styles.chipText, activeBlId === row.bl_id && styles.chipTextActive]}>
                  {row.destinataire || 'N/A'}
                </Text>
                <Text style={[styles.chipSub, activeBlId === row.bl_id && styles.chipTextActive]}>
                  BL #{row.bl_id}
                </Text>
              </Pressable>
            ))}
          </ScrollView>
        </View>

        <View style={styles.sectionCard}>
          <View style={styles.sectionHeaderRow}>
            <Text style={styles.sectionTitle}>3. Controler les produits</Text>
            <Text style={styles.statsText}>
              {stats.available}/{stats.total} OK
            </Text>
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
                    style={styles.inputSmall}
                    value={draft.quantityPrepared !== undefined ? String(draft.quantityPrepared) : ''}
                    onChangeText={(value) => setPreparedQty(item.reference, value)}
                    keyboardType="numeric"
                    placeholder="Quantite preparee"
                    placeholderTextColor="#8b97a8"
                  />

                  <TextInput
                    style={styles.inputSmall}
                    value={draft.note || ''}
                    onChangeText={(value) => setNote(item.reference, value)}
                    placeholder="Note (optionnel)"
                    placeholderTextColor="#8b97a8"
                  />
                </View>
              );
            })}
          </ScrollView>
        </View>

        <View style={styles.sectionCard}>
          <Text style={styles.sectionTitle}>4. Envoyer le rapport</Text>
          <TextInput
            style={styles.input}
            value={globalComment}
            onChangeText={setGlobalComment}
            placeholder="Commentaire global"
            placeholderTextColor="#8b97a8"
          />

          <Pressable
            style={[styles.primaryButton, (sending || !activeBlId || stats.total === 0) && styles.disabled]}
            onPress={sendReport}>
            {sending ? <ActivityIndicator color="#ffffff" /> : <Text style={styles.primaryText}>Envoyer rapport</Text>}
          </Pressable>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: '#f5f6f8',
  },
  container: {
    padding: 14,
    gap: 12,
    paddingBottom: 22,
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
  chipsWrap: {
    gap: 8,
    paddingRight: 8,
  },
  chip: {
    minWidth: 132,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#dbeafe',
    backgroundColor: '#eff6ff',
    padding: 10,
    gap: 3,
  },
  chipActive: {
    backgroundColor: '#2563eb',
    borderColor: '#2563eb',
  },
  chipText: {
    color: '#1e3a8a',
    fontWeight: '800',
  },
  chipSub: {
    color: '#1d4ed8',
    fontSize: 12,
  },
  chipTextActive: {
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
  productsWrap: {
    maxHeight: 360,
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
