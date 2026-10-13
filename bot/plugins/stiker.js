// stiker — ubah foto jadi stiker WhatsApp. Kirim FOTO dengan caption "stiker".
import { downloadMediaMessage } from '@whiskeysockets/baileys'
import sharp from 'sharp'

export default {
  name: 'stiker',
  alias: ['sticker'],
  description: 'Ubah foto jadi stiker WhatsApp',
  async run({ sock, chat, msg, reply }) {
    const img = msg.message?.imageMessage
    if (!img) {
      return reply('📌 _Kirim *foto* dengan caption_ *stiker* _untuk mengubahnya jadi stiker WhatsApp._')
    }
    await reply('⏳ _Membuat stiker…_')
    try {
      const buf = await downloadMediaMessage(msg, 'buffer', {})
      const webp = await sharp(buf)
        .resize(512, 512, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } })
        .webp({ quality: 90 })
        .toBuffer()
      await sock.sendMessage(chat, { sticker: webp }, { quoted: msg })
    } catch (e) {
      console.error('[stiker]', e.message || e)
      return reply('❌ _Gagal membuat stiker. Coba lagi dengan foto lain._')
    }
  },
}
