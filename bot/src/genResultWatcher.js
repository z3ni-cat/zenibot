// Watcher hasil generate (Phase 2): intip grup Telegram tiap 30 detik,
// teruskan file hasil ke WA pemesan.
// Korelasi A (utama): file dikirim sebagai REPLY ke pesan job card.
// Korelasi B (fallback): caption memuat job ID (mis. GEN-MUR4IEA6QB6Z).
import fs from 'fs'
import os from 'os'
import path from 'path'
import { fileURLToPath } from 'url'
import { findJobByTgMessageId, getGenJob, markGenJobDone, sweepGenJobs } from './genJobs.js'

const TOKEN = process.env.GEN_TG_BOT_TOKEN
const CHAT_ID = process.env.GEN_TG_CHAT_ID
const POLL_MS = 30_000
const MAXDL = 20 * 1024 * 1024 // limit download Bot API Telegram

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const STATE = path.join(__dirname, '..', 'data', 'genwatcher.json')

function loadState() {
  try { return JSON.parse(fs.readFileSync(STATE, 'utf8')) } catch { return { offset: 0 } }
}
function saveState(s) {
  fs.mkdirSync(path.dirname(STATE), { recursive: true })
  fs.writeFileSync(STATE, JSON.stringify(s))
}

async function tg(method, params = {}) {
  const qs = new URLSearchParams(params).toString()
  const r = await fetch(`https://api.telegram.org/bot${TOKEN}/${method}${qs ? '?' + qs : ''}`, { method: 'GET' })
  const j = await r.json()
  if (!j.ok) throw new Error(j.description || method)
  return j.result
}

export function startGenResultWatcher(getSock) {
  if (!TOKEN || !CHAT_ID) {
    console.log('[genres] GEN_TG_BOT_TOKEN / GEN_TG_CHAT_ID belum diset — watcher tidak dijalankan')
    return
  }
  console.log('[genres] watcher hasil generate aktif (cek tiap 30 detik)')
  let botId = 0
  setInterval(async () => {
    const sock = getSock()
    if (!sock) return
    try {
      if (!botId) botId = (await tg('getMe')).id
      const st = loadState()
      const updates = await tg('getUpdates', { offset: st.offset, timeout: 0 })
      for (const u of updates) {
        st.offset = Math.max(st.offset, u.update_id + 1)
        try {
          await handleUpdate(sock, u, botId)
        } catch (e) {
          console.error('[genres] gagal proses update:', e.message)
        }
      }
      saveState(st)
      sweepGenJobs()
    } catch (e) {
      console.error('[genres] poll gagal:', e.message)
    }
  }, POLL_MS)
}

async function handleUpdate(sock, u, botId) {
  const m = u.message
  if (!m || String(m.chat.id) !== String(CHAT_ID)) return
  // Abaikan pesan bot sendiri (job card) dan pesan teks biasa
  if (m.from && (m.from.is_bot || m.from.id === botId)) return
  const file = m.video || (m.photo ? m.photo[m.photo.length - 1] : null) || m.document
  if (!file) return

  // Korelasi ke job
  let job = null
  const replied = m.reply_to_message && m.reply_to_message.message_id
  if (replied) job = findJobByTgMessageId(replied)
  if (!job) {
    const mm = String(m.caption || '').match(/GEN-[A-Z0-9]+/)
    if (mm) {
      const j = getGenJob(mm[0])
      if (j && j.status === 'pending') job = j
    }
  }
  if (!job) {
    console.log('[genres] file tanpa job terkait, diabaikan')
    return
  }

  const fsize = file.file_size || 0
  if (fsize > MAXDL) {
    await sock.sendMessage(job.waJid, {
      text: `Hasil untuk job ${job.jobId} terlalu besar (>20MB) — minta dikirim manual ya 🙏`,
    })
    markGenJobDone(job.jobId)
    return
  }

  const fpath = (await tg('getFile', { file_id: file.file_id })).file_path
  const r = await fetch(`https://api.telegram.org/file/bot${TOKEN}/${fpath}`)
  if (!r.ok) throw new Error(`unduh file gagal: HTTP ${r.status}`)
  const buf = Buffer.from(await r.arrayBuffer())
  const caption =
    `Selesai! ${job.type === 'gambar' ? '🖼️' : '🎬'} Hasil untuk job ${job.jobId}\n` +
    `Prompt: ${String(job.prompt).slice(0, 200)}`

  if (m.video) {
    await sock.sendMessage(job.waJid, { video: buf, caption })
  } else if (m.photo) {
    await sock.sendMessage(job.waJid, { image: buf, caption })
  } else {
    await sock.sendMessage(job.waJid, {
      document: buf,
      mimetype: (m.document && m.document.mime_type) || 'application/octet-stream',
      fileName: (m.document && m.document.file_name) || `${job.jobId}.bin`,
      caption,
    })
  }
  markGenJobDone(job.jobId)
  console.log(`[genres] hasil job ${job.jobId} diteruskan ke ${job.waJid}`)
}
