// Koneksi WhatsApp via Baileys: pairing code + auto-reconnect
import makeWASocket, {
  useMultiFileAuthState,
  fetchLatestBaileysVersion,
  makeCacheableSignalKeyStore,
  DisconnectReason,
} from '@whiskeysockets/baileys'
import pino from 'pino'
import path from 'path'
import { fileURLToPath } from 'url'
import { createHandler } from './handler.js'
import { loadPlugins } from './loader.js'
import { startOrderWatcher } from './orderWatcher.js'
import { startSupportSweeper } from './support.js'
import { startMarketWatcher } from './marketWatcher.js'
import { startGenResultWatcher } from './genResultWatcher.js'
import { startAivideoDeliver } from './aivideoDeliver.js'
import { startReminderWatcher } from './reminder.js'
import { startChannelAutoPost } from './channelAutoPost.js'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

// Simpan QR pairing sebagai file PNG (di-overwrite setiap QR baru)
async function saveQrPng(qrText) {
  try {
    const { default: QRCode } = await import('qrcode')
    await QRCode.toFile('qr.png', qrText, { width: 512, margin: 2 })
    console.log('[bot] QR pairing diperbarui: qr.png (segera scan, QR cepat kedaluwarsa)')
  } catch (e) {
    console.error('[bot] Gagal membuat QR:', e.message)
  }
}

// Minta pairing code dengan retry — requestPairingCode butuh websocket
// yang sudah terbuka, jadi percobaan pertama kadang gagal ("Connection Closed")
async function requestPairingCodeWithRetry(sock, number, tries = 10) {
  for (let i = 1; i <= tries; i++) {
    try {
      return await sock.requestPairingCode(number)
    } catch (e) {
      console.log(`[bot] Percobaan pairing ${i}/${tries} gagal (${e.message}), coba lagi...`)
      await new Promise((r) => setTimeout(r, 4000))
    }
  }
  return null
}
const logger = pino({ level: 'silent' })

// Pairing code hanya diminta sekali per proses agar tidak berganti-ganti
let pairingRequested = false

// Socket aktif — dipakai orderWatcher untuk kirim notifikasi pembayaran
let currentSock = null
let watcherStarted = false
export function getSock() {
  return currentSock
}

export async function startBot(config) {
  const plugins = await loadPlugins(path.join(__dirname, '..', 'plugins'))
  console.log(`[bot] ${plugins.size} perintah terdaftar`)

  const { state, saveCreds } = await useMultiFileAuthState(config.sessionDir)
  const { version } = await fetchLatestBaileysVersion()

  const sock = makeWASocket({
    version,
    logger,
    auth: {
      creds: state.creds,
      keys: makeCacheableSignalKeyStore(state.keys, logger),
    },
    browser: [config.name, 'Chrome', '1.0'],
    markOnlineOnConnect: true,
  })
  currentSock = sock
  if (!watcherStarted) {
    watcherStarted = true
    startOrderWatcher(getSock)
    startSupportSweeper(getSock)
    startMarketWatcher(getSock)
    startGenResultWatcher(getSock)
    startAivideoDeliver(getSock)
    startReminderWatcher(getSock)
    startChannelAutoPost(getSock)
  }

  // Belum terdaftar? Pilih metode pairing.
  // - 'code': minta pairing code (dimasukkan di HP: Perangkat Tertaut)
  // - 'qr'  : simpan QR ke qr.png untuk di-scan
  // Hanya sekali per proses — kode tetap valid selama menunggu.
  // Retry di dalam proses (jangan exit) agar PM2 tidak crash-loop.
  if (!sock.authState.creds.registered && !pairingRequested && config.pairMethod === 'code') {
    pairingRequested = true
    if (!config.botNumber) {
      console.error('[bot] Belum ada session. Jalankan dengan: BOT_NUMBER=628xxx node index.js')
      process.exit(1)
    }
    const code = await requestPairingCodeWithRetry(sock, config.botNumber)
    if (code) {
      console.log('')
      console.log('══════════════════════════════════════')
      console.log(`  KODE PAIRING:  ${code}`)
      console.log(`  Nomor: ${config.botNumber}`)
      console.log('  Masukkan di WA > Perangkat Tertaut >')
      console.log('  Tautkan dengan nomor telepon')
      console.log('══════════════════════════════════════')
      console.log('')
    } else {
      console.error('[bot] Gagal mendapatkan pairing code setelah 10x percobaan.')
    }
  }

  sock.ev.on('creds.update', saveCreds)
  sock.ev.on('messages.upsert', createHandler(sock, plugins, config))

  sock.ev.on('connection.update', async ({ connection, lastDisconnect, qr }) => {
    // Mode QR: simpan QR terbaru ke qr.png setiap kali tersedia
    if (qr && config.pairMethod === 'qr' && !sock.authState.creds.registered) {
      await saveQrPng(qr)
    }
    if (connection === 'open') {
      console.log(`[bot] ${config.name} terhubung ✅`)
    }
    if (connection === 'close') {
      const err = lastDisconnect?.error
      const code = err?.output?.statusCode || '?'
      if (code === DisconnectReason.loggedOut) {
        console.error('[bot] Session logout. Hapus folder session & pairing ulang.')
        process.exit(1)
      }
      console.log(`[bot] Koneksi terputus (kode ${code}: ${err?.message || 'tanpa pesan'}), mencoba lagi...`)
      setTimeout(() => startBot(config), 3000)
    }
  })
}
