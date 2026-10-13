// Stok & rules per produk — file kecil terpisah per produk:
//   data/stock/<id-produk>.json  -> array entri akun [{ email, password, ... }]
//   data/rules/<id-produk>.txt    -> teks rules (maks 500 karakter)
//
// Stok bersifat antrean: takeStock() mengambil entri terdepan sekaligus
// menghapusnya dari file (stok berkurang setiap ada pembelian berhasil).
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const ROOT = path.join(__dirname, '..')
const STOCK_DIR = path.join(ROOT, 'data', 'stock')
const RULES_DIR = path.join(ROOT, 'data', 'rules')

const stockFile = (id) => path.join(STOCK_DIR, `${id}.json`)
const rulesFile = (id) => path.join(RULES_DIR, `${id}.txt`)

export function loadStock(productId) {
  try {
    const f = stockFile(productId)
    if (!fs.existsSync(f)) return []
    const d = JSON.parse(fs.readFileSync(f, 'utf-8'))
    return Array.isArray(d) ? d : []
  } catch {
    return []
  }
}

export function saveStock(productId, list) {
  fs.mkdirSync(STOCK_DIR, { recursive: true })
  fs.writeFileSync(stockFile(productId), JSON.stringify(list))
}

// Tambah entri ke antrean stok. Kembali: total stok sekarang.
export function addStock(productId, entries) {
  const list = loadStock(productId)
  list.push(...entries)
  saveStock(productId, list)
  return list.length
}

// Kosongkan stok. Kembali: jumlah entri yang dihapus.
export function clearStock(productId) {
  const n = loadStock(productId).length
  saveStock(productId, [])
  return n
}

export function stockCount(productId) {
  return loadStock(productId).length
}

// Ambil 1 entri terdepan untuk dikirim ke pembeli (stok berkurang).
// Kembali: entri, atau null kalau stok habis.
export function takeStock(productId) {
  const list = loadStock(productId)
  if (!list.length) return null
  const first = list.shift()
  saveStock(productId, list)
  return first
}

export function loadRules(productId) {
  try {
    const f = rulesFile(productId)
    return fs.existsSync(f) ? fs.readFileSync(f, 'utf-8') : ''
  } catch {
    return ''
  }
}

export function saveRules(productId, text) {
  fs.mkdirSync(RULES_DIR, { recursive: true })
  fs.writeFileSync(rulesFile(productId), text)
}

// Parse teks +stock menjadi array entri.
// Format per entri:
//   1. email|password
//   - Username : Budi
//   - Pin : 1122
export function parseStockEntries(body) {
  const entries = []
  let cur = null
  for (const raw of String(body).split('\n')) {
    const line = raw.trim()
    if (!line) continue
    const mNum = line.match(/^(\d+)\.\s*(.*)$/)
    if (mNum) {
      if (cur) entries.push(cur)
      const segs = mNum[2].split('|').map((s) => s.trim())
      cur = { Email: segs[0] || '', Password: segs[1] || '' }
      continue
    }
    const mField = line.match(/^-\s*([^:]+?)\s*:\s*(.*)$/)
    if (mField && cur) {
      cur[mField[1].trim()] = mField[2].trim()
    }
  }
  if (cur) entries.push(cur)
  // Buang entri kosong
  return entries.filter((e) => Object.values(e).some((v) => v))
}

// Format 1 entri stok menjadi baris-baris "Key : value" untuk pesan pengiriman.
export function formatStockEntry(entry) {
  return Object.entries(entry)
    .filter(([, v]) => v)
    .map(([k, v]) => `${k} : ${v}`)
    .join('\n')
}

// Susun pesan "PEMBAYARAN BERHASIL" lengkap dengan rules.
export function buildDeliveryMessage(entry, rules) {
  // Ambil nilai field secara case-insensitive; kosong bila tidak ada.
  const val = (...names) => {
    const keys = Object.keys(entry || {})
    for (const n of names) {
      const k = keys.find((x) => x.toLowerCase() === n.toLowerCase())
      if (k && String(entry[k]).trim()) return String(entry[k]).trim()
    }
    return ''
  }
  const email = val('email')
  const password = val('password')
  const user = val('username', 'profile')
  const pin = val('pin')
  const voucher = val('voucher', 'kode', 'code')
  return (
    `✅*Pembayaran Berhasil*\n\n` +
    `\`Detail Akun\`\n` +
    `Email : ${email}\n` +
    `Password : ${password}\n` +
    `Username/Profile: ${user}\n` +
    `Pin: ${pin}\n` +
    `\nVoucher : ${voucher}\n` +
    `\n📝 Rules :\n` +
    (rules?.trim() ? rules.trim() : '')
  )
}
