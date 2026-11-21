-- ============================================================================
-- MODELAGEM DO BANCO DE DADOS (PostgreSQL) - MINI-ERP DOMÉSTICO + FINANCEIRO
-- ============================================================================

CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 1. Tabela de Categorias
CREATE TABLE IF NOT EXISTS categories (
  id          SERIAL PRIMARY KEY,
  organization_id INTEGER NOT NULL DEFAULT 1,
  name        VARCHAR(80) NOT NULL,
  description VARCHAR(255),
  color       VARCHAR(20) NOT NULL DEFAULT '#3b82f6',
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 2. Tabela de Produtos (Catálogo + Estoque + Preço Anterior para Comparativo)
CREATE TABLE IF NOT EXISTS products (
  id                  SERIAL PRIMARY KEY,
  organization_id     INTEGER NOT NULL DEFAULT 1,
  sku                 VARCHAR(60),
  barcode             VARCHAR(60),
  name                VARCHAR(150) NOT NULL,
  category_id         INTEGER REFERENCES categories(id) ON DELETE SET NULL,
  location            VARCHAR(80) NOT NULL DEFAULT 'Despensa',
  unit                VARCHAR(20) NOT NULL DEFAULT 'un',
  quantity            NUMERIC(10, 2) NOT NULL DEFAULT 0 CHECK (quantity >= 0),
  min_quantity        NUMERIC(10, 2) NOT NULL DEFAULT 1 CHECK (min_quantity >= 0),
  unit_price          NUMERIC(10, 2) NOT NULL DEFAULT 0 CHECK (unit_price >= 0),
  previous_unit_price NUMERIC(10, 2) DEFAULT 0 CHECK (previous_unit_price >= 0),
  expiration_date     DATE,
  notes               TEXT,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Códigos próprios de cada mercado vinculados ao produto canônico do estoque.
CREATE TABLE IF NOT EXISTS product_identifiers (
  id          SERIAL PRIMARY KEY,
  organization_id INTEGER NOT NULL DEFAULT 1,
  product_id  INTEGER NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  market_name VARCHAR(120) NOT NULL,
  code        VARCHAR(80) NOT NULL,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT ux_product_identifiers_org_market_code UNIQUE (organization_id, market_name, code)
);
CREATE INDEX IF NOT EXISTS ix_product_identifiers_product_id ON product_identifiers(product_id);

-- Garantir colunas adicionais caso a tabela já existisse
ALTER TABLE products DROP CONSTRAINT IF EXISTS products_sku_key;
ALTER TABLE products ALTER COLUMN sku TYPE VARCHAR(60);
ALTER TABLE products ADD COLUMN IF NOT EXISTS barcode VARCHAR(60);
ALTER TABLE products ADD COLUMN IF NOT EXISTS previous_unit_price NUMERIC(10, 2) DEFAULT 0 CHECK (previous_unit_price >= 0);

DROP TRIGGER IF EXISTS trg_products_updated_at ON products;
CREATE TRIGGER trg_products_updated_at
  BEFORE UPDATE ON products
  FOR EACH ROW
  EXECUTE FUNCTION set_updated_at();

-- 3. Tabela de Movimentações de Estoque
CREATE TABLE IF NOT EXISTS stock_movements (
  id                SERIAL PRIMARY KEY,
  organization_id   INTEGER NOT NULL DEFAULT 1,
  product_id        INTEGER NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  type              VARCHAR(10) NOT NULL CHECK (type IN ('IN', 'OUT', 'ADJUST')),
  quantity          NUMERIC(10, 2) NOT NULL CHECK (quantity > 0),
  previous_quantity NUMERIC(10, 2) NOT NULL,
  new_quantity      NUMERIC(10, 2) NOT NULL,
  reason            VARCHAR(160),
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 4. Tabela de Compras / Notas Fiscais (Controle Financeiro)
CREATE TABLE IF NOT EXISTS purchases (
  id           SERIAL PRIMARY KEY,
  organization_id INTEGER NOT NULL DEFAULT 1,
  store_name   VARCHAR(120) NOT NULL DEFAULT 'Supermercado',
  total_amount NUMERIC(10, 2) NOT NULL DEFAULT 0 CHECK (total_amount >= 0),
  total_items  NUMERIC(10, 2) NOT NULL DEFAULT 0,
  notes        TEXT,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE purchases ALTER COLUMN total_items TYPE NUMERIC(10, 2);

-- 5. Itens da Compra (Preço pago vs Preço do Mês Anterior e Variação %)
CREATE TABLE IF NOT EXISTS purchase_items (
  id                  SERIAL PRIMARY KEY,
  organization_id     INTEGER NOT NULL DEFAULT 1,
  purchase_id         INTEGER NOT NULL REFERENCES purchases(id) ON DELETE CASCADE,
  product_id          INTEGER REFERENCES products(id) ON DELETE SET NULL,
  product_name        VARCHAR(150) NOT NULL,
  barcode             VARCHAR(60),
  quantity            NUMERIC(10, 2) NOT NULL CHECK (quantity > 0),
  unit_price          NUMERIC(10, 2) NOT NULL CHECK (unit_price >= 0),
  previous_unit_price NUMERIC(10, 2) NOT NULL DEFAULT 0,
  total_price         NUMERIC(10, 2) NOT NULL CHECK (total_price >= 0),
  price_variation_pct NUMERIC(6, 4) DEFAULT 0,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_products_category_id ON products(category_id);
CREATE INDEX IF NOT EXISTS idx_products_sku ON products(sku);
CREATE INDEX IF NOT EXISTS idx_movements_product_id ON stock_movements(product_id);
CREATE INDEX IF NOT EXISTS idx_purchases_created_at ON purchases(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_purchase_items_purchase_id ON purchase_items(purchase_id);

