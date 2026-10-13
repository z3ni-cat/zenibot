// Sistem lisensi ZeniBot — validasi via license server.
//
// Cara kerja:
//   1. Pembeli dapat LICENSE_KEY, isi di .env
//   2. Saat start (dan tiap 24 jam), bot mengirim {key, hwid} ke LICENSE_SERVER
//   3. Server menjawab valid/tidak + tier. Hasil di-cache 7 hari (toleransi offline).
//   4. Tanpa key valid -> selalu Lite. Tidak ada bypass via env.
//
//   LICENSE_KEY      kunci lisensi pembeli (kosong = Lite)
//   LICENSE_SERVER   URL server lisensi (default: server resmi)
//   HWID disimpan di data/.hwid (dibuat otomatis saat pertama jalan;
//   key terikat ke HWID pertama yang aktivasi -> tidak bisa dishare bebas)
import fs from 'fs'
import path from 'path'
import crypto from 'crypto'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const HWID_FILE = path.join(__dirname, '..', 'data', '.hwid')
const CACHE_FILE = path.join(__dirname, '..', 'data', '.license-cache.json')
const GRACE_MS = 7 * 24 * 3600_000
const REVALIDATE_MS = 24 * 3600_000

export const LITE_MAX_PRODUCTS = Math.max(1, parseInt(process.env.LITE_MAX_PRODUCTS || '10', 10))
export const FULL_PRICE = process.env.FULL_PRICE || 'Rp150.000'
export const SALES_CONTACT = process.env.SALES_CONTACT || ''
export const PROMO_EVERY_HOURS = parseFloat(process.env.PROMO_EVERY_HOURS || '6')

let _tier = 'lite'
export const isPremium = () => _tier === 'premium'

function getHwid() {
  try {
    if (fs.existsSync(HWID_FILE)) return fs.readFileSync(HWID_FILE, 'utf-8').trim()
  } catch {}
  const id = crypto.randomUUID()
  try {
    fs.mkdirSync(path.dirname(HWID_FILE), { recursive: true })
    fs.writeFileSync(HWID_FILE, id, { mode: 0o600 })
  } catch {}
  return id
}

function readCache() {
  try {
    const c = JSON.parse(fs.readFileSync(CACHE_FILE, 'utf-8'))
    if (c && Date.now() - c.at < GRACE_MS) return c
  } catch {}
  return null
}

function writeCache(tier) {
  try {
    fs.mkdirSync(path.dirname(CACHE_FILE), { recursive: true })
    fs.writeFileSync(CACHE_FILE, JSON.stringify({ tier, at: Date.now() }), { mode: 0o600 })
  } catch {}
}

async function validateRemote() {
  const key = String(process.env.LICENSE_KEY || '').trim()
  const server = String(process.env.LICENSE_SERVER || 'https://ksrcloud.my.id/zenibot-license').replace(/\/+$/, '')
  if (!key) return null
  const ctrl = new AbortController()
  const t = setTimeout(() => ctrl.abort(), 15000)
  try {
    const r = await fetch(`${server}/validate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ key, hwid: getHwid() }),
      signal: ctrl.signal,
    })
    const d = await r.json().catch(() => ({}))
    if (r.ok && d.ok) return d.tier === 'premium' ? 'premium' : 'lite'
    console.log('[license]', d.message || `server menolak (${r.status})`)
    return 'lite'
  } catch (e) {
    console.log('[license] server tidak terjangkau, pakai cache:', e.message)
    return null // -> fallback ke cache
  } finally {
    clearTimeout(t)
  }
}

// Dipanggil sekali saat bot start. Lalu re-validasi tiap 24 jam.
export async function initLicense() {
  const remote = await validateRemote()
  if (remote) {
    _tier = remote
    writeCache(remote)
  } else {
    const c = readCache()
    _tier = c ? c.tier : 'lite'
    if (c) console.log('[license] pakai cache, tier:', _tier)
  }
  console.log(`[license] edisi aktif: ${_tier.toUpperCase()}`)
  setInterval(async () => {
    const r = await validateRemote()
    if (r) { _tier = r; writeCache(r); console.log('[license] re-validasi:', r) }
  }, REVALIDATE_MS)
}

const contactLine = () =>
  SALES_CONTACT ? `\n📞 Hubungi: ${SALES_CONTACT}` : ''

export function upsellText(feature) {
  return (
    `🔓 *Fitur Premium* — ${feature} hanya tersedia di *ZeniBot Full Version*.\n\n` +
    `Buka semua fitur (${FULL_PRICE}, sekali bayar):\n` +
    `✅ Admin panel web\n` +
    `✅ Tanpa batas produk\n` +
    `✅ SMM panel & market monitor\n` +
    `✅ Jasa generate video AI\n` +
    `✅ Tanpa pesan promo` +
    contactLine()
  )
}

export function promoText() {
  return (
    `💡 *Suka dengan ZeniBot?*\n\n` +
    `Kamu memakai versi Lite (gratis). Upgrade ke *Full Version* — ${FULL_PRICE} sekali bayar, dapatkan:\n` +
    `✅ Admin panel web (kelola toko tanpa perintah chat)\n` +
    `✅ Tanpa batas jumlah produk\n` +
    `✅ SMM panel, market monitor & jasa video AI\n` +
    `✅ Tanpa pesan promo ini 😄` +
    contactLine()
  )
}
