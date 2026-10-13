// Sesi input generate v2: prompt (+ foto referensi opsional utk video) -> durasi -> teruskan ke Telegram
// Kedaluwarsa 10 menit.
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'
import { downloadMediaMessage } from '@whiskeysockets/baileys'
import { sendButtons } from './buttons.js'
import { forwardGenJob } from './genTelegram.js'
import { BOT_NAME } from './brand.js'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const FILE = path.join(__dirname, '..', 'data', 'gensession.json')
const REFDIR = path.join(__dirname, '..', 'data', 'genref')
const TTL = 10 * 60 * 1000
const MAXREF = 8 * 1024 * 1024

function load() {
  try { return JSON.parse(fs.readFileSync(FILE, 'utf8')) } catch { return {} }
}
function save(o) {
  fs.mkdirSync(path.dirname(FILE), { recursive: true })
  fs.writeFileSync(FILE, JSON.stringify(o, null, 2))
}

export function startGenSession(sender, type) {
  const s = load()
  s[sender] = { type, stage: 'prompt', prompt: '', refPath: '', duration: 0, createdAt: Date.now() }
  save(s)
}
export function getGenSession(sender) {
  const s = load()[sender]
  if (!s) return null
  if (Date.now() - s.createdAt > TTL) {
    clearGenSession(sender)
    return null
  }
  return s
}
export function updateGenSession(sender, patch) {
  const s = load()
  if (!s[sender]) return
  s[sender] = { ...s[sender], ...patch }
  save(s)
}
export function clearGenSession(sender) {
  const s = load()
  delete s[sender]
  save(s)
}

// TODO: isi saat API key kie.ai tersedia (jalur produksi)
async function generateVideo(prompt, opts) { throw new Error('API belum dipasang') }
async function generateImage(prompt, opts) { throw new Error('API belum dipasang') }

function simReply({ type, prompt, refPath, duration, jobId }) {
  const emoji = type === 'gambar' ? '🖼️' : '🎬'
  const short = prompt.length > 120 ? prompt.slice(0, 120) + '…' : prompt
  let t = `Siap! ${emoji} Prompt diterima: "${short}".`
  if (type === 'video') {
    t += `\n🎞️ Referensi: ${refPath ? 'ada ✅' : 'tidak ada'}\n⏱️ Durasi: ${duration} detik`
  }
  if (jobId) t += `\n📨 Job ${jobId} diteruskan.`
  else t += `\n_Fitur generate segera hadir — API belum dipasang._`
  return t
}

// Handle pesan sebagai input generate. Return true jika ditangani.
export async function handleGenInput({ sock, chat, sender, msg, text, reply }) {
  const session = getGenSession(sender)
  if (!session) return false
  const num = String(sender).replace(/\D/g, '')

  // --- foto/gambar masuk: hanya untuk video di stage prompt ---
  const imgMsg = msg.message?.imageMessage
  if (imgMsg) {
    if (session.type !== 'video' || session.stage !== 'prompt') {
      await reply('Untuk gambar, cukup kirim prompt teks ya 🙂')
      return true
    }
    const size = Number(imgMsg.fileLength || 0)
    if (size > MAXREF) {
      await reply('❌ _Foto terlalu besar (maks 8MB). Kirim yang lebih kecil ya._')
      return true
    }
    try {
      const buf = await downloadMediaMessage(msg, 'buffer', {})
      fs.mkdirSync(REFDIR, { recursive: true })
      const refPath = path.join(REFDIR, num + '.jpg')
      fs.writeFileSync(refPath, buf)
      updateGenSession(sender, { refPath })
      await reply('Referensi foto diterima ✅\nSekarang kirim prompt / deskripsi videonya.')
    } catch (e) {
      console.error('[gen] gagal unduh referensi:', e.message)
      await reply('❌ _Gagal mengunduh foto. Coba kirim ulang ya._')
    }
    return true
  }

  // --- teks masuk ---
  const t = (text || '').trim()
  if (session.stage === 'prompt') {
    if (!t) {
      await reply('Ketik promptnya dulu ya 🙂')
      return true
    }
    if (session.type === 'video') {
      updateGenSession(sender, { prompt: t, stage: 'duration' })
      await sendButtons(
        sock,
        chat,
        {
          body: 'Prompt dicatat ✅\n\n_Pilih durasi video:_',
          footer: BOT_NAME,
          buttons: [
            { id: 'ui:generate:dur15', text: '⏱️ 15 Detik' },
            { id: 'ui:generate:dur30', text: '⏱️ 30 Detik' },
          ],
        },
        { quoted: msg }
      )
      return true
    }
    // gambar: finalisasi + teruskan ke Telegram
    const done = { ...session, prompt: t }
    clearGenSession(sender)
    const jobId = await forwardGenJob({ type: 'gambar', prompt: t, duration: 0, refPath: '', sender })
    await reply(simReply({ ...done, jobId }))
    return true
  }

  if (session.stage === 'duration') {
    await reply('Pilih durasi lewat tombol ya ⏱️')
    return true
  }
  return false
}
