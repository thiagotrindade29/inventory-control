import {
  formatCurrency,
  formatDate,
  formatNumber,
  getStockStatus,
} from '../utils/formatters.js'

export default function ProductsView({
  products,
  categories,
  filters,
  onFilterChange,
  onOpenNewProduct,
  onEditProduct,
  onDeleteProduct,
  onQuickMovement,
}) {
  return (
    <div className="view-stack">
      <div className="view-header">
        <div>
          <h1>Catálogo de Produtos</h1>
          <p>Gerencie todos os itens da casa, quantidades mínimas, locais e preços.</p>
        </div>
        <button type="button" className="btn btn-primary" onClick={onOpenNewProduct}>
          + Novo Produto
        </button>
      </div>

      <section className="panel toolbar-panel">
        <div className="toolbar-grid">
          <input
            type="search"
            className="input"
            placeholder="Buscar por nome, SKU ou local (ex: Despensa)..."
            value={filters.search}
            onChange={(e) => onFilterChange({ ...filters, search: e.target.value })}
          />

          <select
            className="input"
            value={filters.categoryId}
            onChange={(e) => onFilterChange({ ...filters, categoryId: e.target.value })}
          >
            <option value="">Todas as categorias</option>
            {categories.map((cat) => (
              <option key={cat.id} value={cat.id}>
                {cat.name}
              </option>
            ))}
          </select>

          <label className="checkbox-pill">
            <input
              type="checkbox"
              checked={filters.lowStock}
              onChange={(e) => onFilterChange({ ...filters, lowStock: e.target.checked })}
            />
            <span>Somente estoque baixo</span>
          </label>
        </div>
      </section>

      <section className="panel">
        {products.length === 0 ? (
          <div className="empty-box">
            Nenhum produto encontrado com os filtros atuais.
          </div>
        ) : (
          <div className="table-wrap">
            <table className="erp-table">
              <thead>
                <tr>
                  <th>Produto</th>
                  <th>Categoria</th>
                  <th>Local</th>
                  <th>Estoque</th>
                  <th>Status</th>
                  <th>Preço Unit.</th>
                  <th>Validade</th>
                  <th className="text-right">Ações</th>
                </tr>
              </thead>
              <tbody>
                {products.map((product) => {
                  const status = getStockStatus(product.quantity, product.min_quantity)
                  return (
                    <tr key={product.id}>
                      <td data-label="Produto">
                        <div className="product-cell">
                          <strong>{product.name}</strong>
                          <small>
                            {product.barcode
                              ? `EAN: ${product.barcode}`
                              : product.sku
                              ? `SKU: ${product.sku}`
                              : 'Sem código'}
                          </small>
                        </div>
                      </td>
                      <td data-label="Categoria">
                        {product.category_name ? (
                          <span
                            className="category-chip"
                            style={{ '--chip-color': product.category_color || '#3b82f6' }}
                          >
                            {product.category_name}
                          </span>
                        ) : (
                          <span className="text-muted">Sem categoria</span>
                        )}
                      </td>
                      <td data-label="Local">{product.location}</td>
                      <td data-label="Estoque">
                        <strong>
                          {formatNumber(product.quantity)} {product.unit}
                        </strong>
                        <small className="block-sub">
                          Mín: {formatNumber(product.min_quantity)} {product.unit}
                        </small>
                      </td>
                      <td data-label="Status">
                        <span className={`badge ${status.className}`}>{status.label}</span>
                      </td>
                      <td data-label="Preço unitário">
                        {formatCurrency(product.unit_price)}
                        {Number(product.previous_unit_price || 0) > 0 &&
                          Number(product.previous_unit_price) !== Number(product.unit_price) && (
                            <small className="block-sub text-muted">
                              Ant: {formatCurrency(product.previous_unit_price)}
                            </small>
                          )}
                        <small className="block-sub">
                          Total: {formatCurrency(product.quantity * product.unit_price)}
                        </small>
                      </td>
                      <td data-label="Validade">{formatDate(product.expiration_date)}</td>
                      <td className="text-right" data-label="Ações">
                        <div className="row-actions">
                          <button
                            type="button"
                            className="btn btn-xs btn-success"
                            title="Registrar entrada (compra)"
                            onClick={() => onQuickMovement(product, 'IN')}
                          >
                            + Entrada
                          </button>
                          <button
                            type="button"
                            className="btn btn-xs btn-warning"
                            title="Registrar saída (consumo)"
                            onClick={() => onQuickMovement(product, 'OUT')}
                          >
                            - Saída
                          </button>
                          <button
                            type="button"
                            className="btn btn-xs btn-secondary"
                            onClick={() => onEditProduct(product)}
                          >
                            Editar
                          </button>
                          <button
                            type="button"
                            className="btn btn-xs btn-danger"
                            onClick={() => onDeleteProduct(product)}
                          >
                            Excluir
                          </button>
                        </div>
                      </td>
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
