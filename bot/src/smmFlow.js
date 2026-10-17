// Browser menu SMM + wizard order (link -> jumlah -> konfirmasi -> QRIS).
// Dipakai oleh plugin/smm.js dan di-hook dari menu.js (kategori smm-panel).
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'
import {
  SMM_GROUPS, SMM_GROUP_EMOJI, readCatalog, getService, quote, smmConfigured,
} from './smm.js'
import { sendButtons, sendList } from './buttons.js'
import { getDevice, setNav } from './deviceMode.js'
import { formatRupiah, makeInvoiceCode, formatWib } from './utils.js'
import { paymentReady, createQrisInvoice } from './payment.js'
import { addOrder, updateOrder } from './orders.js'
import { BOT_NAME } from './brand.js'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const SESSION_FILE = path.join(__dirname, '..', 'data', 'smm_order.json')
const SESSION_TTL = 15 * 60_000 // 15 menit

// ---------- sesi wizard ----------
function readSessions() {
  try { return JSON.parse(fs.readFileSync(SESSION_FILE, 'utf8')) } catch { return {} }
}
function saveSessions(s) {
  fs.writeFileSync(SESSION_FILE, JSON.stringify(s, null, 2))
}
export function getSmmSession(sender) {
  const all = readSessions()
  const s = all[sender]
  if (!s) return null
  if (Date.now() - s.updatedAt > SESSION_TTL) {
    delete all[sender]; saveSessions(all); return null
  }
  return s
}
function putSmmSession(sender, s) {
  const all = readSessions()
  all[sender] = { ...s, updatedAt: Date.now() }
  saveSessions(all)
}
function clearSmmSession(sender) {
  const all = readSessions()
  delete all[sender]; saveSessions(all)
}

// ---------- browser ----------
function groupCount(g) {
  return (readCatalog().groups[g] || []).length
}

export async function startSmmFlow(ctx) {
  const { sock, chat, msg, sender, config } = ctx
  if (getDevice(sender) === 'iphone') return sendTextSmmHome(ctx)
  if (!smmConfigured()) {
    await sock.sendMessage(chat, { text: '❌ _Layanan SMM belum aktif. Hubungi admin ya 🙏_' }, { quoted: msg })
    return
  }
  const catalog = readCatalog()
  const total = SMM_GROUPS.reduce((n, g) => n + (catalog.groups[g] || []).length, 0)
  if (!total) {
    await sock.sendMessage(chat, { text: '👥 *Layanan SMM*\n\n_Katalog belum tersedia. Coba lagi nanti ya 🙏_' }, { quoted: msg })
    return
  }
  const body =
    `👥 *Layanan SMM*\n\n` +
    `Tambah followers, likes, views & lainnya — proses otomatis setelah pembayaran ✅\n\n` +
    `_Pilih platform:_`
  await sendList(sock, chat, {
    body,
    footer: config.name,
    buttonTitle: '📋 Pilih Platform',
    sections: [{
      title: 'Platform',
      rows: SMM_GROUPS.map((g) => ({
        title: `${SMM_GROUP_EMOJI[g]} ${g}`,
        description: `${groupCount(g)} layanan tersedia`,
        id: `ui:smm:cat:${g}`,
      })),
    }],
    quickButtons: [{ id: 'ui:menu', text: '🏠 Menu Utama' }],
  }, { quoted: msg })
}

function sendTextSmmHome(ctx) {
  const { sock, chat, msg, sender } = ctx
  setNav(sender, { page: 'smmhome' })
  const lines = SMM_GROUPS.map((g, i) => `${i + 1}. ${SMM_GROUP_EMOJI[g]} ${g} (${groupCount(g)} layanan)`)
  const body =
    `👥 *Layanan SMM*\n\n` +
    `Tambah followers, likes, views & lainnya — proses otomatis setelah pembayaran ✅\n\n` +
    lines.join('\n') +
    `\n\n0. Kembali\n_Balas dengan nomor._`
  return sock.sendMessage(chat, { text: body }, { quoted: msg })
}

export async function sendSmmGroup(ctx, group) {
  const { sock, chat, msg, sender, config } = ctx
  if (!SMM_GROUPS.includes(group)) return startSmmFlow(ctx)
  const list = readCatalog().groups[group] || []
  if (getDevice(sender) === 'iphone') return sendTextSmmGroup(ctx, group, list)
  const body =
    `${SMM_GROUP_EMOJI[group]} *${group}*\n\n` +
    (list.length ? '_Pilih layanan:_' : '_Belum ada layanan di platform ini._')
  await sendList(sock, chat, {
    body,
    footer: config.name,
    buttonTitle: '📋 Pilih Layanan',
    sections: [{
      title: `Layanan ${group}`,
      rows: list.map((s) => ({
        title: s.name.length > 38 ? s.name.slice(0, 37) + '…' : s.name,
        description: `Mulai ${formatRupiah(s.priceMin)} • Min ${s.min}`,
        id: `ui:smm:svc:${s.id}`,
      })),
    }],
    quickButtons: [{ id: 'ui:smm', text: '◀ Platform' }, { id: 'ui:menu', text: '🏠 Menu' }],
  }, { quoted: msg })
}

function sendTextSmmGroup(ctx, group, list) {
  const { sock, chat, msg, sender } = ctx
  setNav(sender, { page: 'smmgroup', group })
  const body =
    `${SMM_GROUP_EMOJI[group]} *${group}*\n\n` +
    (list.length
      ? list.map((s, i) => `${i + 1}. ${s.name} — mulai ${formatRupiah(s.priceMin)}`).join('\n')
      : '_Belum ada layanan._') +
    `\n\n0. Kembali\n_Balas dengan nomor._`
  return sock.sendMessage(chat, { text: body }, { quoted: msg })
}

export async function sendSmmDetail(ctx, id) {
  const { sock, chat, msg, sender, config } = ctx
  const s = getService(id)
  if (!s) {
    await sock.sendMessage(chat, { text: '❌ Layanan tidak ditemukan.' }, { quoted: msg })
    return
  }
  if (getDevice(sender) === 'iphone') return sendTextSmmDetail(ctx, s)
  const body =
    `${SMM_GROUP_EMOJI[s.group]} *${s.name}*\n\n` +
    `💵 Mulai : ${formatRupiah(s.priceMin)}\n` +
    `📦 Min : ${s.min.toLocaleString('id-ID')} • Max : ${s.max.toLocaleString('id-ID')}\n` +
    `${s.refill ? '♻️ Refill tersedia' : '🚫 Tanpa refill'}\n\n` +
    `_Ketuk 🛒 Pesan untuk lanjut._`
  await sendButtons(sock, chat, {
    body,
    footer: config.name,
    buttons: [
      { id: `ui:smm:buy:${s.id}`, text: '🛒 Pesan' },
      { id: `ui:smm:cat:${s.group}`, text: '◀ Kembali' },
    ],
  }, { quoted: msg })
}

function sendTextSmmDetail(ctx, s) {
  const { sock, chat, msg, sender } = ctx
  setNav(sender, { page: 'smmsvc', id: s.id, group: s.group })
  const body =
    `${SMM_GROUP_EMOJI[s.group]} *${s.name}*\n\n` +
    `💵 Mulai : ${formatRupiah(s.priceMin)}\n` +
    `📦 Min : ${s.min.toLocaleString('id-ID')} • Max : ${s.max.toLocaleString('id-ID')}\n` +
    `${s.refill ? '♻️ Refill tersedia' : '🚫 Tanpa refill'}\n\n` +
    `1. 🛒 Pesan\n` +
    `2. Kembali\n` +
    `0. Menu Utama\n_Balas dengan nomor._`
  return sock.sendMessage(chat, { text: body }, { quoted: msg })
}

// ---------- wizard order ----------
export async function startSmmOrder(ctx, id) {
  const { sock, chat, msg, sender } = ctx
  const s = getService(id)
  if (!s) {
    await sock.sendMessage(chat, { text: '❌ Layanan tidak ditemukan.' }, { quoted: msg })
    return
  }
  if (!paymentReady()) {
    await sock.sendMessage(chat, { text: '❌ _Pembayaran QRIS belum aktif. Hubungi admin ya 🙏_' }, { quoted: msg })
    return
  }
  putSmmSession(sender, { step: 'link', serviceId: s.id })
  await sock.sendMessage(chat, {
    text:
      `🛒 *Pesan: ${s.name}*\n\n` +
      `🔗 Kirim *link target* (contoh: link postingan TikTok / profil Instagram).\n\n` +
      `_Ketik *batal* untuk membatalkan._`,
  }, { quoted: msg })
}

export async function handleSmmInput({ sock, chat, sender, msg, text, pushName, reply }) {
  const s = getSmmSession(sender)
  if (!s) return false
  const t = String(text || '').trim()
  const service = getService(s.serviceId)
  if (!service) { clearSmmSession(sender); await reply('❌ Layanan tidak valid, pesanan dibatalkan.'); return true }

  if (/^batal$/i.test(t) || t === 'ui:smm:cancel') {
    clearSmmSession(sender)
    await reply('❌ Pesanan SMM dibatalkan.')
    return true
  }

  if (s.step === 'link') {
    if (t.length < 6 || !t.includes('.')) {
      await reply('❌ Link tidak valid. Kirim link target yang benar, atau ketik *batal*.')
      return true
    }
    putSmmSession(sender, { ...s, step: 'qty', link: t })
    await reply(
      `🔗 Link: ${t}\n\n` +
      `🔢 Kirim *jumlah* yang diinginkan.\n` +
      `Min: ${service.min.toLocaleString('id-ID')} • Max: ${service.max.toLocaleString('id-ID')}\n\n` +
      `_Ketik *batal* untuk membatalkan._`
    )
    return true
  }

  if (s.step === 'qty') {
    const q = quote(service, t.replace(/[^0-9]/g, ''))
    if (!q) {
      await reply(`❌ Jumlah harus angka antara ${service.min.toLocaleString('id-ID')}–${service.max.toLocaleString('id-ID')}. Coba lagi atau ketik *batal*.`)
      return true
    }
    putSmmSession(sender, { ...s, step: 'confirm', qty: q.quantity, amount: q.amount })
    await sendButtons(sock, chat, {
      body:
        `📝 *Konfirmasi Pesanan*\n\n` +
        `Layanan : ${service.name}\n` +
        `Link : ${s.link}\n` +
        `Jumlah : ${q.quantity.toLocaleString('id-ID')}\n` +
        `💵 Total : ${formatRupiah(q.amount)}\n\n` +
        `_Lanjut ke pembayaran?_\n_Ketik *batal* untuk membatalkan._`,
      footer: BOT_NAME,
      buttons: [
        { id: 'ui:smm:confirm', text: '✅ Bayar' },
        { id: 'ui:smm:cancel', text: '❌ Batal' },
      ],
    }, { quoted: msg })
    return true
  }

  if (s.step === 'confirm') {
    if (t !== 'ui:smm:confirm' && !/^bayar$/i.test(t)) return true
    const q = quote(service, s.qty)
    if (!q) { clearSmmSession(sender); await reply('❌ Data pesanan tidak valid.'); return true }
    await reply('⏳ _Membuat QRIS, sebentar ya..._')
    let inv
    try {
      inv = await createQrisInvoice({
        amount: q.amount,
        description: `${BOT_NAME} SMM - ${service.name}`,
        customerName: pushName || 'Pembeli',
      })
    } catch (e) {
      console.error('[smm] gagal buat invoice:', e.message)
      await reply('❌ Gagal membuat QRIS. Coba lagi sebentar atau hubungi admin 🙏')
      return true
    }
    if (!inv.qrisString) {
      await reply('❌ QRIS tidak tersedia saat ini. Hubungi admin ya 🙏')
      return true
    }
    const invoiceCode = makeInvoiceCode()
    addOrder({
      invoiceId: inv.id,
      invoiceNumber: inv.invoiceNumber,
      invoiceCode,
      productId: service.id,
      productName: `SMM: ${service.name}`,
      buyerJid: chat,
      amount: inv.amount,
      status: 'pending',
      createdAt: new Date().toISOString(),
      expiredAt: inv.expiredAt,
      smm: {
        serviceId: service.providerService,
        serviceName: service.name,
        link: s.link,
        quantity: q.quantity,
      },
    })
    console.log(`[smm] invoice ${inv.invoiceNumber} (${invoiceCode}) dibuat utk ${service.id} (${formatRupiah(inv.amount)})`)
    clearSmmSession(sender)

    const { default: QRCode } = await import('qrcode')
    const qrBuf = await QRCode.toBuffer(inv.qrisString, { width: 512, margin: 2 })
    const expWib = inv.expiredAt ? formatWib(new Date(inv.expiredAt)) : ''
    const qrMsg = await sock.sendMessage(chat, {
      image: qrBuf,
      caption:
        `Nominal bayar : ${formatRupiah(inv.amount)}\n` +
        `Kode Invoice: ${invoiceCode}\n` +
        `Layanan: ${service.name}\n` +
        `Jumlah: ${q.quantity.toLocaleString('id-ID')}\n` +
        (expWib ? `Waktu Pembayaran: ${expWib}\n` : '') +
        `\n_Scan QR di atas dengan e-wallet / m-banking apa pun._\n` +
        `_Pesanan diteruskan otomatis ke provider setelah pembayaran ✅_`,
    }, { quoted: msg })
    if (qrMsg?.key) updateOrder(inv.id, { qrKey: qrMsg.key })
    return true
  }

  return true
}
