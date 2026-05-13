import React, { useCallback, useState, useRef, useEffect } from 'react';
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
import { CameraView, useCameraPermissions } from 'expo-camera';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';
import { Asset } from 'expo-asset';
import ViewShot from 'react-native-view-shot';

import { api } from '@/services/api';
import { Brand } from '@/constants/brand';
import { Article } from '@/types/app';
import { LogoMark } from '@/components/brand/logo-mark';

const LOGO_ASSET = require('@/assets/images/logo.jpg');

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
  const insets = useSafeAreaInsets();
  const [articles, setArticles] = useState<Article[]>([]);
  const [selectedArticle, setSelectedArticle] = useState<Article | null>(null);
  const [selectedArticlesList, setSelectedArticlesList] = useState<Article[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [showPreview, setShowPreview] = useState(false);
  const [itemsPerPage, setItemsPerPage] = useState(25);
  const [currentPage, setCurrentPage] = useState(1);
  const [generating, setGenerating] = useState(false);
  const [generationProgress, setGenerationProgress] = useState<{ done: number; total: number } | null>(null);
  const [chunkArticles, setChunkArticles] = useState<Article[]>([]);
  const [showScanner, setShowScanner] = useState(false);
  const [permission, requestPermission] = useCameraPermissions();
  const [isScanning, setIsScanning] = useState(true);
  const [scanFeedback, setScanFeedback] = useState<{ kind: 'added' | 'duplicate' | 'error'; text: string } | null>(null);
  const scanResumeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => () => { if (scanResumeTimer.current) clearTimeout(scanResumeTimer.current); }, []);

  useEffect(() => {
    void Asset.fromModule(LOGO_ASSET).downloadAsync().catch(() => {});
  }, []);

  const pdfLabelRef = useRef<ViewShot | null>(null);
  const labelRefs = useRef<Map<string, React.RefObject<ViewShot | null>>>(new Map());

  const searchSeq = useRef(0);

  const loadArticles = useCallback(async (query: string) => {
    const term = query.trim();
    if (term.length < 2) {
      setArticles([]);
      setError(null);
      setLoading(false);
      return;
    }
    const seq = ++searchSeq.current;
    setLoading(true);
    setError(null);
    try {
      const res = await api.searchArticles(term);
      if (seq !== searchSeq.current) return;
      if (res?.data && Array.isArray(res.data)) {
        const unique = res.data.filter((a, i, arr) => i === arr.findIndex((x) => x.code === a.code));
        setArticles(unique);
        setCurrentPage(1);
      } else {
        setArticles([]);
        setError('Format de réponse invalide');
      }
    } catch (e) {
      if (seq !== searchSeq.current) return;
      setError(e instanceof Error ? e.message : 'Erreur');
    } finally {
      if (seq === searchSeq.current) setLoading(false);
    }
  }, []);

  useEffect(() => {
    const handle = setTimeout(() => { loadArticles(searchQuery); }, 350);
    return () => clearTimeout(handle);
  }, [searchQuery, loadArticles]);

  const handleSearch = useCallback(() => { loadArticles(searchQuery); }, [searchQuery, loadArticles]);

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

  const handleScanResult = async (scanData: string) => {
    setIsScanning(false);
    if (scanResumeTimer.current) clearTimeout(scanResumeTimer.current);
    try {
      const article = await api.getArticleByCode(scanData);
      if (!article) {
        setScanFeedback({ kind: 'error', text: 'Article non trouvé' });
      } else {
        let wasDuplicate = false;
        setSelectedArticlesList((prev) => {
          if (prev.some((a) => a.code === article.code)) { wasDuplicate = true; return prev; }
          return [...prev, article];
        });
        setScanFeedback(
          wasDuplicate
            ? { kind: 'duplicate', text: 'Déjà dans la sélection' }
            : { kind: 'added', text: article.designation.length > 38 ? article.designation.substring(0, 38) + '…' : article.designation }
        );
      }
    } catch {
      setScanFeedback({ kind: 'error', text: 'Article non trouvé' });
    }
    scanResumeTimer.current = setTimeout(() => {
      setScanFeedback(null);
      setIsScanning(true);
    }, 900);
  };

  const getPaginatedArticles = useCallback(() => {
    const start = (currentPage - 1) * itemsPerPage;
    return articles.slice(start, start + itemsPerPage);
  }, [articles, currentPage, itemsPerPage]);

  const totalPages = Math.ceil(articles.length / itemsPerPage);

  const isArticleSelected = useCallback((code: string) => selectedArticlesList.some((a) => a.code === code), [selectedArticlesList]);

  const toggleArticleSelection = useCallback((article: Article) => {
    setSelectedArticlesList((prev) => {
      const exists = prev.some((a) => a.code === article.code);
      if (exists) return prev.filter((a) => a.code !== article.code);
      return [...prev, article];
    });
  }, []);

  const selectAllOnPage = useCallback(() => {
    const pageArticles = getPaginatedArticles();
    setSelectedArticlesList((prev) => {
      const existingCodes = new Set(prev.map((a) => a.code));
      const newArticles = pageArticles.filter((a) => !existingCodes.has(a.code));
      return [...prev, ...newArticles];
    });
  }, [getPaginatedArticles]);

  const selectAllResults = useCallback(() => {
    setSelectedArticlesList((prev) => {
      const existingCodes = new Set(prev.map((a) => a.code));
      const newArticles = articles.filter((a) => !existingCodes.has(a.code));
      return [...prev, ...newArticles];
    });
  }, [articles.length]);

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
    if (selectedArticlesList.length === 0) { Alert.alert('Attention', 'Aucun article sélectionné'); return; }
    // Make sure logo is fully cached before any chunk renders.
    try { await Asset.fromModule(LOGO_ASSET).downloadAsync(); } catch { /* ignore */ }
    const CHUNK_SIZE = 6;
    const RENDER_WAIT_MS = 800;
    const total = selectedArticlesList.length;
    try {
      setGenerating(true);
      setGenerationProgress({ done: 0, total });
      const uris: string[] = [];
      for (let i = 0; i < total; i += CHUNK_SIZE) {
        const batch = selectedArticlesList.slice(i, i + CHUNK_SIZE);
        // ensure refs exist for this batch
        for (const article of batch) {
          if (!labelRefs.current.has(article.code)) {
            labelRefs.current.set(article.code, React.createRef<ViewShot | null>());
          }
        }
        setChunkArticles(batch);
        await new Promise((r) => setTimeout(r, RENDER_WAIT_MS));
        for (const article of batch) {
          const ref = labelRefs.current.get(article.code);
          try {
            const uri = await (ref?.current as ViewShot | null)?.capture?.();
            if (uri) uris.push(uri);
          } catch { /* skip */ }
          setGenerationProgress((p) => p ? { done: p.done + 1, total: p.total } : null);
        }
      }
      setChunkArticles([]);
      if (uris.length > 0) {
        const pdfUri = await generatePdfFromImages(uris);
        if (pdfUri && await Sharing.isAvailableAsync()) {
          await Sharing.shareAsync(pdfUri, { mimeType: 'application/pdf', dialogTitle: `${total} étiquettes`, UTI: 'com.adobe.pdf' });
        } else { Alert.alert('PDF créé', `${uris.length} étiquette${uris.length > 1 ? 's' : ''}`); }
      } else { Alert.alert('Erreur', 'Aucune étiquette capturée'); }
    } catch (e: any) { Alert.alert('Erreur', e?.message || 'Erreur inconnue'); }
    finally {
      setGenerating(false);
      setGenerationProgress(null);
      setChunkArticles([]);
    }
  }, [selectedArticlesList]);

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
    const isSelected = isArticleSelected(item.code);
    return (
      <Pressable
        style={({ pressed }) => [
          styles.articleCard,
          isSelected && styles.articleCardSelected,
          pressed && { opacity: 0.85 },
        ]}
        onPress={() => { setSelectedArticle(item); setShowPreview(true); }}>
        <Pressable
          hitSlop={8}
          onPress={() => toggleArticleSelection(item)}
          style={({ pressed }) => [styles.checkboxHit, pressed && { opacity: 0.6 }]}>
          <View style={[styles.checkbox, isSelected && styles.checkboxOn]}>
            {isSelected && <Text style={styles.checkmark}>✓</Text>}
          </View>
        </Pressable>
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

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Étiquettes prix</Text>
        <Text style={styles.headerSub}>
          {selectedArticlesList.length > 0
            ? `${selectedArticlesList.length} sélectionné${selectedArticlesList.length > 1 ? 's' : ''} — touchez ☐ pour cocher, l'article pour aperçu`
            : 'Recherchez un article ou scannez son code barre'}
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
          style={({ pressed }) => [styles.scanBtn, pressed && { opacity: 0.85 }]}
          onPress={openScanner}>
          <Text style={styles.scanBtnText}>Scanner</Text>
        </Pressable>
        <Pressable
          style={({ pressed }) => [styles.searchBtn, pressed && { opacity: 0.85 }]}
          onPress={handleSearch}>
          <Text style={styles.searchBtnText}>Chercher</Text>
        </Pressable>
      </View>

      {error ? <View style={styles.alertBox}><Text style={styles.alertText}>{error}</Text></View> : null}
      {(loading || generating) ? <ActivityIndicator color={Brand.ember} style={styles.loader} size="large" /> : null}

      <View style={styles.chipsRow}>
        <Pressable style={({ pressed }) => [styles.chip, pressed && { opacity: 0.7 }]} onPress={selectAllOnPage}>
          <Text style={styles.chipText}>Cocher la page</Text>
        </Pressable>
        <Pressable style={({ pressed }) => [styles.chip, pressed && { opacity: 0.7 }]} onPress={selectAllResults}>
          <Text style={styles.chipText}>Tout ({articles.length})</Text>
        </Pressable>
        {selectedArticlesList.length > 0 && (
          <Pressable style={({ pressed }) => [styles.chipDanger, pressed && { opacity: 0.7 }]} onPress={() => setSelectedArticlesList([])}>
            <Text style={styles.chipDangerText}>Effacer la sélection</Text>
          </Pressable>
        )}
      </View>

      <FlatList
        data={getPaginatedArticles()}
        renderItem={renderArticleItem}
        keyExtractor={(item) => item.code}
        style={styles.list}
        contentContainerStyle={[styles.listContent, selectedArticlesList.length > 0 && { paddingBottom: 96 }]}
        showsVerticalScrollIndicator={false}
        ListEmptyComponent={
          loading ? null : (
            <View style={styles.listEmpty}>
              <Text style={styles.listEmptyTitle}>
                {searchQuery.trim().length === 0 ? 'Aucun article chargé' : 'Aucun résultat'}
              </Text>
              <Text style={styles.listEmptySub}>
                {searchQuery.trim().length === 0
                  ? 'Tapez au moins 2 caractères pour rechercher, ou scannez un code barre.'
                  : `Aucun article ne correspond à « ${searchQuery.trim()} »`}
              </Text>
            </View>
          )
        }
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

      {selectedArticlesList.length > 0 && !generating && (
        <View style={styles.floatBar}>
          <View style={styles.floatBarInner}>
            <View style={styles.floatBarCount}>
              <Text style={styles.floatBarCountNum}>{selectedArticlesList.length}</Text>
              <Text style={styles.floatBarCountLabel}>article{selectedArticlesList.length > 1 ? 's' : ''}</Text>
            </View>
            <Pressable
              style={({ pressed }) => [styles.floatBarPrint, pressed && { opacity: 0.85 }]}
              onPress={handlePrintAllLabels}>
              <Text style={styles.floatBarPrintText}>Générer PDF</Text>
            </Pressable>
          </View>
        </View>
      )}

      {generating && generationProgress && (
        <View style={styles.floatBar}>
          <View style={styles.floatBarInner}>
            <View style={styles.floatBarCount}>
              <ActivityIndicator color="#FFFFFF" />
              <Text style={[styles.floatBarCountLabel, { marginLeft: 8 }]}>
                Capture {generationProgress.done} / {generationProgress.total}
              </Text>
            </View>
            <View style={styles.floatBarPrint}>
              <Text style={styles.floatBarPrintText}>
                {Math.round((generationProgress.done / generationProgress.total) * 100)}%
              </Text>
            </View>
          </View>
        </View>
      )}

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

      {chunkArticles.length > 0 && (
        <View style={{ position: 'absolute', left: -9999, top: 0, width: 410 }}>
          {chunkArticles.map((article) => {
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

      <Modal visible={showScanner} animationType="slide" statusBarTranslucent onRequestClose={() => setShowScanner(false)}>
        <View style={scannerStyles.cameraModal}>
          <View style={[scannerStyles.cameraHeader, { paddingTop: insets.top + 12 }]}>
            <View style={{ flex: 1 }}>
              <Text style={scannerStyles.cameraTitle}>Scanner</Text>
              <Text style={scannerStyles.cameraSubtitle}>
                {selectedArticlesList.length > 0
                  ? `${selectedArticlesList.length} article${selectedArticlesList.length > 1 ? 's' : ''} dans la sélection`
                  : 'Scannez plusieurs codes à la suite'}
              </Text>
            </View>
            <Pressable style={scannerStyles.cameraCloseBtn} onPress={() => setShowScanner(false)}>
              <Text style={scannerStyles.cameraCloseBtnText}>
                {selectedArticlesList.length > 0 ? `Terminé (${selectedArticlesList.length})` : 'Fermer'}
              </Text>
            </Pressable>
          </View>
          <View style={scannerStyles.cameraBody}>
            <CameraView
              style={scannerStyles.camera}
              facing="back"
              barcodeScannerSettings={{ barcodeTypes: ['qr', 'ean13', 'ean8', 'code128', 'code39'] }}
              onBarcodeScanned={isScanning ? (b) => { if (b.data) handleScanResult(b.data); } : undefined}
            />
            <View style={scannerStyles.scanOverlay} pointerEvents="none">
              <View style={scannerStyles.scanFrame}>
                <View style={[scannerStyles.scanCorner, scannerStyles.scanCornerTL]} />
                <View style={[scannerStyles.scanCorner, scannerStyles.scanCornerTR]} />
                <View style={[scannerStyles.scanCorner, scannerStyles.scanCornerBL]} />
                <View style={[scannerStyles.scanCorner, scannerStyles.scanCornerBR]} />
              </View>
              <Text style={scannerStyles.scanHint}>
                {scanFeedback ? '' : 'Pointez vers le code barre'}
              </Text>
            </View>
            {scanFeedback && (
              <View pointerEvents="none" style={scannerStyles.feedbackWrap}>
                <View style={[
                  scannerStyles.feedbackPill,
                  scanFeedback.kind === 'added' && scannerStyles.feedbackPillAdded,
                  scanFeedback.kind === 'duplicate' && scannerStyles.feedbackPillDuplicate,
                  scanFeedback.kind === 'error' && scannerStyles.feedbackPillError,
                ]}>
                  <Text style={scannerStyles.feedbackIcon}>
                    {scanFeedback.kind === 'added' ? '✓' : scanFeedback.kind === 'duplicate' ? '•' : '!'}
                  </Text>
                  <Text style={scannerStyles.feedbackText} numberOfLines={1}>{scanFeedback.text}</Text>
                </View>
              </View>
            )}
          </View>
        </View>
      </Modal>
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

  chipsRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, paddingHorizontal: 14, paddingBottom: 10 },
  chip: { backgroundColor: '#F0F0F0', borderRadius: 999, paddingHorizontal: 14, paddingVertical: 8 },
  chipText: { fontSize: 13, color: Brand.ink, fontWeight: '500' },
  chipDanger: { backgroundColor: '#FFEBEE', borderRadius: 999, paddingHorizontal: 14, paddingVertical: 8 },
  chipDangerText: { fontSize: 13, color: Brand.danger, fontWeight: '600' },

  floatBar: {
    position: 'absolute',
    left: 12,
    right: 12,
    bottom: 12,
    backgroundColor: Brand.ink,
    borderRadius: 18,
    paddingHorizontal: 14,
    paddingVertical: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.22,
    shadowRadius: 16,
    elevation: 12,
  },
  floatBarInner: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  floatBarCount: { flexDirection: 'row', alignItems: 'baseline', gap: 6, paddingLeft: 6 },
  floatBarCountNum: { color: '#FFFFFF', fontSize: 22, fontWeight: '800' },
  floatBarCountLabel: { color: 'rgba(255,255,255,0.75)', fontSize: 13, fontWeight: '500' },
  floatBarPrint: { backgroundColor: Brand.ember, borderRadius: 12, paddingHorizontal: 18, paddingVertical: 11 },
  floatBarPrintText: { color: '#FFFFFF', fontSize: 14, fontWeight: '700' },

  list: { flex: 1 },
  listContent: { paddingHorizontal: 14, paddingBottom: 16 },
  listEmpty: { alignItems: 'center', paddingVertical: 56, gap: 8, paddingHorizontal: 32 },
  listEmptyTitle: { fontSize: 16, fontWeight: '700', color: Brand.ink },
  listEmptySub: { fontSize: 13, color: Brand.muted, textAlign: 'center', lineHeight: 18 },
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
  checkboxHit: { paddingVertical: 4, paddingRight: 10, paddingLeft: 2 },
  checkbox: { width: 24, height: 24, borderRadius: 7, borderWidth: 2, borderColor: '#D0D0D0', alignItems: 'center', justifyContent: 'center' },
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
  scanBtn: { backgroundColor: Brand.ember, borderRadius: 12, paddingHorizontal: 14, justifyContent: 'center' },
  scanBtnText: { color: '#FFFFFF', fontSize: 14, fontWeight: '600' },
});

const scannerStyles = StyleSheet.create({
  cameraModal: { flex: 1, backgroundColor: '#0A0A0A' },
  cameraHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingBottom: 16,
    backgroundColor: Brand.ink,
  },
  cameraTitle: { color: '#FFFFFF', fontSize: 18, fontWeight: '600' },
  cameraSubtitle: { color: 'rgba(255,255,255,0.65)', fontSize: 12, marginTop: 2 },
  cameraCloseBtn: { backgroundColor: 'rgba(255,255,255,0.15)', borderRadius: 8, paddingVertical: 7, paddingHorizontal: 14, marginLeft: 12 },
  cameraCloseBtnText: { color: '#FFFFFF', fontSize: 14, fontWeight: '500' },
  cameraBody: { flex: 1, position: 'relative' },
  camera: { flex: 1 },
  scanOverlay: { ...StyleSheet.absoluteFillObject, justifyContent: 'center', alignItems: 'center', gap: 24 },
  feedbackWrap: { position: 'absolute', left: 0, right: 0, bottom: 60, alignItems: 'center' },
  feedbackPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 18,
    paddingVertical: 12,
    borderRadius: 999,
    maxWidth: '85%',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
  },
  feedbackPillAdded: { backgroundColor: '#1FA871' },
  feedbackPillDuplicate: { backgroundColor: '#3C3C3C' },
  feedbackPillError: { backgroundColor: Brand.danger },
  feedbackIcon: { fontSize: 16, fontWeight: '800', color: '#FFFFFF' },
  feedbackText: { fontSize: 14, fontWeight: '600', color: '#FFFFFF', flexShrink: 1 },
  scanFrame: { width: 280, height: 180, position: 'relative' },
  scanCorner: { position: 'absolute', width: 24, height: 24, borderColor: Brand.ember, borderRadius: 4 },
  scanCornerTL: { top: 0, left: 0, borderTopWidth: 4, borderLeftWidth: 4 },
  scanCornerTR: { top: 0, right: 0, borderTopWidth: 4, borderRightWidth: 4 },
  scanCornerBL: { bottom: 0, left: 0, borderBottomWidth: 4, borderLeftWidth: 4 },
  scanCornerBR: { bottom: 0, right: 0, borderBottomWidth: 4, borderRightWidth: 4 },
  scanHint: { color: 'rgba(255,255,255,0.8)', fontSize: 15, textAlign: 'center', fontWeight: '500' },
});
