import React, { useCallback, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import DateTimePicker from '@react-native-community/datetimepicker';
import { SafeAreaView } from 'react-native-safe-area-context';

import { api } from '@/services/api';
import { Brand } from '@/constants/brand';
import { AdminReportDetail, AdminReportSummary } from '@/types/app';

interface Props {
  token: string;
  fullName: string;
}

function parseDateLocal(dateStr: string): Date {
  const [y, m, d] = dateStr.split('-').map(Number);
  return new Date(y, (m ?? 1) - 1, d ?? 1);
}

function todayIso(): string {
  return new Date().toISOString().slice(0, 10);
}

const STATUS_CONFIG = {
  available: { label: 'OK', short: 'OK', bg: '#E8F5E9', text: '#1B5E20', border: '#81C784' },
  partial: { label: 'Partiel', short: 'Part.', bg: '#FFF8E1', text: '#E65100', border: '#FFB74D' },
  not_available: { label: 'Rupture', short: 'Rupt.', bg: '#FFEBEE', text: '#B71C1C', border: '#EF9A9A' },
} as const;

function statusCfg(status: string) {
  return STATUS_CONFIG[status as keyof typeof STATUS_CONFIG] ?? STATUS_CONFIG.not_available;
}

export function AdminScreen({ token, fullName }: Props) {
  const [reportDate, setReportDate] = useState(todayIso());
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [reports, setReports] = useState<AdminReportSummary[]>([]);
  const [detail, setDetail] = useState<AdminReportDetail | null>(null);
  const [loading, setLoading] = useState(false);
  const [detailLoading, setDetailLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleDateChange = useCallback((event: any, selectedDate?: Date) => {
    if (Platform.OS === 'android') setShowDatePicker(false);
    if (selectedDate) setReportDate(selectedDate.toISOString().slice(0, 10));
  }, []);

  const loadReports = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const res = await api.listAdminReports(token, reportDate);
      setReports(res.data);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Erreur');
    } finally {
      setLoading(false);
    }
  }, [reportDate, token]);

  const openDetail = async (reportId: number) => {
    try {
      setDetailLoading(true);
      setError(null);
      const res = await api.getAdminReportDetail(token, reportId);
      setDetail(res);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Erreur');
      setDetailLoading(false);
    } finally {
      setDetailLoading(false);
    }
  };

  const renderReportCard = ({ item }: { item: AdminReportSummary }) => {
    const total = item.summary.items;
    const availablePct = total > 0 ? (item.summary.available / total) * 100 : 0;
    const partialPct = total > 0 ? (item.summary.partial / total) * 100 : 0;
    const missingPct = total > 0 ? (item.summary.not_available / total) * 100 : 0;

    return (
      <Pressable
        style={({ pressed }) => [styles.reportCard, pressed && { opacity: 0.87 }]}
        onPress={() => openDetail(item.report_id)}>
        <View style={styles.reportCardHeader}>
          <View style={styles.reportCardLeft}>
            <Text style={styles.reportClientName}>{item.destinataire || 'Client'}</Text>
            <Text style={styles.reportMeta}>
              BL #{item.bl_id} — par {item.preparer_name}
            </Text>
          </View>
          <View style={styles.reportCardRight}>
            <Text style={styles.reportTime}>
              {new Date(item.sent_at).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}
            </Text>
            {item.summary.quantity_missing_total > 0 && (
              <View style={styles.missingQtyBadge}>
                <Text style={styles.missingQtyText}>−{item.summary.quantity_missing_total}</Text>
              </View>
            )}
          </View>
        </View>

        <View style={styles.progressBar}>
          {availablePct > 0 && (
            <View style={[styles.progressSegment, { flex: availablePct, backgroundColor: '#4CAF50' }]} />
          )}
          {partialPct > 0 && (
            <View style={[styles.progressSegment, { flex: partialPct, backgroundColor: '#FF9800' }]} />
          )}
          {missingPct > 0 && (
            <View style={[styles.progressSegment, { flex: missingPct, backgroundColor: '#F44336' }]} />
          )}
        </View>

        <View style={styles.statRow}>
          <View style={[styles.statChip, { backgroundColor: '#E8F5E9', borderColor: '#81C784' }]}>
            <Text style={[styles.statChipText, { color: '#1B5E20' }]}>OK {item.summary.available}</Text>
          </View>
          <View style={[styles.statChip, { backgroundColor: '#FFF8E1', borderColor: '#FFB74D' }]}>
            <Text style={[styles.statChipText, { color: '#E65100' }]}>Partiel {item.summary.partial}</Text>
          </View>
          <View style={[styles.statChip, { backgroundColor: '#FFEBEE', borderColor: '#EF9A9A' }]}>
            <Text style={[styles.statChipText, { color: '#B71C1C' }]}>Rupture {item.summary.not_available}</Text>
          </View>
          <Text style={styles.statTotal}>{total} art.</Text>
        </View>
      </Pressable>
    );
  };

  const renderHeader = () => (
    <View style={styles.listHeader}>
      <View style={styles.dateSection}>
        <Text style={styles.dateSectionLabel}>Date du rapport</Text>
        <View style={styles.dateRow}>
          <Text style={styles.dateDisplay}>
            {parseDateLocal(reportDate).toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' })}
          </Text>
          <Pressable
            style={({ pressed }) => [styles.changeDateBtn, pressed && { opacity: 0.7 }]}
            onPress={() => setShowDatePicker(true)}>
            <Text style={styles.changeDateText}>Modifier</Text>
          </Pressable>
        </View>
      </View>

      <Pressable
        style={({ pressed }) => [styles.refreshBtn, pressed && { opacity: 0.8 }]}
        onPress={loadReports}>
        <Text style={styles.refreshText}>Charger les rapports</Text>
      </Pressable>

      {error ? <View style={styles.alertBox}><Text style={styles.alertText}>{error}</Text></View> : null}
      {loading ? (
        <View style={styles.loadingRow}>
          <ActivityIndicator color={Brand.ember} size="small" />
          <Text style={styles.loadingText}>Chargement…</Text>
        </View>
      ) : null}

      <View style={styles.sectionHeader}>
        <Text style={styles.sectionTitle}>Rapports de préparation</Text>
        <View style={styles.countBadge}>
          <Text style={styles.countBadgeText}>{reports.length}</Text>
        </View>
      </View>
    </View>
  );

  const renderEmpty = () => {
    if (loading) return null;
    return (
      <View style={styles.emptyState}>
        <Text style={styles.emptyText}>Aucun rapport</Text>
        <Text style={styles.emptySubText}>
          Aucun rapport de préparation pour cette date.{'\n'}Chargez les données ou changez de date.
        </Text>
      </View>
    );
  };

  return (
    <SafeAreaView style={styles.safe} edges={['left', 'right', 'bottom']}>
      <FlatList
        data={reports}
        renderItem={renderReportCard}
        keyExtractor={(item) => String(item.report_id)}
        ListHeaderComponent={renderHeader}
        ListEmptyComponent={renderEmpty}
        contentContainerStyle={styles.listContent}
        showsVerticalScrollIndicator={false}
      />

      <Modal
        visible={!!detail || detailLoading}
        animationType="slide"
        transparent
        onRequestClose={() => setDetail(null)}>
        <View style={styles.modalBg}>
          <Pressable style={styles.modalDismiss} onPress={() => setDetail(null)} />
          <View style={styles.modal}>
            <View style={styles.modalHandle} />

            {detailLoading && !detail && (
              <View style={styles.modalLoading}>
                <ActivityIndicator color={Brand.ember} size="large" />
                <Text style={styles.loadingText}>Chargement du détail…</Text>
              </View>
            )}

            {detail && (
              <>
                <View style={styles.modalHeader}>
                  <View style={styles.modalHeaderLeft}>
                    <Text style={styles.modalClientName}>{detail.destinataire || 'Client'}</Text>
                    <Text style={styles.modalMeta}>
                      BL #{detail.bl_id} — {detail.preparer_name} — {detail.items_count} articles
                    </Text>
                  </View>
                  <Pressable
                    style={({ pressed }) => [styles.modalCloseBtn, pressed && { opacity: 0.7 }]}
                    onPress={() => setDetail(null)}>
                    <Text style={styles.modalCloseBtnText}>✕</Text>
                  </Pressable>
                </View>

                <View style={styles.tableHeader}>
                  <Text style={[styles.tableHeadCell, styles.colRef]}>Référence</Text>
                  <Text style={[styles.tableHeadCell, styles.colStatus]}>Statut</Text>
                  <Text style={[styles.tableHeadCell, styles.colQty]}>Att.</Text>
                  <Text style={[styles.tableHeadCell, styles.colQty]}>Prép.</Text>
                  <Text style={[styles.tableHeadCell, styles.colQty]}>Manq.</Text>
                </View>

                <ScrollView style={styles.tableScroll} showsVerticalScrollIndicator={false}>
                  {detail.items.map((item, idx) => {
                    const cfg = statusCfg(item.status);
                    const missing =
                      item.quantity_missing ??
                      (item.quantity_expected !== undefined && item.quantity_prepared !== undefined
                        ? Math.max(0, item.quantity_expected - item.quantity_prepared)
                        : 0);
                    return (
                      <View
                        key={`${item.reference}-${idx}`}
                        style={[styles.tableRow, idx % 2 === 0 && styles.tableRowAlt]}>
                        <Text style={[styles.tableCell, styles.colRef]} numberOfLines={1}>
                          {item.reference}
                        </Text>
                        <View style={[styles.colStatus, { alignItems: 'flex-start' }]}>
                          <View style={[styles.statusMicroChip, { backgroundColor: cfg.bg, borderColor: cfg.border }]}>
                            <Text style={[styles.statusMicroText, { color: cfg.text }]}>{cfg.short}</Text>
                          </View>
                        </View>
                        <Text style={[styles.tableCell, styles.colQty]}>{item.quantity_expected ?? '—'}</Text>
                        <Text style={[styles.tableCell, styles.colQty]}>{item.quantity_prepared ?? '—'}</Text>
                        <Text style={[styles.tableCell, styles.colQty, missing > 0 && styles.missingCell]}>
                          {missing > 0 ? missing : '—'}
                        </Text>
                      </View>
                    );
                  })}
                </ScrollView>

                {detail.overall_comment ? (
                  <View style={styles.commentBox}>
                    <Text style={styles.commentLabel}>Commentaire</Text>
                    <Text style={styles.commentText}>{detail.overall_comment}</Text>
                  </View>
                ) : null}

                <Pressable
                  style={({ pressed }) => [styles.closeBtn, pressed && { opacity: 0.85 }]}
                  onPress={() => setDetail(null)}>
                  <Text style={styles.closeBtnText}>Fermer</Text>
                </Pressable>
              </>
            )}
          </View>
        </View>
      </Modal>

      {Platform.OS === 'ios' ? (
        <Modal
          visible={showDatePicker}
          transparent
          animationType="slide"
          onRequestClose={() => setShowDatePicker(false)}>
          <View style={styles.pickerOverlay}>
            <View style={styles.pickerSheet}>
              <View style={styles.pickerHeader}>
                <Text style={styles.pickerTitle}>Date du rapport</Text>
                <Pressable
                  style={({ pressed }) => [styles.pickerDoneBtn, pressed && { opacity: 0.7 }]}
                  onPress={() => setShowDatePicker(false)}>
                  <Text style={styles.pickerDoneText}>Confirmer</Text>
                </Pressable>
              </View>
              <DateTimePicker
                value={parseDateLocal(reportDate)}
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
          value={parseDateLocal(reportDate)}
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

  refreshBtn: { backgroundColor: '#FFFFFF', borderRadius: 12, borderWidth: 1, borderColor: '#EBEBEB', paddingVertical: 12, alignItems: 'center', marginBottom: 12 },
  refreshText: { fontSize: 14, fontWeight: '600', color: Brand.ink },

  alertBox: { backgroundColor: '#FFF0F0', borderRadius: 12, borderWidth: 1, borderColor: '#FFD0D0', padding: 12, marginBottom: 10 },
  alertText: { color: Brand.danger, fontSize: 13, fontWeight: '500' },

  loadingRow: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 12, justifyContent: 'center' },
  loadingText: { fontSize: 14, color: Brand.muted, marginTop: 8 },

  sectionHeader: { flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 4, marginBottom: 10 },
  sectionTitle: { fontSize: 16, fontWeight: '700', color: Brand.ink },
  countBadge: { backgroundColor: '#EBEBEB', borderRadius: 12, paddingHorizontal: 10, paddingVertical: 3 },
  countBadgeText: { fontSize: 13, fontWeight: '600', color: Brand.muted },

  reportCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 16,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: '#EBEBEB',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  reportCardHeader: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 12 },
  reportCardLeft: { flex: 1 },
  reportClientName: { fontSize: 16, fontWeight: '700', color: Brand.ink },
  reportMeta: { fontSize: 12, color: Brand.muted, marginTop: 3 },
  reportCardRight: { alignItems: 'flex-end', gap: 6 },
  reportTime: { fontSize: 13, color: Brand.muted, fontWeight: '500' },
  missingQtyBadge: { backgroundColor: '#FFEBEE', borderRadius: 8, paddingHorizontal: 8, paddingVertical: 3 },
  missingQtyText: { fontSize: 12, color: '#B71C1C', fontWeight: '700' },

  progressBar: { height: 6, borderRadius: 3, backgroundColor: '#F0F0F0', flexDirection: 'row', overflow: 'hidden', marginBottom: 12 },
  progressSegment: { borderRadius: 3 },

  statRow: { flexDirection: 'row', alignItems: 'center', gap: 6, flexWrap: 'wrap' },
  statChip: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 16, borderWidth: 1 },
  statChipText: { fontSize: 12, fontWeight: '600' },
  statTotal: { fontSize: 12, color: Brand.muted, marginLeft: 4 },

  emptyState: { alignItems: 'center', paddingVertical: 56, gap: 8 },
  emptyText: { fontSize: 16, fontWeight: '600', color: Brand.muted },
  emptySubText: { fontSize: 13, color: '#AAAAAA', textAlign: 'center', paddingHorizontal: 32, lineHeight: 20 },

  // Modal
  modalBg: { flex: 1, backgroundColor: 'rgba(0,0,0,0.45)', justifyContent: 'flex-end' },
  modalDismiss: { flex: 1 },
  modal: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingBottom: 24,
    maxHeight: '85%',
  },
  modalHandle: { width: 40, height: 4, backgroundColor: '#E0E0E0', borderRadius: 2, alignSelf: 'center', marginTop: 12, marginBottom: 16 },
  modalLoading: { paddingVertical: 48, alignItems: 'center', gap: 12 },
  modalHeader: { flexDirection: 'row', alignItems: 'flex-start', paddingHorizontal: 20, paddingBottom: 16, borderBottomWidth: 1, borderBottomColor: '#F0F0F0' },
  modalHeaderLeft: { flex: 1 },
  modalClientName: { fontSize: 18, fontWeight: '700', color: Brand.ink },
  modalMeta: { fontSize: 13, color: Brand.muted, marginTop: 4 },
  modalCloseBtn: { width: 32, height: 32, borderRadius: 16, backgroundColor: '#F5F5F5', alignItems: 'center', justifyContent: 'center', marginLeft: 12 },
  modalCloseBtnText: { fontSize: 14, color: Brand.muted, fontWeight: '600' },

  tableHeader: { flexDirection: 'row', paddingHorizontal: 20, paddingVertical: 10, backgroundColor: '#F9F9F9', borderBottomWidth: 1, borderBottomColor: '#EBEBEB' },
  tableHeadCell: { fontSize: 11, fontWeight: '700', color: Brand.muted, textTransform: 'uppercase', letterSpacing: 0.3 },
  tableScroll: { maxHeight: 320, marginHorizontal: 0 },
  tableRow: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 20, paddingVertical: 10 },
  tableRowAlt: { backgroundColor: '#FAFAFA' },
  tableCell: { fontSize: 13, color: Brand.ink },
  colRef: { flex: 1.8, paddingRight: 8 },
  colStatus: { flex: 1.2 },
  colQty: { flex: 0.8, textAlign: 'center' },
  statusMicroChip: { borderRadius: 6, borderWidth: 1, paddingHorizontal: 7, paddingVertical: 3 },
  statusMicroText: { fontSize: 11, fontWeight: '700' },
  missingCell: { color: Brand.danger, fontWeight: '700' },

  commentBox: { marginHorizontal: 20, marginTop: 12, backgroundColor: '#F9F9F9', borderRadius: 12, padding: 12 },
  commentLabel: { fontSize: 11, fontWeight: '700', color: Brand.muted, textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 4 },
  commentText: { fontSize: 14, color: Brand.ink, lineHeight: 20 },

  closeBtn: { marginHorizontal: 20, marginTop: 16, backgroundColor: Brand.ink, borderRadius: 14, paddingVertical: 16, alignItems: 'center' },
  closeBtnText: { color: '#FFFFFF', fontSize: 15, fontWeight: '600' },

  pickerOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'flex-end' },
  pickerSheet: { backgroundColor: '#FFFFFF', borderTopLeftRadius: 20, borderTopRightRadius: 20, paddingBottom: 32 },
  pickerHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20, paddingVertical: 16, borderBottomWidth: 1, borderBottomColor: '#EFEFEF' },
  pickerTitle: { fontSize: 15, fontWeight: '600', color: Brand.ink },
  pickerDoneBtn: { backgroundColor: Brand.ember, borderRadius: 10, paddingHorizontal: 18, paddingVertical: 8 },
  pickerDoneText: { color: '#FFFFFF', fontSize: 14, fontWeight: '700' },
  pickerControl: { width: '100%' },
});
