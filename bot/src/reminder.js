// Reminder pribadi — pengingat via WhatsApp.
// Data: data/reminders.json (persist, tahan restart).
// Watcher: cek tiap 30 detik, kirim yang jatuh tempo ke chat asal.
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const DATA_FILE = path.join(__dirname, '..', 'data', 'reminders.json')
const POLL_MS = 30_000
const MAX_PER_USER = 20
const STALE_MS = 24 * 3600_000 // pengingat yang terlewat >24 jam dianggap basi

function load() {
  try {
    const a = JSON.parse(fs.readFileSync(DATA_FILE, 'utf8'))
    return Array.isArray(a) ? a : []
  } catch { return [] }
}
function save(a) {
  fs.mkdirSync(path.dirname(DATA_FILE), { recursive: true })
  fs.writeFileSync(DATA_FILE, JSON.stringify(a, null, 2))
}

// Parse spesifikasi waktu (WIB) -> timestamp ms, atau null kalau tidak valid.
// Format: "10m" (10 menit), "2j" (2 jam), "07:00" (hari ini/besok), "besok 07:00"
export function parseReminderTime(spec) {
  const s = String(spec || '').trim().toLowerCase()
  const now = Date.now()
  let m
  if ((m = s.match(/^(\d+)\s*(m|mnt|menit)$/))) return now + parseInt(m[1], 10) * 60_000
  if ((m = s.match(/^(\d+)\s*(j|jam|h)$/))) return now + parseInt(m[1], 10) * 3600_000
  if ((m = s.match(/^(besok\s+)?(\d{1,2})[:.](\d{2})$/))) {
    const besok = !!m[1]
    const hh = parseInt(m[2], 10), mm = parseInt(m[3], 10)
    if (hh > 23 || mm > 59) return null
    const wib = new Date(now + 7 * 3600_000) // geser ke WIB, baca via UTC
    let target = Date.UTC(
      wib.getUTCFullYear(), wib.getUTCMonth(), wib.getUTCDate() + (besok ? 1 : 0), hh, mm
    ) - 7 * 3600_000
    if (!besok && target <= now) target += 24 * 3600_000
    return target
  }
  return null
}

export function addReminder({ sender, chat, text, at }) {
  const all = load()
  const mine = all.filter((r) => r.sender === sender)
  if (mine.length >= MAX_PER_USER) return { error: `Maksimal ${MAX_PER_USER} pengingat aktif.` }
  const id = Date.now().toString(36) + Math.floor(Math.random() * 1e4).toString(36)
  all.push({ id, sender, chat, text, at, createdAt: Date.now() })
  save(all)
  return { id }
}

export function listReminders(sender) {
  return load().filter((r) => r.sender === sender).sort((a, b) => a.at - b.at)
}

export function deleteReminder(sender, idx) {
  const mine = listReminders(sender)
  const target = mine[idx - 1]
  if (!target) return null
  save(load().filter((r) => r.id !== target.id))
  return target
}

export function startReminderWatcher(getSock) {
  console.log('[reminder] watcher pengingat aktif (cek tiap 30 detik)')
  // Bersihkan yang basi saat start
  const now0 = Date.now()
  const fresh = load().filter((r) => now0 - r.at < STALE_MS)
  if (fresh.length !== load().length) save(fresh)
  setInterval(async () => {
    const sock = getSock()
    if (!sock) return
    try {
      const now = Date.now()
      const all = load()
      const due = all.filter((r) => r.at <= now)
      if (!due.length) return
      for (const r of due) {
        try {
          await sock.sendMessage(r.chat, {
            text: `⏰ *Pengingat*\n\n${r.text}`,
          })
        } catch (e) {
          console.error('[reminder] gagal kirim:', e.message)
        }
      }
      save(all.filter((r) => r.at > now))
    } catch (e) {
      console.error('[reminder] watcher error:', e.message)
    }
  }, POLL_MS)
}
