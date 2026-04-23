import React, { useCallback, useState } from 'react';
import {
  ActivityIndicator,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { api } from '@/services/api';
import { Brand } from '@/constants/brand';
import { AdminReportDetail, AdminReportSummary } from '@/types/app';

interface Props {
  token: string;
  fullName: string;
}

function todayIso(): string {
  return new Date().toISOString().slice(0, 10);
}

function statusLabel(status: string): string {
  if (status === 'available') return 'OK';
  if (status === 'partial') return 'Partiel';
  return 'Rupture';
}

function statusColors(status: string): { bg: string; text: string } {
  if (status === 'available') return { bg: '#e8f5e9', text: '#2e7d32' };
  if (status === 'partial') return { bg: '#fff3e0', text: '#ef6c00' };
  return { bg: '#ffebee', text: '#c62828' };
}

export function AdminScreen({ token, fullName }: Props) {
  const [reportDate, setReportDate] = useState(todayIso());
  const [reports, setReports] = useState<AdminReportSummary[]>([]);
  const [detail, setDetail] = useState<AdminReportDetail | null>(null);
  const [loading, setLoading] = useState(false);
  const [detailLoading, setDetailLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

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
    } finally {
      setDetailLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.safe} edges={['left', 'right', 'bottom']}>
      <ScrollView contentContainerStyle={styles.container}>
        <View style={styles.header}>
          <Text style={styles.headerTitle}>Admin</Text>
          <Text style={styles.headerSub}>{fullName}</Text>
        </View>

        <View style={styles.dateRow}>
          <Text style={styles.dateLabel}>{new Date(reportDate).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long' })}</Text>
          <TextInput
            style={styles.dateInput}
            value={reportDate}
            onChangeText={setReportDate}
            placeholder="YYYY-MM-DD"
            placeholderTextColor={Brand.muted}
          />
        </View>

        <Pressable style={styles.reloadButton} onPress={loadReports}>
          <Text style={styles.reloadText}>Actualiser</Text>
        </Pressable>

        {error && <Text style={styles.error}>{error}</Text>}

        <View style={styles.reportsList}>
          <Text style={styles.sectionTitle}>Rapports ({reports.length})</Text>
          {loading && <ActivityIndicator color={Brand.ink} style={styles.loader} />}
          {!loading && reports.length === 0 && <Text style={styles.empty}>Aucun rapport</Text>}
          <ScrollView style={styles.reportsScroll} showsVerticalScrollIndicator>
            {reports.map((report) => (
              <Pressable key={report.report_id} style={styles.reportCard} onPress={() => openDetail(report.report_id)}>
                <View style={styles.reportHeader}>
                  <Text style={styles.reportName}>{report.destinataire || 'Client'}</Text>
                  <Text style={styles.reportDate}>
                    {new Date(report.sent_at).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}
                  </Text>
                </View>
                <Text style={styles.reportBl}>#{report.bl_id} • {report.preparer_name}</Text>
                <View style={styles.statsRow}>
                  <View style={[styles.stat, { backgroundColor: '#e8f5e9' }]}>
                    <Text style={[styles.statText, { color: '#2e7d32' }]}>OK {report.summary.available}</Text>
                  </View>
                  <View style={[styles.stat, { backgroundColor: '#fff3e0' }]}>
                    <Text style={[styles.statText, { color: '#ef6c00' }]}>Partiel {report.summary.partial}</Text>
                  </View>
                  <View style={[styles.stat, { backgroundColor: '#ffebee' }]}>
                    <Text style={[styles.statText, { color: '#c62828' }]}>Rupture {report.summary.not_available}</Text>
                  </View>
                </View>
              </Pressable>
            ))}
          </ScrollView>
        </View>
      </ScrollView>

      <Modal visible={!!detail || detailLoading} animationType="slide" transparent>
        <View style={styles.modalBg}>
          <View style={styles.modal}>
            {detailLoading && <ActivityIndicator color={Brand.ink} />}
            {detail && (
              <>
                <View style={styles.modalHeader}>
                  <Text style={styles.modalTitle}>{detail.destinataire}</Text>
                  <Text style={styles.modalSub}>#{detail.bl_id} • {detail.preparer_name}</Text>
                </View>

                <ScrollView style={styles.table}>
                  <View style={styles.tableHead}>
                    <Text style={[styles.headCell, styles.refCol]}>Ref</Text>
                    <Text style={styles.headCell}>Statut</Text>
                    <Text style={styles.headCell}>Att</Text>
                    <Text style={styles.headCell}>Prep</Text>
                    <Text style={styles.headCell}>Manque</Text>
                  </View>
                  {detail.items.map((item, idx) => {
                    const colors = statusColors(item.status);
                    const missing = item.quantity_missing ?? (item.quantity_expected && item.quantity_prepared !== undefined ? Math.max(0, item.quantity_expected - item.quantity_prepared) : 0);
                    return (
                      <View key={`${item.reference}-${idx}`} style={[styles.tableRow, { backgroundColor: colors.bg }]}>
                        <Text style={[styles.cell, styles.refCol]}>{item.reference}</Text>
                        <Text style={[styles.cell, { color: colors.text, fontWeight: '600' }]}>{statusLabel(item.status)}</Text>
                        <Text style={styles.cell}>{item.quantity_expected ?? '-'}</Text>
                        <Text style={styles.cell}>{item.quantity_prepared ?? '-'}</Text>
                        <Text style={[styles.cell, missing > 0 && styles.missingCell]}>{missing > 0 ? missing : '-'}</Text>
                      </View>
                    );
                  })}
                </ScrollView>

                <Pressable style={styles.closeBtn} onPress={() => setDetail(null)}>
                  <Text style={styles.closeBtnText}>Fermer</Text>
                </Pressable>
              </>
            )}
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#fff' },
  container: { padding: 20, paddingBottom: 100 },
  header: { marginBottom: 24 },
  headerTitle: { fontSize: 28, fontWeight: '700', color: Brand.ink },
  headerSub: { fontSize: 14, color: Brand.muted, marginTop: 4 },
  dateRow: { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 16 },
  dateLabel: { flex: 1, fontSize: 16, fontWeight: '600', color: Brand.ink },
  dateInput: {
    width: 100,
    backgroundColor: '#f5f5f5',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 14,
    textAlign: 'center',
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
  loader: { marginVertical: 20 },
  reportsList: { marginTop: 8 },
  reportsScroll: { maxHeight: 280 },
  sectionTitle: { fontSize: 14, fontWeight: '600', color: Brand.muted, marginBottom: 12 },
  empty: { color: Brand.muted, textAlign: 'center', padding: 20 },
  reportCard: {
    backgroundColor: '#fafafa',
    borderRadius: 12,
    padding: 14,
    marginBottom: 10,
  },
  reportHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  reportName: { fontSize: 15, fontWeight: '600', color: Brand.ink },
  reportDate: { fontSize: 13, color: Brand.muted },
  reportBl: { fontSize: 12, color: Brand.muted, marginTop: 2 },
  statsRow: { flexDirection: 'row', gap: 8, marginTop: 10 },
  stat: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 12 },
  statText: { fontSize: 11, fontWeight: '600' },
  modalBg: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  modal: {
    backgroundColor: '#fff',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: 20,
    maxHeight: '80%',
  },
  modalHeader: { marginBottom: 16 },
  modalTitle: { fontSize: 18, fontWeight: '600', color: Brand.ink },
  modalSub: { fontSize: 13, color: Brand.muted, marginTop: 4 },
  table: { maxHeight: 300 },
  tableHead: { flexDirection: 'row', borderBottomWidth: 1, borderColor: '#eee', paddingBottom: 8, marginBottom: 8 },
  headCell: { flex: 1, fontSize: 12, fontWeight: '600', color: Brand.muted },
  tableRow: { flexDirection: 'row', paddingVertical: 8, borderRadius: 6, marginBottom: 4, paddingHorizontal: 8 },
  cell: { flex: 1, fontSize: 13, color: Brand.ink },
  refCol: { flex: 1.5 },
  closeBtn: {
    marginTop: 16,
    backgroundColor: Brand.ink,
    borderRadius: 10,
    paddingVertical: 14,
    alignItems: 'center',
  },
  closeBtnText: { color: '#fff', fontSize: 15, fontWeight: '600' },
  missingCell: { color: Brand.danger, fontWeight: '700' },
});