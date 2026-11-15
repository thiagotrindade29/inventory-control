import { Router } from 'express'
import { pool } from '../db.js'

const router = Router()

// GET /api/purchases -> Lista todas as notas/compras com contagem de itens
router.get('/', async (_req, res, next) => {
  try {
    const { rows } = await pool.query(
      `SELECT
         p.*,
         COUNT(pi.id)::int AS items_count
       FROM purchases p
       LEFT JOIN purchase_items pi ON pi.purchase_id = p.id
       GROUP BY p.id
       ORDER BY p.created_at DESC`
    )
    res.json(rows)
  } catch (err) {
    next(err)
  }
})

// GET /api/purchases/:id -> Retorna uma compra específica com todos os seus itens
router.get('/:id', async (req, res, next) => {
  try {
    const { id } = req.params

    const purchaseRes = await pool.query('SELECT * FROM purchases WHERE id = $1', [id])
    if (purchaseRes.rows.length === 0) {
      return res.status(404).json({ error: 'Compra não encontrada.' })
    }

    const itemsRes = await pool.query(
      `SELECT
         pi.*,
         p.location,
         c.name AS category_name,
         c.color AS category_color
       FROM purchase_items pi
       LEFT JOIN products p ON p.id = pi.product_id
       LEFT JOIN categories c ON c.id = p.category_id
       WHERE pi.purchase_id = $1
       ORDER BY pi.id ASC`,
      [id]
    )

    res.json({
      ...purchaseRes.rows[0],
      items: itemsRes.rows,
    })
  } catch (err) {
    next(err)
  }
})

// POST /api/purchases -> Transação atômica para finalizar compras do Modo Mercado
router.post('/', async (req, res, next) => {
  const client = await pool.connect()
  try {
    const { store_name = 'Supermercado', notes = null, items = [] } = req.body

    if (!Array.isArray(items) || items.length === 0) {
      return res.status(400).json({ error: 'O carrinho de compras não pode estar vazio.' })
    }

    await client.query('BEGIN')

    let computedTotalAmount = 0
    let computedTotalItems = 0

    // Validar e calcular totais
    for (const item of items) {
      const qty = Number(item.quantity)
      const price = Number(item.unit_price)

      if (Number.isNaN(qty) || qty <= 0) {
        await client.query('ROLLBACK')
        return res.status(400).json({ error: `Quantidade inválida para o item "${item.name}".` })
      }
      if (Number.isNaN(price) || price < 0) {
        await client.query('ROLLBACK')
        return res.status(400).json({ error: `Preço inválido para o item "${item.name}".` })
      }

      computedTotalAmount += qty * price
      computedTotalItems += qty
    }

    // 1. Criar registro de compra
    const purchaseResult = await client.query(
      `INSERT INTO purchases (store_name, total_amount, total_items, notes)
       VALUES ($1, $2, $3, $4)
       RETURNING *`,
      [
        store_name.trim() || 'Supermercado',
        Number(computedTotalAmount.toFixed(2)),
        Number(computedTotalItems.toFixed(2)),
        notes?.trim() || null,
      ]
    )

    const purchase = purchaseResult.rows[0]
    const insertedItems = []

    // 2. Processar cada produto (atualizar estoque, preços e movimentação)
    for (const item of items) {
      const qty = Number(item.quantity)
      const price = Number(item.unit_price)
      const itemTotal = Number((qty * price).toFixed(2))

      let productId = item.product_id ? Number(item.product_id) : null
      let prevPrice = 0
      let prevQty = 0

      // Se não passou product_id, tentar encontrar por barcode ou por nome
      if (!productId) {
        if (item.barcode && String(item.barcode).length > 4) {
          const matchCode = await client.query(
            `SELECT id, quantity, unit_price FROM products WHERE barcode = $1 OR sku = $1 LIMIT 1`,
            [item.barcode]
          )
          if (matchCode.rows.length > 0) {
            productId = matchCode.rows[0].id
            prevPrice = Number(matchCode.rows[0].unit_price || 0)
            prevQty = Number(matchCode.rows[0].quantity || 0)
          }
        }

        if (!productId && item.name) {
          const matchName = await client.query(
            `SELECT id, quantity, unit_price FROM products WHERE LOWER(name) = LOWER($1) LIMIT 1`,
            [item.name.trim()]
          )
          if (matchName.rows.length > 0) {
            productId = matchName.rows[0].id
            prevPrice = Number(matchName.rows[0].unit_price || 0)
            prevQty = Number(matchName.rows[0].quantity || 0)
          }
        }
      } else {
        const prodData = await client.query(
          `SELECT id, quantity, unit_price FROM products WHERE id = $1 FOR UPDATE`,
          [productId]
        )
        if (prodData.rows.length > 0) {
          prevPrice = Number(prodData.rows[0].unit_price || 0)
          prevQty = Number(prodData.rows[0].quantity || 0)
        }
      }

      // Se produto já existe, atualiza preços e soma quantidade
      if (productId) {
        // Se item tinha previous_unit_price informado explicitamente, usa ele caso prevPrice seja 0
        const effectivePrevPrice = prevPrice > 0 ? prevPrice : Number(item.previous_unit_price || price)
        const priceVar = effectivePrevPrice > 0 ? (price - effectivePrevPrice) / effectivePrevPrice : 0
        const newQty = prevQty + qty

        await client.query(
          `UPDATE products
           SET sku = COALESCE(sku, $1),
               barcode = COALESCE(barcode, $1),
               previous_unit_price = CASE WHEN unit_price > 0 THEN unit_price ELSE previous_unit_price END,
               unit_price = $2,
               quantity = quantity + $3
           WHERE id = $4`,
          [item.barcode?.trim() || null, price, qty, productId]
        )

        // Registrar item da compra
        const itemRes = await client.query(
          `INSERT INTO purchase_items (
             purchase_id, product_id, product_name, barcode, quantity, unit_price, previous_unit_price, total_price, price_variation_pct
           )
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
           RETURNING *`,
          [
            purchase.id,
            productId,
            item.name.trim(),
            item.barcode?.trim() || null,
            qty,
            price,
            effectivePrevPrice,
            itemTotal,
            Number(priceVar.toFixed(4)),
          ]
        )
        insertedItems.push(itemRes.rows[0])

        // Registrar movimentação de entrada (IN)
        await client.query(
          `INSERT INTO stock_movements (product_id, type, quantity, previous_quantity, new_quantity, reason)
           VALUES ($1, 'IN', $2, $3, $4, $5)`,
          [productId, qty, prevQty, newQty, `Compra Mercado #${purchase.id} (${purchase.store_name})`]
        )
      } else {
        // Criar novo produto no catálogo
        const catId = item.category_id ? Number(item.category_id) : null
        const effectivePrevPrice = Number(item.previous_unit_price || price)
        const priceVar = effectivePrevPrice > 0 ? (price - effectivePrevPrice) / effectivePrevPrice : 0

        const newProdRes = await client.query(
          `INSERT INTO products (
             sku, barcode, name, category_id, location, unit, quantity, min_quantity, unit_price, previous_unit_price
           )
           VALUES ($1, $1, $2, $3, 'Despensa', 'un', $4, 1, $5, $6)
           RETURNING id`,
          [item.barcode?.trim() || null, item.name.trim(), catId, qty, price, effectivePrevPrice]
        )
        productId = newProdRes.rows[0].id

        const itemRes = await client.query(
          `INSERT INTO purchase_items (
             purchase_id, product_id, product_name, barcode, quantity, unit_price, previous_unit_price, total_price, price_variation_pct
           )
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
           RETURNING *`,
          [
            purchase.id,
            productId,
            item.name.trim(),
            item.barcode?.trim() || null,
            qty,
            price,
            effectivePrevPrice,
            itemTotal,
            Number(priceVar.toFixed(4)),
          ]
        )
        insertedItems.push(itemRes.rows[0])

        await client.query(
          `INSERT INTO stock_movements (product_id, type, quantity, previous_quantity, new_quantity, reason)
           VALUES ($1, 'IN', $2, 0, $2, $3)`,
          [productId, qty, `Compra Mercado #${purchase.id} (${purchase.store_name})`]
        )
      }
    }

    await client.query('COMMIT')

    res.status(201).json({
      ...purchase,
      items: insertedItems,
    })
  } catch (err) {
    await client.query('ROLLBACK')
    next(err)
  } finally {
    client.release()
  }
})

export default router

