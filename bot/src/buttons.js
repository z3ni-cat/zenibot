// Helper tombol WhatsApp via fork @itsliaaa/baileys (library yang dipakai NeoXR).
//
// Cara pakai (mirip contoh button.js NeoXR):
//   await sock.sendMessage(chat, {
//     text: 'Isi pesan', footer: 'ZeniCat',
//     nativeFlow: [{ id: 'ui:menulist', text: 'Lihat Menu' }],          // quick reply
//     // nativeFlow: [{ text: 'Pilih', sections: [...] }],              // dropdown list
//   }, { quoted })
//
// Helper di bawah membungkus pola itu agar plugin tetap ringkas.
import fs from 'fs'

// Kirim pesan + tombol quick reply (maks 3 tombol tampil optimal).
// image: Buffer gambar opsional untuk header.
export async function sendButtons(sock, chat, { body, footer = '', buttons = [], image = null }, { quoted, mentions } = {}) {
  const content = {
    ...(image ? { image, caption: body } : { text: body }),
    footer,
    nativeFlow: buttons.map((b) => ({ id: b.id, text: b.text })),
  }
  return sock.sendMessage(chat, content, { ...(quoted ? { quoted } : {}), ...(mentions ? { mentions } : {}) })
}

// Kirim pesan + dropdown list (cocok untuk banyak opsi).
// quickButtons opsional: tombol quick reply tambahan di atas tombol list,
// mis. [{ id: 'ui:menu', text: '🏠 Menu Utama' }]
export async function sendList(sock, chat, { body, footer = '', buttonTitle = 'Pilih', sections = [], image = null, quickButtons = [] }, { quoted, mentions } = {}) {
  const content = {
    ...(image ? { image, caption: body } : { text: body }),
    footer,
    nativeFlow: [
      ...quickButtons.map((b) => ({ id: b.id, text: b.text })),
      {
        text: buttonTitle,
        sections: sections.map((s) => ({
          title: s.title,
          rows: s.rows.map((r) => ({
            title: r.title,
            description: r.description || '',
            id: r.id,
          })),
        })),
      },
    ],
  }
  return sock.sendMessage(chat, content, { ...(quoted ? { quoted } : {}), ...(mentions ? { mentions } : {}) })
}

// Baca file thumbnail sebagai Buffer. Mengembalikan null jika file tak ada.
export function loadThumbnail(filePath) {
  try {
    if (!filePath || !fs.existsSync(filePath)) return null
    return fs.readFileSync(filePath)
  } catch {
    return null
  }
}

// Ambil ID tombol/list yang ditekan user dari sebuah pesan masuk.
// Mengembalikan string id atau null.
export function extractButtonId(msg) {
  const m = msg.message
  if (!m) return null
  // Tap tombol quick-reply kadang tiba sebagai templateButtonReplyMessage
  // (bukan interactiveResponseMessage) — tergantung klien WA pengirim.
  const tr = m.templateButtonReplyMessage
  if (tr?.selectedId) return String(tr.selectedId)
  const ir = m.interactiveResponseMessage
  if (ir) {
    const nfr = ir.nativeFlowResponseMessage
    if (nfr) {
      if (nfr.paramsJson) {
        try {
          const p = JSON.parse(nfr.paramsJson)
          if (p.id) return String(p.id)
        } catch { /* abaikan */ }
      }
      if (nfr.id) return String(nfr.id)
    }
    // Fallback: cari id internal "ui:..." di dalam JSON response
    try {
      const s = JSON.stringify(ir)
      const mm = s.match(/"id"\s*:\s*"(ui:[^"]+)"/)
      if (mm) return mm[1]
    } catch { /* abaikan */ }
  }
  const br = m.buttonsResponseMessage
  if (br?.selectedButtonId) return String(br.selectedButtonId)
  const lr = m.listResponseMessage
  if (lr?.singleSelectReply?.selectedRowId) return String(lr.singleSelectReply.selectedRowId)
  return null
}

// Ambil teks dari berbagai tipe pesan
export function extractText(msg) {
  const m = msg.message
  if (!m) return ''
  return (
    m.conversation ||
    m.extendedTextMessage?.text ||
    m.imageMessage?.caption ||
    m.videoMessage?.caption ||
    ''
  )
}
