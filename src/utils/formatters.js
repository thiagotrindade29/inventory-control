export const UNIT_OPTIONS = ['un', 'pct', 'cx', 'kg', 'g', 'L', 'ml']

export const LOCATION_SUGGESTIONS = [
  'Despensa',
  'Geladeira',
  'Freezer',
  'Armário Cozinha',
  'Lavanderia',
  'Banheiro',
  'Garagem / Ferramentas',
]

export function formatCurrency(value) {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  }).format(Number(value || 0))
}

export function formatNumber(value) {
  return new Intl.NumberFormat('pt-BR', {
    maximumFractionDigits: 2,
  }).format(Number(value || 0))
}

export function formatDate(dateString) {
  if (!dateString) return '—'
  const date = new Date(dateString)
  if (Number.isNaN(date.getTime())) return '—'
  return new Intl.DateTimeFormat('pt-BR', { timeZone: 'UTC' }).format(date)
}

export function formatDateTime(dateString) {
  if (!dateString) return '—'
  const date = new Date(dateString)
  if (Number.isNaN(date.getTime())) return '—'
  return new Intl.DateTimeFormat('pt-BR', {
    dateStyle: 'short',
    timeStyle: 'short',
  }).format(date)
}

export function toDateInputValue(dateString) {
  if (!dateString) return ''
  return String(dateString).slice(0, 10)
}

export function getStockStatus(quantity, minQuantity) {
  const qty = Number(quantity)
  const min = Number(minQuantity)
  if (qty <= 0) {
    return { key: 'empty', label: 'Sem estoque', className: 'badge-danger' }
  }
  if (qty <= min) {
    return { key: 'low', label: 'Estoque baixo', className: 'badge-warning' }
  }
  return { key: 'ok', label: 'Normal', className: 'badge-success' }
}

export function getMovementMeta(type) {
  if (type === 'IN') {
    return { label: 'Entrada', className: 'badge-success', sign: '+' }
  }
  if (type === 'OUT') {
    return { label: 'Saída', className: 'badge-danger', sign: '-' }
  }
  return { label: 'Ajuste', className: 'badge-info', sign: '±' }
}
