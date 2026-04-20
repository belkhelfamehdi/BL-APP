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
import { AdminReportDetail, AdminReportSummary } from '@/types/app';

interface Props {
  token: string;
  fullName: string;
}

function todayIso(): string {
  return new Date().toISOString().slice(0, 10);
}

function statusLabel(status: string): string {
  if (status === 'available') {
    return 'OK';
  }
  if (status === 'partial') {
    return 'Partiel';
  }
  return 'Rupture';
}

function statusStyles(status: string) {
  if (status === 'available') {
    return { row: styles.tableRowOk, text: styles.statusTextOk };
  }
  if (status === 'partial') {
    return { row: styles.tableRowPartial, text: styles.statusTextPartial };
  }
  return { row: styles.tableRowMissing, text: styles.statusTextMissing };
}

function parseNumber(value: unknown): number | undefined {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return value;
  }
  if (typeof value === 'string') {
    const parsed = Number(value.replace(',', '.'));
    if (Number.isFinite(parsed)) {
      return parsed;
    }
  }
  return undefined;
}

function computeMissing(expected: unknown, prepared: unknown): number {
  const expectedValue = parseNumber(expected);
  if (expectedValue === undefined) {
    return 0;
  }
  const preparedValue = parseNumber(prepared) ?? 0;
  const missing = expectedValue - preparedValue;
  return missing > 0 ? Number(missing.toFixed(3)) : 0;
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
      setError(e instanceof Error ? e.message : 'Erreur chargement rapports');
      setReports([]);
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
      setError(e instanceof Error ? e.message : 'Erreur detail rapport');
      setDetail(null);
    } finally {
      setDetailLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.safe} edges={['left', 'right', 'bottom']}>
      <ScrollView contentContainerStyle={styles.container}>
        <View style={styles.headerCard}>
          <Text style={styles.headerTitle}>Rapports de preparation</Text>
          <Text style={styles.headerSub}>Admin: {fullName}</Text>
        </View>

        <View style={styles.sectionCard}>
          <Text style={styles.sectionTitle}>1. Choisir la date</Text>
          <TextInput
            style={styles.input}
            value={reportDate}
            onChangeText={setReportDate}
            autoCapitalize="none"
            placeholder="AAAA-MM-JJ"
            placeholderTextColor="#8b97a8"
          />
          <Pressable style={styles.primaryButton} onPress={loadReports}>
            <Text style={styles.primaryText}>Charger les rapports</Text>
          </Pressable>
        </View>

        {error ? <Text style={styles.errorText}>{error}</Text> : null}
        {loading ? <ActivityIndicator color="#2563eb" /> : null}
        {!loading && reports.length === 0 ? (
          <Text style={styles.emptyText}>Aucun rapport pour cette date.</Text>
        ) : null}

        <View style={styles.sectionCard}>
          <Text style={styles.sectionTitle}>2. Ouvrir un rapport</Text>
          {reports.map((report) => (
            <Pressable key={report.report_id} style={styles.reportCard} onPress={() => openDetail(report.report_id)}>
              <View style={styles.reportHeader}>
                <Text style={styles.reportTitle}>{report.destinataire || 'Client inconnu'}</Text>
                <Text style={styles.reportTime}>{new Date(report.sent_at).toLocaleString()}</Text>
              </View>
              <Text style={styles.reportSub}>BL #{report.bl_id}</Text>
              <Text style={styles.reportSub}>Preparateur: {report.preparer_name}</Text>
              <View style={styles.summaryRow}>
                <Text style={[styles.summaryBadge, styles.summaryBadgeOk]}>OK {report.summary.available}</Text>
                <Text style={[styles.summaryBadge, styles.summaryBadgePartial]}>Partiel {report.summary.partial}</Text>
                <Text style={[styles.summaryBadge, styles.summaryBadgeMissing]}>Rupture {report.summary.not_available}</Text>
                <Text style={[styles.summaryBadge, styles.summaryBadgeNeutral]}>Manque {report.summary.quantity_missing_total}</Text>
                <Text style={[styles.summaryBadge, styles.summaryBadgeNeutral]}>Total {report.summary.items}</Text>
              </View>
            </Pressable>
          ))}
        </View>
      </ScrollView>

      <Modal visible={detail !== null || detailLoading} animationType="slide" transparent>
        <View style={styles.modalBg}>
          <View style={styles.modalCard}>
            {detailLoading ? <ActivityIndicator color="#2563eb" /> : null}

            {detail ? (
              <>
                <Text style={styles.modalTitle}>{detail.destinataire || 'Client inconnu'}</Text>
                <Text style={styles.modalSub}>Rapport #{detail.report_id} - BL #{detail.bl_id}</Text>
                <Text style={styles.modalSub}>Preparateur: {detail.preparer_name}</Text>
                <Text style={styles.modalSub}>Date: {detail.report_date}</Text>
                <Text style={styles.modalSub}>Commentaire: {detail.overall_comment || 'Aucun'}</Text>

                <ScrollView style={styles.tableWrap}>
                  <View style={styles.tableHeaderRow}>
                    <Text style={[styles.tableHeaderCell, styles.colRef]}>Reference</Text>
                    <Text style={styles.tableHeaderCell}>Statut</Text>
                    <Text style={styles.tableHeaderCell}>Attendue</Text>
                    <Text style={styles.tableHeaderCell}>Preparee</Text>
                    <Text style={styles.tableHeaderCell}>Manque</Text>
                  </View>

                  {detail.items.map((item, idx) => {
                    const statusStyle = statusStyles(item.status);
                    const missingQuantity =
                      item.quantity_missing !== undefined
                        ? item.quantity_missing
                        : computeMissing(item.quantity_expected, item.quantity_prepared);

                    return (
                    <View key={`${item.reference}-${idx}`} style={[styles.tableRow, statusStyle.row]}>
                      <Text style={[styles.tableCell, styles.colRef]}>{item.reference}</Text>
                      <Text style={[styles.tableCell, statusStyle.text]}>{statusLabel(item.status)}</Text>
                      <Text style={styles.tableCell}>{item.quantity_expected ?? '-'}</Text>
                      <Text style={styles.tableCell}>{item.quantity_prepared ?? '-'}</Text>
                      <Text style={[styles.tableCell, styles.missingQtyText]}>{missingQuantity}</Text>
                    </View>
                  )})}
                </ScrollView>
              </>
            ) : null}

            <Pressable style={styles.closeButton} onPress={() => setDetail(null)}>
              <Text style={styles.closeText}>Fermer</Text>
            </Pressable>
          </View>
        </View>
      </Modal>
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
  input: {
    borderWidth: 1,
    borderColor: '#d1d5db',
    borderRadius: 10,
    backgroundColor: '#ffffff',
    color: '#111827',
    paddingHorizontal: 10,
    paddingVertical: 9,
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
  errorText: {
    color: '#b91c1c',
    fontWeight: '700',
    paddingHorizontal: 2,
  },
  emptyText: {
    color: '#6b7280',
    paddingHorizontal: 2,
  },
  reportCard: {
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#e5e7eb',
    backgroundColor: '#ffffff',
    padding: 10,
    gap: 5,
  },
  reportHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  reportTitle: {
    color: '#111827',
    fontWeight: '800',
  },
  reportTime: {
    color: '#6b7280',
    fontSize: 12,
  },
  reportSub: {
    color: '#334155',
    fontSize: 12,
  },
  summaryRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginTop: 2,
  },
  summaryBadge: {
    borderRadius: 999,
    borderWidth: 1,
    paddingHorizontal: 10,
    paddingVertical: 4,
    fontSize: 12,
    fontWeight: '700',
  },
  summaryBadgeOk: {
    borderColor: '#a7f3d0',
    backgroundColor: '#ecfdf5',
    color: '#047857',
  },
  summaryBadgePartial: {
    borderColor: '#fcd34d',
    backgroundColor: '#fffbeb',
    color: '#b45309',
  },
  summaryBadgeMissing: {
    borderColor: '#fecaca',
    backgroundColor: '#fef2f2',
    color: '#b91c1c',
  },
  summaryBadgeNeutral: {
    borderColor: '#dbeafe',
    backgroundColor: '#eff6ff',
    color: '#1e40af',
  },
  modalBg: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.55)',
    justifyContent: 'center',
    padding: 14,
  },
  modalCard: {
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#dbe1ea',
    backgroundColor: '#ffffff',
    maxHeight: '86%',
    padding: 14,
    gap: 8,
  },
  modalTitle: {
    color: '#111827',
    fontWeight: '800',
    fontSize: 16,
  },
  modalSub: {
    color: '#475569',
    fontSize: 12,
  },
  tableWrap: {
    maxHeight: 320,
    marginTop: 6,
  },
  tableHeaderRow: {
    flexDirection: 'row',
    borderBottomWidth: 1,
    borderColor: '#dbe1ea',
    paddingBottom: 6,
  },
  tableRow: {
    flexDirection: 'row',
    borderBottomWidth: 1,
    borderColor: '#eef2f7',
    paddingVertical: 6,
  },
  tableRowOk: {
    backgroundColor: '#f0fdf4',
  },
  tableRowPartial: {
    backgroundColor: '#fffbeb',
  },
  tableRowMissing: {
    backgroundColor: '#fef2f2',
  },
  tableHeaderCell: {
    flex: 1,
    color: '#0f172a',
    fontWeight: '800',
    fontSize: 12,
  },
  tableCell: {
    flex: 1,
    color: '#334155',
    fontSize: 12,
  },
  statusTextOk: {
    color: '#047857',
    fontWeight: '700',
  },
  statusTextPartial: {
    color: '#b45309',
    fontWeight: '700',
  },
  statusTextMissing: {
    color: '#b91c1c',
    fontWeight: '700',
  },
  missingQtyText: {
    color: '#b91c1c',
    fontWeight: '700',
  },
  colRef: {
    flex: 1.8,
  },
  closeButton: {
    borderRadius: 10,
    backgroundColor: '#2563eb',
    alignItems: 'center',
    paddingVertical: 10,
    marginTop: 4,
  },
  closeText: {
    color: '#ffffff',
    fontWeight: '800',
  },
});
