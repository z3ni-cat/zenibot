// Dispatcher pesan: nonprefix — perintah dikenali dari kata pertama pesan,
// atau dari tombol/list yang ditekan user.
import { extractButtonId, extractText } from './buttons.js'
import { sanitizeText } from './sanitize.js'
import { jidToNumber } from './utils.js'
import { handleSupportMessage } from './support.js'
import { handleGroupInvite } from './groupInvite.js'
import { handleWizardStep, getWizardSession } from './produkWizard.js'
import { handleDeviceFlow } from './deviceMode.js'
import { handleAicsMessage } from '../plugins/aics.js'
import { getToolSession } from './toolSession.js'
import { getGenSession, handleGenInput } from './genSession.js'
import { handleToolInput } from './freetools.js'
import { getKopkenSession, handleKopkenInput } from './kopken.js'
import { getSmmSession, handleSmmInput } from './smmFlow.js'
import { getAivideoSession } from './aivideo.js'
import { handleAivideoInput } from '../plugins/aivideo.js'
import { getMinyakSession, handleMinyakInput } from './minyak.js'

export function createHandler(sock, plugins, config) {
  return async ({ messages }) => {
    for (const m of messages) {
      try {
        await handleOne(sock, plugins, config, m)
      } catch (e) {
        console.error('[handler]', e.message)
      }
    }
  }
}

async function handleOne(sock, plugins, config, m) {
  if (!m.message || m.key.fromMe) return
  const chat = m.key.remoteJid
  if (!chat || chat === 'status@broadcast') return
  // Channel (newsletter): hanya untuk siaran keluar — abaikan semua pesan masuk,
  // supaya bot tidak membalas (welcome/menu/AI/dll) sebagai postingan channel.
  if (chat.endsWith('@newsletter')) return

  const sender = m.key.participant || chat
  const pushName = m.pushName?.trim() || 'Kak'
  const fullText = sanitizeText(extractText(m).trim())


  // Wizard tambah produk (sesi percakapan admin) — prioritas tertinggi
  if (getWizardSession(sender)) {
    const wReply = (t) => sock.sendMessage(chat, { text: t }, { quoted: m })
    if (await handleWizardStep({ sender, text: fullText, reply: wReply })) return
  }

  // Link undangan grup -> auto-join (khusus owner)
  const senderNumber = jidToNumber(sender)
  if (await handleGroupInvite({ sock, chat, sender, senderNumber, text: fullText,
    reply: (t) => sock.sendMessage(chat, { text: t }, { quoted: m }), config })) return

  // Sesi input tools gratis — pesan berikutnya dianggap input tool
  if (getToolSession(sender)) {
    const tReply = (t) => sock.sendMessage(chat, { text: t }, { quoted: m })
    if (await handleToolInput({ sock, chat, sender, msg: m, text: fullText, reply: tReply })) return
  }

  // Sesi input generate — pesan berikutnya dianggap prompt video/gambar
  if (!extractButtonId(m) && getGenSession(sender)) {
    const gReply = (t) => sock.sendMessage(chat, { text: t }, { quoted: m })
    if (await handleGenInput({ sock, chat, sender, msg: m, text: fullText, reply: gReply })) return
  }

  // Sesi order Kopken — angka/nomor jangan dimakan navigasi device
  if (getKopkenSession(sender)) {
    const kReply = (t) => sock.sendMessage(chat, { text: t }, { quoted: m })
    const kText = extractButtonId(m) || fullText
    if (await handleKopkenInput({ sock, chat, sender, msg: m, text: kText, pushName, reply: kReply })) return
  }

  // Sesi order SMM — link/jumlah jangan dimakan navigasi device
  if (getSmmSession(sender)) {
    const sReply = (t) => sock.sendMessage(chat, { text: t }, { quoted: m })
    const sText = extractButtonId(m) || fullText
    if (await handleSmmInput({ sock, chat, sender, msg: m, text: sText, pushName, reply: sReply })) return
  }

  // Sesi jasa video AI — prompt/gambar jangan dimakan navigasi device
  if (getAivideoSession(sender)) {
    const vReply = (t) => sock.sendMessage(chat, { text: t }, { quoted: m })
    const vText = extractButtonId(m) || fullText
    if (await handleAivideoInput({ sock, chat, sender, msg: m, text: vText, pushName, reply: vReply })) return
  }

  // Sesi kelola minyak — jawaban step-by-step (owner)
  if (!extractButtonId(m) && getMinyakSession(sender)) {
    const myReply = (t) => sock.sendMessage(chat, { text: t }, { quoted: m })
    if (await handleMinyakInput({ sender, text: fullText, reply: myReply })) return
  }

  // Onboarding device & navigasi teks (iPhone) — chat pribadi, non-admin
  if (!chat.endsWith('@g.us')) {
    const dReply = (t) => sock.sendMessage(chat, { text: t }, { quoted: m })
    const dispatch = (cmd, dArgs = []) => {
      const pl = plugins.get(cmd)
      if (!pl) return
      console.log(`[recv] dispatch teks -> ${cmd}`)
      return pl.run({
        sock, msg: m, chat, sender, senderNumber,
        pushName, command: cmd, args: dArgs,
        text: fullText, reply: dReply, config,
      })
    }
    if (await handleDeviceFlow({
      chat, sender, senderNumber, pushName,
      text: fullText, reply: dReply, config, dispatch,
    })) return
  }

  let command, args = []
  const btnId = extractButtonId(m)
  if (btnId) {
    // Format id tombol internal: "ui:<command>[:<arg>...]"
    if (btnId.startsWith('ui:')) {
      const parts = btnId.slice(3).split(':')
      command = parts[0].toLowerCase()
      args = parts.slice(1)
    } else {
      const parts = btnId.split(/\s+/)
      command = parts[0].toLowerCase()
      args = parts.slice(1)
    }
  } else {
    const text = fullText
    if (!text) {
      // Pesan non-teks (gambar, dokumen, dsb): teruskan jika ada sesi support aktif
      await handleSupportMessage({ sock, msg: m, chat, sender, text: '', config })
      return
    }
    console.log(`[recv] ${chat} :: ${text.slice(0, 60)}`)
    const parts = text.split(/\s+/)
    // Dukung prefix umum: /menu, .ping, !menu — selain +produk / -produk
    command = parts[0].toLowerCase().replace(/^[/.!]/, '')
    args = parts.slice(1)
  }

  const plugin = plugins.get(command)
  if (!plugin) {
    // Bukan perintah bot -> mungkin pesan sesi support (Terima/Tolak/akhiri/relay)
    const handled = await handleSupportMessage({ sock, msg: m, chat, sender, text: fullText, config })
    if (!handled) {
      // AI Customer Service (trial) — pesan tak dikenal di chat pribadi, non-owner
      const aiReply = (t) => sock.sendMessage(chat, { text: t }, { quoted: m })
      let aiOk = false
      try { aiOk = await handleAicsMessage({ sock, msg: m, chat, sender, senderNumber, pushName, text: fullText, reply: aiReply, config }, fullText) } catch (e) { console.log('[aics] error:', e.message) }
      if (!aiOk) console.log(`[recv] perintah tidak dikenal: ${command}`)
    }
    return
  }
  console.log(`[recv] menjalankan plugin: ${command}`)

  // "Tunggu" style: react ⏳ instan + status mengetik selama bot memproses.
  // React diganti ✅ kalau plugin sukses, ❌ kalau error.
  let reacted = false
  try {
    await sock.sendMessage(chat, { react: { text: '⏳', key: m.key } })
    reacted = true
  } catch (e) { /* react gagal tidak fatal */ }
  let typingOn = false
  try {
    await sock.sendPresenceUpdate('composing', chat)
    typingOn = true
  } catch (e) { /* abaikan */ }

  const reply = (text, extra = {}) =>
    sock.sendMessage(chat, { text, ...extra }, { quoted: m })

  try {
    await plugin.run({
      sock, msg: m, chat, sender,
      senderNumber,
      pushName, command, args,
      text: fullText,
      reply, config, plugins,
    })
    if (reacted) {
      try { await sock.sendMessage(chat, { react: { text: '✅', key: m.key } }) } catch (e) {}
    }
  } catch (e) {
    console.error(`[plugin:${command}]`, e.message)
    if (reacted) {
      try { await sock.sendMessage(chat, { react: { text: '❌', key: m.key } }) } catch (e2) {}
    }
    try { await reply('❌ _Terjadi kesalahan saat memproses perintah. Coba lagi ya._') } catch (e3) {}
  } finally {
    if (typingOn) { try { await sock.sendPresenceUpdate('paused', chat) } catch (e) {} }
  }
}
