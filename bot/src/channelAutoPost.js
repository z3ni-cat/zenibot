// channelAutoPost — auto-post update GitHub ke WhatsApp Channel.
// Sumber: rilis ZeniMusic (via zproxy) + commit ZeniCat (via GitHub API).
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'
import { BOT_NAME } from './brand.js'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const CFG = path.join(__dirname, '..', 'data', 'channel_autopost.json')
const ZPROXY = 'https://zenicat.net/zenimusic/zproxy.php?a=release'
const ZENIMUSIC_PAGE = 'https://zenicat.net/zenimusic/'

export function loadChannelConfig() {
  let c
  try {
    c = JSON.parse(fs.readFileSync(CFG, 'utf8'))
  } catch {
    c = {}
  }
  // migrasi format lama
  if (c.lastVersion && !c.zenimusic) c.zenimusic = { lastVersion: c.lastVersion }
  delete c.lastVersion
  if (!c.zenimusic) c.zenimusic = { lastVersion: null }
  if (!c.zenicat) c.zenicat = { enabled: true, repo: 'z3ni-cat/zenicat', lastSha: null }
  return {
    enabled: !!c.enabled,
    channelJid: c.channelJid || null,
    channelName: c.channelName || null,
    intervalMin: c.intervalMin || 15,
    zenimusic: c.zenimusic,
    zenicat: c.zenicat,
  }
}

export function saveChannelConfig(c) {
  fs.mkdirSync(path.dirname(CFG), { recursive: true })
  fs.writeFileSync(CFG, JSON.stringify(c, null, 2))
}

function formatReleasePost(r) {
  let notes = (r.notes || '').trim()
  if (notes.length > 900) notes = notes.slice(0, 900) + '…'
  return `🎵 *ZeniMusic v${r.version}* telah rilis!\n\n📝 *Changelog:*\n${notes}\n\n⬇️ Download & info lengkap: ${ZENIMUSIC_PAGE}`
}

async function checkZenimusic(c, sock) {
  const res = await fetch(ZPROXY, { signal: AbortSignal.timeout(20000) })
  if (!res.ok) throw new Error('zproxy HTTP ' + res.status)
  const r = await res.json()
  const ver = (r.version || '').trim()
  if (!ver) return
  if (!c.zenimusic.lastVersion) {
    c.zenimusic.lastVersion = ver
    console.log(`[chanauto] versi awal zenimusic dicatat: v${ver} (tidak diposting)`)
    return
  }
  if (ver !== c.zenimusic.lastVersion) {
    await sock.sendMessage(c.channelJid, { text: formatReleasePost(r) })
    console.log(`[chanauto] posted zenimusic v${ver} ke channel`)
    c.zenimusic.lastVersion = ver
  }
}

async function checkZenicat(c, sock) {
  const token = process.env.GH_TOKEN_ZENICAT
  if (!token) {
    console.log('[chanauto] GH_TOKEN_ZENICAT belum diset — pantauan zenicat dilewati')
    return
  }
  if (!c.zenicat.enabled) return
  const repo = c.zenicat.repo || 'z3ni-cat/zenicat'
  const res = await fetch(`https://api.github.com/repos/${repo}/commits?per_page=5`, {
    headers: {
      'Authorization': `token ${token}`,
      'User-Agent': 'zenicat-bot',
      'Accept': 'application/vnd.github+json',
    },
    signal: AbortSignal.timeout(20000),
  })
  if (!res.ok) throw new Error('GitHub API ' + res.status)
  const commits = await res.json()
  if (!commits.length) return
  const latest = commits[0].sha
  if (!c.zenicat.lastSha) {
    c.zenicat.lastSha = latest
    console.log('[chanauto] sha awal zenicat dicatat (tidak diposting)')
    return
  }
  if (latest === c.zenicat.lastSha) return
  let baru = 0
  for (const cm of commits) {
    if (cm.sha === c.zenicat.lastSha) break
    baru++
  }
  const cm = commits[0]
  const msg = (cm.commit.message || '').split('\n')[0].slice(0, 300)
  const author = cm.commit.author?.name || '?'
  const date = (cm.commit.author?.date || '').slice(0, 10)
  let text = `🤖 *${BOT_NAME}* ada update baru!\n\n📝 *${msg}*\n👤 ${author} • 📅 ${date}`
  if (baru > 1) text += `\n\n(+${baru - 1} commit lainnya)`
  text += `\n\n🔗 ${cm.html_url}`
  await sock.sendMessage(c.channelJid, { text })
  console.log(`[chanauto] posted zenicat ${latest.slice(0, 7)} ke channel`)
  c.zenicat.lastSha = latest
}

export function startChannelAutoPost(getSock) {
  const boot = loadChannelConfig()
  const ms = (boot.intervalMin || 15) * 60_000
  console.log(`[chanauto] watcher aktif (cek tiap ${boot.intervalMin || 15} menit): zenimusic + zenicat`)
  const tick = async () => {
    const sock = getSock()
    if (!sock) return
    const c = loadChannelConfig()
    if (!c.enabled || !c.channelJid) return
    try {
      await checkZenimusic(c, sock)
    } catch (e) {
      console.error('[chanauto] gagal cek zenimusic:', e.message)
    }
    try {
      await checkZenicat(c, sock)
    } catch (e) {
      console.error('[chanauto] gagal cek zenicat:', e.message)
    }
    saveChannelConfig(c)
  }
  setTimeout(tick, 60_000)
  setInterval(tick, ms)
}
