// toimg — ubah stiker jadi foto: reply stiker dengan "toimg"
import { downloadMediaMessage } from '@whiskeysockets/baileys'
import sharp from 'sharp'

export default {
  name: 'toimg',
  alias: ['toimage', 'stoimg'],
  description: 'Ubah stiker jadi foto',
  async run({ sock, chat, msg, reply }) {
    const stik = msg.message?.stickerMessage
      || msg.message?.extendedTextMessage?.contextInfo?.quotedMessage?.stickerMessage
    if (!stik) return reply('📌 _Reply *stiker* dengan perintah_ *toimg*')
    if (stik.isAnimated) return reply('⚠️ _Stiker bergerak belum didukung — pakai stiker foto._')
    await reply('⏳ _Mengubah…_')
    try {
      // coba dari pesan langsung; kalau kosong ambil dari quoted
      let buf = null
      try { buf = await downloadMediaMessage(msg, 'buffer', {}) } catch {}
      if (!buf) {
        const ci = msg.message?.extendedTextMessage?.contextInfo
        const qkey = { remoteJid: chat, fromMe: false, id: ci.stanzaId, participant: ci.participant }
        buf = await downloadMediaMessage({ key: qkey, message: ci.quotedMessage }, 'buffer', {})
      }
      const png = await sharp(buf).png().toBuffer()
      await sock.sendMessage(chat, { image: png, caption: '✅ Nih kak' }, { quoted: msg })
    } catch (e) {
      console.error('[toimg]', e.message)
      return reply('❌ _Gagal mengubah stiker._')
    }
  },
}
