// Konfigurasi utama ZeniBot — SEMUA via environment (.env).
// Salin .env.example menjadi .env lalu isi nilainya.
import path from 'path'
import { fileURLToPath } from 'url'
import { BOT_NAME, STORE_NAME, STORE_TAGLINE } from './src/brand.js'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const numList = (v) => String(v || '').split(',').map((s) => s.trim()).filter(Boolean)

export default {
  name: BOT_NAME,
  storeName: STORE_NAME,
  tagline: STORE_TAGLINE,
  // Nomor owner (admin penuh), dipisah koma. Format: 6281234567890
  owner: numList(process.env.OWNER_NUMBERS),
  // Nomor WA yang dipakai sebagai bot, format: 6281234567890 (tanpa + / spasi)
  botNumber: (process.env.BOT_NUMBER || '').replace(/[^0-9]/g, ''),
  // Metode pairing: 'code' (kode 8 digit) atau 'qr' (scan QR)
  pairMethod: process.env.PAIR_METHOD || 'code',
  sessionDir: 'session',
  // Thumbnail menu — taruh file gambar di path ini, menu otomatis memakainya.
  thumbnail: path.join(__dirname, 'assets', 'thumbnail.jpg'),
}
