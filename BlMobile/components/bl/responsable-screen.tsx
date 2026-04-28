import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
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
import { ArticleBL, SelectionRow } from '@/types/app';

interface Props {
  token: string;
  fullName: string;
}

function tomorrowIso(): string {
  const d = new Date();
  d.setDate(d.getDate() + 1);
  return d.toISOString().slice(0, 10);
}

export function ResponsableScreen({ token, fullName }: Props) {
  const [targetDate, setTargetDate] = useState(tomorrowIso());
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [articles, setArticles] = useState<ArticleBL[]>([]);
  const [selectedMap, setSelectedMap] = useState<Record<number, boolean>>({});
  const [existingSelections, setExistingSelections] = useState<SelectionRow[]>([]);
  const [loadingArticles, setLoadingArticles] = useState(false);
  const [, setLoadingSelection] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const handleDateChange = useCallback((event: any, selectedDate?: Date) => {
    setShowDatePicker(false);
    if (selectedDate) {
      const iso = selectedDate.toISOString().slice(0, 10);
      setTargetDate(iso);
    }
  }, []);

  const existingSelectedIdsSet = useMemo(
    () => new Set(existingSelections.map((row) => row.bl_id)),
    [existingSelections]
  );

  const selectedIds = useMemo(
    () => Object.entries(selectedMap).filter(([, v]) => v).map(([k]) => Number(k)),
    [selectedMap]
  );

  const selectedCount = selectedIds.length;

  const hasPendingChanges = useMemo(() => {
    if (selectedIds.length !== existingSelections.length) return true;
    const existingSet = new Set(existingSelections.map((s) => s.bl_id));
    return selectedIds.some((id) => !existingSet.has(id));
  }, [selectedIds, existingSelections]);

  const loadArticles = useCallback(async () => {
    try {
      setLoadingArticles(true);
      setError(null);
      const res = await api.listArticles();
      setArticles(res.data);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Erreur chargement');
    } finally {
      setLoadingArticles(false);
    }
  }, []);

  const loadSelections = useCallback(async () => {
    try {
      setLoadingSelection(true);
      setError(null);
      const res = await api.listSelections(token, targetDate);
      setExistingSelections(res.data);
      const nextSelected: Record<number, boolean> = {};
      for (const row of res.data) {
        nextSelected[row.bl_id] = true;
      }
      setSelectedMap(nextSelected);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Erreur chargement');
    } finally {
      setLoadingSelection(false);
    }
  }, [targetDate, token]);

  useEffect(() => { void loadArticles(); }, [loadArticles]);
  useEffect(() => { void loadSelections(); }, [loadSelections]);

  const saveSelection = async () => {
    if (!hasPendingChanges || saving) return;
    try {
      setSaving(true);
      setError(null);
      setSuccess(null);
      await api.createSelections(token, targetDate, selectedIds);
      setSuccess(selectedCount === 0 ? 'Selection vide' : `${selectedCount} BL enregistres`);
      await loadSelections();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Erreur');
    } finally {
      setSaving(false);
    }
  };

  const toggleItem = (id: number) => {
    setSelectedMap((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  return (
    <SafeAreaView style={styles.safe} edges={['left', 'right', 'bottom']}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.flex}>
        <ScrollView contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled">
          <View style={styles.header}>
            <Text style={styles.headerTitle}>Preparation</Text>
            <Text style={styles.headerSubtitle}>
              {new Date(targetDate).toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' })}
            </Text>
          </View>

          <View style={styles.dateRow}>
            <Text style={styles.dateLabel}>Date</Text>
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

          <View style={styles.actions}>
            <Pressable style={styles.actionButton} onPress={loadArticles}>
              <Text style={styles.actionText}>Charger BL</Text>
            </Pressable>
            <Pressable style={styles.actionButton} onPress={loadSelections}>
              <Text style={styles.actionText}>Actualiser</Text>
            </Pressable>
          </View>

          {error && <Text style={styles.error}>{error}</Text>}
          {success && <Text style={styles.success}>{success}</Text>}

          <View style={styles.listSection}>
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>BL disponibles</Text>
              <Text style={styles.sectionCount}>{articles.length}</Text>
            </View>

            {loadingArticles && (
              <View style={styles.loading}>
                <ActivityIndicator color={Brand.ink} />
              </View>
            )}

            {!loadingArticles && articles.length === 0 && (
              <Text style={styles.empty}>Aucun BL charge</Text>
            )}

            <ScrollView style={styles.itemsScroll} showsVerticalScrollIndicator>
              {articles.map((item) => {
                const isSaved = existingSelectedIdsSet.has(item.IDBL);
                const isSelected = !!selectedMap[item.IDBL];
                const isPending = isSelected !== isSaved;

                return (
                  <Pressable
                    key={item.IDBL}
                    style={[styles.item, isSaved && styles.itemSaved, isPending && !isSaved && styles.itemPending]}
                    onPress={() => toggleItem(item.IDBL)}>
                    <View style={[styles.checkbox, isSelected && styles.checkboxOn]}>
                      {isSelected && <Text style={styles.checkmark}>✓</Text>}
                    </View>
                    <View style={styles.itemContent}>
                      <Text style={styles.itemTitle}>{item.Destinataire || 'Client'}</Text>
                      <Text style={styles.itemMeta}>#{item.IDBL} • {item.DateBL}</Text>
                    </View>
                    {isSaved && <Text style={styles.tag}>OK</Text>}
                  </Pressable>
                );
              })}
            </ScrollView>
          </View>

          <View style={styles.footer}>
            <View style={styles.footerInfo}>
              <Text style={styles.footerCount}>{selectedCount}</Text>
              <Text style={styles.footerLabel}>BL selectionnes</Text>
            </View>
            <Pressable
              style={[styles.saveButton, (!hasPendingChanges || saving) && styles.saveButtonDisabled]}
              onPress={saveSelection}
              disabled={!hasPendingChanges || saving}>
              <Text style={styles.saveButtonText}>
                {saving ? 'Enregistrement...' : 'Enregistrer'}
              </Text>
            </Pressable>
          </View>

          {existingSelections.length > 0 && (
            <View style={styles.historySection}>
              <Text style={styles.historyTitle}>Selection du {targetDate}</Text>
              {existingSelections.map((row) => (
                <View key={`${row.bl_id}-${row.selected_at}`} style={styles.historyRow}>
                  <Text style={styles.historyItem}>#{row.bl_id}</Text>
                  <Text style={styles.historyMeta}>{row.destinataire}</Text>
                </View>
              ))}
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
  headerSubtitle: { fontSize: 14, color: Brand.muted, marginTop: 4 },
  dateRow: { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 16 },
  dateLabel: { fontSize: 14, fontWeight: '600', color: Brand.ink },
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
  actions: { flexDirection: 'row', gap: 12, marginBottom: 20 },
  actionButton: {
    flex: 1,
    backgroundColor: '#f5f5f5',
    borderRadius: 10,
    paddingVertical: 12,
    alignItems: 'center',
  },
  actionText: { fontSize: 14, fontWeight: '600', color: Brand.ink },
  error: { color: Brand.danger, fontSize: 13, marginBottom: 16 },
  success: { color: Brand.success, fontSize: 13, marginBottom: 16 },
  listSection: { marginBottom: 20 },
  sectionHeader: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 12 },
  sectionTitle: { fontSize: 16, fontWeight: '600', color: Brand.ink },
  sectionCount: {
    backgroundColor: '#f0f0f0',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 10,
    fontSize: 12,
    color: Brand.muted,
  },
  loading: { padding: 20, alignItems: 'center' },
  empty: { color: Brand.muted, fontSize: 14, textAlign: 'center', padding: 20 },
  itemsScroll: { maxHeight: 280 },
  item: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 14,
    backgroundColor: '#fafafa',
    borderRadius: 12,
    marginBottom: 8,
  },
  itemSaved: { backgroundColor: '#e8f5e9' },
  itemPending: { backgroundColor: '#fff3e0' },
  checkbox: {
    width: 24,
    height: 24,
    borderRadius: 6,
    borderWidth: 2,
    borderColor: '#ddd',
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkboxOn: { backgroundColor: Brand.ink, borderColor: Brand.ink },
  checkmark: { color: '#fff', fontSize: 14, fontWeight: '700' },
  itemContent: { flex: 1 },
  itemTitle: { fontSize: 15, fontWeight: '600', color: Brand.ink },
  itemMeta: { fontSize: 12, color: Brand.muted, marginTop: 2 },
  tag: {
    fontSize: 10,
    fontWeight: '700',
    color: Brand.success,
    backgroundColor: '#c8e6c9',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 4,
    overflow: 'hidden',
  },
  footer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 16,
    backgroundColor: '#f9f9f9',
    borderRadius: 16,
    marginBottom: 24,
  },
  footerInfo: {},
  footerCount: { fontSize: 32, fontWeight: '700', color: Brand.ink },
  footerLabel: { fontSize: 12, color: Brand.muted },
  saveButton: {
    backgroundColor: Brand.ink,
    borderRadius: 10,
    paddingVertical: 14,
    paddingHorizontal: 24,
  },
  saveButtonDisabled: { opacity: 0.4 },
  saveButtonText: { color: '#fff', fontSize: 14, fontWeight: '600' },
  historySection: { marginTop: 8 },
  historyTitle: { fontSize: 14, fontWeight: '600', color: Brand.muted, marginBottom: 12 },
  historyRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    padding: 10,
    backgroundColor: '#fafafa',
    borderRadius: 8,
    marginBottom: 6,
  },
  historyItem: { fontSize: 13, fontWeight: '600', color: Brand.ink },
  historyMeta: { flex: 1, fontSize: 13, color: Brand.muted },
});