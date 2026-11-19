import { XMLParser } from 'fast-xml-parser'

export function guessCategory(name = '') {
  const n = String(name).toUpperCase()

  // Carnes, Aves, Peixes, Frios e Laticínios
  if (
    n.includes('CARNE') ||
    n.includes('ALCATRA') ||
    n.includes('PICANHA') ||
    n.includes('PATINHO') ||
    n.includes('ACEM') ||
    n.includes('COSTELA') ||
    n.includes('CONTRA') ||
    n.includes('MAMINHA') ||
    n.includes('COXAO') ||
    n.includes('FRANGO') ||
    n.includes('PEITO') ||
    n.includes('COXA') ||
    n.includes('ASA') ||
    n.includes('LINGUICA') ||
    n.includes('SALSICHA') ||
    n.includes('BACON') ||
    n.includes('PEIXE') ||
    n.includes('TILAPIA') ||
    n.includes('LEITE') ||
    n.includes('QUEIJO') ||
    n.includes('MUSSARELA') ||
    n.includes('PRESUNTO') ||
    n.includes('MORTADELA') ||
    n.includes('IOGURTE') ||
    n.includes('IOG') ||
    n.includes('MANTEIGA') ||
    n.includes('MARGARINA') ||
    n.includes('REQUEIJAO') ||
    n.includes('NATA') ||
    n.includes('CREME DE LEITE') ||
    n.includes('CR LEITE')
  ) {
    return 'Geladeira & Laticínios'
  }

  // Padaria e Matinal
  if (
    n.includes('PAO') ||
    n.includes('PÃO') ||
    n.includes('FRANCES') ||
    n.includes('FRANCÊS') ||
    n.includes('FORMA') ||
    n.includes('TORRADA') ||
    n.includes('BISCOITO') ||
    n.includes('BOLACHA') ||
    n.includes('BOLO') ||
    n.includes('BROA') ||
    n.includes('CROISSANT') ||
    n.includes('CEREAL') ||
    n.includes('AVEIA') ||
    n.includes('GRANOLA') ||
    n.includes('NESCAU') ||
    n.includes('ACHOCOLATADO') ||
    n.includes('CAFE') ||
    n.includes('CAFÉ')
  ) {
    return 'Padaria & Matinal'
  }

  // Hortifruti & Feira
  if (
    n.includes('BANANA') ||
    n.includes('MACA') ||
    n.includes('MAÇÃ') ||
    n.includes('LARANJA') ||
    n.includes('LIMAO') ||
    n.includes('LIMÃO') ||
    n.includes('MAMAO') ||
    n.includes('MAMÃO') ||
    n.includes('ABACAXI') ||
    n.includes('ABACATE') ||
    n.includes('MELANCIA') ||
    n.includes('UVA') ||
    n.includes('TOMATE') ||
    n.includes('CEBOLA') ||
    n.includes('ALHO') ||
    n.includes('BATATA') ||
    n.includes('CENOURA') ||
    n.includes('ALFACE') ||
    n.includes('COUVE') ||
    n.includes('LEGUME') ||
    n.includes('VERDURA')
  ) {
    return 'Hortifruti & Feira'
  }

  // Limpeza
  if (
    n.includes('DETERGENTE') ||
    n.includes('SABAO') ||
    n.includes('SABÃO') ||
    n.includes('AMACIANTE') ||
    n.includes('DESINFETANTE') ||
    n.includes('AGUA SANITARIA') ||
    n.includes('ÁGUA SANITÁRIA') ||
    n.includes('CLORO') ||
    n.includes('ESPONJA') ||
    n.includes('BOMBRIL') ||
    n.includes('LIXO') ||
    n.includes('ALCOOL') ||
    n.includes('ÁLCOOL') ||
    n.includes('MULTIUSO') ||
    n.includes('LAVA LOUCAS') ||
    n.includes('LAVA ROUPAS')
  ) {
    return 'Limpeza'
  }

  // Higiene Pessoal
  if (
    n.includes('SABONETE') ||
    n.includes('SHAMPOO') ||
    n.includes('CONDICIONADOR') ||
    n.includes('DENTAL') ||
    n.includes('PASTA DE DENTE') ||
    n.includes('ESCOVA') ||
    n.includes('FIO DENTAL') ||
    n.includes('DESODORANTE') ||
    n.includes('PAPEL HIG') ||
    n.includes('ABSORVENTE') ||
    n.includes('COTTON') ||
    n.includes('COTONETE') ||
    n.includes('FRALDA') ||
    n.includes('LENCO') ||
    n.includes('LENÇO')
  ) {
    return 'Higiene'
  }

  return 'Alimentos & Despensa'
}

/**
 * 1. Parser de XML de NF-e / NFC-e (Padrão Nacional SEFAZ)
 */
export function parseNfeXml(xmlContent) {
  const parser = new XMLParser({
    ignoreAttributes: false,
    attributeNamePrefix: '@_',
    isArray: (name) => name === 'det',
    parseTagValue: false,
  })

  const doc = parser.parse(xmlContent)

  // Encontrar infNFe em <nfeProc><NFe><infNFe> ou direto em <NFe><infNFe> ou <infNFe>
  const nfe = doc.nfeProc?.NFe || doc.NFe || doc
  const infNFe = nfe.infNFe || nfe

  if (!infNFe) {
    throw new Error('Estrutura de XML de NF-e inválida ou não reconhecida.')
  }

  const emit = infNFe.emit || {}
  const ide = infNFe.ide || {}
  const total = infNFe.total?.ICMSTot || {}

  const storeName = emit.xFant || emit.xNome || 'Supermercado'
  const storeCnpj = emit.CNPJ || ''
  const invoiceNumber = ide.nNF ? String(ide.nNF) : ''
  const issueDate = ide.dhEmi || ide.dEmi || new Date().toISOString()
  const totalAmount = Number(parseFloat(total.vNF || 0).toFixed(2))

  const detList = Array.isArray(infNFe.det) ? infNFe.det : infNFe.det ? [infNFe.det] : []

  const items = detList.map((item, index) => {
    const prod = item.prod || {}
    const name = String(prod.xProd || `Item ${index + 1}`).trim()
    const code = prod.cProd ? String(prod.cProd).trim() : null
    let barcode = prod.cEAN ? String(prod.cEAN).trim() : null
    if (barcode === 'SEM GTIN' || barcode === 'SEMGTIN' || !barcode) {
      barcode = code
    }

    const quantity = parseFloat(prod.qCom || 1)
    const unitPrice = parseFloat(prod.vUnCom || 0)
    const totalPrice = parseFloat(prod.vProd || quantity * unitPrice)
    const unit = String(prod.uCom || 'un').toLowerCase()

    return {
      index: index + 1,
      name,
      code,
      barcode,
      quantity: Number(quantity.toFixed(3)),
      unitPrice: Number(unitPrice.toFixed(2)),
      totalPrice: Number(totalPrice.toFixed(2)),
      unit: unit === 'kg' ? 'kg' : 'un',
      suggestedCategory: guessCategory(name),
    }
  })

  return {
    source: 'XML',
    storeName,
    storeCnpj,
    invoiceNumber,
    issueDate,
    totalAmount,
    totalItems: items.length,
    items,
  }
}

/**
 * 2. Parser de HTML da Consulta Pública da SEFAZ (via QR Code de NFC-e)
 */
export function parseSefazHtml(html) {
  // Limpar quebras excessivas para facilitar expressões regulares
  const cleanHtml = html.replace(/\r?\n|\r/g, ' ')

  // Extrair Nome do Estabelecimento
  let storeName = 'Supermercado'
  const storeMatch =
    cleanHtml.match(/<div[^>]*class="[^"]*(?:txtTopo|nomeFantasia|txtTit)[^"]*"[^>]*>([^<]+)<\/div>/i) ||
    cleanHtml.match(/<span[^>]*class="[^"]*(?:txtTopo|nome)[^"]*"[^>]*>([^<]+)<\/span>/i) ||
    cleanHtml.match(/<h\d[^>]*class="[^"]*txtTopo[^"]*"[^>]*>([^<]+)<\/h\d>/i) ||
    cleanHtml.match(/id="u20"[^>]*>([^<]+)</i)

  if (storeMatch && storeMatch[1]) {
    storeName = storeMatch[1].trim()
  }

  // Extrair CNPJ
  let storeCnpj = ''
  const cnpjMatch = cleanHtml.match(/CNPJ:\s*([\d\.\/\-]+)/i)
  if (cnpjMatch) {
    storeCnpj = cnpjMatch[1].trim()
  }

  // Extrair Total da Nota
  let totalAmount = 0
  const totalMatch =
    cleanHtml.match(/(?:Valor a pagar|Valor total|Total R\$|totalNFe)[^>]*R?\$?\s*([0-9\.,]+)/i) ||
    cleanHtml.match(/<span[^>]*class="[^"]*totalNFe[^"]*"[^>]*>([^<]+)<\/span>/i) ||
    cleanHtml.match(/<span[^>]*class="[^"]*txtMax[^"]*"[^>]*>([^<]+)<\/span>/i)

  if (totalMatch && totalMatch[1]) {
    const rawVal = totalMatch[1].replace(/[^\d,\.]/g, '').replace(',', '.')
    totalAmount = parseFloat(rawVal) || 0
  }

  const items = []

  // Padrão 1: Tabela de Itens Padrão Encat / SEFAZ Nacional (SP, RS, MG, RJ, PR, etc.)
  // Estrutura clássica: <tr id="Item + ..."> com .txtTit (nome), .RCod (código), .Rqtd (qtd), .RUN (unidade), .RvlUnit (vl unit), .valor (total)
  const rowRegex = /<tr[^>]*id="Item[^"]*"[^>]*>(.*?)<\/tr>/gi
  let match
  let itemIndex = 1

  while ((match = rowRegex.exec(cleanHtml)) !== null) {
    const rowHtml = match[1]

    // Nome
    const nameM =
      rowHtml.match(/<span[^>]*class="[^"]*txtTit[^"]*"[^>]*>([^<]+)<\/span>/i) ||
      rowHtml.match(/<td[^>]*class="[^"]*txtTit[^"]*"[^>]*>([^<]+)<\/td>/i)
    const name = nameM ? nameM[1].trim() : `Item ${itemIndex}`

    // Código
    const codeM = rowHtml.match(/<span[^>]*class="[^"]*RCod[^"]*"[^>]*>.*?(\d+)[^<]*<\/span>/i)
    const code = codeM ? codeM[1].trim() : null

    // Quantidade
    const qtdM = rowHtml.match(/<span[^>]*class="[^"]*Rqtd[^"]*"[^>]*>.*?([0-9\.,]+)[^<]*<\/span>/i)
    let quantity = 1
    if (qtdM) {
      quantity = parseFloat(qtdM[1].replace(',', '.')) || 1
    }

    // Unidade
    const unM = rowHtml.match(/<span[^>]*class="[^"]*RUN[^"]*"[^>]*>.*?([A-Za-z]+)[^<]*<\/span>/i)
    const unit = unM ? unM[1].trim().toLowerCase() : 'un'

    // Valor Unitário
    const vlUnitM = rowHtml.match(/<span[^>]*class="[^"]*RvlUnit[^"]*"[^>]*>.*?([0-9\.,]+)[^<]*<\/span>/i)
    let unitPrice = 0
    if (vlUnitM) {
      unitPrice = parseFloat(vlUnitM[1].replace(',', '.')) || 0
    }

    // Valor Total
    const vlTotM = rowHtml.match(/<span[^>]*class="[^"]*(?:valor|Rtotal)[^"]*"[^>]*>.*?([0-9\.,]+)[^<]*<\/span>/i)
    let totalPrice = quantity * unitPrice
    if (vlTotM) {
      totalPrice = parseFloat(vlTotM[1].replace(',', '.')) || totalPrice
    }

    items.push({
      index: itemIndex++,
      name,
      code,
      barcode: code && code.length >= 8 ? code : null,
      quantity: Number(quantity.toFixed(3)),
      unitPrice: Number(unitPrice.toFixed(2)),
      totalPrice: Number(totalPrice.toFixed(2)),
      unit: unit === 'kg' ? 'kg' : 'un',
      suggestedCategory: guessCategory(name),
    })
  }

  // Padrão 2 (Fallback): Tabelas genéricas com colunas (Item, Descrição, Qtd, Preço)
  if (items.length === 0) {
    const genericRowRegex = /<tr[^>]*>\s*<td[^>]*>(.*?)<\/td>\s*<td[^>]*>(.*?)<\/td>\s*<td[^>]*>(.*?)<\/td>\s*<td[^>]*>(.*?)<\/td>/gi
    let genMatch
    let genIdx = 1
    while ((genMatch = genericRowRegex.exec(cleanHtml)) !== null) {
      const col2 = genMatch[2].replace(/<[^>]+>/g, '').trim()
      const col3 = genMatch[3].replace(/<[^>]+>/g, '').trim()
      const col4 = genMatch[4].replace(/<[^>]+>/g, '').trim()

      if (col2 && !col2.toLowerCase().includes('descri') && /[0-9]/.test(col4)) {
        const qty = parseFloat(col3.replace(',', '.')) || 1
        const tot = parseFloat(col4.replace(/[^\d,\.]/g, '').replace(',', '.')) || 0
        const unitP = qty > 0 ? tot / qty : tot

        items.push({
          index: genIdx++,
          name: col2,
          code: null,
          barcode: null,
          quantity: Number(qty.toFixed(3)),
          unitPrice: Number(unitP.toFixed(2)),
          totalPrice: Number(tot.toFixed(2)),
          unit: 'un',
          suggestedCategory: guessCategory(col2),
        })
      }
    }
  }

  if (totalAmount <= 0 && items.length > 0) {
    totalAmount = items.reduce((sum, it) => sum + it.totalPrice, 0)
  }

  return {
    source: 'SEFAZ_URL',
    storeName,
    storeCnpj,
    totalAmount: Number(totalAmount.toFixed(2)),
    totalItems: items.length,
    items,
  }
}

/**
 * 3. Parser Inteligente de Texto Extraído por OCR ou Copiado de Cupom Fiscal
 */
export function parseReceiptText(text) {
  if (!text || typeof text !== 'string') {
    throw new Error('Nenhum texto informado para processar.')
  }

  const lines = text
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter((l) => l.length > 0)

  let storeName = 'Mercado / Estabelecimento'
  let totalAmount = 0
  const items = []

  // 1. Tentar detectar o nome do estabelecimento nas primeiras 5 linhas
  for (let i = 0; i < Math.min(5, lines.length); i++) {
    const l = lines[i]
    if (
      !l.includes('CNPJ') &&
      !l.includes('CUPOM') &&
      !l.includes('EXTRATO') &&
      !l.includes('NOTA FISCAL') &&
      !l.includes('DANFE') &&
      l.length >= 3
    ) {
      storeName = l
      break
    }
  }

  // 2. Extrair itens do corpo do cupom
  // Formatos comuns de impressora térmica:
  // Ex 1: "001 7891234567890 ALCATRA BOVINA 0,850 KG X 49,90 = 42,42"
  // Ex 2: "PAO FRANCES 10 UN X 0,95 9,50"
  // Ex 3: Linha de nome seguida por linha de quantidade: "0,850 KG x 49,90    42,42"
  let pendingName = null
  let pendingBarcode = null

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]
    const upper = line.toUpperCase()

    // Identificar Total Geral
    if (upper.includes('TOTAL') && (upper.includes('R$') || /[0-9]/.test(upper))) {
      const matchTot = upper.match(/TOTAL[^0-9]*([0-9\.,]+)/i)
      if (matchTot) {
        const val = parseFloat(matchTot[1].replace(',', '.'))
        if (!isNaN(val) && val > 0) totalAmount = val
      }
      continue
    }

    // Ignorar linhas de cabeçalho, rodapé ou tributos
    if (
      upper.includes('EXTRATO') ||
      upper.includes('CNPJ') ||
      upper.includes('TRIBUTOS') ||
      upper.includes('VALOR APROX') ||
      upper.includes('FORMA DE PAGAMENTO') ||
      upper.includes('DINHEIRO') ||
      upper.includes('CARTAO') ||
      upper.includes('CARTÃO') ||
      upper.includes('TROCO') ||
      upper.includes('CHAVE DE ACESSO') ||
      upper.includes('CONSULTA PELA CHAVE') ||
      upper.includes('PROTOCOLO')
    ) {
      continue
    }

    // Padrão A: Linha completa contendo Produto + Qtd + Preço Unitário + Total
    // Ex: "ALCATRA BOVINA 0,850 KG X 49,90 42,42" ou "PAO FRANCES 10 UN X 0,95 9,50"
    const inlineMatch = line.match(
      /^(?:(\d+)\s+)?(?:(\d{8,14})\s+)?(.+?)\s+([0-9\.,]+)\s*(KG|UN|PC|CX|LT|G|ML)?\s*[xX*]\s*([0-9\.,]+)\s*(?:[=\s]+)?([0-9\.,]+)?$/i
    )

    if (inlineMatch) {
      const barcode = inlineMatch[2] || null
      let name = inlineMatch[3].trim()
      // Remove prefixos numéricos se houver
      name = name.replace(/^\d+\s+/, '')

      const qty = parseFloat(inlineMatch[4].replace(',', '.')) || 1
      const unit = (inlineMatch[5] || 'un').toLowerCase()
      const unitPrice = parseFloat(inlineMatch[6].replace(',', '.')) || 0
      const total = inlineMatch[7]
        ? parseFloat(inlineMatch[7].replace(',', '.'))
        : qty * unitPrice

      items.push({
        index: items.length + 1,
        name,
        code: barcode,
        barcode,
        quantity: Number(qty.toFixed(3)),
        unitPrice: Number(unitPrice.toFixed(2)),
        totalPrice: Number(total.toFixed(2)),
        unit: unit === 'kg' ? 'kg' : 'un',
        suggestedCategory: guessCategory(name),
      })
      pendingName = null
      continue
    }

    // Padrão B: Linha que é somente dados de cálculo de um item anterior
    // Ex: "0,850 KG x 49,90       42,42" ou "10 UN x 0,95 = 9,50"
    const calcMatch = line.match(
      /^([0-9\.,]+)\s*(KG|UN|PC|CX|LT|G|ML)?\s*[xX*]\s*([0-9\.,]+)\s*(?:[=\s]+)?([0-9\.,]+)?$/i
    )

    if (calcMatch && pendingName) {
      const qty = parseFloat(calcMatch[1].replace(',', '.')) || 1
      const unit = (calcMatch[2] || 'un').toLowerCase()
      const unitPrice = parseFloat(calcMatch[3].replace(',', '.')) || 0
      const total = calcMatch[4] ? parseFloat(calcMatch[4].replace(',', '.')) : qty * unitPrice

      items.push({
        index: items.length + 1,
        name: pendingName,
        code: pendingBarcode,
        barcode: pendingBarcode,
        quantity: Number(qty.toFixed(3)),
        unitPrice: Number(unitPrice.toFixed(2)),
        totalPrice: Number(total.toFixed(2)),
        unit: unit === 'kg' ? 'kg' : 'un',
        suggestedCategory: guessCategory(pendingName),
      })
      pendingName = null
      pendingBarcode = null
      continue
    }

    // Padrão C: Linha com nome de produto e código
    // Ex: "001 7891234567890 ALCATRA BOVINA KG" ou "002 PAO FRANCES"
    const nameLineMatch = line.match(/^(?:(?:\d{1,4})\s+)?(?:(\d{8,14})\s+)?([A-Za-zÀ-ÿ0-9\s\.\-\/\%]+)$/)
    if (nameLineMatch && nameLineMatch[2] && nameLineMatch[2].length >= 3) {
      pendingBarcode = nameLineMatch[1] || null
      pendingName = nameLineMatch[2].trim()
    }
  }

  if (totalAmount <= 0 && items.length > 0) {
    totalAmount = items.reduce((sum, it) => sum + it.totalPrice, 0)
  }

  return {
    source: 'TEXT_OCR',
    storeName,
    totalAmount: Number(totalAmount.toFixed(2)),
    totalItems: items.length,
    items,
  }
}

