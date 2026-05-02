import React, { useCallback, useState, useRef } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Pressable,
  StyleSheet,
  Text,
  View,
  TextInput,
  Modal,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';
import ViewShot from 'react-native-view-shot';

import { api } from '@/services/api';
import { Brand } from '@/constants/brand';
import { Article } from '@/types/app';
import { LogoMark } from '@/components/brand/logo-mark';

const ITEMS_PER_PAGE_OPTIONS = [10, 25, 50, 100];

interface LabelViewProps {
  article: Article;
}

const LabelView: React.FC<LabelViewProps> = ({ article }) => {
  const prixTtc = article.prix !== null ? article.prix.toFixed(2) : 'N/A';
  const prixHt = article.base_ht !== null ? article.base_ht.toFixed(2) : 'N/A';

  return (
    <View style={labelStyles.labelContainer}>
      <View style={labelStyles.cornerTL} />
      <View style={labelStyles.cornerBR} />
      <View style={labelStyles.topSection}>
        <Text style={labelStyles.title} numberOfLines={2}>{article.designation}</Text>
      </View>
      <View style={labelStyles.pricesRow}>
        <View style={labelStyles.priceCol}>
          <Text style={labelStyles.priceLabel}>PRIX TTC</Text>
          <Text style={labelStyles.priceValue}>{prixTtc}€</Text>
        </View>
        <View style={labelStyles.priceCol}>
          <Text style={labelStyles.priceLabel}>PRIX HT</Text>
          <Text style={labelStyles.priceValue}>{prixHt}€</Text>
        </View>
      </View>
      <View style={labelStyles.brandSection}>
        <LogoMark size={100} />
      </View>
    </View>
  );
};

const labelStyles = StyleSheet.create({
  labelContainer: {
    width: 400,
    height: 210,
    backgroundColor: '#f5f5f5',
    borderWidth: 2,
    borderColor: '#222',
    borderRadius: 12,
    overflow: 'hidden',
    justifyContent: 'center',
  },
  cornerTL: {
    position: 'absolute',
    top: 0,
    left: 0,
    width: 65,
    height: 65,
    backgroundColor: '#ff6600',
    borderBottomRightRadius: 300,
    borderRightWidth: 2,
    borderColor: '#000',
  },
  cornerBR: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    width: 65,
    height: 65,
    backgroundColor: '#ff6600',
    borderTopLeftRadius: 300,
    borderLeftWidth: 2,
    borderColor: '#000',
  },
  topSection: {
    padding: 25,
    paddingBottom: 10,
    alignItems: 'center',
  },
  title: {
    fontSize: 16,
    fontWeight: '900',
    color: '#111',
    textAlign: 'center',
  },
  pricesRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    paddingHorizontal: 25,
  },
  priceCol: {
    alignItems: 'center',
  },
  priceLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: '#222',
  },
  priceValue: {
    fontSize: 22,
    fontWeight: '900',
    color: '#ff6600',
    marginTop: 2,
  },
  brandSection: {
    position: 'absolute',
    bottom: 10,
    left: 12,
  },
});

export default function TicketsScreen() {
  const [articles, setArticles] = useState<Article[]>([]);
  const [selectedArticle, setSelectedArticle] = useState<Article | null>(null);
  const [selectedArticles, setSelectedArticles] = useState<Set<string>>(new Set());
  const [selectionMode, setSelectionMode] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [showPreview, setShowPreview] = useState(false);
  const [itemsPerPage, setItemsPerPage] = useState(10);
  const [currentPage, setCurrentPage] = useState(1);
  const [generating, setGenerating] = useState(false);

  const labelRef = useRef<ViewShot>(null);
  const labelRefs = useRef<Map<string, React.RefObject<ViewShot>>>(new Map());

  const loadArticles = useCallback(async (query = '') => {
    setLoading(true);
    setError(null);
    try {
      let res;
      if (query.trim()) {
        res = await api.searchArticles(query.trim());
      } else {
        res = await api.searchArticles('a');
      }
      
      if (res && res.data && Array.isArray(res.data)) {
        const uniqueArticles = res.data.filter((article, index, self) => 
          index === self.findIndex((a) => a.code === article.code)
        );
        setArticles(uniqueArticles);
      } else {
        setArticles([]);
        setError('Format de réponse invalide');
      }
    } catch (e) {
      console.log('API Error:', e);
      const msg = e instanceof Error ? e.message : String(e);
      setError('Erreur: ' + msg);
    } finally {
      setLoading(false);
    }
  }, []);

  React.useEffect(() => {
    loadArticles();
  }, [loadArticles]);

  const handleSearch = useCallback(() => {
    loadArticles(searchQuery);
  }, [searchQuery, loadArticles]);

  const handleSelectArticle = useCallback((article: Article) => {
    setSelectedArticle(article);
    setShowPreview(true);
  }, []);

  const toggleArticleSelection = useCallback((code: string) => {
    setSelectedArticles((prev) => {
      const next = new Set(prev);
      if (next.has(code)) {
        next.delete(code);
      } else {
        next.add(code);
      }
      return next;
    });
  }, []);

  const toggleSelectionMode = useCallback(() => {
    setSelectionMode((prev) => !prev);
    if (!selectionMode) {
      setSelectedArticles(new Set());
    }
  }, [selectionMode]);

  const selectAllOnPage = useCallback(() => {
    const pageArticles = paginatedArticles();
    setSelectedArticles((prev) => {
      const next = new Set(prev);
      pageArticles.forEach((a) => next.add(a.code));
      return next;
    });
  }, [paginatedArticles]);

  const clearSelection = useCallback(() => {
    setSelectedArticles(new Set());
  }, []);

  const generatePdfFromImages = async (imageUris: string[]): Promise<string> => {
    const LABELS_PER_PAGE = 4;
    const pages: string[][] = [];
    
    for (let i = 0; i < imageUris.length; i += LABELS_PER_PAGE) {
      pages.push(imageUris.slice(i, i + LABELS_PER_PAGE));
    }
    
    const html = `
<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8">
<style>
* { margin: 0; padding: 0; box-sizing: border-box; }
body { font-family: Arial, sans-serif; background: #fff; }
.page { 
  page-break-after: always; 
  display: flex; 
  flex-wrap: wrap; 
  justify-content: center; 
  align-content: flex-start;
  gap: 20px;
  padding: 30px;
}
.page:last-child { page-break-after: avoid; }
img { 
  width: 400px; 
  height: 210px; 
  object-fit: contain; 
}
</style>
</head>
<body>
${pages.map(pageImgs => `
<div class="page">
${pageImgs.map(uri => `<img src="${uri}" />`).join('\n')}
</div>
`).join('\n')}
</body>
</html>`;

    const result = await Print.printToFileAsync({ html });
    return result?.uri || '';
  };

  const handlePrintAllLabels = useCallback(async () => {
    const selectedArticlesList = articles.filter((a) => selectedArticles.has(a.code));
    if (selectedArticlesList.length === 0) {
      Alert.alert('Attention', 'Aucun article sélectionné');
      return;
    }
    try {
      setGenerating(true);
      
      await new Promise(resolve => setTimeout(resolve, 1500));
      
      const imageUris: string[] = [];
      
      for (const article of selectedArticlesList) {
        let ref = labelRefs.current.get(article.code);
        if (!ref) {
          ref = React.createRef();
          labelRefs.current.set(article.code, ref);
        }
        
        try {
          const uri = await ref.current?.capture?.();
          if (uri) {
            imageUris.push(uri);
          }
        } catch (e) {
          console.warn('Capture failed for', article.code, e);
        }
      }

      if (imageUris.length > 0) {
        const pdfUri = await generatePdfFromImages(imageUris);
        if (pdfUri) {
          const canShare = await Sharing.isAvailableAsync();
          if (canShare) {
            await Sharing.shareAsync(pdfUri, {
              mimeType: 'application/pdf',
              dialogTitle: `${selectedArticlesList.length} étiquettes`,
              UTI: 'com.adobe.pdf',
            });
          } else {
            Alert.alert('OK', 'PDF créé');
          }
        } else {
          Alert.alert('Erreur', 'PDF non généré');
        }
      } else {
        Alert.alert('Erreur', 'Aucune étiquette capturée');
      }
    } catch (e: any) {
      const errMsg = e?.message || e?.toString() || 'Erreur';
      Alert.alert('Erreur', errMsg);
    } finally {
      setGenerating(false);
    }
  }, [articles, selectedArticles]);

  const handlePrintLabel = useCallback(async () => {
    if (!selectedArticle || !labelRef.current) return;
    try {
      setLoading(true);
      
      const uri = await labelRef.current.capture?.();
      if (!uri) {
        Alert.alert('Erreur', 'Impossible de capturer l\'étiquette');
        return;
      }
      
      const pdfUri = await generatePdfFromImages([uri]);
      if (!pdfUri) {
        Alert.alert('Erreur', 'PDF non généré');
        return;
      }
      
      const canShare = await Sharing.isAvailableAsync();
      if (canShare) {
        await Sharing.shareAsync(pdfUri, {
          mimeType: 'application/pdf',
          dialogTitle: 'Étiquette - ' + selectedArticle.code,
          UTI: 'com.adobe.pdf',
        });
      } else {
        Alert.alert('OK', 'PDF créé');
      }
    } catch (e: any) {
      const errMsg = e?.message || e?.toString() || 'Erreur';
      Alert.alert('Erreur', errMsg);
    } finally {
      setLoading(false);
    }
  }, [selectedArticle]);

  const handleShareLabel = useCallback(async () => {
    if (!selectedArticle || !labelRef.current) return;
    try {
      setLoading(true);
      
      const uri = await labelRef.current.capture?.();
      if (!uri) {
        Alert.alert('Erreur', 'Impossible de capturer l\'étiquette');
        return;
      }
      
      const pdfUri = await generatePdfFromImages([uri]);
      if (!pdfUri) {
        Alert.alert('Erreur', 'PDF non généré');
        return;
      }
      
      if (await Sharing.isAvailableAsync()) {
        await Sharing.shareAsync(pdfUri, {
          mimeType: 'application/pdf',
          dialogTitle: 'Partager étiquette prix',
          UTI: 'com.adobe.pdf',
        });
      } else {
        Alert.alert('Erreur', 'Partage non disponible');
      }
    } catch (e: any) {
      Alert.alert('Erreur', 'Impossible de générer l\'étiquette');
    } finally {
      setLoading(false);
    }
  }, [selectedArticle]);

  const closePreview = useCallback(() => {
    setShowPreview(false);
    setSelectedArticle(null);
  }, []);

  const paginatedArticles = useCallback(() => {
    const start = (currentPage - 1) * itemsPerPage;
    return articles.slice(start, start + itemsPerPage);
  }, [articles, currentPage, itemsPerPage]);

  const totalPages = Math.ceil(articles.length / itemsPerPage);

  const handleItemsPerPageChange = useCallback((value: number) => {
    setItemsPerPage(value);
    setCurrentPage(1);
  }, []);

  const renderPageSelector = () => (
    <View style={styles.pageSelectorContainer}>
      <View style={styles.perPageSelector}>
        <Text style={styles.perPageLabel}>Par page:</Text>
        <View style={styles.perPageOptions}>
          {ITEMS_PER_PAGE_OPTIONS.map((opt) => (
            <Pressable
              key={opt}
              style={[styles.perPageOption, itemsPerPage === opt && styles.perPageOptionActive]}
              onPress={() => handleItemsPerPageChange(opt)}
            >
              <Text style={[styles.perPageOptionText, itemsPerPage === opt && styles.perPageOptionTextActive]}>
                {opt}
              </Text>
            </Pressable>
          ))}
        </View>
      </View>
      {totalPages > 1 && (
        <View style={styles.paginationControls}>
          <Pressable
            style={[styles.pageButton, currentPage === 1 && styles.pageButtonDisabled]}
            onPress={() => setCurrentPage((p) => Math.max(1, p - 1))}
            disabled={currentPage === 1}
          >
            <Text style={styles.pageButtonText}>Préc</Text>
          </Pressable>
          <Text style={styles.pageIndicator}>{currentPage} / {totalPages}</Text>
          <Pressable
            style={[styles.pageButton, currentPage === totalPages && styles.pageButtonDisabled]}
            onPress={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
            disabled={currentPage === totalPages}
          >
            <Text style={styles.pageButtonText}>Suiv</Text>
          </Pressable>
        </View>
      )}
    </View>
  );

  const renderArticleItem = ({ item }: { item: Article }) => {
    const isSelected = selectedArticles.has(item.code);
    return (
      <Pressable
        style={({ pressed }) => [
          styles.articleCard,
          pressed && styles.articleCardPressed,
          isSelected && styles.articleCardSelected,
        ]}
        onPress={() => selectionMode ? toggleArticleSelection(item.code) : handleSelectArticle(item)}>
        {selectionMode && (
          <View style={[styles.checkbox, isSelected && styles.checkboxSelected]}>
            {isSelected && <Text style={styles.checkmark}>✓</Text>}
          </View>
        )}
        <View style={styles.articleInfo}>
          <Text style={styles.articleCode}>{item.code}</Text>
          <Text style={styles.articleDesignation} numberOfLines={2}>{item.designation}</Text>
        </View>
        <View style={styles.articleRight}>
          {item.prix !== null && (
            <View style={styles.prixBadge}>
              <Text style={styles.prixText}>{item.prix.toFixed(2)} €</Text>
            </View>
          )}
        </View>
      </Pressable>
    );
  };

  const selectedArticlesList = articles.filter((a) => selectedArticles.has(a.code));

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <View style={styles.container}>
        <View style={styles.header}>
          <Text style={styles.headerTitle}>Étiquettes Prix</Text>
          <Text style={styles.headerSub}>
            {selectionMode 
              ? `${selectedArticles.size} article(s) sélectionné(s)` 
              : 'Sélectionnez un article pour créer son étiquette'}
          </Text>
        </View>

        {error && (
          <View style={styles.errorBox}>
            <Text style={styles.errorText}>{error}</Text>
          </View>
        )}
        
        {(loading || generating) && <ActivityIndicator color={Brand.ember} style={styles.loader} size="large" />}

        <View style={styles.searchRow}>
          <TextInput
            style={styles.searchInput}
            placeholder="Rechercher un article..."
            value={searchQuery}
            onChangeText={setSearchQuery}
            onSubmitEditing={handleSearch}
          />
          <Pressable style={styles.searchButton} onPress={handleSearch}>
            <Text style={styles.searchButtonText}>Rechercher</Text>
          </Pressable>
        </View>

        {selectionMode && (
          <View style={styles.selectionToolbar}>
            <Pressable style={styles.selectionBtn} onPress={selectAllOnPage}>
              <Text style={styles.selectionBtnText}>Tout sélectionner page</Text>
            </Pressable>
            <Pressable style={styles.selectionBtn} onPress={clearSelection}>
              <Text style={styles.selectionBtnText}>Tout désélectionner</Text>
            </Pressable>
            <Pressable style={[styles.selectionBtn, styles.generateBtn]} onPress={handlePrintAllLabels}>
              <Text style={styles.generateBtnText}>Générer ({selectedArticles.size})</Text>
            </Pressable>
            <Pressable style={styles.cancelBtn} onPress={toggleSelectionMode}>
              <Text style={styles.cancelBtnText}>Annuler</Text>
            </Pressable>
          </View>
        )}

        {!selectionMode && (
          <View style={styles.actionBar}>
            <Pressable style={styles.selectModeBtn} onPress={toggleSelectionMode}>
              <Text style={styles.selectModeBtnText}>Mode sélection</Text>
            </Pressable>
          </View>
        )}

        <FlatList
          data={paginatedArticles()}
          renderItem={renderArticleItem}
          keyExtractor={(item) => item.code}
          style={styles.articleList}
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}
          ListFooterComponent={renderPageSelector}
        />

        <Modal
          visible={showPreview}
          animationType="slide"
          transparent={true}
          onRequestClose={closePreview}>
          <View style={styles.modalOverlay}>
            <View style={styles.modalContent}>
              {selectedArticle && (
                <>
                  <ViewShot ref={labelRef} options={{ format: 'png', quality: 1 }}>
                    <LabelView article={selectedArticle} />
                  </ViewShot>

                  <View style={styles.modalActions}>
                    <Pressable style={styles.printBtn} onPress={handlePrintLabel}>
                      <Text style={styles.printBtnText}>Imprimer</Text>
                    </Pressable>
                    <Pressable style={styles.shareBtn} onPress={handleShareLabel}>
                      <Text style={styles.shareBtnText}>Partager</Text>
                    </Pressable>
                  </View>

                  <Pressable style={styles.closeBtn} onPress={closePreview}>
                    <Text style={styles.closeBtnText}>Fermer</Text>
                  </Pressable>
                </>
              )}
            </View>
          </View>
        </Modal>

        {generating && selectedArticlesList.length > 0 && (
          <View style={{ position: 'absolute', left: -9999, top: 0, width: 250, flexDirection: 'row', flexWrap: 'wrap' }}>
            {selectedArticlesList.map((article) => {
              let ref = labelRefs.current.get(article.code);
              if (!ref) {
                ref = React.createRef();
                labelRefs.current.set(article.code, ref);
              }
              return (
                <View key={article.code} style={{ margin: 2 }}>
                  <ViewShot ref={ref} options={{ format: 'png', quality: 1 }}>
                    <LabelView article={article} />
                  </ViewShot>
                </View>
              );
            })}
          </View>
        )}
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#fff' },
  container: { flex: 1, padding: 16 },
  header: { marginBottom: 16 },
  headerTitle: { fontSize: 28, fontWeight: '700', color: Brand.ink },
  headerSub: { fontSize: 14, color: Brand.muted, marginTop: 4 },
  errorBox: { backgroundColor: '#ffebee', borderRadius: 12, padding: 14, marginBottom: 16 },
  errorText: { color: Brand.danger, fontSize: 14 },
  loader: { marginVertical: 30 },
  searchRow: { flexDirection: 'row', gap: 8, marginBottom: 12 },
  searchInput: { flex: 1, backgroundColor: '#f8f8f8', borderRadius: 12, paddingHorizontal: 16, paddingVertical: 12, fontSize: 15 },
  searchButton: { backgroundColor: Brand.ink, borderRadius: 12, paddingHorizontal: 16, justifyContent: 'center' },
  searchButtonText: { color: '#fff', fontSize: 14, fontWeight: '600' },
  articleList: { flex: 1 },
  listContent: { paddingBottom: 16 },
  articleCard: { backgroundColor: '#f8f8f8', borderRadius: 14, padding: 14, marginBottom: 8, flexDirection: 'row', alignItems: 'center', borderWidth: 2, borderColor: 'transparent' },
  articleCardPressed: { backgroundColor: '#f0f0f0' },
  articleCardSelected: { borderColor: Brand.ember, backgroundColor: '#fff5f5' },
  articleInfo: { flex: 1 },
  articleCode: { fontSize: 11, fontWeight: '500', color: Brand.muted },
  articleDesignation: { fontSize: 14, fontWeight: '600', color: Brand.ink, marginTop: 2 },
  articleRight: { flexDirection: 'row', alignItems: 'center' },
  prixBadge: { backgroundColor: Brand.ember, borderRadius: 8, paddingHorizontal: 10, paddingVertical: 4 },
  prixText: { color: '#fff', fontSize: 13, fontWeight: '700' },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', padding: 20 },
  modalContent: { backgroundColor: '#fff', borderRadius: 20, padding: 20, alignItems: 'center' },
  modalActions: { flexDirection: 'row', gap: 10, marginBottom: 12, marginTop: 16 },
  printBtn: { flex: 1, backgroundColor: Brand.ember, borderRadius: 12, paddingVertical: 14, alignItems: 'center' },
  printBtnText: { color: '#fff', fontSize: 15, fontWeight: '600' },
  shareBtn: { flex: 1, backgroundColor: Brand.ink, borderRadius: 12, paddingVertical: 14, alignItems: 'center' },
  shareBtnText: { color: '#fff', fontSize: 15, fontWeight: '600' },
  closeBtn: { backgroundColor: '#f0f0f0', borderRadius: 12, paddingVertical: 14, alignItems: 'center', width: '100%' },
  closeBtnText: { color: Brand.muted, fontSize: 15, fontWeight: '600' },
  pageSelectorContainer: { paddingVertical: 16, alignItems: 'center' },
  perPageSelector: { flexDirection: 'row', alignItems: 'center', marginBottom: 12 },
  perPageLabel: { fontSize: 14, color: Brand.muted, marginRight: 10 },
  perPageOptions: { flexDirection: 'row', gap: 6 },
  perPageOption: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 8, backgroundColor: '#f0f0f0' },
  perPageOptionActive: { backgroundColor: Brand.ink },
  perPageOptionText: { fontSize: 14, color: Brand.muted },
  perPageOptionTextActive: { color: '#fff', fontWeight: '600' },
  paginationControls: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  pageButton: { backgroundColor: '#f0f0f0', borderRadius: 8, paddingHorizontal: 14, paddingVertical: 8 },
  pageButtonDisabled: { opacity: 0.4 },
  pageButtonText: { fontSize: 14, color: Brand.ink, fontWeight: '500' },
  pageIndicator: { fontSize: 14, color: Brand.ink, fontWeight: '600' },
  selectionToolbar: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 12 },
  selectionBtn: { backgroundColor: '#f0f0f0', borderRadius: 8, paddingHorizontal: 12, paddingVertical: 8 },
  selectionBtnText: { fontSize: 13, color: Brand.ink },
  generateBtn: { backgroundColor: Brand.ember },
  generateBtnText: { fontSize: 13, color: '#fff', fontWeight: '600' },
  cancelBtn: { backgroundColor: Brand.danger, borderRadius: 8, paddingHorizontal: 12, paddingVertical: 8 },
  cancelBtnText: { fontSize: 13, color: '#fff', fontWeight: '600' },
  actionBar: { marginBottom: 12 },
  selectModeBtn: { backgroundColor: Brand.ink, borderRadius: 12, paddingVertical: 12, alignItems: 'center' },
  selectModeBtnText: { color: '#fff', fontSize: 15, fontWeight: '600' },
  checkbox: { width: 24, height: 24, borderRadius: 6, borderWidth: 2, borderColor: '#ccc', marginRight: 12, justifyContent: 'center', alignItems: 'center' },
  checkboxSelected: { backgroundColor: Brand.ember, borderColor: Brand.ember },
  checkmark: { color: '#fff', fontSize: 14, fontWeight: '700' },
});