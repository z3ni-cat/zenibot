// Sesi input tools gratis: setelah user memilih tool, pesan berikutnya
// dianggap sebagai input untuk tool tersebut. Kedaluwarsa 10 menit.
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const FILE = path.join(__dirname, '..', 'data', 'toolsession.json')
const TTL = 10 * 60 * 1000

function load() {
  try { return JSON.parse(fs.readFileSync(FILE, 'utf8')) } catch { return {} }
}
function save(o) {
  fs.mkdirSync(path.dirname(FILE), { recursive: true })
  fs.writeFileSync(FILE, JSON.stringify(o, null, 2))
}

export function startToolSession(sender, toolId) {
  const s = load()
  s[sender] = { toolId, createdAt: Date.now() }
  save(s)
}
export function getToolSession(sender) {
  const s = load()[sender]
  if (!s) return null
  if (Date.now() - s.createdAt > TTL) {
    clearToolSession(sender)
    return null
  }
  return s
}
export function updateToolSession(sender, patch) {
  const s = load()
  if (!s[sender]) return
  s[sender] = { ...s[sender], ...patch }
  save(s)
}
export function clearToolSession(sender) {
  const s = load()
  delete s[sender]
  save(s)
}
