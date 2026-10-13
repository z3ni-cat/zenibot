// Plugin Jasa Generate Video AI.
// Perintah: genvideo — wizard: prompt -> gambar referensi (opsional) -> konfirmasi -> QRIS.
import fs from 'fs'
import path from 'path'
import { downloadMediaMessage } from '@whiskeysockets/baileys'
import {
  getAivideoSession, putAivideoSession, clearAivideoSession,
  AIVIDEO_PRICE, AIVIDEO_REF_DIR, makeAivideoOrderId,
} from '../src/aivideo.js'
import { paymentReady, createQrisInvoice } from '../src/payment.js'
import { addOrder, updateOrder } from '../src/orders.js'
import { formatRupiah, makeInvoiceCode, formatWib } from '../src/utils.js'
import { BOT_NAME } from '../src/brand.js'

export async function handleAivideoInput({ sock, chat, sender, msg, text, pushName, reply }) {
  const s = getAivideoSession(sender)
  if (!s) return false
  const t = (text || '').trim()

  if (t.toLowerCase() === 'batal') {
    clearAivideoSession(sender)
    await reply('❌ _Order video dibatalkan._')
    return true
  }

  // Langkah 1: prompt
  if (s.step === 'prompt') {
    if (!t || t.length < 5) {
      await reply('📝 _Prompt terlalu pendek. Tulis deskripsi video yang diinginkan (min. 5 karakter), atau ketik *batal*._')
      return true
    }
    putAivideoSession(sender, { step: 'image', prompt: t })
    await reply(
      `🖼️ *Gambar referensi (opsional)*\n\n` +
      `Kirim 1 gambar sebagai acuan gaya/karakter video, atau ketik *skip* jika tidak pakai.\n\n` +
      `_Ketik *batal* untuk membatalkan._`
    )
    return true
  }

  // Langkah 2: gambar referensi
  if (s.step === 'image') {
    let refPath = null
    const hasImage = !!msg.message?.imageMessage
    if (hasImage) {
      try {
        const buf = await downloadMediaMessage(msg, 'buffer', {})
        fs.mkdirSync(AIVIDEO_REF_DIR, { recursive: true })
        refPath = path.join(AIVIDEO_REF_DIR, `${sender.replace(/[^0-9]/g, '')}.jpg`)
        fs.writeFileSync(refPath, buf)
      } catch (e) {
        console.error('[aivideo] gagal unduh referensi:', e.message)
        await reply('⚠️ _Gagal mengunduh gambar. Coba kirim ulang, ketik *skip*, atau *batal*._')
        return true
      }
    } else if (t.toLowerCase() !== 'skip') {
      await reply('🖼️ _Kirim 1 gambar, ketik *skip* jika tidak pakai, atau *batal*._')
      return true
    }
    putAivideoSession(sender, { step: 'confirm', prompt: s.prompt, refPath })
    await reply(
      `📋 *Konfirmasi order*\n\n` +
      `🎬 Prompt: ${s.prompt}\n` +
      `🖼️ Referensi: ${refPath ? 'ada ✅' : 'tidak ada'}\n` +
      `⏱️ Durasi: ±10 detik\n` +
      `💵 Harga: ${formatRupiah(AIVIDEO_PRICE)}\n\n` +
      `Ketik *bayar* untuk lanjut ke pembayaran, atau *batal*.`
    )
    return true
  }

  // Langkah 3: konfirmasi -> QRIS
  if (s.step === 'confirm') {
    if (t.toLowerCase() !== 'bayar') {
      await reply(`_Ketik *bayar* untuk lanjut, atau *batal*._`)
      return true
    }
    if (!paymentReady()) {
      clearAivideoSession(sender)
      await reply('❌ _Pembayaran QRIS belum aktif. Hubungi admin ya 🙏_')
      return true
    }
    await reply('⏳ _Membuat QRIS, sebentar ya..._')
    let inv
    try {
      inv = await createQrisInvoice({
        amount: AIVIDEO_PRICE,
        description: BOT_NAME + ' - Jasa Video AI',
        customerName: pushName || 'Pembeli',
      })
    } catch (e) {
      console.error('[aivideo] gagal buat invoice:', e.message)
      await reply('❌ Gagal membuat QRIS. Coba lagi sebentar atau hubungi admin 🙏')
      return true
    }
    if (!inv.qrisString) {
      await reply('❌ QRIS tidak tersedia saat ini. Hubungi admin ya 🙏')
      return true
    }
    const orderId = makeAivideoOrderId()
    const invoiceCode = makeInvoiceCode()
    addOrder({
      invoiceId: inv.id,
      invoiceNumber: inv.invoiceNumber,
      invoiceCode,
      productId: 'aivideo',
      productName: 'Jasa Video AI (±10 detik)',
      buyerJid: chat,
      amount: inv.amount,
      status: 'pending',
      createdAt: new Date().toISOString(),
      expiredAt: inv.expiredAt,
      aivideo: { orderId, prompt: s.prompt, refPath: s.refPath },
    })
    clearAivideoSession(sender)
    console.log(`[aivideo] invoice ${inv.invoiceNumber} (${orderId}) dibuat`)

    const { default: QRCode } = await import('qrcode')
    const qrBuf = await QRCode.toBuffer(inv.qrisString, { width: 512, margin: 2 })
    const expWib = inv.expiredAt ? formatWib(new Date(inv.expiredAt)) : ''
    const qrMsg = await sock.sendMessage(chat, {
      image: qrBuf,
      caption:
        `🎬 *Jasa Video AI*\n` +
        `Nominal bayar : ${formatRupiah(inv.amount)}\n` +
        `Kode Invoice: ${invoiceCode}\n` +
        (expWib ? `Waktu Pembayaran: ${expWib}\n` : '') +
        `\n_Scan QR di atas dengan e-wallet / m-banking apa pun._\n` +
        `_Video dibuat otomatis setelah pembayaran terdeteksi ✅_\n` +
        `_Estimasi pengerjaan 10–20 menit._`,
    }, { quoted: msg })
    if (qrMsg?.key) updateOrder(inv.id, { qrKey: qrMsg.key })
    return true
  }

  return false
}

export default {
  name: 'genvideo',
  alias: ['aivideo', 'videoai'],
  description: 'Jasa generate video AI dari prompt + gambar referensi',
  async run(ctx) {
    const { sender, reply } = ctx
    putAivideoSession(sender, { step: 'prompt' })
    await reply(
      `🎬 *Jasa Generate Video AI*\n\n` +
      `Buat video ±10 detik dari deskripsimu! Harga ${formatRupiah(AIVIDEO_PRICE)}/video.\n\n` +
      `📝 *Langkah 1/3:* tulis prompt / deskripsi video yang diinginkan.\n` +
      `Contoh: "kucing oranye gembul melompat mengejar kupu-kupu di padang bunga"\n\n` +
      `_Ketik *batal* kapan saja untuk membatalkan._`
    )
  },
}
