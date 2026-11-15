import { useState } from 'react'
import { formatNumber } from '../utils/formatters.js'

export default function MovementModal({
  products,
  initialProduct = null,
  initialType = 'IN',
  onClose,
  onSave,
}) {
  const [productId, setProductId] = useState(
    initialProduct ? String(initialProduct.id) : products[0] ? String(products[0].id) : ''
  )
  const [type, setType] = useState(initialType)
  const [quantity, setQuantity] = useState('1')
  const [reason, setReason] = useState(
    initialType === 'IN' ? 'Compra de reposição' : 'Consumo em casa'
  )
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  const selectedProduct = products.find((p) => String(p.id) === productId)
  const currentQty = Number(selectedProduct?.quantity || 0)
  const delta = Number(quantity || 0)
  const projectedQty = type === 'IN' ? currentQty + delta : currentQty - delta

  async function handleSubmit(e) {
    e.preventDefault()
    setError('')

    if (!productId) {
      setError('Selecione um produto.')
      return
    }
    if (Number.isNaN(delta) || delta <= 0) {
      setError('A quantidade deve ser maior que zero.')
      return
    }
    if (type === 'OUT' && projectedQty < 0) {
      setError(`Saldo insuficiente. Estoque atual: ${formatNumber(currentQty)}`)
      return
    }

    setSaving(true)
    try {
      await onSave({
        product_id: Number(productId),
        type,
        quantity: delta,
        reason: reason.trim() || null,
      })
    } catch (err) {
      setError(err.message)
      setSaving(false)
    }
  }

  return (
    <div className="modal-backdrop" role="dialog" aria-modal="true">
      <div className="modal-card">
        <div className="modal-header">
          <div>
            <h2>Registrar Movimentação</h2>
            <p>Atualize o saldo e grave a auditoria no histórico.</p>
          </div>
          <button type="button" className="btn-close" onClick={onClose} aria-label="Fechar">
            ×
          </button>
        </div>

        <form onSubmit={handleSubmit} className="modal-body">
          {error && <div className="form-error">{error}</div>}

          <div className="type-toggle">
            <button
              type="button"
              className={`toggle-btn ${type === 'IN' ? 'active-in' : ''}`}
              onClick={() => {
                setType('IN')
                if (reason === 'Consumo em casa') setReason('Compra de reposição')
              }}
            >
              + Entrada (Compra)
            </button>
            <button
              type="button"
              className={`toggle-btn ${type === 'OUT' ? 'active-out' : ''}`}
              onClick={() => {
                setType('OUT')
                if (reason === 'Compra de reposição') setReason('Consumo em casa')
              }}
            >
              - Saída (Consumo)
            </button>
          </div>

          <label className="field">
            <span>Produto</span>
            <select
              className="input"
              value={productId}
              onChange={(e) => setProductId(e.target.value)}
            >
              {products.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name} (Atual: {formatNumber(p.quantity)} {p.unit})
                </option>
              ))}
            </select>
          </label>

          <label className="field">
            <span>Quantidade ({selectedProduct?.unit || 'un'})</span>
            <input
              type="number"
              step="0.01"
              min="0.01"
              className="input"
              value={quantity}
              onChange={(e) => setQuantity(e.target.value)}
              required
              autoFocus
            />
          </label>

          <label className="field">
            <span>Motivo / Observação</span>
            <input
              type="text"
              className="input"
              placeholder="Ex: Compra mensal, Uso na cozinha..."
              value={reason}
              onChange={(e) => setReason(e.target.value)}
            />
          </label>

          {selectedProduct && (
            <div className={`projection-box ${projectedQty < 0 ? 'invalid' : ''}`}>
              <span>Saldo previsto após movimentação:</span>
              <strong>
                {formatNumber(currentQty)} → {formatNumber(projectedQty)} {selectedProduct.unit}
              </strong>
            </div>
          )}

          <div className="modal-footer">
            <button type="button" className="btn btn-secondary" onClick={onClose} disabled={saving}>
              Cancelar
            </button>
            <button
              type="submit"
              className={`btn ${type === 'IN' ? 'btn-success' : 'btn-warning'}`}
              disabled={saving}
            >
              {saving ? 'Registrando...' : type === 'IN' ? 'Confirmar Entrada' : 'Confirmar Saída'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
