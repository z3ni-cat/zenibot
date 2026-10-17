// Plugin linkme — kirim link wa.me bot dengan pesan pre-filled
import { BOT_NAME, STORE_NAME } from '../src/brand.js'

export default {
  name: "linkme",
  alias: ["link", "share", "bagikan"],
  description: "Dapatkan link share bot WhatsApp",
  async run({ reply, config }) {
    const num = (config?.botNumber || '').replace(/[^0-9]/g, '')
    const link = `https://wa.me/${num}?text=menu`
    await reply(
      `\u{1F517} *Link Bot ${BOT_NAME}*\n\n${link}\n\n` +
      `Klik link di atas untuk buka chat dengan pesan "menu" yang sudah terisi otomatis \u2014 tinggal tekan kirim! \u{1F4F2}\n\n` +
      `Bagikan ke temanmu biar mereka juga bisa belanja di ${STORE_NAME} \u{1F6CD}\uFE0F`
    )
  },
}
