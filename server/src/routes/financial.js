import { Router } from 'express'
import { pool } from '../db.js'

const router = Router()

// GET /api/financial -> KPIs e inteligência financeira de compras do mercado
router.get('/', async (_req, res, next) => {
  try {
    // 1. Overview geral de compras
    const overviewRes = await pool.query(
      `SELECT
         COALESCE(SUM(total_amount), 0)::numeric(10, 2) AS total_spent,
         COUNT(id)::int AS total_purchases,
         COALESCE(AVG(total_amount), 0)::numeric(10, 2) AS avg_purchase_amount,
         COALESCE(SUM(total_items), 0)::numeric(10, 2) AS total_items_bought
       FROM purchases`
    )

    // 2. Análise de inflação / variação de preços nos itens comprados
    const inflationStatsRes = await pool.query(
      `SELECT
         COUNT(*) FILTER (WHERE price_variation_pct > 0.001)::int AS items_up,
         COUNT(*) FILTER (WHERE price_variation_pct < -0.001)::int AS items_down,
         COUNT(*) FILTER (WHERE ABS(price_variation_pct) <= 0.001)::int AS items_same,
         COALESCE(AVG(price_variation_pct), 0)::numeric(6, 4) AS avg_variation_pct
       FROM purchase_items
       WHERE previous_unit_price > 0`
    )

    // 3. Gastos por categoria (via junção de purchase_items -> products -> categories)
    const categorySpendingRes = await pool.query(
      `SELECT
         COALESCE(c.name, 'Outros') AS category_name,
         COALESCE(c.color, '#64748b') AS category_color,
         COALESCE(SUM(pi.total_price), 0)::numeric(10, 2) AS total_spent,
         COUNT(pi.id)::int AS items_count
       FROM purchase_items pi
       LEFT JOIN products p ON p.id = pi.product_id
       LEFT JOIN categories c ON c.id = p.category_id
       GROUP BY c.name, c.color
       ORDER BY total_spent DESC`
    )

    // 4. Maiores altas de preço (Inflação na cesta)
    const topInflationRes = await pool.query(
      `SELECT
         pi.product_name,
         pi.barcode,
         pi.unit_price,
         pi.previous_unit_price,
         (pi.unit_price - pi.previous_unit_price)::numeric(10, 2) AS diff_reais,
         pi.price_variation_pct,
         pi.created_at,
         p.id AS product_id
       FROM purchase_items pi
       LEFT JOIN products p ON p.id = pi.product_id
       WHERE pi.previous_unit_price > 0 AND pi.price_variation_pct > 0
       ORDER BY pi.price_variation_pct DESC, diff_reais DESC
       LIMIT 8`
    )

    // 5. Melhores economias / Quedas de preço (Promoções e deflação)
    const topDeflationRes = await pool.query(
      `SELECT
         pi.product_name,
         pi.barcode,
         pi.unit_price,
         pi.previous_unit_price,
         (pi.previous_unit_price - pi.unit_price)::numeric(10, 2) AS saved_reais,
         pi.price_variation_pct,
         pi.created_at,
         p.id AS product_id
       FROM purchase_items pi
       LEFT JOIN products p ON p.id = pi.product_id
       WHERE pi.previous_unit_price > 0 AND pi.price_variation_pct <= 0
       ORDER BY pi.price_variation_pct ASC
       LIMIT 8`
    )

    // 6. Lista recente de compras com itens detalhados
    const purchasesRes = await pool.query(
      `SELECT
         p.*,
         COUNT(pi.id)::int AS items_count
       FROM purchases p
       LEFT JOIN purchase_items pi ON pi.purchase_id = p.id
       GROUP BY p.id
       ORDER BY p.created_at DESC
       LIMIT 10`
    )

    // 7. Todos os itens de compras para a tabela detalhada do relatório
    const allItemsRes = await pool.query(
      `SELECT
         pi.*,
         c.name AS category_name,
         c.color AS category_color,
         p.location
       FROM purchase_items pi
       LEFT JOIN products p ON p.id = pi.product_id
       LEFT JOIN categories c ON c.id = p.category_id
       ORDER BY pi.created_at DESC, pi.id DESC
       LIMIT 150`
    )

    res.json({
      overview: {
        ...overviewRes.rows[0],
        ...inflationStatsRes.rows[0],
      },
      spendingByCategory: categorySpendingRes.rows,
      topInflation: topInflationRes.rows,
      topDeflation: topDeflationRes.rows,
      purchases: purchasesRes.rows,
      items: allItemsRes.rows,
    })
  } catch (err) {
    next(err)
  }
})

export default router

