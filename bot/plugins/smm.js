// Plugin SMM — browser katalog + order + perintah owner & cek status.
// Button id: ui:smm | ui:smm:cat:<Group> | ui:smm:svc:<id> | ui:smm:buy:<id>
//   | ui:smm:confirm | ui:smm:cancel
// Perintah: smm | +syncsmm | +smmbalance | cekorder <order_id>
import {
  startSmmFlow, sendSmmGroup, sendSmmDetail, startSmmOrder,
} from '../src/smmFlow.js'
import {
  syncCatalog, getBalance, providerOrderStatus, smmConfigured,
  SMM_GROUPS, SMM_GROUP_EMOJI,
} from '../src/smm.js'
import { formatRupiah } from '../src/utils.js'
import { isPremium, upsellText } from '../src/license.js'
function isAdmin(config, sender, senderNumber) {
  const owners = config.owner || []
  return owners.some((o) => {
    const clean = String(o).replace(/[^0-9]/g, '')
    return sender === o || senderNumber === clean
  })
}

export default {
  name: 'smm',
  alias: ['+syncsmm', '+smmbalance', 'cekorder'],
  description: 'Layanan SMM (followers/likes/views)',
  async run(ctx) {
    const { command, args, reply, sender, senderNumber, config } = ctx
    if (!isPremium()) return reply(upsellText('SMM panel'))
    const owner = isAdmin(config, sender, senderNumber)

    if (command === '+syncsmm') {
      if (!owner) return reply('❌ _Perintah ini khusus admin._')
      if (!smmConfigured()) return reply('❌ API SMM belum dikonfigurasi.')
      await reply('⏳ _Menyinkronkan katalog dari provider..._')
      try {
        const r = await syncCatalog()
        const lines = SMM_GROUPS.map((g) => `${SMM_GROUP_EMOJI[g]} ${g}: ${r.counts[g] || 0} layanan`).join('\n')
        return reply(
          `✅ *Katalog SMM diperbarui*\n\n` + lines + `\n\n` +
          `Harga jual = rate provider + margin 40%.`
        )
      } catch (e) {
        console.error('[smm] sync gagal:', e.message)
        return reply('❌ Gagal mengambil katalog provider. Cek API key / koneksi.')
      }
    }

    if (command === '+smmbalance') {
      if (!owner) return reply('❌ _Perintah ini khusus admin._')
      if (!smmConfigured()) return reply('❌ API SMM belum dikonfigurasi.')
      try {
        const b = await getBalance()
        return reply(`💳 *Saldo provider SMM:* ${b.balance} ${b.currency || ''}`)
      } catch (e) {
        console.error('[smm] balance gagal:', e.message)
        return reply('❌ Gagal mengecek saldo provider.')
      }
    }

    if (command === 'cekorder') {
      const id = String(args[0] || '').trim()
      if (!id) return reply('Format: `cekorder <id order provider>`\n\nID order provider dikirim otomatis setelah pembayaran lunas.')
      if (!smmConfigured()) return reply('❌ API SMM belum dikonfigurasi.')
      try {
        const st = await providerOrderStatus(id)
        return reply(
          `📦 *Status order SMM*\n\n` +
          `Order: ${id}\n` +
          `Status: *${st.status || '-'}*\n` +
          `Sisa: ${st.remains ?? '-'}\n` +
          `Mulai: ${st.start_count ?? '-'}`
        )
      } catch (e) {
        console.error('[smm] status gagal:', e.message)
        return reply('❌ Status belum bisa diambil. Pastikan ID order benar.')
      }
    }

    // Browser (command 'smm')
    const sub = (args[0] || '').toLowerCase()
    if (sub === 'cat') return sendSmmGroup(ctx, args[1])
    if (sub === 'svc') return sendSmmDetail(ctx, args[1])
    if (sub === 'buy') return startSmmOrder(ctx, args[1])
    if (sub === 'confirm' || sub === 'cancel') {
      // Ditangani hook sesi wizard di handler.js; kalau sampai sini berarti sesi habis.
      return reply('_Sesi pesanan sudah berakhir. Mulai lagi dari menu SMM ya 🙏_')
    }
    return startSmmFlow(ctx)
  },
}
