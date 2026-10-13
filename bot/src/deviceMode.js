// Mode device per pengguna — iPhone tidak mendukung tombol interaktif
// (nativeFlow), jadi navigasi pakai teks bernomor.
//
// Alur:
//   - Pengirim baru (chat pribadi, non-admin, tanpa preferensi) mengirim APA PUN
//     -> pesan sambutan + pilihan device (1. Android / 2. iPhone), disimpan.
//   - Android -> alur tombol seperti biasa.
//   - iPhone  -> semua menu dirender sebagai teks bernomor; balasan angka
//     diterjemahkan jadi perintah internal (dispatch) ke plugin yang sama.
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'
import { loadCategories, loadProducts } from './products.js'
import { buyerSession } from './support.js'
import { TOOL_CATS, TOOLS } from './freetools.js'
import { SMM_GROUPS, readCatalog } from './smm.js'
import { BOT_NAME, STORE_NAME } from './brand.js'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const PREF_FILE = path.join(__dirname, '..', 'data', 'device_pref.json')
const NAV_FILE = path.join(__dirname, '..', 'data', 'nav.json')

function loadJson(f) {
  try { return JSON.parse(fs.readFileSync(f, 'utf8')) } catch { return {} }
}
function saveJson(f, obj) {
  fs.mkdirSync(path.dirname(f), { recursive: true })
  fs.writeFileSync(f, JSON.stringify(obj, null, 2))
}

export function getDevice(sender) {
  return loadJson(PREF_FILE)[sender] || null
}
export function setDevice(sender, dev) {
  const p = loadJson(PREF_FILE)
  p[sender] = dev
  saveJson(PREF_FILE, p)
}
export function getNav(sender) {
  return loadJson(NAV_FILE)[sender] || null
}
export function setNav(sender, nav) {
  const n = loadJson(NAV_FILE)
  if (nav) n[sender] = nav
  else delete n[sender]
  saveJson(NAV_FILE, n)
}
export const clearNav = (sender) => setNav(sender, null)

export function isOwnerSender(config, sender, senderNumber) {
  const owners = config.owner || []
  return owners.some((o) => {
    const n = String(o).replace(/[^0-9]/g, '')
    return n && (sender.includes(n) || senderNumber === n)
  })
}

const welcomeText = (name) =>
  `Halo *${name}* 👋🏻\n\n` +
  `Perkenalkan, *${BOT_NAME}* — Bot WhatsApp ${STORE_NAME} 🤖\n\n` +
  `Biar tampilannya pas di HP kamu, pilih device yang kamu pakai:\n\n` +
  `1. Android\n` +
  `2. iPhone\n\n` +
  `_Balas dengan nomor pilihan._`

// return true jika pesan sudah ditangani (jangan teruskan ke plugin)
export async function handleDeviceFlow({ chat, sender, senderNumber, pushName, text, reply, config, dispatch }) {
  if (isOwnerSender(config, sender, senderNumber)) return false
  const t = text.trim()
  const nav = getNav(sender)
  const inSession = !!buyerSession(chat)

  // 1) Menunggu pilihan device
  if (nav?.page === 'ask_device') {
    const v = t.toLowerCase()
    let dev = null
    if (v === '1' || v === 'android') dev = 'android'
    else if (v === '2' || v === 'iphone' || v === 'ios') dev = 'iphone'
    if (!dev) {
      await reply('Pilih device yang kamu pakai:\n\n1. Android\n2. iPhone\n\n_Balas dengan nomor._')
      return true
    }
    setDevice(sender, dev)
    setNav(sender, null)
    await reply(
      dev === 'android'
        ? '✅ *Android* tersimpan! Menampilkan menu…'
        : '✅ *iPhone* tersimpan!\n\n_(Mulai sekarang balas dengan nomor untuk memilih menu.)_'
    )
    await dispatch('menu', [])
    return true
  }

  // 2) Navigasi angka pada menu teks
  if (/^\d+$/.test(t) && nav && nav.page !== 'ask_device' && !inSession) {
    return await routeNumber({ nav, n: parseInt(t, 10), reply, dispatch })
  }

  // 3) Belum punya preferensi -> onboarding (pesan apa pun)
  if (!getDevice(sender) && !inSession) {
    setNav(sender, { page: 'ask_device' })
    await reply(welcomeText(pushName || 'Kak'))
    return true
  }
  return false
}

async function routeNumber({ nav, n, reply, dispatch }) {
  const go = async (cmd, args = []) => { await dispatch(cmd, args); return true }
  switch (nav.page) {
    case 'main':
      if (n === 1) return go('shop')
      if (n === 2) return go('stock')
      // PARKIR 3 Okt 2026: if (n === 3) return go('chatadmin')
      if (n === 4) return go('toolcat', ['downloader'])
      if (n === 5) return go('toolcat', ['tools'])
      if (n === 6) return go('zenimusic')
      if (n === 7) return go('toolcat', ['stiker'])
      break
    case 'toolcats': {
      if (n === 0) return go('menu')
      if (n >= 1 && n <= TOOL_CATS.length) return go('toolcat', [TOOL_CATS[n - 1].id])
      break
    }
    case 'toolcat': {
      if (n === 0) return go('menu')
      const tools = TOOLS.filter((t) => t.cat === nav.catId)
      if (n >= 1 && n <= tools.length) return go('tool', [tools[n - 1].id])
      break
    }
    case 'shop': {
      if (n === 0) return go('menu')
      const cats = loadCategories()
      if (n >= 1 && n <= cats.length) return go('cat', [cats[n - 1].id])
      break
    }
    case 'cat': {
      if (n === 0) return go('shop')
      const prods = loadProducts().filter((p) => p.categoryId === nav.catId)
      if (n >= 1 && n <= prods.length) return go('prod', [prods[n - 1].id])
      break
    }
    case 'smmhome': {
      if (n === 0) return go('shop')
      if (n >= 1 && n <= SMM_GROUPS.length) return go('smm', ['cat', SMM_GROUPS[n - 1]])
      break
    }
    case 'smmgroup': {
      if (n === 0) return go('smm')
      const list = (readCatalog().groups[nav.group] || [])
      if (n >= 1 && n <= list.length) return go('smm', ['svc', list[n - 1].id])
      break
    }
    case 'smmsvc': {
      if (n === 0) return go('smm')
      if (n === 1) return go('smm', ['buy', nav.id])
      if (n === 2) return go('smm', ['cat', nav.group])
      break
    }
    case 'aics':
      if (n === 1) return go('shop')
      break
    case 'prod':
      if (n === 0) return go('menu')
      if (n === 1) return go(nav.canBuy ? 'beli' : 'ask', [nav.productId])
      if (n === 2) return go('cat', [nav.catId])
      break
  }
  await reply('_Pilihan tidak valid. Balas dengan nomor yang tersedia._')
  return true
}
