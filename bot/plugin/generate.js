// Plugin Generate v2 — entry: perintah "generate" / kategori AI / tombol ui:generate:*
// Alur: generate -> [🎬 Video | 🖼️ Gambar] -> prompt (+ foto referensi utk video)
//       -> [⏱️ 15 Detik | ⏱️ 30 Detik] (video saja) -> teruskan job ke Telegram
import { startGenSession, getGenSession, clearGenSession } from '../src/genSession.js'
import { sendGenIntro } from '../src/genFlow.js'
import { forwardGenJob } from '../src/genTelegram.js'

export default {
  name: 'generate',
  description: 'Fitur generate video/gambar (AI)',
  async run(ctx) {
    // DIPARKIR 2026-10-02: fitur generate belum produksi — hapus 3 baris ini untuk aktifkan lagi
    await ctx.reply('🤖 *AI Generate*\n\n_Segera hadir._\n\nFitur generate video & gambar sedang disiapkan. Tunggu kabar selanjutnya ya! ✨')
    return
    const { sender, args, reply } = ctx
    const choice = (args[0] || '').toLowerCase()

    // Pilih jenis: mulai sesi prompt
    if (choice === 'video' || choice === 'gambar') {
      const emoji = choice === 'gambar' ? '🖼️' : '🎬'
      startGenSession(sender, choice)
      const ref = choice === 'video'
        ? '\n💡 _Bisa lampirkan foto (avatar/produk/karakter/wajah) sebagai referensi video._'
        : ''
      await reply(`Berikan prompt atau jelaskan secara detail ${emoji}${ref}`)
      return
    }

    // Pilih durasi (khusus video): finalisasi + teruskan ke Telegram
    if (choice === 'dur15' || choice === 'dur30') {
      const s = getGenSession(sender)
      if (!s || s.stage !== 'duration' || s.type !== 'video') {
        await reply('Mulai dulu dengan ketik *generate* 🙂')
        return
      }
      const duration = choice === 'dur15' ? 15 : 30
      const short = s.prompt.length > 120 ? s.prompt.slice(0, 120) + '…' : s.prompt
      const refPath = s.refPath
      clearGenSession(sender)
      const jobId = await forwardGenJob({ type: 'video', prompt: s.prompt, duration, refPath, sender })
      await reply(
        `Siap! 🎬 Prompt diterima: "${short}".\n` +
        `🎞️ Referensi: ${refPath ? 'ada ✅' : 'tidak ada'}\n` +
        `⏱️ Durasi: ${duration} detik\n` +
        (jobId ? `📨 Job ${jobId} diteruskan.` : `_Fitur generate segera hadir — API belum dipasang._`)
      )
      return
    }

    // Langkah awal: penjelasan + tombol
    return sendGenIntro(ctx)
  },
}
