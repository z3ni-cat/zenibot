// Watcher pembayaran: cek status invoice pending tiap 30 detik.
// - paid    -> ambil stok terdepan, kirim akun + rules ke pembeli
// - expired -> beri tahu pembeli, order ditutup
// - pending terlalu lama (>75 mnt) -> anggap kedaluwarsa
import { pendingOrders, updateOrder } from './orders.js'
import { getInvoiceStatus, paymentReady } from './payment.js'
import { takeStock, loadRules, buildDeliveryMessage } from './stock.js'
import { loadProducts, saveProducts } from './products.js'
import { makeInvoiceCode, formatWib, jidToNumber } from './utils.js'
import { createProviderOrder } from './smm.js'
import { adminJid, createSession, SUPPORT_ADMINS } from './support.js'
import { sendButtons } from './buttons.js'

const POLL_MS = 30_000
const LOCAL_TIMEOUT_MS = 75 * 60_000 // 75 menit
const INVOICE_DURATION = '28 Hari'

export function startOrderWatcher(getSock) {
  if (!paymentReady()) {
    console.log('[order] SAYABAYAR_API_KEY belum diisi — watcher tidak dijalankan')
    return
  }
  console.log('[order] watcher pembayaran aktif (cek tiap 30 detik)')
  setInterval(async () => {
    const sock = getSock()
    if (!sock) return
    for (const o of pendingOrders()) {
      try {
        await checkOne(sock, o)
      } catch (e) {
        console.error(`[order] gagal cek ${o.invoiceNumber || o.invoiceId}:`, e.message)
      }
    }
  }, POLL_MS)
}

async function checkOne(sock, o) {
  const ageMs = Date.now() - new Date(o.createdAt).getTime()

  let status = 'pending'
  try {
    status = await getInvoiceStatus(o.invoiceId)
  } catch (e) {
    console.error(`[order] status ${o.invoiceNumber}:`, e.message)
    return // coba lagi di siklus berikutnya
  }

  if (status === 'paid' || status === 'user_confirmed') {
    return deliver(sock, o)
  }
  if (status === 'expired' || ageMs > LOCAL_TIMEOUT_MS) {
    updateOrder(o.invoiceId, { status: 'expired', closedAt: new Date().toISOString() })
    console.log(`[order] ${o.invoiceNumber} kedaluwarsa`)
    await sock.sendMessage(o.buyerJid, {
      text:
        `⏰ *Waktu pembayaran habis*\n\n` +
        `🛍️ ${o.productName}\n` +
        `_QRIS sudah kedaluwarsa dan tidak bisa dipakai lagi._\n` +
        `Ketuk *Beli Sekarang* untuk membuat QR baru ya 🙏`,
    }).catch(() => {})
  }
  // pending -> tunggu siklus berikutnya
}

// Teruskan order SMM yang sudah lunas ke provider djuragansosmed.
async function deliverSmmOrder(sock, o, { paidAt, invoiceCode, invoiceSection }) {
  const sm = o.smm
  try {
    const res = await createProviderOrder(sm.serviceId, sm.link, sm.quantity)
    const providerOrder = String(res.order ?? res.id ?? JSON.stringify(res))
    updateOrder(o.invoiceId, { providerOrder })
    console.log(`[order] ${o.invoiceNumber} SMM diteruskan — provider order ${providerOrder}`)
    return (
      `✅*Pembayaran Berhasil*\n\n` +
      `📣 *Pesanan SMM diproses*\n` +
      `Layanan: ${sm.serviceName}\n` +
      `Jumlah: ${Number(sm.quantity).toLocaleString('id-ID')}\n` +
      `Order provider: ${providerOrder}\n` +
      `Status awal: Pending / In progress\n\n` +
      `_Cek status berkala dengan:_\n` +
      `\`cekorder ${providerOrder}\`` +
      invoiceSection
    )
  } catch (e) {
    console.error('[order] SMM provider gagal:', e.message)
    updateOrder(o.invoiceId, { providerError: e.message })
    const adm = adminJid()
    if (adm) {
      await sock.sendMessage(adm, {
        text: `⚠️ *Order SMM gagal diteruskan ke provider*\n\nInvoice: ${o.invoiceNumber} (${invoiceCode})\nLayanan: ${sm.serviceName}\nLink: ${sm.link}\nJumlah: ${sm.quantity}\nError: ${e.message}\n\nTeruskan manual / refund pembeli.`,
      }).catch(() => {})
    }
    return (
      `✅*Pembayaran Berhasil*\n\n` +
      `⚠️ _Mohon maaf, pesanan SMM-mu belum berhasil diteruskan ke provider._\n` +
      `Admin sudah diberi tahu dan akan segera menindaklanjuti (proses manual / refund) 🙏` +
      invoiceSection
    )
  }
}

async function deliver(sock, o) {
  const paidAt = new Date().toISOString()
  // Order lama (sebelum fitur ini) belum punya kode — buatkan sekarang.
  const invoiceCode = o.invoiceCode || makeInvoiceCode()
  updateOrder(o.invoiceId, { status: 'paid', paidAt, invoiceCode })
  console.log(`[order] ${o.invoiceNumber} LUNAS — kirim stok ke ${o.buyerJid}`)

  // Tarik (unsend) pesan QRIS agar tidak dipakai ulang & chat tetap rapi
  if (o.qrKey) {
    await sock.sendMessage(o.buyerJid, { delete: o.qrKey }).catch(() => {})
  }

  const invoiceSection =
    `\n\n━━━━━━━━━━━━\n` +
    `🧾 *INVOICE*\n` +
    `Tanggal Pembelian: ${formatWib(new Date(paidAt))}\n` +
    `Durasi: ${INVOICE_DURATION}\n` +
    `Kode Invoice: ${invoiceCode}`

  // Order SMM -> teruskan ke provider, bukan kirim stok
  if (o.smm) {
    const smmText = await deliverSmmOrder(sock, o, { paidAt, invoiceCode, invoiceSection })
    if (smmText) { await sock.sendMessage(o.buyerJid, { text: smmText }).catch(() => {}) }
    return
  }

  // Order Video AI -> masuk antrean generate, bukan kirim stok
  if (o.aivideo) {
    const { saveAivideoOrder } = await import('./aivideo.js')
    saveAivideoOrder({
      orderId: o.aivideo.orderId,
      prompt: o.aivideo.prompt,
      refPath: o.aivideo.refPath,
      buyerJid: o.buyerJid,
      invoiceNumber: o.invoiceNumber,
      amount: o.amount,
    })
    console.log(`[order] ${o.invoiceNumber} LUNAS - video ${o.aivideo.orderId} masuk antrean`)
    await sock.sendMessage(o.buyerJid, {
      text:
        `*Pembayaran Berhasil*

` +
        `Video AI kamu masuk antrean produksi.
` +
        `Prompt: ${o.aivideo.prompt}

` +
        `_Estimasi 10-20 menit. Video akan dikirim otomatis ke chat ini ya._` +
        invoiceSection,
    }).catch(() => {})
    return
  }

  const entry = takeStock(o.productId)
  if (!entry) {
    // Tidak ada akun di antrean -> pakai angka stok manual (dari wizard), kurangi 1
    try {
      const list = loadProducts()
      const prod = list.find((x) => x.id === o.productId)
      if (prod && (prod.stock || 0) > 0) { prod.stock--; saveProducts(list) }
    } catch {}
  }
  const rules = loadRules(o.productId)

  let text
  if (entry) {
    text = buildDeliveryMessage(entry, rules) + invoiceSection
  } else {
    // Stok habis duluan (dibeli orang lain lebih dulu) — jangan diam saja.
    text =
      `✅*Pembayaran Berhasil*\n\n` +
      `⚠️ _Mohon maaf, stok produk ini baru saja habis._\n` +
      `Admin akan segera menghubungimu untuk pengiriman manual / refund 🙏` +
      invoiceSection
  }
  await sock.sendMessage(o.buyerJid, { text }).catch(() => {})
  // Stok kosong: buat sesi support + notifikasi admin dengan tombol Hubungi
  if (!entry) {
    try {
      const s = createSession({
        buyerJid: o.buyerJid,
        buyerNumber: jidToNumber(o.buyerJid),
        buyerName: o.buyerName || '',
        productId: o.productId,
        productName: o.productName,
      })
      const notif =
        `⚠️ *Stok Habis — Perlu Tindakan* [Sesi #${s.code}]\n\n` +
        `Pembeli sudah bayar tapi stok kosong:\n\n` +
        `🛍️ Produk: ${o.productName}\n` +
        `🧾 Invoice: ${invoiceCode}\n` +
        `👤 Pembeli: ${o.buyerName || '-'} (${jidToNumber(o.buyerJid)})\n\n` +
        `Tap tombol di bawah untuk terhubung dengan pembeli.`;
      for (const num of SUPPORT_ADMINS) {
        await sendButtons(sock, adminJid(num), {
          body: notif,
          buttons: [{ id: `ui:hubungi:${s.code}`, text: '📞 Hubungi Customer' }],
        }).catch((e) => console.error(`[order] gagal notif admin ${num}:`, e.message))
      }
      console.log(`[order] sesi support #${s.code} dibuat untuk stok kosong: ${o.productName}`)
    } catch (e) {
      console.error('[order] gagal buat sesi support stok kosong:', e.message)
    }
  }
}
