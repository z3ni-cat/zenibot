// Contoh plugin sederhana: ping
export default {
  name: 'ping',
  alias: [],
  description: 'Cek kecepatan respon bot',
  async run({ reply }) {
    const start = Date.now()
    await reply('🏓 Pong!')
    await reply(`Kecepatan respon: ${Date.now() - start} ms`)
  },
}
