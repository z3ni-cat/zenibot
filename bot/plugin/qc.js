// qc — reply chat dengan "qc <teks>" → stiker kotak chat berisi teks (nama pengirim asli)
import { downloadMediaMessage } from '@whiskeysockets/baileys'
import sharp from 'sharp'

function esc(s) { return s.replace(/[<>&]/g, c => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;' }[c])) }

function wrap(text, maxChars) {
  const words = text.split(/\s+/); const lines = []; let cur = ''
  for (const w of words) {
    if ((cur + ' ' + w).trim().length > maxChars) { lines.push(cur.trim()); cur = w } else cur += ' ' + w
  }
  if (cur.trim()) lines.push(cur.trim())
  return lines.slice(0, 10)
}

export default {
  name: 'qc',
  alias: ['quotec', 'quotechat'],
  description: 'Stiker kotak chat: reply pesan dengan qc <teks>',
  async run({ sock, chat, msg, reply, text, pushName }) {
    const t = (text || '').replace(/^\S+\s*/, '').trim()
    if (!t) return reply('📌 _Reply pesan seseorang dengan:_ *qc <komentarmu>*')
    const name = pushName || 'Kak'
    const lines = wrap(t, 26)
    const W = 640
    const lh = 52
    const H = 200 + lines.length * lh
    const svg = `<svg width="${W}" height="${H}" xmlns="http://www.w3.org/2000/svg">
      <rect width="${W}" height="${H}" fill="#0b141a"/>
      <rect x="40" y="70" rx="24" ry="24" width="${W - 80}" height="${H - 140}" fill="#005c4b"/>
      <polygon points="52,90 40,70 76,78" fill="#005c4b"/>
      <text x="72" y="112" font-family="Arial, sans-serif" font-size="30" font-weight="bold" fill="#ffd27f">${esc(name)}</text>
      <text x="72" y="170" font-family="Arial, sans-serif" font-size="36" fill="#ffffff">${lines.map((l, i) =>
        `<tspan x="72" dy="${i === 0 ? 0 : lh}">${esc(l)}</tspan>`).join('')}
      </text>
    </svg>`
    try {
      const webp = await sharp(Buffer.from(svg)).webp({ quality: 90 }).toBuffer()
      await sock.sendMessage(chat, { sticker: webp }, { quoted: msg })
    } catch (e) {
      console.error('[qc]', e.message)
      return reply('❌ _Gagal membuat stiker qc._')
    }
  },
}
