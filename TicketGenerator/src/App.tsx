import { useState, useEffect } from 'react'
import './App.css'

interface Article {
  code: string
  designation: string
  prix: number | null
  base_ht: number | null
}

interface TicketItem extends Article {
  quantity: number
}

const API_BASE_URL = 'https://telia-maddox-vermiform.ngrok-free.dev'

function App() {
  const [articles, setArticles] = useState<Article[]>([])
  const [selectedItems, setSelectedItems] = useState<TicketItem[]>([])
  const [activeTab, setActiveTab] = useState<'articles' | 'ticket'>('articles')
  const [loading, setLoading] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')

  useEffect(() => {
    loadArticles()
  }, [])

  const loadArticles = async (query = '') => {
    setLoading(true)
    try {
      const url = query 
        ? `${API_BASE_URL}/articles/search?q=${encodeURIComponent(query)}`
        : `${API_BASE_URL}/articles`
      const response = await fetch(url)
      const data = await response.json()
      
      if (query) {
        setArticles(data.data || [])
      } else {
        const allArticles: Article[] = []
        if (data.data) {
          for (const bl of data.data) {
            const refs = bl.references || []
            for (const ref of refs) {
              try {
                const artRes = await fetch(`${API_BASE_URL}/articles/${encodeURIComponent(ref)}`)
                const artData = await artRes.json()
                if (artData) allArticles.push(artData)
              } catch {}
            }
          }
        }
        setArticles(allArticles)
      }
    } catch (error) {
      console.error('Failed to load articles:', error)
    } finally {
      setLoading(false)
    }
  }

  const searchArticles = async () => {
    if (searchQuery.length < 2) {
      loadArticles()
      return
    }
    await loadArticles(searchQuery)
  }

  const toggleArticle = (article: Article) => {
    const exists = selectedItems.find(item => item.code === article.code)
    if (exists) {
      setSelectedItems(selectedItems.map(item => 
        item.code === article.code 
          ? { ...item, quantity: item.quantity + 1 }
          : item
      ))
    } else {
      setSelectedItems([...selectedItems, { ...article, quantity: 1 }])
    }
  }

  const calculateSubtotal = (item: TicketItem) => {
    return (item.prix || 0) * item.quantity
  }

  const totalHT = selectedItems.reduce((sum, item) => {
    return sum + ((item.base_ht || 0) * item.quantity)
  }, 0)

  const totalTTC = selectedItems.reduce((sum, item) => {
    return sum + calculateSubtotal(item)
  }, 0)

  const handlePrint = () => {
    window.print()
  }

  return (
    <div className="app">
      <header className="header">
        <h1>Générateur de Tickets</h1>
        <div className="tab-buttons">
          <button 
            className={activeTab === 'articles' ? 'active' : ''} 
            onClick={() => setActiveTab('articles')}
          >
            Articles ({selectedItems.length})
          </button>
          <button 
            className={activeTab === 'ticket' ? 'active' : ''} 
            onClick={() => setActiveTab('ticket')}
          >
            Ticket
          </button>
        </div>
      </header>

      {activeTab === 'articles' && (
        <section className="articles-section">
          <div className="search-bar">
            <input
              type="text"
              placeholder="Rechercher un article..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && searchArticles()}
            />
            <button onClick={searchArticles}>Rechercher</button>
          </div>

          {loading ? (
            <div className="loading">Chargement...</div>
          ) : (
            <div className="articles-list">
              {articles.map((article, idx) => (
                <div 
                  key={article.code + idx} 
                  className={`article-card ${selectedItems.find(i => i.code === article.code) ? 'selected' : ''}`}
                  onClick={() => toggleArticle(article)}
                >
                  <div className="article-info">
                    <span className="article-code">{article.code}</span>
                    <span className="article-name">{article.designation}</span>
                  </div>
                  <div className="article-prices">
                    <span className="price-ttc">{article.prix?.toFixed(2)} € TTC</span>
                    <span className="price-ht">{article.base_ht?.toFixed(2)} € HT</span>
                  </div>
                </div>
              ))}
              {articles.length === 0 && (
                <div className="no-results">Aucun article trouvé</div>
              )}
            </div>
          )}
        </section>
      )}

      {activeTab === 'ticket' && (
        <section className="ticket-section">
          {selectedItems.length === 0 ? (
            <div className="empty-cart">
              <p>Aucun article sélectionné</p>
              <button onClick={() => setActiveTab('articles')}>
                Aller aux articles
              </button>
            </div>
          ) : (
            <>
              <div className="ticket-preview">
                <div className="ticket-header">
                  <h2>TICKET</h2>
                  <span>{new Date().toLocaleDateString('fr-FR')}</span>
                  <span>{new Date().toLocaleTimeString('fr-FR')}</span>
                </div>
                
                <table className="ticket-items">
                  <thead>
                    <tr>
                      <th>Article</th>
                      <th>Qté</th>
                      <th>Prix TTC</th>
                      <th>Total</th>
                    </tr>
                  </thead>
                  <tbody>
                    {selectedItems.map(item => (
                      <tr key={item.code}>
                        <td>
                          <div className="item-name">{item.designation}</div>
                          <div className="item-code">{item.code}</div>
                        </td>
                        <td className="qty">{item.quantity}</td>
                        <td className="price">{(item.prix || 0).toFixed(2)} €</td>
                        <td className="total">{calculateSubtotal(item).toFixed(2)} €</td>
                      </tr>
                    ))}
                  </tbody>
                </table>

                <div className="ticket-totals">
                  <div className="total-row">
                    <span>Total HT</span>
                    <span>{totalHT.toFixed(2)} €</span>
                  </div>
                  <div className="total-row">
                    <span>TVA (20%)</span>
                    <span>{(totalTTC - totalHT).toFixed(2)} €</span>
                  </div>
                  <div className="total-row grand-total">
                    <span>Total TTC</span>
                    <span>{totalTTC.toFixed(2)} €</span>
                  </div>
                </div>
              </div>

              <div className="ticket-actions no-print">
                <button className="btn-print" onClick={handlePrint}>
                  Imprimer le ticket
                </button>
                <button className="btn-clear" onClick={() => setSelectedItems([])}>
                  Tout effacer
                </button>
              </div>
            </>
          )}
        </section>
      )}

      {selectedItems.length > 0 && activeTab === 'articles' && (
        <div className="floating-cart" onClick={() => setActiveTab('ticket')}>
          <span className="cart-count">{selectedItems.length}</span>
          <span>Voir le ticket</span>
        </div>
      )}
    </div>
  )
}

export default App