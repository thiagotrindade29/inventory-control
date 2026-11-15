import { Router } from 'express'
import { pool } from '../db.js'

const router = Router()

// GET /api/movements -> Histórico de entradas/saídas
router.get('/', async (req, res, next) => {
  try {
    const { productId, limit = 50 } = req.query
    const params = []
    let whereClause = ''

    if (productId) {
      params.push(Number(productId))
      whereClause = `WHERE m.product_id = $${params.length}`
    }

    params.push(Math.min(Number(limit) || 50, 200))

    const { rows } = await pool.query(
      `SELECT
         m.*,
         p.name AS product_name,
         p.sku AS product_sku,
         p.unit AS product_unit
       FROM stock_movements m
       JOIN products p ON p.id = m.product_id
       ${whereClause}
       ORDER BY m.created_at DESC
       LIMIT $${params.length}`,
      params
    )

    res.json(rows)
  } catch (err) {
    next(err)
  }
})

// POST /api/movements -> Registra Entrada (IN) ou Saída (OUT) com Transação SQL
router.post('/', async (req, res, next) => {
  const client = await pool.connect()
  try {
    const { product_id, type, quantity, reason = null } = req.body
    const qty = Number(quantity)

    if (!product_id || !['IN', 'OUT'].includes(type)) {
      return res.status(400).json({ error: 'Informe product_id e type válido (IN ou OUT).' })
    }

    if (Number.isNaN(qty) || qty <= 0) {
      return res.status(400).json({ error: 'A quantidade da movimentação deve ser maior que zero.' })
    }

    await client.query('BEGIN')

    // FOR UPDATE bloqueia a linha do produto até o COMMIT, evitando condição de corrida
    const productResult = await client.query(
      'SELECT id, name, quantity FROM products WHERE id = $1 FOR UPDATE',
      [product_id]
    )

    if (productResult.rows.length === 0) {
      await client.query('ROLLBACK')
      return res.status(404).json({ error: 'Produto não encontrado.' })
    }

    const product = productResult.rows[0]
    const previousQty = Number(product.quantity)
    const newQty = type === 'IN' ? previousQty + qty : previousQty - qty

    if (newQty < 0) {
      await client.query('ROLLBACK')
      return res.status(400).json({
        error: `Estoque insuficiente para "${product.name}". Atual: ${previousQty}, saída solicitada: ${qty}.`,
      })
    }

    await client.query('UPDATE products SET quantity = $1 WHERE id = $2', [newQty, product.id])

    const movementResult = await client.query(
      `INSERT INTO stock_movements (product_id, type, quantity, previous_quantity, new_quantity, reason)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING *`,
      [product.id, type, qty, previousQty, newQty, reason?.trim() || null]
    )

    await client.query('COMMIT')
    res.status(201).json(movementResult.rows[0])
  } catch (err) {
    await client.query('ROLLBACK')
    next(err)
  } finally {
    client.release()
  }
})

export default router
