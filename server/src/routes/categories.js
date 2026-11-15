import { Router } from 'express'
import { pool } from '../db.js'

const router = Router()

// GET /api/categories -> Lista categorias com contagem de produtos
router.get('/', async (_req, res, next) => {
  try {
    const { rows } = await pool.query(`
      SELECT
        c.id,
        c.name,
        c.description,
        c.color,
        c.created_at,
        COUNT(p.id)::int AS product_count
      FROM categories c
      LEFT JOIN products p ON p.category_id = c.id
      GROUP BY c.id
      ORDER BY c.name ASC
    `)
    res.json(rows)
  } catch (err) {
    next(err)
  }
})

// POST /api/categories -> Cria nova categoria
router.post('/', async (req, res, next) => {
  try {
    const { name, description = null, color = '#3b82f6' } = req.body

    if (!name || !name.trim()) {
      return res.status(400).json({ error: 'O nome da categoria é obrigatório.' })
    }

    const { rows } = await pool.query(
      `INSERT INTO categories (name, description, color)
       VALUES ($1, $2, $3)
       RETURNING *`,
      [name.trim(), description?.trim() || null, color]
    )

    res.status(201).json(rows[0])
  } catch (err) {
    if (err.code === '23505') {
      return res.status(409).json({ error: 'Já existe uma categoria com esse nome.' })
    }
    next(err)
  }
})

// PUT /api/categories/:id -> Atualiza categoria
router.put('/:id', async (req, res, next) => {
  try {
    const { id } = req.params
    const { name, description = null, color = '#3b82f6' } = req.body

    if (!name || !name.trim()) {
      return res.status(400).json({ error: 'O nome da categoria é obrigatório.' })
    }

    const { rows } = await pool.query(
      `UPDATE categories
       SET name = $1, description = $2, color = $3
       WHERE id = $4
       RETURNING *`,
      [name.trim(), description?.trim() || null, color, id]
    )

    if (rows.length === 0) {
      return res.status(404).json({ error: 'Categoria não encontrada.' })
    }

    res.json(rows[0])
  } catch (err) {
    if (err.code === '23505') {
      return res.status(409).json({ error: 'Já existe uma categoria com esse nome.' })
    }
    next(err)
  }
})

// DELETE /api/categories/:id -> Remove categoria
router.delete('/:id', async (req, res, next) => {
  try {
    const { id } = req.params
    const { rowCount } = await pool.query('DELETE FROM categories WHERE id = $1', [id])

    if (rowCount === 0) {
      return res.status(404).json({ error: 'Categoria não encontrada.' })
    }

    res.status(204).send()
  } catch (err) {
    next(err)
  }
})

export default router
