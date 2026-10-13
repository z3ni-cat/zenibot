// Pesan promo otomatis ke owner (hanya edisi Lite).
// Mengingatkan pemilik bot soal upgrade ke Full Version tiap N jam.
import { isPremium, PROMO_EVERY_HOURS, promoText } from './license.js'

const ownerJid = (o) => {
  const s = String(o || '').trim()
  if (!s) return null
  if (s.includes('@')) return s
  return `${s.replace(/[^0-9]/g, '')}@s.whatsapp.net`
}

export function startPromo(getSock, config) {
  if (isPremium() || !PROMO_EVERY_HOURS || PROMO_EVERY_HOURS <= 0) return
  const ms = PROMO_EVERY_HOURS * 3600_000
  console.log(`[promo] pesan promo Lite aktif tiap ${PROMO_EVERY_HOURS} jam`)
  const send = async () => {
    try {
      const sock = getSock()
      if (!sock) return
      const targets = (config.owner || []).map(ownerJid).filter(Boolean)
      for (const jid of targets) {
        await sock.sendMessage(jid, { text: promoText() })
      }
    } catch (e) {
      console.log('[promo] gagal:', e.message)
    }
  }
  // kirim pertama setelah 1 jam (beri napas setelah start), lalu tiap interval
  setTimeout(() => { send(); setInterval(send, ms) }, 3600_000)
}
