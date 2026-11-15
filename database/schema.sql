-- ============================================================================
-- FASE 1: MODELAGEM DO BANCO DE DADOS (PostgreSQL) - MINI-ERP DOMÉSTICO
-- ============================================================================
-- Execute este script dentro do banco de dados `home_erp`.
-- ============================================================================

-- Função de gatilho (Trigger Function) para atualizar `updated_at` automaticamente
CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 1. Tabela de Categorias (ex: Alimentos, Limpeza, Higiene, Bebidas)
CREATE TABLE IF NOT EXISTS categories (
  id          SERIAL PRIMARY KEY,
  name        VARCHAR(80) NOT NULL UNIQUE,
  description VARCHAR(255),
  color       VARCHAR(20) NOT NULL DEFAULT '#3b82f6',
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 2. Tabela de Produtos (Catálogo + Estoque Atual)
CREATE TABLE IF NOT EXISTS products (
  id              SERIAL PRIMARY KEY,
  sku             VARCHAR(40) UNIQUE,
  name            VARCHAR(120) NOT NULL,
  category_id     INTEGER REFERENCES categories(id) ON DELETE SET NULL,
  location        VARCHAR(80) NOT NULL DEFAULT 'Despensa',
  unit            VARCHAR(20) NOT NULL DEFAULT 'un',
  quantity        NUMERIC(10, 2) NOT NULL DEFAULT 0 CHECK (quantity >= 0),
  min_quantity    NUMERIC(10, 2) NOT NULL DEFAULT 1 CHECK (min_quantity >= 0),
  unit_price      NUMERIC(10, 2) NOT NULL DEFAULT 0 CHECK (unit_price >= 0),
  expiration_date DATE,
  notes           TEXT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Trigger que chama `set_updated_at()` antes de qualquer UPDATE em `products`
DROP TRIGGER IF EXISTS trg_products_updated_at ON products;
CREATE TRIGGER trg_products_updated_at
  BEFORE UPDATE ON products
  FOR EACH ROW
  EXECUTE FUNCTION set_updated_at();

-- 3. Tabela de Movimentações de Estoque (Auditoria de Entradas e Saídas)
CREATE TABLE IF NOT EXISTS stock_movements (
  id                SERIAL PRIMARY KEY,
  product_id        INTEGER NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  type              VARCHAR(10) NOT NULL CHECK (type IN ('IN', 'OUT', 'ADJUST')),
  quantity          NUMERIC(10, 2) NOT NULL CHECK (quantity > 0),
  previous_quantity NUMERIC(10, 2) NOT NULL,
  new_quantity      NUMERIC(10, 2) NOT NULL,
  reason            VARCHAR(160),
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Índices para acelerar buscas e filtros no ERP
CREATE INDEX IF NOT EXISTS idx_products_category_id ON products(category_id);
CREATE INDEX IF NOT EXISTS idx_products_name ON products(name);
CREATE INDEX IF NOT EXISTS idx_movements_product_id ON stock_movements(product_id);
CREATE INDEX IF NOT EXISTS idx_movements_created_at ON stock_movements(created_at DESC);
