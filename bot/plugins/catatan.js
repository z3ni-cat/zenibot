// Plugin Catatan — catatan pribadi per pengguna
// Commands: catat | catatan | hapuscatatan
//   catat <isi>            -> simpan catatan baru
//   catatan                -> daftar semua catatan
//   catatan <nomor>        -> baca 1 catatan lengkap
//   hapuscatatan <nomor>   -> hapus 1 catatan
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const DATA_FILE = path.join(__dirname, '..', 'data', 'notes.json')
const MAX_NOTES = 50
const MAX_LEN = 2000

function load() {
  try { return JSON.parse(fs.readFileSync(DATA_FILE, 'utf8')) } catch { return {} }
}
function save(o) {
  fs.mkdirSync(path.dirname(DATA_FILE), { recursive: true })
  fs.writeFileSync(DATA_FILE, JSON.stringify(o, null, 2))
}
function fmtTime(ts) {
  return new Date(ts).toLocaleString('id-ID', {
    timeZone: 'Asia/Jakarta', day: '2-digit', month: 'short',
    hour: '2-digit', minute: '2-digit',
  })
}
function getNotes(sender) {
  const data = load()
  return { data, notes: data[sender] || [] }
}
function parseNum(s) {
  const n = parseInt(s, 10)
  return Number.isInteger(n) ? n : NaN
}

async function addNote(ctx, text) {
  const { sender, reply } = ctx
  if (!text) {
    await reply('📝 Tulis isi catatannya ya.\nContoh: `catat Beli token listrik 50rb sebelum Jumat`')
    return
  }
  if (text.length > MAX_LEN) {
    await reply(`❌ Catatan kepanjangan (maks ${MAX_LEN} karakter).`)
    return
  }
  const { data, notes } = getNotes(sender)
  if (notes.length >= MAX_NOTES) {
    await reply(`❌ Catatanmu sudah penuh (${MAX_NOTES}). Hapus dulu yang lama: \`hapuscatatan <nomor>\``)
    return
  }
  notes.push({ text, ts: Date.now() })
  data[sender] = notes
  save(data)
  await reply(`✅ Catatan #${notes.length} tersimpan.`)
}

async function listNotes(ctx) {
  const { sender, reply } = ctx
  const { notes } = getNotes(sender)
  if (!notes.length) {
    await reply('🗒️ Belum ada catatan.\nSimpan dengan: `catat <isi catatan>`')
    return
  }
  let msg = `🗒️ *CATATANMU* (${notes.length})`
  notes.forEach((n, i) => {
    const short = n.text.length > 60 ? n.text.slice(0, 60) + '…' : n.text
    msg += `\n\n*${i + 1}.* ${short}\n   _${fmtTime(n.ts)}_`
  })
  msg += '\n\nBaca lengkap: `catatan <nomor>` • Hapus: `hapuscatatan <nomor>`'
  await reply(msg)
}

async function readNote(ctx, arg) {
  const { sender, reply } = ctx
  const { notes } = getNotes(sender)
  const idx = parseNum(arg) - 1
  if (!Number.isInteger(parseNum(arg)) || idx < 0 || idx >= notes.length) {
    await reply('❌ Nomor catatan tidak valid. Lihat daftar: `catatan`')
    return
  }
  const n = notes[idx]
  await reply(`📝 *Catatan #${idx + 1}*\n_${fmtTime(n.ts)}_\n\n${n.text}`)
}

async function deleteNote(ctx, arg) {
  const { sender, reply } = ctx
  const { data, notes } = getNotes(sender)
  const idx = parseNum(arg) - 1
  if (!Number.isInteger(parseNum(arg)) || idx < 0 || idx >= notes.length) {
    await reply('❌ Nomor catatan tidak valid. Lihat daftar: `catatan`')
    return
  }
  notes.splice(idx, 1)
  data[sender] = notes
  save(data)
  await reply(`🗑️ Catatan #${parseNum(arg)} dihapus.`)
}

export default {
  name: 'catatan',
  alias: ['catat', 'note', 'notes', 'hapuscatatan', '-catatan', 'delnote'],
  description: 'Catatan pribadi: simpan, lihat & hapus',
  async run(ctx) {
    const { command, args, reply } = ctx
    if (command === 'catat' || command === 'note') {
      await addNote(ctx, args.join(' ').trim())
      return
    }
    if (command === 'hapuscatatan' || command === '-catatan' || command === 'delnote') {
      if (!args[0]) {
        await reply('🗑️ Hapus catatan nomor berapa?\nContoh: `hapuscatatan 2`')
        return
      }
      await deleteNote(ctx, args[0])
      return
    }
    // catatan / notes
    if (args[0]) await readNote(ctx, args[0])
    else await listNotes(ctx)
  },
}
