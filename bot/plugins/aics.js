// AI Customer Service "Asist" — sapaan + toggle owner.
// Pesan tak dikenal (private, non-owner) ditangani handleAicsMessage() dari handler.js.
import { sendButtons } from '../src/buttons.js';
import { getDevice, setNav, isOwnerSender } from '../src/deviceMode.js';
import { isEnabled, setEnabled, hasGreeted, markGreeted, askAI } from '../src/aics.js';
import { STORE_NAME } from '../src/brand.js'

const GREET =
  `Halo Kak! 👋 Ada yang bisa kubantu?\n\n` +
  `Aku *Asist*, CS AI ${STORE_NAME}. Aku bisa bantu info:\n` +
  `• Produk & harga\n` +
  `• Stok barang\n` +
  `• Layanan & tools\n\n` +
  `Ketik aja pertanyaanmu! 💬`;

export async function sendAicsGreeting(ctx) {
  const { sock, chat, sender, msg } = ctx;
  if (getDevice(sender) === 'iphone') {
    setNav(sender, { page: 'aics' });
    await sock.sendMessage(chat, {
      text: GREET + `\n\n1. 🛍️ Lihat Produk\n\n_Balas dengan nomor._`,
    }, { quoted: msg });
    return;
  }
  await sendButtons(sock, chat, {
    body: GREET,
    footer: STORE_NAME + ' • Asist AI',
    buttons: [{ id: 'ui:shop', text: '🛍️ Lihat Produk' }],
  }, { quoted: msg });
}

// return true jika ditangani
export async function handleAicsMessage(ctx, text) {
  const { chat, sender, senderNumber, config, reply } = ctx;
  if (chat.endsWith('@g.us')) return false;                    // grup: skip
  if (isOwnerSender(config, sender, senderNumber)) return false;
  if (!isEnabled()) return false;
  const t = (text || '').trim();
  if (!t || t.length > 1000) return false;
  if (!hasGreeted(sender)) {
    await sendAicsGreeting(ctx);
    markGreeted(sender);
  }
  const ans = await askAI(sender, t);
  if (ans === null) return true; // cooldown — diam
  await reply(ans);
  return true;
}

export default {
  name: '+aics',
  description: 'Toggle AI Customer Service (owner)',
  async run(ctx) {
    const { args, reply, config, sender, senderNumber } = ctx;
    if (!isOwnerSender(config, sender, senderNumber)) return;
    const v = (args[0] || '').toLowerCase();
    if (v === 'on') { setEnabled(true); return reply('✅ AI Customer Service *aktif*.') }
    if (v === 'off') { setEnabled(false); return reply('⛔ AI Customer Service *nonaktif*.') }
    return reply(`AI CS Asist: ${isEnabled() ? 'aktif ✅' : 'nonaktif ⛔'}\nPakai: *+aics on/off*`);
  },
};
