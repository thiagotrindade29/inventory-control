import dotenv from 'dotenv'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import cors from 'cors'
import express from 'express'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
dotenv.config({ path: path.resolve(__dirname, '../.env') })

import { pool } from './db.js'
import categoriesRouter from './routes/categories.js'
import dashboardRouter from './routes/dashboard.js'
import movementsRouter from './routes/movements.js'
import productsRouter from './routes/products.js'

const app = express()
const port = Number(process.env.PORT || 3001)

app.use(cors())
app.use(express.json())

// Rota de saúde para testar API + PostgreSQL
app.get('/api/health', async (_req, res, next) => {
  try {
    await pool.query('SELECT 1')
    res.json({ status: 'ok', database: 'connected' })
  } catch (err) {
    next(err)
  }
})

app.use('/api/dashboard', dashboardRouter)
app.use('/api/categories', categoriesRouter)
app.use('/api/products', productsRouter)
app.use('/api/movements', movementsRouter)

// Middleware global de tratamento de erros
app.use((err, _req, res, _next) => {
  console.error('Erro na API:', err)
  res.status(500).json({
    error: 'Erro interno no servidor.',
    details: process.env.NODE_ENV === 'production' ? undefined : err.message,
  })
})

app.listen(port, () => {
  console.log(`API do Mini-ERP rodando em http://localhost:${port}`)
})
