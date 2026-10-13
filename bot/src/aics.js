// AI Customer Service "Asist" — jawab HANYA dari data ekosistem ZeniCat.
// Model: GLM gratis via toolsapi -> 9Router (VPS 1).
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { STORE_NAME } from './brand.js'

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DATA = path.join(__dirname, '..', 'data');
const TOOLSAPI = 'https://zenicat.net/api';
const TOOLSAPI_KEY = process.env.TOOLSAPI_KEY || '';
const STATE_FILE = path.join(DATA, 'aics.json');

const loadJson = (f, fb) => { try { return JSON.parse(fs.readFileSync(f, 'utf8')) } catch { return fb } };
const saveJson = (f, o) => { try { fs.mkdirSync(path.dirname(f), { recursive: true }); fs.writeFileSync(f, JSON.stringify(o, null, 2)) } catch {} };

// ---------- state ----------
const getState = () => loadJson(STATE_FILE, { enabled: true, greeted: {} });
const saveState = (s) => saveJson(STATE_FILE, s);
export const isEnabled = () => getState().enabled !== false;
export const setEnabled = (v) => { const s = getState(); s.enabled = v; saveState(s) };
export const hasGreeted = (sender) => !!getState().greeted[sender];
export const markGreeted = (sender) => { const s = getState(); s.greeted[sender] = Date.now(); saveState(s) };

// ---------- knowledge: ringkasan ekosistem (cache 10 mnt) ----------
let K_CACHE = null, K_AT = 0;
export function buildKnowledge() {
  if (K_CACHE && Date.now() - K_AT < 600000) return K_CACHE;
  const L = [];
  L.push('TOKO: ' + STORE_NAME + ' — toko digital via WhatsApp. Jual: aplikasi premium, topup game, SMM panel (followers/likes), voucher, token listrik, dan minuman Kopken. Bayar via QRIS (kadaluarsa 60 menit). Ketik *menu* untuk katalog.');
  try {
    const prods = loadJson(path.join(DATA, 'products.json'), []);
    L.push(`PRODUK (${prods.length}):`);
    for (const p of prods.slice(0, 40)) {
      const price = Number(p.price || 0).toLocaleString('id-ID');
      L.push(`- ${p.name} | Rp${price} | stok ${p.stock ?? '?'} | ${(p.description || '').replace(/\n/g, ' ').slice(0, 70)}`);
    }
  } catch {}
  try {
    const smm = loadJson(path.join(DATA, 'smm_catalog.json'), {});
    const gnames = Object.keys(smm.groups || {});
    if (gnames.length) L.push(`SMM PANEL (${gnames.length} kategori: ${gnames.slice(0, 10).join(', ')}) — tambah followers/likes/views. Pesan via perintah *smm*.`);
  } catch {}
  try {
    const kop = loadJson(path.join(DATA, 'kopken.json'), {});
    const cities = kop.cities || [];
    if (cities.length) L.push(`KOPKEN: ${cities.length} kota (${cities.slice(0, 6).map((c) => c.name).join(', ')}...), ratusan outlet. Pesan via perintah *kopken*, pembayaran manual ke admin.`);
  } catch {}
  L.push('TOOLS GRATIS: downloader TikTok/IG, cek resi paket, quote iPhone, hapus background foto, upscale foto.');
  L.push('CARA BELI: buka katalog (*menu*) → pilih produk → bayar QRIS → akun/barang dikirim otomatis.');
  K_CACHE = L.join('\n');
  K_AT = Date.now();
  return K_CACHE;
}

// ---------- panggil AI ----------
const hist = new Map(); // sender -> [{role, content}]
const cool = new Map(); // sender -> ts (anti-spam 5 dtk)
const SYS = (knowledge) =>
`Kamu adalah Asist, CS AI toko WhatsApp ${STORE_NAME}. Jawab HANYA berdasarkan DATA EKOSISTEM di bawah. Aturan mutlak:
- Bahasa Indonesia santai, ramah, singkat (maks 4 kalimat kecuali ditanya detail).
- JANGAN mengarang harga, stok, atau produk yang tidak ada di data. Kalau tidak ada di data, bilang terus terang tidak tahu.
- Topik di luar ekosistem (berita, politik, PR sekolah, curhat, dll) → tolak sopan: "Maaf Kak, aku cuma bisa bantu seputar produk & layanan ${STORE_NAME} 🙏" lalu arahkan ketik *menu*.
- Jangan mengaku sebagai AI generik/model bahasa. Kamu Asist.
- Format WhatsApp saja: *bold*, _italic_.

DATA EKOSISTEM:
${knowledge}`;

export async function askAI(sender, text) {
  const now = Date.now();
  if (now - (cool.get(sender) || 0) < 5000) return null; // cooldown: diam
  cool.set(sender, now);
  const h = hist.get(sender) || [];
  const messages = [
    { role: 'system', content: SYS(buildKnowledge()) },
    ...h.slice(-6),
    { role: 'user', content: text.slice(0, 800) },
  ];
  try {
    const r = await fetch(TOOLSAPI + '/v1/ai/chat', {
      method: 'POST',
      headers: { 'x-api-key': TOOLSAPI_KEY, 'content-type': 'application/json' },
      body: JSON.stringify({ messages, max_tokens: 400, temperature: 0.3 }),
      signal: AbortSignal.timeout(55000),
    });
    const j = await r.json();
    if (!j.ok || !j.text) return 'Maaf Kak, AI-ku lagi sibuk 🙏 Coba lagi sebentar ya, atau ketik *menu* untuk lihat katalog.';
    h.push({ role: 'user', content: text.slice(0, 300) }, { role: 'assistant', content: j.text.slice(0, 600) });
    hist.set(sender, h.slice(-8));
    return j.text;
  } catch {
    return 'Maaf Kak, AI-ku lagi gangguan 🙏 Ketik *menu* untuk lihat katalog atau hubungi admin ya.';
  }
}
