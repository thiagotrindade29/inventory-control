import dotenv from 'dotenv'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import pg from 'pg'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
dotenv.config({ path: path.resolve(__dirname, '../.env') })

const { Pool, types } = pg

// Por padrão, o driver `pg` retorna colunas NUMERIC (OID 1700) como string
// para evitar perda de precisão em valores gigantes. Para um ERP doméstico,
// converter para Number facilita os cálculos no backend e no React.
types.setTypeParser(1700, (value) => (value === null ? null : Number(value)))

if (!process.env.DB_PASSWORD) {
  console.warn(
    'AVISO: DB_PASSWORD não foi carregada. Verifique se o arquivo server/.env existe na pasta server/ (ao lado do package.json).'
  )
}

export const pool = new Pool({
  host: process.env.DB_HOST || 'localhost',
  port: Number(process.env.DB_PORT || 5432),
  database: process.env.DB_NAME || 'home_erp',
  user: process.env.DB_USER || 'postgres',
  password: process.env.DB_PASSWORD ?? '',
})

pool.on('error', (err) => {
  console.error('Erro inesperado no pool do PostgreSQL:', err)
})
