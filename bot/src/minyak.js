// Kelola bisnis minyak goreng — sesi terpandu (owner only).
// Harga: modal Rp210.000/carton, jual Rp42.000/pouch, Rp245.000/carton.
// 1 carton = 6 pouch @2 liter.
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'
import { formatRupiah } from './utils.js'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const DATA_FILE = path.join(__dirname, '..', 'data', 'minyak.json')
const SESSION_FILE = path.join(__dirname, '..', 'data', 'minyak_session.json')
const TTL = 10 * 60_000 // 10 menit

export const MINYAK = {
  modalPerCarton: 210000,
  jualPouch: 42000,
  jualCarton: 245000,
  pouchPerCarton: 6,
}
const MODAL_PER_POUCH = MINYAK.modalPerCarton / MINYAK.pouchPerCarton // 35000

// Nomor tambahan yang boleh pakai tools minyak (selain owner di config).
// Sengaja terpisah dari owner agar tidak membuka akses ke perintah owner lain.
const _nums = (v) => String(v || '').split(',').map((s) => s.trim()).filter(Boolean)
export const MINYAK_ADMINS = _nums(process.env.MINYAK_ADMINS || process.env.OWNER_NUMBERS)

export function isMinyakAdmin(config, sender, senderNumber) {
  const all = [...(config.owner || []), ...MINYAK_ADMINS]
  return all.some((o) => {
    const clean = String(o).replace(/[^0-9]/g, '')
    return sender === o || senderNumber === clean
  })
}

// ---------- data ----------
function loadData() {
  try {
    const d = JSON.parse(fs.readFileSync(DATA_FILE, 'utf8'))
    if (!Array.isArray(d.batches)) d.batches = []
    if (!Array.isArray(d.sales)) d.sales = []
    return d
  } catch { return { batches: [], sales: [] } }
}
function saveData(d) {
  fs.mkdirSync(path.dirname(DATA_FILE), { recursive: true })
  fs.writeFileSync(DATA_FILE, JSON.stringify(d, null, 2))
}

export function addBatch(cartons) {
  const d = loadData()
  d.batches.push({ cartons, at: Date.now() })
  saveData(d)
}

// return { ok } atau { error }
export function recordSale(cartons, pouches) {
  const t = getTotals()
  const need = cartons * MINYAK.pouchPerCarton + pouches
  if (need <= 0) return { error: 'Jumlah tidak valid.' }
  if (need > t.sisa) return { error: `Stok tidak cukup. Sisa: ${fmtStock(t.sisa)}.` }
  const d = loadData()
  d.sales.push({ cartons, pouches, at: Date.now() })
  saveData(d)
  const revenue = cartons * MINYAK.jualCarton + pouches * MINYAK.jualPouch
  const profit = revenue - need * MODAL_PER_POUCH
  return { ok: true, revenue, profit, sisa: t.sisa - need }
}

export function getTotals() {
  const d = loadData()
  const boughtP = d.batches.reduce((a, b) => a + b.cartons * MINYAK.pouchPerCarton, 0)
  const modal = d.batches.reduce((a, b) => a + b.cartons * MINYAK.modalPerCarton, 0)
  const soldC = d.sales.reduce((a, s) => a + (s.cartons || 0), 0)
  const soldP = d.sales.reduce((a, s) => a + (s.pouches || 0), 0)
  const soldPouches = soldC * MINYAK.pouchPerCarton + soldP
  const revenue = soldC * MINYAK.jualCarton + soldP * MINYAK.jualPouch
  const profit = revenue - soldPouches * MODAL_PER_POUCH
  return {
    boughtP, boughtC: Math.floor(boughtP / MINYAK.pouchPerCarton),
    modal, soldC, soldP, soldPouches, revenue, profit,
    sisa: boughtP - soldPouches,
  }
}

export function fmtStock(pouches) {
  const c = Math.floor(pouches / MINYAK.pouchPerCarton)
  const p = pouches % MINYAK.pouchPerCarton
  return `${c} carton ${p} pouch`
}

export function buildReport() {
  const t = getTotals()
  const pct = t.boughtP ? Math.round((t.soldPouches / t.boughtP) * 100) : 0
  const bars = Math.round(pct / 10)
  const bar = '▓'.repeat(bars) + '░'.repeat(10 - bars)
  return [
    '🛢️ *Laporan Minyak Goreng*', '',
    `📥 Dibeli: ${fmtStock(t.boughtP)}`,
    `💰 Modal: ${formatRupiah(t.modal)}`,
    `📤 Terjual: ${fmtStock(t.soldPouches)}`,
    `💵 Omzet: ${formatRupiah(t.revenue)}`,
    `📈 Untung: ${formatRupiah(t.profit)}`,
    `📦 Sisa: ${fmtStock(t.sisa)}`, '',
    `${bar} ${pct}% terjual`,
  ].join('\n')
}

export function buildMenu() {
  const t = getTotals()
  return [
    '🛢️ *Kelola Minyak Goreng*',
    `📦 Stok: ${fmtStock(t.sisa)}`, '',
    '1️⃣ PO baru — catat pembelian carton',
    '2️⃣ Catat penjualan',
    '3️⃣ Laporan', '',
    'Balas *1/2/3*, atau "batal".',
  ].join('\n')
}

// ---------- sesi ----------
function loadSessions() {
  try { return JSON.parse(fs.readFileSync(SESSION_FILE, 'utf8')) } catch { return {} }
}
function saveSessions(s) {
  fs.mkdirSync(path.dirname(SESSION_FILE), { recursive: true })
  fs.writeFileSync(SESSION_FILE, JSON.stringify(s, null, 2))
}
export function getMinyakSession(sender) {
  const s = loadSessions()[sender]
  if (!s) return null
  if (Date.now() - s.createdAt > TTL) {
    clearMinyakSession(sender)
    return null
  }
  return s
}
export function startMinyakSession(sender) {
  const s = loadSessions()
  s[sender] = { step: 'menu', createdAt: Date.now() }
  saveSessions(s)
}
export function clearMinyakSession(sender) {
  const s = loadSessions()
  delete s[sender]
  saveSessions(s)
}
function setStep(sender, step) {
  const s = loadSessions()
  if (s[sender]) { s[sender].step = step; saveSessions(s) }
}

export async function handleMinyakInput({ sender, text, reply }) {
  const sess = getMinyakSession(sender)
  if (!sess) return false
  const t = text.trim().toLowerCase()
  if (t === 'batal' || t === 'cancel') {
    clearMinyakSession(sender)
    await reply('❌ Sesi minyak dibatalkan.')
    return true
  }
  if (sess.step === 'menu') {
    if (t === '1' || t.startsWith('po')) {
      setStep(sender, 'po')
      await reply('📥 *PO Baru*\n\nBerapa carton yang dibeli? (angka saja, cth: 200)')
    } else if (t === '2' || t.includes('jual') || t.includes('laku')) {
      setStep(sender, 'jual')
      await reply('📤 *Catat Penjualan*\n\nTerjual berapa? Cth: `3 carton` atau `10 pouch`')
    } else if (t === '3' || t.includes('lapor')) {
      clearMinyakSession(sender)
      await reply(buildReport())
    } else {
      await reply('Balas *1/2/3*, atau "batal".')
    }
    return true
  }
  if (sess.step === 'po') {
    const n = parseInt(t.replace(/[^0-9]/g, ''), 10)
    if (!n || n <= 0 || n > 100000) {
      await reply('Masukkan angka yang valid, cth: 200')
      return true
    }
    addBatch(n)
    clearMinyakSession(sender)
    await reply(
      `✅ *PO dicatat:* ${n} carton (${(n * MINYAK.pouchPerCarton).toLocaleString('id-ID')} pouch)\n` +
      `💰 Modal: ${formatRupiah(n * MINYAK.modalPerCarton)}\n` +
      `📦 Stok sekarang: ${fmtStock(getTotals().sisa)}`
    )
    return true
  }
  if (sess.step === 'jual') {
    const m = t.match(/^(\d+)\s*(carton|karton|dus|crt|pouch|pch|pcs|bks|bungkus)?$/)
    if (!m) {
      await reply('Format: `<jumlah> carton` atau `<jumlah> pouch`\nCth: `3 carton`')
      return true
    }
    const n = parseInt(m[1], 10)
    const unit = (m[2] || '').toLowerCase()
    let cartons = 0, pouches = 0
    if (!unit) {
      await reply('Sebutkan satuannya: `3 carton` atau `10 pouch`')
      return true
    }
    if (['carton', 'karton', 'dus', 'crt'].includes(unit)) cartons = n
    else pouches = n
    const res = recordSale(cartons, pouches)
    clearMinyakSession(sender)
    if (res.error) {
      await reply('⚠️ ' + res.error)
      return true
    }
    const label = cartons ? `${cartons} carton` : `${pouches} pouch`
    await reply(
      `✅ *Tercatat:* laku ${label}\n` +
      `💵 Omzet +${formatRupiah(res.revenue)} | 📈 Untung +${formatRupiah(res.profit)}\n` +
      `📦 Sisa: ${fmtStock(res.sisa)}`
    )
    return true
  }
  return true
}
