// Plugin Minyak — kelola stok & penjualan minyak goreng (owner only).
//   minyak            -> buka sesi terpandu (PO / jual / laporan)
//   laku 3 carton     -> catat penjualan langsung (atau: laku 10 pouch)
//   stokminyak        -> lihat sisa stok
//   laporanminyak     -> laporan lengkap
import {
  startMinyakSession, buildMenu, buildReport,
  getTotals, fmtStock, recordSale, isMinyakAdmin,
} from '../src/minyak.js'
import { formatRupiah } from '../src/utils.js'

export default {
  name: 'minyak',
  ownerOnly: true,
  alias: ['laku', 'stokminyak', 'laporanminyak'],
  description: 'kelola stok & penjualan minyak goreng (owner)',
  async run({ command, args, text, sender, senderNumber, reply, config }) {
    if (!isMinyakAdmin(config, sender, senderNumber)) {
      await reply('⛔ Khusus owner.')
      return
    }
    const cmd = command.toLowerCase()
    if (cmd === 'stokminyak') {
      await reply(`📦 *Stok minyak:* ${fmtStock(getTotals().sisa)}`)
      return
    }
    if (cmd === 'laporanminyak') {
      await reply(buildReport())
      return
    }
    if (cmd === 'laku') {
      // laku 3 carton | laku 10 pouch
      const rest = text.slice(cmd.length).trim().toLowerCase()
      const m = rest.match(/^(\d+)\s*(carton|karton|dus|crt|pouch|pch|pcs|bks|bungkus)$/)
      if (!m) {
        await reply('Format: `laku <jumlah> carton` atau `laku <jumlah> pouch`\nCth: `laku 3 carton`')
        return
      }
      const n = parseInt(m[1], 10)
      const isCarton = ['carton', 'karton', 'dus', 'crt'].includes(m[2])
      const res = recordSale(isCarton ? n : 0, isCarton ? 0 : n)
      if (res.error) {
        await reply('⚠️ ' + res.error)
        return
      }
      const label = isCarton ? `${n} carton` : `${n} pouch`
      await reply(
        `✅ *Tercatat:* laku ${label}\n` +
        `💵 Omzet +${formatRupiah(res.revenue)} | 📈 Untung +${formatRupiah(res.profit)}\n` +
        `📦 Sisa: ${fmtStock(res.sisa)}`
      )
      return
    }
    // minyak -> sesi terpandu
    startMinyakSession(sender)
    await reply(buildMenu())
  },
}
