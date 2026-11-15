import { useMemo, useState } from 'react'

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
  function handleAddToCart(product) {
    const existingIndex = cartItems.findIndex((it) => it.product_id === product.id)
    if (existingIndex >= 0) {
      setCartItems((prev) => {
        const copy = [...prev]
        copy[existingIndex].quantity = Number(copy[existingIndex].quantity) + 1
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
          barcode: product.barcode || product.sku || '',
          category_id: product.category_id,
          category_name: product.category_name,
          category_color: product.category_color,
          quantity: neededQty,
          unit_price: unitPrice,
          previous_unit_price: prevPrice,
          unit: product.unit || 'un',
        },
      ])
    }
    setSearchQuery('')
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
          quantity: neededQty,
          unit_price: unitPrice,
          previous_unit_price: prevPrice,
          unit: prod.unit || 'un',
        })
      }
    }

    if (newItems.length > 0) {
      setCartItems((prev) => [...prev, ...newItems])
    }
  }

  // Adicionar produto avulso novo (que ainda não está cadastrado)
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
        quantity: 1,
        unit_price: 0,
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
          [field]: field === 'quantity' || field === 'unit_price' ? Number(value) : value,
        }
      })
    )
  }

  function handleRemoveItem(id) {
    setCartItems((prev) => prev.filter((it) => it.id !== id))
  }

  // Cálculos dinâmicos do carrinho
  const cartTotals = useMemo(() => {
    let totalValue = 0
    let totalUnits = 0
    let previousTotalValue = 0

    for (const item of cartItems) {
      const q = Number(item.quantity) || 0
      const p = Number(item.unit_price) || 0
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

  // Finalizar compra e enviar para o banco
  async function handleSubmitPurchase() {
    if (cartItems.length === 0) return

    setIsSubmitting(true)
    try {
      const payload = {
        store_name: storeName.trim() || 'Supermercado',
        notes: notes.trim() || null,
        items: cartItems.map((it) => ({
          product_id: it.product_id,
          name: it.name,
          barcode: it.barcode,
          quantity: it.quantity,
          unit_price: it.unit_price,
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
      <div className="view-header">
        <div>
          <h2>🛒 Modo Mercado (Assistente em Tempo Real)</h2>
          <p>
            Monitore seu carrinho de compras no supermercado, compare preços na prateleira com o mês
            anterior e atualize seu estoque e gastos com 1 clique!
          </p>
        </div>

        <div className="header-actions">
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

      {finishedSummary && (
        <div className="market-success-banner">
          <div className="banner-icon">🎉</div>
          <div className="banner-content">
            <h4>Compra Finalizada com Sucesso!</h4>
            <p>
              Registrada em <strong>{finishedSummary.storeName}</strong> no valor total de{' '}
              <strong>
                R$ {Number(finishedSummary.totalAmount).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
              </strong>{' '}
              ({finishedSummary.itemsCount} itens / {finishedSummary.totalUnits} unidades).
              O estoque e o histórico financeiro foram atualizados automaticamente.
            </p>
          </div>
          <div className="banner-actions">
            <button
              type="button"
              className="btn btn-primary"
              onClick={() => onNavigate('finance')}
            >
              Ver na Análise Financeira 📈
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

      {/* Barra de Configurações da Compra */}
      <div className="market-store-bar">
        <div className="form-group flex-1">
          <label htmlFor="store-name-input">Local / Supermercado</label>
          <input
            id="store-name-input"
            type="text"
            className="input-field"
            value={storeName}
            onChange={(e) => setStoreName(e.target.value)}
            placeholder="Ex: Supermercado São Jorge, Atacadão, Feira..."
          />
        </div>

        <div className="form-group flex-2">
          <label htmlFor="store-notes-input">Observações / Nota Fiscal</label>
          <input
            id="store-notes-input"
            type="text"
            className="input-field"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Ex: Compra quinzenal, itens da feira, cupom fiscal #1234..."
          />
        </div>
      </div>

      {/* Barra de Busca e Inclusão Rápida */}
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
            placeholder="Escaneie o código de barras ou digite o nome do produto..."
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
                      R$ {Number(prod.unit_price || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
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
                  + Adicionar "{searchQuery}" como Novo Produto
                </button>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Lista do Carrinho de Compras */}
      <div className="market-cart-container">
        {cartItems.length === 0 ? (
          <div className="empty-cart-state">
            <div className="empty-cart-icon">🛒</div>
            <h3>Seu carrinho de compras está vazio</h3>
            <p>
              Use a barra de pesquisa acima para escanear ou adicionar produtos, ou clique no botão
              de <strong>Repor Estoque Baixo</strong> para carregar os itens que estão faltando em
              casa.
            </p>
            {lowStockProducts.length > 0 && (
              <button
                type="button"
                className="btn btn-primary"
                onClick={handleLoadLowStock}
              >
                Carregar {lowStockProducts.length} itens com estoque baixo
              </button>
            )}
          </div>
        ) : (
          <div className="cart-table-wrapper">
            <table className="erp-table cart-table">
              <thead>
                <tr>
                  <th>Produto / Código</th>
                  <th style={{ width: '130px' }}>Qtd</th>
                  <th style={{ width: '150px' }}>Preço Prateleira</th>
                  <th>Comparativo Preço Anterior</th>
                  <th style={{ width: '140px', textAlign: 'right' }}>Subtotal</th>
                  <th style={{ width: '60px' }}></th>
                </tr>
              </thead>
              <tbody>
                {cartItems.map((item) => {
                  const unitPrice = Number(item.unit_price) || 0
                  const prevPrice = Number(item.previous_unit_price) || 0
                  const qty = Number(item.quantity) || 1
                  const subtotal = qty * unitPrice
                  const priceDiff = unitPrice - prevPrice
                  const varPct = prevPrice > 0 ? (priceDiff / prevPrice) * 100 : 0

                  return (
                    <tr key={item.id} className="cart-row">
                      <td>
                        <div className="cart-product-cell">
                          <strong>{item.name}</strong>
                          <div className="cart-product-meta">
                            {item.category_name && (
                              <span
                                className="pill-badge"
                                style={{
                                  backgroundColor: `${item.category_color}22`,
                                  color: item.category_color,
                                  borderColor: item.category_color,
                                }}
                              >
                                {item.category_name}
                              </span>
                            )}
                            {item.barcode && <small className="barcode-tag">🏷️ {item.barcode}</small>}
                          </div>
                        </div>
                      </td>

                      <td>
                        <div className="qty-counter">
                          <button
                            type="button"
                            className="qty-btn"
                            onClick={() =>
                              handleUpdateItem(item.id, 'quantity', Math.max(1, qty - 1))
                            }
                          >
                            -
                          </button>
                          <input
                            type="number"
                            min="0.1"
                            step="any"
                            className="qty-input"
                            value={item.quantity}
                            onChange={(e) => handleUpdateItem(item.id, 'quantity', e.target.value)}
                          />
                          <button
                            type="button"
                            className="qty-btn"
                            onClick={() => handleUpdateItem(item.id, 'quantity', qty + 1)}
                          >
                            +
                          </button>
                        </div>
                      </td>

                      <td>
                        <div className="price-input-wrapper">
                          <span className="currency-prefix">R$</span>
                          <input
                            type="number"
                            min="0"
                            step="0.01"
                            className="price-input"
                            value={item.unit_price}
                            onChange={(e) => handleUpdateItem(item.id, 'unit_price', e.target.value)}
                          />
                        </div>
                      </td>

                      <td>
                        <div className="price-compare-cell">
                          {prevPrice > 0 ? (
                            <>
                              <div className="prev-price-label">
                                Anterior: R$ {prevPrice.toFixed(2)}
                              </div>
                              {priceDiff > 0.01 ? (
                                <span className="compare-badge badge-danger" title={`Subiu R$ ${priceDiff.toFixed(2)} por unidade`}>
                                  🔴 +{varPct.toFixed(1)}% (+R$ {priceDiff.toFixed(2)})
                                </span>
                              ) : priceDiff < -0.01 ? (
                                <span className="compare-badge badge-success" title={`Economia de R$ ${Math.abs(priceDiff).toFixed(2)} por unidade`}>
                                  🟢 {varPct.toFixed(1)}% (-R$ {Math.abs(priceDiff).toFixed(2)})
                                </span>
                              ) : (
                                <span className="compare-badge badge-neutral">
                                  🟡 Mesmo Preço
                                </span>
                              )}
                            </>
                          ) : (
                            <span className="compare-badge badge-new">
                              🆕 Novo Produto
                            </span>
                          )}
                        </div>
                      </td>

                      <td style={{ textAlign: 'right' }}>
                        <strong className="cart-subtotal">
                          R$ {subtotal.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                        </strong>
                      </td>

                      <td>
                        <button
                          type="button"
                          className="btn-icon-danger"
                          title="Remover do carrinho"
                          onClick={() => handleRemoveItem(item.id)}
                        >
                          🗑️
                        </button>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Barra de Resumo e Finalização de Compra */}
      {cartItems.length > 0 && (
        <div className="market-checkout-bar">
          <div className="checkout-stat">
            <span className="stat-label">Total de Itens</span>
            <strong className="stat-val">
              {cartItems.length} itens ({cartTotals.totalUnits} un)
            </strong>
          </div>

          <div className="checkout-stat">
            <span className="stat-label">Variação Estimada</span>
            <strong
              className={`stat-val ${
                cartTotals.diff > 0.05
                  ? 'text-danger'
                  : cartTotals.diff < -0.05
                  ? 'text-success'
                  : 'text-neutral'
              }`}
            >
              {cartTotals.diff > 0.05 ? '+' : ''}
              R$ {cartTotals.diff.toFixed(2)} ({cartTotals.variationPct.toFixed(1)}%)
            </strong>
          </div>

          <div className="checkout-total-box">
            <span className="stat-label">Total a Pagar no Caixa</span>
            <span className="checkout-total-val">
              R$ {cartTotals.totalValue.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </span>
          </div>

          <button
            type="button"
            className="btn btn-success btn-lg btn-finish-purchase"
            disabled={isSubmitting || cartTotals.totalValue <= 0}
            onClick={handleSubmitPurchase}
          >
            {isSubmitting ? 'Processando...' : '🛒 Finalizar Compra e Atualizar Estoque'}
          </button>
        </div>
      )}
    </div>
  )
}

