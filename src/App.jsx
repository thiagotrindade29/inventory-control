import { useCallback, useEffect, useState } from 'react'
import './App.css'
import AuthView from './components/AuthView.jsx'
import UsersView from './components/UsersView.jsx'
import CategoriesView from './components/CategoriesView.jsx'
import DashboardView from './components/DashboardView.jsx'
import FinancialView from './components/FinancialView.jsx'
import MarketModeView from './components/MarketModeView.jsx'
import MovementModal from './components/MovementModal.jsx'
import MovementsView from './components/MovementsView.jsx'
import NfeImportModal from './components/NfeImportModal.jsx'
import ProductModal from './components/ProductModal.jsx'
import ProductsView from './components/ProductsView.jsx'
import Sidebar from './components/Sidebar.jsx'
import { api, clearAuthSession, getAuthSession, setAuthSession } from './services/api.js'

function App() {
  const [authChecked, setAuthChecked] = useState(false)
  const [setupRequired, setSetupRequired] = useState(false)
  const [authUser, setAuthUser] = useState(() => getAuthSession()?.user || null)
  const [activeTab, setActiveTab] = useState('dashboard')
  const [apiOnline, setApiOnline] = useState(false)
  const [loading, setLoading] = useState(true)
  const [toast, setToast] = useState(null)
  const [nfeModalOpen, setNfeModalOpen] = useState(false)

  const [dashboard, setDashboard] = useState(null)
  const [categories, setCategories] = useState([])
  const [products, setProducts] = useState([])
  const [allProducts, setAllProducts] = useState([])
  const [movements, setMovements] = useState([])
  const [financialData, setFinancialData] = useState(null)

  const [filters, setFilters] = useState({
    search: '',
    categoryId: '',
    lowStock: false,
  })

  const [productModal, setProductModal] = useState({ open: false, product: null })
  const [movementModal, setMovementModal] = useState({
    open: false,
    product: null,
    type: 'IN',
  })

  useEffect(() => {
    api.getAuthStatus()
      .then((status) => setSetupRequired(status.setupRequired))
      .catch(() => setSetupRequired(false))
      .finally(() => setAuthChecked(true))
  }, [])

  const showToast = useCallback((message, variant = 'success') => {
    setToast({ message, variant })
    setTimeout(() => {
      setToast((current) => (current?.message === message ? null : current))
    }, 3500)
  }, [])

  const loadCoreData = useCallback(async (currentFilters) => {
    try {
      await api.getHealth()
      setApiOnline(true)

      const [dashData, catData, filteredProducts, catalogProducts, movData, finData] =
        await Promise.all([
          api.getDashboard(),
          api.getCategories(),
          api.getProducts(currentFilters),
          api.getProducts(),
          api.getMovements(100),
          api.getFinancial().catch(() => null),
        ])

      setDashboard(dashData)
      setCategories(catData)
      setProducts(filteredProducts)
      setAllProducts(catalogProducts)
      setMovements(movData)
      setFinancialData(finData)
    } catch {
      setApiOnline(false)
      if (!getAuthSession()) setAuthUser(null)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    if (!authChecked || !getAuthSession()) {
      setLoading(false)
      return
    }
    loadCoreData(filters)
  }, [authChecked, authUser, loadCoreData, filters])

  function handleAuthenticated(session) {
    setAuthSession(session)
    setAuthUser(session.user)
    setSetupRequired(false)
    setLoading(true)
  }

  function handleLogout() {
    clearAuthSession()
    setAuthUser(null)
    setApiOnline(false)
    setLoading(false)
  }

  function handleNavigate(tab, options = {}) {
    setActiveTab(tab)
    if (tab === 'products' && options.onlyLowStock) {
      setFilters((prev) => ({ ...prev, lowStock: true }))
    }
  }

  async function handleSaveProduct(payload) {
    if (productModal.product) {
      await api.updateProduct(productModal.product.id, payload)
      showToast(`Produto "${payload.name}" atualizado!`)
    } else {
      await api.createProduct(payload)
      showToast(`Produto "${payload.name}" cadastrado!`)
    }
    setProductModal({ open: false, product: null })
    await loadCoreData(filters)
  }

  async function handleDeleteProduct(product) {
    const confirmed = window.confirm(
      `Deseja excluir "${product.name}"? O histórico de movimentações dele também será removido.`
    )
    if (!confirmed) return

    try {
      await api.deleteProduct(product.id)
      showToast(`Produto "${product.name}" removido.`)
      await loadCoreData(filters)
    } catch (err) {
      showToast(err.message, 'error')
    }
  }

  async function handleSaveMovement(payload) {
    await api.createMovement(payload)
    showToast(
      payload.type === 'IN'
        ? 'Entrada registrada no estoque!'
        : 'Saída registrada no estoque!'
    )
    setMovementModal({ open: false, product: null, type: 'IN' })
    await loadCoreData(filters)
  }

  async function handleCreateCategory(payload) {
    await api.createCategory(payload)
    showToast(`Categoria "${payload.name}" criada!`)
    await loadCoreData(filters)
  }

  async function handleUpdateCategory(id, payload) {
    await api.updateCategory(id, payload)
    showToast(`Categoria "${payload.name}" atualizada!`)
    await loadCoreData(filters)
  }

  async function handleDeleteCategory(category) {
    const confirmed = window.confirm(
      `Excluir a categoria "${category.name}"? Os produtos vinculados ficarão sem categoria.`
    )
    if (!confirmed) return

    try {
      await api.deleteCategory(category.id)
      showToast(`Categoria "${category.name}" removida.`)
      await loadCoreData(filters)
    } catch (err) {
      showToast(err.message, 'error')
    }
  }

  async function handleFinishPurchase(payload) {
    const result = await api.createPurchase(payload)
    showToast(`Compra de R$ ${Number(result.total_amount).toFixed(2)} finalizada com sucesso!`)
    await loadCoreData(filters)
    return result
  }

  if (!authChecked) {
    return <main className="auth-screen"><p>Verificando acesso…</p></main>
  }

  if (!authUser || !getAuthSession()) {
    return <AuthView setupRequired={setupRequired} onAuthenticated={handleAuthenticated} />
  }

  return (
    <div className="erp-shell">
      <Sidebar
        activeTab={activeTab}
        onSelectTab={setActiveTab}
        apiOnline={apiOnline}
        lowStockCount={dashboard?.summary?.low_stock_count || 0}
        onOpenNfeModal={() => setNfeModalOpen(true)}
        authUser={authUser}
        onLogout={handleLogout}
      />

      <main className="erp-main">
        {!apiOnline && !loading && (
          <div className="connection-banner">
            <div>
              <strong>API não encontrada</strong>
              <p>
                Inicie a API ASP.NET Core executando{' '}
                <code>dotnet run --project backend-dotnet/InventoryControl.Api --launch-profile http</code>{' '}
                na raiz e confirme a conexão com o PostgreSQL.
              </p>
            </div>
            <button
              type="button"
              className="btn btn-sm btn-secondary"
              onClick={() => loadCoreData(filters)}
            >
              Tentar novamente
            </button>
          </div>
        )}

        {loading ? (
          <div className="loading-state">Carregando dados do PostgreSQL...</div>
        ) : (
          <>
            {activeTab === 'dashboard' && (
              <DashboardView
                dashboard={dashboard}
                onNavigate={handleNavigate}
                onOpenNewProduct={() => setProductModal({ open: true, product: null })}
                onQuickMovement={(product, type) =>
                  setMovementModal({ open: true, product, type })
                }
              />
            )}

            {activeTab === 'products' && (
              <ProductsView
                products={products}
                categories={categories}
                filters={filters}
                onFilterChange={setFilters}
                onOpenNewProduct={() => setProductModal({ open: true, product: null })}
                onEditProduct={(product) => setProductModal({ open: true, product })}
                onDeleteProduct={handleDeleteProduct}
                onQuickMovement={(product, type) =>
                  setMovementModal({ open: true, product, type })
                }
              />
            )}

            {activeTab === 'movements' && (
              <MovementsView
                movements={movements}
                hasProducts={allProducts.length > 0}
                onOpenNewMovement={() =>
                  setMovementModal({ open: true, product: null, type: 'IN' })
                }
              />
            )}

            {activeTab === 'categories' && (
              <CategoriesView
                categories={categories}
                onCreate={handleCreateCategory}
                onUpdate={handleUpdateCategory}
                onDelete={handleDeleteCategory}
              />
            )}

            {activeTab === 'market' && (
              <MarketModeView
                products={allProducts}
                categories={categories}
                onFinishPurchase={handleFinishPurchase}
                onNavigate={handleNavigate}
              />
            )}

            {activeTab === 'finance' && (
              <FinancialView
                financialData={financialData}
                onRefresh={() => loadCoreData(filters)}
                onNavigate={handleNavigate}
              />
            )}

            {activeTab === 'users' && authUser.roles?.includes('Admin') && <UsersView />}
          </>
        )}
      </main>

      {productModal.open && (
        <ProductModal
          product={productModal.product}
          categories={categories}
          onClose={() => setProductModal({ open: false, product: null })}
          onSave={handleSaveProduct}
        />
      )}

      {movementModal.open && (
        <MovementModal
          products={allProducts}
          initialProduct={movementModal.product}
          initialType={movementModal.type}
          onClose={() => setMovementModal({ open: false, product: null, type: 'IN' })}
          onSave={handleSaveMovement}
        />
      )}

      {nfeModalOpen && (
        <NfeImportModal
          categories={categories}
          onClose={() => setNfeModalOpen(false)}
          onImportSuccess={handleFinishPurchase}
        />
      )}

      {toast && (
        <div className={`toast ${toast.variant === 'error' ? 'toast-error' : 'toast-success'}`}>
          {toast.message}
        </div>
      )}
    </div>
  )
}

export default App
