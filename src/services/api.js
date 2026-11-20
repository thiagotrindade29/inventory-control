const API_BASE = '/api'
const AUTH_TOKEN_KEY = 'inventory.accessToken'
const AUTH_USER_KEY = 'inventory.authUser'

export function setAuthSession(session) {
  sessionStorage.setItem(AUTH_TOKEN_KEY, session.accessToken)
  sessionStorage.setItem(AUTH_USER_KEY, JSON.stringify(session.user))
}

export function clearAuthSession() {
  sessionStorage.removeItem(AUTH_TOKEN_KEY)
  sessionStorage.removeItem(AUTH_USER_KEY)
}

export function getAuthSession() {
  const token = sessionStorage.getItem(AUTH_TOKEN_KEY)
  if (!token) return null
  try {
    return { accessToken: token, user: JSON.parse(sessionStorage.getItem(AUTH_USER_KEY) || 'null') }
  } catch {
    clearAuthSession()
    return null
  }
}

async function request(endpoint, options = {}) {
  const headers = new Headers(options.headers)
  if (!headers.has('Content-Type')) headers.set('Content-Type', 'application/json')
  const token = sessionStorage.getItem(AUTH_TOKEN_KEY)
  if (token && !endpoint.startsWith('/auth/')) headers.set('Authorization', `Bearer ${token}`)

  const response = await fetch(`${API_BASE}${endpoint}`, {
    ...options,
    headers,
  })

  if (response.status === 204) {
    return null
  }

  const data = await response.json().catch(() => null)

  if (response.status === 401 && token) clearAuthSession()

  if (!response.ok) {
    const validationErrors = data?.errors
    const validationMessage = Array.isArray(validationErrors)
      ? validationErrors.join(' ')
      : validationErrors && typeof validationErrors === 'object'
        ? Object.values(validationErrors).flat().filter(Boolean).join(' ')
        : ''
    const message = data?.error || validationMessage || data?.message || data?.title || 'Erro ao comunicar com o servidor.'
    const error = new Error(message)
    error.data = data
    error.status = response.status
    throw error
  }

  return data
}

export const api = {
  getAuthStatus: () => request('/auth/status'),
  setupAdmin: (payload) => request('/auth/setup', { method: 'POST', body: JSON.stringify(payload) }),
  login: (payload) => request('/auth/login', { method: 'POST', body: JSON.stringify(payload) }),
  getUsers: () => request('/users'),
  createUser: (payload) => request('/users', { method: 'POST', body: JSON.stringify(payload) }),
  deleteUser: (id) => request(`/users/${encodeURIComponent(id)}`, { method: 'DELETE' }),

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

  parseNfeXml: (xml) =>
    request('/nfe/parse-xml', { method: 'POST', body: JSON.stringify({ xml }) }),
  parseNfeUrl: (url) =>
    request('/nfe/parse-url', { method: 'POST', body: JSON.stringify({ url }) }),
  parseNfeText: (text) =>
    request('/nfe/parse-text', { method: 'POST', body: JSON.stringify({ text }) }),
}
