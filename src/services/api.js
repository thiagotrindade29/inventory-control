const API_BASE = '/api'

async function request(endpoint, options = {}) {
  const response = await fetch(`${API_BASE}${endpoint}`, {
    headers: {
      'Content-Type': 'application/json',
      ...options.headers,
    },
    ...options,
  })

  if (response.status === 204) {
    return null
  }

  const data = await response.json().catch(() => null)

  if (!response.ok) {
    throw new Error(data?.error || 'Erro ao comunicar com o servidor.')
  }

  return data
}

export const api = {
  getHealth: () => request('/health'),

  getDashboard: () => request('/dashboard'),

  getCategories: () => request('/categories'),
  createCategory: (payload) =>
    request('/categories', { method: 'POST', body: JSON.stringify(payload) }),
  updateCategory: (id, payload) =>
    request(`/categories/${id}`, { method: 'PUT', body: JSON.stringify(payload) }),
  deleteCategory: (id) => request(`/categories/${id}`, { method: 'DELETE' }),

  getProducts: (filters = {}) => {
    const params = new URLSearchParams()
    if (filters.search) params.set('search', filters.search)
    if (filters.categoryId) params.set('categoryId', filters.categoryId)
    if (filters.lowStock) params.set('lowStock', 'true')
    const query = params.toString()
    return request(`/products${query ? `?${query}` : ''}`)
  },
  createProduct: (payload) =>
    request('/products', { method: 'POST', body: JSON.stringify(payload) }),
  updateProduct: (id, payload) =>
    request(`/products/${id}`, { method: 'PUT', body: JSON.stringify(payload) }),
  deleteProduct: (id) => request(`/products/${id}`, { method: 'DELETE' }),

  getMovements: (limit = 100) => request(`/movements?limit=${limit}`),
  createMovement: (payload) =>
    request('/movements', { method: 'POST', body: JSON.stringify(payload) }),

  getPurchases: () => request('/purchases'),
  getPurchase: (id) => request(`/purchases/${id}`),
  createPurchase: (payload) =>
    request('/purchases', { method: 'POST', body: JSON.stringify(payload) }),

  getFinancial: () => request('/financial'),
}
