import { Router } from 'express'
import { pool } from '../db.js'

const router = Router()

// GET /api/products -> Lista produtos com filtros opcionais (?search=&categoryId=&lowStock=true)
router.get('/', async (req, res, next) => {
  try {
    const { search, categoryId, lowStock } = req.query
    const conditions = []
    const params = []

    if (search && search.trim()) {
      params.push(`%${search.trim()}%`)
      conditions.push(`(p.name ILIKE $${params.length} OR p.sku ILIKE $${params.length} OR p.barcode ILIKE $${params.length} OR p.location ILIKE $${params.length})`)
    }

    if (categoryId) {
      params.push(Number(categoryId))
      conditions.push(`p.category_id = $${params.length}`)
    }

    if (lowStock === 'true') {
      conditions.push(`p.quantity <= p.min_quantity`)
    }

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : ''

    const { rows } = await pool.query(
      `SELECT
         p.*,
         c.name AS category_name,
         c.color AS category_color
       FROM products p
       LEFT JOIN categories c ON c.id = p.category_id
       ${whereClause}
       ORDER BY (p.quantity <= p.min_quantity) DESC, p.name ASC`,
      params
    )

    res.json(rows)
  } catch (err) {
    next(err)
  }
})

// GET /api/products/:id -> Busca 1 produto por ID
router.get('/:id', async (req, res, next) => {
  try {
    const { id } = req.params
    const { rows } = await pool.query(
      `SELECT
         p.*,
         c.name AS category_name,
         c.color AS category_color
       FROM products p
       LEFT JOIN categories c ON c.id = p.category_id
       WHERE p.id = $1`,
      [id]
    )

    if (rows.length === 0) {
      return res.status(404).json({ error: 'Produto não encontrado.' })
    }

    res.json(rows[0])
  } catch (err) {
    next(err)
  }
})

// POST /api/products -> Cadastra produto (e registra entrada inicial se quantity > 0)
router.post('/', async (req, res, next) => {
  const client = await pool.connect()
  try {
    const {
      sku = null,
      barcode = null,
      name,
      category_id = null,
      location = 'Despensa',
      unit = 'un',
      quantity = 0,
      min_quantity = 1,
      unit_price = 0,
      previous_unit_price = 0,
      expiration_date = null,
      notes = null,
    } = req.body

    if (!name || !name.trim()) {
      return res.status(400).json({ error: 'O nome do produto é obrigatório.' })
    }

    const qty = Number(quantity)
    const minQty = Number(min_quantity)
    const price = Number(unit_price)

    if (Number.isNaN(qty) || qty < 0) {
      return res.status(400).json({ error: 'Quantidade inicial inválida.' })
    }
    if (Number.isNaN(minQty) || minQty < 0) {
      return res.status(400).json({ error: 'Estoque mínimo inválido.' })
    }
    if (Number.isNaN(price) || price < 0) {
      return res.status(400).json({ error: 'Preço unitário inválido.' })
    }

    await client.query('BEGIN')

    const { rows } = await client.query(
      `INSERT INTO products (
         sku, barcode, name, category_id, location, unit, quantity, min_quantity, unit_price, previous_unit_price, expiration_date, notes
       )
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
       RETURNING *`,
      [
        sku?.trim() || null,
        barcode?.trim() || sku?.trim() || null,
        name.trim(),
        category_id ? Number(category_id) : null,
        location?.trim() || 'Despensa',
        unit?.trim() || 'un',
        qty,
        minQty,
        price,
        Number(previous_unit_price) || 0,
        expiration_date || null,
        notes?.trim() || null,
      ]
    )

    const created = rows[0]

    if (qty > 0) {
      await client.query(
        `INSERT INTO stock_movements (product_id, type, quantity, previous_quantity, new_quantity, reason)
         VALUES ($1, 'IN', $2, 0, $2, 'Cadastro inicial do produto')`,
        [created.id, qty]
      )
    }

    await client.query('COMMIT')
    res.status(201).json(created)
  } catch (err) {
    await client.query('ROLLBACK')
    if (err.code === '23505') {
      return res.status(409).json({ error: 'Já existe um produto com esse código SKU.' })
    }
    next(err)
  } finally {
    client.release()
  }
})

// PUT /api/products/:id -> Atualiza dados do produto (e registra ADJUST se a quantidade foi alterada)
router.put('/:id', async (req, res, next) => {
  const client = await pool.connect()
  try {
    const { id } = req.params
    const {
      sku = null,
      barcode = null,
      name,
      category_id = null,
      location = 'Despensa',
      unit = 'un',
      quantity = 0,
      min_quantity = 1,
      unit_price = 0,
      previous_unit_price = null,
      expiration_date = null,
      notes = null,
    } = req.body

    if (!name || !name.trim()) {
      return res.status(400).json({ error: 'O nome do produto é obrigatório.' })
    }

    const newQty = Number(quantity)
    const minQty = Number(min_quantity)
    const price = Number(unit_price)

    if (Number.isNaN(newQty) || newQty < 0 || Number.isNaN(minQty) || minQty < 0 || Number.isNaN(price) || price < 0) {
      return res.status(400).json({ error: 'Valores numéricos não podem ser negativos.' })
    }

    await client.query('BEGIN')

    const existingResult = await client.query('SELECT quantity FROM products WHERE id = $1 FOR UPDATE', [id])
    if (existingResult.rows.length === 0) {
      await client.query('ROLLBACK')
      return res.status(404).json({ error: 'Produto não encontrado.' })
    }

    const previousQty = Number(existingResult.rows[0].quantity)

    const { rows } = await client.query(
      `UPDATE products
       SET sku = $1,
           barcode = $2,
           name = $3,
           category_id = $4,
           location = $5,
           unit = $6,
           quantity = $7,
           min_quantity = $8,
           unit_price = $9,
           previous_unit_price = COALESCE($10, previous_unit_price),
           expiration_date = $11,
           notes = $12
       WHERE id = $13
       RETURNING *`,
      [
        sku?.trim() || null,
        barcode?.trim() || sku?.trim() || null,
        name.trim(),
        category_id ? Number(category_id) : null,
        location?.trim() || 'Despensa',
        unit?.trim() || 'un',
        newQty,
        minQty,
        price,
        previous_unit_price !== null && previous_unit_price !== undefined ? Number(previous_unit_price) : null,
        expiration_date || null,
        notes?.trim() || null,
        id,
      ]
    )

    if (newQty !== previousQty) {
      const diff = Math.abs(newQty - previousQty)
      await client.query(
        `INSERT INTO stock_movements (product_id, type, quantity, previous_quantity, new_quantity, reason)
         VALUES ($1, 'ADJUST', $2, $3, $4, 'Ajuste manual via edição do produto')`,
        [id, diff, previousQty, newQty]
      )
    }

    await client.query('COMMIT')
    res.json(rows[0])
  } catch (err) {
    await client.query('ROLLBACK')
    if (err.code === '23505') {
      return res.status(409).json({ error: 'Já existe um produto com esse código SKU.' })
    }
    next(err)
  } finally {
    client.release()
  }
})

// DELETE /api/products/:id -> Exclui produto
router.delete('/:id', async (req, res, next) => {
  try {
    const { id } = req.params
    const { rowCount } = await pool.query('DELETE FROM products WHERE id = $1', [id])

    if (rowCount === 0) {
      return res.status(404).json({ error: 'Produto não encontrado.' })
    }

    res.status(204).send()
  } catch (err) {
    next(err)
  }
})

export default router
