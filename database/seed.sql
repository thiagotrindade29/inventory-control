-- ============================================================================
-- DADOS INICIAIS (SEED) PARA TESTE DO MINI-ERP DOMÉSTICO
-- ============================================================================
-- Rode após o schema.sql para já começar com exemplos realistas.
-- ============================================================================

INSERT INTO categories (name, description, color) VALUES
  ('Alimentos Secos', 'Grãos, massas, farinhas e enlatados', '#f59e0b'),
  ('Geladeira & Laticínios', 'Leite, queijos, ovos e perecíveis', '#0ea5e9'),
  ('Limpeza', 'Detergentes, desinfetantes e esponjas', '#10b981'),
  ('Higiene Pessoal', 'Sabonetes, pastas de dente e papel higiênico', '#8b5cf6'),
  ('Bebidas', 'Café, sucos, água e chás', '#ec4899')
ON CONFLICT (name) DO NOTHING;

INSERT INTO products (sku, name, category_id, location, unit, quantity, min_quantity, unit_price, expiration_date, notes)
VALUES
  (
    'ALI-001',
    'Arroz Tipo 1 (5kg)',
    (SELECT id FROM categories WHERE name = 'Alimentos Secos'),
    'Despensa',
    'pct',
    2,
    1,
    29.90,
    CURRENT_DATE + INTERVAL '180 days',
    'Marca preferida da casa'
  ),
  (
    'ALI-002',
    'Feijão Carioca (1kg)',
    (SELECT id FROM categories WHERE name = 'Alimentos Secos'),
    'Despensa',
    'pct',
    1,
    2,
    8.50,
    CURRENT_DATE + INTERVAL '120 days',
    'Abaixo do mínimo para testar alerta de reposição'
  ),
  (
    'GEL-001',
    'Leite Integral (1L)',
    (SELECT id FROM categories WHERE name = 'Geladeira & Laticínios'),
    'Geladeira',
    'L',
    4,
    3,
    5.49,
    CURRENT_DATE + INTERVAL '20 days',
    NULL
  ),
  (
    'LIM-001',
    'Detergente Líquido (500ml)',
    (SELECT id FROM categories WHERE name = 'Limpeza'),
    'Lavanderia',
    'un',
    1,
    2,
    2.99,
    NULL,
    'Comprar no próximo mercado'
  ),
  (
    'BEB-001',
    'Café Torrado e Moído (500g)',
    (SELECT id FROM categories WHERE name = 'Bebidas'),
    'Armário Cozinha',
    'pct',
    2,
    1,
    19.90,
    CURRENT_DATE + INTERVAL '90 days',
    NULL
  )
ON CONFLICT (sku) DO NOTHING;

-- Registra movimentações iniciais apenas se a tabela ainda estiver vazia
INSERT INTO stock_movements (product_id, type, quantity, previous_quantity, new_quantity, reason)
SELECT id, 'IN', quantity, 0, quantity, 'Carga inicial de inventário'
FROM products
WHERE NOT EXISTS (SELECT 1 FROM stock_movements LIMIT 1);
