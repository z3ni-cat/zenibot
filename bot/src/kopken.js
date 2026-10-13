// Alur order Kopken — diproses manual oleh admin.
// kota -> (area, khusus Jakarta) -> outlet -> varian (min 2 cup)
//   -> konfirmasi -> pesanan diteruskan ke Admin 2 (env KOPKEN_ADMIN)
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'
import { loadProducts, getProductPrice } from './products.js'
import { formatRupiah, formatWib, jidToNumber } from './utils.js'
import { sendButtons, sendList } from './buttons.js'
import { getDevice, clearNav } from './deviceMode.js'
import { adminJid } from './support.js'
import { STORE_NAME } from './brand.js'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const ROOT = path.join(__dirname, '..')
const DATA_FILE = path.join(ROOT, 'data', 'kopken.json')
const SESSION_FILE = path.join(ROOT, 'data', 'kopken_order.json')

export const KOPKEN_CAT = 'kopken'
const ADMIN2 = (process.env.KOPKEN_ADMIN || '').replace(/[^0-9]/g, '')
const SESSION_TTL = 15 * 60_000 // 15 menit
const MIN_CUP = 2

// ---------- data ----------
export function loadKopken() {
  try {
    return JSON.parse(fs.readFileSync(DATA_FILE, 'utf8'))
  } catch {
    return { cities: [] }
  }
}

function getCity(data, id) {
  return data.cities.find((c) => c.id === id)
}

function cityOutlets(city, areaId) {
  if (city.areas) {
    const a = city.areas.find((x) => x.id === areaId)
    return a ? a.outlets : []
  }
  return city.outlets || []
}

// ---------- sesi ----------
function loadSessions() {
  try {
    return JSON.parse(fs.readFileSync(SESSION_FILE, 'utf8'))
  } catch {
    return {}
  }
}
function saveSessions(s) {
  fs.writeFileSync(SESSION_FILE, JSON.stringify(s, null, 1))
}
export function getKopkenSession(sender) {
  const all = loadSessions()
  const s = all[sender]
  if (!s) return null
  if (Date.now() - s.updatedAt > SESSION_TTL) {
    delete all[sender]
    saveSessions(all)
    return null
  }
  return s
}
function setSession(sender, s) {
  const all = loadSessions()
  s.updatedAt = Date.now()
  all[sender] = s
  saveSessions(all)
}
export function clearKopkenSession(sender) {
  const all = loadSessions()
  delete all[sender]
  saveSessions(all)
}
const touch = (sender, s) => setSession(sender, s)

// ---------- produk Kopken ----------
function kopkenProducts() {
  return loadProducts().filter((p) => p.categoryId === KOPKEN_CAT)
}

// Pengelompokan varian agar menu tidak jadi satu tembok teks.
const KOPKEN_GROUPS = [
  { id: 'kopi', label: '☕ KOPI' },
  { id: 'teh', label: '🍵 TEH' },
  { id: 'nonkopi', label: '🍫 NON-KOPI' },
  { id: 'frappe', label: '🧊 FRAPPE' },
]
function groupOf(p) {
  const n = (p.name || '').toLowerCase()
  if (/frappe/.test(n)) return 'frappe'
  if (/matcha/.test(n)) return 'nonkopi'
  if (/tea|teh|hibiscus/.test(n)) return 'teh'
  if (/latte|kopi|macchiato|shaken/.test(n)) return 'kopi'
  return 'nonkopi'
}
// Urutan tampil + nomor pilih menu. Dipakai sendMenu & parser (harus sama).
function kopkenMenuProducts() {
  const order = { kopi: 0, teh: 1, nonkopi: 2, frappe: 3 }
  return kopkenProducts().sort((a, b) => order[groupOf(a)] - order[groupOf(b)])
}

// ---------- mulai ----------
export async function startKopkenFlow(ctx) {
  const { sock, chat, sender, msg } = ctx
  clearNav(sender)
  clearKopkenSession(sender)
  setSession(sender, { stage: 'city', items: {} })
  await sendCity({ sock, chat, sender, msg })
}

async function sendCity({ sock, chat, sender, msg }) {
  const data = loadKopken()
  const cities = data.cities
  const body =
    `☕ *Pesan Kopken*\n\n` +
    `Pilih area outlet dulu ya:`
  if (getDevice(sender) === 'iphone') {
    await sock.sendMessage(chat, {
      text: body + `\n\n` +
        cities.map((c, i) => `${i + 1}. ${c.name}`).join('\n') +
        `\n\n0. Batal\n_Balas dengan nomor._`,
    }, { quoted: msg })
    return
  }
  await sendButtons(sock, chat, {
    body,
    footer: STORE_NAME + ' • Kopken',
    buttons: cities.map((c) => ({ id: `kopken city ${c.id}`, text: c.name })),
  }, { quoted: msg })
}

async function sendArea({ sock, chat, sender, msg }, city) {
  const body = `☕ *Pesan Kopken*\n\nPilih wilayah ${city.name}:`
  if (getDevice(sender) === 'iphone') {
    await sock.sendMessage(chat, {
      text: body + `\n\n` +
        city.areas.map((a, i) => `${i + 1}. ${a.name}`).join('\n') +
        `\n\n0. Kembali\n_Balas dengan nomor._`,
    }, { quoted: msg })
    return
  }
  await sendButtons(sock, chat, {
    body,
    footer: STORE_NAME + ' • Kopken',
    buttons: city.areas.map((a) => ({ id: `kopken area ${a.id}`, text: a.name })),
  }, { quoted: msg })
}

async function sendOutlet({ sock, chat, sender, msg }, city, areaId) {
  const outlets = cityOutlets(city, areaId)
  const areaName = city.areas ? city.areas.find((a) => a.id === areaId).name : city.name
  const body =
    `☕ *Pesan Kopken*\n\n` +
    `Pilih outlet — *${areaName}* (${outlets.length} outlet):`
  if (getDevice(sender) === 'iphone') {
    const list = outlets.map((o, i) => `${i + 1}. ${o.name}`).join('\n')
    await sock.sendMessage(chat, {
      text: body + `\n\n` + list + `\n\n0. Kembali\n_Balas dengan nomor._`,
    }, { quoted: msg })
    return
  }
  await sendList(sock, chat, {
    body,
    footer: STORE_NAME + ' • Kopken',
    buttonTitle: 'Pilih Outlet',
    sections: [{
      title: areaName,
      rows: outlets.map((o, i) => ({
        id: `kopken outlet ${i}`,
        title: o.name,
        description: o.address.slice(0, 60),
      })),
    }],
    quickButtons: [{ id: 'kopken back', text: '◀ Kembali' }],
  }, { quoted: msg })
}

function sizePrice(p, large) {
  return getProductPrice(p) + (large ? (p.largeCharge || 0) : 0)
}

async function sendMenu({ sock, chat, sender, msg }, note = '') {
  const products = kopkenMenuProducts()
  let no = 0
  const sections = []
  for (const g of KOPKEN_GROUPS) {
    const items = products.filter((p) => groupOf(p) === g.id)
    if (!items.length) continue
    const lines = items.map((p) => {
      no++
      return `${no}. ${p.name} — ${formatRupiah(getProductPrice(p))}`
    })
    sections.push(`*${g.label}*\n${lines.join('\n')}`)
  }
  const largeMax = Math.max(0, ...products.map((p) => p.largeCharge || 0))
  const c1 = products[0]
  const c5 = products[4] || products[0]
  const howto =
    `💡 *Cara pesan:* Nomor x Jumlah\n` +
    `\n` +
    `Contoh: *${c1.name}* ada di Nomor 1\n` +
    `\n` +
    `Memesan Ukuran Normal\n` +
    `> 1 x2 = 2 Cup ${c1.name}\n` +
    `\n` +
    `Memesan Ukuran Large (+${formatRupiah(largeMax)})\n` +
    `> 1L x2 = 2 Cup ${c1.name} Large\n` +
    `\n` +
    `Memesan Beberapa Varian & Ukuran\n` +
    `> 1 x2, 5L = 2 Cup ${c1.name} + 1 Cup ${c5.name} Large`
  await sock.sendMessage(chat, {
    text:
      `☕ *Pilih Varian* (minimal ${MIN_CUP} cup)\n\n` +
      howto + `\n\n` +
      sections.join('\n\n') +
      `\n\nKetik *selesai* kalau sudah • *0* ganti outlet • *batal* batalkan.` +
      (note ? `\n\n${note}` : ''),
  }, { quoted: msg })
}

function cartText(items) {
  const products = kopkenProducts()
  const lines = []
  let total = 0
  let totalRp = 0
  for (const [key, qty] of Object.entries(items)) {
    const [pid, size] = key.split(':')
    const p = products.find((x) => x.id === pid)
    if (!p) continue
    const large = size === 'L'
    lines.push(`• ${p.name}${large ? ' Large' : ''} (${qty})`)
    total += qty
    totalRp += sizePrice(p, large) * qty
  }
  return { lines, total, totalRp }
}

async function sendConfirm({ sock, chat, sender, msg }, s) {
  const { lines, total, totalRp } = cartText(s.items)
  const body =
    `☕ *KONFIRMASI PESANAN*\n\n` +
    lines.join('\n') + `\n\n` +
    `📍 Lokasi Outlet:\n${s.outlet.name}\n${s.outlet.address}\n\n` +
    `Total: ${total} cup (estimasi ${formatRupiah(totalRp)})`
  if (getDevice(sender) === 'iphone') {
    await sock.sendMessage(chat, {
      text: body + `\n\n1. ✅ Konfirmasi\n2. ❌ Batal\n_Balas dengan nomor._`,
    }, { quoted: msg })
    return
  }
  await sendButtons(sock, chat, {
    body,
    footer: 'Pesanan Kopken diproses manual oleh admin.',
    buttons: [
      { id: 'kopken confirm', text: '✅ Konfirmasi' },
      { id: 'kopken cancel', text: '❌ Batal' },
    ],
  }, { quoted: msg })
}

// ---------- input ----------
export async function handleKopkenInput({ sock, chat, sender, msg, text, pushName }) {
  const raw = String(text || '').trim()
  if (!raw) return false
  const s = getKopkenSession(sender)
  if (!s) return false

  // 'menu' selalu jadi jalan keluar
  if (/^(ui:)?menu$/.test(raw.toLowerCase())) {
    clearKopkenSession(sender)
    return false
  }

  const reply = (t) => sock.sendMessage(chat, { text: t }, { quoted: msg })
  const low = raw.toLowerCase()

  // normalisasi id tombol "kopken ..." -> argumen
  let t = raw
  if (low.startsWith('kopken ')) t = raw.slice(7).trim()
  const tLow = t.toLowerCase()

  // ---- navigasi: 0 = kembali / batal per stage ----
  if (tLow === '0' || tLow === 'kopken back') {
    if (s.stage === 'city' || s.stage === 'confirm') {
      clearKopkenSession(sender)
      await reply('Pesanan Kopken dibatalkan. Ketik *menu* untuk kembali. 👍')
      return true
    }
    if (s.stage === 'area') {
      s.stage = 'city'; delete s.cityId
      touch(sender, s)
      await sendCity({ sock, chat, sender, msg })
      return true
    }
    if (s.stage === 'outlet' || s.stage === 'menu') {
      const data2 = loadKopken()
      const city2 = getCity(data2, s.cityId)
      s.stage = city2.areas ? 'area' : 'city'
      delete s.areaId; delete s.outlet
      if (s.stage === 'city') delete s.cityId
      touch(sender, s)
      if (s.stage === 'area') await sendArea({ sock, chat, sender, msg }, city2)
      else await sendCity({ sock, chat, sender, msg })
      return true
    }
  }
  if (/^batal|^cancel$/.test(tLow)) {
    clearKopkenSession(sender)
    await reply('Pesanan Kopken dibatalkan. Ketik *menu* untuk kembali. 👍')
    return true
  }

  const data = loadKopken()

  // ---- stage: pilih kota ----
  if (s.stage === 'city') {
    const cities = data.cities
    let city = null
    const m = t.match(/^(\d+)$/)
    if (tLow.startsWith('city ')) city = getCity(data, tLow.slice(5).trim())
    else if (m) city = cities[Number(m[1]) - 1]
    else city = cities.find((c) => c.name.toLowerCase() === tLow || c.id === tLow)
    if (!city) {
      await reply('Pilih area dengan nomor/tombol yang tersedia ya. Ketik *batal* untuk membatalkan.')
      return true
    }
    s.cityId = city.id
    if (city.areas) {
      s.stage = 'area'
      touch(sender, s)
      await sendArea({ sock, chat, sender, msg }, city)
    } else {
      s.stage = 'outlet'
      touch(sender, s)
      await sendOutlet({ sock, chat, sender, msg }, city)
    }
    return true
  }

  // ---- stage: pilih area (khusus Jakarta) ----
  if (s.stage === 'area') {
    const city = getCity(data, s.cityId)
    let area = null
    const m = t.match(/^(?:area )?(\d+)$/)
    if (tLow.startsWith('area ')) {
      const rest = tLow.slice(5).trim()
      const mn = rest.match(/^(\d+)$/)
      area = mn ? city.areas[Number(mn[1]) - 1] : city.areas.find((a) => a.id === rest)
    } else if (m) area = city.areas[Number(m[1]) - 1]
    else area = city.areas.find((a) => a.name.toLowerCase() === tLow || a.id === tLow)
    if (!area) {
      await reply('Pilih wilayah dengan nomor/tombol yang tersedia ya.')
      return true
    }
    s.areaId = area.id
    s.stage = 'outlet'
    touch(sender, s)
    await sendOutlet({ sock, chat, sender, msg }, city, area.id)
    return true
  }

  // ---- stage: pilih outlet ----
  if (s.stage === 'outlet') {
    const city = getCity(data, s.cityId)
    const outlets = cityOutlets(city, s.areaId)
    let idx = -1
    const m = t.match(/^(?:outlet )?(\d+)$/)
    if (m) idx = Number(m[1]) - 1
    if (idx < 0 || idx >= outlets.length) {
      await reply(`Pilih outlet nomor 1–${outlets.length} ya. Ketik *batal* untuk membatalkan.`)
      return true
    }
    s.outlet = outlets[idx]
    s.stage = 'menu'
    touch(sender, s)
    await reply(`📍 Outlet: *${s.outlet.name}*\n${s.outlet.address}`)
    await sendMenu({ sock, chat, sender, msg })
    return true
  }

  // ---- stage: pilih varian ----
  if (s.stage === 'menu') {
    if (tLow === 'selesai' || tLow === 'done') {
      const { total } = cartText(s.items)
      if (total < MIN_CUP) {
        await sendMenu({ sock, chat, sender, msg },
          `⚠️ Minimal ${MIN_CUP} cup dulu ya (sekarang ${total} cup). Tambahkan lagi.`)
        return true
      }
      s.stage = 'confirm'
      touch(sender, s)
      await sendConfirm({ sock, chat, sender, msg }, s)
      return true
    }
    const products = kopkenMenuProducts() // urutan sama dengan nomor di sendMenu
    const tokens = t.split(/[,\n]+/).map((x) => x.trim()).filter(Boolean)
    let added = 0
    const errors = []
    for (const tok of tokens) {
      const m = tok.match(/^(\d+)\s*(l|large)?\s*(?:x\s*(\d+))?$/i)
      if (!m) { errors.push(tok); continue }
      const p = products[Number(m[1]) - 1]
      const large = !!m[2]
      const qty = Math.min(20, Math.max(1, Number(m[3] || 1)))
      if (!p) { errors.push(tok); continue }
      const key = large ? `${p.id}:L` : p.id
      s.items[key] = Math.min(20, (s.items[key] || 0) + qty)
      added++
    }
    if (!added) {
      await reply('Format tidak dikenali. Contoh: *1 x2* atau *1 x2, 5* — lalu ketik *selesai*.')
      return true
    }
    touch(sender, s)
    const { lines, total, totalRp } = cartText(s.items)
    await reply(
      `🛒 *Keranjang*\n\n` + lines.join('\n') +
      `\n\nTotal: ${total} cup (estimasi ${formatRupiah(totalRp)})` +
      (errors.length ? `\n⚠️ Tidak dikenali: ${errors.join(', ')}` : '') +
      `\n\nTambah lagi, atau ketik *selesai*.`
    )
    return true
  }

  // ---- stage: konfirmasi ----
  if (s.stage === 'confirm') {
    if (tLow === 'confirm' || tLow === '1' || tLow === 'konfirmasi' || tLow === 'ya') {
      await confirmOrder({ sock, chat, sender, msg, pushName }, s)
      return true
    }
    if (tLow === 'cancel' || tLow === '2' || tLow === 'tidak') {
      clearKopkenSession(sender)
      await reply('Pesanan Kopken dibatalkan. Ketik *menu* untuk kembali. 👍')
      return true
    }
    await reply('Balas *1* untuk konfirmasi atau *2* untuk batal.')
    return true
  }

  return false
}

async function confirmOrder({ sock, chat, sender, msg, pushName }, s) {
  const { lines, total, totalRp } = cartText(s.items)
  const buyerNum = jidToNumber(sender)
  const buyerName = pushName || 'Kak'
  const when = formatWib()

  const adminText =
    `☕ *PESANAN KOPKEN BARU*\n\n` +
    `👤 Pembeli: ${buyerName} (${buyerNum})\n` +
    `🕐 ${when}\n\n` +
    `📍 Outlet:\n${s.outlet.name}\n${s.outlet.address}\n\n` +
    `🧾 Pesanan:\n` + lines.join('\n') + `\n\n` +
    `Total: ${total} cup (estimasi ${formatRupiah(totalRp)})\n\n` +
    `_Proses manual ya._`

  try {
    await sock.sendMessage(adminJid(ADMIN2), { text: adminText })
  } catch (e) {
    console.log('[kopken] gagal kirim ke admin:', e.message)
  }
  clearKopkenSession(sender)
  await sock.sendMessage(chat, {
    text:
      `✅ *Pesanan diteruskan ke admin.*\n\n` +
      `Admin akan menghubungimu untuk pembayaran & pengambilan.\n` +
      `Terima kasih sudah pesan via ${STORE_NAME}! 🙏`,
  }, { quoted: msg })
}
