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
import { SafeAreaView } from 'react-native-safe-area-context';

import { api } from '@/services/api';
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
  const [articles, setArticles] = useState<ArticleBL[]>([]);
  const [selectedMap, setSelectedMap] = useState<Record<number, boolean>>({});
  const [existingSelections, setExistingSelections] = useState<SelectionRow[]>([]);
  const [loadingArticles, setLoadingArticles] = useState(false);
  const [loadingSelection, setLoadingSelection] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const existingSelectedIds = useMemo(
    () => existingSelections.map((row) => row.bl_id).sort((a, b) => a - b),
    [existingSelections]
  );

  const existingSelectedIdsSet = useMemo(() => new Set(existingSelectedIds), [existingSelectedIds]);

  const selectedIds = useMemo(
    () => Object.entries(selectedMap).filter(([, selected]) => selected).map(([id]) => Number(id)).sort((a, b) => a - b),
    [selectedMap]
  );

  const selectedCount = selectedIds.length;

  const hasPendingChanges = useMemo(() => {
    if (selectedIds.length !== existingSelectedIds.length) {
      return true;
    }
    const existingSet = new Set(existingSelectedIds);
    return selectedIds.some((id) => !existingSet.has(id));
  }, [existingSelectedIds, selectedIds]);

  const loadArticles = useCallback(async () => {
    try {
      setLoadingArticles(true);
      setError(null);
      const res = await api.listArticles();
      setArticles(res.data);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Erreur chargement BL');
      setArticles([]);
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
      setError(e instanceof Error ? e.message : 'Erreur chargement selection');
      setExistingSelections([]);
      setSelectedMap({});
    } finally {
      setLoadingSelection(false);
    }
  }, [targetDate, token]);

  useEffect(() => {
    void loadArticles();
  }, [loadArticles]);

  useEffect(() => {
    void loadSelections();
  }, [loadSelections]);

  const saveSelection = async () => {
    if (!hasPendingChanges || saving) {
      return;
    }

    try {
      setSaving(true);
      setError(null);
      setSuccess(null);
      await api.createSelections(token, targetDate, selectedIds);
      if (selectedCount === 0) {
        setSuccess(`Selection vide enregistree pour ${targetDate}`);
      } else {
        setSuccess(`${selectedCount} BL enregistres pour ${targetDate}`);
      }
      await loadSelections();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Erreur enregistrement selection');
    } finally {
      setSaving(false);
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
          <Text style={styles.headerTitle}>Preparation du lendemain</Text>
          <Text style={styles.headerSub}>Responsable: {fullName}</Text>
        </View>

        <View style={styles.sectionCard}>
          <Text style={styles.sectionTitle}>1. Choisir la date et charger les donnees</Text>
          <Text style={styles.label}>Date cible</Text>
          <TextInput
            style={styles.input}
            value={targetDate}
            onChangeText={setTargetDate}
            autoCapitalize="none"
            autoCorrect={false}
            placeholder="AAAA-MM-JJ"
            placeholderTextColor="#8b97a8"
          />
          <View style={styles.rowButtons}>
            <Pressable style={styles.secondaryButton} onPress={loadArticles}>
              <Text style={styles.secondaryText}>Charger les BL</Text>
            </Pressable>
            <Pressable style={styles.secondaryButton} onPress={loadSelections}>
              <Text style={styles.secondaryText}>Charger la selection</Text>
            </Pressable>
          </View>
        </View>

        {error ? <Text style={styles.errorText}>{error}</Text> : null}
        {success ? <Text style={styles.successText}>{success}</Text> : null}

        <View style={styles.sectionCard}>
          <Text style={styles.sectionTitle}>2. Selectionner les BL</Text>
          {loadingArticles ? <ActivityIndicator color="#2563eb" /> : null}
          {!loadingArticles && articles.length === 0 ? (
            <Text style={styles.emptyText}>Aucun BL charge. Clique sur le bouton Charger les BL.</Text>
          ) : null}

          <ScrollView
            style={styles.listWrap}
            contentContainerStyle={styles.listContent}
            nestedScrollEnabled
            showsVerticalScrollIndicator>
            {articles.map((item) => {
              const isAlreadySelected = existingSelectedIdsSet.has(item.IDBL);
              const isSelected = Boolean(selectedMap[item.IDBL]);
              const isPendingAdd = !isAlreadySelected && isSelected;
              const isPendingRemove = isAlreadySelected && !isSelected;

              return (
                <Pressable
                  key={item.IDBL}
                  style={[
                    styles.itemRow,
                    isAlreadySelected && isSelected && styles.itemRowSaved,
                    isPendingAdd && styles.itemRowPendingAdd,
                    isPendingRemove && styles.itemRowPendingRemove,
                  ]}
                  onPress={() =>
                    setSelectedMap((prev) => ({
                      ...prev,
                      [item.IDBL]: !prev[item.IDBL],
                    }))
                  }>
                  <View
                    style={[
                      styles.checkbox,
                      isSelected && styles.checkboxOn,
                    ]}>
                    <Text style={styles.checkboxText}>{isSelected ? 'X' : ''}</Text>
                  </View>
                  <View style={styles.itemContent}>
                    <Text style={styles.itemTitle}>{item.Destinataire || 'Destinataire inconnu'}</Text>
                    <Text style={styles.itemSub}>BL #{item.IDBL}</Text>
                    <Text style={styles.itemMeta}>Date BL: {String(item.DateBL)}</Text>
                    {isAlreadySelected && isSelected ? <Text style={styles.itemSavedText}>Deja enregistre</Text> : null}
                    {isPendingAdd ? <Text style={styles.itemAddedText}>Nouveau BL a enregistrer</Text> : null}
                    {isPendingRemove ? <Text style={styles.itemRemovedText}>Sera retire a l enregistrement</Text> : null}
                  </View>
                </Pressable>
              );
            })}
          </ScrollView>
        </View>

        <View style={styles.summaryCard}>
          <View>
            <Text style={styles.summaryTitle}>BL selectionnes</Text>
            <Text style={styles.summaryCount}>{selectedCount}</Text>
            <Text style={styles.summarySub}>Enregistres actuellement: {existingSelections.length}</Text>
            <Text style={styles.summaryHint}>{hasPendingChanges ? 'Modifications non enregistrees' : 'Aucune modification'}</Text>
          </View>
          <Pressable
            style={[styles.primaryButton, (!hasPendingChanges || saving) && styles.disabled]}
            onPress={saveSelection}>
            {saving ? <ActivityIndicator color="#ffffff" /> : <Text style={styles.primaryText}>Mettre a jour</Text>}
          </Pressable>
        </View>

        <View style={styles.sectionCard}>
          <Text style={styles.sectionTitle}>3. Selection deja enregistree ({targetDate})</Text>
          {loadingSelection ? <ActivityIndicator color="#2563eb" /> : null}
          {!loadingSelection && existingSelections.length === 0 ? (
            <Text style={styles.emptyText}>Aucune selection enregistree pour cette date.</Text>
          ) : null}

          {existingSelections.map((row) => (
            <View key={`${row.bl_id}-${row.selected_at}`} style={styles.savedRow}>
              <Text style={styles.savedTitle}>{row.destinataire || 'Destinataire inconnu'}</Text>
              <Text style={styles.savedMeta}>BL #{row.bl_id}</Text>
              <Text style={styles.savedMeta}>Par: {row.selector_name}</Text>
            </View>
          ))}
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
  rowButtons: {
    flexDirection: 'row',
    gap: 8,
  },
  secondaryButton: {
    flex: 1,
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
  },
  successText: {
    color: '#166534',
    fontWeight: '700',
  },
  emptyText: {
    color: '#6b7280',
  },
  listWrap: {
    maxHeight: 300,
  },
  listContent: {
    gap: 8,
    paddingBottom: 4,
  },
  itemRow: {
    flexDirection: 'row',
    gap: 10,
    borderWidth: 1,
    borderColor: '#e5e7eb',
    borderRadius: 10,
    backgroundColor: '#ffffff',
    padding: 10,
  },
  itemRowSaved: {
    borderColor: '#bbf7d0',
    backgroundColor: '#f0fdf4',
  },
  itemRowPendingAdd: {
    borderColor: '#93c5fd',
    backgroundColor: '#eff6ff',
  },
  itemRowPendingRemove: {
    borderColor: '#fecaca',
    backgroundColor: '#fef2f2',
  },
  checkbox: {
    width: 24,
    height: 24,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#d1d5db',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 2,
  },
  checkboxOn: {
    backgroundColor: '#2563eb',
    borderColor: '#2563eb',
  },
  checkboxText: {
    color: '#ffffff',
    fontWeight: '800',
    fontSize: 10,
  },
  itemContent: {
    flex: 1,
  },
  itemTitle: {
    color: '#111827',
    fontWeight: '800',
  },
  itemSub: {
    color: '#374151',
    marginTop: 2,
  },
  itemMeta: {
    color: '#6b7280',
    fontSize: 12,
    marginTop: 2,
  },
  itemSavedText: {
    color: '#15803d',
    fontSize: 12,
    marginTop: 2,
    fontWeight: '700',
  },
  itemAddedText: {
    color: '#1d4ed8',
    fontSize: 12,
    marginTop: 2,
    fontWeight: '700',
  },
  itemRemovedText: {
    color: '#b91c1c',
    fontSize: 12,
    marginTop: 2,
    fontWeight: '700',
  },
  summaryCard: {
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#dbeafe',
    backgroundColor: '#eff6ff',
    padding: 12,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  summaryTitle: {
    color: '#1e3a8a',
    fontWeight: '700',
  },
  summaryCount: {
    color: '#1d4ed8',
    fontWeight: '800',
    fontSize: 24,
    marginTop: 2,
  },
  summarySub: {
    color: '#64748b',
    marginTop: 2,
    fontSize: 12,
    fontWeight: '600',
  },
  summaryHint: {
    color: '#334155',
    marginTop: 2,
    fontSize: 12,
    fontWeight: '700',
  },
  primaryButton: {
    borderRadius: 10,
    backgroundColor: '#2563eb',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  primaryText: {
    color: '#ffffff',
    fontWeight: '800',
  },
  disabled: {
    opacity: 0.45,
  },
  savedRow: {
    borderWidth: 1,
    borderColor: '#d1fae5',
    borderRadius: 10,
    padding: 10,
    backgroundColor: '#ecfdf5',
    marginBottom: 8,
  },
  savedTitle: {
    color: '#065f46',
    fontWeight: '800',
  },
  savedMeta: {
    color: '#047857',
    fontSize: 12,
    marginTop: 2,
  },
});
