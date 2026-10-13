// Teruskan job Generate ke grup Telegram via Bot API.
// Dipakai saat alur generate selesai (prompt + durasi terkumpul).
// Job dicatat di data/genjobs.json agar watcher Phase 2 bisa meneruskan hasilnya.
import fs from 'fs'
import { saveGenJob } from './genJobs.js'

const TOKEN = process.env.GEN_TG_BOT_TOKEN
const CHAT_ID = process.env.GEN_TG_CHAT_ID

export function makeJobId() {
  return (
    'GEN-' +
    Date.now().toString(36).toUpperCase() +
    Math.random().toString(36).slice(2, 6).toUpperCase()
  )
}

async function tgApi(method, body, isForm) {
  const url = `https://api.telegram.org/bot${TOKEN}/${method}`
  const r = await fetch(url, isForm
    ? { method: 'POST', body }
    : { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
  const j = await r.json()
  if (!j.ok) throw new Error(j.description || `${method} gagal`)
  return j
}

// Kirim job card. Return jobId jika sukses, null jika gagal.
export async function forwardGenJob({ type, prompt, duration, refPath, sender }) {
  if (!TOKEN || !CHAT_ID) {
    console.error('[gentg] GEN_TG_BOT_TOKEN / GEN_TG_CHAT_ID belum diset')
    return null
  }
  const jobId = makeJobId()
  const waNumber = String(sender || '').replace(/\D/g, '')
  const emoji = type === 'gambar' ? '🖼️' : '🎬'
  const short = prompt.length > 700 ? prompt.slice(0, 700) + '…' : prompt
  const caption =
    `\u0001F916 REQUEST GENERATE untuk Muse 2\n\n` +
    `${emoji} Jenis: ${type === 'gambar' ? 'Gambar' : `Video (${duration} detik)`}\n` +
    `\U0001F4DD Prompt: ${short}\n` +
    `\U0001F5BC\uFE0F Referensi: ${refPath && fs.existsSync(refPath) ? 'terlampir' : 'tidak ada'}\n` +
    `\U0001F194 Job: ${jobId}\n` +
    `\U0001F4F1 Dari: ${waNumber}\n\n` +
    `Mohon buatkan sesuai prompt di atas, lalu kirim hasilnya sebagai REPLY ke pesan ini.`
  try {
    let sent
    if (refPath && fs.existsSync(refPath)) {
      const form = new FormData()
      form.append('chat_id', CHAT_ID)
      form.append('caption', caption.slice(0, 1024))
      form.append('photo', new Blob([fs.readFileSync(refPath)], { type: 'image/jpeg' }), 'referensi.jpg')
      sent = await tgApi('sendPhoto', form, true)
    } else {
      sent = await tgApi('sendMessage', { chat_id: CHAT_ID, text: caption.slice(0, 4000) })
    }
    const tgMessageId = sent.result && sent.result.message_id
    saveGenJob({ jobId, waJid: sender, type, prompt, duration, tgMessageId })
    console.log(`[gentg] job ${jobId} terkirim ke Telegram (msg ${tgMessageId})`)
    return jobId
  } catch (e) {
    console.error('[gentg] gagal kirim job:', e.message)
    return null
  }
}
