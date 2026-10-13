// Perintah market — analisis teknikal instan & kelola monitor PER GRUP.
//   market [TICKER]              -> analisis instan
//   +market add TICKER [label]   -> tambah simbol ke pool (owner)
//   +market del TICKER           -> hapus simbol dari pool & semua grup (owner)
//   +market list                 -> lihat pool simbol & grup + isi pantauannya
//   +market grup                 -> daftarkan grup ini (kirim DARI dalam grup, owner)
//   +market set T1 T2 ...        -> atur simbol yg dipantau grup ini (dari dalam grup, owner)
//   +market off                  -> keluarkan grup ini dari pantauan (owner)
//   +market tiap <menit>         -> atur interval cek (owner)
import { loadConfig, saveConfig, analyze, formatSignal } from '../src/market.js'
import { isAdmin } from './produk.js'

function normGroups(c) {
  if (c.groups.length && typeof c.groups[0] === 'string') {
    c.groups = c.groups.map((jid) => ({ jid, symbols: c.symbols.map((s) => s.ticker) }))
  }
  return c.groups
}
const needGroup = (reply, isGroup) => {
  if (!isGroup) { reply('Perintah ini harus dikirim *dari dalam grup*.'); return false }
  return true
}

export default {
  name: 'market',
  alias: ['+market', 'sinyal'],
  description: 'Analisis teknikal & sinyal market per grup (XAUUSD, saham, crypto)',
  async run({ sock, chat, sender, senderNumber, text, reply, config }) {
    const args = text.trim().split(/\s+/).slice(1)
    const cfg = loadConfig()
    const groups = normGroups(cfg)
    const admin = isAdmin(config, sender, senderNumber)
    const isGroup = chat.endsWith('@g.us')
    const gIdx = groups.findIndex((g) => g.jid === chat)

    if (args[0] === 'add' && admin) {
      const ticker = (args[1] || '').toUpperCase()
      if (!ticker) return reply('Pakai: `+market add GC=F [label]`')
      const label = args.slice(2).join(' ') || ticker
      if (cfg.symbols.find((s) => s.ticker === ticker)) return reply(`${ticker} sudah ada di pool.`)
      try { await analyze(ticker, label) } catch { return reply(`Ticker ${ticker} tidak valid / data tidak tersedia.`) }
      cfg.symbols.push({ ticker, label }); saveConfig(cfg)
      return reply(`✅ ${label} (${ticker}) masuk pool.\nLalu atur ke grup: \`+market set ${ticker}\` (dari dalam grup).`)
    }
    if (args[0] === 'del' && admin) {
      const ticker = (args[1] || '').toUpperCase()
      cfg.symbols = cfg.symbols.filter((s) => s.ticker !== ticker)
      for (const g of groups) g.symbols = g.symbols.filter((t) => t !== ticker)
      saveConfig(cfg)
      return reply(`🗑️ ${ticker} dihapus dari pool & semua grup.`)
    }
    if (args[0] === 'list') {
      const syms = cfg.symbols.map((s) => `• ${s.label} (${s.ticker})`).join('\n') || '(kosong)'
      const gs = groups.map((g, i) =>
        `${i + 1}. ${(g.name || g.jid).slice(0, 30)}: ${g.symbols.join(', ') || '(belum diatur)'}`).join('\n') || '(belum ada grup)'
      return reply(`📋 *Pool simbol*\n${syms}\n\n👥 *Grup terpantau*\n${gs}\n\n⏱️ Interval: ${cfg.intervalMin} menit`)
    }
    if (args[0] === 'grup' && admin) {
      if (!needGroup(reply, isGroup)) return
      if (gIdx < 0) groups.push({ jid: chat, name: args.slice(1).join(' ') || '', symbols: [] })
      saveConfig(cfg)
      return reply('✅ Grup ini terdaftar.\nAtur pantauannya: `+market set GC=F` (bisa banyak, pisah spasi).')
    }
    if (args[0] === 'set' && admin) {
      if (!needGroup(reply, isGroup)) return
      if (gIdx < 0) return reply('Grup belum terdaftar. Kirim `+market grup` dulu.')
      const tickers = args.slice(1).map((t) => t.toUpperCase())
      const valid = tickers.filter((t) => cfg.symbols.find((s) => s.ticker === t))
      const invalid = tickers.filter((t) => !cfg.symbols.find((s) => s.ticker === t))
      groups[gIdx].symbols = valid
      saveConfig(cfg)
      let msg = `✅ Grup ini sekarang memantau: ${valid.join(', ') || '(kosong)'}`
      if (invalid.length) msg += `\n⚠️ Tidak ada di pool: ${invalid.join(', ')} (tambah via \`+market add\`)`
      return reply(msg)
    }
    if (args[0] === 'off' && admin) {
      if (!needGroup(reply, isGroup)) return
      if (gIdx >= 0) groups.splice(gIdx, 1)
      saveConfig(cfg)
      return reply('🔕 Grup ini dikeluarkan dari pantauan.')
    }
    if (args[0] === 'tiap' && admin) {
      const m = parseInt(args[1], 10)
      if (!m || m < 5) return reply('Pakai: `+market tiap 30` (minimal 5 menit). Berlaku setelah restart.')
      cfg.intervalMin = m; saveConfig(cfg)
      return reply(`⏱️ Interval cek diubah ke ${m} menit (berlaku setelah restart bot).`)
    }

    const ticker = (args[0] || cfg.symbols[0]?.ticker || 'GC=F').toUpperCase()
    const sym = cfg.symbols.find((s) => s.ticker === ticker)
    await reply(`⏳ Menganalisis ${ticker}...`)
    try {
      const a = await analyze(ticker, sym?.label)
      await reply(formatSignal(a))
    } catch (e) {
      await reply(`❌ Gagal ambil data ${ticker}: ${e.message}`)
    }
  },
}
