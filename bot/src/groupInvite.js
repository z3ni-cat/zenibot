// Auto-join grup via link undangan.
// Cara pakai: kirim link https://chat.whatsapp.com/xxxx ke bot (jalur pribadi).
// Hanya owner yang bisa — pengirim lain diabaikan diam-diam.
const LINK_RE = /chat\.whatsapp\.com\/([A-Za-z0-9]{10,30})/g

function isOwner(config, sender, senderNumber) {
  const owners = config.owner || []
  return owners.some((o) => {
    const n = String(o).replace(/[^0-9]/g, '')
    return n && (sender.includes(n) || senderNumber === n)
  })
}

export async function handleGroupInvite({ sock, chat, sender, senderNumber, text, reply, config }) {
  const codes = [...text.matchAll(LINK_RE)].map((m) => m[1])
  if (!codes.length) return false
  if (!isOwner(config, sender, senderNumber)) return true // telan diam-diam

  for (const code of [...new Set(codes)]) {
    try {
      const info = await sock.groupGetInviteInfo(code).catch(() => null)
      const name = info?.subject || 'grup'
      await sock.groupAcceptInvite(code)
      console.log(`[invite] join grup: ${name}`)
      await reply(`✅ Berhasil masuk ke grup *${name}*.`)
    } catch (e) {
      console.error(`[invite] gagal join ${code}:`, e.message)
      await reply(`❌ Gagal masuk grup (link kedaluwarsa / sudah jadi anggota).`)
    }
  }
  return true
}
