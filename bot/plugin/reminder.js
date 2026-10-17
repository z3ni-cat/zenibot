// Plugin Reminder — pengingat pribadi via WhatsApp.
//   ingatin <waktu> <pesan>  -> pasang pengingat
//     waktu: 10m | 2j | 07:00 | besok 07:00   (WIB)
//     cth: ingatin 10m minum obat | ingatin besok 07:00 bangun
//   reminder / pengingat        -> daftar pengingat aktif
//   hapusreminder <nomor>       -> batalkan pengingat
import { parseReminderTime, addReminder, listReminders, deleteReminder } from '../src/reminder.js'
import { formatWib } from '../src/utils.js'

const HELP = `⏰ *Pengingat Pribadi*

\`ingatin <waktu> <pesan>\` — pasang pengingat
  • \`ingatin 10m minum obat\` (10 menit lagi)
  • \`ingatin 2j cek oven\` (2 jam lagi)
  • \`ingatin 07:00 bangun\` (jam 7 pagi WIB)
  • \`ingatin besok 09:00 rapat\` (besok jam 9)

\`reminder\` — daftar pengingat aktif
\`hapusreminder <nomor>\` — batalkan pengingat`

export default {
  name: 'ingatin',
  alias: ['reminder', 'pengingat', 'ingat', 'hapusreminder', 'batalreminder'],
  description: 'pasang pengingat pribadi',
  async run({ command, args, text, sender, chat, reply }) {
    const cmd = command.toLowerCase()
    if (cmd === 'reminder' || cmd === 'pengingat' || cmd === 'ingat') {
      const mine = listReminders(sender)
      if (!mine.length) {
        await reply('📭 Belum ada pengingat aktif.\n\n' + HELP)
        return
      }
      const lines = ['⏰ *Pengingat Aktif*\n']
      mine.forEach((r, i) => lines.push(`${i + 1}. ${formatWib(new Date(r.at))}\n   ${r.text.slice(0, 80)}`))
      lines.push('\nBatalkan: `hapusreminder <nomor>`')
      await reply(lines.join('\n'))
      return
    }
    if (cmd === 'hapusreminder' || cmd === 'batalreminder') {
      const n = parseInt(args[0], 10)
      if (!n) {
        await reply('Pakai: `hapusreminder <nomor>` — lihat daftar dulu via `reminder`.')
        return
      }
      const gone = deleteReminder(sender, n)
      await reply(gone ? `🗑️ Pengingat dibatalkan:\n"${gone.text.slice(0, 100)}"` : 'Nomor tidak ditemukan. Cek via `reminder`.')
      return
    }
    // ingatin <waktu> <pesan>
    const rest = text.slice(cmd.length).trim()
    const m = rest.match(/^(\S+(?:\s+besok)?|\S+\s+\d{1,2}[:.]\d{2}|besok\s+\d{1,2}[:.]\d{2})\s+([\s\S]+)$/i)
    if (!m) {
      await reply('Format: `ingatin <waktu> <pesan>`\n\n' + HELP)
      return
    }
    // Coba parse: kata pertama (+kata kedua utk "besok HH:MM") sebagai waktu
    let at = null, pesan = ''
    const twoWord = rest.match(/^(besok\s+\d{1,2}[:.]\d{2})\s+([\s\S]+)$/i)
    if (twoWord) {
      at = parseReminderTime(twoWord[1]); pesan = twoWord[2]
    } else {
      const parts = rest.split(/\s+/)
      at = parseReminderTime(parts[0])
      pesan = parts.slice(1).join(' ')
    }
    if (!at || !pesan.trim()) {
      await reply('Waktu tidak dikenali atau pesan kosong.\n\n' + HELP)
      return
    }
    if (at <= Date.now() + 30_000) {
      await reply('Waktunya sudah lewat — pakai waktu di masa depan ya.')
      return
    }
    if (pesan.length > 500) {
      await reply('Pesan maksimal 500 karakter.')
      return
    }
    const res = addReminder({ sender, chat, text: pesan.trim(), at })
    if (res.error) {
      await reply('⚠️ ' + res.error)
      return
    }
    await reply(`✅ Pengingat dipasang!\n\n⏰ ${formatWib(new Date(at))}\n📝 ${pesan.trim().slice(0, 200)}`)
  },
}
