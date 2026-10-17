// Plugin Tools Gratis — UI kategori/daftar tool (Android: tombol, iPhone: teks bernomor).
import config from '../config.js'
import { sendList } from '../src/buttons.js'
import { getDevice, setNav } from '../src/deviceMode.js'
import { startToolSession } from '../src/toolSession.js'
import { TOOL_CATS, TOOLS } from '../src/freetools.js'

async function showToolCats(ctx) {
  const { sock, chat, msg, reply } = ctx
  if (getDevice(ctx.sender) === 'iphone') {
    setNav(ctx.sender, { page: 'toolcats' })
    const lines = TOOL_CATS.map((c, i) => `${i + 1}. ${c.emoji} ${c.name} — ${c.desc}`)
    return reply(`🛠️ *TOOLS GRATIS*\n\n_Pilih kategori:_\n\n${lines.join('\n')}\n\n0. Kembali\n\n_Balas dengan nomor._`)
  }
  await sendList(sock, chat, {
    body: `🛠️ *TOOLS GRATIS*\n\n_Pilih kategori:_`,
    footer: config.name,
    buttonTitle: '🛠️ Pilih',
    sections: [{
      title: 'Kategori tools',
      rows: TOOL_CATS.map((c) => ({
        title: `${c.emoji} ${c.name}`, description: c.desc, id: `ui:toolcat:${c.id}`,
      })),
    }],
    quickButtons: [{ id: 'ui:menu', text: '🏠 Menu Utama' }],
  }, { quoted: msg })
}

async function showToolCat(ctx, catId) {
  const { sock, chat, sender, msg, reply } = ctx
  const cat = TOOL_CATS.find((c) => c.id === catId)
  if (!cat) return reply('❌ _Kategori tidak ditemukan._')
  const tools = TOOLS.filter((t) => t.cat === catId)
  if (getDevice(sender) === 'iphone') {
    setNav(sender, { page: 'toolcat', catId })
    if (!tools.length) {
      return reply(`${cat.emoji} *${cat.name}*\n\n_Segera hadir._\n\n0. Kembali\n\n_Balas dengan nomor._`)
    }
    const lines = tools.map((t, i) => `${i + 1}. ${t.emoji} ${t.name} — ${t.desc}`)
    return reply(`${cat.emoji} *${cat.name}*\n\n_Pilih tool:_\n\n${lines.join('\n')}\n\n0. Kembali\n\n_Balas dengan nomor._`)
  }
  setNav(sender, { page: 'toolcat', catId })
  if (!tools.length) {
    return reply(`${cat.emoji} *${cat.name}*\n\n_Segera hadir._`)
  }
  await sendList(sock, chat, {
    body: `${cat.emoji} *${cat.name}*\n\n_Pilih tool:_`,
    footer: config.name,
    buttonTitle: '🛠️ Pilih Tool',
    sections: [{
      title: 'Tools gratis',
      rows: tools.map((t) => ({
        title: `${t.emoji} ${t.name}`,
        description: t.desc,
        id: t.id === 'tempmail' ? `ui:tempmail` : `ui:tool:${t.id}`
      })),
    }],
    quickButtons: [{ id: 'ui:menu', text: '🏠 Menu Utama' }],
  }, { quoted: msg })
}

async function startTool(ctx, toolId) {
  const { sender, reply } = ctx
  const tool = TOOLS.find((t) => t.id === toolId)
  if (!tool) return reply('❌ _Tool tidak ditemukan._')
  startToolSession(sender, toolId)
  await reply(tool.prompt)
}

export default {
  name: 'tools',
  alias: ['toolcat', 'tool'],
  description: 'Tools gratis (downloader & utilitas)',
  async run(ctx) {
    const { command, args } = ctx
    if (command === 'toolcat') return showToolCat(ctx, args[0])
    if (command === 'tool') return startTool(ctx, args[0])
    return showToolCats(ctx)
  },
}
