# 🤖 ZeniBot — Bot WhatsApp Toko Digital + Admin Panel

Bot WhatsApp toko digital siap jual: katalog produk, pembayaran QRIS otomatis, kelola stok, SMM panel, tools gratis — plus **admin panel web** untuk kelola semuanya tanpa perlu chat perintah.

## ✨ Fitur

**🛍️ Toko**
- Katalog produk per kategori (aplikasi premium, topup game, voucher, dsb)
- Checkout via QRIS otomatis (sayabayar.com) — stok terkirim otomatis setelah bayar
- Antrean stok akun (format `email|password`), rules produk, cover/banner produk
- Sesi tanya-stok: pembeli chat dengan admin saat stok habis

**📊 Admin Panel** (web)
- Dashboard: omzet, order hari ini, total produk & stok
- CRUD produk (nama, harga, deskripsi, banner, stok) & kategori
- Kelola antrean stok & rules per produk
- Riwayat order (paid / expired / pending)

**🧰 Bonus**
- Tools gratis: downloader IG/TikTok, cek resi, konverter PDF
- SMM panel (djuragansosmed) — jual followers/likes otomatis
- Market monitor, reminder pribadi, catatan, stiker maker
- Kopken (katalog minuman) & kelola stok minyak goreng

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

# 4. Jalankan admin panel (terminal baru)
cd ../admin && npm install
node server.js  # buka http://IP-VPS:3004, buat password saat pertama dibuka
```

> Untuk produksi, jalankan keduanya via PM2 (lihat `ecosystem.config.cjs.example`).
> Pasang reverse proxy (Nginx/Apache) + HTTPS di depan admin panel.

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
| `DJURAGAN_API_KEY` | Tidak | SMM panel |

\*Tanpa ini checkout QRIS nonaktif; katalog tetap jalan.

## 📁 Struktur

```
zenibot/
├── bot/            # kode bot WhatsApp (Baileys)
│   ├── src/        # logika inti (toko, payment, stok, dsb)
│   ├── plugins/    # perintah chat
│   ├── data/       # database JSON (dibuat otomatis)
│   └── assets/     # cover produk & thumbnail
├── admin/          # admin panel web (Express)
└── .env.example
```

## 📝 Lisensi

Proprietary — lihat `LICENSE`. Dilarang mendistribusikan ulang tanpa izin.
