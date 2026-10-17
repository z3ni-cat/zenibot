// Menu utama ZeniCat — nonprefix: cukup ketik "menu"
// Alur: menu -> sapaan + tombol "Tap Here!"
//       -> bottom sheet: [🛍️ TOKO: Toko | Stock | Chat Admin] [-- TOOLS GRATIS --]
//       -> Toko -> daftar kategori toko -> daftar produk -> detail produk
import config from '../config.js'
import { loadProducts, loadCategories, loadCover, getProductPrice, getCategoryFooter, effectiveStock } from '../src/products.js'
import { stockCount } from '../src/stock.js'
import { sendButtons, sendList, loadThumbnail } from '../src/buttons.js'
import { greeting, jidToNumber, formatRupiah } from '../src/utils.js'
import { SUPPORT_ADMINS, adminJid, createSession, buyerSession } from '../src/support.js'
import { getDevice, setNav, clearNav } from '../src/deviceMode.js'
import { startKopkenFlow, KOPKEN_CAT } from '../src/kopken.js'
import { startGenFlow, GEN_CAT } from '../src/genFlow.js'
import { startSmmFlow } from '../src/smmFlow.js'
import { SMM_CAT, catalogCount } from '../src/smm.js'
import { BOT_NAME } from '../src/brand.js'

export default {
  name: 'menu',
  alias: ['cat', 'prod', 'shop', 'stock'], // 'chatadmin' diparkir 3 Okt 2026
  description: 'Menampilkan menu utama ' + BOT_NAME,
  async run(ctx) {
    const { command, args, sender } = ctx
    const textMode = getDevice(sender) === 'iphone'
    if (command === 'cat') { if (args[0] === KOPKEN_CAT) return startKopkenFlow(ctx); if (args[0] === GEN_CAT) { const mod = await import('./aivideo.js'); return mod.default.run(ctx) } if (args[0] === SMM_CAT) return startSmmFlow(ctx); return textMode ? sendTextCategory(ctx, args[0]) : sendCategory(ctx, args[0]) }
    if (command === 'prod') return textMode ? sendTextProduct(ctx, args[0]) : sendProduct(ctx, args[0])
    if (command === 'shop') return textMode ? sendTextShop(ctx) : sendShop(ctx)
    if (command === 'stock') return sendStockList(ctx)
    // PARKIR 3 Okt 2026: if (command === 'chatadmin') return sendChatAdmin(ctx)
    return textMode ? sendTextMain(ctx) : sendWelcome(ctx)
  },
}

async function react(sock, chat, msg, emoji) {
  try {
    await sock.sendMessage(chat, { react: { text: emoji, key: msg.key } })
  } catch { /* reaksi gagal bukan masalah */ }
}

// 1) Sapaan + tombol "Tap Here!" -> bottom sheet TOKO & TOOLS GRATIS
async function sendWelcome(ctx) {
  const { sock, chat, sender, pushName, msg } = ctx
  await react(sock, chat, msg, '⌛')

  const name = pushName || 'Kak'
  const body =
    `Hallo ${greeting()}, *${name}* 👋🏻\n\n` +
    `Selamat datang di *${config.storeName}*\n\n` +
    `${config.tagline}\n\n` +
    `💡 _Ketuk tombol di bawah untuk mulai._`

  const sections = [
    {
      title: '🛍️ TOKO',
      rows: [
        { title: '🛍️ Toko', description: 'Daftar Produk', id: 'ui:shop' },
        { title: '📦 Stock', description: 'Cek stock produk', id: 'ui:stock' },
        // PARKIR 3 Okt 2026: { title: '💬 Chat Admin', description: 'Hubungi admin', id: 'ui:chatadmin' },
      ],
    },
  ]
  // -- TOOLS GRATIS --
  const toolsRows = [
    { title: '\u2B07\uFE0F Downloader', description: 'Download video/foto sosmed', id: 'ui:toolcat:downloader' },
    { title: '\u2699\uFE0F Tools', description: 'Convert, cek resi, dsb', id: 'ui:toolcat:tools' },
    { title: '\uD83C\uDFA8 Stiker', description: 'Bikin & ubah stiker (brat, quote chat, video)', id: 'ui:toolcat:stiker' },
    { title: '\uD83C\uDFB5 Zeni Music', description: 'Update & download APK terbaru', id: 'ui:zenimusic' },
  ]
  if (toolsRows.length) sections.push({ title: '-- TOOLS GRATIS --', rows: toolsRows })

  await sendList(
    sock,
    chat,
    {
      body,
      footer: config.name,
      buttonTitle: 'Tap Here!',
      sections,
      image: loadThumbnail(config.thumbnail),
    },
    { quoted: msg, mentions: [sender] }
  )
  await react(sock, chat, msg, '✅')
}

// 2) Daftar kategori toko
async function sendShop(ctx) {
  const { sock, chat, msg } = ctx
  const cats = loadCategories()
  const products = loadProducts()
  const body = `🛍️ *Toko — Daftar Produk*\n\n_Pilih kategori:_`

  await sendList(
    sock,
    chat,
    {
      body,
      footer: config.name,
      buttonTitle: '📋 Daftar Menu',
      sections: [
        {
          title: 'Pilih kategori',
          rows: cats.map((c) => {
            const n = c.id === SMM_CAT ? catalogCount() : products.filter((p) => p.categoryId === c.id).length
            return {
              title: `${c.emoji} ${c.name}`,
              description: c.id === SMM_CAT ? (n ? `${n} layanan` : 'Segera hadir') : c.id === GEN_CAT ? 'Jasa Video AI' : (n ? `${n} produk` : 'Segera hadir'),
              id: `ui:cat:${c.id}`,
            }
          }),
        },
      ],
      quickButtons: [{ id: 'ui:menu', text: '🏠 Menu Utama' }],
    },
    { quoted: msg }
  )
}

// 3) Daftar produk dalam satu kategori
async function sendCategory(ctx, catId) {
  const { sock, chat, msg } = ctx
  const cat = loadCategories().find((c) => c.id === catId)
  if (!cat) return sendShop(ctx)

  const products = loadProducts().filter((p) => p.categoryId === catId)
  const body =
    `${cat.emoji} *${cat.name}*\n\n` +
    (products.length
      ? '_Pilih layanan dari tombol di bawah._'
      : '_Belum ada produk di kategori ini._')

  await sendList(
    sock,
    chat,
    {
      body,
      footer: config.name,
      buttonTitle: '📋 Lihat Produk',
      sections: [
        {
          title: 'Pilih layanan',
          rows: products.map((p) => ({
            title: p.name,
            description: p.description?.split('\n')[0] || '-',
            id: `ui:prod:${p.id}`,
          })),
        },
      ],
      quickButtons: [{ id: 'ui:shop', text: '🛍️ Toko' }, { id: 'ui:menu', text: '🏠 Menu Utama' }],
    },
    { quoted: msg }
  )
}

// 4) Detail produk (format baru + footer kategori otomatis)
async function sendProduct(ctx, id) {
  const { sock, chat, msg } = ctx
  const p = loadProducts().find((x) => x.id === id)
  if (!p) return sendShop(ctx)

  const price = getProductPrice(p)
  const stok = effectiveStock(p, stockCount(p.id))
  const footer = getCategoryFooter(p.categoryId)

  const buttons = []
  if (price > 0 && stok > 0) {
    buttons.push({ id: `ui:buy:${p.id}`, text: '🛒 Beli Sekarang' })
  } else {
    // Stok habis -> pembeli bisa tanya admin via sesi chat perantara
    buttons.push({ id: `ui:ask:${p.id}`, text: '❓ Tanyakan Stok' })
  }
  buttons.push({ id: 'ui:shop', text: '🛍️ Toko' })

  await sendButtons(
    sock,
    chat,
    {
      body:
        `*${p.title || p.name}*\n\n` +
        `${p.description || '-'}\n\n` +
        (footer
          ? `Keterangan\n${footer.split('\n').map((l) => `> ${l}`).join('\n')}\n\n`
          : '') +
        `💵 Harga : ${formatRupiah(price)}`,
      footer: config.name,
      buttons,
      image: loadCover(p),
    },
    { quoted: msg }
  )
}

// 5) Cek stock semua produk
async function sendStockList(ctx) {
  const { sock, chat, msg, sender } = ctx
  if (getDevice(sender) === 'iphone') setNav(sender, { page: 'main' })
  const products = loadProducts().filter((p) => p.categoryId !== 'kopken')
  if (!products.length) {
    await sock.sendMessage(chat, { text: '📦 *Cek Stock Produk*\n\n_Belum ada produk._' }, { quoted: msg })
    return
  }
  const lines = products.map((p) => {
    const s = effectiveStock(p, stockCount(p.id))
    return `• *${p.title || p.name}* — ${s > 0 ? `${s} tersedia` : '_habis_'}`
  })
  await sock.sendMessage(
    chat,
    { text: `📦 *Cek Stock Produk*\n\n${lines.join('\n')}` },
    { quoted: msg }
  )
}

// PARKIR 3 Okt 2026 — fungsi sendChatAdmin tidak dipakai sementara
// 6) Chat Admin — sesi chat perantara pembeli <-> admin (tanpa produk spesifik)
async function sendChatAdmin(ctx) {
  const { sock, chat, sender, pushName, reply } = ctx
  if (chat.endsWith('@g.us')) {
    return reply('❌ _Fitur ini hanya bisa dipakai di chat pribadi._')
  }
  const existing = buyerSession(chat)
  if (existing) {
    return reply(
      `📩 _Kamu sudah punya sesi ${existing.status === 'active' ? 'chat aktif' : 'menunggu admin'}._\n` +
      `Ketik *akhiri* untuk menutupnya.`
    )
  }
  const isLid = sender.endsWith('@lid')
  const s = createSession({
    buyerJid: chat,
    buyerNumber: isLid ? '' : jidToNumber(sender),
    buyerName: pushName,
    productId: null,
    productName: 'Chat Admin',
  })
  const notice =
    `*Hallo Admin, Ada Pesan* 📩\n[Sesi #${s.code}]\n\n` +
    `👤 Nama: ${pushName}\n` +
    `📞 Nomor: ${s.buyerNumber || 'disembunyikan'}\n` +
    `💬 _Pembeli ingin chat langsung dengan admin._\n\n` +
    `Silakan *balas pesan ini* dengan:\n` +
    `*Terima* = terhubung (nomormu disembunyikan)\n` +
    `*Tolak* = tolak permintaan`
  for (const num of SUPPORT_ADMINS) {
    await sock.sendMessage(adminJid(num), { text: notice }).catch((e) =>
      console.error(`[support] gagal kirim notif ke ${num}:`, e.message)
    )
  }
  clearNav(sender)
  console.log(`[support] sesi chat-admin #${s.code} <- ${chat}`)
  return reply(
    `📩 *Permintaan terkirim ke admin.*\n\n` +
    `Tunggu sebentar ya, admin akan segera merespons 🙏\n` +
    `_Ketik *akhiri* untuk membatalkan._`
  )
}

// ============ MODE TEKS (iPhone — tanpa tombol) ============
// Navigasi dengan balasan angka; state disimpan via setNav.

async function sendTextMain(ctx) {
  const { sock, chat, sender, pushName, msg } = ctx
  setNav(sender, { page: 'main' })
  const body =
    `Halo *${pushName || 'Kak'}* \u{1F44B}\n\n` +
    `\u{1F6CD}\uFE0F *MENU UTAMA*\n\n` +
    `1. Toko\n` +
    `2. Stock\n` +
    `3. Chat Admin\n` +
    `4. \u2B07\uFE0F Downloader\n` +
    `5. \u2699\uFE0F Tools\n` +
    `6. \uD83C\uDFB5 Zeni Music\n` +
    `7. \uD83C\uDFA8 Stiker (brat, quote chat, video)\n` +
    `\n` +
    `_Balas dengan nomor pilihan._`
  await sock.sendMessage(chat, { text: body }, { quoted: msg })
}

async function sendTextShop(ctx) {
  const { sock, chat, sender, msg } = ctx
  const cats = loadCategories()
  const products = loadProducts()
  setNav(sender, { page: 'shop' })
  const lines = cats.map((c, i) => {
    const n = c.id === SMM_CAT ? catalogCount() : products.filter((p) => p.categoryId === c.id).length
    return `${i + 1}. ${c.emoji} ${c.name}` + (c.id === SMM_CAT ? (n ? ` (${n} layanan)` : '') : (n ? ` (${n} produk)` : ''))
  })
  const body =
    `\u{1F6CD}\uFE0F *Toko \u2014 Daftar Produk*\n\n` +
    lines.join('\n') +
    `\n\n0. Kembali\n_Balas dengan nomor._`
  await sock.sendMessage(chat, { text: body }, { quoted: msg })
}

async function sendTextCategory(ctx, catId) {
  const { sock, chat, sender, msg } = ctx
  const cat = loadCategories().find((c) => c.id === catId)
  if (!cat) return sendTextShop(ctx)
  const products = loadProducts().filter((p) => p.categoryId === catId)
  setNav(sender, { page: 'cat', catId })
  const body =
    `${cat.emoji} *${cat.name}*\n\n` +
    (products.length
      ? products.map((p, i) => `${i + 1}. ${p.title || p.name} \u2014 ${formatRupiah(getProductPrice(p))}`).join('\n')
      : '_Belum ada produk di kategori ini._') +
    `\n\n0. Kembali\n_Balas dengan nomor._`
  await sock.sendMessage(chat, { text: body }, { quoted: msg })
}

async function sendTextProduct(ctx, id) {
  const { sock, chat, sender, msg } = ctx
  const p = loadProducts().find((x) => x.id === id)
  if (!p) return sendTextShop(ctx)
  const price = getProductPrice(p)
  const stok = effectiveStock(p, stockCount(p.id))
  const footer = getCategoryFooter(p.categoryId)
  const canBuy = price > 0 && stok > 0
  setNav(sender, { page: 'prod', productId: p.id, catId: p.categoryId, canBuy })
  const body =
    `*${p.title || p.name}*\n\n` +
    `${p.description || '-'}\n\n` +
    (footer ? `Keterangan\n${footer.split('\n').map((l) => `> ${l}`).join('\n')}\n\n` : '') +
    `\u{1F4B5} Harga : ${formatRupiah(price)}\n\n` +
    `1. ${canBuy ? '\u{1F6D2} Beli Sekarang' : '\u2753 Tanyakan Stok'}\n` +
    `2. Kembali\n` +
    `0. Menu Utama\n\n_Balas dengan nomor._`
  const img = loadCover(p)
  if (img) await sock.sendMessage(chat, { image: img, caption: body }, { quoted: msg })
  else await sock.sendMessage(chat, { text: body }, { quoted: msg })
}
