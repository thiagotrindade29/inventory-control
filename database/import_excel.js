import fs from 'node:fs'
import path from 'node:path'
import dotenv from 'dotenv'
import pg from 'pg'
import XLSX from 'xlsx'

dotenv.config({ path: path.resolve('.env.local') })

const { Pool } = pg

const pool = new Pool({
  host: process.env.DB_HOST || 'localhost',
  port: Number(process.env.DB_PORT || 5432),
  database: process.env.DB_NAME || 'home_erp',
  user: process.env.DB_USER || 'postgres',
  password: process.env.DB_PASSWORD || '',
})

const defaultCategories = [
  { name: 'Alimentos & Despensa', color: '#f59e0b' },
  { name: 'Geladeira & Laticínios', color: '#0ea5e9' },
  { name: 'Limpeza', color: '#10b981' },
  { name: 'Higiene', color: '#8b5cf6' },
  { name: 'Padaria & Matinal', color: '#6366f1' },
  { name: 'Hortifruti & Feira', color: '#84cc16' },
]

function guessCategory(name) {
  const n = name.toUpperCase()
  if (
    n.includes('LAVA') ||
    n.includes('ESPONJA') ||
    n.includes('ROUPA') ||
    n.includes('AMAC') ||
    n.includes('LIXO') ||
    n.includes('DESINFETANTE') ||
    n.includes('ALCOOL') ||
    n.includes('BOMBRIL') ||
    n.includes('SANITARIA') ||
    n.includes('SABAO') ||
    n.includes('DETERGENTE')
  ) {
    return 'Limpeza'
  }
  if (
    n.includes('SABONETE') ||
    n.includes('CREME DENTAL') ||
    n.includes('SHAMPOO') ||
    n.includes('CONDICIONADOR') ||
    n.includes('PAPEL HIG') ||
    n.includes('FIO DENTAL') ||
    n.includes('HERBISSIMO') ||
    n.includes('ST LIQ') ||
    n.includes('FOFINHO') ||
    n.includes('CORPO')
  ) {
    return 'Higiene'
  }
  if (
    n.includes('LEITE') ||
    n.includes('QUEIJO') ||
    n.includes('MANTEIGA') ||
    n.includes('MARG') ||
    n.includes('IOG') ||
    n.includes('CALABRA') ||
    n.includes('SOBREM') ||
    n.includes('CR LEITE')
  ) {
    return 'Geladeira & Laticínios'
  }
  if (
    n.includes('TORRADA') ||
    n.includes('PAO') ||
    n.includes('PAES') ||
    n.includes('PAQ') ||
    n.includes('BOLINHO') ||
    n.includes('BISCC') ||
    n.includes('BISCO') ||
    n.includes('CEREAL') ||
    n.includes('AVEIA') ||
    n.includes('MIST') ||
    n.includes('BOLO') ||
    n.includes('OREO')
  ) {
    return 'Padaria & Matinal'
  }
  if (n.includes('MAMAO') || n.includes('ABACATE') || n.includes('FRUTA') || n.includes('KG')) {
    return 'Hortifruti & Feira'
  }
  return 'Alimentos & Despensa'
}

const nameAliases = {
  'ARROZ VILA NOVA T 5KG': 'Arroz Branco (5kg)',
  'MAL BCO SEM ESPAG 500G': 'Macarrão Espaguete (500g)',
  'SAL MAR SOSAC, 500G': 'Sal Refinado (500g)',
  'CEREAL MAT NESCAU LVT70': 'Cereal Matinal',
  'LE PO PIRCANJAUBA 1KG': 'Leite po Integral (1kg)',
  'ESPONJA SCOTCH BRITE C 4': 'Esponja de Louça (pct c/ 4)',
  'LAVA LOUCAS GIRANDO 500M': 'Detergente Líquido (500ml)',
  'LVA ROUPA PO OMO 2 KG': 'Sabão em Pó (1kg)',
  'AMAC ROUPO CYPE 1 L': 'Amaciante de Roupas (2L)',
  'FP F DFP FOFINHO 30N C': 'Papel Higiênico (pct c/ 16)',
  'TEMP KITANO 609 M SABOR': 'Temperos em geral',
  'FARELO AVEIA NESTLE 170G': 'Aveia',
  'CAFE MELITA 500G VACUO': 'Café Torrado e Moído (500g)',
  'ST LIQ LUX 250ML ORIG': 'Sabonete em Barra',
}

async function runCleanImport() {
  const client = await pool.connect()
  try {
    console.log('📦 Executando Schema DDL...')
    const schemaSql = fs.readFileSync(path.resolve('database/schema.sql'), 'utf-8')
    await client.query(schemaSql)

    console.log('🧹 Limpando dados anteriores para re-importação limpa...')
    await client.query(
      `TRUNCATE products, categories, stock_movements, purchases, purchase_items RESTART IDENTITY CASCADE`
    )

    console.log('🏷️ Inserindo categorias...')
    const categoryMap = new Map()
    for (const cat of defaultCategories) {
      const res = await client.query(
        `INSERT INTO categories (name, color)
         VALUES ($1, $2)
         RETURNING id, name`,
        [cat.name, cat.color]
      )
      categoryMap.set(cat.name, res.rows[0].id)
    }

    console.log('📊 Lendo planilha Excel...')
    const excelPath = path.resolve('Controle de Estoque - Materiais de Casa.xlsx')
    const buffer = fs.readFileSync(excelPath)
    const workbook = XLSX.read(buffer, { type: 'buffer' })

    // 1. ESTOQUE CASA (29 itens reais)
    const sheetEstoque = workbook.Sheets['ESTOQUE CASA']
    const rowsEstoque = XLSX.utils.sheet_to_json(sheetEstoque, { header: 1, defval: '' })

    const productMapByName = new Map()

    console.log('🏠 Importando os 29 itens do inventário doméstico...')
    for (let i = 9; i < 40; i++) {
      const row = rowsEstoque[i]
      if (!row) continue
      const name = String(row[0] || '').trim()
      let catName = String(row[1] || '').trim()
      const qty = Number(row[2] || 0)
      const minQty = Number(row[3] || 1)

      if (!name || name === 'Item') continue

      if (catName === 'Despensa') catName = 'Alimentos & Despensa'
      let catId = categoryMap.get(catName)
      if (!catId) {
        catId = categoryMap.get(guessCategory(name)) || categoryMap.get('Alimentos & Despensa')
      }

      const res = await client.query(
        `INSERT INTO products (name, category_id, quantity, min_quantity, location)
         VALUES ($1, $2, $3, $4, 'Despensa')
         RETURNING id, name, quantity`,
        [name, catId, qty, minQty]
      )
      productMapByName.set(name.toLowerCase(), res.rows[0])
    }

    // 2. COMPRAS NOVEMBRO (50 itens da nota)
    console.log('🛒 Importando Nota de Compras de Novembro...')
    const sheetCompras = workbook.Sheets['COMPRAS NOVEMBRO']
    const rowsCompras = XLSX.utils.sheet_to_json(sheetCompras, { header: 1, defval: '' })

    let totalNota = 0
    let totalItens = 0
    const items = []

    for (let i = 1; i < rowsCompras.length; i++) {
      const row = rowsCompras[i]
      if (!row || !row.length) continue
      const code = String(row[0] || '').trim()
      const name = String(row[1] || '').trim()
      const qty = Number(row[2] || 1)
      let price = Number(row[3])
      const total = Number(row[4] || 0)
      const prevPrice = Number(row[5] || price || 0)
      const varPct = Number(row[6] || 0)

      if (!name) continue
      if (code === 'TOTAL' || name === 'Geral da Nota') {
        if (total > 0) totalNota = total
        continue
      }

      if (Number.isNaN(price) || price <= 0) {
        price = qty > 0 && total > 0 ? total / qty : prevPrice || 0
      }

      const itemTotal = total > 0 ? total : Number((price * qty).toFixed(2))
      totalItens += qty

      items.push({
        code: code || null,
        name,
        qty,
        price: Number(price.toFixed(2)),
        prevPrice: Number(prevPrice.toFixed(2)),
        total: Number(itemTotal.toFixed(2)),
        varPct,
      })
    }

    // Se totalNota não veio do rodapé da planilha, soma os itens
    if (totalNota <= 0) {
      totalNota = items.reduce((acc, it) => acc + it.total, 0)
    }

    const purchaseRes = await client.query(
      `INSERT INTO purchases (store_name, total_amount, total_items, notes, created_at)
       VALUES ('Supermercado (Nota Novembro)', $1, $2, 'Nota fiscal importada da planilha Controle de Estoque.xlsx', NOW() - INTERVAL '5 days')
       RETURNING id`,
      [Number(totalNota.toFixed(2)), Number(totalItens.toFixed(2))]
    )
    const purchaseId = purchaseRes.rows[0].id

    for (const item of items) {
      // Verificar se possui alias para mapear com o item de estoque de casa
      const mappedHouseName = nameAliases[item.name] || item.name
      let existing = productMapByName.get(mappedHouseName.toLowerCase())

      if (!existing && item.code && item.code.length > 5) {
        const prodByCode = await client.query(
          `SELECT id, name, quantity FROM products WHERE barcode = $1 LIMIT 1`,
          [item.code]
        )
        if (prodByCode.rows.length > 0) {
          existing = prodByCode.rows[0]
        }
      }

      let productId = null
      let prevQty = 0

      if (existing) {
        productId = existing.id
        prevQty = Number(existing.quantity || 0)

        await client.query(
          `UPDATE products
           SET sku = COALESCE(sku, $1),
               barcode = COALESCE(barcode, $1),
               unit_price = $2,
               previous_unit_price = $3,
               quantity = quantity + $4,
               notes = CASE WHEN notes IS NULL THEN $5 ELSE notes END
           WHERE id = $6`,
          [item.code, item.price, item.prevPrice, item.qty, `Nota Fiscal: ${item.name}`, productId]
        )
        existing.quantity = prevQty + item.qty
      } else {
        const catName = guessCategory(item.name)
        const catId = categoryMap.get(catName) || categoryMap.get('Alimentos & Despensa')

        const newProd = await client.query(
          `INSERT INTO products (sku, barcode, name, category_id, unit_price, previous_unit_price, quantity, min_quantity, location)
           VALUES ($1, $1, $2, $3, $4, $5, $6, 1, 'Despensa')
           RETURNING id, name, quantity`,
          [item.code, item.name, catId, item.price, item.prevPrice, item.qty]
        )
        productId = newProd.rows[0].id
        productMapByName.set(item.name.toLowerCase(), newProd.rows[0])
      }

      const newQty = prevQty + item.qty

      await client.query(
        `INSERT INTO purchase_items (
           purchase_id, product_id, product_name, barcode, quantity, unit_price, previous_unit_price, total_price, price_variation_pct
         )
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
        [
          purchaseId,
          productId,
          item.name,
          item.code,
          item.qty,
          item.price,
          item.prevPrice,
          item.total,
          item.varPct,
        ]
      )

      await client.query(
        `INSERT INTO stock_movements (product_id, type, quantity, previous_quantity, new_quantity, reason)
         VALUES ($1, 'IN', $2, $3, $4, 'Importação da Nota de Novembro')`,
        [productId, item.qty, prevQty, newQty]
      )
    }

    console.log(`🎉 Importação limpa e estruturada com sucesso!`)
    console.log(`📌 Produtos totais cadastrados: ${productMapByName.size}`)
    console.log(`🛒 Itens da Compra: ${items.length}`)
    console.log(`💰 Total da Nota: R$ ${totalNota.toFixed(2)} (${totalItens.toFixed(2)} unidades)`)
  } catch (err) {
    console.error('❌ Erro:', err)
  } finally {
    client.release()
    await pool.end()
  }
}

runCleanImport()
