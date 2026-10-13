// chantest — tes posting ke WhatsApp Channel. KHUSUS owner.
import { isAdmin } from './produk.js'
import { BOT_NAME } from '../src/brand.js'

export default {
  name: 'chantest',
  ownerOnly: true,
  description: 'Tes posting ke WhatsApp Channel (khusus owner)',
  async run({ sock, sender, senderNumber, config, reply, args }) {
    if (!isAdmin(config, sender, senderNumber)) {
      return reply('❌ _Perintah ini khusus owner._')
    }
    const code = (args[0] || '').trim().replace(/.*channel\//, '')
    if (!code) {
      return reply('📢 _Kirim kode invite channel._\nContoh: *chantest 0029Vb6RMRYEVccJrpFL6O13*')
    }
    const out = []
    try {
      await reply('⏳ _Menghubungi channel…_')
      const meta = await sock.newsletterMetadata('invite', code)
      const jid = meta.id
      out.push(`✅ Channel ketemu: *${meta.name || '(tanpa nama)'}*`)
      try {
        await sock.newsletterFollow(jid)
        out.push('✅ Bot berhasil *join/follow* channel.')
      } catch (eF) {
        out.push(`⚠️ Gagal follow: ${eF.message || eF}`)
      }
      try {
        await sock.sendMessage(jid, { text: '🔧 Tes auto-post dari ' + BOT_NAME + ' — abaikan pesan ini.' })
        out.push('✅ *Pesan tes TERKIRIM ke channel!* Berarti bot bisa auto-post.')
      } catch (e2) {
        out.push(`⚠️ Pesan tes GAGAL terkirim: ${e2.message || e2}\n_Kemungkinan nomor bot belum jadi admin channel._`)
      }
    } catch (e) {
      console.error('[chantest]', e.message || e)
      out.push(`❌ Gagal: ${e.message || e}`)
    }
    return reply(out.join('\n\n'))
  },
}
