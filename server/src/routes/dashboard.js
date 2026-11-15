import { Router } from 'express'
import { pool } from '../db.js'

const router = Router()

// GET /api/dashboard -> KPIs e alertas para a tela inicial do ERP
router.get('/', async (_req, res, next) => {
  try {
    const [summaryResult, lowStockResult, expiringResult, recentMovementsResult] = await Promise.all([
      pool.query(`
        SELECT
          COUNT(*)::int AS total_products,
          COALESCE(SUM(quantity), 0)::numeric AS total_units,
          COALESCE(SUM(quantity * unit_price), 0)::numeric AS total_value,
          COUNT(*) FILTER (WHERE quantity <= min_quantity)::int AS low_stock_count,
          COUNT(*) FILTER (
            WHERE expiration_date IS NOT NULL
              AND expiration_date <= CURRENT_DATE + INTERVAL '30 days'
          )::int AS expiring_soon_count
        FROM products
      `),
      pool.query(`
        SELECT
          p.id, p.sku, p.name, p.location, p.unit, p.quantity, p.min_quantity,
          c.name AS category_name, c.color AS category_color
        FROM products p
        LEFT JOIN categories c ON c.id = p.category_id
        WHERE p.quantity <= p.min_quantity
        ORDER BY (p.quantity - p.min_quantity) ASC, p.name ASC
        LIMIT 8
      `),
      pool.query(`
        SELECT
          p.id, p.name, p.location, p.quantity, p.unit, p.expiration_date,
          c.name AS category_name
        FROM products p
        LEFT JOIN categories c ON c.id = p.category_id
        WHERE p.expiration_date IS NOT NULL
          AND p.expiration_date <= CURRENT_DATE + INTERVAL '30 days'
        ORDER BY p.expiration_date ASC
        LIMIT 8
      `),
      pool.query(`
        SELECT
          m.*,
          p.name AS product_name,
          p.unit AS product_unit
        FROM stock_movements m
        JOIN products p ON p.id = m.product_id
        ORDER BY m.created_at DESC
        LIMIT 8
      `),
    ])

    res.json({
      summary: summaryResult.rows[0],
      lowStockProducts: lowStockResult.rows,
      expiringProducts: expiringResult.rows,
      recentMovements: recentMovementsResult.rows,
    })
  } catch (err) {
    next(err)
  }
})

export default router
