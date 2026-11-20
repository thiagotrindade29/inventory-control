# CasaERP — Sistema de Controle de Estoque Doméstico

Um sistema **ERP pessoal** para gestão e controle de estoque residencial, desenvolvido com **React + JavaScript** no frontend e **ASP.NET Core .NET 9 + Entity Framework Core + PostgreSQL** no backend.

---

## 🛠️ Tecnologias Utilizadas

- **Frontend:** React 19, Vite, CSS Moderno (Flexbox/Grid, CSS Variables)
- **Backend:** ASP.NET Core .NET 9, Entity Framework Core, Npgsql
- **Banco de Dados:** PostgreSQL 17 (com Triggers, Foreign Keys, Transações SQL e Constraints `CHECK`)
- **Qualidade de Código:** Oxlint, Vite Build

---

## 📐 Arquitetura do Sistema

```
inventory-control/
├── database/            # Scripts SQL (Modelagem e dados iniciais)
│   ├── schema.sql       # Tabelas (categories, products, stock_movements) + triggers
│   └── seed.sql         # Carga inicial de dados para testes
├── backend-dotnet/      # API REST ASP.NET Core
│   ├── InventoryControl.Api/          # Controllers, configuração e inicialização
│   ├── InventoryControl.Application/  # Serviços e DTOs
│   ├── InventoryControl.Domain/       # Entidades e regras de negócio
│   └── InventoryControl.Infrastructure/ # EF Core e acesso ao PostgreSQL
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

### 2. Configurar e Iniciar o Backend ASP.NET Core
1. Guarde a conexão do PostgreSQL em User Secrets (faça `init` uma vez):
   ```powershell
   dotnet user-secrets init --project backend-dotnet/InventoryControl.Api
   dotnet user-secrets set "ConnectionStrings:DefaultConnection" "Host=localhost;Port=5432;Database=home_erp;Username=postgres;Password=SUA_SENHA" --project backend-dotnet/InventoryControl.Api
   ```
2. Gere segredos locais para a autenticação. A chave JWT deve ser aleatória e ter pelo menos 32 bytes; a chave de configuração inicial protege a criação da primeira conta:
   ```powershell
   $jwtKey = [Convert]::ToBase64String([Security.Cryptography.RandomNumberGenerator]::GetBytes(48))
   $bootstrapKey = [Convert]::ToBase64String([Security.Cryptography.RandomNumberGenerator]::GetBytes(32))
   dotnet user-secrets set "Jwt:Key" $jwtKey --project backend-dotnet/InventoryControl.Api
   dotnet user-secrets set "Auth:BootstrapKey" $bootstrapKey --project backend-dotnet/InventoryControl.Api
   ```
   Para recuperar apenas a chave usada na primeira tela, execute `dotnet user-secrets get "Auth:BootstrapKey" --project backend-dotnet/InventoryControl.Api`. Não compartilhe esses segredos nem os salve no Git.
3. Inicie a API:
   ```powershell
   dotnet run --project backend-dotnet/InventoryControl.Api --launch-profile http
   ```
   *A API estará em `http://localhost:5000`. Na primeira inicialização, uma migração cria as tabelas de autenticação no schema PostgreSQL `auth`; as tabelas de estoque atuais permanecem intactas.*

---

### 3. Iniciar o Frontend (React)
1. Em outro terminal, na raiz do projeto, inicie o frontend:
   ```powershell
   npm.cmd run dev
   ```
2. Abra `http://localhost:5173`. O Vite encaminha `/api` para a API ASP.NET Core na porta `5000`. Na primeira abertura, informe a chave de configuração para criar a conta administradora. Depois, crie acessos adicionais pela aba **Usuários**.

#### Abrir no celular com HTTPS durante o desenvolvimento

O navegador do celular exige HTTPS confiável para liberar a câmera. `localhost` funciona no computador de desenvolvimento, mas `http://IP-DO-PC:5173` não é uma origem segura. Para acesso local sem expor o sistema à internet:

1. Instale [mkcert](https://github.com/FiloSottile/mkcert) no Windows com `winget install --exact --id FiloSottile.mkcert` e execute `mkcert -install` uma vez no computador.
2. Descubra o IPv4 do Wi-Fi do computador com `ipconfig` (por exemplo, `192.168.1.20`). Na raiz do projeto, gere um certificado para esse IP, substituindo o exemplo pelo endereço real:
   ```powershell
   New-Item -ItemType Directory -Force .cert
   mkcert -key-file .cert/dev-key.pem -cert-file .cert/dev-cert.pem localhost 127.0.0.1 192.168.1.20
   ```
3. Reinicie o Vite. Com os dois arquivos em `.cert/`, ele inicia em HTTPS e mantém o proxy para o backend .NET.
4. Transfira `.cert/rootCA.pem` para o celular, instale-o como certificado raiz e marque-o como confiável nas configurações do aparelho. Abra `https://192.168.1.20:5173` (usando o IP real). Computador e celular precisam estar na mesma rede Wi-Fi.

Não compartilhe `rootCA-key.pem` e não use esse certificado de desenvolvimento em produção. O código da antiga API Express foi removido; a API usada pelo projeto é ASP.NET Core. O importador de planilhas usa `.env.local` na raiz para suas credenciais.

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
   git checkout -b feat/backend-dotnet
   git add backend-dotnet/ vite.config.js
   git commit -m "feat: implementa API ASP.NET Core com PostgreSQL"
   git push -u origin feat/backend-dotnet
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
