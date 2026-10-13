import 'dotenv/config'
import config from './config.js'
import { startBot } from './src/connection.js'

console.log(`🚀 Menjalankan ${config.name}...`)
startBot(config).catch((e) => {
  console.error('Gagal menjalankan bot:', e)
  process.exit(1)
})
