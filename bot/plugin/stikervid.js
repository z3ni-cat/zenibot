// stikervid — ubah video/GIF pendek jadi stiker bergerak (webp animasi, maks 6 detik).
// Kirim VIDEO dengan caption "stikervid" (atau reply video: stikervid)
import { downloadMediaMessage } from '@whiskeysockets/baileys'
import { spawn } from 'child_process'
import os from 'os'
import fs from 'fs'
import path from 'path'

const MAX_SEC = 6

export default {
  name: 'stikervid',
  alias: ['svideo', 'stikergif'],
  description: 'Ubah video/GIF pendek jadi stiker bergerak',
  async run({ sock, chat, msg, reply }) {
    const q = msg.message?.videoMessage
      || msg.message?.documentMessage?.mimetype?.startsWith('video/') && msg.message.documentMessage
      || msg.message?.extendedTextMessage?.contextInfo?.quotedMessage?.videoMessage
    if (!q) {
      return reply('📌 _Kirim *video/GIF* (maks 6 detik) dengan caption_ *stikervid*')
    }
    await reply('⏳ _Membuat stiker bergerak…_')
    const tmp = path.join(os.tmpdir(), `sv_${Date.now()}`)
    try {
      const buf = await downloadMediaMessage(msg, 'buffer', {})
      fs.writeFileSync(tmp + '.in', buf)
      // ffmpeg: resize 512, potong 6 detik, webp animasi loop
      await new Promise((res, rej) => {
        const p = spawn('ffmpeg', [
          '-y', '-t', String(MAX_SEC), '-i', tmp + '.in',
          '-vf', 'scale=512:512:force_original_aspect_ratio=decrease,pad=512:512:-1:-1:color=0x00000000,fps=12',
          '-c:v', 'libwebp', '-quality', '80', '-loop', '0', '-an', tmp + '.webp',
        ])
        p.on('close', c => c === 0 ? res() : rej(new Error('ffmpeg exit ' + c)))
        p.on('error', rej)
        setTimeout(() => { try { p.kill() } catch {}; rej(new Error('timeout')) }, 60000)
      })
      const webp = fs.readFileSync(tmp + '.webp')
      if (webp.length > 1.5 * 1024 * 1024) throw new Error('stiker terlalu besar — pakai video lebih pendek')
      await sock.sendMessage(chat, { sticker: webp, animated: true }, { quoted: msg })
    } catch (e) {
      console.error('[stikervid]', e.message)
      return reply('❌ _Gagal: ' + (e.message || 'coba video lain yang lebih pendek._'))
    } finally {
      for (const s of ['.in', '.webp']) { try { fs.unlinkSync(tmp + s) } catch {} }
    }
  },
}
