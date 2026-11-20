import {
  formatCurrency,
  formatDate,
  formatDateTime,
  formatNumber,
  getMovementMeta,
  getStockStatus,
} from '../utils/formatters.js'

export default function DashboardView({
  dashboard,
  onQuickMovement,
  onNavigate,
  onOpenNewProduct,
}) {
  const summary = dashboard?.summary || {
    total_products: 0,
    total_units: 0,
    total_value: 0,
    low_stock_count: 0,
    expiring_soon_count: 0,
  }

  const lowStockProducts = dashboard?.lowStockProducts || []
  const expiringProducts = dashboard?.expiringProducts || []
  const recentMovements = dashboard?.recentMovements || []

  return (
    <div className="view-stack">
      <div className="view-header">
        <div>
          <h1>Visão Geral do Estoque</h1>
          <p>Resumo em tempo real dos itens da casa, alertas de compra e últimas movimentações.</p>
        </div>
        <div className="header-actions">
          <button type="button" className="btn btn-secondary" onClick={() => onNavigate('products')}>
            Ver Catálogo
          </button>
          <button type="button" className="btn btn-primary" onClick={onOpenNewProduct}>
            + Novo Produto
          </button>
        </div>
      </div>

      <section className="kpi-grid">
        <article className="kpi-card">
          <span className="kpi-label">Produtos Cadastrados</span>
          <strong className="kpi-value">{summary.total_products}</strong>
          <small className="kpi-hint">Itens distintos no catálogo</small>
        </article>

        <article className="kpi-card">
          <span className="kpi-label">Unidades em Estoque</span>
          <strong className="kpi-value">{formatNumber(summary.total_units)}</strong>
          <small className="kpi-hint">Soma de todas as quantidades</small>
        </article>

        <article className="kpi-card">
          <span className="kpi-label">Valor Estimado em Casa</span>
          <strong className="kpi-value">{formatCurrency(summary.total_value)}</strong>
          <small className="kpi-hint">Baseado no preço unitário</small>
        </article>

        <article className={`kpi-card ${summary.low_stock_count > 0 ? 'kpi-alert' : ''}`}>
          <span className="kpi-label">Alertas de Reposição</span>
          <strong className="kpi-value">{summary.low_stock_count}</strong>
          <small className="kpi-hint">
            {summary.expiring_soon_count} item(ns) vencendo em 30 dias
          </small>
        </article>
      </section>

      <div className="dashboard-panels">
        <section className="panel">
          <div className="panel-header">
            <div>
              <h2>Lista de Compras / Reposição</h2>
              <p>Produtos com estoque igual ou abaixo do mínimo configurado</p>
            </div>
            <button
              type="button"
              className="btn-link"
              onClick={() => onNavigate('products', { onlyLowStock: true })}
            >
              Ver todos
            </button>
          </div>

          {lowStockProducts.length === 0 ? (
            <div className="empty-box">
              Nenhum item abaixo do estoque mínimo. Tudo abastecido!
            </div>
          ) : (
            <ul className="alert-list">
              {lowStockProducts.map((item) => {
                const status = getStockStatus(item.quantity, item.min_quantity)
                return (
                  <li key={item.id} className="alert-row">
                    <div>
                      <div className="row-title">
                        <strong>{item.name}</strong>
                        <span className={`badge ${status.className}`}>{status.label}</span>
                      </div>
                      <small>
                        {item.location} • Atual: <b>{formatNumber(item.quantity)}</b> {item.unit} (mín:{' '}
                        {formatNumber(item.min_quantity)})
                      </small>
                    </div>
                    <button
                      type="button"
                      className="btn btn-sm btn-success"
                      onClick={() => onQuickMovement(item, 'IN')}
                    >
                      + Repor
                    </button>
                  </li>
                )
              })}
            </ul>
          )}
        </section>

        <section className="panel">
          <div className="panel-header">
            <div>
              <h2>Próximos do Vencimento (30 dias)</h2>
              <p>Fique de olho para evitar desperdícios</p>
            </div>
          </div>

          {expiringProducts.length === 0 ? (
            <div className="empty-box">Nenhum produto com vencimento próximo nos próximos 30 dias.</div>
          ) : (
            <ul className="alert-list">
              {expiringProducts.map((item) => (
                <li key={item.id} className="alert-row">
                  <div>
                    <div className="row-title">
                      <strong>{item.name}</strong>
                      <span className="badge badge-warning">{formatDate(item.expiration_date)}</span>
                    </div>
                    <small>
                      {item.location} • Restam {formatNumber(item.quantity)} {item.unit}
                    </small>
                  </div>
                  <button
                    type="button"
                    className="btn btn-sm btn-secondary"
                    onClick={() => onQuickMovement(item, 'OUT')}
                  >
                    - Consumir
                  </button>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>

      <section className="panel">
        <div className="panel-header">
          <div>
            <h2>Últimas Movimentações</h2>
            <p>Histórico recente de entradas, saídas e ajustes registrados no PostgreSQL</p>
          </div>
          <button type="button" className="btn-link" onClick={() => onNavigate('movements')}>
            Histórico completo
          </button>
        </div>

        {recentMovements.length === 0 ? (
          <div className="empty-box">Nenhuma movimentação registrada ainda.</div>
        ) : (
          <div className="table-wrap">
            <table className="erp-table">
              <thead>
                <tr>
                  <th>Data/Hora</th>
                  <th>Produto</th>
                  <th>Tipo</th>
                  <th>Quantidade</th>
                  <th>Saldo</th>
                  <th>Motivo</th>
                </tr>
              </thead>
              <tbody>
                {recentMovements.map((mov) => {
                  const meta = getMovementMeta(mov.type)
                  return (
                    <tr key={mov.id}>
                      <td data-label="Data e hora">{formatDateTime(mov.created_at)}</td>
                      <td data-label="Produto">
                        <strong>{mov.product_name}</strong>
                      </td>
                      <td data-label="Tipo">
                        <span className={`badge ${meta.className}`}>{meta.label}</span>
                      </td>
                      <td data-label="Quantidade">
                        {meta.sign}
                        {formatNumber(mov.quantity)} {mov.product_unit}
                      </td>
                      <td data-label="Saldo">
                        {formatNumber(mov.previous_quantity)} → <strong>{formatNumber(mov.new_quantity)}</strong>
                      </td>
                      <td className="text-muted" data-label="Motivo">{mov.reason || '—'}</td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  )
}
