import { formatDateTime, formatNumber, getMovementMeta } from '../utils/formatters.js'

export default function MovementsView({ movements, onOpenNewMovement, hasProducts }) {
  return (
    <div className="view-stack">
      <div className="view-header">
        <div>
          <h1>Histórico de Movimentações</h1>
          <p>Auditoria completa de todas as entradas, saídas e ajustes manuais de estoque.</p>
        </div>
        <button
          type="button"
          className="btn btn-primary"
          disabled={!hasProducts}
          onClick={onOpenNewMovement}
        >
          + Nova Movimentação
        </button>
      </div>

      <section className="panel">
        {movements.length === 0 ? (
          <div className="empty-box">Nenhuma movimentação registrada no banco de dados.</div>
        ) : (
          <div className="table-wrap">
            <table className="erp-table">
              <thead>
                <tr>
                  <th>Data/Hora</th>
                  <th>Produto</th>
                  <th>Tipo</th>
                  <th>Qtd. Movimentada</th>
                  <th>Saldo Anterior</th>
                  <th>Novo Saldo</th>
                  <th>Motivo</th>
                </tr>
              </thead>
              <tbody>
                {movements.map((mov) => {
                  const meta = getMovementMeta(mov.type)
                  return (
                    <tr key={mov.id}>
                      <td data-label="Data e hora">{formatDateTime(mov.created_at)}</td>
                      <td data-label="Produto">
                        <div className="product-cell">
                          <strong>{mov.product_name}</strong>
                          <small>{mov.product_sku || 'Sem SKU'}</small>
                        </div>
                      </td>
                      <td data-label="Tipo">
                        <span className={`badge ${meta.className}`}>{meta.label}</span>
                      </td>
                      <td data-label="Quantidade movimentada">
                        <strong>
                          {meta.sign}
                          {formatNumber(mov.quantity)} {mov.product_unit}
                        </strong>
                      </td>
                      <td data-label="Saldo anterior">
                        {formatNumber(mov.previous_quantity)} {mov.product_unit}
                      </td>
                      <td data-label="Novo saldo">
                        <strong>
                          {formatNumber(mov.new_quantity)} {mov.product_unit}
                        </strong>
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
