const NAV_ITEMS = [
  { id: 'dashboard', label: 'Visão Geral', icon: 'dashboard' },
  { id: 'products', label: 'Produtos', icon: 'products' },
  { id: 'market', label: 'Modo Mercado', icon: 'market' },
  { id: 'finance', label: 'Análise Financeira', icon: 'finance' },
  { id: 'movements', label: 'Movimentações', icon: 'movements' },
  { id: 'categories', label: 'Categorias', icon: 'categories' },
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
}) {
  return (
    <aside className="erp-sidebar">
      <div className="sidebar-brand">
        <div className="brand-logo">CE</div>
        <div>
          <strong>Casa Financeira </strong>
          <span>Controle Pessoal</span>
        </div>
      </div>

      <nav className="sidebar-nav" aria-label="Menu principal">
        {NAV_ITEMS.map((item) => {
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
            <small>{apiOnline ? 'Porta 5432 • home_erp' : 'Inicie o backend em /server'}</small>
          </div>
        </div>
      </div>
    </aside>
  )
}
