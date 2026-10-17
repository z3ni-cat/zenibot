// Stok & rules per produk — KHUSUS owner/admin.
//
//   +stock NamaProduk |
//   1. email|password
//   - Username : Budi
//   - Pin : 1122
//       -> TAMBAH stok (boleh banyak entri sekaligus)
//
//   -stock NamaProduk
//       -> kosongkan semua stok produk
//
//   +rules NamaProduk | Isi rules bebas (maks 500 karakter)
//       -> simpan/timpa rules produk
//
// Stok tersimpan per produk di data/stock/<id>.json dan otomatis
// berkurang setiap ada pembelian yang berhasil.
import { loadProducts, findProduct } from '../src/products.js'
import { isAdmin } from '../src/admin.js'
import {
  parseStockEntries, addStock, clearStock, saveRules,
} from '../src/stock.js'

export default {
  name: '+stock',
  ownerOnly: true,
  alias: ['-stock', '+rules'],
  description: 'Kelola stok & rules produk (khusus admin)',
  async run(ctx) {
    const { command, sender, senderNumber, config, reply } = ctx
    if (!isAdmin(config, sender, senderNumber)) {
      return reply('❌ _Perintah ini khusus admin._')
    }
    if (command === '+stock') return addStockCmd(ctx)
    if (command === '-stock') return clearStockCmd(ctx)
    if (command === '+rules') return setRules(ctx)
  },
}

function getProduct(text, reply) {
  const list = loadProducts()
  return { list, p: findProduct(list, text) }
}

async function addStockCmd({ text, reply }) {
  const rest = text.replace(/^\+stock\s+/i, '')
  const pipe = rest.indexOf('|')
  const name = (pipe >= 0 ? rest.slice(0, pipe) : rest).trim()
  const body = (pipe >= 0 ? rest.slice(pipe + 1) : '').trim()
  if (!name) {
    return reply(
      'Format:\n*+stock NamaProduk |*\n*1. email|password*\n*- Username : ...*\n*- Pin : ...*'
    )
  }
  const { p } = getProduct(name, reply)
  if (!p) return reply(`❌ Produk *${name}* tidak ditemukan.`)

  const entries = parseStockEntries(body)
  if (!entries.length) {
    return reply(
      '❌ Tidak ada stok yang terbaca. Contoh:\n' +
      '*+stock Netflix |*\n*1. user1@mail.com|pass123*\n*- Pin : 1122*'
    )
  }
  const total = addStock(p.id, entries)
  return reply(`✅ ${entries.length} stok untuk *${p.name}* berhasil ditambahkan!\n📦 Total stok: ${total}`)
}

async function clearStockCmd({ text, reply }) {
  const name = text.replace(/^-stock\s+/i, '').trim()
  if (!name) return reply('Format: *-stock NamaProduk*')
  const { p } = getProduct(name, reply)
  if (!p) return reply(`❌ Produk *${name}* tidak ditemukan.`)
  const n = clearStock(p.id)
  return reply(`🗑️ Stok *${p.name}* berhasil dikosongkan (${n} entri dihapus)!`)
}

async function setRules({ text, reply }) {
  const rest = text.replace(/^\+rules\s+/i, '')
  const pipe = rest.indexOf('|')
  const name = (pipe >= 0 ? rest.slice(0, pipe) : rest).trim()
  const rules = (pipe >= 0 ? rest.slice(pipe + 1) : '').trim()
  if (!name) return reply('Format: *+rules NamaProduk | Isi rules...*')
  if (!rules) return reply('Isi rules-nya kosong.')
  if (rules.length > 500) {
    return reply(`❌ Rules terlalu panjang (${rules.length}/500 karakter). Pendekkan dulu ya.`)
  }
  const { p } = getProduct(name, reply)
  if (!p) return reply(`❌ Produk *${name}* tidak ditemukan.`)
  saveRules(p.id, rules)
  return reply(`✅ Rules *${p.name}* berhasil disimpan (${rules.length}/500 karakter)!`)
}
