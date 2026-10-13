// Market monitor: ambil data Yahoo Finance + indikator teknikal + sinyal.
// Tanpa dependensi. Simbol default: XAUUSD=X (emas spot).
import https from 'https'
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const CFG = path.join(__dirname, '..', 'data', 'market.json')

export function loadConfig() {
  try {
    return JSON.parse(fs.readFileSync(CFG, 'utf8'))
  } catch {
    return { symbols: [{ ticker: 'GC=F', label: 'XAUUSD — Emas' }], groups: [], intervalMin: 30, last: {} }
  }
}
export function saveConfig(c) {
  fs.mkdirSync(path.dirname(CFG), { recursive: true })
  fs.writeFileSync(CFG, JSON.stringify(c, null, 2))
}

// ---------- fetch ----------
function getJSON(url) {
  return new Promise((resolve, reject) => {
    const req = https.get(url, { headers: { 'User-Agent': 'Mozilla/5.0' } }, (res) => {
      let d = ''
      res.on('data', (c) => (d += c))
      res.on('end', () => {
        try { resolve(JSON.parse(d)) } catch (e) { reject(new Error('respon bukan JSON')) }
      })
    })
    req.on('error', reject)
    req.setTimeout(20000, () => { req.destroy(); reject(new Error('timeout')) })
  })
}

export async function fetchKlines(ticker) {
  const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(ticker)}?interval=1h&range=3mo`
  const j = await getJSON(url)
  const r = j?.chart?.result?.[0]
  if (!r) throw new Error('data kosong')
  const q = r.indicators.quote[0]
  const out = []
  for (let i = 0; i < r.timestamp.length; i++) {
    if (q.close[i] == null) continue
    out.push({ t: r.timestamp[i], o: q.open[i], h: q.high[i], l: q.low[i], c: q.close[i] })
  }
  if (out.length < 60) throw new Error('data kurang')
  return out
}

// ---------- indikator ----------
const ema = (arr, p) => {
  const k = 2 / (p + 1); let e = arr[0]; const out = [e]
  for (let i = 1; i < arr.length; i++) { e = arr[i] * k + e * (1 - k); out.push(e) }
  return out
}
const sma = (arr, p) => arr.map((_, i) => i < p - 1 ? null : arr.slice(i - p + 1, i + 1).reduce((a, b) => a + b, 0) / p)

function rsi(closes, p = 14) {
  let g = 0, l = 0
  for (let i = 1; i <= p; i++) {
    const d = closes[i] - closes[i - 1]
    if (d > 0) g += d; else l -= d
  }
  g /= p; l /= p
  const out = []
  for (let i = p; i < closes.length; i++) {
    const d = closes[i] - closes[i - 1]
    g = (g * (p - 1) + Math.max(d, 0)) / p
    l = (l * (p - 1) + Math.max(-d, 0)) / p
    out.push(l === 0 ? 100 : 100 - 100 / (1 + g / l))
  }
  return out
}

function macd(closes) {
  const e12 = ema(closes, 12), e26 = ema(closes, 26)
  const line = closes.map((_, i) => e12[i] - e26[i])
  const signal = ema(line.slice(25), 9)
  const off = 25
  return line.map((v, i) => i < off ? null : ({ macd: v, signal: signal[i - off], hist: v - signal[i - off] }))
}

function bollinger(closes, p = 20, m = 2) {
  return closes.map((_, i) => {
    if (i < p - 1) return null
    const s = closes.slice(i - p + 1, i + 1)
    const mid = s.reduce((a, b) => a + b, 0) / p
    const sd = Math.sqrt(s.reduce((a, b) => a + (b - mid) ** 2, 0) / p)
    return { mid, up: mid + m * sd, lo: mid - m * sd }
  })
}

function atr(kl, p = 14) {
  const trs = kl.map((k, i) => i === 0 ? k.h - k.l :
    Math.max(k.h - k.l, Math.abs(k.h - kl[i - 1].c), Math.abs(k.l - kl[i - 1].c)))
  return sma(trs, p)
}

// ---------- analisis ----------
const fmt = (n, d = 2) => n.toLocaleString('en-US', { minimumFractionDigits: d, maximumFractionDigits: d })

export async function analyze(ticker, label) {
  const kl = await fetchKlines(ticker)
  const closes = kl.map((k) => k.c)
  const price = closes[closes.length - 1]
  const prev = closes[closes.length - 25] ?? closes[0]
  const chg = ((price - prev) / prev) * 100

  const r = rsi(closes), m = macd(closes), b = bollinger(closes), a = atr(kl)
  const e50 = ema(closes, 50)
  const i = closes.length - 1
  const rsiV = r[r.length - 1], rsiPrev = r[r.length - 2]
  const mac = m[i], macPrev = m[i - 1]
  const bb = b[i], atrV = a[i], ema50 = e50[i]

  let score = 0
  const reasons = []

  // RSI
  let rsiTxt
  if (rsiV > 70) { score -= 2; rsiTxt = 'overbought (jenuh beli)'; reasons.push('RSI di atas 70 — jenuh beli, rawan koreksi') }
  else if (rsiV < 30) { score += 2; rsiTxt = 'oversold (jenuh jual)'; reasons.push('RSI di bawah 30 — jenuh jual, potensi rebound') }
  else if (rsiV > 55 && rsiV > rsiPrev) { score += 1; rsiTxt = 'menguat'; reasons.push(`RSI ${fmt(rsiV, 1)} menanjak — momentum beli bertambah`) }
  else if (rsiV < 45 && rsiV < rsiPrev) { score -= 1; rsiTxt = 'melemah'; reasons.push(`RSI ${fmt(rsiV, 1)} menurun — momentum jual bertambah`) }
  else { rsiTxt = 'netral' }

  // MACD
  let macdTxt
  const crossUp = macPrev && mac.hist > 0 && macPrev.hist <= 0
  const crossDn = macPrev && mac.hist < 0 && macPrev.hist >= 0
  if (crossUp) { score += 2; macdTxt = '🟢 bullish crossover'; reasons.push('MACD baru crossover bullish — momentum berbalik naik') }
  else if (crossDn) { score -= 2; macdTxt = '🔴 bearish crossover'; reasons.push('MACD baru crossover bearish — momentum berbalik turun') }
  else if (mac.hist > 0) { score += 1; macdTxt = 'bullish'; }
  else { score -= 1; macdTxt = 'bearish'; }

  // Tren EMA50
  let emaTxt
  if (price > ema50) { score += 1; emaTxt = 'di atas EMA50 (uptrend)' }
  else { score -= 1; emaTxt = 'di bawah EMA50 (downtrend)' }

  // Bollinger
  let bbTxt = 'di dalam band'
  const pos = (price - bb.lo) / (bb.up - bb.lo)
  if (pos > 0.85) { score -= 1; bbTxt = 'dekat upper band (mahal)' }
  else if (pos < 0.15) { score += 1; bbTxt = 'dekat lower band (murah)' }

  let signal = 'NETRAL', emoji = '⚪'
  if (score >= 3) { signal = 'BUY'; emoji = '🟢' }
  else if (score <= -3) { signal = 'SELL'; emoji = '🔴' }
  const kuat = Math.abs(score) >= 5 ? 'sangat kuat' : Math.abs(score) >= 3 ? 'kuat' : 'lemah'

  // Entry / SL / TP berbasis ATR
  const dir = signal === 'BUY' ? 1 : signal === 'SELL' ? -1 : 0
  let plan = null
  if (dir !== 0) {
    plan = {
      entry: [price - 0.25 * atrV * dir, price],
      sl: price - 1.5 * atrV * dir,
      tp: price + 2 * atrV * dir,
    }
  }
  if (!reasons.length) reasons.push('Belum ada pemicu teknikal yang jelas — tunggu konfirmasi')

  return { ticker, label: label || ticker, price, chg, rsi: rsiV, rsiTxt, macdTxt, emaTxt, bbTxt, signal, emoji, kuat, score, plan, reasons, atr: atrV }
}

export function formatSignal(a) {
  const L = []
  L.push(`📊 *${a.label}*`)
  L.push(`💰 *$${fmt(a.price)}* (${a.chg >= 0 ? '+' : ''}${fmt(a.chg)}% 24j)`)
  L.push('')
  L.push('📈 *Indikator*')
  L.push(`• RSI(14): ${fmt(a.rsi, 1)} — ${a.rsiTxt}`)
  L.push(`• MACD: ${a.macdTxt}`)
  L.push(`• Tren: harga ${a.emaTxt}`)
  L.push(`• Bollinger: ${a.bbTxt}`)
  L.push('')
  L.push(`🎯 *Sinyal: ${a.emoji} ${a.signal}* (${a.kuat})`)
  if (a.plan) {
    const lo = Math.min(...a.plan.entry), hi = Math.max(...a.plan.entry)
    L.push(`• Entry: $${fmt(lo)} – $${fmt(hi)}`)
    L.push(`• Stop Loss: $${fmt(a.plan.sl)}`)
    L.push(`• Take Profit: $${fmt(a.plan.tp)}`)
  }
  L.push('')
  L.push('📝 *Alasan entry:*')
  a.reasons.forEach((r, i) => L.push(`${i + 1}. ${r}`))
  L.push('')
  L.push('⚠️ _Sinyal teknikal otomatis, bukan saran finansial. DYOR._')
  return L.join('\n')
}
