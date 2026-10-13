// Wizard tambah produk via percakapan — khusus admin.
// Dipicu dari plugin +produk saat perintahnya hanya "+produk <Kategori>" (tanpa |).
//
// Alur:
//   Admin: +produk App        -> Bot: Nama Produk
//   Admin: Netflix            -> Bot: Judul Pesan
//   Admin: Netflix Sharing    -> Bot: Harga | Stock
//   Admin: 30.000 | 10        -> Bot: Isi Deskripsi
//   Admin: <deskripsi>        -> Bot: ✅ Produk Netflix sudah dimasukan kedalam Daftar Menu
//
// Ketik "batal" di langkah mana pun untuk membatalkan. Sesi kedaluwarsa 10 menit.
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'
import {
  loadProducts, saveProducts, slugify,
  loadCategories, saveCategories, matchCategory,
} from './products.js'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const SESS_FILE = path.join(__dirname, '..', 'data', 'wizard.json')
const TIMEOUT_MS = 10 * 60_000
const BATAL = /^\s*batal\s*$/i

function loadSessions() {
  try { return JSON.parse(fs.readFileSync(SESS_FILE, 'utf8')) } catch { return {} }
}
function saveSessions(s) {
  fs.mkdirSync(path.dirname(SESS_FILE), { recursive: true })
  fs.writeFileSync(SESS_FILE, JSON.stringify(s, null, 2))
}
export function getWizardSession(sender) {
  const all = loadSessions()
  const s = all[sender]
  if (!s) return null
  if (Date.now() - s.updatedAt > TIMEOUT_MS) {
    delete all[sender]; saveSessions(all)
    return null
  }
  return s
}
function clearWizard(sender) {
  const all = loadSessions()
  delete all[sender]; saveSessions(all)
}
function setWizard(sender, data) {
  const all = loadSessions()
  all[sender] = { ...data, updatedAt: Date.now() }
  saveSessions(all)
}

const ask = (t) => `${t}\n\n_(ketik_ \`batal\` _untuk membatalkan)_`

// Dipanggil dari plugin +produk saat formatnya "+produk <Kategori>" (tanpa |)
export function startWizard(sender, catName, reply) {
  const cats = loadCategories()
  const matched = matchCategory(cats, catName)
  if (matched.ambiguous) {
    return reply(
      `⚠️ *${catName}* cocok dengan beberapa kategori:\n` +
      matched.ambiguous.map((c) => `• ${c.name}`).join('\n') +
      `\n\nTulis nama kategorinya lebih lengkap ya.`
    )
  }
  let cat = matched.cat
  if (!cat) {
    cat = { id: slugify(catName), name: catName, emoji: '🛍️' }
    cats.push(cat); saveCategories(cats)
  }
  setWizard(sender, { step: 'nama', catId: cat.id, catName: cat.name })
  return reply(ask('📝 *Nama Produk:*'))
}

function parsePrice(s) {
  const n = parseInt(String(s).replace(/[^\d]/g, ''), 10)
  return Number.isFinite(n) && n > 0 ? n : 0
}
function parseStock(s) {
  const n = parseInt(String(s).replace(/[^\d]/g, ''), 10)
  return Number.isFinite(n) && n >= 0 ? n : -1
}

// Dipanggil dari handler.js untuk setiap pesan teks dari pengirim yang punya sesi aktif.
// Return true jika pesan ditangani wizard (jangan teruskan ke plugin).
export async function handleWizardStep({ sender, text, reply }) {
  const s = getWizardSession(sender)
  if (!s) return false
  const t = text.trim()
  if (BATAL.test(t)) {
    clearWizard(sender)
    await reply('🚫 Wizard dibatalkan.')
    return true
  }

  if (s.step === 'nama') {
    if (!t) { await reply(ask('📝 *Nama Produk:* _(tidak boleh kosong)_')); return true }
    setWizard(sender, { ...s, step: 'judul', name: t })
    await reply(ask('📰 *Judul Pesan:*'))
    return true
  }
  if (s.step === 'judul') {
    if (!t) { await reply(ask('📰 *Judul Pesan:* _(tidak boleh kosong)_')); return true }
    setWizard(sender, { ...s, step: 'harga', title: t })
    await reply(ask('💵 *Harga | Stock:*\n\nContoh: `30.000 | 10`'))
    return true
  }
  if (s.step === 'harga') {
    const parts = t.split('|').map((x) => x.trim())
    const price = parsePrice(parts[0] || '')
    const stock = parseStock(parts[1] || '')
    if (!price || stock < 0) {
      await reply(ask('💵 *Harga | Stock:*\n\nFormat belum tepat. Contoh: `30.000 | 10`'))
      return true
    }
    setWizard(sender, { ...s, step: 'deskripsi', price, stock })
    await reply(ask('📄 *Isi Deskripsi:*'))
    return true
  }
  if (s.step === 'deskripsi') {
    if (!t) { await reply(ask('📄 *Isi Deskripsi:* _(tidak boleh kosong)_')); return true }
    // Simpan produk
    const list = loadProducts()
    const id = slugify(s.name)
    const existing = list.find((p) => p.id === id)
    const data = {
      name: s.name, title: s.title, description: t,
      price: s.price, stock: s.stock,
      cover: existing?.cover || null, categoryId: s.catId,
    }
    if (existing) Object.assign(existing, data)
    else list.push({ id, ...data })
    saveProducts(list)
    clearWizard(sender)
    await reply(
      `✅ Produk *${s.name}* sudah dimasukan kedalam Daftar Menu` +
      `\n📁 Kategori: *${s.catName}*` +
      `\n💵 Harga: Rp${s.price.toLocaleString('id-ID')} | 📦 Stok: ${s.stock}`
    )
    return true
  }
  clearWizard(sender)
  return false
}
