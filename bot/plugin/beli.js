// Alur pembelian — tombol "🛒 Beli Sekarang" di detail produk.
//
// Harga diambil dari DESKRIPSI produk (format "Rp40.000").
// Ketuk tombol -> buat invoice QRIS via sayabayar -> kirim QR ke pembeli.
// orderWatcher mem-poll status tiap 30 detik; saat lunas, stok terdepan
// dikirim otomatis ke pembeli.
import { loadProducts, getProductPrice, effectiveStock } from '../src/products.js'
import { stockCount } from '../src/stock.js'
import { formatRupiah, makeInvoiceCode, formatWib } from '../src/utils.js'
import { paymentReady, createQrisInvoice } from '../src/payment.js'
import { addOrder, updateOrder } from '../src/orders.js'
import { BOT_NAME } from '../src/brand.js'

export default {
  name: 'beli',
  alias: ['buy'],
  description: 'Beli produk',
  async run(ctx) {
    const { sock, msg, chat, args, reply, pushName } = ctx
    const p = loadProducts().find((x) => x.id === args[0])
    if (!p) return reply('❌ Produk tidak ditemukan.')

    const price = getProductPrice(p)
    if (!price) {
      return reply('❌ Harga produk ini belum diatur di deskripsi. Hubungi admin ya 🙏')
    }
    if (effectiveStock(p, stockCount(p.id)) < 1) {
      return reply(`❌ Stok *${p.name}* sedang habis. Hubungi admin ya 🙏`)
    }
    if (!paymentReady()) {
      return reply('❌ _Pembayaran QRIS belum aktif. Hubungi admin ya 🙏_')
    }

    await reply('⏳ _Membuat QRIS, sebentar ya..._')

    let inv
    try {
      inv = await createQrisInvoice({
        amount: price,
        description: `${BOT_NAME} - ${p.name}`,
        customerName: pushName || 'Pembeli',
      })
    } catch (e) {
      console.error('[beli] gagal buat invoice:', e.message)
      return reply('❌ Gagal membuat QRIS. Coba lagi sebentar atau hubungi admin 🙏')
    }
    if (!inv.qrisString) {
      console.error('[beli] invoice tanpa qris_string:', inv.invoiceNumber)
      return reply('❌ QRIS tidak tersedia saat ini. Hubungi admin ya 🙏')
    }

    const invoiceCode = makeInvoiceCode()
    addOrder({
      invoiceId: inv.id,
      invoiceNumber: inv.invoiceNumber,
      invoiceCode,
      productId: p.id,
      productName: p.name,
      buyerJid: chat,
      amount: inv.amount,
      status: 'pending',
      createdAt: new Date().toISOString(),
      expiredAt: inv.expiredAt,
    })
    console.log(`[beli] invoice ${inv.invoiceNumber} (${invoiceCode}) dibuat utk ${p.name} (${formatRupiah(inv.amount)})`)

    // Render QR dari qris_string sayabayar
    const { default: QRCode } = await import('qrcode')
    const qrBuf = await QRCode.toBuffer(inv.qrisString, { width: 512, margin: 2 })

    const expWib = inv.expiredAt ? formatWib(new Date(inv.expiredAt)) : ''

    const qrMsg = await sock.sendMessage(
      chat,
      {
        image: qrBuf,
        caption:
          `Nominal bayar : ${formatRupiah(inv.amount)}\n` +
          `Kode Invoice: ${invoiceCode}\n` +
          (expWib ? `Waktu Pembayaran: ${expWib}\n` : '') +
          `\n_Scan QR di atas dengan e-wallet / m-banking apa pun._\n` +
          `_Akun dikirim otomatis setelah pembayaran terdeteksi ✅_`,
      },
      { quoted: msg }
    )
    // Simpan key pesan QR agar bisa ditarik (unsend) setelah pembayaran lunas
    if (qrMsg?.key) updateOrder(inv.id, { qrKey: qrMsg.key })
  },
}
