// Tombol "❓ Tanyakan Stok" di detail produk (muncul saat stok habis).
// Membuat sesi support: notifikasi ke semua admin, admin pertama yang
// balas Terima/Tolak memenangkan sesi.
import { loadProducts } from '../src/products.js'
import { jidToNumber } from '../src/utils.js'
import {
  SUPPORT_ADMINS, adminJid, createSession, buyerSession,
} from '../src/support.js'

export default {
  name: 'ask',
  description: 'Tanyakan stok ke admin',
  async run(ctx) {
    const { sock, chat, sender, pushName, args, reply } = ctx
    if (chat.endsWith('@g.us')) {
      return reply('❌ _Fitur ini hanya bisa dipakai di chat pribadi._')
    }

    const p = loadProducts().find((x) => x.id === args[0])
    if (!p) return reply('❌ Produk tidak ditemukan.')

    const existing = buyerSession(chat)
    if (existing) {
      return reply(
        `📩 _Kamu sudah punya sesi ${existing.status === 'active' ? 'chat aktif' : 'menunggu admin'} untuk *${existing.productName}*._\n` +
        `Ketik *akhiri* untuk menutupnya.`
      )
    }

    const isLid = sender.endsWith('@lid')
    const s = createSession({
      buyerJid: chat,
      buyerNumber: isLid ? '' : jidToNumber(sender),
      buyerName: pushName,
      productId: p.id,
      productName: p.name,
    })

    const notice =
      `*Hallo Admin, Ada Pesan* 📩\n` +
      `[Sesi #${s.code}]\n\n` +
      `Kamu diminta terhubung dengan pembeli:\n\n` +
      `👤 Nama: ${pushName}\n` +
      `📞 Nomor: ${s.buyerNumber || 'disembunyikan'}\n` +
      `🛍️ Produk: ${p.name}\n` +
      `💬 _"${p.name}, apakah kosong?"_\n\n` +
      `Silakan *balas pesan ini* dengan:\n` +
      `*Terima* = terhubung dengan pembeli (nomormu disembunyikan)\n` +
      `*Tolak* = kirim "stok kosong" ke pembeli`

    for (const num of SUPPORT_ADMINS) {
      await sock.sendMessage(adminJid(num), { text: notice }).catch((e) =>
        console.error(`[support] gagal kirim notif ke ${num}:`, e.message)
      )
    }
    console.log(`[support] sesi #${s.code} dibuat: ${p.name} <- ${chat}`)

    return reply(
      `📩 *Permintaan terkirim ke admin.*\n\n` +
      `🛍️ ${p.name}\n` +
      `Tunggu sebentar ya, admin akan segera merespons 🙏\n` +
      `_Ketik *akhiri* untuk membatalkan._`
    )
  },
}
