// ZeniBot Admin Panel — kelola toko ZeniCat (produk, kategori, stok, orders).
// Dijalankan di VPS yang sama dengan bot agar baca/tulis data langsung.
// Bot membaca products.json fresh setiap perintah -> perubahan langsung aktif.
import express from 'express'
import session from 'express-session'
import multer from 'multer'
import bcrypt from 'bcryptjs'
import crypto from 'crypto'
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'
import 'dotenv/config'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const BOT_ROOT = process.env.BOT_DIR || path.join(__dirname, '..', 'bot')
const DATA = path.join(BOT_ROOT, 'data')
const COVER_DIR = path.join(BOT_ROOT, 'assets', 'products')
const PORT = parseInt(process.env.ADMIN_PORT || '3004', 10)

const app = express()
app.use(express.json({ limit: '2mb' }))
app.use(express.urlencoded({ extended: true }))
app.use(session({
  secret: 'zenibot-admin-' + Date.now(),
  resave: false,
  saveUninitialized: false,
  cookie: { httpOnly: true, maxAge: 12 * 3600 * 1000 },
}))

// ---------- config (password hash) ----------
const CONFIG_FILE = path.join(__dirname, '.config.json')
function loadConfig() {
  try { return JSON.parse(fs.readFileSync(CONFIG_FILE, 'utf-8')) } catch { return {} }
}
function saveConfig(c) {
  fs.writeFileSync(CONFIG_FILE, JSON.stringify(c, null, 2), { mode: 0o600 })
}
// token setup sekali pakai (dicetak ke log saat password belum ada)
const SETUP_TOKEN = crypto.randomBytes(24).toString('hex')
if (!loadConfig().passwordHash) console.log('[setup] token:', SETUP_TOKEN)

// ---------- helpers ----------
function slugify(name) {
  return String(name).toLowerCase().trim()
    .replace(/[^a-z0-9\s_-]/g, '').replace(/[\s_]+/g, '-').replace(/-+/g, '-')
}
function readJson(f, fb) {
  try {
    const d = JSON.parse(fs.readFileSync(f, 'utf-8'))
    return d ?? fb
  } catch { return fb }
}
// tulis atomik: tmp + rename, agar bot tak baca file setengah tertulis
function writeJsonAtomic(f, data) {
  fs.mkdirSync(path.dirname(f), { recursive: true })
  const tmp = f + '.tmp-' + process.pid
  fs.writeFileSync(tmp, JSON.stringify(data, null, 2))
  fs.renameSync(tmp, f)
}
const productsFile = () => path.join(DATA, 'products.json')
const categoriesFile = () => path.join(DATA, 'categories.json')
const stockFile = (id) => path.join(DATA, 'stock', `${id}.json`)
const rulesFile = (id) => path.join(DATA, 'rules', `${id}.txt`)
const loadProducts = () => readJson(productsFile(), [])
const loadCategories = () => readJson(categoriesFile(), [])
const loadStock = (id) => readJson(stockFile(id), [])
const loadRules = (id) => { try { return fs.readFileSync(rulesFile(id), 'utf-8') } catch { return '' } }

// parser stok — format sama seperti perintah WA +stock
function parseStockEntries(body) {
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
    if (mField && cur) cur[mField[1].trim()] = mField[2].trim()
  }
  if (cur) entries.push(cur)
  return entries.filter((e) => Object.values(e).some((v) => v))
}

// ---------- auth ----------
const needAuth = (req, res, next) => {
  if (req.session?.user === 'admin') return next()
  return res.status(401).json({ error: 'belum login' })
}
app.get('/api/setup-needed', (req, res) => {
  res.json({ needed: !loadConfig().passwordHash })
})
app.post('/api/login', async (req, res) => {
  const cfg = loadConfig()
  if (!cfg.passwordHash) return res.status(503).json({ error: 'admin belum dikonfigurasi' })
  const ok = await bcrypt.compare(String(req.body.password || ''), cfg.passwordHash)
  if (!ok) return res.status(401).json({ error: 'password salah' })
  req.session.user = 'admin'
  res.json({ ok: true })
})
app.post('/api/logout', (req, res) => { req.session.destroy(() => res.json({ ok: true })) })
app.get('/api/me', (req, res) => res.json({ user: req.session?.user || null }))
// setup password awal (hanya saat belum ada password)
app.post('/api/setup', async (req, res) => {
  const cfg = loadConfig()
  if (cfg.passwordHash) return res.status(400).json({ error: 'sudah dikonfigurasi' })
  const { token, password } = req.body
  if (token !== SETUP_TOKEN) return res.status(403).json({ error: 'token setup salah' })
  if (!password || String(password).length < 6) return res.status(400).json({ error: 'password minimal 6 karakter' })
  cfg.passwordHash = await bcrypt.hash(String(password), 10)
  saveConfig(cfg)
  req.session.user = 'admin'
  res.json({ ok: true })
})

// ---------- stats ----------
app.get('/api/stats', needAuth, (req, res) => {
  const products = loadProducts()
  const cats = loadCategories()
  const orders = readJson(path.join(DATA, 'orders.json'), [])
  const today = new Date().toISOString().slice(0, 10)
  const todayOrders = orders.filter((o) => String(o.createdAt || '').startsWith(today))
  const paid = orders.filter((o) => o.status === 'paid')
  const revenue = paid.reduce((s, o) => s + (Number(o.amount) || 0), 0)
  res.json({
    products: products.length,
    categories: cats.length,
    stockTotal: products.reduce((s, p) => s + loadStock(p.id).length + (Number(p.stock) || 0), 0),
    ordersTotal: orders.length,
    ordersPaid: paid.length,
    ordersToday: todayOrders.length,
    revenue,
  })
})

// ---------- kategori ----------
app.get('/api/categories', needAuth, (req, res) => res.json(loadCategories()))
app.post('/api/categories', needAuth, (req, res) => {
  const { name, emoji } = req.body
  if (!name?.trim()) return res.status(400).json({ error: 'nama kategori wajib diisi' })
  const list = loadCategories()
  const id = slugify(name)
  if (list.some((c) => c.id === id)) return res.status(400).json({ error: 'kategori sudah ada' })
  list.push({ id, name: name.trim(), emoji: emoji?.trim() || '📦' })
  writeJsonAtomic(categoriesFile(), list)
  res.json({ ok: true, id })
})
app.put('/api/categories/:id', needAuth, (req, res) => {
  const list = loadCategories()
  const c = list.find((x) => x.id === req.params.id)
  if (!c) return res.status(404).json({ error: 'tidak ditemukan' })
  if (req.body.name?.trim()) { c.name = req.body.name.trim() }
  if (req.body.emoji?.trim()) c.emoji = req.body.emoji.trim()
  writeJsonAtomic(categoriesFile(), list)
  res.json({ ok: true })
})
app.delete('/api/categories/:id', needAuth, (req, res) => {
  const products = loadProducts()
  if (products.some((p) => p.categoryId === req.params.id))
    return res.status(400).json({ error: 'kategori masih dipakai produk — pindahkan dulu' })
  writeJsonAtomic(categoriesFile(), loadCategories().filter((c) => c.id !== req.params.id))
  res.json({ ok: true })
})

// ---------- produk ----------
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (req, file, cb) => cb(null, /^image\//.test(file.mimetype)),
})
function saveCover(id, file) {
  if (!file) return null
  let ext = (file.mimetype.split('/')[1] || 'jpg').replace(/[^a-z]/g, '') || 'jpg'
  if (ext === 'jpeg') ext = 'jpg'
  const filename = `${id}.${ext}`
  fs.mkdirSync(COVER_DIR, { recursive: true })
  fs.writeFileSync(path.join(COVER_DIR, filename), file.buffer)
  return filename
}
function deleteCoverFile(product) {
  try {
    if (product?.cover && product.cover !== '_default.jpg') {
      const f = path.join(COVER_DIR, product.cover)
      if (fs.existsSync(f)) fs.unlinkSync(f)
    }
  } catch { /* abaikan */ }
}
app.get('/api/products', needAuth, (req, res) => {
  const q = String(req.query.q || '').toLowerCase()
  const cat = String(req.query.cat || '')
  let list = loadProducts()
  if (cat) list = list.filter((p) => p.categoryId === cat)
  if (q) list = list.filter((p) => p.name.toLowerCase().includes(q) || p.id.includes(q))
  res.json(list.map((p) => ({ ...p, stockQueue: loadStock(p.id).length, rules: loadRules(p.id) })))
})
app.get('/api/products/:id', needAuth, (req, res) => {
  const p = loadProducts().find((x) => x.id === req.params.id)
  if (!p) return res.status(404).json({ error: 'tidak ditemukan' })
  res.json({ ...p, stockQueue: loadStock(p.id), rules: loadRules(p.id) })
})
app.post('/api/products', needAuth, upload.single('cover'), (req, res) => {
  const { name, title, description, price, stock, categoryId, largeCharge, rules } = req.body
  if (!name?.trim()) return res.status(400).json({ error: 'nama produk wajib diisi' })
  const list = loadProducts()
  const id = slugify(name)
  if (!id) return res.status(400).json({ error: 'nama tidak valid' })
  if (list.some((p) => p.id === id)) return res.status(400).json({ error: 'produk sudah ada' })
  const cover = saveCover(id, req.file)
  const p = {
    id,
    name: name.trim(),
    title: title?.trim() ? `*${title.trim()}*` : `*${name.trim()}*`,
    description: description?.trim() || '',
    price: Math.max(0, parseInt(price) || 0),
    stock: Math.max(0, parseInt(stock) || 0),
    cover,
    categoryId: categoryId || null,
  }
  if (largeCharge) p.largeCharge = parseInt(largeCharge) || 0
  list.push(p)
  writeJsonAtomic(productsFile(), list)
  if (rules?.trim()) {
    fs.mkdirSync(path.dirname(rulesFile(id)), { recursive: true })
    fs.writeFileSync(rulesFile(id), String(rules).slice(0, 500))
  }
  res.json({ ok: true, id })
})
app.put('/api/products/:id', needAuth, upload.single('cover'), (req, res) => {
  const list = loadProducts()
  const p = list.find((x) => x.id === req.params.id)
  if (!p) return res.status(404).json({ error: 'tidak ditemukan' })
  const { name, title, description, price, stock, categoryId, largeCharge, rules } = req.body
  if (name?.trim()) p.name = name.trim()
  if (title !== undefined) p.title = title?.trim() ? `*${title.trim()}*` : p.title
  if (description !== undefined) p.description = description
  if (price !== undefined) p.price = Math.max(0, parseInt(price) || 0)
  if (stock !== undefined) p.stock = Math.max(0, parseInt(stock) || 0)
  if (categoryId !== undefined) p.categoryId = categoryId || null
  if (largeCharge !== undefined) {
    if (largeCharge) p.largeCharge = parseInt(largeCharge) || 0
    else delete p.largeCharge
  }
  if (req.file) {
    deleteCoverFile(p)
    p.cover = saveCover(p.id, req.file)
  }
  if (req.body.removeCover === '1') { deleteCoverFile(p); p.cover = null }
  writeJsonAtomic(productsFile(), list)
  if (rules !== undefined) {
    fs.mkdirSync(path.dirname(rulesFile(p.id)), { recursive: true })
    fs.writeFileSync(rulesFile(p.id), String(rules).slice(0, 500))
  }
  res.json({ ok: true })
})
app.delete('/api/products/:id', needAuth, (req, res) => {
  const list = loadProducts()
  const p = list.find((x) => x.id === req.params.id)
  if (!p) return res.status(404).json({ error: 'tidak ditemukan' })
  deleteCoverFile(p)
  try { fs.unlinkSync(stockFile(p.id)) } catch {}
  try { fs.unlinkSync(rulesFile(p.id)) } catch {}
  writeJsonAtomic(productsFile(), list.filter((x) => x.id !== p.id))
  res.json({ ok: true })
})
// cover (atau default)
app.get('/api/covers/:id', (req, res) => {
  const p = loadProducts().find((x) => x.id === req.params.id)
  const name = p?.cover || '_default.jpg'
  const f = path.join(COVER_DIR, name)
  if (fs.existsSync(f)) return res.sendFile(f)
  const d = path.join(COVER_DIR, '_default.jpg')
  if (fs.existsSync(d)) return res.sendFile(d)
  res.status(404).end()
})
// ---------- stok antrean ----------
app.post('/api/products/:id/stock', needAuth, (req, res) => {
  const entries = parseStockEntries(req.body.text || '')
  if (!entries.length) return res.status(400).json({ error: 'tidak ada entri terbaca' })
  const list = loadStock(req.params.id)
  list.push(...entries)
  writeJsonAtomic(stockFile(req.params.id), list)
  res.json({ ok: true, added: entries.length, total: list.length })
})
app.delete('/api/products/:id/stock', needAuth, (req, res) => {
  const n = loadStock(req.params.id).length
  writeJsonAtomic(stockFile(req.params.id), [])
  res.json({ ok: true, cleared: n })
})
// ---------- orders ----------
app.get('/api/orders', needAuth, (req, res) => {
  const status = String(req.query.status || '')
  const limit = Math.min(200, parseInt(req.query.limit) || 50)
  let orders = readJson(path.join(DATA, 'orders.json'), [])
  orders = [...orders].reverse()
  if (status) orders = orders.filter((o) => o.status === status)
  const products = Object.fromEntries(loadProducts().map((p) => [p.id, p.name]))
  res.json(orders.slice(0, limit).map((o) => ({ ...o, _pname: products[o.productId] || o.productName })))
})

// ---------- static ----------
app.use(express.static(path.join(__dirname, 'public')))
app.get('*', (req, res) => res.sendFile(path.join(__dirname, 'public', 'index.html')))

app.listen(PORT, '0.0.0.0', () => console.log(`zenibot-admin jalan di :${PORT}`))
