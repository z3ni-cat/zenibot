// Alur Generate v2 — entry point kategori AI & perintah generate
import { sendButtons } from './buttons.js'
import { BOT_NAME } from './brand.js'

export const GEN_CAT = 'ai'

export async function sendGenIntro(ctx) {
  const { sock, chat, msg } = ctx
  await sendButtons(
    sock,
    chat,
    {
      body: '🤖 *Generate AI*\n\n_Buat video atau gambar dari deskripsimu._\n\n_Pilih jenis yang ingin dibuat:_',
      footer: BOT_NAME,
      buttons: [
        { id: 'ui:generate:video', text: '🎬 Video' },
        { id: 'ui:generate:gambar', text: '🖼️ Gambar' },
      ],
    },
    { quoted: msg }
  )
}

export async function startGenFlow(ctx) {
  return sendGenIntro(ctx)
}
