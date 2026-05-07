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
  const prixTtc = article.prix !== null ? article.prix.toFixed(2) : '—';
  const prixHt = article.base_ht !== null ? article.base_ht.toFixed(2) : '—';

  return (
    <View style={labelStyles.container}>
      {/* Ember left accent bar */}
      <View style={labelStyles.leftBar} />

      <View style={labelStyles.content}>
        {/* Designation header */}
        <View style={labelStyles.header}>
          <Text style={labelStyles.designation} numberOfLines={2}>
            {article.designation}
          </Text>
        </View>

        <View style={labelStyles.divider} />

        {/* Price + logo row */}
        <View style={labelStyles.priceRow}>
          <View style={labelStyles.priceBlock}>
            <Text style={labelStyles.htLabel}>PRIX HT</Text>
            <View style={labelStyles.htValueRow}>
              <Text style={labelStyles.htValue}>{prixHt}</Text>
              <Text style={labelStyles.htUnit}> €</Text>
            </View>
            <View style={labelStyles.ttcRow}>
              <Text style={labelStyles.ttcLabel}>TTC  </Text>
              <Text style={labelStyles.ttcValue}>{prixTtc} €</Text>
            </View>
          </View>

          <View style={labelStyles.logoArea}>
            <LogoMark size={120} />
          </View>
        </View>
      </View>
    </View>
  );
};

const labelStyles = StyleSheet.create({
  container: {
    width: 400,
    height: 200,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#D8D8D8',
    borderRadius: 10,
    flexDirection: 'row',
    overflow: 'hidden',
  },
  leftBar: {
    width: 8,
    backgroundColor: Brand.ember,
  },
  content: {
    flex: 1,
    paddingHorizontal: 18,
    paddingTop: 16,
    paddingBottom: 14,
    justifyContent: 'space-between',
  },
  header: {
    marginBottom: 10,
  },
  designation: {
    fontSize: 14,
    fontWeight: '700',
    color: Brand.ink,
    lineHeight: 20,
  },
  divider: {
    height: 1,
    backgroundColor: '#EFEFEF',
    marginBottom: 10,
  },
  priceRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    flex: 1,
  },
  priceBlock: {
    gap: 2,
  },
  htLabel: {
    fontSize: 9,
    fontWeight: '700',
    color: '#999999',
    textTransform: 'uppercase',
    letterSpacing: 1.6,
  },
  htValueRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
  },
  htValue: {
    fontSize: 42,
    fontWeight: '800',
    color: Brand.ember,
    lineHeight: 46,
  },
  htUnit: {
    fontSize: 21,
    fontWeight: '700',
    color: Brand.ember,
    marginBottom: 5,
  },
  ttcRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 2,
  },
  ttcLabel: {
    fontSize: 10,
    fontWeight: '700',
    color: '#BBBBBB',
    textTransform: 'uppercase',
    letterSpacing: 1.2,
  },
  ttcValue: {
    fontSize: 17,
    fontWeight: '600',
    color: '#666666',
  },
  logoArea: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingLeft: 12,
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
  const [itemsPerPage, setItemsPerPage] = useState(25);
  const [currentPage, setCurrentPage] = useState(1);
  const [generating, setGenerating] = useState(false);

  const pdfLabelRef = useRef<ViewShot | null>(null);
  const labelRefs = useRef<Map<string, React.RefObject<ViewShot | null>>>(new Map());

  const loadArticles = useCallback(async (query = '') => {
    setLoading(true);
    setError(null);
    try {
      const res = await api.searchArticles(query.trim() || 'a');
      if (res?.data && Array.isArray(res.data)) {
        const unique = res.data.filter((a, i, arr) => i === arr.findIndex((x) => x.code === a.code));
        setArticles(unique);
        setCurrentPage(1);
      } else {
        setArticles([]);
        setError('Format de réponse invalide');
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Erreur');
    } finally {
      setLoading(false);
    }
  }, []);

  React.useEffect(() => { loadArticles(); }, [loadArticles]);

  const handleSearch = useCallback(() => { loadArticles(searchQuery); }, [searchQuery, loadArticles]);

  const getPaginatedArticles = useCallback(() => {
    const start = (currentPage - 1) * itemsPerPage;
    return articles.slice(start, start + itemsPerPage);
  }, [articles, currentPage, itemsPerPage]);

  const totalPages = Math.ceil(articles.length / itemsPerPage);

  const toggleArticleSelection = useCallback((code: string) => {
    setSelectedArticles((prev) => {
      const next = new Set(prev);
      if (next.has(code)) next.delete(code); else next.add(code);
      return next;
    });
  }, []);

  const toggleSelectionMode = useCallback(() => {
    setSelectionMode((prev) => !prev);
    setSelectedArticles(new Set());
  }, []);

  const selectAllOnPage = useCallback(() => {
    const pageArticles = getPaginatedArticles();
    setSelectedArticles((prev) => {
      const next = new Set(prev);
      pageArticles.forEach((a) => next.add(a.code));
      return next;
    });
  }, [getPaginatedArticles]);

  const generatePdfFromImages = async (imageUris: string[]): Promise<string> => {
    const LABELS_PER_PAGE = 4;
    const pages: string[][] = [];
    for (let i = 0; i < imageUris.length; i += LABELS_PER_PAGE) {
      pages.push(imageUris.slice(i, i + LABELS_PER_PAGE));
    }
    const html = `<!DOCTYPE html><html><head><meta charset="utf-8"><style>
      *{margin:0;padding:0;box-sizing:border-box;}
      body{font-family:Arial,sans-serif;background:#fff;}
      .page{page-break-after:always;display:flex;flex-wrap:wrap;justify-content:center;align-content:flex-start;gap:20px;padding:30px;}
      .page:last-child{page-break-after:avoid;}
      img{width:400px;height:200px;object-fit:contain;}
    </style></head><body>
    ${pages.map((p) => `<div class="page">${p.map((u) => `<img src="${u}"/>`).join('')}</div>`).join('')}
    </body></html>`;
    const result = await Print.printToFileAsync({ html });
    return result?.uri || '';
  };

  const handlePrintAllLabels = useCallback(async () => {
    const list = articles.filter((a) => selectedArticles.has(a.code));
    if (list.length === 0) { Alert.alert('Attention', 'Aucun article sélectionné'); return; }
    try {
      setGenerating(true);
      await new Promise((r) => setTimeout(r, 1200));
      const uris: string[] = [];
      for (const article of list) {
        let ref = labelRefs.current.get(article.code);
        if (!ref) { ref = React.createRef<ViewShot | null>(); labelRefs.current.set(article.code, ref); }
        try {
          const uri = await (ref.current as ViewShot | null)?.capture?.();
          if (uri) uris.push(uri);
        } catch { /* skip */ }
      }
      if (uris.length > 0) {
        const pdfUri = await generatePdfFromImages(uris);
        if (pdfUri && await Sharing.isAvailableAsync()) {
          await Sharing.shareAsync(pdfUri, { mimeType: 'application/pdf', dialogTitle: `${list.length} étiquettes`, UTI: 'com.adobe.pdf' });
        } else { Alert.alert('PDF créé', `${uris.length} étiquette${uris.length > 1 ? 's' : ''}`); }
      } else { Alert.alert('Erreur', 'Aucune étiquette capturée'); }
    } catch (e: any) { Alert.alert('Erreur', e?.message || 'Erreur inconnue'); }
    finally { setGenerating(false); }
  }, [articles, selectedArticles]);

  const handlePrintSingle = useCallback(async () => {
    if (!selectedArticle || !pdfLabelRef.current) return;
    try {
      setLoading(true);
      const uri = await (pdfLabelRef.current as ViewShot).capture?.();
      if (!uri) { Alert.alert('Erreur', 'Impossible de capturer'); return; }
      const pdfUri = await generatePdfFromImages([uri]);
      if (!pdfUri) { Alert.alert('Erreur', 'PDF non généré'); return; }
      if (await Sharing.isAvailableAsync()) {
        await Sharing.shareAsync(pdfUri, { mimeType: 'application/pdf', dialogTitle: `Étiquette — ${selectedArticle.code}`, UTI: 'com.adobe.pdf' });
      } else { Alert.alert('PDF créé'); }
    } catch (e: any) { Alert.alert('Erreur', e?.message || 'Erreur'); }
    finally { setLoading(false); }
  }, [selectedArticle]);

  const closePreview = useCallback(() => { setShowPreview(false); setSelectedArticle(null); }, []);

  const renderArticleItem = ({ item }: { item: Article }) => {
    const isSelected = selectedArticles.has(item.code);
    return (
      <Pressable
        style={({ pressed }) => [
          styles.articleCard,
          isSelected && styles.articleCardSelected,
          pressed && { opacity: 0.85 },
        ]}
        onPress={() => selectionMode ? toggleArticleSelection(item.code) : (() => { setSelectedArticle(item); setShowPreview(true); })()}>
        {selectionMode && (
          <View style={[styles.checkbox, isSelected && styles.checkboxOn]}>
            {isSelected && <Text style={styles.checkmark}>✓</Text>}
          </View>
        )}
        <View style={styles.articleInfo}>
          <Text style={styles.articleCode}>{item.code}</Text>
          <Text style={styles.articleDesignation} numberOfLines={2}>{item.designation}</Text>
        </View>
        {item.prix !== null && (
          <View style={[styles.prixBadge, isSelected && styles.prixBadgeSelected]}>
            <Text style={styles.prixText}>{item.prix.toFixed(2)} €</Text>
          </View>
        )}
      </Pressable>
    );
  };

  const selectedList = articles.filter((a) => selectedArticles.has(a.code));

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Étiquettes prix</Text>
        <Text style={styles.headerSub}>
          {selectionMode
            ? `${selectedArticles.size} article${selectedArticles.size > 1 ? 's' : ''} sélectionné${selectedArticles.size > 1 ? 's' : ''}`
            : 'Sélectionnez un article pour générer son étiquette'}
        </Text>
      </View>

      <View style={styles.searchRow}>
        <TextInput
          style={styles.searchInput}
          placeholder="Rechercher un article…"
          placeholderTextColor="#BBBBBB"
          value={searchQuery}
          onChangeText={setSearchQuery}
          onSubmitEditing={handleSearch}
          returnKeyType="search"
        />
        <Pressable
          style={({ pressed }) => [styles.searchBtn, pressed && { opacity: 0.85 }]}
          onPress={handleSearch}>
          <Text style={styles.searchBtnText}>Chercher</Text>
        </Pressable>
      </View>

      {error ? <View style={styles.alertBox}><Text style={styles.alertText}>{error}</Text></View> : null}
      {(loading || generating) ? <ActivityIndicator color={Brand.ember} style={styles.loader} size="large" /> : null}

      {selectionMode ? (
        <View style={styles.toolbar}>
          <Pressable style={styles.toolbarBtn} onPress={selectAllOnPage}>
            <Text style={styles.toolbarBtnText}>Tout sélectionner</Text>
          </Pressable>
          <Pressable style={styles.toolbarBtn} onPress={() => setSelectedArticles(new Set())}>
            <Text style={styles.toolbarBtnText}>Effacer</Text>
          </Pressable>
          <Pressable
            style={[styles.toolbarBtn, styles.toolbarBtnAccent]}
            onPress={handlePrintAllLabels}>
            <Text style={styles.toolbarBtnAccentText}>Générer PDF ({selectedArticles.size})</Text>
          </Pressable>
          <Pressable style={styles.toolbarBtnCancel} onPress={toggleSelectionMode}>
            <Text style={styles.toolbarBtnCancelText}>Annuler</Text>
          </Pressable>
        </View>
      ) : (
        <View style={styles.actionBar}>
          <Pressable
            style={({ pressed }) => [styles.selectionModeBtn, pressed && { opacity: 0.85 }]}
            onPress={toggleSelectionMode}>
            <Text style={styles.selectionModeBtnText}>Mode sélection multiple</Text>
          </Pressable>
        </View>
      )}

      <FlatList
        data={getPaginatedArticles()}
        renderItem={renderArticleItem}
        keyExtractor={(item) => item.code}
        style={styles.list}
        contentContainerStyle={styles.listContent}
        showsVerticalScrollIndicator={false}
        ListFooterComponent={() => (
          <View style={styles.pagination}>
            <View style={styles.perPage}>
              <Text style={styles.perPageLabel}>Par page :</Text>
              <View style={styles.perPageOptions}>
                {ITEMS_PER_PAGE_OPTIONS.map((opt) => (
                  <Pressable
                    key={opt}
                    style={[styles.perPageOption, itemsPerPage === opt && styles.perPageOptionActive]}
                    onPress={() => { setItemsPerPage(opt); setCurrentPage(1); }}>
                    <Text style={[styles.perPageOptionText, itemsPerPage === opt && styles.perPageOptionTextActive]}>
                      {opt}
                    </Text>
                  </Pressable>
                ))}
              </View>
            </View>
            {totalPages > 1 && (
              <View style={styles.pageNav}>
                <Pressable
                  style={[styles.pageBtn, currentPage === 1 && styles.pageBtnDisabled]}
                  onPress={() => setCurrentPage((p) => Math.max(1, p - 1))}
                  disabled={currentPage === 1}>
                  <Text style={styles.pageBtnText}>‹</Text>
                </Pressable>
                <Text style={styles.pageIndicator}>{currentPage} / {totalPages}</Text>
                <Pressable
                  style={[styles.pageBtn, currentPage === totalPages && styles.pageBtnDisabled]}
                  onPress={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                  disabled={currentPage === totalPages}>
                  <Text style={styles.pageBtnText}>›</Text>
                </Pressable>
              </View>
            )}
          </View>
        )}
      />

      <Modal visible={showPreview} animationType="slide" transparent onRequestClose={closePreview}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalSheet}>
            <View style={styles.modalHandle} />
            {selectedArticle && (
              <>
                <View style={styles.previewContainer}>
                  <View style={styles.previewScaled}>
                    <LabelView article={selectedArticle} />
                  </View>
                </View>

                <View style={styles.modalActions}>
                  <Pressable
                    style={({ pressed }) => [styles.printBtn, pressed && { opacity: 0.85 }]}
                    onPress={handlePrintSingle}>
                    <Text style={styles.printBtnText}>Imprimer / Partager</Text>
                  </Pressable>
                </View>

                <Pressable
                  style={({ pressed }) => [styles.closeBtn, pressed && { opacity: 0.7 }]}
                  onPress={closePreview}>
                  <Text style={styles.closeBtnText}>Fermer</Text>
                </Pressable>
              </>
            )}
          </View>
        </View>
      </Modal>

      {selectedArticle && (
        <View style={styles.hiddenCapture} pointerEvents="none">
          <ViewShot ref={pdfLabelRef as React.RefObject<ViewShot>} options={{ format: 'png', quality: 1 }}>
            <LabelView article={selectedArticle} />
          </ViewShot>
        </View>
      )}

      {generating && selectedList.length > 0 && (
        <View style={{ position: 'absolute', left: -9999, top: 0, width: 410 }}>
          {selectedList.map((article) => {
            let ref = labelRefs.current.get(article.code);
            if (!ref) { ref = React.createRef<ViewShot | null>(); labelRefs.current.set(article.code, ref); }
            return (
              <ViewShot key={article.code} ref={ref as React.RefObject<ViewShot>} options={{ format: 'png', quality: 1 }}>
                <LabelView article={article} />
              </ViewShot>
            );
          })}
        </View>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#FAFAFA' },
  header: {
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 12,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#EBEBEB',
  },
  headerTitle: { fontSize: 20, fontWeight: '700', color: Brand.ink },
  headerSub: { fontSize: 13, color: Brand.muted, marginTop: 3 },
  searchRow: { flexDirection: 'row', gap: 10, padding: 14 },
  searchInput: {
    flex: 1,
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: '#EBEBEB',
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 15,
    color: Brand.ink,
  },
  searchBtn: {
    backgroundColor: Brand.ink,
    borderRadius: 12,
    paddingHorizontal: 16,
    justifyContent: 'center',
  },
  searchBtnText: { color: '#FFFFFF', fontSize: 14, fontWeight: '600' },
  alertBox: { marginHorizontal: 14, backgroundColor: '#FFF0F0', borderRadius: 12, borderWidth: 1, borderColor: '#FFD0D0', padding: 12, marginBottom: 8 },
  alertText: { color: Brand.danger, fontSize: 13, fontWeight: '500' },
  loader: { marginVertical: 20 },

  toolbar: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, paddingHorizontal: 14, paddingBottom: 10 },
  toolbarBtn: { backgroundColor: '#F0F0F0', borderRadius: 10, paddingHorizontal: 12, paddingVertical: 9 },
  toolbarBtnText: { fontSize: 13, color: Brand.ink, fontWeight: '500' },
  toolbarBtnAccent: { backgroundColor: Brand.ember },
  toolbarBtnAccentText: { fontSize: 13, color: '#FFFFFF', fontWeight: '700' },
  toolbarBtnCancel: { backgroundColor: '#FFEBEE', borderRadius: 10, paddingHorizontal: 12, paddingVertical: 9 },
  toolbarBtnCancelText: { fontSize: 13, color: Brand.danger, fontWeight: '600' },

  actionBar: { paddingHorizontal: 14, paddingBottom: 10 },
  selectionModeBtn: { backgroundColor: Brand.ink, borderRadius: 12, paddingVertical: 13, alignItems: 'center' },
  selectionModeBtnText: { color: '#FFFFFF', fontSize: 15, fontWeight: '600' },

  list: { flex: 1 },
  listContent: { paddingHorizontal: 14, paddingBottom: 16 },
  articleCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    padding: 14,
    marginBottom: 8,
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1.5,
    borderColor: '#EBEBEB',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 4,
    elevation: 1,
  },
  articleCardSelected: { borderColor: Brand.ember, backgroundColor: '#FFFAF7' },
  articleInfo: { flex: 1, paddingRight: 10 },
  articleCode: { fontSize: 11, fontWeight: '600', color: Brand.muted, letterSpacing: 0.3 },
  articleDesignation: { fontSize: 14, fontWeight: '600', color: Brand.ink, marginTop: 3 },
  prixBadge: { backgroundColor: Brand.ember, borderRadius: 10, paddingHorizontal: 10, paddingVertical: 5 },
  prixBadgeSelected: { backgroundColor: Brand.emberDark },
  prixText: { color: '#FFFFFF', fontSize: 13, fontWeight: '700' },
  checkbox: { width: 24, height: 24, borderRadius: 7, borderWidth: 2, borderColor: '#D0D0D0', alignItems: 'center', justifyContent: 'center', marginRight: 10 },
  checkboxOn: { backgroundColor: Brand.ember, borderColor: Brand.ember },
  checkmark: { color: '#FFFFFF', fontSize: 13, fontWeight: '800' },

  pagination: { paddingVertical: 16, alignItems: 'center', gap: 12 },
  perPage: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  perPageLabel: { fontSize: 13, color: Brand.muted },
  perPageOptions: { flexDirection: 'row', gap: 6 },
  perPageOption: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 8, backgroundColor: '#F0F0F0' },
  perPageOptionActive: { backgroundColor: Brand.ink },
  perPageOptionText: { fontSize: 13, color: Brand.muted },
  perPageOptionTextActive: { color: '#FFFFFF', fontWeight: '600' },
  pageNav: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  pageBtn: { width: 36, height: 36, borderRadius: 10, backgroundColor: '#F0F0F0', alignItems: 'center', justifyContent: 'center' },
  pageBtnDisabled: { opacity: 0.35 },
  pageBtnText: { fontSize: 18, color: Brand.ink, lineHeight: 20 },
  pageIndicator: { fontSize: 14, color: Brand.ink, fontWeight: '600', minWidth: 60, textAlign: 'center' },

  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.45)', justifyContent: 'flex-end' },
  modalSheet: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 20,
    paddingBottom: 32,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.12,
    shadowRadius: 16,
    elevation: 16,
  },
  modalHandle: { width: 40, height: 4, backgroundColor: '#E0E0E0', borderRadius: 2, alignSelf: 'center', marginBottom: 20 },
  previewContainer: { alignItems: 'center', marginBottom: 24, height: 166, overflow: 'hidden' },
  previewScaled: { transform: [{ scale: 0.78 }] },
  modalActions: { gap: 10, marginBottom: 10 },
  printBtn: { backgroundColor: Brand.ember, borderRadius: 14, paddingVertical: 15, alignItems: 'center' },
  printBtnText: { color: '#FFFFFF', fontSize: 15, fontWeight: '600' },
  closeBtn: { backgroundColor: '#F5F5F5', borderRadius: 14, paddingVertical: 14, alignItems: 'center' },
  closeBtnText: { fontSize: 14, color: Brand.muted, fontWeight: '500' },

  hiddenCapture: { position: 'absolute', left: -9999, top: 0, width: 400, height: 200, opacity: 0 },
});
