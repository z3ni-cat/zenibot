// Klien API api.neoxr.eu — dipakai fitur TOOLS GRATIS.
// API key dibaca dari env NEOXR_API_KEY (di-set di ecosystem.config.cjs).
const BASE = 'https://api.neoxr.eu/api'

function apiKey() {
  const k = process.env.NEOXR_API_KEY
  if (!k) throw new Error('NEOXR_API_KEY belum di-set di server.')
  return k
}

// GET /api/<endpoint>?apikey=...&params -> JSON. Throw bila status=false.
export async function neoxr(endpoint, params = {}) {
  const q = new URLSearchParams({ apikey: apiKey(), ...params })
  const url = `${BASE}/${endpoint}?${q.toString()}`
  const res = await fetch(url, { headers: { 'User-Agent': BOT_NAME + '/1.0' } })
  if (!res.ok) throw new Error(`API error HTTP ${res.status}`)
  const j = await res.json()
  if (j.status === false) throw new Error(j.msg || 'API mengembalikan status false')
  return j
}

// Download URL -> Buffer (untuk dikirim ulang via WhatsApp).
export async function downloadBuffer(url, maxBytes = 100 * 1024 * 1024) {
  const res = await fetch(url, { headers: { 'User-Agent': BOT_NAME + '/1.0' }, redirect: 'follow' })
  if (!res.ok) throw new Error(`Gagal mengunduh file (HTTP ${res.status})`)
  const buf = Buffer.from(await res.arrayBuffer())
  if (buf.length > maxBytes) throw new Error('File terlalu besar (>100MB)')
  if (!buf.length) throw new Error('File kosong')
  return buf
}

// --- temp upload via VPS1 (pengganti fungsi uploadTemp lama) ---
import { execFile } from 'child_process'
import { promisify } from 'util'
import { randomBytes } from 'crypto'
import fs from 'fs'
import os from 'os'
import path from 'path'
import { BOT_NAME } from './brand.js'

const execFileAsync = promisify(execFile)
const VPS1 = 'ubuntu@152.69.221.74'
const SSH_KEY = (process.env.HOME || '/home/ubuntu') + '/.ssh/id_vps1'
const REMOTE_DIR = '/var/www/ksrcloud.my.id/public_html/zenicat-tmp'
const PUBLIC_BASE = 'https://ksrcloud.my.id/zenicat-tmp'
const SSH_OPTS = ['-i', SSH_KEY, '-o', 'IdentitiesOnly=yes', '-o', 'StrictHostKeyChecking=no', '-o', 'ConnectTimeout=15']

// Upload buffer ke VPS1 -> { url, cleanup }. Untuk PDF converter (butuh URL publik).
export async function uploadTemp(buffer, filename = 'file.pdf') {
  const name = randomBytes(12).toString('hex') + '.pdf'
  const local = path.join(os.tmpdir(), name)
  fs.writeFileSync(local, buffer)
  try {
    await execFileAsync('scp', [...SSH_OPTS, '-o', 'ConnectTimeout=20', local, `${VPS1}:${REMOTE_DIR}/${name}`])
  } catch (e) {
    throw new Error('Gagal mengunggah file sementara: ' + e.message)
  } finally {
    try { fs.unlinkSync(local) } catch {}
  }
  const cleanup = async () => {
    try {
      await execFileAsync('ssh', [...SSH_OPTS, VPS1, 'rm', '-f', `${REMOTE_DIR}/${name}`])
    } catch {}
  }
  return { url: `${PUBLIC_BASE}/${name}`, cleanup }
}

// Normalisasi respons downloader -> [{ type: 'video'|'image', url }]
export function normMedia(j, limit = 10) {
  const d = j.data ?? j.result ?? j
  const arr = Array.isArray(d) ? d : [d]
  return arr
    .filter((x) => x && (x.url || x.video))
    .map((x) => ({
      type: /mp4|video/i.test(x.type || x.video || x.url || '') ? 'video' : 'image',
      url: x.url || x.video,
    }))
    .slice(0, limit)
}
