import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Modal,
  Platform,
  Pressable,
  RefreshControl,
  StyleSheet,
  Text,
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

function parseDateLocal(dateStr: string): Date {
  const [y, m, d] = dateStr.split('-').map(Number);
  return new Date(y, (m ?? 1) - 1, d ?? 1);
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
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const handleDateChange = useCallback((event: any, selectedDate?: Date) => {
    if (Platform.OS === 'android') setShowDatePicker(false);
    if (selectedDate) {
      setTargetDate(selectedDate.toISOString().slice(0, 10));
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
      setError(null);
      const res = await api.listSelections(token, targetDate);
      setExistingSelections(res.data);
      const nextSelected: Record<number, boolean> = {};
      for (const row of res.data) nextSelected[row.bl_id] = true;
      setSelectedMap(nextSelected);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Erreur chargement');
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
      setSuccess(
        selectedIds.length === 0
          ? 'Sélection vidée'
          : `${selectedIds.length} BL enregistré${selectedIds.length > 1 ? 's' : ''}`
      );
      await loadSelections();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Erreur');
    } finally {
      setSaving(false);
    }
  };

  const toggleItem = (id: number) => {
    setSuccess(null);
    setSelectedMap((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  const renderBLItem = ({ item }: { item: ArticleBL }) => {
    const isSaved = existingSelectedIdsSet.has(item.IDBL);
    const isSelected = !!selectedMap[item.IDBL];
    const isPending = isSelected !== isSaved;

    return (
      <Pressable
        style={({ pressed }) => [
          styles.blCard,
          isSelected && styles.blCardSelected,
          pressed && { opacity: 0.85 },
        ]}
        onPress={() => toggleItem(item.IDBL)}>
        <View style={[styles.checkbox, isSelected && styles.checkboxOn]}>
          {isSelected && <Text style={styles.checkmark}>✓</Text>}
        </View>
        <View style={styles.blInfo}>
          <Text style={styles.blName}>{item.Destinataire || 'Client'}</Text>
          <Text style={styles.blMeta}>
            #{item.IDBL}
            {item.DateBL
              ? ` • ${parseDateLocal(item.DateBL).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' })}`
              : ''}
            {item.references_count ? ` • ${item.references_count} art.` : ''}
          </Text>
        </View>
        {isSaved && !isPending && (
          <View style={styles.tagSaved}>
            <Text style={styles.tagSavedText}>Enregistré</Text>
          </View>
        )}
        {isPending && isSelected && (
          <View style={styles.tagPending}>
            <Text style={styles.tagPendingText}>À ajouter</Text>
          </View>
        )}
        {isPending && !isSelected && (
          <View style={styles.tagRemove}>
            <Text style={styles.tagRemoveText}>À retirer</Text>
          </View>
        )}
      </Pressable>
    );
  };

  const displayDate = parseDateLocal(targetDate).toLocaleDateString('fr-FR', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
  });

  const renderHeader = () => (
    <View style={styles.listHeader}>
      <View style={styles.dateSection}>
        <View style={styles.dateLabelRow}>
          <Text style={styles.dateLabelText}>Date de préparation</Text>
        </View>
        <View style={styles.dateRow}>
          <Text style={styles.dateDisplay}>{displayDate}</Text>
          <Pressable
            style={({ pressed }) => [styles.changeDateBtn, pressed && { opacity: 0.7 }]}
            onPress={() => setShowDatePicker(true)}>
            <Text style={styles.changeDateText}>Modifier</Text>
          </Pressable>
        </View>
      </View>

      <Pressable
        style={({ pressed }) => [styles.refreshBtn, pressed && { opacity: 0.8 }]}
        onPress={() => { void loadArticles(); void loadSelections(); }}>
        <Text style={styles.refreshText}>Actualiser les BL</Text>
      </Pressable>

      {error ? (
        <View style={styles.alertBox}>
          <Text style={styles.alertText}>{error}</Text>
        </View>
      ) : null}

      {success ? (
        <View style={styles.successBox}>
          <Text style={styles.successText}>{success}</Text>
        </View>
      ) : null}

      {loadingArticles && (
        <View style={styles.loadingRow}>
          <ActivityIndicator color={Brand.ember} size="small" />
          <Text style={styles.loadingText}>Chargement des BL…</Text>
        </View>
      )}

      <View style={styles.sectionHeader}>
        <Text style={styles.sectionTitle}>BL disponibles</Text>
        <View style={styles.countBadge}>
          <Text style={styles.countBadgeText}>{articles.length}</Text>
        </View>
      </View>
    </View>
  );

  const renderEmpty = () => {
    if (loadingArticles) return null;
    return (
      <View style={styles.emptyState}>
        <Text style={styles.emptyText}>Aucun BL disponible</Text>
        <Text style={styles.emptySubText}>Les bons de livraison des 2 derniers jours apparaîtront ici</Text>
      </View>
    );
  };

  const renderFooter = () => {
    if (existingSelections.length === 0) return <View style={styles.listFooterSpace} />;
    return (
      <View style={styles.historySection}>
        <Text style={styles.historyTitle}>
          Sélection enregistrée — {parseDateLocal(targetDate).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long' })}
        </Text>
        {existingSelections.map((row) => (
          <View key={`${row.bl_id}-${row.selected_at}`} style={styles.historyRow}>
            <Text style={styles.historyId}>#{row.bl_id}</Text>
            <Text style={styles.historyDest} numberOfLines={1}>{row.destinataire || '—'}</Text>
            <Text style={styles.historySel}>par {row.selector_name}</Text>
          </View>
        ))}
        <View style={styles.listFooterSpace} />
      </View>
    );
  };

  return (
    <SafeAreaView style={styles.safe} edges={['left', 'right', 'bottom']}>
      <FlatList
        data={articles}
        renderItem={renderBLItem}
        keyExtractor={(item) => String(item.IDBL)}
        ListHeaderComponent={renderHeader}
        ListEmptyComponent={renderEmpty}
        ListFooterComponent={renderFooter}
        contentContainerStyle={styles.listContent}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={loadingArticles}
            onRefresh={() => { void loadArticles(); void loadSelections(); }}
            tintColor={Brand.ember}
            colors={[Brand.ember]}
          />
        }
      />

      <View style={styles.stickyFooter}>
        <View style={styles.footerLeft}>
          <Text style={styles.footerCount}>{selectedIds.length}</Text>
          <Text style={styles.footerLabel}>BL sélectionné{selectedIds.length > 1 ? 's' : ''}</Text>
        </View>
        <Pressable
          style={({ pressed }) => [
            styles.saveBtn,
            (!hasPendingChanges || saving) && styles.saveBtnDisabled,
            pressed && hasPendingChanges && { opacity: 0.85 },
          ]}
          onPress={saveSelection}
          disabled={!hasPendingChanges || saving}>
          <Text style={styles.saveBtnText}>
            {saving ? 'Enregistrement…' : 'Enregistrer'}
          </Text>
        </Pressable>
      </View>

      {Platform.OS === 'ios' ? (
        <Modal
          visible={showDatePicker}
          transparent
          animationType="slide"
          onRequestClose={() => setShowDatePicker(false)}>
          <View style={styles.pickerOverlay}>
            <View style={styles.pickerSheet}>
              <View style={styles.pickerHeader}>
                <Text style={styles.pickerTitle}>Date de préparation</Text>
                <Pressable
                  style={({ pressed }) => [styles.pickerDoneBtn, pressed && { opacity: 0.7 }]}
                  onPress={() => setShowDatePicker(false)}>
                  <Text style={styles.pickerDoneText}>Confirmer</Text>
                </Pressable>
              </View>
              <DateTimePicker
                value={parseDateLocal(targetDate)}
                mode="date"
                display="spinner"
                onChange={handleDateChange}
                locale="fr-FR"
                themeVariant="light"
                style={styles.pickerControl}
              />
            </View>
          </View>
        </Modal>
      ) : showDatePicker ? (
        <DateTimePicker
          value={parseDateLocal(targetDate)}
          mode="date"
          display="default"
          onChange={handleDateChange}
        />
      ) : null}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#FAFAFA' },
  listContent: { paddingHorizontal: 16 },
  listHeader: { paddingTop: 20, paddingBottom: 8 },
  listFooterSpace: { height: 16 },

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
  dateLabelRow: { marginBottom: 6 },
  dateLabelText: { fontSize: 12, fontWeight: '600', color: Brand.muted, textTransform: 'uppercase', letterSpacing: 0.5 },
  dateRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  dateDisplay: { fontSize: 16, fontWeight: '600', color: Brand.ink, flex: 1 },
  changeDateBtn: {
    backgroundColor: '#F5F5F5',
    borderRadius: 10,
    paddingVertical: 7,
    paddingHorizontal: 14,
  },
  changeDateText: { fontSize: 13, color: Brand.ink, fontWeight: '500' },

  refreshBtn: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#EBEBEB',
    paddingVertical: 12,
    alignItems: 'center',
    marginBottom: 12,
  },
  refreshText: { fontSize: 14, fontWeight: '600', color: Brand.ink },

  alertBox: { backgroundColor: '#FFF0F0', borderRadius: 12, borderWidth: 1, borderColor: '#FFD0D0', padding: 12, marginBottom: 10 },
  alertText: { color: Brand.danger, fontSize: 13, fontWeight: '500' },
  successBox: { backgroundColor: '#F0FFF4', borderRadius: 12, borderWidth: 1, borderColor: '#BBF7D0', padding: 12, marginBottom: 10 },
  successText: { color: Brand.success, fontSize: 13, fontWeight: '500' },

  loadingRow: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 12, justifyContent: 'center' },
  loadingText: { fontSize: 14, color: Brand.muted },

  sectionHeader: { flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 4, marginBottom: 10 },
  sectionTitle: { fontSize: 16, fontWeight: '700', color: Brand.ink },
  countBadge: { backgroundColor: '#EBEBEB', borderRadius: 12, paddingHorizontal: 10, paddingVertical: 3 },
  countBadgeText: { fontSize: 13, fontWeight: '600', color: Brand.muted },

  blCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    padding: 14,
    marginBottom: 8,
    borderWidth: 1.5,
    borderColor: '#EBEBEB',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 4,
    elevation: 1,
  },
  blCardSelected: {
    borderColor: Brand.ember,
    backgroundColor: '#FFFAF7',
  },
  checkbox: {
    width: 24,
    height: 24,
    borderRadius: 7,
    borderWidth: 2,
    borderColor: '#D0D0D0',
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkboxOn: { backgroundColor: Brand.ember, borderColor: Brand.ember },
  checkmark: { color: '#fff', fontSize: 13, fontWeight: '800' },
  blInfo: { flex: 1 },
  blName: { fontSize: 15, fontWeight: '600', color: Brand.ink },
  blMeta: { fontSize: 12, color: Brand.muted, marginTop: 2 },

  tagSaved: { backgroundColor: '#E8F5E9', borderRadius: 8, paddingHorizontal: 8, paddingVertical: 4 },
  tagSavedText: { fontSize: 11, color: '#2E7D32', fontWeight: '600' },
  tagPending: { backgroundColor: '#FFF8E1', borderRadius: 8, paddingHorizontal: 8, paddingVertical: 4 },
  tagPendingText: { fontSize: 11, color: '#E65100', fontWeight: '600' },
  tagRemove: { backgroundColor: '#FFEBEE', borderRadius: 8, paddingHorizontal: 8, paddingVertical: 4 },
  tagRemoveText: { fontSize: 11, color: '#C62828', fontWeight: '600' },

  emptyState: { alignItems: 'center', paddingVertical: 48, gap: 8 },
  emptyText: { fontSize: 16, fontWeight: '600', color: Brand.muted },
  emptySubText: { fontSize: 13, color: '#AAAAAA', textAlign: 'center', paddingHorizontal: 24 },

  historySection: { marginTop: 16, paddingTop: 16, borderTopWidth: 1, borderTopColor: '#EBEBEB' },
  historyTitle: { fontSize: 13, fontWeight: '600', color: Brand.muted, marginBottom: 10, textTransform: 'uppercase', letterSpacing: 0.5 },
  historyRow: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: '#F5F5F5' },
  historyId: { fontSize: 13, fontWeight: '700', color: Brand.ink, minWidth: 52 },
  historyDest: { flex: 1, fontSize: 13, color: Brand.ink },
  historySel: { fontSize: 12, color: Brand.muted },

  pickerOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.4)',
    justifyContent: 'flex-end',
  },
  pickerSheet: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingBottom: 32,
  },
  pickerHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#EFEFEF',
  },
  pickerTitle: {
    fontSize: 15,
    fontWeight: '600',
    color: Brand.ink,
  },
  pickerDoneBtn: {
    backgroundColor: Brand.ember,
    borderRadius: 10,
    paddingHorizontal: 18,
    paddingVertical: 8,
  },
  pickerDoneText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '700',
  },
  pickerControl: {
    width: '100%',
  },

  stickyFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 14,
    backgroundColor: '#FFFFFF',
    borderTopWidth: 1,
    borderTopColor: '#EBEBEB',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -2 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 8,
  },
  footerLeft: { gap: 2 },
  footerCount: { fontSize: 28, fontWeight: '800', color: Brand.ink, lineHeight: 32 },
  footerLabel: { fontSize: 12, color: Brand.muted },
  saveBtn: {
    backgroundColor: Brand.ink,
    borderRadius: 12,
    paddingVertical: 14,
    paddingHorizontal: 28,
  },
  saveBtnDisabled: { opacity: 0.35 },
  saveBtnText: { color: '#fff', fontSize: 15, fontWeight: '600' },
});
