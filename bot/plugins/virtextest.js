// Plugin VirtexTest — uji ketahanan bot terhadap karakter aneh (virtex dkk).
// Khusus owner. Command: virtextest (alias: virtex-test)
// Menjalankan sampel karakter bermasalah lewat sanitizeText + ekstraksi perintah
// yang sama seperti handler.js, lalu melaporkan hasilnya.
import { isAdmin } from './produk.js'
import { sanitizeText } from '../src/sanitize.js'

const U = (...codes) => String.fromCharCode(...codes)
const SAMPLES = [
  { name: 'RTL override (U+202E)', text: 'halo ' + U(0x202E) + 'olleh kabar' },
  { name: 'Bidi isolate (U+2066/69)', text: U(0x2066) + 'nama produk' + U(0x2069) + ' Rp10000' },
  { name: 'Zero-width (U+200B-D)', text: 'me' + U(0x200B) + 'nu' + U(0x200C) + 'ut' + U(0x200D) + 'ama' },
  { name: 'Control chars (NUL/BEL)', text: 'ping' + U(0x0000, 0x0007) + 'test' },
  { name: 'BOM (U+FEFF)', text: U(0xFEFF) + 'menu' },
  { name: 'Zalgo (combining)', text: 't' + U(0x0337) + 'e' + U(0x0336) + 's' + U(0x0334) + 't' + U(0x0337) },
  { name: 'Teks 6000 char', text: 'x'.repeat(6000) },
  { name: 'Emoji flood 1000x', text: '🔥'.repeat(1000) },
  { name: 'Kosong', text: '' },
  { name: 'Normal', text: 'menu' },
]

function extractCommand(text) {
  const parts = text.split(/\s+/)
  return parts[0].toLowerCase().replace(/^[/.!]/, '')
}

export default {
  name: 'virtextest',
  ownerOnly: true,
  alias: ['virtex-test'],
  description: 'uji ketahanan bot terhadap karakter aneh (owner)',
  async run({ reply, config, sender, senderNumber }) {
    if (!isAdmin(config, sender, senderNumber)) {
      await reply('⛔ Khusus owner.')
      return
    }
    const lines = ['🛡️ *Uji Ketahanan Virtex*', '']
    let fail = 0
    for (const s of SAMPLES) {
      try {
        const clean = sanitizeText(s.text)
        const cmd = clean ? extractCommand(clean) : '(kosong)'
        lines.push(`✅ ${s.name}: ${s.text.length} → ${clean.length} char, cmd=\`${cmd.slice(0, 20)}\``)
      } catch (e) {
        fail++
        lines.push(`❌ ${s.name}: GAGAL — ${e.message}`)
      }
    }
    lines.push('', fail ? `⚠️ ${fail} sampel GAGAL — perlu perbaikan.` : '🎉 Semua sampel lolos, bot aman.')
    await reply(lines.join('\n'))
  },
}
