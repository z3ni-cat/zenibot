// Manajemen produk & kategori via WhatsApp — KHUSUS owner/admin.
//
//   +produk Kategori | NamaProduk | Deskripsi
//       -> tambah produk baru (atau UBAH kalau nama sudah ada).
//       -> kalau kategori belum ada, otomatis dibuatkan.
//       -> deskripsi bebas, boleh multiline & emoticon.
//
//   -produk NamaProduk
//       -> hapus produk (+ covernya)
//
//   set_cover NamaProduk
//       -> kirim BERSAMA FOTO (caption perintah ini),
//          foto jadi cover/thumbnail produk
//
// Contoh:
//   +produk Aplikasi Premium | Netflix | *Netflix Sharing*
//
//   Sharing Account
//   1 Profile 1 User
//
//   Full Garansi
//   Rp35,000
import { downloadMediaMessage } from '@whiskeysockets/baileys'
import fs from 'fs'
import path from 'path'
import {
  loadProducts, saveProducts, slugify, findProduct,
  loadCategories, saveCategories, matchCategory,
  deleteCover, COVER_DIR,
} from '../src/products.js'
import { formatRupiah } from '../src/utils.js'
export { isAdmin } from '../src/admin.js'
import { startWizard } from '../src/produkWizard.js'
import { isPremium, LITE_MAX_PRODUCTS, upsellText } from '../src/license.js'


export default {
  name: '+produk',
  ownerOnly: true,
  alias: ['-produk', 'set_cover', '+harga'],
  description: 'Kelola produk & kategori (khusus admin)',
  async run(ctx) {
    const { command, sender, senderNumber, config, reply, text } = ctx
    if (!isAdmin(config, sender, senderNumber)) {
      return reply('❌ _Perintah ini khusus admin._')
    }
    if (command === '+produk') {
      const rest = text.replace(/^\+produk\s+/i, '').trim()
      // Tanpa | -> wizard percakapan (mis. "+produk App")
      if (rest && !rest.includes('|')) return startWizard(sender, rest, reply)
      return addOrUpdate(ctx)
    }
    if (command === '-produk') return removeProduct(ctx)
    if (command === 'set_cover') return setCover(ctx)
    if (command === '+harga') return setHarga(ctx)
  },
}

// +produk Kategori | NamaProduk | Deskripsi (bebas, multiline, emoticon OK)
async function addOrUpdate({ text, reply }) {
  const rest = text.replace(/^\+produk\s+/i, '')
  const parts = rest.split('|').map((s) => s.trim())
  const [catName, name, ...descParts] = parts
  if (!catName || !name) {
    return reply(
      'Format: *+produk Kategori | NamaProduk | Deskripsi*\n' +
      'Contoh:\n*+produk Aplikasi Premium | Netflix | *Netflix Sharing*\n\nRp35,000*'
    )
  }
  const desc = descParts.join('|').trim() || '-'

  // Cari kategori (mendukung singkatan, mis. "App" -> "Aplikasi Premium"),
  // buat baru kalau belum ada
  const cats = loadCategories()
  const matched = matchCategory(cats, catName)
  if (matched.ambiguous) {
    return reply(
      `⚠️ *${catName}* cocok dengan beberapa kategori:\n` +
      matched.ambiguous.map((c) => `• ${c.emoji} ${c.name}`).join('\n') +
      `\n\nTulis nama kategorinya lebih lengkap ya.`
    )
  }
  let cat = matched.cat
  let catBaru = false
  if (!cat) {
    cat = { id: slugify(catName), name: catName, emoji: '🛍️' }
    cats.push(cat)
    saveCategories(cats)
    catBaru = true
  }

  const list = loadProducts()
  const existing = findProduct(list, name)
  if (existing) {
    existing.name = name // samakan kapitalisasi terbaru
    existing.description = desc
    existing.categoryId = cat.id
    saveProducts(list)
    return reply(`✅ Produk *${name}* di kategori *${cat.name}* berhasil diperbarui!`)
  }

  if (!isPremium() && list.length >= LITE_MAX_PRODUCTS) {
    return reply(`🔓 *Batas Lite tercapai* — maksimal ${LITE_MAX_PRODUCTS} produk.\n\n` + upsellText('Tambah produk tanpa batas'))
  }
  list.push({ id: slugify(name), name, description: desc, cover: null, categoryId: cat.id })
  saveProducts(list)
  return reply(
    `✅ Produk *${name}* di kategori *${cat.name}* berhasil ditambahkan!` +
    (catBaru ? `\n📁 Kategori *${cat.name}* baru dibuat.` : '')
  )
}

// -produk NamaProduk
async function removeProduct({ text, reply }) {
  const name = text.replace(/^-produk\s+/i, '').trim()
  if (!name) return reply('Format: *-produk NamaProduk*')
  const q = name.toLowerCase()

  const list = loadProducts()
  const idx = list.findIndex((p) => p.name.toLowerCase() === q || p.id === slugify(q))
  if (idx < 0) return reply(`❌ Produk *${name}* tidak ditemukan.`)

  const [gone] = list.splice(idx, 1)
  deleteCover(gone)
  saveProducts(list)
  return reply(`🗑️ Produk *${gone.name}* berhasil dihapus!`)
}

// +harga NamaProduk | 40000  (nominal QRIS mengikuti harga ini)
async function setHarga({ text, reply }) {
  const rest = text.replace(/^\+harga\s+/i, '')
  const pipe = rest.indexOf('|')
  const name = (pipe >= 0 ? rest.slice(0, pipe) : rest).trim()
  const price = parseInt((pipe >= 0 ? rest.slice(pipe + 1) : '').replace(/[^0-9]/g, ''), 10) || 0
  if (!name) return reply('Format: *+harga NamaProduk | 40000*')
  if (!price) return reply('Harga tidak valid. Contoh: *+harga Netflix | 40000*')

  const list = loadProducts()
  const p = findProduct(list, name)
  if (!p) return reply(`❌ Produk *${name}* tidak ditemukan.`)
  p.price = price
  saveProducts(list)
  return reply(`✅ Harga *${p.name}* berhasil diatur: *${formatRupiah(price)}*!`)
}

// set_cover NamaProduk — wajib dikirim bersama foto (caption = perintah ini)
async function setCover({ msg, text, reply }) {
  const name = text.replace(/^set_cover\s+/i, '').trim()
  const img = msg.message?.imageMessage
  if (!img) {
    return reply('Kirim *foto* dengan caption *set_cover NamaProduk*.\nContoh: foto + caption *set_cover Netflix*')
  }
  if (!name) return reply('Sertakan nama produk. Contoh: caption *set_cover Netflix*')

  const list = loadProducts()
  const p = findProduct(list, name)
  if (!p) {
    return reply(`❌ Produk *${name}* tidak ditemukan. Tambahkan dulu dengan *+produk*.`)
  }

  const buf = await downloadMediaMessage(msg, 'buffer', {})
  const ext = (img.mimetype?.split('/')[1] || 'jpg').replace(/[^a-z]/g, '') || 'jpg'
  const filename = `${p.id}.${ext === 'jpeg' ? 'jpg' : ext}`

  fs.mkdirSync(COVER_DIR, { recursive: true })
  fs.writeFileSync(path.join(COVER_DIR, filename), buf)
  if (p.cover && p.cover !== filename) deleteCover(p)
  p.cover = filename
  saveProducts(list)

  return reply(`✅ Cover produk *${p.name}* berhasil diubah!`)
}
