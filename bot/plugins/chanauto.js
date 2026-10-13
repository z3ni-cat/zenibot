// chanauto — atur auto-post update GitHub ke WhatsApp Channel. KHUSUS owner.
import { isAdmin } from './produk.js'
import { loadChannelConfig, saveChannelConfig } from '../src/channelAutoPost.js'
import { BOT_NAME } from '../src/brand.js'
import { isPremium, upsellText } from '../src/license.js'

export default {
  name: 'chanauto',
  ownerOnly: true,
  description: 'Auto-post update GitHub ke WA Channel (khusus owner)',
  async run({ sock, sender, senderNumber, config, reply, args }) {
    if (!isAdmin(config, sender, senderNumber)) {
      return reply('❌ _Perintah ini khusus owner._')
    }
    if (!isPremium()) return reply(upsellText('Auto-post GitHub ke WA Channel'))
    const sub = (args[0] || '').toLowerCase()
    const c = loadChannelConfig()

    if (sub === 'on' || sub === 'off') {
      if (!c.channelJid) return reply('⚠️ _Channel belum diset. Pakai_ *chanauto set <kode-invite>* _dulu._')
      c.enabled = sub === 'on'
      saveChannelConfig(c)
      return reply(c.enabled ? '✅ _Auto-post channel *AKTIF*._' : '⏸️ _Auto-post channel *MATI*._')
    }

    if (sub === 'status' || !sub) {
      return reply(
        `📢 *Auto-post Channel*\n` +
        `Status: ${c.enabled ? '✅ AKTIF' : '⏸️ MATI'}\n` +
        `Channel: ${c.channelName || '-'}\n` +
        `🎵 ZeniMusic: ${c.zenimusic?.lastVersion ? 'v' + c.zenimusic.lastVersion : '-'}\n` +
        `🤖 ${BOT_NAME}: ${c.zenicat?.lastSha ? c.zenicat.lastSha.slice(0, 7) : '-'} (${c.zenicat?.enabled ? 'pantau ON' : 'pantau OFF'})\n\n` +
        `Perintah:\n` +
        `• *chanauto set <kode>* — hubungkan channel\n` +
        `• *chanauto on/off* — nyala/matikan\n` +
        `• *chanauto status* — lihat status`
      )
    }

    if (sub === 'set') {
      const code = (args[1] || '').trim().replace(/.*channel\//, '')
      if (!code) return reply('📢 _Kirim kode invite channel._\nContoh: *chanauto set 0029Vb6RMRYEVccJrpFL6O13*')
      await reply('⏳ _Menghubungi channel…_')
      try {
        const meta = await sock.newsletterMetadata('invite', code)
        await sock.newsletterFollow(meta.id).catch(() => {})
        c.channelJid = meta.id
        c.channelName = meta.name || '(tanpa nama)'
        c.enabled = true
        saveChannelConfig(c)
        return reply(`✅ _Channel terhubung: *${c.channelName}*_\n✅ _Auto-post *AKTIF* — tiap ada rilis baru di GitHub, changelog otomatis terkirim ke channel._`)
      } catch (e) {
        console.error('[chanauto]', e.message || e)
        return reply(`❌ _Gagal menghubungkan channel: ${e.message || e}_`)
      }
    }

    return reply('❓ _Perintah tidak dikenal. Ketik_ *chanauto* _untuk bantuan._')
  },
}
