// Jasa Generate Video AI — sesi wizard + antrean order.
// Alur: genvideo -> prompt -> gambar referensi (opsional) -> konfirmasi -> QRIS -> antrean.
// Diproses oleh cron Fein (aivideo-processor), dikirim oleh aivideoDeliver.js.
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const SESSION_FILE = path.join(__dirname, '..', 'data', 'aivideo_session.json')
const ORDER_FILE = path.join(__dirname, '..', 'data', 'aivideo_orders.json')
const SESSION_TTL = 10 * 60_000 // 10 menit

export const AIVIDEO_PRICE = 10000 // Rp per video ±10 detik
export const AIVIDEO_DONE_DIR = path.join(__dirname, '..', 'data', 'aivideo_done')
export const AIVIDEO_REF_DIR = path.join(__dirname, '..', 'data', 'aivideo_ref')

// ---------- sesi wizard ----------
function readSessions() {
  try { return JSON.parse(fs.readFileSync(SESSION_FILE, 'utf8')) } catch { return {} }
}
function saveSessions(s) {
  fs.mkdirSync(path.dirname(SESSION_FILE), { recursive: true })
  fs.writeFileSync(SESSION_FILE, JSON.stringify(s, null, 2))
}
export function getAivideoSession(sender) {
  const all = readSessions()
  const s = all[sender]
  if (!s) return null
  if (Date.now() - s.updatedAt > SESSION_TTL) {
    delete all[sender]; saveSessions(all); return null
  }
  return s
}
export function putAivideoSession(sender, s) {
  const all = readSessions()
  all[sender] = { ...s, updatedAt: Date.now() }
  saveSessions(all)
}
export function clearAivideoSession(sender) {
  const all = readSessions()
  delete all[sender]; saveSessions(all)
}

// ---------- antrean order ----------
// status: queued -> processing -> done -> delivered
function readOrders() {
  try { return JSON.parse(fs.readFileSync(ORDER_FILE, 'utf8')) } catch { return {} }
}
function saveOrders(o) {
  fs.mkdirSync(path.dirname(ORDER_FILE), { recursive: true })
  fs.writeFileSync(ORDER_FILE, JSON.stringify(o, null, 2))
}
export function saveAivideoOrder(order) {
  const o = readOrders()
  o[order.orderId] = { status: 'queued', createdAt: Date.now(), ...order }
  saveOrders(o)
}
export function getAivideoOrder(orderId) {
  return readOrders()[orderId] || null
}
export function updateAivideoOrder(orderId, patch) {
  const o = readOrders()
  if (o[orderId]) {
    o[orderId] = { ...o[orderId], ...patch }
    saveOrders(o)
  }
}
export function queuedAivideoOrders() {
  return Object.values(readOrders()).filter((o) => o.status === 'queued')
}
export function doneAivideoOrders() {
  return Object.values(readOrders()).filter((o) => o.status === 'done')
}
export function makeAivideoOrderId() {
  return 'AV-' + Date.now().toString(36).toUpperCase() + Math.random().toString(36).slice(2, 6).toUpperCase()
}
