import { useMemo, useState } from 'react'
import BarcodeScannerModal from './BarcodeScannerModal.jsx'
import NfeImportModal from './NfeImportModal.jsx'

export default function MarketModeView({
  products = [],
  categories = [],
  onFinishPurchase,
  onNavigate,
}) {
  const [storeName, setStoreName] = useState('Supermercado')
  const [notes, setNotes] = useState('')
  const [cartItems, setCartItems] = useState([])
  const [searchQuery, setSearchQuery] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [finishedSummary, setFinishedSummary] = useState(null)
  const [nfeModalOpen, setNfeModalOpen] = useState(false)
  const [scannerOpen, setScannerOpen] = useState(false)
  const [scanFeedback, setScanFeedback] = useState(null)

  // Itens em estoque baixo para recomendação de reposição
  const lowStockProducts = useMemo(() => {
    return products.filter((p) => Number(p.quantity) <= Number(p.min_quantity))
  }, [products])

  // Produtos filtrados na busca rápida
  const filteredCatalog = useMemo(() => {
    if (!searchQuery.trim()) return []
    const q = searchQuery.toLowerCase().trim()
    return products
      .filter(
        (p) =>
          p.name.toLowerCase().includes(q) ||
          (p.barcode && p.barcode.toLowerCase().includes(q)) ||
          (p.sku && p.sku.toLowerCase().includes(q))
      )
      .slice(0, 8)
  }, [searchQuery, products])

  // Adicionar produto existente ao carrinho
  function handleAddToCart(product, scannedCode = '') {
    const existingIndex = cartItems.findIndex((it) => it.product_id === product.id)
    if (existingIndex >= 0) {
      setCartItems((prev) => {
        const copy = [...prev]
        copy[existingIndex].quantity = String((Number(String(copy[existingIndex].quantity).replace(',', '.')) || 0) + 1)
        return copy
      })
    } else {
      const neededQty = Math.max(1, Number(product.min_quantity) - Number(product.quantity))
      const unitPrice = Number(product.unit_price) || 0
      const prevPrice = Number(product.previous_unit_price) || unitPrice

      setCartItems((prev) => [
        ...prev,
        {
          id: `item-${Date.now()}-${Math.random()}`,
          product_id: product.id,
          name: product.name,
          barcode: scannedCode || product.barcode || '',
          category_id: product.category_id,
          category_name: product.category_name,
          category_color: product.category_color,
          quantity: String(neededQty),
          unit_price: unitPrice > 0 ? String(unitPrice) : '',
          previous_unit_price: prevPrice,
          unit: product.unit || 'un',
        },
      ])
    }
    setSearchQuery('')
  }

  // Tratador do leitor de código de barras pela câmera
  function handleBarcodeScanned(barcode) {
    setScannerOpen(false)
    const cleanBarcode = barcode.trim()

    // Procura o produto no catálogo
    const normalizeMarket = (value) => value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim().replace(/\s+/g, ' ').toUpperCase()
    const marketKey = normalizeMarket(storeName || 'Supermercado')
    const aliasMatches = (product) => product.identifiers?.some((identifier) =>
      identifier.code?.trim() === cleanBarcode && normalizeMarket(identifier.market_name) === marketKey
    )
    const codeIsStoreScoped = products.some((product) =>
      product.identifiers?.some((identifier) => identifier.code?.trim() === cleanBarcode)
    )
    const matched = products.find(aliasMatches) || (!codeIsStoreScoped && products.find((product) =>
      product.barcode?.trim() === cleanBarcode || product.sku?.trim() === cleanBarcode
    ))

    if (matched) {
      handleAddToCart(matched, cleanBarcode)
      setScanFeedback({
        type: 'found',
        message: `✅ "${matched.name}" adicionado ao carrinho! Preço anterior: R$ ${Number(matched.unit_price || 0).toFixed(2)}`,
      })
    } else {
      // Produto novo/inédito
      setCartItems((prev) => [
        ...prev,
        {
          id: `item-${Date.now()}-${Math.random()}`,
          product_id: null,
          name: '',
          barcode: cleanBarcode,
          category_id: categories[0]?.id || null,
          category_name: categories[0]?.name || 'Geral',
          category_color: categories[0]?.color || '#3b82f6',
          quantity: '1',
          unit_price: '',
          previous_unit_price: 0,
          unit: 'un',
        },
      ])
      setScanFeedback({
        type: 'new',
        message: `🆕 Novo código de barras lido (${cleanBarcode})! Preencha o nome e preço do item.`,
      })
    }

    setTimeout(() => {
      setScanFeedback(null)
    }, 5000)
  }

  // Carregar todos os itens com estoque baixo de 1 clique
  function handleLoadLowStock() {
    const newItems = []
    for (const prod of lowStockProducts) {
      const alreadyInCart = cartItems.some((it) => it.product_id === prod.id)
      if (!alreadyInCart) {
        const neededQty = Math.max(1, Number(prod.min_quantity) - Number(prod.quantity))
        const unitPrice = Number(prod.unit_price) || 0
        const prevPrice = Number(prod.previous_unit_price) || unitPrice

        newItems.push({
          id: `item-${Date.now()}-${Math.random()}`,
          product_id: prod.id,
          name: prod.name,
          barcode: prod.barcode || prod.sku || '',
          category_id: prod.category_id,
          category_name: prod.category_name,
          category_color: prod.category_color,
          quantity: String(neededQty),
          unit_price: unitPrice > 0 ? String(unitPrice) : '',
          previous_unit_price: prevPrice,
          unit: prod.unit || 'un',
        })
      }
    }

    if (newItems.length > 0) {
      setCartItems((prev) => [...prev, ...newItems])
    }
  }

  // Adicionar produto avulso novo
  function handleAddNewItem() {
    if (!searchQuery.trim()) return

    setCartItems((prev) => [
      ...prev,
      {
        id: `item-${Date.now()}-${Math.random()}`,
        product_id: null,
        name: searchQuery.trim(),
        barcode: /^\d{8,14}$/.test(searchQuery.trim()) ? searchQuery.trim() : '',
        category_id: categories[0]?.id || null,
        category_name: categories[0]?.name || 'Geral',
        category_color: categories[0]?.color || '#3b82f6',
        quantity: '1',
        unit_price: '',
        previous_unit_price: 0,
        unit: 'un',
      },
    ])
    setSearchQuery('')
  }

  function handleUpdateItem(id, field, value) {
    setCartItems((prev) =>
      prev.map((it) => {
        if (it.id !== id) return it
        return {
          ...it,
          [field]: value,
        }
      })
    )
  }

  function handleRemoveItem(id) {
    setCartItems((prev) => prev.filter((it) => it.id !== id))
  }

  // Cálculos dinâmicos do carrinho em tempo real
  const cartTotals = useMemo(() => {
    let totalValue = 0
    let totalUnits = 0
    let previousTotalValue = 0

    for (const item of cartItems) {
      const q = Number(String(item.quantity).replace(',', '.')) || 0
      const p = Number(String(item.unit_price).replace(',', '.')) || 0
      const prevP = Number(item.previous_unit_price) || p

      totalValue += q * p
      totalUnits += q
      previousTotalValue += q * prevP
    }

    const diff = totalValue - previousTotalValue
    const variationPct = previousTotalValue > 0 ? (diff / previousTotalValue) * 100 : 0

    return {
      totalValue,
      totalUnits,
      diff,
      variationPct,
    }
  }, [cartItems])

  // Finalizar compra e persistir atomicamente no banco C#
  async function handleSubmitPurchase() {
    if (cartItems.length === 0) return

    // Validar se todos os itens têm nome
    const emptyNames = cartItems.filter((i) => !i.name || !i.name.trim())
    if (emptyNames.length > 0) {
      alert('Por favor, informe o nome de todos os produtos do carrinho antes de finalizar.')
      return
    }

    const hasInvalidAmounts = cartItems.some((item) => {
      const quantity = Number(String(item.quantity).replace(',', '.'))
      const price = Number(String(item.unit_price).replace(',', '.'))
      return !Number.isFinite(quantity) || quantity <= 0 ||
        String(item.unit_price).trim() === '' || !Number.isFinite(price) || price < 0
    })
    if (hasInvalidAmounts) {
      alert('Confira as quantidades (maiores que zero) e os preços dos itens antes de finalizar.')
      return
    }

    setIsSubmitting(true)
    try {
      const payload = {
        store_name: storeName.trim() || 'Supermercado',
        notes: notes.trim() || null,
        items: cartItems.map((it) => ({
          product_id: it.product_id,
          name: it.name,
          barcode: it.barcode,
          quantity: Number(String(it.quantity).replace(',', '.')),
          unit_price: Number(String(it.unit_price).replace(',', '.')),
          previous_unit_price: it.previous_unit_price,
          category_id: it.category_id,
        })),
      }

      const result = await onFinishPurchase(payload)
      setFinishedSummary({
        storeName: result.store_name,
        totalAmount: result.total_amount,
        itemsCount: cartItems.length,
        totalUnits: cartTotals.totalUnits,
      })
      setCartItems([])
    } catch (err) {
      alert(`Erro ao finalizar compra: ${err.message}`)
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <div className="market-mode-view">
      {/* Cabeçalho da Visão */}
      <div className="view-header">
        <div>
          <h2>🛒 Modo Mercado (Assistente em Tempo Real)</h2>
          <p>
            Monitore seu carrinho de compras no celular, compare preços na prateleira com o mês
            anterior e calcule seu gasto total antes do caixa!
          </p>
        </div>

        <div className="header-actions">
          <button
            type="button"
            className="btn btn-primary"
            onClick={() => setNfeModalOpen(true)}
            title="Importar compra via Foto, QR Code da SEFAZ ou Arquivo XML"
          >
            🧾 Importar Cupom / NF-e
          </button>

          {lowStockProducts.length > 0 && (
            <button
              type="button"
              className="btn btn-warning"
              onClick={handleLoadLowStock}
              title="Carrega todos os produtos em estoque baixo automaticamente"
            >
              ⚡ Repor Estoque Baixo ({lowStockProducts.length})
            </button>
          )}
        </div>
      </div>

      {/* Banner de Feedback de Leitura de Câmera */}
      {scanFeedback && (
        <div
          className={`scan-feedback-banner ${scanFeedback.type === 'found' ? 'feedback-success' : 'feedback-new'}`}
        >
          {scanFeedback.message}
        </div>
      )}

      {/* Banner de Sucesso pós Compra */}
      {finishedSummary && (
        <div className="market-success-banner">
          <div className="banner-icon">🎉</div>
          <div className="banner-content">
            <h4>Compra Finalizada com Sucesso!</h4>
            <p>
              Registrada em <strong>{finishedSummary.storeName}</strong> • Total de{' '}
              <strong>R$ {Number(finishedSummary.totalAmount).toFixed(2)}</strong> em{' '}
              {finishedSummary.itemsCount} itens ({finishedSummary.totalUnits} unidades).
            </p>
            <small>O estoque e o histórico financeiro foram atualizados automaticamente.</small>
          </div>
          <div className="banner-actions">
            <button
              type="button"
              className="btn btn-primary"
              onClick={() => onNavigate('finance')}
            >
              Ver Relatório Financeiro
            </button>
            <button
              type="button"
              className="btn btn-secondary"
              onClick={() => setFinishedSummary(null)}
            >
              Fechar
            </button>
          </div>
        </div>
      )}

      {/* Dados do Estabelecimento */}
      <div className="market-store-bar">
        <div className="form-group flex-1">
          <label>Local / Supermercado</label>
          <input
            type="text"
            className="input-field"
            value={storeName}
            onChange={(e) => setStoreName(e.target.value)}
            placeholder="Ex: Carrefour, Pão de Açúcar, Açougue..."
          />
        </div>
        <div className="form-group flex-2">
          <label>Observações / Nota Fiscal</label>
          <input
            type="text"
            className="input-field"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Ex: Compra quinzenal, itens para o churrasco..."
          />
        </div>
      </div>

      {/* Barra de Busca + Botão de Câmera para Smartphone */}
      <div className="market-search-container">
        <div className="market-search-box">
          <div className="search-input-wrapper">
            <span className="search-icon">🔍</span>
            <input
              type="text"
              className="input-field market-search-input"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  if (filteredCatalog.length > 0) {
                    handleAddToCart(filteredCatalog[0])
                  } else if (searchQuery.trim()) {
                    handleAddNewItem()
                  }
                }
              }}
              placeholder="Digite o nome ou código de barras do produto..."
            />
            {searchQuery && (
              <button
                type="button"
                className="clear-search-btn"
                onClick={() => setSearchQuery('')}
              >
                ✕
              </button>
            )}
          </div>

          {/* Dropdown de Resultados da Pesquisa */}
          {searchQuery.trim() && (
            <div className="market-autocomplete-dropdown">
              {filteredCatalog.length > 0 ? (
                filteredCatalog.map((prod) => (
                  <button
                    key={prod.id}
                    type="button"
                    className="autocomplete-item"
                    onClick={() => handleAddToCart(prod)}
                  >
                    <div className="item-main">
                      <strong>{prod.name}</strong>
                      <small>
                        {prod.barcode ? `Código: ${prod.barcode} • ` : ''}
                        Estoque Atual: {prod.quantity} {prod.unit}
                      </small>
                    </div>
                    <div className="item-price">
                      <span>
                        R${' '}
                        {Number(prod.unit_price || 0).toLocaleString('pt-BR', {
                          minimumFractionDigits: 2,
                        })}
                      </span>
                      <span className="btn-add-badge">+ Adicionar</span>
                    </div>
                  </button>
                ))
              ) : (
                <div className="autocomplete-empty">
                  <span>Nenhum produto cadastrado com esse nome.</span>
                  <button
                    type="button"
                    className="btn btn-sm btn-primary"
                    onClick={handleAddNewItem}
                  >
                    + Adicionar &quot;{searchQuery}&quot; como Novo Item
                  </button>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Botão de Câmera em Destaque para o Mercado */}
        <button
          type="button"
          className="btn btn-camera-scan"
          onClick={() => setScannerOpen(true)}
          title="Abrir câmera do celular para bipar código de barras"
        >
          <span className="camera-icon">📷</span>
          <span className="camera-label">Escanear com Câmera</span>
        </button>
      </div>

      {/* Calculadora de Carrinho em Tempo Real */}
      <div className="market-cart-container">
        {cartItems.length === 0 ? (
          <div className="empty-cart-state">
            <span className="empty-cart-icon">🛒</span>
            <h3>Seu carrinho de compras está vazio</h3>
            <p>
              Use a barra de pesquisa ou clique em <strong>Escanear com Câmera</strong> para bipar produtos na prateleira, ou carregue os itens que estão acabando em casa.
            </p>
            <div className="empty-cart-actions">
              <button
                type="button"
                className="btn btn-primary"
                onClick={() => setScannerOpen(true)}
              >
                📷 Abrir Câmera do Celular
              </button>
              {lowStockProducts.length > 0 && (
                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={handleLoadLowStock}
                >
                  ⚡ Carregar {lowStockProducts.length} itens com estoque baixo
                </button>
              )}
            </div>
          </div>
        ) : (
          <>
            {/* Barra de Resumo Financeiro ao Vivo */}
            <div className="cart-live-summary">
              <div className="summary-col">
                <span className="summary-label">Itens no Carrinho</span>
                <strong className="summary-value">
                  {cartItems.length} itens ({cartTotals.totalUnits} un)
                </strong>
              </div>

              <div className="summary-col">
                <span className="summary-label">Total a Pagar no Caixa</span>
                <strong className="summary-value total-highlight">
                  R${' '}
                  {cartTotals.totalValue.toLocaleString('pt-BR', {
                    minimumFractionDigits: 2,
                    maximumFractionDigits: 2,
                  })}
                </strong>
              </div>

              <div className="summary-col">
                <span className="summary-label">Comparativo com Mês Anterior</span>
                <div className="price-diff-indicator">
                  {cartTotals.diff < -0.01 ? (
                    <span className="badge badge-success">
                      🟢 Economia de R$ {Math.abs(cartTotals.diff).toFixed(2)} (
                      {Math.abs(cartTotals.variationPct).toFixed(1)}%)
                    </span>
                  ) : cartTotals.diff > 0.01 ? (
                    <span className="badge badge-danger">
                      🔴 Mais caro em R$ {cartTotals.diff.toFixed(2)} (+
                      {cartTotals.variationPct.toFixed(1)}%)
                    </span>
                  ) : (
                    <span className="badge badge-info">🟡 Preço estável (0%)</span>
                  )}
                </div>
              </div>

              <div className="summary-actions">
                <button
                  type="button"
                  className="btn btn-success btn-lg btn-finish-cart"
                  disabled={isSubmitting}
                  onClick={handleSubmitPurchase}
                >
                  {isSubmitting ? 'Salvando no Banco...' : '✓ Finalizar Compra'}
                </button>
              </div>
            </div>

            {/* Lista de Itens do Carrinho */}
            <div className="table-wrap">
              <table className="erp-table">
                <thead>
                  <tr>
                    <th>Produto</th>
                    <th>Qtd.</th>
                    <th>Preço Unit. Prateleira</th>
                    <th>Preço Anterior</th>
                    <th>Subtotal</th>
                    <th>Variação</th>
                    <th>Ações</th>
                  </tr>
                </thead>
                <tbody>
                  {cartItems.map((item) => {
                    const price = Number(String(item.unit_price).replace(',', '.')) || 0
                    const prevPrice = Number(item.previous_unit_price) || 0
                    const subtotal = (Number(String(item.quantity).replace(',', '.')) || 0) * price

                    let diffPercent = 0
                    if (prevPrice > 0 && price > 0) {
                      diffPercent = ((price - prevPrice) / prevPrice) * 100
                    }

                    return (
                      <tr key={item.id}>
                        <td data-label="Produto">
                          {item.product_id ? (
                            <div className="product-cell">
                              <strong>{item.name}</strong>
                              <small>
                                {item.barcode ? `EAN: ${item.barcode} • ` : ''}
                                {item.category_name}
                              </small>
                            </div>
                          ) : (
                            <div className="new-item-inputs">
                              <input
                                type="text"
                                className="input-field input-sm"
                                placeholder="Nome do produto novo..."
                                value={item.name}
                                onChange={(e) =>
                                  handleUpdateItem(item.id, 'name', e.target.value)
                                }
                              />
                              <small className="badge-new-item">
                                🆕 Novo Item • Código: {item.barcode || 'Sem código'}
                              </small>
                            </div>
                          )}
                        </td>

                        <td className="cart-quantity-cell" data-label="Quantidade">
                          <input
                            type="text"
                            inputMode="decimal"
                            aria-label={`Quantidade de ${item.name || 'produto novo'}`}
                            className="input-field input-sm text-center cart-edit-input"
                            value={item.quantity}
                            onFocus={(e) => e.currentTarget.select()}
                            onChange={(e) =>
                              handleUpdateItem(item.id, 'quantity', e.target.value)
                            }
                          />
                        </td>

                        <td className="cart-unit-price-cell" data-label="Preço unitário">
                          <div className="input-currency-wrapper">
                            <span>R$</span>
                            <input
                              type="text"
                              inputMode="decimal"
                              aria-label={`Preço unitário de ${item.name || 'produto novo'}`}
                              className="input-field input-sm cart-edit-input"
                              value={item.unit_price}
                              onFocus={(e) => e.currentTarget.select()}
                              onChange={(e) =>
                                handleUpdateItem(item.id, 'unit_price', e.target.value)
                              }
                            />
                          </div>
                        </td>

                        <td data-label="Preço anterior">
                          <span className="text-muted">
                            {prevPrice > 0 ? `R$ ${prevPrice.toFixed(2)}` : '—'}
                          </span>
                        </td>

                        <td data-label="Subtotal">
                          <strong>R$ {subtotal.toFixed(2)}</strong>
                        </td>

                        <td data-label="Variação">
                          {prevPrice === 0 ? (
                            <span className="badge badge-info">Novo</span>
                          ) : diffPercent < -0.5 ? (
                            <span className="badge badge-success">
                              🟢 {diffPercent.toFixed(1)}%
                            </span>
                          ) : diffPercent > 0.5 ? (
                            <span className="badge badge-danger">
                              🔴 +{diffPercent.toFixed(1)}%
                            </span>
                          ) : (
                            <span className="badge badge-info">🟡 Igual</span>
                          )}
                        </td>

                        <td data-label="Ações">
                          <button
                            type="button"
                            className="btn btn-xs btn-danger cart-remove-button"
                            onClick={() => handleRemoveItem(item.id)}
                            title="Remover do carrinho"
                          >
                            Remover
                          </button>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </>
        )}
      </div>

      {/* Modal Leitor de Código de Barras por Câmera */}
      <BarcodeScannerModal
        isOpen={scannerOpen}
        onClose={() => setScannerOpen(false)}
        onScanSuccess={handleBarcodeScanned}
      />

      {/* Modal Importador de NF-e */}
      {nfeModalOpen && (
        <NfeImportModal
          categories={categories}
          onClose={() => setNfeModalOpen(false)}
          onImportSuccess={async (payload) => {
            const result = await onFinishPurchase(payload)
            setFinishedSummary({
              storeName: result.store_name,
              totalAmount: result.total_amount,
              itemsCount: payload.items.length,
              totalUnits: payload.items.reduce((s, i) => s + Number(i.quantity), 0),
            })
            setNfeModalOpen(false)
          }}
        />
      )}
    </div>
  )
}
