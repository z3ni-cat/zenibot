# 🤖 ZeniBot — Bot WhatsApp Toko Digital

Bot WhatsApp toko digital siap pakai: katalog produk, pembayaran QRIS otomatis, kelola stok, tools gratis.

> **Edisi di repo ini: LITE (gratis).** Butuh semua fitur? Upgrade ke **Full Version** — Rp150.000 sekali bayar.

| Fitur | Lite (repo ini) | Full |
|---|---|---|
| Katalog produk + QRIS otomatis | ✅ | ✅ |
| Maksimal produk | 10 | ♾️ Tanpa batas |
| **Admin panel web** | ❌ | ✅ |
| SMM panel | ❌ | ✅ |
| Market monitor | ❌ | ✅ |
| Jasa generate video AI | ❌ | ✅ |
| Auto-post ke WA Channel | ❌ | ✅ |
| Pesan promo ke owner | tiap 6 jam | ❌ Tidak ada |

## ✨ Fitur (Lite)
- Katalog produk per kategori (aplikasi premium, topup game, voucher, dsb) — maks 10 produk
- Checkout via QRIS otomatis (sayabayar.com) — stok terkirim otomatis setelah bayar
- Antrean stok akun (format `email|password`), rules produk, cover/banner produk
- Sesi tanya-stok: pembeli chat dengan admin saat stok habis

**🧰 Bonus**
- Tools gratis: downloader IG/TikTok, cek resi, konverter PDF
- Reminder pribadi, catatan, stiker maker
- Kopken (katalog minuman) & kelola stok minyak goreng

> Fitur *Full Version*: admin panel web, tanpa batas produk, SMM panel, market monitor, jasa video AI, auto-post WA Channel.

## 🖥️ Kebutuhan

- VPS Linux (Ubuntu 20.04+) — 1 vCPU / 1 GB RAM cukup
- Node.js 20+
- PM2 (`npm i -g pm2`)
- Nomor WhatsApp khusus bot (jangan pakai nomor pribadi utama)

## 🚀 Instalasi cepat

```bash
# 1. Clone & masuk
git clone <repo-ini> zenibot && cd zenibot

# 2. Konfigurasi
cp .env.example .env
nano .env   # isi OWNER_NUMBERS, BOT_NUMBER, SAYABAYAR_API_KEY, dll

# 3. Install & jalankan bot
cd bot && npm install
node index.js   # pertama kali: masukkan kode pairing 8 digit di WA
```

> Untuk produksi, jalankan via PM2 (lihat `ecosystem.config.cjs.example`).

## ⚙️ Konfigurasi (.env)

| Var | Wajib | Keterangan |
|---|---|---|
| `BOT_NAME` / `STORE_NAME` | Ya | Branding bot & toko |
| `OWNER_NUMBERS` | Ya | Nomor owner, dipisah koma |
| `BOT_NUMBER` | Ya | Nomor WA bot |
| `PAIR_METHOD` | Tidak | `code` / `qr` (default: code) |
| `SAYABAYAR_API_KEY` | Ya* | QRIS otomatis via sayabayar.com |
| `SUPPORT_ADMINS` | Tidak | Admin sesi tanya-stok |
| `NEOXR_API_KEY` | Tidak | Tools gratis |
| `LICENSE_KEY` | Tidak | License key Full Version (kosong = Lite). Divalidasi otomatis ke license server saat bot start; key terikat ke 1 perangkat. |
| `LICENSE_SERVER` | Tidak | URL server lisensi (default: server resmi) |
| `SALES_CONTACT` | Tidak | Kontak pembelian Full Version (tampil di pesan promo) |
| `PROMO_EVERY_HOURS` | Tidak | Jeda pesan promo Lite, jam (default 6, 0 = mati) |

\*Tanpa ini checkout QRIS nonaktif; katalog tetap jalan.

## 📁 Struktur

```
zenibot/
├── bot/            # kode bot WhatsApp (Baileys)
│   ├── src/        # logika inti (toko, payment, stok, lisensi, dsb)
│   ├── plugin/     # perintah chat (semua pengguna)
│   ├── owner/      # perintah khusus owner
│   ├── data/       # database JSON (dibuat otomatis)
│   └── assets/     # cover produk & thumbnail
└── .env.example
```

## 📝 Lisensi

Proprietary — lihat `LICENSE`. Dilarang mendistribusikan ulang tanpa izin.
