import { useState } from 'react'

const NAV_ITEMS = [
  { id: 'dashboard', label: 'Visão Geral', icon: 'dashboard' },
  { id: 'products', label: 'Produtos', icon: 'products' },
  { id: 'market', label: 'Modo Mercado', icon: 'market' },
  { id: 'finance', label: 'Análise Financeira', icon: 'finance' },
  { id: 'movements', label: 'Movimentações', icon: 'movements' },
  { id: 'categories', label: 'Categorias', icon: 'categories' },
  { id: 'users', label: 'Usuários', icon: 'users' },
]

function NavIcon({ name }) {
  if (name === 'dashboard') {
    return (
      <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2">
        <rect x="3" y="3" width="7" height="9" rx="1.5" />
        <rect x="14" y="3" width="7" height="5" rx="1.5" />
        <rect x="14" y="12" width="7" height="9" rx="1.5" />
        <rect x="3" y="16" width="7" height="5" rx="1.5" />
      </svg>
    )
  }
  if (name === 'products') {
    return (
      <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2">
        <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z" />
        <polyline points="3.27 6.96 12 12.01 20.73 6.96" />
        <line x1="12" y1="22.08" x2="12" y2="12" />
      </svg>
    )
  }
  if (name === 'market') {
    return (
      <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2">
        <circle cx="9" cy="21" r="1" />
        <circle cx="20" cy="21" r="1" />
        <path d="M1 1h4l2.68 13.39a2 2 0 0 0 2 1.61h9.72a2 2 0 0 0 2-1.61L23 6H6" />
      </svg>
    )
  }
  if (name === 'finance') {
    return (
      <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2">
        <line x1="12" y1="1" x2="12" y2="23" />
        <path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6" />
      </svg>
    )
  }
  if (name === 'movements') {
    return (
      <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2">
        <polyline points="17 1 21 5 17 9" />
        <path d="M3 11V9a4 4 0 0 1 4-4h14" />
        <polyline points="7 23 3 19 7 15" />
        <path d="M21 13v2a4 4 0 0 1-4 4H3" />
      </svg>
    )
  }
  return (
    <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M4 6h16M4 12h16M4 18h10" />
    </svg>
  )
}

export default function Sidebar({
  activeTab,
  onSelectTab,
  apiOnline,
  lowStockCount,
  onOpenNfeModal,
  authUser,
  onLogout,
}) {
  const [moreOpen, setMoreOpen] = useState(false)
  const primaryItems = NAV_ITEMS.slice(0, 4)
  const secondaryItems = NAV_ITEMS.slice(4).filter((item) => item.id !== 'users' || authUser?.roles?.includes('Admin'))

  function selectTab(id) {
    onSelectTab(id)
    setMoreOpen(false)
  }

  function openNfe() {
    onOpenNfeModal()
    setMoreOpen(false)
  }

  return (
    <aside className="erp-sidebar">
      <div className="sidebar-brand">
        <img className="brand-logo" src="/astrogestao.svg" alt="" aria-hidden="true" />
        <div>
          <strong>AstroGestão</strong>
          <span>Estoque e finanças</span>
        </div>
      </div>

      <nav className="sidebar-nav" aria-label="Menu principal">
        <span className="nav-section-label">ESPAÇO DE TRABALHO</span>
        {NAV_ITEMS.filter((item) => ['dashboard', 'products', 'market', 'finance'].includes(item.id)).map((item) => {
          const isActive = activeTab === item.id
          return (
            <button
              key={item.id}
              type="button"
              className={`nav-item ${isActive ? 'active' : ''}`}
              onClick={() => onSelectTab(item.id)}
            >
              <NavIcon name={item.icon} />
              <span>{item.label}</span>
              {item.id === 'products' && lowStockCount > 0 && (
                <span className="nav-badge" title="Itens em estoque baixo">
                  {lowStockCount}
                </span>
              )}
            </button>
          )
        })}

        <span className="nav-section-label nav-section-management">GESTÃO</span>
        {NAV_ITEMS.filter((item) => ['movements', 'categories', 'users'].includes(item.id) && (item.id !== 'users' || authUser?.roles?.includes('Admin'))).map((item) => {
          const isActive = activeTab === item.id
          return (
            <button key={item.id} type="button" className={`nav-item ${isActive ? 'active' : ''}`} onClick={() => onSelectTab(item.id)}>
              <NavIcon name={item.icon} />
              <span>{item.label}</span>
            </button>
          )
        })}

        <div className="sidebar-divider" />

        <button
          type="button"
          className="nav-item btn-nfe-nav"
          onClick={onOpenNfeModal}
          title="Importe compras de mercado direto para o estoque via foto ou QR Code"
        >
          <span className="nfe-icon-pill">🧾</span>
          <span>Importar Cupom / NF-e</span>
        </button>
      </nav>

      <div className="sidebar-footer">
        <div className={`db-status ${apiOnline ? 'online' : 'offline'}`}>
          <span className="status-dot" />
          <div>
            <strong>{apiOnline ? 'PostgreSQL Conectado' : 'API Offline'}</strong>
            <small>{apiOnline ? 'Banco de dados conectado' : 'API offline'}</small>
          </div>
        </div>
        <div className="sidebar-account">
          <span>{authUser?.displayName}</span>
          <button type="button" onClick={onLogout}>Sair</button>
        </div>
      </div>

      <nav className="mobile-bottom-nav" aria-label="Navegação móvel">
        {primaryItems.map((item) => (
          <button key={item.id} type="button" className={`mobile-nav-item ${activeTab === item.id ? 'active' : ''}`} onClick={() => selectTab(item.id)}>
            <NavIcon name={item.icon} />
            <span>{item.id === 'dashboard' ? 'Início' : item.id === 'market' ? 'Mercado' : item.id === 'finance' ? 'Finanças' : item.label}</span>
            {item.id === 'products' && lowStockCount > 0 && <span className="mobile-nav-badge">{lowStockCount}</span>}
          </button>
        ))}
        <button type="button" className={`mobile-nav-item ${moreOpen || secondaryItems.some((item) => activeTab === item.id) ? 'active' : ''}`} aria-expanded={moreOpen} aria-controls="mobile-more-menu" onClick={() => setMoreOpen((open) => !open)}>
          <NavIcon name="categories" />
          <span>Mais</span>
        </button>
      </nav>
      {moreOpen && <>
        <button className="mobile-more-backdrop" type="button" aria-label="Fechar menu" onClick={() => setMoreOpen(false)} />
        <div className="mobile-more-menu" id="mobile-more-menu">
          {secondaryItems.map((item) => <button key={item.id} type="button" onClick={() => selectTab(item.id)}><NavIcon name={item.icon} />{item.label}</button>)}
          <button type="button" onClick={openNfe}><span className="nfe-icon-pill">🧾</span>Importar Cupom / NF-e</button>
          <button type="button" onClick={onLogout}>Sair da conta</button>
        </div>
      </>}
    </aside>
  )
}
