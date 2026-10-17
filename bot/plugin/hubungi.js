// Plugin Hubungi Customer — admin tap tombol untuk terhubung ke pembeli (stok kosong)
import { getSession, patchSession, activeSessionForAdmin } from '../src/support.js'
import { jidToNumber } from '../src/utils.js'

const now = () => new Date().toISOString()

async function notifyOtherAdmins(sock, skipChat, skipNumber, text) {
  const { SUPPORT_ADMINS, adminJid } = await import('../src/support.js')
  for (const num of SUPPORT_ADMINS) {
    const jid = adminJid(num)
    if (jid === skipChat || num === skipNumber) continue
    await sock.sendMessage(jid, { text }).catch(() => {})
  }
}

export default {
  name: 'hubungi',
  description: 'Admin terhubung ke pembeli via tombol',
  async run(ctx) {
    const { sock, chat, sender, msg, args, reply } = ctx
    const code = (args[0] || '').toUpperCase()
    if (!code) return reply('❌ _Kode sesi tidak valid._')

    const s = getSession(code)
    if (!s || s.status !== 'waiting') {
      return reply(`ℹ️ Sesi #${code} sudah tidak menunggu (sudah ditangani/ditutup).`)
    }

    const senderNum = jidToNumber(sender)
    patchSession(s.code, {
      status: 'active', adminJid: chat, adminNumber: senderNum || '', acceptedAt: now(),
    })
    await notifyOtherAdmins(
      sock, chat, senderNum,
      `ℹ️ Sesi #${s.code} (*${s.productName}*) sudah ditangani admin lain.`
    )
    await sock.sendMessage(s.buyerJid, {
      text:
        '✅ *Admin terhubung!*\n\n' +
        `🛍️ ${s.productName}\n` +
        '_Silakan chat di sini, pesanmu akan diteruskan ke admin._\n' +
        '_Ketik *akhiri* untuk menutup chat._',
    }).catch(() => {})
    await reply(
      `✅ *Kamu terhubung dengan pembeli* [Sesi #${s.code}]\n\n` +
      `👤 ${s.buyerName || '-'} | 🛍️ ${s.productName}\n` +
      `🧾 Invoice terkait: pembayaran sukses tapi stok kosong.\n` +
      '_Balas chat ini — pesanmu diteruskan ke pembeli (nomormu disembunyikan)._\n' +
      '_Ketik *akhiri* untuk menutup sesi._'
    )
    console.log(`[support] sesi #${s.code} dihubungi via tombol oleh ${senderNum || sender}`)
  },
}
