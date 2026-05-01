import React, { useCallback, useState } from 'react';
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

import { api } from '@/services/api';
import { Brand } from '@/constants/brand';
import { Article } from '@/types/app';

const ITEMS_PER_PAGE_OPTIONS = [10, 25, 50, 100];

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

  const handleSearch = useCallback(() => {
    loadArticles(searchQuery);
  }, [searchQuery, loadArticles]);

  React.useEffect(() => {
    loadArticles();
  }, [loadArticles]);

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

  const generateLabelHtml = (article: Article): string => {
    const prixTtc = article.prix !== null ? article.prix.toFixed(2) : 'N/A';
    const prixHt = article.base_ht !== null ? article.base_ht.toFixed(2) : 'N/A';
    
    return `
<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8">
<style>
* { margin: 0; padding: 0; box-sizing: border-box; }
body { font-family: Arial, sans-serif; padding: 10px; background: #fff; }
.label { 
  position: relative;
  width: 300px;
  height: 160px;
  margin: 0 auto;
  background: #f5f5f5;
  border: 2px solid #222;
  border-radius: 12px;
  overflow: hidden;
}
.corner-tl {
  position: absolute;
  top: 0; left: 0;
  width: 50px; height: 50px;
  background: #ff6600;
  border-bottom-right-radius: 40px;
}
.corner-br {
  position: absolute;
  bottom: 0; right: 0;
  width: 50px; height: 50px;
  background: #ff6600;
  border-top-left-radius: 40px;
}
.top-section {
  padding: 25px 15px 12px;
  text-align: center;
}
.title {
  font-size: 14px;
  font-weight: 900;
  color: #111;
  line-height: 1.2;
}
.prices-section {
  display: flex;
  justify-content: space-around;
  padding: 10px 20px;
}
.price-col {
  text-align: center;
}
.price-label {
  font-size: 11px;
  font-weight: 700;
  color: #222;
  text-transform: uppercase;
}
.price-value {
  font-size: 20px;
  font-weight: 900;
  color: #ff6600;
  margin-top: 2px;
}
.bottom-section {
  position: absolute;
  bottom: 8px;
  left: 12px;
}
.brand-badge {
  display: inline-block;
  background: #222;
  border-radius: 6px;
  padding: 4px 10px;
}
.brand-name {
  color: #fff;
  font-size: 10px;
  font-weight: 700;
}
.brand-sub {
  color: #aaa;
  font-size: 7px;
}
</style>
</head>
<body>
<div class="label">
<div class="corner-tl"></div>
<div class="corner-br"></div>
<div class="top-section">
<div class="title">${article.designation}</div>
</div>
<div class="prices-section">
<div class="price-col">
<div class="price-label">Prix TTC</div>
<div class="price-value">${prixTtc}€</div>
</div>
<div class="price-col">
<div class="price-label">Prix HT</div>
<div class="price-value">${prixHt}€</div>
</div>
</div>
<div class="bottom-section">
<div class="brand-badge">
<div class="brand-name">Distriresto</div>
<div class="brand-sub">Fast & Good Food</div>
</div>
</div>
</div>
</body>
</html>
    `;
  };

  const generateMultipleLabelsHtml = (selectedArticlesList: Article[]): string => {
    const labelsHtml = selectedArticlesList.map((article) => {
      const prixTtc = article.prix !== null ? article.prix.toFixed(2) : 'N/A';
      const prixHt = article.base_ht !== null ? article.base_ht.toFixed(2) : 'N/A';
      return `
<div class="label">
  <div class="corner-tl"></div>
  <div class="corner-br"></div>
  <div class="top-section">
    <div class="title">${article.designation}</div>
  </div>
  <div class="prices-section">
    <div class="price-col">
      <div class="price-label">Prix TTC</div>
      <div class="price-value">${prixTtc}€</div>
    </div>
    <div class="price-col">
      <div class="price-label">Prix HT</div>
      <div class="price-value">${prixHt}€</div>
    </div>
  </div>
  <div class="bottom-section">
    <div class="brand-badge">
      <div class="brand-name">Distriresto</div>
      <div class="brand-sub">Fast & Good Food</div>
    </div>
  </div>
</div>`;
    }).join('');

    return `
<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8">
<style>
* { margin: 0; padding: 0; box-sizing: border-box; }
body { font-family: Arial, sans-serif; background: #fff; }
.label-page { 
  page-break-after: always; 
  display: flex; 
  flex-wrap: wrap; 
  justify-content: center; 
  align-content: flex-start;
  gap: 15px;
  padding: 20px;
  min-height: 100vh;
}
.label-page:last-child { page-break-after: auto; }
.label { 
  position: relative;
  width: 250px;
  height: 130px;
  background: #f5f5f5;
  border: 2px solid #222;
  border-radius: 10px;
  overflow: hidden;
}
.corner-tl {
  position: absolute;
  top: 0; left: 0;
  width: 40px; height: 40px;
  background: #ff6600;
  border-bottom-right-radius: 30px;
}
.corner-br {
  position: absolute;
  bottom: 0; right: 0;
  width: 40px; height: 40px;
  background: #ff6600;
  border-top-left-radius: 30px;
}
.top-section { padding: 18px 12px 8px; text-align: center; }
.title { font-size: 11px; font-weight: 900; color: #111; line-height: 1.2; }
.prices-section { display: flex; justify-content: space-around; padding: 6px 14px; }
.price-col { text-align: center; }
.price-label { font-size: 9px; font-weight: 700; color: #222; text-transform: uppercase; }
.price-value { font-size: 16px; font-weight: 900; color: #ff6600; margin-top: 2px; }
.bottom-section { position: absolute; bottom: 5px; left: 8px; }
.brand-badge { display: inline-block; background: #222; border-radius: 4px; padding: 2px 6px; }
.brand-name { color: #fff; font-size: 8px; font-weight: 700; }
.brand-sub { color: #aaa; font-size: 5px; }
</style>
</head>
<body>
<div class="label-page">
${labelsHtml}
</div>
</body>
</html>`;
  };

  const handlePrintAllLabels = useCallback(async () => {
    const selectedArticlesList = articles.filter((a) => selectedArticles.has(a.code));
    if (selectedArticlesList.length === 0) {
      Alert.alert('Attention', 'Aucun article sélectionné');
      return;
    }
    try {
      setLoading(true);
      const html = generateMultipleLabelsHtml(selectedArticlesList);
      const result = await Print.printToFileAsync({ html });
      const uri = result?.uri;
      if (!uri) {
        Alert.alert('Erreur', 'PDF non généré');
        return;
      }
      const canShare = await Sharing.isAvailableAsync();
      if (canShare) {
        await Sharing.shareAsync(uri, {
          mimeType: 'application/pdf',
          dialogTitle: `${selectedArticlesList.length} étiquettes`,
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
  }, [articles, selectedArticles]);

  const handlePrintPreview = useCallback(async () => {
    if (!selectedArticle) return;
    try {
      const html = generateLabelHtml(selectedArticle);
      await Print.printAsync({ html });
    } catch (e: any) {
      const errMsg = e?.message || e?.toString() || 'Erreur inconnue';
      Alert.alert('Erreur', 'Prévisualisation: ' + errMsg);
    }
  }, [selectedArticle]);

  const handlePrintLabel = useCallback(async () => {
    if (!selectedArticle) return;
    try {
      setLoading(true);
      const html = generateLabelHtml(selectedArticle);
      
      const result = await Print.printToFileAsync({ html });
      const uri = result?.uri;
      
      if (!uri) {
        Alert.alert('Erreur', 'PDF non généré');
        return;
      }
      
      const canShare = await Sharing.isAvailableAsync();
      if (canShare) {
        await Sharing.shareAsync(uri, {
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
    if (!selectedArticle) return;
    try {
      setLoading(true);
      const html = generateLabelHtml(selectedArticle);
      const { uri } = await Print.printToFileAsync({ html });
      
      if (await Sharing.isAvailableAsync()) {
        await Sharing.shareAsync(uri, {
          mimeType: 'application/pdf',
          dialogTitle: 'Partager étiquette prix',
          UTI: 'com.adobe.pdf',
        });
      } else {
        Alert.alert('Erreur', 'Partage non disponible');
      }
    } catch (_e) {
      Alert.alert('Erreur', 'Impossible de generate the label');
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
        
        {loading && <ActivityIndicator color={Brand.ember} style={styles.loader} size="large" />}

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
                  <View style={styles.labelPreview}>
                    <View style={styles.labelCornerTL} />
                    <View style={styles.labelCornerBR} />
                    <View style={styles.labelTopSection}>
                      <Text style={styles.labelTitle}>{selectedArticle.designation}</Text>
                    </View>
                    <View style={styles.labelPricesRow}>
                      <View style={styles.labelPriceCol}>
                        <Text style={styles.labelPriceLabel}>PRIX TTC</Text>
                        <Text style={styles.labelPriceValue}>
                          {selectedArticle.prix?.toFixed(2) ?? 'N/A'}€
                        </Text>
                      </View>
                      <View style={styles.labelPriceCol}>
                        <Text style={styles.labelPriceLabel}>PRIX HT</Text>
                        <Text style={styles.labelPriceValue}>
                          {selectedArticle.base_ht?.toFixed(2) ?? 'N/A'}€
                        </Text>
                      </View>
                    </View>
                    <View style={styles.labelBrand}>
                      <View style={styles.brandBadge}>
                        <Text style={styles.brandName}>Distriresto</Text>
                        <Text style={styles.brandSub}>Fast & Good Food</Text>
                      </View>
                    </View>
                  </View>

                  <View style={styles.modalActions}>
                    <Pressable style={styles.previewBtn} onPress={handlePrintPreview}>
                      <Text style={styles.previewBtnText}>Aperçu</Text>
                    </Pressable>
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
  modalContent: { backgroundColor: '#fff', borderRadius: 20, padding: 20 },
  labelPreview: { 
    position: 'relative',
    width: 280,
    height: 150,
    backgroundColor: '#f5f5f5',
    borderWidth: 2,
    borderColor: '#222',
    borderRadius: 12,
    overflow: 'hidden',
    marginBottom: 20,
  },
  labelCornerTL: {
    position: 'absolute',
    top: 0, left: 0,
    width: 45, height: 45,
    backgroundColor: '#ff6600',
    borderBottomRightRadius: 35,
  },
  labelCornerBR: {
    position: 'absolute',
    bottom: 0, right: 0,
    width: 45, height: 45,
    backgroundColor: '#ff6600',
    borderTopLeftRadius: 35,
  },
  labelTopSection: {
    padding: 22, paddingBottom: 10,
    alignItems: 'center',
  },
  labelTitle: {
    fontSize: 13,
    fontWeight: '900',
    color: '#111',
    textAlign: 'center',
  },
  labelPricesRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    paddingHorizontal: 20,
    paddingTop: 8,
  },
  labelPriceCol: { alignItems: 'center' },
  labelPriceLabel: {
    fontSize: 10,
    fontWeight: '700',
    color: '#222',
  },
  labelPriceValue: {
    fontSize: 18,
    fontWeight: '900',
    color: '#ff6600',
    marginTop: 2,
  },
  labelBrand: {
    position: 'absolute',
    bottom: 8, left: 12,
  },
  brandBadge: {
    backgroundColor: '#222',
    borderRadius: 6,
    paddingHorizontal: 10, paddingVertical: 4,
  },
  brandName: {
    color: '#fff',
    fontSize: 9,
    fontWeight: '700',
  },
  brandSub: {
    color: '#aaa',
    fontSize: 6,
  },
  modalActions: { flexDirection: 'row', gap: 10, marginBottom: 12 },
  previewBtn: { flex: 1, backgroundColor: '#f0f0f0', borderRadius: 12, paddingVertical: 14, alignItems: 'center' },
  previewBtnText: { color: Brand.ink, fontSize: 15, fontWeight: '600' },
  printBtn: { flex: 1, backgroundColor: Brand.ember, borderRadius: 12, paddingVertical: 14, alignItems: 'center' },
  printBtnText: { color: '#fff', fontSize: 15, fontWeight: '600' },
  shareBtn: { flex: 1, backgroundColor: Brand.ink, borderRadius: 12, paddingVertical: 14, alignItems: 'center' },
  shareBtnText: { color: '#fff', fontSize: 15, fontWeight: '600' },
  closeBtn: { backgroundColor: '#f0f0f0', borderRadius: 12, paddingVertical: 14, alignItems: 'center' },
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