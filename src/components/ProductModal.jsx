import { useState } from 'react'
import { LOCATION_SUGGESTIONS, UNIT_OPTIONS, toDateInputValue } from '../utils/formatters.js'

export default function ProductModal({ product, categories, onClose, onSave }) {
  const isEditing = Boolean(product)

  const [form, setForm] = useState({
    sku: product?.sku || '',
    name: product?.name || '',
    category_id: product?.category_id ? String(product.category_id) : '',
    location: product?.location || 'Despensa',
    unit: product?.unit || 'un',
    quantity: product ? String(product.quantity) : '1',
    min_quantity: product ? String(product.min_quantity) : '1',
    unit_price: product ? String(product.unit_price) : '0',
    expiration_date: toDateInputValue(product?.expiration_date),
    notes: product?.notes || '',
  })

  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  function handleChange(field, value) {
    setForm((prev) => ({ ...prev, [field]: value }))
  }

  async function handleSubmit(e) {
    e.preventDefault()
    setError('')

    if (!form.name.trim()) {
      setError('Informe o nome do produto.')
      return
    }

    setSaving(true)
    try {
      await onSave({
        sku: form.sku.trim() || null,
        name: form.name.trim(),
        category_id: form.category_id ? Number(form.category_id) : null,
        location: form.location.trim() || 'Despensa',
        unit: form.unit,
        quantity: Number(form.quantity || 0),
        min_quantity: Number(form.min_quantity || 0),
        unit_price: Number(form.unit_price || 0),
        expiration_date: form.expiration_date || null,
        notes: form.notes.trim() || null,
      })
    } catch (err) {
      setError(err.message)
      setSaving(false)
    }
  }

  return (
    <div className="modal-backdrop" role="dialog" aria-modal="true">
      <div className="modal-card modal-lg">
        <div className="modal-header">
          <div>
            <h2>{isEditing ? `Editar: ${product.name}` : 'Cadastrar Novo Produto'}</h2>
            <p>
              {isEditing
                ? 'Atualize os dados do catálogo. Alterar a quantidade registra um ajuste no histórico.'
                : 'Preencha os campos para adicionar o item ao inventário da casa.'}
            </p>
          </div>
          <button type="button" className="btn-close" onClick={onClose} aria-label="Fechar">
            ×
          </button>
        </div>

        <form onSubmit={handleSubmit} className="modal-body">
          {error && <div className="form-error">{error}</div>}

          <div className="form-grid">
            <label className="field field-span-2">
              <span>Nome do Produto *</span>
              <input
                type="text"
                className="input"
                placeholder="Ex: Arroz Tipo 1 (5kg)"
                value={form.name}
                onChange={(e) => handleChange('name', e.target.value)}
                required
                autoFocus
              />
            </label>

            <label className="field">
              <span>Código SKU (opcional)</span>
              <input
                type="text"
                className="input"
                placeholder="Ex: ALI-003"
                value={form.sku}
                onChange={(e) => handleChange('sku', e.target.value)}
              />
            </label>

            <label className="field">
              <span>Categoria</span>
              <select
                className="input"
                value={form.category_id}
                onChange={(e) => handleChange('category_id', e.target.value)}
              >
                <option value="">Sem categoria</option>
                {categories.map((cat) => (
                  <option key={cat.id} value={cat.id}>
                    {cat.name}
                  </option>
                ))}
              </select>
            </label>

            <label className="field">
              <span>Local na Casa</span>
              <input
                type="text"
                className="input"
                list="location-suggestions"
                value={form.location}
                onChange={(e) => handleChange('location', e.target.value)}
              />
              <datalist id="location-suggestions">
                {LOCATION_SUGGESTIONS.map((loc) => (
                  <option key={loc} value={loc} />
                ))}
              </datalist>
            </label>

            <label className="field">
              <span>Unidade de Medida</span>
              <select
                className="input"
                value={form.unit}
                onChange={(e) => handleChange('unit', e.target.value)}
              >
                {UNIT_OPTIONS.map((unit) => (
                  <option key={unit} value={unit}>
                    {unit}
                  </option>
                ))}
              </select>
            </label>

            <label className="field">
              <span>Quantidade Atual</span>
              <input
                type="number"
                step="0.01"
                min="0"
                className="input"
                value={form.quantity}
                onChange={(e) => handleChange('quantity', e.target.value)}
              />
            </label>

            <label className="field">
              <span>Estoque Mínimo (Alerta)</span>
              <input
                type="number"
                step="0.01"
                min="0"
                className="input"
                value={form.min_quantity}
                onChange={(e) => handleChange('min_quantity', e.target.value)}
              />
            </label>

            <label className="field">
              <span>Preço Unitário (R$)</span>
              <input
                type="number"
                step="0.01"
                min="0"
                className="input"
                value={form.unit_price}
                onChange={(e) => handleChange('unit_price', e.target.value)}
              />
            </label>

            <label className="field">
              <span>Data de Validade (opcional)</span>
              <input
                type="date"
                className="input"
                value={form.expiration_date}
                onChange={(e) => handleChange('expiration_date', e.target.value)}
              />
            </label>

            <label className="field field-span-2">
              <span>Observações</span>
              <textarea
                rows="2"
                className="input"
                placeholder="Marca preferida, supermercado onde costuma comprar..."
                value={form.notes}
                onChange={(e) => handleChange('notes', e.target.value)}
              />
            </label>
          </div>

          <div className="modal-footer">
            <button type="button" className="btn btn-secondary" onClick={onClose} disabled={saving}>
              Cancelar
            </button>
            <button type="submit" className="btn btn-primary" disabled={saving}>
              {saving ? 'Salvando...' : isEditing ? 'Salvar Alterações' : 'Cadastrar Produto'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
