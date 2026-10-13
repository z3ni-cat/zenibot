import { BOT_NAME } from '../src/brand.js'
// Plugin Zeni Music — info rilis terbaru, mengikuti halaman web.
// Sumber: https://zenicat.net/zenimusic/zproxy.php?a=release
// (proxy server membaca repo GitHub private + cache 10 menit,
//  jadi bot selalu sinkron dengan halaman tanpa token GitHub sendiri).
const ZPROXY = 'https://zenicat.net/zenimusic/zproxy.php?a=release'
const PAGE = 'https://zenicat.net/zenimusic/'
const APK_DL = 'https://zenicat.net/zenimusic/zproxy.php?a=download'

function fmtTanggal(iso) {
  try {
    return new Date(iso).toLocaleDateString('id-ID', {
      day: 'numeric', month: 'short', year: 'numeric',
    })
  } catch { return iso }
}

function fmtSize(b) {
  b = Number(b) || 0
  if (b >= 1048576) return (b / 1048576).toFixed(1) + ' MB'
  if (b >= 1024) return Math.round(b / 1024) + ' KB'
  return b + ' B'
}

async function rilisTerbaru() {
  const res = await fetch(ZPROXY, { headers: { 'User-Agent': BOT_NAME + '-bot' } })
  if (!res.ok) throw new Error(`zproxy ${res.status}`)
  const d = await res.json()
  if (d.error || !d.tag) return null
  return d
}

export default {
  name: 'zenimusic',
  alias: ['zmusic', 'musik'],
  description: 'Info rilis terbaru Zeni Music + link download APK',
  async run(ctx) {
    const { reply } = ctx
    let r
    try {
      r = await rilisTerbaru()
    } catch (e) {
      console.log('[zenimusic] gagal ambil rilis:', e.message)
      return reply(
        `🎵 *Zeni Music* — Pemutar Musik Android Native\n\n` +
        `⚠️ _Gagal mengambil info terbaru saat ini._\n\n` +
        `🌐 Cek langsung: ${PAGE}`
      )
    }
    if (!r) {
      return reply(
        `🎵 *Zeni Music* — Pemutar Musik Android Native\n\n` +
        `📦 _Belum ada rilis resmi._\n\n` +
        `🌐 Pantau di: ${PAGE}`
      )
    }
    let catatan = (r.notes || '').trim().replace(/\r/g, '')
    if (catatan.length > 700) catatan = catatan.slice(0, 700).trimEnd() + '…'
    const apkInfo = r.apk_name ? ` (${fmtSize(r.apk_size)})` : ''
    return reply(
      `🎵 *Zeni Music* — Pemutar Musik Android Native\n\n` +
      `📦 Versi terbaru: *${r.tag}*\n` +
      `🗓️ Dirilis: ${r.published ? fmtTanggal(r.published) : '-'}\n` +
      (catatan ? `\n📝 *Yang baru:*\n${catatan}\n` : `\n`) +
      `\n⬇️ *Download APK*${apkInfo}:\n${APK_DL}\n` +
      `\n🌐 Info lengkap: ${PAGE}` +
      `\n_Selalu versi terbaru — mengikuti halaman resmi._`
    )
  },
}
