// Layanan SMM via djuragansosmed.com — API client, pricing, dan katalog.
// Diadaptasi dari lib/djuragan.js Neoxr ke gaya ZeniCat (ESM).
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const CATALOG_FILE = path.join(__dirname, '..', 'data', 'smm_catalog.json')

const API_URL = 'https://djuragansosmed.com/api/v2'

export const SMM_CAT = 'smm-panel'
export const SMM_GROUPS = ['TikTok', 'Instagram', 'WhatsApp', 'Telegram']
export const SMM_GROUP_EMOJI = { TikTok: '🎵', Instagram: '📸', WhatsApp: '💬', Telegram: '📩' }
const TOP_PER_GROUP = 10

function apiKey() {
  return String(process.env.DJURAGAN_API_KEY || '').trim()
}
export function smmConfigured() {
  return Boolean(apiKey())
}

// Untung flat per transaksi (IDR), bukan persen. Default Rp4.500 -> profit tiap order +/- Rp4-5rb.
const flatProfit = () => Math.max(0, Number(process.env.DJURAGAN_PROFIT || 4500))
const roundTo = () => Math.max(1, Number(process.env.DJURAGAN_PRICE_ROUND || 1000))

async function call(params) {
  if (!smmConfigured()) throw new Error('DJURAGAN_API_KEY belum dikonfigurasi.')
  const body = new URLSearchParams({ key: apiKey(), ...params })
  const res = await fetch(API_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body,
  })
  const data = await res.json().catch(() => ({}))
  if (!res.ok || data?.error) throw new Error(String(data?.error || `Provider HTTP ${res.status}`))
  return data
}

export const getBalance = () => call({ action: 'balance' })
export const createProviderOrder = (serviceId, link, quantity) =>
  call({ action: 'add', service: String(serviceId), link: String(link), quantity: String(quantity) })
export const providerOrderStatus = (orderId) => call({ action: 'status', order: String(orderId) })

// ---------- pricing ----------
// rate provider dalam IDR per 1000.
// Harga jual = modal provider + untung flat per transaksi -> profit tiap order +/- Rp4-5rb.
export function quote(service, qty) {
  const q = Number(qty)
  if (!service || !Number.isInteger(q) || q < service.min || q > service.max) return null
  const cost = Number(service.rate) * q / 1000
  const amount = Math.ceil((cost + flatProfit()) / roundTo()) * roundTo()
  return { quantity: q, providerCost: Math.ceil(cost), amount, profit: amount - Math.ceil(cost) }
}

// Harga "mulai dari" untuk katalog = total termurah (qty = min).
export function priceMin(rate, min) {
  const cost = Number(rate) * Number(min) / 1000
  return Math.ceil((cost + flatProfit()) / roundTo()) * roundTo()
}

// ---------- katalog ----------
function groupFor(s) {
  const v = `${s.category || ''} ${s.name || ''}`.toLowerCase()
  if (/tiktok|tik tok/.test(v)) return 'TikTok'
  if (/instagram|insta\b/.test(v)) return 'Instagram'
  if (/whatsapp|\bwa\b/.test(v)) return 'WhatsApp'
  if (/telegram/.test(v)) return 'Telegram'
  return null
}

export function readCatalog() {
  try {
    const c = JSON.parse(fs.readFileSync(CATALOG_FILE, 'utf8'))
    if (c && c.groups) return c
  } catch {}
  return { groups: Object.fromEntries(SMM_GROUPS.map((g) => [g, []])), syncedAt: null }
}

export function getService(id) {
  const c = readCatalog()
  const needle = String(id || '').trim().toLowerCase()
  for (const g of SMM_GROUPS) {
    const found = (c.groups[g] || []).find((s) => s.id === needle)
    if (found) return found
  }
  return null
}

export function catalogCount() {
  const c = readCatalog()
  return SMM_GROUPS.reduce((n, g) => n + (c.groups[g] || []).length, 0)
}

// Tarik daftar services dari provider, pilih TOP_PER_GROUP termurah per grup.
export async function syncCatalog() {
  const services = await call({ action: 'services' })
  if (!Array.isArray(services)) throw new Error('Respons services provider tidak valid.')
  const groups = Object.fromEntries(SMM_GROUPS.map((g) => [g, []]))
  for (const s of services) {
    const g = groupFor(s)
    if (!g || !Number(s.service) || !Number(s.rate)) continue
    groups[g].push({
      id: `djs-${g.toLowerCase()}-${s.service}`,
      providerService: Number(s.service),
      group: g,
      name: String(s.name || `Service ${s.service}`).trim(),
      rate: Number(s.rate),
      min: Number(s.min || 1),
      max: Number(s.max || 1000000),
      refill: Boolean(s.refill),
      cancel: Boolean(s.cancel),
    })
  }
  const counts = {}
  for (const g of SMM_GROUPS) {
    groups[g].sort((a, b) => a.rate - b.rate)
    groups[g] = groups[g].slice(0, TOP_PER_GROUP).map((s) => ({
      ...s,
      priceMin: priceMin(s.rate, s.min),
    }))
    counts[g] = groups[g].length
  }
  const catalog = { syncedAt: new Date().toISOString(), groups }
  fs.writeFileSync(CATALOG_FILE, JSON.stringify(catalog, null, 2) + '\n')
  return { counts, total: counts.TikTok + counts.Instagram + counts.WhatsApp + counts.Telegram }
}
