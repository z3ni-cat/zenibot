// Sesi bantuan pembeli <-> admin via bot sebagai perantara.
//
// Alur: pembeli ketuk "Tanyakan Stok" -> notifikasi ke semua admin.
// Admin pertama yang balas Terima/Tolak memenangkan sesi (yang lain
// diberi tahu sesi sudah ditangani). Jika Terima: pesan pembeli <-> admin
// diteruskan dua arah dengan label "diteruskan", nomor admin disembunyikan.
// Jika Tolak: pembeli diberi tahu stok kosong.
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'
import {
  generateForwardMessageContent,
  generateWAMessageFromContent,
} from '@whiskeysockets/baileys'
import { jidToNumber } from './utils.js'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const FILE = path.join(__dirname, '..', 'data', 'support_sessions.json')

const _nums = (v) => String(v || '').split(',').map((s) => s.trim()).filter(Boolean)
export const SUPPORT_ADMINS = _nums(process.env.SUPPORT_ADMINS || process.env.OWNER_NUMBERS)
export const adminJid = (num) => `${num}@s.whatsapp.net`

const WAITING_TIMEOUT_MS = 30 * 60_000 // 30 menit tanpa respons -> tutup otomatis

const now = () => new Date().toISOString()

export function loadSessions() {
  try {
    const d = JSON.parse(fs.readFileSync(FILE, 'utf8'))
    return Array.isArray(d) ? d : []
  } catch {
    return []
  }
}

export function saveSessions(list) {
  fs.mkdirSync(path.dirname(FILE), { recursive: true })
  fs.writeFileSync(FILE, JSON.stringify(list, null, 2))
}

function makeCode() {
  const c = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
  let s = ''
  for (let i = 0; i < 4; i++) s += c[Math.floor(Math.random() * c.length)]
  return s
}

export function createSession({ buyerJid, buyerNumber, buyerName, productId, productName }) {
  const list = loadSessions()
  let code = makeCode()
  while (list.some((x) => x.code === code)) code = makeCode()
  const s = {
    code, buyerJid, buyerNumber, buyerName, productId, productName,
    status: 'waiting', adminJid: null, adminNumber: null, createdAt: now(),
  }
  list.push(s)
  saveSessions(list)
  return s
}

export function getSession(code) {
  return loadSessions().find((s) => s.code === code) || null
}

export function patchSession(code, patch) {
  const list = loadSessions()
  const s = list.find((x) => x.code === code)
  if (!s) return null
  Object.assign(s, patch)
  saveSessions(list)
  return s
}

// Sesi milik pembeli yang masih hidup (waiting/active)
export function buyerSession(buyerJid) {
  return (
    loadSessions().find(
      (s) => s.buyerJid === buyerJid && (s.status === 'waiting' || s.status === 'active')
    ) || null
  )
}

export function waitingSessions() {
  return loadSessions().filter((s) => s.status === 'waiting')
}

// Sesi aktif terbaru yang ditangani admin ini
export function activeSessionForAdmin(adminChatJid) {
  const act = loadSessions().filter(
    (s) => s.status === 'active' && s.adminJid === adminChatJid
  )
  return act.length ? act[act.length - 1] : null
}

// Teruskan pesan apa adanya dengan label "diteruskan" ala WhatsApp
export async function forwardTo(sock, targetJid, msg) {
  const content = generateForwardMessageContent(msg, true)
  const waMsg = generateWAMessageFromContent(targetJid, content, {})
  await sock.relayMessage(targetJid, waMsg.message, { messageId: waMsg.key.id })
}

export function extractQuotedText(m) {
  const ctx =
    m.message?.extendedTextMessage?.contextInfo ||
    m.message?.imageMessage?.contextInfo ||
    m.message?.videoMessage?.contextInfo ||
    m.message?.documentMessage?.contextInfo
  const q = ctx?.quotedMessage
  if (!q) return ''
  return (
    q.conversation ||
    q.extendedTextMessage?.text ||
    q.imageMessage?.caption ||
    q.videoMessage?.caption ||
    q.documentMessage?.caption ||
    ''
  )
}

export function extractSessionCode(text) {
  const mt = String(text || '').match(/\[Sesi #([A-Z0-9]{4})\]/)
  return mt ? mt[1] : null
}

function isAdmin(sender, config) {
  const num = jidToNumber(sender)
  return SUPPORT_ADMINS.includes(num) || (config.owner || []).includes(sender)
}

async function notifyOtherAdmins(sock, skipChat, skipNumber, text) {
  for (const num of SUPPORT_ADMINS) {
    const jid = adminJid(num)
    if (jid === skipChat || num === skipNumber) continue
    await sock.sendMessage(jid, { text }).catch((e) =>
      console.error(`[support] gagal notif ${num}:`, e.message)
    )
  }
}

// Dipanggil dari handler saat pesan tidak cocok dengan plugin mana pun.
// return true = pesan sudah ditangani (jangan log "tidak dikenal").
export async function handleSupportMessage({ sock, msg, chat, sender, text, config }) {
  const low = (text || '').trim().toLowerCase()

  if (isAdmin(sender, config)) {
    if (low === 'terima' || low === 'tolak') return handleDecision({ sock, msg, chat, sender, accept: low === 'terima' })

    if (low === 'akhiri') {
      const s = activeSessionForAdmin(chat)
      if (!s) return false
      patchSession(s.code, { status: 'closed', reason: 'ended_by_admin', closedAt: now() })
      await sock.sendMessage(s.buyerJid, {
        text: `ℹ️ _Admin mengakhiri chat ini. Ketik *menu* untuk kembali ke daftar produk._`,
      }).catch(() => {})
      await sock.sendMessage(chat, { text: `✅ Sesi #${s.code} ditutup.` }, { quoted: msg }).catch(() => {})
      console.log(`[support] sesi #${s.code} diakhiri admin`)
      return true
    }

    const s = activeSessionForAdmin(chat)
    if (s) {
      await forwardTo(sock, s.buyerJid, msg).catch((e) =>
        console.error('[support] gagal forward ke pembeli:', e.message)
      )
      return true
    }
    return false
  }

  // ---- sisi pembeli ----
  if (low === 'akhiri') {
    const s = buyerSession(chat)
    if (!s) return false
    patchSession(s.code, { status: 'closed', reason: 'ended_by_buyer', closedAt: now() })
    if (s.status === 'active' && s.adminJid) {
      await sock.sendMessage(s.adminJid, { text: `ℹ️ Pembeli mengakhiri sesi #${s.code}.` }).catch(() => {})
    } else {
      await notifyOtherAdmins(sock, null, null, `ℹ️ Pembeli membatalkan sesi #${s.code} (*${s.productName}*).`)
    }
    await sock.sendMessage(chat, { text: `✅ Sesi ditutup. Ketik *menu* untuk kembali.` }, { quoted: msg }).catch(() => {})
    console.log(`[support] sesi #${s.code} diakhiri pembeli`)
    return true
  }

  const s = buyerSession(chat)
  if (s && s.status === 'active' && s.adminJid) {
    await forwardTo(sock, s.adminJid, msg).catch((e) =>
      console.error('[support] gagal forward ke admin:', e.message)
    )
    return true
  }
  return false
}

async function handleDecision({ sock, msg, chat, sender, accept }) {
  // Cari sesi: dari quote pesan notifikasi dulu, fallback ke satu-satunya waiting
  let code = extractSessionCode(extractQuotedText(msg))
  let s = code ? getSession(code) : null
  if (!s) {
    const waiting = waitingSessions()
    if (waiting.length === 1) {
      s = waiting[0]
      code = s.code
    } else {
      await sock.sendMessage(
        chat,
        { text: `❓ _Balas dengan *quote/reply* pada pesan notifikasi sesi yang dimaksud ya._` },
        { quoted: msg }
      ).catch(() => {})
      return true
    }
  }
  if (!s || s.status !== 'waiting') {
    await sock.sendMessage(
      chat,
      { text: `ℹ️ Sesi #${code || '?'} sudah tidak menunggu (sudah ditangani/ditutup).` },
      { quoted: msg }
    ).catch(() => {})
    return true
  }

  const senderNum = jidToNumber(sender)

  if (!accept) {
    patchSession(s.code, { status: 'closed', reason: 'rejected', closedAt: now() })
    await sock.sendMessage(s.buyerJid, {
      text: `🙏 Mohon maaf, stok *${s.productName}* sedang kosong.\nSilakan pilih produk lain lewat *menu* ya.`,
    }).catch(() => {})
    await notifyOtherAdmins(
      sock, chat, senderNum,
      `ℹ️ Sesi #${s.code} (*${s.productName}*) sudah ditangani — stok dinyatakan kosong.`
    )
    await sock.sendMessage(chat, { text: `✅ Sesi #${s.code} ditutup. Pembeli sudah diberi tahu stok kosong.` }, { quoted: msg }).catch(() => {})
    console.log(`[support] sesi #${s.code} DITOLAK oleh ${senderNum || sender}`)
    return true
  }

  patchSession(s.code, {
    status: 'active', adminJid: chat, adminNumber: senderNum || '', acceptedAt: now(),
  })
  await notifyOtherAdmins(
    sock, chat, senderNum,
    `ℹ️ Sesi #${s.code} (*${s.productName}*) sudah ditangani admin lain.`
  )
  await sock.sendMessage(s.buyerJid, {
    text:
      `✅ *Admin terhubung!*\n\n` +
      `🛍️ ${s.productName}\n` +
      `_Silakan chat di sini, pesanmu akan diteruskan ke admin._\n` +
      `_Ketik *akhiri* untuk menutup chat._`,
  }).catch(() => {})
  await sock.sendMessage(
    chat,
    {
      text:
        `✅ *Kamu terhubung dengan pembeli* [Sesi #${s.code}]\n\n` +
        `👤 ${s.buyerName || '-'} | 🛍️ ${s.productName}\n` +
        `_Balas chat ini — pesanmu diteruskan ke pembeli dengan label "diteruskan" (nomormu disembunyikan)._\n` +
        `_Ketik *akhiri* untuk menutup sesi._`,
    },
    { quoted: msg }
  ).catch(() => {})
  console.log(`[support] sesi #${s.code} DITERIMA oleh ${senderNum || sender}`)
  return true
}

// Sapu sesi waiting yang tak kunjung direspons admin
export function startSupportSweeper(getSock) {
  setInterval(async () => {
    const sock = getSock()
    if (!sock) return
    const t = Date.now()
    for (const s of waitingSessions()) {
      if (t - new Date(s.createdAt).getTime() > WAITING_TIMEOUT_MS) {
        patchSession(s.code, { status: 'closed', reason: 'timeout', closedAt: now() })
        console.log(`[support] sesi #${s.code} timeout`)
        await sock.sendMessage(s.buyerJid, {
          text:
            `⏰ _Permintaan *Tanyakan Stok* untuk *${s.productName}* kedaluwarsa karena admin belum merespons._\n` +
            `Silakan coba lagi nanti ya 🙏`,
        }).catch(() => {})
      }
    }
  }, 60_000)
  console.log('[support] sweeper sesi aktif')
}
