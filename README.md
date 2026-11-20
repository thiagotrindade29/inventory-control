# CasaERP — Sistema de Controle de Estoque Doméstico

Um sistema **ERP pessoal** completo para gestão e controle de estoque residencial, desenvolvido com **React + JavaScript** no frontend e **Node.js + Express + PostgreSQL** no backend.

---

## 🛠️ Tecnologias Utilizadas

- **Frontend:** React 19, Vite, CSS Moderno (Flexbox/Grid, CSS Variables)
- **Backend:** Node.js (ES Modules), Express.js, `pg` (Node Postgres Pool), `dotenv`, `cors`
- **Banco de Dados:** PostgreSQL 17 (com Triggers, Foreign Keys, Transações SQL e Constraints `CHECK`)
- **Qualidade de Código:** Oxlint, Vite Build

---

## 📐 Arquitetura do Sistema

```
inventory-control/
├── database/            # Scripts SQL (Modelagem e dados iniciais)
│   ├── schema.sql       # Tabelas (categories, products, stock_movements) + triggers
│   └── seed.sql         # Carga inicial de dados para testes
├── server/              # API Backend REST em Express
│   ├── src/
│   │   ├── db.js        # Pool de conexão PostgreSQL
│   │   ├── index.js     # Servidor Express e rotas principais
│   │   └── routes/      # Endpoints (categories, products, movements, dashboard)
│   ├── .env.example     # Exemplo de variáveis de ambiente
│   └── package.json
├── src/                 # Frontend React (ERP UI)
│   ├── components/      # Sidebar, DashboardView, ProductsView, ProductModal, etc.
│   ├── services/        # Cliente de API fetch (`api.js`)
│   ├── utils/           # Formatadores de moeda, data, números e badges
│   ├── App.jsx          # Componente principal e estado global
│   └── App.css          # Estilização completa do ERP
├── vite.config.js       # Configuração do Vite com proxy para /api
└── README.md
```

---

## 🚀 Como Executar o Projeto Passo a Passo

### 1. Configurar o Banco de Dados (PostgreSQL)
1. Instale o PostgreSQL 17 localmente (ou via `winget install PostgreSQL.PostgreSQL.17`).
2. Abra o **pgAdmin 4** ou terminal `psql` e crie o banco de dados `home_erp`:
   ```sql
   CREATE DATABASE home_erp;
   ```
3. Execute os scripts SQL da pasta `database/`:
   ```powershell
   psql -U postgres -d home_erp -f database/schema.sql
   psql -U postgres -d home_erp -f database/seed.sql
   ```

---

### 2. Configurar e Iniciar o Backend (API)
1. Acesse a pasta `server/`:
   ```powershell
   cd server
   ```
2. Crie o arquivo `.env` baseado no `.env.example`:
   ```env
   PORT=3001
   DB_HOST=localhost
   DB_PORT=5432
   DB_NAME=home_erp
   DB_USER=postgres
   DB_PASSWORD=sua_senha_do_postgres
   ```
3. Instale as dependências e inicie o servidor:
   ```powershell
   npm.cmd install
   npm.cmd run dev
   ```
   *A API estará rodando em `http://localhost:3001`.*

---

### 3. Iniciar o Frontend (React)
1. Na raiz do projeto (`inventory-control/`), inicie o servidor do Vite:
   ```powershell
   npm.cmd run dev
   ```
2. Abra o navegador em `http://localhost:5173`. O React se conectará automaticamente à API através do proxy do Vite.

Para testar o leitor de câmera no próprio computador, `localhost` é suficiente. Para testar em um celular, use uma origem HTTPS com certificado confiável (por exemplo, um túnel HTTPS apontando para a porta `5173`). A opção `host: true` permite acesso pela rede local, mas acessar o IP do computador por HTTP não libera a câmera do navegador.

O projeto também contém uma API alternativa em .NET. A aplicação React deste README usa a API Express de `server/`. Se executar a API .NET, configure `ConnectionStrings__DefaultConnection` por variável de ambiente ou User Secrets; a connection string não deve ser gravada no `appsettings.json`.

---

## 🔀 Guia de Branches para o GitHub

Para subir no seu repositório no GitHub seguindo as fases do aprendizado:

1. **Fase 1 — Banco de Dados:**
   ```powershell
   git checkout -b feat/database-schema
   git add database/
   git commit -m "feat: adiciona modelagem e seed do PostgreSQL"
   git push -u origin feat/database-schema
   ```

2. **Fase 2 — Backend API:**
   ```powershell
   git checkout -b feat/backend-api
   git add server/ vite.config.js
   git commit -m "feat: implementa API Express com rotas e transacoes PostgreSQL"
   git push -u origin feat/backend-api
   ```

3. **Fase 3 — Frontend ERP:**
   ```powershell
   git checkout -b feat/frontend-erp
   git add src/ README.md
   git commit -m "feat: desenvolve interface ERP em React com Dashboard e CRUDs"
   git push -u origin feat/frontend-erp
   ```

---

## 💡 Funcionalidades do ERP Doméstico

- **Dashboard Integrado:** KPIs com contagem de produtos, valor estimado total em reais, lista de reposição automática para itens com estoque baixo e alertas de vencimento em 30 dias.
- **Gestão de Produtos (CRUD):** Busca em tempo real, filtro por categoria e chave de filtro para itens com estoque baixo.
- **Movimentações com Auditoria:** Registra entradas (compras), saídas (consumo) e ajustes com recálculo automático de saldo e histórico completo.
- **Categorias Personalizadas:** Agrupamento por setores da casa com identificadores visuais coloridos.
