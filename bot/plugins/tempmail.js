// Plugin TempMail — UX lengkap dengan tombol
// Commands: tempmail | inbox
// Button callbacks: ui:tm_inbox | ui:tm_refresh | ui:tm_read:<id>
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { sendButtons } from '../src/buttons.js';
import { STORE_NAME } from '../src/brand.js'

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DATA_FILE = path.join(__dirname, '..', 'data', 'tempmail.json');
const API = 'https://ksrcloud.my.id/tempmail/api';

function load() {
  try { return JSON.parse(fs.readFileSync(DATA_FILE, 'utf8')); } catch { return {}; }
}
function save(o) {
  fs.mkdirSync(path.dirname(DATA_FILE), { recursive: true });
  fs.writeFileSync(DATA_FILE, JSON.stringify(o, null, 2));
}
async function api(p, method = 'GET') {
  const res = await fetch(API + p, { method });
  if (!res.ok) throw new Error('API error ' + res.status);
  return res.json();
}
function fmtTime(ts) {
  return new Date(ts * 1000).toLocaleString('id-ID', { timeZone: 'Asia/Jakarta' });
}

async function showEmail(ctx, address, expiresAt) {
  const { sock, chat, msg } = ctx;
  const text = `📧 Email: \`${address}\`\n\n> ⌛ Waktu Kadaluarsa: ${fmtTime(expiresAt)} WIB`;
  await sendButtons(sock, chat, {
    body: text,
    buttons: [{ id: 'ui:tm_inbox', text: '📥 Inbox' }],
  }, { quoted: msg });
}

async function showInbox(ctx) {
  const { sock, chat, msg, sender } = ctx;
  const data = load();
  const user = data[sender];
  if (!user) {
    await ctx.reply('Belum punya email. Ketik *tempmail* dulu.');
    return;
  }
  try {
    const emails = await api('/addresses/' + encodeURIComponent(user.address) + '/emails');
    if (!emails.length) {
      await sendButtons(sock, chat, {
        body: `🫣 _Masih Kosong_\n\nBelum ada email masuk di \`${user.address}\``,
        buttons: [{ id: 'ui:tm_refresh', text: '🔄 Refresh' }],
      }, { quoted: msg });
      return;
    }
    let text = `Terdapat Email Masuk: (${emails.length})\n\n`;
    const buttons = [];
    for (const e of emails.slice(0, 5)) {
      text += `📄 *${e.subject || '(tanpa subjek)'}* | \`${e.id}\`\n`;
      buttons.push({ id: `ui:tm_read:${e.id}`, text: `📖 ${e.id}` });
    }
    text += `\nMana yang ingin kamu baca?`;
    buttons.push({ id: 'ui:tm_refresh', text: '🔄 Refresh' });
    await sendButtons(sock, chat, { body: text, buttons }, { quoted: msg });
  } catch (e) {
    await ctx.reply('❌ Gagal cek inbox.');
  }
}

async function readEmail(ctx, id) {
  const { reply } = ctx;
  try {
    const email = await api('/emails/' + id);
    let body = email.body_text || '';
    if (!body && email.body_html) {
      let html = email.body_html;
      html = html.replace(/<style[^>]*>[\s\S]*?<\/style>/gi, ' ');
      html = html.replace(/<script[^>]*>[\s\S]*?<\/script>/gi, ' ');
      body = html.replace(/<[^>]+>/g, ' ');
      body = body.replace(/&nbsp;/gi, ' ').replace(/&amp;/gi, '&')
        .replace(/&lt;/gi, '<').replace(/&gt;/gi, '>')
        .replace(/&quot;/gi, '"').replace(/&#39;/gi, "'")
        .replace(/&#x27;/gi, "'").replace(/&#x2F;/gi, '/');
      body = body.replace(/\r\n?/g, '\n');
      body = body.replace(/[ \t]+\n/g, '\n').replace(/\n[ \t]+/g, '\n');
      body = body.replace(/\n{3,}/g, '\n\n').replace(/[ \t]{2,}/g, ' ').trim();
    }
    if (body.length > 1500) body = body.slice(0, 1500) + '...';
    await reply(`📨 *${email.subject || '(tanpa subjek)'}*\nDari: ${email.from}\n\n${body || '_(kosong)_'}`);
  } catch (e) {
    await reply('❌ Email tidak ditemukan.');
  }
}

export default {
  name: 'tempmail',
  alias: ['email', 'inbox', 'tm_inbox', 'tm_refresh', 'tm_read'],
  description: 'Email sementara dari TempMail ' + STORE_NAME,
  async run(ctx) {
    const { command, args, sender, reply, sock, chat, msg } = ctx;
    // HIDE 9 Okt 2026 — sinkronisasi iPhone; hapus 3 baris ini utk aktifkan lagi
    await reply('📧 *TempMail* lagi disembunyikan sementara.\n\nBalik lagi nanti ya!');
    return;

    // Button callbacks
    if (command === 'tm_inbox' || command === 'tm_refresh') {
      await showInbox(ctx);
      return;
    }
    if (command === 'tm_read') {
      await readEmail(ctx, args[0]);
      return;
    }

    // Direct commands
    if (command === 'tempmail' || command === 'email') {
      try {
        const result = await api('/addresses', 'POST');
        const data = load();
        data[sender] = { address: result.address, created: Date.now() };
        save(data);
        await showEmail(ctx, result.address, result.expires_at);
      } catch (e) {
        await reply('❌ Gagal buat email. Coba lagi nanti.');
      }
      return;
    }
    if (command === 'inbox') {
      await showInbox(ctx);
      return;
    }
  },
};
