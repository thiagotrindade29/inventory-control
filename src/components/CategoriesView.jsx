import { useState } from 'react'

const PRESET_COLORS = ['#f59e0b', '#0ea5e9', '#10b981', '#8b5cf6', '#ec4899', '#ef4444', '#64748b']

export default function CategoriesView({ categories, onCreate, onUpdate, onDelete }) {
  const [editingId, setEditingId] = useState(null)
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [color, setColor] = useState('#3b82f6')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  function startEdit(category) {
    setEditingId(category.id)
    setName(category.name)
    setDescription(category.description || '')
    setColor(category.color || '#3b82f6')
    setError('')
  }

  function resetForm() {
    setEditingId(null)
    setName('')
    setDescription('')
    setColor('#3b82f6')
    setError('')
  }

  async function handleSubmit(e) {
    e.preventDefault()
    setError('')
    if (!name.trim()) {
      setError('Informe o nome da categoria.')
      return
    }

    setSaving(true)
    try {
      const payload = { name: name.trim(), description: description.trim() || null, color }
      if (editingId) {
        await onUpdate(editingId, payload)
      } else {
        await onCreate(payload)
      }
      resetForm()
    } catch (err) {
      setError(err.message)
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="view-stack">
      <div className="view-header">
        <div>
          <h1>Categorias da Casa</h1>
          <p>Organize seus produtos por grupos para filtrar rápido no catálogo.</p>
        </div>
      </div>

      <div className="categories-layout">
        <section className="panel">
          <h2>{editingId ? 'Editar Categoria' : 'Nova Categoria'}</h2>
          <form onSubmit={handleSubmit} className="category-form">
            {error && <div className="form-error">{error}</div>}

            <label className="field">
              <span>Nome *</span>
              <input
                type="text"
                className="input"
                placeholder="Ex: Ferramentas, Pet, Farmácia..."
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
              />
            </label>

            <label className="field">
              <span>Descrição</span>
              <input
                type="text"
                className="input"
                placeholder="Ex: Medicamentos e primeiros socorros"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
              />
            </label>

            <div className="field">
              <span>Cor de identificação</span>
              <div className="color-picker-row">
                {PRESET_COLORS.map((preset) => (
                  <button
                    key={preset}
                    type="button"
                    className={`color-swatch ${color === preset ? 'selected' : ''}`}
                    style={{ backgroundColor: preset }}
                    onClick={() => setColor(preset)}
                    aria-label={`Cor ${preset}`}
                  />
                ))}
                <input
                  type="color"
                  value={color}
                  onChange={(e) => setColor(e.target.value)}
                  className="color-native"
                  title="Escolher outra cor"
                />
              </div>
            </div>

            <div className="form-actions">
              {editingId && (
                <button type="button" className="btn btn-secondary" onClick={resetForm}>
                  Cancelar
                </button>
              )}
              <button type="submit" className="btn btn-primary" disabled={saving}>
                {saving ? 'Salvando...' : editingId ? 'Salvar Categoria' : 'Adicionar Categoria'}
              </button>
            </div>
          </form>
        </section>

        <section className="panel">
          <h2>Categorias Cadastradas ({categories.length})</h2>
          {categories.length === 0 ? (
            <div className="empty-box">Nenhuma categoria cadastrada.</div>
          ) : (
            <div className="table-wrap">
              <table className="erp-table">
                <thead>
                  <tr>
                    <th>Categoria</th>
                    <th>Descrição</th>
                    <th>Produtos</th>
                    <th className="text-right">Ações</th>
                  </tr>
                </thead>
                <tbody>
                  {categories.map((cat) => (
                    <tr key={cat.id}>
                      <td data-label="Categoria">
                        <span
                          className="category-chip"
                          style={{ '--chip-color': cat.color || '#3b82f6' }}
                        >
                          {cat.name}
                        </span>
                      </td>
                      <td className="text-muted" data-label="Descrição">{cat.description || '—'}</td>
                      <td data-label="Produtos">
                        <strong>{cat.product_count}</strong>
                      </td>
                      <td className="text-right" data-label="Ações">
                        <div className="row-actions">
                          <button
                            type="button"
                            className="btn btn-xs btn-secondary"
                            onClick={() => startEdit(cat)}
                          >
                            Editar
                          </button>
                          <button
                            type="button"
                            className="btn btn-xs btn-danger"
                            onClick={() => onDelete(cat)}
                          >
                            Excluir
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      </div>
    </div>
  )
}
