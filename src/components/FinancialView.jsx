import { useEffect, useMemo, useState } from 'react'

export default function FinancialView({ financialData, onRefresh, onNavigate }) {
  const [selectedPurchaseId, setSelectedPurchaseId] = useState(null)
  const [searchTerm, setSearchTerm] = useState('')
  const [filterVariation, setFilterVariation] = useState('ALL') // 'ALL', 'UP', 'DOWN', 'EQUAL'
  const [filterCategory, setFilterCategory] = useState('')

  const overview = financialData?.overview || {}
  const spendingByCategory = financialData?.spendingByCategory || []
  const topInflation = financialData?.topInflation || []
  const topDeflation = financialData?.topDeflation || []
  const purchases = financialData?.purchases || []
  const allItems = financialData?.items || []

  // Calcular total de gastos em categorias para as barras de progresso
  const totalCategorySpent = useMemo(() => {
    return spendingByCategory.reduce((sum, c) => sum + Number(c.total_spent || 0), 0)
  }, [spendingByCategory])

  // Itens filtrados para a tabela
  const filteredItems = useMemo(() => {
    return allItems.filter((item) => {
      if (selectedPurchaseId && item.purchase_id !== selectedPurchaseId) {
        return false
      }

      if (searchTerm.trim()) {
        const q = searchTerm.toLowerCase()
        const matchesName = item.product_name?.toLowerCase().includes(q)
        const matchesBarcode = item.barcode?.toLowerCase().includes(q)
        if (!matchesName && !matchesBarcode) return false
      }

      if (filterCategory && item.category_name !== filterCategory) {
        return false
      }

      const varPct = Number(item.price_variation_pct || 0)
      if (filterVariation === 'UP' && varPct <= 0.001) return false
      if (filterVariation === 'DOWN' && varPct >= -0.001) return false
      if (filterVariation === 'EQUAL' && Math.abs(varPct) > 0.001) return false

      return true
    })
  }, [allItems, selectedPurchaseId, searchTerm, filterCategory, filterVariation])

  const avgVar = Number(overview.avg_variation_pct || 0) * 100

  return (
    <div className="financial-view">
      <div className="view-header">
        <div>
          <h2>📈 Análise Financeira e Comparativo de Inflação</h2>
          <p>
            Acompanhe o histórico de gastos no supermercado, comparativo de preços mês a mês e
            produtos com maior variação na cesta familiar.
          </p>
        </div>

        <div className="header-actions">
          <button
            type="button"
            className="btn btn-secondary"
            onClick={onRefresh}
            title="Atualizar dados"
          >
            🔄 Atualizar
          </button>
          <button
            type="button"
            className="btn btn-primary"
            onClick={() => onNavigate('market')}
          >
            🛒 Ir para o Modo Mercado
          </button>
        </div>
      </div>

      {/* Cards de Métricas e KPIs */}
      <div className="kpi-grid">
        <div className="kpi-card">
          <span className="kpi-label">Total Gasto em Compras</span>
          <strong className="kpi-value text-primary">
            R${' '}
            {Number(overview.total_spent || 0).toLocaleString('pt-BR', {
              minimumFractionDigits: 2,
              maximumFractionDigits: 2,
            })}
          </strong>
          <small className="kpi-hint">
            {overview.total_purchases || 0} nota(s) fiscal(is) registrada(s)
          </small>
        </div>

        <div className="kpi-card">
          <span className="kpi-label">Variação Média de Preços</span>
          <strong
            className={`kpi-value ${
              avgVar > 0 ? 'text-danger' : avgVar < 0 ? 'text-success' : 'text-neutral'
            }`}
          >
            {avgVar > 0 ? '+' : ''}
            {avgVar.toFixed(2)}%
          </strong>
          <small className="kpi-hint">Inflação média por item comparado ao mês anterior</small>
        </div>

        <div className="kpi-card">
          <span className="kpi-label">Total de Unidades Compradas</span>
          <strong className="kpi-value">
            {Number(overview.total_items_bought || 0).toLocaleString('pt-BR', {
              maximumFractionDigits: 2,
            })}{' '}
            un
          </strong>
          <small className="kpi-hint">Em todas as notas fiscais cadastradas</small>
        </div>

        <div className="kpi-card">
          <span className="kpi-label">Balanço de Preços</span>
          <div className="balance-breakdown">
            <span className="badge-danger" title="Subiram de preço">
              🔴 {overview.items_up || 0} subiram
            </span>
            <span className="badge-neutral" title="Mesmo preço">
              🟡 {overview.items_same || 0} iguais
            </span>
            <span className="badge-success" title="Baixaram de preço">
              🟢 {overview.items_down || 0} caíram
            </span>
          </div>
          <small className="kpi-hint">Comportamento dos produtos nas prateleiras</small>
        </div>
      </div>

      {/* Painel com 2 colunas: Gastos por Categoria & Top Variações de Preço */}
      <div className="financial-dashboard-grid">
        {/* Coluna 1: Distribuição de Gastos por Categoria */}
        <div className="erp-card">
          <div className="card-header">
            <h3>🏷️ Gastos por Categoria</h3>
            <span className="badge-count">{spendingByCategory.length} categorias</span>
          </div>

          <div className="category-spending-list">
            {spendingByCategory.map((cat) => {
              const spent = Number(cat.total_spent || 0)
              const pct = totalCategorySpent > 0 ? (spent / totalCategorySpent) * 100 : 0

              return (
                <div key={cat.category_name} className="cat-spending-row">
                  <div className="cat-spending-meta">
                    <span className="cat-spending-name">
                      <span
                        className="cat-color-dot"
                        style={{ backgroundColor: cat.category_color }}
                      />
                      <strong>{cat.category_name}</strong>
                    </span>
                    <span className="cat-spending-val">
                      R$ {spent.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}{' '}
                      <small>({pct.toFixed(1)}%)</small>
                    </span>
                  </div>
                  <div className="progress-track">
                    <div
                      className="progress-fill"
                      style={{
                        width: `${pct}%`,
                        backgroundColor: cat.category_color,
                      }}
                    />
                  </div>
                </div>
              )
            })}
          </div>
        </div>

        {/* Coluna 2: Maiores Altas de Preço (Top Inflação) */}
        <div className="erp-card">
          <div className="card-header">
            <h3>🔴 Produtos com Maior Alta (Inflação)</h3>
            <span className="badge-danger">Subiram de preço</span>
          </div>

          <div className="price-movers-list">
            {topInflation.length === 0 ? (
              <p className="empty-hint">Nenhum produto com aumento registrado.</p>
            ) : (
              topInflation.slice(0, 6).map((item, idx) => {
                const varPct = Number(item.price_variation_pct) * 100
                return (
                  <div key={`${item.product_name}-${idx}`} className="mover-row">
                    <div className="mover-info">
                      <strong>{item.product_name}</strong>
                      <small>
                        De R$ {Number(item.previous_unit_price).toFixed(2)} por R${' '}
                        {Number(item.unit_price).toFixed(2)}
                      </small>
                    </div>
                    <div className="mover-stat text-danger">
                      <strong>+{varPct.toFixed(1)}%</strong>
                      <small>+R$ {Number(item.diff_reais || 0).toFixed(2)}</small>
                    </div>
                  </div>
                )
              })
            )}
          </div>
        </div>
      </div>

      {/* Histórico de Compras / Notas Fiscais */}
      <div className="erp-card mt-6">
        <div className="card-header">
          <div>
            <h3>🧾 Notas Fiscais e Compras Registradas</h3>
            <p className="card-subtitle">
              Clique em uma nota fiscal para filtrar os itens correspondentes na tabela abaixo.
            </p>
          </div>
          {selectedPurchaseId && (
            <button
              type="button"
              className="btn btn-sm btn-secondary"
              onClick={() => setSelectedPurchaseId(null)}
            >
              Exibir Todas as Notas
            </button>
          )}
        </div>

        <div className="purchases-table-wrapper">
          <table className="erp-table">
            <thead>
              <tr>
                <th>Data</th>
                <th>Estabelecimento</th>
                <th>Observações</th>
                <th>Itens</th>
                <th style={{ textAlign: 'right' }}>Total Pago</th>
                <th>Ação</th>
              </tr>
            </thead>
            <tbody>
              {purchases.map((pur) => {
                const isSelected = selectedPurchaseId === pur.id
                return (
                  <tr
                    key={pur.id}
                    className={`clickable-row ${isSelected ? 'row-selected' : ''}`}
                    onClick={() =>
                      setSelectedPurchaseId(isSelected ? null : pur.id)
                    }
                  >
                    <td data-label="Data">
                      {new Date(pur.created_at).toLocaleDateString('pt-BR', {
                        day: '2-digit',
                        month: '2-digit',
                        year: 'numeric',
                        hour: '2-digit',
                        minute: '2-digit',
                      })}
                    </td>
                    <td data-label="Estabelecimento">
                      <strong>{pur.store_name}</strong>
                    </td>
                    <td data-label="Observações">{pur.notes || '-'}</td>
                    <td data-label="Itens">
                      <span className="badge-pill">
                        {pur.items_count || 0} itens ({Number(pur.total_items || 0).toFixed(1)} un)
                      </span>
                    </td>
                    <td style={{ textAlign: 'right' }} data-label="Total pago">
                      <strong className="text-primary">
                        R${' '}
                        {Number(pur.total_amount).toLocaleString('pt-BR', {
                          minimumFractionDigits: 2,
                          maximumFractionDigits: 2,
                        })}
                      </strong>
                    </td>
                    <td data-label="Ação">
                      <button
                        type="button"
                        className={`btn btn-sm ${isSelected ? 'btn-primary' : 'btn-secondary'}`}
                        onClick={(e) => {
                          e.stopPropagation()
                          setSelectedPurchaseId(isSelected ? null : pur.id)
                        }}
                      >
                        {isSelected ? 'Filtrando 🔍' : 'Ver Itens'}
                      </button>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Tabela Detalhada de Comparativo de Preços */}
      <div className="erp-card mt-6">
        <div className="card-header flex-column-mobile">
          <div>
            <h3>
              📋 Tabela de Comparativo de Preços (Mês Atual vs Mês Anterior)
              {selectedPurchaseId && (
                <span className="filter-badge">
                  Filtrado pela Nota #{selectedPurchaseId}
                </span>
              )}
            </h3>
            <p className="card-subtitle">
              Exibindo {filteredItems.length} de {allItems.length} itens registrados.
            </p>
          </div>

          <div className="table-filters-toolbar">
            <input
              type="text"
              className="input-field input-sm"
              placeholder="Buscar item ou código..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />

            <select
              className="input-field input-sm"
              value={filterCategory}
              onChange={(e) => setFilterCategory(e.target.value)}
            >
              <option value="">Todas as Categorias</option>
              {spendingByCategory.map((c) => (
                <option key={c.category_name} value={c.category_name}>
                  {c.category_name}
                </option>
              ))}
            </select>

            <div className="btn-toggle-group">
              <button
                type="button"
                className={`toggle-btn ${filterVariation === 'ALL' ? 'active' : ''}`}
                onClick={() => setFilterVariation('ALL')}
              >
                Todos
              </button>
              <button
                type="button"
                className={`toggle-btn ${filterVariation === 'UP' ? 'active' : ''}`}
                onClick={() => setFilterVariation('UP')}
              >
                🔴 Subiram
              </button>
              <button
                type="button"
                className={`toggle-btn ${filterVariation === 'EQUAL' ? 'active' : ''}`}
                onClick={() => setFilterVariation('EQUAL')}
              >
                🟡 Iguais
              </button>
              <button
                type="button"
                className={`toggle-btn ${filterVariation === 'DOWN' ? 'active' : ''}`}
                onClick={() => setFilterVariation('DOWN')}
              >
                🟢 Desceram
              </button>
            </div>
          </div>
        </div>

        <div className="table-responsive">
          <table className="erp-table">
            <thead>
              <tr>
                <th>Código / SKU</th>
                <th>Descrição do Item</th>
                <th>Categoria</th>
                <th style={{ width: '80px', textAlign: 'center' }}>Qtd</th>
                <th style={{ width: '130px', textAlign: 'right' }}>Preço Mês Ant.</th>
                <th style={{ width: '130px', textAlign: 'right' }}>Preço Atual</th>
                <th style={{ width: '140px', textAlign: 'center' }}>Variação (%)</th>
                <th style={{ width: '130px', textAlign: 'right' }}>Total (R$)</th>
              </tr>
            </thead>
            <tbody>
              {filteredItems.length === 0 ? (
                <tr>
                  <td colSpan="8" style={{ textAlign: 'center', padding: '32px' }}>
                    Nenhum item encontrado com os filtros selecionados.
                  </td>
                </tr>
              ) : (
                filteredItems.map((item) => {
                  const unitPrice = Number(item.unit_price) || 0
                  const prevPrice = Number(item.previous_unit_price) || 0
                  const total = Number(item.total_price) || unitPrice * Number(item.quantity)
                  const diff = unitPrice - prevPrice
                  const varPct = Number(item.price_variation_pct) * 100

                  return (
                    <tr key={item.id}>
                      <td data-label="Código / SKU">
                        <span className="mono-code">{item.barcode || '-'}</span>
                      </td>
                      <td data-label="Descrição do item">
                        <strong>{item.product_name}</strong>
                      </td>
                      <td data-label="Categoria">
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
                      </td>
                      <td style={{ textAlign: 'center' }} data-label="Quantidade">
                        <strong>{item.quantity}</strong>
                      </td>
                      <td style={{ textAlign: 'right' }} data-label="Preço mês anterior">
                        {prevPrice > 0 ? `R$ ${prevPrice.toFixed(2)}` : '-'}
                      </td>
                      <td style={{ textAlign: 'right' }} data-label="Preço atual">
                        <strong>R$ {unitPrice.toFixed(2)}</strong>
                      </td>
                      <td style={{ textAlign: 'center' }} data-label="Variação">
                        {diff > 0.005 ? (
                          <span className="compare-badge badge-danger">
                            +{varPct.toFixed(1)}% (+R$ {diff.toFixed(2)})
                          </span>
                        ) : diff < -0.005 ? (
                          <span className="compare-badge badge-success">
                            {varPct.toFixed(1)}% (-R$ {Math.abs(diff).toFixed(2)})
                          </span>
                        ) : (
                          <span className="compare-badge badge-neutral">0.0% (Igual)</span>
                        )}
                      </td>
                      <td style={{ textAlign: 'right' }} data-label="Total">
                        <strong>R$ {total.toFixed(2)}</strong>
                      </td>
                    </tr>
                  )
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}

