import { useRef, useState } from 'react'
import jsQR from 'jsqr'
import { api } from '../services/api.js'

export default function NfeImportModal({
  categories = [],
  onClose,
  onImportSuccess,
}) {
  const [activeTab, setActiveTab] = useState('photo') // 'photo' | 'url' | 'xml' | 'text'
  const [loading, setLoading] = useState(false)
  const [loadingProgress, setLoadingProgress] = useState('')
  const [error, setError] = useState('')

  // Dados extraídos e prontos para conferência
  const [parsedData, setParsedData] = useState(null)
  const [storeName, setStoreName] = useState('')
  const [notes, setNotes] = useState('')
  const [items, setItems] = useState([])

  const fileInputRef = useRef(null)
  const xmlInputRef = useRef(null)

  // 1. Processar Foto / Print (Dual: QR Code Detector + OCR)
  async function handleImageFile(file) {
    if (!file) return
    setError('')
    setLoading(true)
    setLoadingProgress('Carregando imagem do cupom...')

    try {
      const imageUrl = URL.createObjectURL(file)
      const img = new Image()

      await new Promise((resolve, reject) => {
        img.onload = resolve
        img.onerror = () => reject(new Error('Não foi possível carregar a imagem selecionada.'))
        img.src = imageUrl
      })

      // PASSO 1: Tentar ler QR Code na imagem (Decodificação ultra-rápida via jsQR)
      setLoadingProgress('Procurando QR Code da SEFAZ na foto...')
      const canvas = document.createElement('canvas')
      const ctx = canvas.getContext('2d')

      // Redimensionar canvas para resolução ideal de leitura
      const maxDim = 1600
      let { width, height } = img
      if (width > maxDim || height > maxDim) {
        if (width > height) {
          height = Math.round((height * maxDim) / width)
          width = maxDim
        } else {
          width = Math.round((width * maxDim) / height)
          height = maxDim
        }
      }

      canvas.width = width
      canvas.height = height
      ctx.drawImage(img, 0, 0, width, height)

      const imgData = ctx.getImageData(0, 0, width, height)
      const qrCode = jsQR(imgData.data, width, height, { inversionAttempts: 'attemptBoth' })

      if (qrCode && qrCode.data && qrCode.data.startsWith('http')) {
        setLoadingProgress('⚡ QR Code identificado! Consultando dados oficiais da SEFAZ...')
        try {
          const sefazResult = await api.parseNfeUrl(qrCode.data)
          populateParsedData(sefazResult, 'QR Code da SEFAZ')
          setLoading(false)
          return
        } catch (sefazErr) {
          console.warn('Falha na consulta da SEFAZ via QR Code, tentando OCR...', sefazErr)
        }
      }

      // PASSO 2: Se não achou QR Code ou a SEFAZ falhou, executar OCR no texto impresso
      setLoadingProgress('Lendo texto do cupom fiscal com OCR (aguarde alguns instantes)...')
      const { createWorker } = await import('tesseract.js')
      const worker = await createWorker('por')

      const ocrResult = await worker.recognize(canvas)
      await worker.terminate()

      const text = ocrResult?.data?.text || ''
      if (!text.trim()) {
        throw new Error('Não foi possível reconhecer o texto na foto. Certifique-se de que a foto está nítida e bem iluminada.')
      }

      setLoadingProgress('Estruturando itens e valores do cupom...')
      const textResult = await api.parseNfeText(text)
      populateParsedData(textResult, 'Foto / OCR')
    } catch (err) {
      setError(err.message || 'Erro ao processar imagem do cupom.')
    } finally {
      setLoading(false)
      setLoadingProgress('')
    }
  }

  // 2. Processar URL do QR Code
  async function handleUrlSubmit(url) {
    if (!url || !url.trim()) {
      setError('Informe o link do QR Code da NFC-e.')
      return
    }

    setError('')
    setLoading(true)
    setLoadingProgress('Consultando portal oficial da SEFAZ...')

    try {
      const result = await api.parseNfeUrl(url.trim())
      populateParsedData(result, 'Link SEFAZ')
    } catch (err) {
      setError(err.message || 'Erro ao consultar a SEFAZ. Verifique o link ou tente tirar uma foto do cupom.')
    } finally {
      setLoading(false)
      setLoadingProgress('')
    }
  }

  // 3. Processar Arquivo XML
  async function handleXmlFile(file) {
    if (!file) return
    setError('')
    setLoading(true)
    setLoadingProgress('Lendo arquivo XML da NF-e...')

    try {
      const xmlText = await file.text()
      const result = await api.parseNfeXml(xmlText)
      populateParsedData(result, 'Arquivo XML')
    } catch (err) {
      setError(err.message || 'Erro ao ler arquivo XML da NF-e.')
    } finally {
      setLoading(false)
      setLoadingProgress('')
    }
  }

  // 4. Processar Texto Colado
  async function handleTextSubmit(text) {
    if (!text || !text.trim()) {
      setError('Cole o texto do cupom fiscal.')
      return
    }

    setError('')
    setLoading(true)
    setLoadingProgress('Identificando produtos e valores...')

    try {
      const result = await api.parseNfeText(text.trim())
      populateParsedData(result, 'Texto Colado')
    } catch (err) {
      setError(err.message || 'Erro ao interpretar o texto do cupom.')
    } finally {
      setLoading(false)
      setLoadingProgress('')
    }
  }

  // Popula os dados na tabela de conferência
  function populateParsedData(data, sourceLabel) {
    setParsedData({
      ...data,
      sourceLabel,
    })
    setStoreName(data.storeName || 'Supermercado')
    setNotes(
      data.invoiceNumber
        ? `Nota Fiscal #${data.invoiceNumber} (${sourceLabel})`
        : `Cupom Fiscal importado via ${sourceLabel}`
    )

    // Formatar itens para edição
    const formattedItems = (data.items || []).map((it, idx) => ({
      id: `parsed-${idx}-${Date.now()}`,
      productId: it.productId || null,
      name: it.name,
      barcode: it.barcode || it.code || '',
      quantity: Number(it.quantity) || 1,
      unit: it.unit || 'un',
      unitPrice: Number(it.unitPrice) || 0,
      previousUnitPrice: Number(it.previousUnitPrice) || Number(it.unitPrice) || 0,
      totalPrice: Number(it.totalPrice) || Number(it.quantity) * Number(it.unitPrice),
      categoryId: it.categoryId || categories[0]?.id || null,
      categoryName: it.categoryName || categories[0]?.name || 'Alimentos',
      categoryColor: it.categoryColor || '#3b82f6',
      isExisting: it.isExisting || false,
      currentStock: it.currentStock || 0,
    }))

    setItems(formattedItems)
  }

  // Ações na tabela de itens
  function handleUpdateItem(id, field, value) {
    setItems((prev) =>
      prev.map((it) => {
        if (it.id !== id) return it
        const updated = { ...it, [field]: value }

        if (field === 'quantity' || field === 'unitPrice') {
          const q = Number(field === 'quantity' ? value : updated.quantity) || 0
          const p = Number(field === 'unitPrice' ? value : updated.unitPrice) || 0
          updated.totalPrice = Number((q * p).toFixed(2))
        }

        if (field === 'categoryId') {
          const cat = categories.find((c) => c.id === Number(value))
          if (cat) {
            updated.categoryName = cat.name
            updated.categoryColor = cat.color
          }
        }

        return updated
      })
    )
  }

  function handleRemoveItem(id) {
    setItems((prev) => prev.filter((it) => it.id !== id))
  }

  function handleAddNewItem() {
    setItems((prev) => [
      ...prev,
      {
        id: `parsed-manual-${Date.now()}`,
        productId: null,
        name: 'Novo Item',
        barcode: '',
        quantity: 1,
        unit: 'un',
        unitPrice: 0,
        previousUnitPrice: 0,
        totalPrice: 0,
        categoryId: categories[0]?.id || null,
        categoryName: categories[0]?.name || 'Geral',
        categoryColor: categories[0]?.color || '#3b82f6',
        isExisting: false,
        currentStock: 0,
      },
    ])
  }

  // Totalizador da nota
  const computedTotal = items.reduce((acc, it) => acc + (Number(it.totalPrice) || 0), 0)
  const computedUnits = items.reduce((acc, it) => acc + (Number(it.quantity) || 0), 0)

  // Finalizar e enviar para o estoque (chama atomicamente POST /api/purchases)
  async function handleConfirmImport() {
    if (items.length === 0) {
      setError('A lista de itens está vazia.')
      return
    }

    setLoading(true)
    setError('')
    try {
      const payload = {
        store_name: storeName.trim() || 'Supermercado',
        notes: notes.trim() || 'Importação de Cupom Fiscal',
        items: items.map((it) => ({
          product_id: it.productId,
          name: it.name,
          barcode: it.barcode,
          quantity: it.quantity,
          unit_price: it.unitPrice,
          previous_unit_price: it.previousUnitPrice,
          category_id: it.categoryId,
        })),
      }

      await onImportSuccess(payload)
      onClose()
    } catch (err) {
      setError(`Erro ao salvar compra: ${err.message}`)
      setLoading(false)
    }
  }

  return (
    <div className="modal-backdrop" role="dialog" aria-modal="true">
      <div className="modal-card modal-xl nfe-modal">
        <div className="modal-header">
          <div>
            <h2>🧾 Importador de NF-e & Cupons Fiscais</h2>
            <p>
              Importe itens de compras direto para o estoque via foto do cupom, link do QR Code da SEFAZ ou arquivo XML.
            </p>
          </div>
          <button type="button" className="btn-close" onClick={onClose} aria-label="Fechar">
            ×
          </button>
        </div>

        <div className="modal-body">
          {error && <div className="form-error mb-4">{error}</div>}

          {/* Se ainda não processou uma nota, exibe as opções de importação */}
          {!parsedData ? (
            <div className="nfe-tabs-container">
              <div className="nfe-nav-tabs">
                <button
                  type="button"
                  className={`nfe-tab-btn ${activeTab === 'photo' ? 'active' : ''}`}
                  onClick={() => setActiveTab('photo')}
                >
                  📸 Foto / Print do Cupom
                </button>
                <button
                  type="button"
                  className={`nfe-tab-btn ${activeTab === 'url' ? 'active' : ''}`}
                  onClick={() => setActiveTab('url')}
                >
                  🔗 Link do QR Code (SEFAZ)
                </button>
                <button
                  type="button"
                  className={`nfe-tab-btn ${activeTab === 'xml' ? 'active' : ''}`}
                  onClick={() => setActiveTab('xml')}
                >
                  📄 Arquivo XML da NF-e
                </button>
                <button
                  type="button"
                  className={`nfe-tab-btn ${activeTab === 'text' ? 'active' : ''}`}
                  onClick={() => setActiveTab('text')}
                >
                  📝 Colar Texto do Cupom
                </button>
              </div>

              <div className="nfe-tab-content">
                {/* ABA 1: Foto / Print */}
                {activeTab === 'photo' && (
                  <div className="nfe-dropzone-box">
                    <div className="dropzone-icon">📷</div>
                    <h3>Tire uma Foto ou Selecione o Print do Cupom Fiscal</h3>
                    <p>
                      O sistema detectará automaticamente se há um <strong>QR Code da SEFAZ</strong> na foto para buscar os dados eletrônicos oficiais.
                      Se não houver QR Code visível, faremos a <strong>leitura ótica inteligente (OCR)</strong> dos itens impressos!
                    </p>

                    <input
                      type="file"
                      ref={fileInputRef}
                      accept="image/*"
                      capture="environment"
                      style={{ display: 'none' }}
                      onChange={(e) => {
                        const file = e.target.files?.[0]
                        if (file) handleImageFile(file)
                      }}
                    />

                    <div className="dropzone-actions">
                      <button
                        type="button"
                        className="btn btn-primary btn-lg"
                        disabled={loading}
                        onClick={() => fileInputRef.current?.click()}
                      >
                        {loading ? 'Processando imagem...' : 'Escolher Imagem / Tirar Foto 📸'}
                      </button>
                    </div>

                    <small className="text-muted mt-3">
                      Dica: Centralize bem os itens do cupom fiscal ou a área do QR Code para melhor leitura.
                    </small>
                  </div>
                )}

                {/* ABA 2: Link do QR Code */}
                {activeTab === 'url' && (
                  <form
                    onSubmit={(e) => {
                      e.preventDefault()
                      const input = e.target.elements.sefazUrl.value
                      handleUrlSubmit(input)
                    }}
                    className="nfe-url-box"
                  >
                    <div className="url-icon">⚡</div>
                    <h3>Cole o Link do QR Code da NFC-e</h3>
                    <p>
                      Ao apontar a câmera do celular para o QR Code da nota fiscal, copie o link que o navegador abre e cole abaixo.
                    </p>

                    <div className="url-input-group">
                      <input
                        type="url"
                        name="sefazUrl"
                        className="input-field"
                        placeholder="Ex: https://www.nfce.fazenda.sp.gov.br/... ou http://nfce.fazenda.mg.gov.br/..."
                        required
                        disabled={loading}
                      />
                      <button
                        type="submit"
                        className="btn btn-primary"
                        disabled={loading}
                      >
                        {loading ? 'Consultando...' : 'Consultar SEFAZ 🔍'}
                      </button>
                    </div>
                  </form>
                )}

                {/* ABA 3: Arquivo XML */}
                {activeTab === 'xml' && (
                  <div className="nfe-dropzone-box">
                    <div className="dropzone-icon">📄</div>
                    <h3>Importar Arquivo XML da NF-e / NFC-e</h3>
                    <p>
                      Se você baixou o arquivo <code>.xml</code> da nota fiscal no portal da fazenda ou recebeu por e-mail, selecione-o aqui para importação instantânea com 100% de precisão.
                    </p>

                    <input
                      type="file"
                      ref={xmlInputRef}
                      accept=".xml,text/xml"
                      style={{ display: 'none' }}
                      onChange={(e) => {
                        const file = e.target.files?.[0]
                        if (file) handleXmlFile(file)
                      }}
                    />

                    <div className="dropzone-actions">
                      <button
                        type="button"
                        className="btn btn-primary btn-lg"
                        disabled={loading}
                        onClick={() => xmlInputRef.current?.click()}
                      >
                        {loading ? 'Lendo XML...' : 'Selecionar Arquivo .XML 📂'}
                      </button>
                    </div>
                  </div>
                )}

                {/* ABA 4: Colar Texto */}
                {activeTab === 'text' && (
                  <form
                    onSubmit={(e) => {
                      e.preventDefault()
                      const text = e.target.elements.rawText.value
                      handleTextSubmit(text)
                    }}
                    className="nfe-text-box"
                  >
                    <h3>Colar Texto do Cupom Fiscal</h3>
                    <p>Cole as linhas contendo a descrição dos produtos, quantidades e preços:</p>
                    <textarea
                      name="rawText"
                      className="input-field textarea-nfe"
                      rows="8"
                      placeholder={`Exemplo:\nMERCADINHO DO ZE\n001 ALCATRA BOVINA 0,850 KG X 49,90 = 42,42\n002 PAO FRANCES 10 UN X 0,95 = 9,50\nTOTAL R$ 51,92`}
                      disabled={loading}
                      required
                    />
                    <button
                      type="submit"
                      className="btn btn-primary mt-3"
                      disabled={loading}
                    >
                      {loading ? 'Processando...' : 'Interpretar Texto 📝'}
                    </button>
                  </form>
                )}

                {loading && (
                  <div className="nfe-loading-overlay">
                    <div className="spinner" />
                    <p className="loading-text">{loadingProgress}</p>
                  </div>
                )}
              </div>
            </div>
          ) : (
            /* TELA DE REVISÃO E CONFERÊNCIA PRÉ-ESTOQUE */
            <div className="nfe-review-screen">
              <div className="review-meta-bar">
                <div className="form-group flex-2">
                  <label htmlFor="nfe-store-name">Estabelecimento / Supermercado</label>
                  <input
                    id="nfe-store-name"
                    type="text"
                    className="input-field"
                    value={storeName}
                    onChange={(e) => setStoreName(e.target.value)}
                  />
                </div>

                <div className="form-group flex-3">
                  <label htmlFor="nfe-notes">Observações da Compra</label>
                  <input
                    id="nfe-notes"
                    type="text"
                    className="input-field"
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                  />
                </div>

                <div className="review-source-tag">
                  <small>Origem:</small>
                  <span className="badge-pill">{parsedData.sourceLabel}</span>
                </div>
              </div>

              <div className="review-table-container">
                <table className="erp-table review-table">
                  <thead>
                    <tr>
                      <th>Produto / Descrição</th>
                      <th style={{ width: '130px' }}>Código / EAN</th>
                      <th style={{ width: '170px' }}>Categoria</th>
                      <th style={{ width: '110px' }}>Qtd</th>
                      <th style={{ width: '130px' }}>Preço Unit. (R$)</th>
                      <th style={{ width: '130px', textAlign: 'right' }}>Total (R$)</th>
                      <th style={{ width: '50px' }}></th>
                    </tr>
                  </thead>
                  <tbody>
                    {items.map((item) => (
                      <tr key={item.id}>
                        <td>
                          <input
                            type="text"
                            className="input-inline"
                            value={item.name}
                            onChange={(e) => handleUpdateItem(item.id, 'name', e.target.value)}
                          />
                          <div className="item-stock-status">
                            {item.isExisting ? (
                              <span className="badge-success-sm" title="Produto já existe no seu estoque">
                                🟢 Já no estoque (atual: {item.currentStock} {item.unit})
                              </span>
                            ) : (
                              <span className="badge-new-sm" title="Será cadastrado como novo produto">
                                🆕 Novo produto
                              </span>
                            )}
                          </div>
                        </td>

                        <td>
                          <input
                            type="text"
                            className="input-inline mono"
                            placeholder="Sem EAN"
                            value={item.barcode}
                            onChange={(e) => handleUpdateItem(item.id, 'barcode', e.target.value)}
                          />
                        </td>

                        <td>
                          <select
                            className="input-inline"
                            value={item.categoryId || ''}
                            onChange={(e) => handleUpdateItem(item.id, 'categoryId', e.target.value)}
                          >
                            {categories.map((c) => (
                              <option key={c.id} value={c.id}>
                                {c.name}
                              </option>
                            ))}
                          </select>
                        </td>

                        <td>
                          <div className="qty-unit-cell">
                            <input
                              type="number"
                              step="any"
                              min="0.01"
                              className="input-inline qty-num"
                              value={item.quantity}
                              onChange={(e) => handleUpdateItem(item.id, 'quantity', e.target.value)}
                            />
                            <span className="unit-label">{item.unit}</span>
                          </div>
                        </td>

                        <td>
                          <input
                            type="number"
                            step="0.01"
                            min="0"
                            className="input-inline text-right"
                            value={item.unitPrice}
                            onChange={(e) => handleUpdateItem(item.id, 'unitPrice', e.target.value)}
                          />
                        </td>

                        <td style={{ textAlign: 'right' }}>
                          <strong className="item-total-val">
                            R$ {Number(item.totalPrice).toFixed(2)}
                          </strong>
                        </td>

                        <td>
                          <button
                            type="button"
                            className="btn-icon-danger"
                            title="Remover item"
                            onClick={() => handleRemoveItem(item.id)}
                          >
                            🗑️
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <div className="review-footer-bar">
                <button
                  type="button"
                  className="btn btn-secondary btn-sm"
                  onClick={handleAddNewItem}
                >
                  + Adicionar Outro Item Manualmente
                </button>

                <div className="review-totals">
                  <div className="totals-info">
                    <span>
                      Total: <strong>{items.length} itens</strong> ({computedUnits.toFixed(2)} un)
                    </span>
                    <strong className="grand-total">
                      R$ {computedTotal.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </strong>
                  </div>

                  <div className="review-actions">
                    <button
                      type="button"
                      className="btn btn-secondary"
                      onClick={() => setParsedData(null)}
                      disabled={loading}
                    >
                      Ler Outro Cupom
                    </button>
                    <button
                      type="button"
                      className="btn btn-success btn-lg"
                      onClick={handleConfirmImport}
                      disabled={loading || items.length === 0}
                    >
                      {loading ? 'Salvando...' : '✅ Confirmar e Enviar para o Estoque'}
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

