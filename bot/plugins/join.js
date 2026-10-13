// join — bot gabung grup via link invite. KHUSUS owner.
import { isAdmin } from './produk.js'

export default {
  name: 'join',
  ownerOnly: true,
  description: 'Bot gabung grup via link invite (khusus owner)',
  async run({ sock, msg, sender, senderNumber, config, reply, args, text }) {
    if (!isAdmin(config, sender, senderNumber)) {
      return reply('❌ _Perintah ini khusus owner._')
    }
    const link = (args[0] || text || '').trim()
    const m = link.match(/chat\.whatsapp\.com\/([A-Za-z0-9]+)/)
    if (!m) {
      return reply('🔗 _Kirim link invite grup WhatsApp._\nContoh: *join https://chat.whatsapp.com/xxxx*')
    }
    await reply('⏳ _Mencoba gabung grup…_')
    try {
      const gid = await sock.groupAcceptInvite(m[1])
      const meta = await sock.groupMetadata(gid).catch(() => null)
      return reply(`✅ _Berhasil gabung grup${meta ? ' *' + meta.subject + '*' : ''}!_`)
    } catch (e) {
      console.error('[join]', e.message || e)
      return reply('❌ _Gagal gabung grup. Pastikan link invite valid dan belum kedaluwarsa._')
    }
  },
}
