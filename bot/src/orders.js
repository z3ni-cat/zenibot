// Penyimpanan order di data/orders.json.
// Order dibuat saat pembeli mengetuk "Beli Sekarang", status dipantau
// oleh orderWatcher sampai paid / expired.
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const FILE = path.join(__dirname, '..', 'data', 'orders.json')

export function loadOrders() {
  try {
    const d = JSON.parse(fs.readFileSync(FILE, 'utf8'))
    return Array.isArray(d) ? d : []
  } catch {
    return []
  }
}

export function saveOrders(list) {
  fs.mkdirSync(path.dirname(FILE), { recursive: true })
  fs.writeFileSync(FILE, JSON.stringify(list, null, 2))
}

export function addOrder(order) {
  const list = loadOrders()
  list.push(order)
  saveOrders(list)
  return order
}

export function updateOrder(invoiceId, patch) {
  const list = loadOrders()
  const o = list.find((x) => x.invoiceId === invoiceId)
  if (!o) return null
  Object.assign(o, patch)
  saveOrders(list)
  return o
}

export function pendingOrders() {
  return loadOrders().filter((o) => o.status === 'pending')
}
