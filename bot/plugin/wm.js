// wm — beri watermark/packname stiker: reply stiker dengan "wm <nama-paket>|<author>"
// atau langsung "wm <teks>" untuk mengganti pack saja. Murni manipulasi exif webp.
import { downloadMediaMessage } from '@whiskeysockets/baileys'

// exif webp whatsapp: chunk XMP + biner exif di akhir file
function buildExif(packname, author) {
  const json = { 'sticker-pack-id': 'ksrbot', 'sticker-pack-name': packname, 'sticker-pack-publisher': author || '' }
  let data = Buffer.from(JSON.stringify(json), 'utf8')
  if (data.length > 100000) data = data.slice(0, 100000)
  // format exif baileys: [49, 48, 49, 48, 45, 48] + len2 + data + pad
  const len = [0, data.length >> 8, data.length & 0xff]
  const head = Buffer.from([0x49, 0x49, 0x2a, 0x00, 0x08, 0x00, 0x00, 0x00, len[1], len[2], ...[49, 48, 49, 48, 45, 48]])
  const exif = Buffer.concat([head, data, Buffer.alloc(0)])
  return exif
}

function addExif(webpBuf, packname, author) {
  // strip exif lama jika ada (webp VP8X + exif chunk di akhir oleh whatsapp tools umumnya di belakang)
  let buf = webpBuf
  const str = buf.toString('latin1')
  const idx = str.lastIndexOf('II*\u0000')
  if (idx > 0) buf = buf.slice(0, idx)
  return Buffer.concat([buf, buildExif(packname, author)])
}

export default {
  name: 'wm',
  alias: ['take', 'watermark'],
  description: 'Ganti nama pembuat stiker: wm <pack>|<author>',
  async run({ sock, chat, msg, reply, args, text }) {
    const stik = msg.message?.stickerMessage
      || msg.message?.extendedTextMessage?.contextInfo?.quotedMessage?.stickerMessage
    if (!stik) return reply('📌 _Reply *stiker* dengan perintah:_ *wm NamaPaket|Author*')
    const t = (text || '').replace(/^\S+\s*/, '').trim()
    if (!t) return reply('📌 _Format:_ *wm NamaPaket|Author*')
    const [pack, author] = t.split('|').map(s => s.trim())
    await reply('⏳ _Memproses…_')
    try {
      const buf = await downloadMediaMessage(msg, 'buffer', {}) // reply → quoted otomatis? baileys perlu konteks:
      const out = addExif(buf, pack || 'Stiker', author || '')
      await sock.sendMessage(chat, { sticker: out }, { quoted: msg })
    } catch (e) {
      // fallback: download dari quoted
      try {
        const qmsg = { key: msg.message.extendedTextMessage.contextInfo.participant ? {
          remoteJid: chat, fromMe: false, id: msg.message.extendedTextMessage.contextInfo.stanzaId, participant: msg.message.extendedTextMessage.contextInfo.participant,
        } : msg.key, message: msg.message.extendedTextMessage.contextInfo.quotedMessage }
        const buf = await downloadMediaMessage(qmsg, 'buffer', {})
        const [p, a] = t.split('|').map(s => s.trim())
        await sock.sendMessage(chat, { sticker: addExif(buf, p || 'Stiker', a || '') }, { quoted: msg })
      } catch (e2) {
        console.error('[wm]', e.message, e2.message)
        return reply('❌ _Gagal mengambil stiker. Pastikan reply stiker._')
      }
    }
  },
}
