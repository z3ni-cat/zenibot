// Tools Gratis — eksekusi via API sendiri (https://zenicat.net/api).
// Neoxr hanya dipakai untuk downloader (fallback rahad) & fitur berat (nobg/remini/pdf).
// Dipakai oleh plugin/tools.js (UI) dan src/deviceMode.js (navigasi angka iPhone).
import { downloadMediaMessage } from '@whiskeysockets/baileys'
import { neoxr, downloadBuffer, uploadTemp, normMedia } from './neoxr.js'
import { getToolSession, updateToolSession, clearToolSession } from './toolSession.js'
import { STORE_NAME } from './brand.js'

// API tools milik sendiri — deploy: ~/toolsapi di VPS 1 → https://zenicat.net/api
const TOOLSAPI = 'https://zenicat.net/api'
const TOOLSAPI_KEY = process.env.TOOLSAPI_KEY || ''
async function tapi(path, { method = 'GET', body } = {}) {
  const res = await fetch(TOOLSAPI + path, {
    method,
    headers: {
      'x-api-key': TOOLSAPI_KEY,
      ...(body ? { 'content-type': 'application/json' } : {}),
    },
    ...(body ? { body: JSON.stringify(body) } : {}),
  })
  const ct = res.headers.get('content-type') || ''
  if (!res.ok) {
    const t = await res.text().catch(() => '')
    throw new Error(`API error ${res.status}${t ? ': ' + t.slice(0, 120) : ''}`)
  }
  if (ct.includes('image/')) return { buffer: Buffer.from(await res.arrayBuffer()) }
  return res.json()
}

// Kecilkan gambar besar sebelum dikirim ke API (hemat bandwidth & waktu)
async function shrinkImage(buf, maxBytes = 4 * 1024 * 1024) {
  if (buf.length <= maxBytes) return buf
  const sharp = (await import('sharp')).default
  return sharp(buf).resize(1600, 1600, { fit: 'inside', withoutEnlargement: true }).jpeg({ quality: 88 }).toBuffer()
}

export const TOOL_CATS = [
  { id: 'downloader', name: 'Downloader', emoji: '⬇️', desc: 'Download video/foto sosmed' },
  { id: 'tools', name: 'Tools', emoji: '⚙️', desc: 'Convert, cek resi, dsb' },
  { id: 'stiker', name: 'Stiker', emoji: '🎨', desc: 'Bikin & ubah stiker WA' },
]

const cancelHint = '\n\n_(ketik *batal* untuk membatalkan)_'

async function execPdf(input, { file }, to, mimetype) {
  const { url: publicUrl, cleanup } = await uploadTemp(file.buffer, file.fileName)
  try {
    const base = file.fileName.replace(/\.pdf$/i, '')
    const j = await neoxr('pdf-converter', { url: publicUrl, filename: base || 'document', to })
    if (!j.data?.url) throw new Error('Konversi gagal, coba lagi.')
    const buf = await downloadBuffer(j.data.url)
    return { document: { buffer: buf, fileName: j.data.filename || `converted.${to}`, mimetype } }
  } finally {
    await cleanup()
  }
}

// Fallback downloader gratis via rahad-all-downloader-v2 (tanpa API key)
async function rahadFallback(url, platform) {
  const { alldl } = await import('rahad-all-downloader-v2')
  if (platform === 'tiktok') {
    const r = await alldl.tiktok(url)
    const d = r?.data
    const vurl = d?.download?.no_watermark || d?.videoUrl
    if (!vurl) throw new Error('Rahad: video tidak ditemukan.')
    return [{ url: vurl, type: 'video' }]
  }
  if (platform === 'instagram') {
    const r = await alldl.insta(url)
    const d = r?.data?.download
    if (!d?.url) throw new Error('Rahad: media tidak ditemukan.')
    return [{ url: d.url, type: d.type === 'image' ? 'image' : 'video' }]
  }
  throw new Error('Rahad: platform tidak didukung.')
}

export const TOOLS = [
  {
    id: 'igdl', cat: 'downloader', name: 'Instagram Downloader', emoji: '📸',
    desc: 'Download foto/video/reels IG',
    prompt: `📸 *Instagram Downloader*\n\nKirim link Instagram (postingan/reels):${cancelHint}`,
    async exec(input) {
      const url = input.trim()
      if (!/^https?:\/\//i.test(url)) throw new Error('Kirim link Instagram yang valid.')
      let media = []
      try {
        const j = await neoxr('ig', { url })
        media = normMedia(j)
      } catch (e) { /* fallback ke rahad */ }
      if (!media.length) {
        try { media = normMedia(await rahadFallback(url, 'instagram')) }
        catch (e2) { throw new Error('Media tidak ditemukan (Neoxr & fallback gagal).') }
      }
      return { media, caption: '📸 Instagram Downloader' }
    },
  },
  {
    id: 'igsdl', cat: 'downloader', name: 'Instagram Story Downloader', emoji: '📱',
    desc: 'Download story IG via username',
    prompt: `📱 *Instagram Story Downloader*\n\nKirim username Instagram (tanpa @):${cancelHint}`,
    async exec(input) {
      const username = input.trim().replace(/^@/, '').replace(/\s+/g, '')
      if (!username) throw new Error('Username tidak boleh kosong.')
      const j = await neoxr('igs', { username })
      const media = normMedia(j)
      if (!media.length) throw new Error('Story tidak ditemukan (akun private/tidak ada).')
      return { media, caption: `📱 @${username}` }
    },
  },
  {
    id: 'ttdl', cat: 'downloader', name: 'Tiktok No WM', emoji: '🎵',
    desc: 'Download video TikTok tanpa watermark',
    prompt: `🎵 *Tiktok No WM*\n\nKirim link TikTok:${cancelHint}`,
    async exec(input) {
      const url = input.trim()
      if (!/^https?:\/\//i.test(url)) throw new Error('Kirim link TikTok yang valid.')
      let media = []
      try {
        const j = await neoxr('tiktok', { url })
        media = normMedia(j)
        // Neoxr: field 'video' = mp4 tanpa watermark (URL tokenized, tak terdeteksi sbg video)
        if (j.data?.video && media.length) media = media.map((m) => ({ ...m, type: 'video' }))
      } catch (e) { /* fallback ke rahad */ }
      if (!media.length) {
        try { media = normMedia(await rahadFallback(url, 'tiktok')) }
        catch (e2) { throw new Error('Video tidak ditemukan (Neoxr & fallback gagal).') }
      }
      return { media, caption: '🎵 Tiktok No WM' }
    },
  },
  {
    id: 'ytmp3', cat: 'downloader', name: 'YouTube MP3', emoji: '🎶',
    desc: 'Download audio MP3 dari YouTube',
    prompt: `🎶 *YouTube MP3*\n\nKirim link YouTube:${cancelHint}`,
    async exec(input) {
      const url = input.trim()
      if (!/^https?:\/\//i.test(url)) throw new Error('Kirim link YouTube yang valid.')
      if (!/youtube\.com|youtu\.be/i.test(url)) throw new Error('Link harus dari YouTube.')
      const j = await neoxr('youtube', { url, type: 'audio', quality: '128kbps' })
      const d = j.data ?? j.result ?? j
      const dlUrl = d.url || d.download || d.link
      const title = d.title || 'audio'
      if (!dlUrl) throw new Error('Gagal mendapatkan link download.')
      const buf = await downloadBuffer(dlUrl)
      const safeTitle = title.replace(/[^\w\s-]/g, '').trim().slice(0, 50) || 'audio'
      return {
        document: {
          buffer: buf,
          fileName: safeTitle + '.mp3',
          mimetype: 'audio/mpeg',
        },
        text: `🎶 *${title}*`,
      }
    },
  },
  {
    id: 'nobg', cat: 'tools', name: 'Hapus Background', emoji: '🖼️',
    desc: 'Hapus background foto jadi transparan',
    needsImage: true,
    prompt: `🖼️ *Hapus Background*\n\nKirim foto yang mau dihapus background-nya:${cancelHint}`,
    async exec(input, { file }) {
      const buf = await shrinkImage(file.buffer)
      const j = await tapi('/v1/image/nobg', { method: 'POST', body: { image: buf.toString('base64') } })
      if (!j.ok || !j.image) throw new Error(j.error || 'Gagal memproses gambar.')
      return { document: { buffer: Buffer.from(j.image, 'base64'), fileName: 'nobg.png', mimetype: 'image/png' }, text: '🖼️ *Background dihapus!*' }
    },
  },
  {
    id: 'remini', cat: 'tools', name: 'HD-kan Foto', emoji: '✨',
    desc: 'Perjelas & HD-kan foto buram',
    needsImage: true,
    prompt: `✨ *HD-kan Foto*\n\nKirim foto yang mau diperjelas:${cancelHint}`,
    async exec(input, { file }) {
      const buf = await shrinkImage(file.buffer)
      const j = await tapi('/v1/image/upscale', { method: 'POST', body: { image: buf.toString('base64') } })
      if (!j.ok || !j.image) throw new Error(j.error || 'Gagal memproses gambar.')
      return { media: [{ type: 'image', buffer: Buffer.from(j.image, 'base64') }], caption: '✨ *Foto diperjelas!*' }
    },
  },
  {
    id: 'watermark', cat: 'tools', name: 'Watermark Foto', emoji: '©️',
    desc: 'Tambah watermark ' + STORE_NAME + ' ke foto',
    needsImage: true,
    prompt: `©️ *Watermark Foto*\n\nKirim foto produk yang mau diberi watermark:${cancelHint}`,
        async exec(input, { file }) {
      const sharp = (await import('sharp')).default;
      const fs = (await import('fs')).default;
      const img = sharp(file.buffer);
      const meta = await img.metadata();
      const W = meta.width || 1080, H = meta.height || 1080;
      const text = STORE_NAME;

      // 1) Tiled watermark ala Shutterstock: teks diagonal berulang di seluruh gambar
      const tileSize = Math.max(200, Math.round(W / 4));
      const fontSize = Math.round(tileSize / 8);
      const tileSvg = `<svg width="${tileSize}" height="${tileSize}"><text x="${tileSize/2}" y="${tileSize/2}" font-family="sans-serif" font-size="${fontSize}" font-weight="bold" fill="white" fill-opacity="0.16" stroke="black" stroke-opacity="0.18" stroke-width="0.75" text-anchor="middle" dominant-baseline="middle" transform="rotate(-30 ${tileSize/2} ${tileSize/2})">${text}</text></svg>`;
      const cols = Math.ceil(W / tileSize) + 1, rows = Math.ceil(H / tileSize) + 1;
      const patternW = cols * tileSize, patternH = rows * tileSize;
      const pattern = await sharp({
        create: { width: patternW, height: patternH, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } }
      }).composite(
        Array.from({ length: rows }, (_, r) =>
          Array.from({ length: cols }, (_, c) => ({
            input: Buffer.from(tileSvg), top: r * tileSize, left: c * tileSize,
          }))
        ).flat()
      ).extract({ left: 0, top: 0, width: W, height: H }).png().toBuffer();

      // 2) Logo di kiri atas
      let logoBuf = null;
      try {
        const logoSize = Math.round(Math.min(W, H) / 5);
        logoBuf = await sharp('/home/ubuntu/zenicat/assets/logo-watermark.png')
          .resize(logoSize, logoSize, { fit: 'inside' })
          .png()
          .toBuffer();
      } catch (e) { /* logo opsional */ }
      const logoMeta = logoBuf ? await sharp(logoBuf).metadata() : null;
      const logoPad = Math.round(Math.min(W, H) / 40);

      const composites = [{ input: pattern, top: 0, left: 0 }];
      if (logoBuf) composites.push({ input: logoBuf, top: logoPad, left: logoPad });

      const out = await img.composite(composites).jpeg({ quality: 90 }).toBuffer();
      const logoNote = logoBuf ? ' + logo' : '';
      return { media: [{ type: 'image', buffer: out }], caption: `©️ *Watermark${logoNote} ditambahkan!*` };
    },
  },
  {
    id: 'pdfpptx', cat: 'tools', name: 'PDF To PPTX', emoji: '📄',
    desc: 'Ubah PDF menjadi PowerPoint',
    needsFile: true,
    prompt: `📄 *PDF To PPTX*\n\nKirim file PDF-nya sebagai *dokumen*:${cancelHint}`,
    async exec(input, { file }) {
      return execPdf(input, { file }, 'pptx',
        'application/vnd.openxmlformats-officedocument.presentationml.presentation')
    },
  },
  {
    id: 'pdfxlsx', cat: 'tools', name: 'PDF To XSLX', emoji: '📊',
    desc: 'Ubah PDF menjadi Excel',
    needsFile: true,
    prompt: `📊 *PDF To XSLX*\n\nKirim file PDF-nya sebagai *dokumen*:${cancelHint}`,
    async exec(input, { file }) {
      return execPdf(input, { file }, 'xslx',
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet')
    },
  },
  {
    id: 'cekresi', cat: 'tools', name: 'Cek Resi', emoji: '📦',
    desc: 'Lacak paket ekspedisi',
    prompt: `📦 *Cek Resi*\n\nKirim dengan format:\n*No.Resi | Ekspedisi*\nContoh: 1234567890 | JNE${cancelHint}`,
    async exec(input) {
      const [resi, ekspedisi] = input.split('|').map((s) => s.trim())
      if (!resi || !ekspedisi) throw new Error('Format: No.Resi | Ekspedisi (contoh: 1234567890 | JNE)')
      const j = await neoxr('cekresi', { resi, ekspedisi })
      const d = j.data || {}
      const hist = (d.history || []).slice(0, 8)
        .map((h) => `• ${h.description || '-'}${h.time && h.time !== '-' ? ` _(${h.time})_` : ''}`)
        .join('\n')
      return {
        text: `📦 *Cek Resi*\n\n🚚 ${d.courier || ekspedisi}\n🔖 \`${d.awb || resi}\`\n📌 Status: *${d.state || '-'}*\n\n*Riwayat:*\n${hist || '-'}`,
      }
    },
  },
  {
    id: 'mlbb', cat: 'tools', name: 'MLBB Region Check', emoji: '🎮',
    desc: 'Cek region akun MLBB',
    prompt: `🎮 *MLBB Region Check*\n\nKirim dengan format:\n*User ID | Zone ID*\nContoh: 1272893759 | 15312${cancelHint}`,
    async exec(input) {
      const [id, zone] = input.split('|').map((s) => s.trim())
      if (!id || !zone) throw new Error('Format: User ID | Zone ID (contoh: 1272893759 | 15312)')
      const j = await tapi(`/v1/mlbb/check?id=${encodeURIComponent(id)}&zone=${encodeURIComponent(zone)}`)
      if (!j.ok) throw new Error(j.error || 'Akun tidak ditemukan.')
      return { text: `🎮 *MLBB Region Check*\n\n👤 ${j.username || '-'}\n🆔 ${j.uid} (${j.zone})\n🌍 Region: *${j.country || '-'}*` }
    },
  },
  {
    id: 'vcc', cat: 'tools', name: 'VCC Generator', emoji: '💳',
    desc: 'Generate kartu virtual',
    prompt: `💳 *VCC Generator*\n\nPilih tipe kartu:\n1. Visa\n2. MasterCard\n3. American Express\n4. JCB${cancelHint}`,
    async exec(input) {
      const t = input.trim().toLowerCase()
      const alias = { 1: 'visa', 2: 'mastercard', 3: 'amex', 4: 'jcb', 'american express': 'amex' }
      const type = alias[t] || (['visa', 'mastercard', 'amex', 'jcb'].includes(t) ? t : null)
      const label = { visa: 'Visa', mastercard: 'MasterCard', amex: 'American Express', jcb: 'JCB' }
      if (!type) throw new Error('Pilih 1-4 atau ketik nama tipenya.')
      const j = await tapi(`/v1/vcc/generate?type=${type}&count=3`)
      const list = (j.cards || [])
        .map((c, i) => `*${i + 1}. ${c.type}*\n👤 ${c.name}\n💳 \`${c.number}\`\n🔐 CVV: ${c.cvv} | 📅 ${c.expiry}`)
        .join('\n\n')
      if (!list) throw new Error('Gagal generate, coba lagi.')
      return { text: `💳 *VCC Generator — ${label[type]}*\n\n${list}\n\n_Untuk keperluan testing/dev._` }
    },
  },
  {
    id: 'iqc', cat: 'tools', name: 'Iphone Quote Maker', emoji: '💬',
    desc: 'Buat gambar quote ala iPhone',
    prompt: `💬 *Iphone Quote Maker*\n\nKirim dengan format:\n*Teks | Jam*\nContoh: Halo dunia | 12.00${cancelHint}`,
    async exec(input) {
      const [text, time] = input.split('|').map((s) => s.trim())
      if (!text || !time) throw new Error('Format: Teks | Jam (contoh: Halo dunia | 12.00)')
      const r = await tapi('/v1/quote/iphone', { method: 'POST', body: { text, time } })
      if (!r.buffer) throw new Error('Gagal membuat gambar.')
      return { media: [{ type: 'image', buffer: r.buffer }], caption: '💬 Iphone Quote Maker' }
    },
  },

  // ---- Kategori Stiker (murni buatan sendiri — jalan lokal via sharp/ffmpeg) ----
  {
    id: 'brat', cat: 'stiker', name: 'Brat Sticker', emoji: '🖤',
    desc: 'Stiker teks gaya brat',
    prompt: `🖤 *Brat Sticker*\n\nKirim teksnya (contoh: halo dunia):${cancelHint}`,
    async exec(input) {
      const t = (input || '').trim()
      if (!t) throw new Error('Teksnya kosong.')
      const sharp = (await import('sharp')).default
      const words = t.split(/\s+/); const lines = []; let cur = ''
      for (const w of words) { if ((cur + ' ' + w).trim().length > 11) { lines.push(cur.trim()); cur = w } else cur += ' ' + w }
      if (cur.trim()) lines.push(cur.trim())
      const ls = lines.slice(0, 8)
      const fs = Math.max(60, Math.min(110, Math.floor(430 / Math.max(...ls.map(l => l.length)))))
      const svg = `<svg width="512" height="512" xmlns="http://www.w3.org/2000/svg"><rect width="512" height="512" fill="#ffffff"/><text x="50%" y="50%" text-anchor="middle" dominant-baseline="central" font-family="Arial Black, Arial, sans-serif" font-weight="900" font-size="${fs}" fill="#000000">${ls.map((l, i) => `<tspan x="50%" dy="${i === 0 ? (1 - ls.length) * 0.62 : 1.25}em">${l.replace(/[<>&]/g, c => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;' }[c]))}</tspan>`).join('')}</text></svg>`
      const webp = await sharp(Buffer.from(svg)).webp({ quality: 90 }).toBuffer()
      return { sticker: webp, caption: '🖤 Brat Sticker' }
    },
  },
  {
    id: 'qcs', cat: 'stiker', name: 'Quote Chat', emoji: '💬',
    desc: 'Stiker kotak chat dari teks',
    prompt: `💬 *Quote Chat*\n\nKirim dengan format:\n*Nama | Teks*\nContoh: Budi | kapan kita jadian${cancelHint}`,
    async exec(input) {
      const [name, ...rest] = (input || '').split('|')
      const t = rest.join('|').trim()
      if (!t) throw new Error('Format: Nama | Teks')
      const sharp = (await import('sharp')).default
      const esc = (s) => s.replace(/[<>&]/g, c => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;' }[c]))
      const words = t.split(/\s+/); const lines = []; let cur = ''
      for (const w of words) { if ((cur + ' ' + w).trim().length > 26) { lines.push(cur.trim()); cur = w } else cur += ' ' + w }
      if (cur.trim()) lines.push(cur.trim())
      const ls = lines.slice(0, 10)
      const lh = 52
      const H = 200 + ls.length * lh
      const svg = `<svg width="640" height="${H}" xmlns="http://www.w3.org/2000/svg"><rect width="640" height="${H}" fill="#0b141a"/><rect x="40" y="70" rx="24" ry="24" width="560" height="${H - 140}" fill="#005c4b"/><polygon points="52,90 40,70 76,78" fill="#005c4b"/><text x="72" y="112" font-family="Arial, sans-serif" font-size="30" font-weight="bold" fill="#ffd27f">${esc(name.trim().slice(0, 20))}</text><text x="72" y="170" font-family="Arial, sans-serif" font-size="36" fill="#ffffff">${ls.map((l, i) => `<tspan x="72" dy="${i === 0 ? 0 : lh}">${esc(l)}</tspan>`).join('')}</text></svg>`
      const webp = await sharp(Buffer.from(svg)).webp({ quality: 90 }).toBuffer()
      return { sticker: webp, caption: '💬 Quote Chat' }
    },
  },


  // HIDE 9 Okt 2026 — sinkronisasi iPhone (tempmail)
//   {
//     id: 'tempmail', cat: 'tools', name: 'TempMail', emoji: '📧',
//     desc: 'Buat email sementara',
//     prompt: 'TempMail',
//     async exec(input) {
//       return { text: 'Ketik *tempmail* untuk menggunakan TempMail.' };
//     },
//   },

]

// Kirim hasil tool ke chat
export async function sendToolResult({ sock, chat, msg }, res) {
  if (res.sticker) {
    await sock.sendMessage(chat, { sticker: res.sticker }, { quoted: msg })
  }
  if (res.text) {
    await sock.sendMessage(chat, { text: res.text }, { quoted: msg })
  }
  if (res.imageUrl) {
    const buf = await downloadBuffer(res.imageUrl)
    await sock.sendMessage(chat, { image: buf, caption: res.caption || '' }, { quoted: msg })
  }
  if (res.media?.length) {
    let first = true
    for (const m of res.media) {
      try {
        const buf = m.buffer || await downloadBuffer(m.url)
        const caption = first && res.caption ? res.caption : ''
        first = false
        if (m.type === 'video') {
          await sock.sendMessage(chat, { video: buf, caption }, { quoted: msg })
        } else {
          await sock.sendMessage(chat, { image: buf, caption }, { quoted: msg })
        }
      } catch (e) {
        console.error('[tools] media gagal dikirim:', e.message)
      }
    }
  }
  if (res.document) {
    await sock.sendMessage(chat, {
      document: res.document.buffer,
      fileName: res.document.fileName,
      mimetype: res.document.mimetype,
    }, { quoted: msg })
  }
}

// Dipanggil handler.js saat pengirim punya sesi tool aktif.
// return true = pesan sudah ditangani.
export async function handleToolInput({ sock, chat, sender, msg, text, reply }) {
  const sess = getToolSession(sender)
  if (!sess) return false
  const tool = TOOLS.find((t) => t.id === sess.toolId)
  if (!tool) { clearToolSession(sender); return false }

  const t = (text || '').trim()
  if (/^batal$/i.test(t)) {
    clearToolSession(sender)
    await reply('❌ _Dibatalkan._')
    return true
  }

  let file = null
  if (tool.needsFile) {
    const doc = msg.message?.documentMessage
    if (!doc) {
      await reply('📎 _Kirim file PDF-nya sebagai *dokumen* ya._\n_(ketik *batal* untuk membatalkan)_')
      return true
    }
    try {
      const buf = await downloadMediaMessage(msg, 'buffer', {})
      file = { buffer: buf, fileName: doc.fileName || 'document.pdf' }
    } catch (e) {
      console.error('[tools] download dokumen gagal:', e.message)
      await reply('❌ _Gagal mengunduh file. Coba kirim ulang._')
      return true
    }
  }

  if (tool.needsImage) {
    const img = msg.message?.imageMessage
    if (!img) {
      await reply('🖼️ _Kirim *foto*-nya ya._\n_(ketik *batal* untuk membatalkan)_')
      return true
    }
    try {
      const buf = await downloadMediaMessage(msg, 'buffer', {})
      file = { buffer: buf, fileName: 'photo.jpg' }
    } catch (e) {
      console.error('[tools] download foto gagal:', e.message)
      await reply('❌ _Gagal mengunduh foto. Coba kirim ulang._')
      return true
    }
  }

  await reply('⏳ _Memproses…_')
  // Helper kirim react ke pesan user
  const reactDone = async (emoji) => {
    try {
      await sock.sendMessage(chat, { react: { text: emoji, key: msg.key } })
    } catch (e) { /* abaikan */ }
  }
  try {
    const res = await tool.exec(t, { file, session: { ...sess, sender } })
    await sendToolResult({ sock, chat, msg }, res)
    await reactDone('✅')
  } catch (e) {
    console.error(`[tools] ${tool.id} gagal:`, e.message)
    await reply(`❌ _Gagal: ${e.message}_`)
    await reactDone('❌')
  }
  clearToolSession(sender)
  return true
}
