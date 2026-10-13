import 'dotenv/config'
import config from './config.js'
import { initLicense } from './src/license.js'
import { startBot } from './src/connection.js'

console.log(`🚀 Menjalankan ${config.name}...`)
await initLicense()
startBot(config).catch((e) => {
  console.error('Gagal menjalankan bot:', e)
  process.exit(1)
})
