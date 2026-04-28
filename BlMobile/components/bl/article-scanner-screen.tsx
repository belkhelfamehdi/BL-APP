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

export function ArticleScannerScreen({ token, fullName, onClose }: Props) {
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
      const res = await api.searchArticles(searchQuery.trim());
      setArticles(res.data);
      if (res.data.length === 1) {
        setSelectedArticle(res.data[0]);
      } else {
        setSelectedArticle(null);
      }
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
    } catch (e) {
      setError('Article non trouve');
    } finally {
      setLoading(false);
    }
  };

  const openScanner = async () => {
    if (!permission?.granted) {
      const result = await requestPermission();
      if (!result.granted) {
        Alert.alert('Permission requise', 'La camera est necessaire pour scanner');
        return;
      }
    }
    setIsScanning(true);
    setShowScanner(true);
  };

  const renderArticleItem = ({ item, index }: { item: Article; index: number }) => (
    <Pressable
      key={`${item.code}-${index}`}
      style={({ pressed }) => [styles.articleCard, pressed && styles.articleCardPressed]}
      onPress={() => setSelectedArticle(item)}>
      <View style={styles.articleInfo}>
        <Text style={styles.articleCode}>{item.code}</Text>
        <Text style={styles.articleDesignation} numberOfLines={2}>{item.designation}</Text>
      </View>
      {item.prix !== null && (
        <View style={styles.prixBadge}>
          <Text style={styles.prixText}>{item.prix.toFixed(2)} EUR</Text>
        </View>
      )}
    </Pressable>
  );

  return (
    <SafeAreaView style={styles.safe} edges={['left', 'right', 'bottom']}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.flex}>
        <View style={styles.container}>
          <View style={styles.header}>
            <Text style={styles.headerTitle}>Recherche Article</Text>
            <Text style={styles.headerSub}>{fullName}</Text>
          </View>

        <View style={styles.searchSection}>
          <View style={styles.searchRow}>
            <TextInput
              style={styles.searchInput}
              value={searchQuery}
              onChangeText={setSearchQuery}
              placeholder="Code barre ou nom..."
              placeholderTextColor={Brand.muted}
              autoCapitalize="none"
              autoCorrect={false}
              onSubmitEditing={searchArticles}
              returnKeyType="search"
            />
            <Pressable style={styles.scanButton} onPress={openScanner}>
              <Text style={styles.scanButtonText}>Scanner</Text>
            </Pressable>
          </View>
          <Pressable style={styles.searchButton} onPress={() => { Keyboard.dismiss(); searchArticles(); }}>
            <Text style={styles.searchButtonText}>Rechercher</Text>
          </Pressable>
          
        </View>

        {error && <View style={styles.errorBox}><Text style={styles.errorText}>{error}</Text></View>}
        {loading && <ActivityIndicator color={Brand.ember} style={styles.loader} size="large" />}

        {!loading && hasSearched && articles.length === 0 && !error && !selectedArticle && (
          <View style={styles.emptyBox}>
            <Text style={styles.emptyText}>Aucun article trouve</Text>
            <Text style={styles.emptySubText}>Verifiez le code barre ou le nom</Text>
          </View>
        )}

        {articles.length > 0 && (
          <View style={styles.resultsSection}>
            <Text style={styles.sectionTitle}>{articles.length} resultat{articles.length > 1 ? 's' : ''}</Text>
            <FlatList
              data={articles}
              renderItem={renderArticleItem}
              keyExtractor={(item, index) => `${item.code}-${index}`}
              style={styles.articleList}
              showsVerticalScrollIndicator={false}
              contentContainerStyle={styles.listContent}
            />
          </View>
        )}

        {selectedArticle && (
          <View style={styles.detailSection}>
            <View style={styles.detailHeader}>
              <Text style={styles.detailTitle}>Detail Article</Text>
            </View>
            <View style={styles.detailCard}>
              <View style={styles.detailRow}>
                <Text style={styles.detailLabel}>Code Barre</Text>
                <Text style={styles.detailValue}>{selectedArticle.code}</Text>
              </View>
              <View style={styles.detailDivider} />
              <View style={styles.detailRow}>
                <Text style={styles.detailLabel}>Designation</Text>
                <Text style={[styles.detailValue, styles.designationValue]}>{selectedArticle.designation}</Text>
              </View>
              <View style={styles.detailDivider} />
              <View style={styles.detailRow}>
                <Text style={styles.detailLabel}>Prix HT</Text>
                <Text style={styles.detailValue}>
                  {selectedArticle.base_ht !== null ? `${selectedArticle.base_ht.toFixed(2)} EUR` : 'N/A'}
                </Text>
              </View>
              <View style={styles.detailDivider} />
              <View style={styles.detailRow}>
                <Text style={styles.detailLabel}>Prix TTC</Text>
                <Text style={styles.prixValue}>
                  {selectedArticle.prix !== null ? `${selectedArticle.prix.toFixed(2)} EUR` : 'N/A'}
                </Text>
              </View>
            </View>
          </View>
        )}
        </View>
      </KeyboardAvoidingView>

      <Modal visible={showScanner} animationType="slide" onRequestClose={() => setShowScanner(false)}>
        <View style={styles.modalContainer}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>Scanner Code Barre</Text>
            <Pressable style={styles.closeButton} onPress={() => setShowScanner(false)}>
              <Text style={styles.closeButtonText}>Fermer</Text>
            </Pressable>
          </View>
          <View style={styles.cameraContainer}>
            <CameraView
              style={styles.camera}
              facing="back"
              barcodeScannerSettings={{
                barcodeTypes: ['qr', 'ean13', 'ean8'],
              }}
              onBarcodeScanned={isScanning ? (barcode) => {
                if (barcode.data) {
                  handleScanResult(barcode.data);
                }
              } : undefined}
            />
            <View style={styles.scanOverlay}>
              <View style={styles.scanFrame} />
            </View>
          </View>
          <Text style={styles.scanHint}>Pointez vers le code barre</Text>
          <Pressable style={styles.retryScanButton} onPress={() => setIsScanning(true)}>
            <Text style={styles.retryScanText}>Scanner a nouveau</Text>
          </Pressable>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#fff', paddingTop: 0 },
  flex: { flex: 1 },
  container: { flex: 1, padding: 20 },
  header: { marginBottom: 20 },
  headerTitle: { fontSize: 32, fontWeight: '700', color: Brand.ink },
  headerSub: { fontSize: 15, color: Brand.muted, marginTop: 4 },
  searchSection: { marginBottom: 16 },
  searchRow: { flexDirection: 'row', gap: 12, marginBottom: 12 },
  searchInput: {
    flex: 1,
    backgroundColor: '#f5f5f5',
    borderRadius: 14,
    paddingHorizontal: 18,
    paddingVertical: 16,
    fontSize: 17,
    color: Brand.ink,
  },
  scanButton: {
    backgroundColor: Brand.ember,
    borderRadius: 14,
    paddingHorizontal: 20,
    justifyContent: 'center',
    alignItems: 'center',
  },
  scanButtonText: { color: '#fff', fontSize: 15, fontWeight: '600' },
  searchButton: {
    backgroundColor: Brand.ink,
    borderRadius: 14,
    paddingVertical: 16,
    alignItems: 'center',
    marginBottom: 12,
  },
  searchButtonText: { color: '#fff', fontSize: 17, fontWeight: '600' },
  errorBox: { backgroundColor: '#ffebee', borderRadius: 12, padding: 14, marginBottom: 16 },
  errorText: { color: Brand.danger, fontSize: 15 },
  loader: { marginVertical: 30 },
  emptyBox: { alignItems: 'center', padding: 40 },
  emptyText: { fontSize: 18, fontWeight: '600', color: Brand.muted },
  emptySubText: { fontSize: 14, color: Brand.muted, marginTop: 8 },
  resultsSection: { flex: 1, marginTop: 8 },
  sectionTitle: { fontSize: 15, fontWeight: '600', color: Brand.muted, marginBottom: 12 },
  articleList: { flex: 1 },
  listContent: { paddingBottom: 20 },
  articleCard: {
    backgroundColor: '#f8f8f8',
    borderRadius: 16,
    padding: 16,
    marginBottom: 10,
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#eee',
  },
  articleCardPressed: { backgroundColor: '#f0f0f0' },
  articleInfo: { flex: 1 },
  articleCode: { fontSize: 14, fontWeight: '500', color: Brand.muted },
  articleDesignation: { fontSize: 16, fontWeight: '700', color: Brand.ink, marginTop: 4 },
  prixBadge: {
    backgroundColor: Brand.ember,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 6,
    marginLeft: 12,
  },
  prixText: { color: '#fff', fontSize: 14, fontWeight: '700' },
  detailSection: { marginTop: 16, paddingBottom: 20 },
  detailHeader: { marginBottom: 12 },
  detailTitle: { fontSize: 17, fontWeight: '600', color: Brand.muted },
  detailCard: {
    backgroundColor: Brand.bone,
    borderRadius: 20,
    padding: 20,
    borderWidth: 1,
    borderColor: Brand.border,
  },
  detailRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 8 },
  detailDivider: { height: 1, backgroundColor: Brand.border, marginVertical: 4 },
  detailLabel: { fontSize: 15, color: Brand.muted },
  detailValue: { fontSize: 16, fontWeight: '600', color: Brand.ink, flex: 1, textAlign: 'right', marginLeft: 12 },
  designationValue: { fontSize: 15 },
  prixValue: { fontSize: 22, fontWeight: '700', color: Brand.ember },
  modalContainer: { flex: 1, backgroundColor: '#000' },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 20, backgroundColor: Brand.ink },
  modalTitle: { color: '#fff', fontSize: 20, fontWeight: '600' },
  closeButton: { padding: 8 },
  closeButtonText: { color: '#fff', fontSize: 16 },
  cameraContainer: { flex: 1, position: 'relative' },
  camera: { flex: 1 },
  scanOverlay: { ...StyleSheet.absoluteFillObject, justifyContent: 'center', alignItems: 'center' },
  scanFrame: { width: 320, height: 200, borderWidth: 4, borderColor: Brand.ember, borderRadius: 20 },
  scanHint: { color: '#fff', textAlign: 'center', padding: 20, fontSize: 16 },
  retryScanButton: { backgroundColor: Brand.ember, margin: 20, padding: 16, borderRadius: 14, alignItems: 'center' },
  retryScanText: { color: '#fff', fontSize: 17, fontWeight: '600' },
});