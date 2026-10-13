// brat — stiker teks ala BRAT (huruf putih hitam di latar hitam, foto nyata tak perlu — gaya teks tebal)
// Kirim: brat <teks>
import sharp from 'sharp'

function wrapText(text, maxChars) {
  const words = text.split(/\s+/)
  const lines = []
  let cur = ''
  for (const w of words) {
    if ((cur + ' ' + w).trim().length > maxChars) { lines.push(cur.trim()); cur = w } else cur += ' ' + w
  }
  if (cur.trim()) lines.push(cur.trim())
  return lines.slice(0, 8)
}

export default {
  name: 'brat',
  alias: ['bratstiker'],
  description: 'Stiker teks gaya brat: brat <teks>',
  async run({ sock, chat, msg, reply, text }) {
    const t = (text || '').replace(/^\S+\s*/, '').trim()
    if (!t) return reply('📌 _Contoh:_ *brat halo dunia*')
    try {
      const lines = wrapText(t, 11)
      const maxLen = Math.max(...lines.map(l => l.length))
      const fs = Math.max(60, Math.min(110, Math.floor(430 / maxLen)))
      const W = 512, H = 512
      const svg = `<svg width="${W}" height="${H}" xmlns="http://www.w3.org/2000/svg">
        <rect width="512" height="512" fill="#ffffff"/>
        <text x="50%" y="50%" text-anchor="middle" dominant-baseline="central"
          font-family="Arial Black, Arial, sans-serif" font-weight="900" font-size="${fs}"
          fill="#000000">${lines.map((l, i) =>
            `<tspan x="50%" dy="${i === 0 ? (1 - lines.length) * 0.62 : 1.25}em">${l.replace(/[<>&]/g, c => ({'<':'&lt;','>':'&gt;','&':'&amp;'}[c]))}</tspan>`).join('')}
        </text>
      </svg>`
      const webp = await sharp(Buffer.from(svg)).webp({ quality: 90 }).toBuffer()
      await sock.sendMessage(chat, { sticker: webp }, { quoted: msg })
    } catch (e) {
      console.error('[brat]', e.message)
      return reply('❌ _Gagal membuat stiker brat._')
    }
  },
}
