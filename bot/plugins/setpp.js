// setpp — ganti foto profil bot. Kirim FOTO dengan caption "setpp". KHUSUS owner.
import { downloadMediaMessage } from '@whiskeysockets/baileys'
import { isAdmin } from './produk.js'

export default {
  name: 'setpp',
  ownerOnly: true,
  description: 'Ganti foto profil bot (khusus owner)',
  async run({ sock, msg, sender, senderNumber, config, reply }) {
    if (!isAdmin(config, sender, senderNumber)) {
      return reply('❌ _Perintah ini khusus owner._')
    }
    const img = msg.message?.imageMessage
    if (!img) {
      return reply('📷 _Kirim *foto* dengan caption_ *setpp* _untuk mengganti foto profil bot._')
    }
    await reply('⏳ _Memasang foto profil…_')
    try {
      const buf = await downloadMediaMessage(msg, 'buffer', {})
      const botJid = sock.user?.id
      if (!botJid) throw new Error('identitas bot tidak tersedia')
      await sock.updateProfilePicture(botJid, buf)
      return reply('✅ _Foto profil bot berhasil diubah!_')
    } catch (e) {
      console.error('[setpp]', e.message || e)
      return reply('❌ _Gagal mengganti foto profil. Coba lagi dengan foto lain._')
    }
  },
}
