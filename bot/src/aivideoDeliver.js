// Watcher pengiriman hasil video AI: cek order 'done' tiap 30 detik,
// kirim file video ke WA pemesan, tandai 'delivered'.
import fs from 'fs'
import path from 'path'
import { doneAivideoOrders, updateAivideoOrder, AIVIDEO_DONE_DIR } from './aivideo.js'
import { STORE_NAME } from './brand.js'

const POLL_MS = 30_000

export function startAivideoDeliver(getSock) {
  console.log('[aivideo] delivery watcher aktif (cek tiap 30 detik)')
  setInterval(async () => {
    const sock = getSock()
    if (!sock) return
    for (const o of doneAivideoOrders()) {
      try {
        const fp = path.join(AIVIDEO_DONE_DIR, `${o.orderId}.mp4`)
        if (!fs.existsSync(fp)) continue
        await sock.sendMessage(o.buyerJid, {
          video: fs.readFileSync(fp),
          caption:
            `🎬 *Video AI kamu sudah jadi!*\n\n` +
            `📝 Prompt: ${o.prompt}\n\n` +
            `_Terima kasih sudah order di ${STORE_NAME} 🙏_`,
        })
        updateAivideoOrder(o.orderId, { status: 'delivered', deliveredAt: Date.now() })
        console.log(`[aivideo] ${o.orderId} terkirim ke ${o.buyerJid}`)
      } catch (e) {
        console.error(`[aivideo] gagal kirim ${o.orderId}:`, e.message)
      }
    }
  }, POLL_MS)
}
