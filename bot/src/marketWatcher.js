// Watcher market per-grup: tiap grup punya daftar simbol sendiri.
// Kirim HANYA saat sinyal BUY/SELL berubah untuk simbol itu di grup itu.
import { loadConfig, saveConfig, analyze, formatSignal } from './market.js'

function normGroups(c) {
  // migrasi format lama: groups: ["jid@g.us"] -> [{jid, symbols:[semua]}]
  if (c.groups.length && typeof c.groups[0] === 'string') {
    c.groups = c.groups.map((jid) => ({ jid, symbols: c.symbols.map((s) => s.ticker) }))
  }
  return c.groups
}

export function startMarketWatcher(getSock) {
  const cfg = loadConfig()
  const ms = (cfg.intervalMin || 30) * 60_000
  console.log(`[market] watcher aktif (cek tiap ${cfg.intervalMin || 30} menit)`)
  const tick = async () => {
    const sock = getSock()
    if (!sock) return
    const c = loadConfig()
    const groups = normGroups(c)
    if (!groups.length) return
    const byTicker = Object.fromEntries(c.symbols.map((s) => [s.ticker, s.label]))
    for (const g of groups) {
      if (!g.symbols?.length) continue
      for (const ticker of g.symbols) {
        try {
          const a = await analyze(ticker, byTicker[ticker])
          const lk = `${g.jid}:${ticker}`
          const prev = c.last[lk]
          const key = `${a.signal}:${a.kuat}`
          if ((!prev || prev.key !== key) && a.signal !== 'NETRAL') {
            await sock.sendMessage(g.jid, { text: formatSignal(a) }).catch(() => {})
            console.log(`[market] ${ticker} -> ${g.jid.slice(0, 12)}...: ${a.signal} (${a.kuat})`)
          }
          c.last[lk] = { key, at: Date.now() }
        } catch (e) {
          console.error(`[market] gagal ${ticker}:`, e.message)
        }
      }
    }
    saveConfig(c)
  }
  setTimeout(tick, 30_000)
  setInterval(tick, ms)
}
