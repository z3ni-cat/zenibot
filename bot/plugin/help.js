// help — daftar semua perintah bot beserta fungsinya. Alias: perintah
// Perintah khusus owner hanya ditampilkan ke owner.
// Format rapi: - perintah : fungsi
import { isAdmin } from '../src/admin.js'

const UMUM = [
  ['menu', 'buka menu utama toko'],
  ['ping', 'cek kecepatan respon bot'],
  ['tanya', 'tanyakan stok produk ke admin'],
  ['market', 'analisis teknikal market, cth: market GC=F'],
  ['tools', 'buka tools gratis (downloader, converter, cek resi)'],
  ['stiker', 'kirim foto dengan caption stiker = jadi stiker WA'],
  ['zenimusic', 'info rilis Zeni Music + link download APK'],
  ['smm', 'layanan SMM (followers, likes, views)'],
  ['kopken', 'pesan Kopi Kenangan (diproses admin)'],
  ['linkme', 'dapatkan link share bot WhatsApp'],
  ['tempmail', 'buat email sementara'],
  ['hubungi', 'sambungkan admin dengan pembeli'],
  ['beli', 'dijalankan via tombol Beli Sekarang di detail produk'],
  ['aics', 'AI customer service (tanya jawab otomatis)'],
  ['catat <isi>', 'simpan catatan pribadi'],
  ['catatan', 'lihat semua catatan'],
  ['catatan <nomor>', 'baca satu catatan'],
  ['hapuscatatan <nomor>', 'hapus satu catatan'],
  ['ingatin <waktu> <pesan>', 'pasang pengingat pribadi'],
  ['reminder', 'daftar pengingat yang aktif'],
  ['hapusreminder <nomor>', 'batalkan pengingat'],
  ['minyak', 'sesi kelola minyak goreng (PO, jual, laporan)'],
  ['laku <jumlah>', 'catat penjualan minyak langsung'],
  ['stokminyak', 'cek sisa stok minyak'],
  ['laporanminyak', 'laporan lengkap minyak goreng'],
]

const OWNER = [
  ['chanauto', 'auto-post GitHub ke WA Channel'],
  ['chantest', 'tes posting ke WhatsApp Channel'],
  ['join <link>', 'bot gabung grup via link invite'],
  ['setpp', 'kirim foto + caption setpp = ganti foto profil bot'],
  ['+produk', 'tambah/ubah produk'],
  ['-produk', 'hapus produk'],
  ['+stock', 'tambah stok akun produk'],
  ['-stock', 'kosongkan stok produk'],
  ['+rules', 'atur rules/format akun produk'],
  ['+harga', 'ubah harga produk'],
  ['virtextest', 'uji ketahanan bot terhadap virtex'],
]

export default {
  name: 'help',
  alias: ['perintah'],
  description: 'Menampilkan daftar semua perintah & fungsinya',
  async run({ sender, senderNumber, config, reply }) {
    const admin = isAdmin(config, sender, senderNumber)
    const fmt = (list) => list.map(([c, f]) => `- ${c} : ${f}`).join('\n')
    let msg = '📖 *DAFTAR PERINTAH*\n\n*Umum*\n' + fmt(UMUM)
    if (admin) msg += '\n\n*🔧 Khusus Owner*\n' + fmt(OWNER)
    return reply(msg)
  },
}
