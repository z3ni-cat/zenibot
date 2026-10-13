// Penyimpanan produk ZeniCat — data/products.json + cover di assets/products/
// Dibaca fresh setiap perintah, jadi +produk/-produk/set_cover langsung
// berpengaruh tanpa restart bot.
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const ROOT = path.join(__dirname, '..')

export const DATA_FILE = path.join(ROOT, 'data', 'products.json')
export const CATEGORY_FILE = path.join(ROOT, 'data', 'categories.json')
export const COVER_DIR = path.join(ROOT, 'assets', 'products')

export function loadProducts() {
  try {
    if (!fs.existsSync(DATA_FILE)) return []
    const data = JSON.parse(fs.readFileSync(DATA_FILE, 'utf-8'))
    return Array.isArray(data) ? data : []
  } catch {
    return []
  }
}

export function saveProducts(list) {
  fs.mkdirSync(path.dirname(DATA_FILE), { recursive: true })
  fs.writeFileSync(DATA_FILE, JSON.stringify(list, null, 2))
}

// ---- Kategori ----
export function loadCategories() {
  try {
    if (!fs.existsSync(CATEGORY_FILE)) return []
    const data = JSON.parse(fs.readFileSync(CATEGORY_FILE, 'utf-8'))
    return Array.isArray(data) ? data : []
  } catch {
    return []
  }
}

export function saveCategories(list) {
  fs.mkdirSync(path.dirname(CATEGORY_FILE), { recursive: true })
  fs.writeFileSync(CATEGORY_FILE, JSON.stringify(list, null, 2))
}

// Cari kategori by nama (case-insensitive) atau id
export function findCategory(list, name) {
  const q = String(name).toLowerCase().trim()
  if (!q) return null
  return list.find((c) => c.name.toLowerCase() === q || c.id === slugify(q)) || null
}

// Pencocokan kategori yang toleran terhadap singkatan,
// mis. "App" -> "Aplikasi Premium", "Imei" -> "Unblock Imei".
// Skor: exact 100 > awalan nama 90 > awalan kata 80 > urutan huruf 50.
// Kembali: { cat } | { ambiguous: [...] } | { cat: null }
function subsequence(hay, needle) {
  let j = 0
  for (const ch of hay) {
    if (ch === needle[j]) j++
    if (j === needle.length) return true
  }
  return false
}

export function matchCategory(list, name) {
  const q = String(name).toLowerCase().trim()
  if (!q) return { cat: null }
  const exact = findCategory(list, q)
  if (exact) return { cat: exact }

  const qn = q.replace(/[^a-z0-9]/g, '')
  const scored = []
  for (const c of list) {
    const n = c.name.toLowerCase()
    const nn = n.replace(/[^a-z0-9]/g, '')
    let score = 0
    if (n.startsWith(q) || nn.startsWith(qn)) score = 90
    else if (n.split(/[\s-]+/).some((w) => w.startsWith(q))) score = 80
    else if (qn.length >= 2 && subsequence(nn, qn)) score = 50
    if (score > 0) scored.push({ c, score })
  }
  if (!scored.length) return { cat: null }
  const best = Math.max(...scored.map((s) => s.score))
  const top = scored.filter((s) => s.score === best)
  if (top.length === 1) return { cat: top[0].c }
  return { cat: null, ambiguous: top.map((s) => s.c) }
}

export function slugify(name) {
  return String(name)
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\s_-]/g, '')
    .replace(/[\s_]+/g, '-')
    .replace(/-+/g, '-')
}

// Cari produk by nama (case-insensitive) atau id
export function findProduct(list, name) {
  const q = String(name).toLowerCase().trim()
  if (!q) return null
  return list.find((p) => p.name.toLowerCase() === q || p.id === slugify(q)) || null
}

// Buffer cover produk, atau null jika belum ada
export function loadCover(product) {
  try {
    const name = product?.cover || _default.jpg
    const f = path.join(COVER_DIR, name)
    if (fs.existsSync(f)) return fs.readFileSync(f)
    const d = path.join(COVER_DIR, _default.jpg)
    return fs.existsSync(d) ? fs.readFileSync(d) : null
  } catch {
    return null
  }
}

// Hapus file cover produk (dipakai saat produk dihapus / cover diganti)
export function deleteCover(product) {
  try {
    if (!product?.cover) return
    const f = path.join(COVER_DIR, product.cover)
    if (fs.existsSync(f)) fs.unlinkSync(f)
  } catch { /* abaikan */ }
}

// Harga produk diambil dari DESKRIPSI (contoh: "Rp40.000" / "Rp40,000").
// Fallback ke field price (perintah +harga) bila tidak ada nominal di deskripsi.
export function getProductPrice(p) {
  const m = String(p?.description || '').match(/Rp\s*([\d.,]+)/i)
  if (m) {
    const n = parseInt(m[1].replace(/\D/g, ''), 10)
    if (n > 0) return n
  }
  return p?.price || 0
}

// Keterangan otomatis per kategori — ditampilkan di bawah detail produk.

// Keterangan otomatis per kategori — ditampilkan di bawah detail produk.
// Bisa dioverride per kategori via field "footer" di categories.json.
const DEFAULT_FOOTERS = {
  'aplikasi-premium': '📝 Full Garansi\n⌛ Fast\n🟢 Bot & Website Bantuan Online 24/7',
}
export function getCategoryFooter(categoryId) {
  const cats = loadCategories()
  const cat = cats.find((c) => c.id === categoryId)
  if (cat && cat.footer) return cat.footer
  return DEFAULT_FOOTERS[categoryId] || ''
}

// Stok efektif: antrean akun (stock.js) + angka stok manual (field stock, dari wizard).
export function effectiveStock(p, queueCount) {
  return (queueCount || 0) + (p && p.stock ? p.stock : 0)
}
