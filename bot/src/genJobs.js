// Penyimpanan job Generate: jobId <-> WA pemesan <-> message ID job card di Telegram
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const FILE = path.join(__dirname, '..', 'data', 'genjobs.json')
const TTL = 24 * 60 * 60 * 1000 // job kedaluwarsa 24 jam

function load() {
  try { return JSON.parse(fs.readFileSync(FILE, 'utf8')) } catch { return {} }
}
function save(o) {
  fs.mkdirSync(path.dirname(FILE), { recursive: true })
  fs.writeFileSync(FILE, JSON.stringify(o, null, 2))
}

export function saveGenJob(job) {
  const s = load()
  s[job.jobId] = { status: 'pending', createdAt: Date.now(), ...job }
  save(s)
}
export function getGenJob(jobId) {
  return load()[jobId] || null
}
// Korelasi A: hasil dikirim sebagai reply ke pesan job card
export function findJobByTgMessageId(tgMessageId) {
  const vals = Object.values(load())
  return vals.find((j) => j.tgMessageId === tgMessageId && j.status === 'pending') || null
}
export function markGenJobDone(jobId) {
  const s = load()
  if (s[jobId]) {
    s[jobId].status = 'done'
    s[jobId].doneAt = Date.now()
    save(s)
  }
}
export function sweepGenJobs() {
  const s = load()
  const now = Date.now()
  let n = 0
  for (const [k, v] of Object.entries(s)) {
    if (now - (v.createdAt || 0) > TTL) {
      delete s[k]
      n++
    }
  }
  if (n) save(s)
}
