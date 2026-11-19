import { Router } from 'express'
import { pool } from '../db.js'
import { parseNfeXml, parseReceiptText, parseSefazHtml } from '../utils/nfeParser.js'

const router = Router()

/**
 * Helper para cruzar os itens parseados com o banco de dados
 * Identifica se o item já existe no catálogo, seu estoque atual e preço anterior
 */
async function matchItemsWithDatabase(items = []) {
  const categoriesRes = await pool.query('SELECT id, name, color FROM categories')
  const categories = categoriesRes.rows
  const categoryMap = new Map(categories.map((c) => [c.name.toLowerCase(), c]))

  const enrichedItems = []

  for (const item of items) {
    let matchedProduct = null

    // 1. Tentar encontrar por código de barras (se tiver 8+ dígitos)
    if (item.barcode && String(item.barcode).length >= 8) {
      const byBarcode = await pool.query(
        `SELECT id, name, quantity, unit_price, previous_unit_price, category_id, location, unit
         FROM products
         WHERE barcode = $1 OR sku = $1
         LIMIT 1`,
        [item.barcode]
      )
      if (byBarcode.rows.length > 0) {
        matchedProduct = byBarcode.rows[0]
      }
    }

    // 2. Se não achou por código, tentar por nome exato ou similar
    if (!matchedProduct && item.name) {
      const byName = await pool.query(
        `SELECT id, name, quantity, unit_price, previous_unit_price, category_id, location, unit
         FROM products
         WHERE LOWER(name) = LOWER($1) OR name ILIKE $2
         ORDER BY (LOWER(name) = LOWER($1)) DESC
         LIMIT 1`,
        [item.name.trim(), `%${item.name.trim()}%`]
      )
      if (byName.rows.length > 0) {
        matchedProduct = byName.rows[0]
      }
    }

    // Identificar categoria correspondente no banco
    const suggestedCatObj =
      categoryMap.get(item.suggestedCategory.toLowerCase()) ||
      categoryMap.get('alimentos & despensa') ||
      categories[0]

    const categoryId = matchedProduct?.category_id || suggestedCatObj?.id || null
    const categoryName = categories.find((c) => c.id === categoryId)?.name || item.suggestedCategory
    const categoryColor = categories.find((c) => c.id === categoryId)?.color || '#3b82f6'

    enrichedItems.push({
      ...item,
      productId: matchedProduct?.id || null,
      isExisting: Boolean(matchedProduct),
      currentStock: matchedProduct ? Number(matchedProduct.quantity) : 0,
      previousUnitPrice: matchedProduct
        ? Number(matchedProduct.unit_price || matchedProduct.previous_unit_price || 0)
        : item.unitPrice,
      categoryId,
      categoryName,
      categoryColor,
      location: matchedProduct?.location || 'Despensa',
    })
  }

  return { items: enrichedItems, categories }
}

// POST /api/nfe/parse-xml -> Processa arquivo ou texto XML de NF-e
router.post('/parse-xml', async (req, res, next) => {
  try {
    const { xml } = req.body

    if (!xml || typeof xml !== 'string') {
      return res.status(400).json({ error: 'Conteúdo XML não informado.' })
    }

    const parsed = parseNfeXml(xml)
    const { items, categories } = await matchItemsWithDatabase(parsed.items)

    res.json({
      ...parsed,
      items,
      categories,
    })
  } catch (err) {
    next(err)
  }
})

// POST /api/nfe/parse-url -> Busca página da SEFAZ pelo link do QR Code e extrai dados
router.post('/parse-url', async (req, res, next) => {
  try {
    const { url } = req.body

    if (!url || typeof url !== 'string' || !url.startsWith('http')) {
      return res.status(400).json({ error: 'URL do QR Code da SEFAZ inválida.' })
    }

    // Faz requisição HTTP simulando navegador para evitar bloqueios de WAF da SEFAZ
    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), 12000)

    let html = ''
    try {
      const response = await fetch(url, {
        signal: controller.signal,
        headers: {
          'User-Agent':
            'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
          Accept:
            'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,image/apng,*/*;q=0.8',
          'Accept-Language': 'pt-BR,pt;q=0.9,en-US;q=0.8,en;q=0.7',
        },
      })

      if (!response.ok) {
        throw new Error(`A SEFAZ retornou código HTTP ${response.status}.`)
      }

      html = await response.text()
    } finally {
      clearTimeout(timeout)
    }

    const parsed = parseSefazHtml(html)

    if (parsed.items.length === 0) {
      return res.status(422).json({
        error:
          'Não foi possível extrair a tabela de produtos automaticamente desta página da SEFAZ. Você pode tirar uma foto do cupom impresso ou colar o texto dele.',
        rawHtmlSample: html.slice(0, 1000),
      })
    }

    const { items, categories } = await matchItemsWithDatabase(parsed.items)

    res.json({
      ...parsed,
      url,
      items,
      categories,
    })
  } catch (err) {
    if (err.name === 'AbortError') {
      return res.status(504).json({
        error: 'Tempo limite esgotado ao consultar a SEFAZ. O portal estadual pode estar instável.',
      })
    }
    next(err)
  }
})

// POST /api/nfe/parse-text -> Processa texto extraído de OCR ou colado pelo usuário
router.post('/parse-text', async (req, res, next) => {
  try {
    const { text } = req.body

    if (!text || typeof text !== 'string') {
      return res.status(400).json({ error: 'Texto do cupom não informado.' })
    }

    const parsed = parseReceiptText(text)

    if (parsed.items.length === 0) {
      return res.status(422).json({
        error:
          'Nenhum item com quantidade e preço foi identificado no texto. Verifique se a foto está nítida ou digite os itens.',
      })
    }

    const { items, categories } = await matchItemsWithDatabase(parsed.items)

    res.json({
      ...parsed,
      items,
      categories,
    })
  } catch (err) {
    next(err)
  }
})

export default router

