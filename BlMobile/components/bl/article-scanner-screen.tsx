import React, { useCallback, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Keyboard,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { SafeAreaView } from 'react-native-safe-area-context';

import { api } from '@/services/api';
import { Brand } from '@/constants/brand';
import { Article } from '@/types/app';

interface Props {
  token: string;
  fullName: string;
  onClose: () => void;
}

export function ArticleScannerScreen({ token: _token, fullName: _fullName, onClose: _onClose }: Props) {
  const [searchQuery, setSearchQuery] = useState('');
  const [articles, setArticles] = useState<Article[]>([]);
  const [selectedArticle, setSelectedArticle] = useState<Article | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showScanner, setShowScanner] = useState(false);
  const [permission, requestPermission] = useCameraPermissions();
  const [isScanning, setIsScanning] = useState(true);
  const [hasSearched, setHasSearched] = useState(false);

  const searchArticles = useCallback(async () => {
    if (!searchQuery.trim()) {
      setArticles([]);
      return;
    }
    try {
      setLoading(true);
      setError(null);
      setHasSearched(true);
      setSelectedArticle(null);
      const res = await api.searchArticles(searchQuery.trim());
      setArticles(res.data);
      if (res.data.length === 1) setSelectedArticle(res.data[0] ?? null);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Erreur');
      setArticles([]);
    } finally {
      setLoading(false);
    }
  }, [searchQuery]);

  const handleScanResult = async (scanData: string) => {
    setIsScanning(false);
    setShowScanner(false);
    setLoading(true);
    setError(null);
    setHasSearched(true);
    setArticles([]);
    setSelectedArticle(null);
    try {
      const article = await api.getArticleByCode(scanData);
      setSelectedArticle(article);
    } catch {
      setError('Article non trouvé pour ce code barre');
    } finally {
      setLoading(false);
    }
  };

  const openScanner = async () => {
    if (!permission?.granted) {
      const result = await requestPermission();
      if (!result.granted) {
        Alert.alert('Permission caméra', 'La caméra est nécessaire pour scanner les codes barres.');
        return;
      }
    }
    setIsScanning(true);
    setShowScanner(true);
  };

  const renderArticleItem = ({ item, index }: { item: Article; index: number }) => (
    <Pressable
      key={`${item.code}-${index}`}
      style={({ pressed }) => [styles.articleCard, pressed && { opacity: 0.85 }]}
      onPress={() => { setSelectedArticle(item); setArticles([]); }}>
      <View style={styles.articleInfo}>
        <Text style={styles.articleCode}>{item.code}</Text>
        <Text style={styles.articleDesignation} numberOfLines={2}>{item.designation}</Text>
      </View>
      {item.prix !== null && (
        <View style={styles.prixBadge}>
          <Text style={styles.prixText}>{item.prix.toFixed(2)} €</Text>
        </View>
      )}
    </Pressable>
  );

  return (
    <SafeAreaView style={styles.safe} edges={['left', 'right', 'bottom']}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.flex}>
        <View style={styles.container}>

          <View style={styles.searchSection}>
            <View style={styles.searchRow}>
              <TextInput
                style={styles.searchInput}
                value={searchQuery}
                onChangeText={setSearchQuery}
                placeholder="Code article ou désignation…"
                placeholderTextColor="#BBBBBB"
                autoCapitalize="none"
                autoCorrect={false}
                onSubmitEditing={() => { Keyboard.dismiss(); searchArticles(); }}
                returnKeyType="search"
              />
              <Pressable
                style={({ pressed }) => [styles.scanBtn, pressed && { opacity: 0.8 }]}
                onPress={openScanner}>
                <Text style={styles.scanBtnText}>Scanner</Text>
              </Pressable>
            </View>
            <Pressable
              style={({ pressed }) => [styles.searchBtn, pressed && { opacity: 0.85 }]}
              onPress={() => { Keyboard.dismiss(); searchArticles(); }}>
              <Text style={styles.searchBtnText}>Rechercher</Text>
            </Pressable>
          </View>

          {error ? (
            <View style={styles.alertBox}>
              <Text style={styles.alertText}>{error}</Text>
            </View>
          ) : null}

          {loading ? (
            <View style={styles.loadingRow}>
              <ActivityIndicator color={Brand.ember} size="large" />
            </View>
          ) : null}

          {!loading && hasSearched && articles.length === 0 && !error && !selectedArticle ? (
            <View style={styles.emptyState}>
              <Text style={styles.emptyText}>Aucun article trouvé</Text>
              <Text style={styles.emptySubText}>Vérifiez le code barre ou la désignation</Text>
            </View>
          ) : null}

          {articles.length > 0 && (
            <View style={styles.resultSection}>
              <Text style={styles.resultCount}>
                {articles.length} résultat{articles.length > 1 ? 's' : ''}
              </Text>
              <FlatList
                data={articles}
                renderItem={renderArticleItem}
                keyExtractor={(item, idx) => `${item.code}-${idx}`}
                style={styles.flex}
                showsVerticalScrollIndicator={false}
                contentContainerStyle={styles.articleListContent}
                keyboardShouldPersistTaps="handled"
              />
            </View>
          )}

          {selectedArticle && articles.length === 0 && (
            <View style={styles.detailCard}>
              <View style={styles.detailHeader}>
                <Text style={styles.detailTitle}>{selectedArticle.designation}</Text>
                <Pressable
                  style={styles.detailClearBtn}
                  onPress={() => { setSelectedArticle(null); setHasSearched(false); setSearchQuery(''); }}>
                  <Text style={styles.detailClearText}>Effacer</Text>
                </Pressable>
              </View>

              <View style={styles.detailDivider} />

              <View style={styles.detailRow}>
                <Text style={styles.detailLabel}>Code article</Text>
                <Text style={styles.detailValue}>{selectedArticle.code}</Text>
              </View>

              <View style={styles.detailDivider} />

              <View style={styles.detailRow}>
                <Text style={styles.detailLabel}>Prix HT</Text>
                <Text style={styles.detailValue}>
                  {selectedArticle.base_ht !== null ? `${selectedArticle.base_ht.toFixed(2)} €` : '—'}
                </Text>
              </View>

              <View style={styles.detailDivider} />

              <View style={styles.detailRow}>
                <Text style={styles.detailLabel}>Prix TTC</Text>
                <Text style={styles.prixTtcValue}>
                  {selectedArticle.prix !== null ? `${selectedArticle.prix.toFixed(2)} €` : '—'}
                </Text>
              </View>
            </View>
          )}
        </View>
      </KeyboardAvoidingView>

      <Modal visible={showScanner} animationType="slide" onRequestClose={() => setShowScanner(false)}>
        <View style={styles.cameraModal}>
          <SafeAreaView style={styles.cameraModalSafe} edges={['top']}>
            <View style={styles.cameraHeader}>
              <Text style={styles.cameraTitle}>Scanner un code barre</Text>
              <Pressable style={styles.cameraCloseBtn} onPress={() => setShowScanner(false)}>
                <Text style={styles.cameraCloseBtnText}>Fermer</Text>
              </Pressable>
            </View>
          </SafeAreaView>
          <View style={styles.cameraBody}>
            <CameraView
              style={styles.camera}
              facing="back"
              barcodeScannerSettings={{ barcodeTypes: ['qr', 'ean13', 'ean8', 'code128', 'code39'] }}
              onBarcodeScanned={isScanning ? (b) => { if (b.data) handleScanResult(b.data); } : undefined}
            />
            <View style={styles.scanOverlay}>
              <View style={styles.scanFrame}>
                <View style={[styles.scanCorner, styles.scanCornerTL]} />
                <View style={[styles.scanCorner, styles.scanCornerTR]} />
                <View style={[styles.scanCorner, styles.scanCornerBL]} />
                <View style={[styles.scanCorner, styles.scanCornerBR]} />
              </View>
              <Text style={styles.scanHint}>Pointez vers le code barre</Text>
            </View>
          </View>
          <View style={styles.cameraFooter}>
            <Pressable
              style={({ pressed }) => [styles.retryBtn, pressed && { opacity: 0.8 }]}
              onPress={() => setIsScanning(true)}>
              <Text style={styles.retryBtnText}>Scanner à nouveau</Text>
            </Pressable>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#FAFAFA' },
  flex: { flex: 1 },
  container: { flex: 1, padding: 16 },

  searchSection: { gap: 10, marginBottom: 16 },
  searchRow: { flexDirection: 'row', gap: 10 },
  searchInput: {
    flex: 1,
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    borderWidth: 1.5,
    borderColor: '#EBEBEB',
    paddingHorizontal: 16,
    paddingVertical: 14,
    fontSize: 16,
    color: Brand.ink,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 4,
    elevation: 1,
  },
  scanBtn: {
    backgroundColor: Brand.ember,
    borderRadius: 14,
    paddingHorizontal: 18,
    justifyContent: 'center',
    alignItems: 'center',
  },
  scanBtnText: { color: '#FFFFFF', fontSize: 14, fontWeight: '700' },
  searchBtn: {
    backgroundColor: Brand.ink,
    borderRadius: 14,
    paddingVertical: 15,
    alignItems: 'center',
  },
  searchBtnText: { color: '#FFFFFF', fontSize: 16, fontWeight: '600' },

  alertBox: { backgroundColor: '#FFF0F0', borderRadius: 12, borderWidth: 1, borderColor: '#FFD0D0', padding: 12, marginBottom: 12 },
  alertText: { color: Brand.danger, fontSize: 13, fontWeight: '500' },
  loadingRow: { paddingVertical: 32, alignItems: 'center' },
  emptyState: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 8, paddingBottom: 60 },
  emptyText: { fontSize: 17, fontWeight: '600', color: Brand.muted },
  emptySubText: { fontSize: 14, color: '#AAAAAA', textAlign: 'center' },

  resultSection: { flex: 1 },
  resultCount: { fontSize: 13, fontWeight: '600', color: Brand.muted, marginBottom: 10 },
  articleListContent: { paddingBottom: 16 },
  articleCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    padding: 14,
    marginBottom: 8,
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#EBEBEB',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 4,
    elevation: 1,
  },
  articleInfo: { flex: 1, paddingRight: 12 },
  articleCode: { fontSize: 12, fontWeight: '600', color: Brand.muted },
  articleDesignation: { fontSize: 15, fontWeight: '600', color: Brand.ink, marginTop: 3 },
  prixBadge: { backgroundColor: Brand.ember, borderRadius: 10, paddingHorizontal: 12, paddingVertical: 6 },
  prixText: { color: '#FFFFFF', fontSize: 14, fontWeight: '700' },

  detailCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    padding: 20,
    borderWidth: 1,
    borderColor: '#EBEBEB',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 12,
    elevation: 3,
  },
  detailHeader: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 16 },
  detailTitle: { fontSize: 16, fontWeight: '700', color: Brand.ink, flex: 1, paddingRight: 12, lineHeight: 22 },
  detailClearBtn: { paddingVertical: 4, paddingHorizontal: 10, backgroundColor: '#F5F5F5', borderRadius: 8 },
  detailClearText: { fontSize: 13, color: Brand.muted, fontWeight: '500' },
  detailDivider: { height: 1, backgroundColor: '#F0F0F0', marginVertical: 2 },
  detailRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 12 },
  detailLabel: { fontSize: 14, color: Brand.muted },
  detailValue: { fontSize: 15, fontWeight: '600', color: Brand.ink },
  prixTtcValue: { fontSize: 24, fontWeight: '800', color: Brand.ember },

  cameraModal: { flex: 1, backgroundColor: '#0A0A0A' },
  cameraModalSafe: { backgroundColor: '#0A0A0A' },
  cameraHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 16,
    backgroundColor: Brand.ink,
  },
  cameraTitle: { color: '#FFFFFF', fontSize: 18, fontWeight: '600' },
  cameraCloseBtn: { backgroundColor: 'rgba(255,255,255,0.15)', borderRadius: 8, paddingVertical: 7, paddingHorizontal: 14 },
  cameraCloseBtnText: { color: '#FFFFFF', fontSize: 14, fontWeight: '500' },
  cameraBody: { flex: 1, position: 'relative' },
  camera: { flex: 1 },
  scanOverlay: { ...StyleSheet.absoluteFillObject, justifyContent: 'center', alignItems: 'center', gap: 24 },
  scanFrame: { width: 280, height: 180, position: 'relative' },
  scanCorner: { position: 'absolute', width: 24, height: 24, borderColor: Brand.ember, borderRadius: 4 },
  scanCornerTL: { top: 0, left: 0, borderTopWidth: 4, borderLeftWidth: 4 },
  scanCornerTR: { top: 0, right: 0, borderTopWidth: 4, borderRightWidth: 4 },
  scanCornerBL: { bottom: 0, left: 0, borderBottomWidth: 4, borderLeftWidth: 4 },
  scanCornerBR: { bottom: 0, right: 0, borderBottomWidth: 4, borderRightWidth: 4 },
  scanHint: { color: 'rgba(255,255,255,0.8)', fontSize: 15, textAlign: 'center', fontWeight: '500' },
  cameraFooter: { backgroundColor: '#0A0A0A', padding: 20 },
  retryBtn: { backgroundColor: Brand.ember, borderRadius: 14, paddingVertical: 15, alignItems: 'center' },
  retryBtnText: { color: '#FFFFFF', fontSize: 16, fontWeight: '600' },
});
