// Helper kecil: sapaan berdasarkan waktu WIB & util lain
export function wibHour(d = new Date()) {
  const parts = new Intl.DateTimeFormat('id-ID', {
    timeZone: 'Asia/Jakarta', hour: 'numeric', hour12: false,
  }).formatToParts(d)
  return Number(parts.find((p) => p.type === 'hour').value)
}

export function greeting(d = new Date()) {
  const h = wibHour(d)
  if (h >= 4 && h < 11) return 'Selamat Pagi'
  if (h >= 11 && h < 15) return 'Selamat Siang'
  if (h >= 15 && h < 18) return 'Selamat Sore'
  return 'Selamat Malam'
}

export function jidToNumber(jid = '') {
  return jid.split('@')[0].split(':')[0]
}

// 40000 -> "Rp40.000"
export function formatRupiah(n) {
  const num = Number(n) || 0
  return 'Rp' + num.toString().replace(/\B(?=(\d{3})+(?!\d))/g, '.')
}

// KSR-X7K2P9 — kode invoice internal (tanpa huruf ambigu I/O/0/1)
export function makeInvoiceCode(prefix = process.env.INVOICE_PREFIX || 'INV') {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
  let s = ''
  for (let i = 0; i < 6; i++) s += chars[Math.floor(Math.random() * chars.length)]
  return `${prefix}-${s}`
}

// 1 Okt 2026, 00:31 WIB
export function formatWib(d = new Date()) {
  const s = new Intl.DateTimeFormat('id-ID', {
    timeZone: 'Asia/Jakarta',
    day: 'numeric', month: 'short', year: 'numeric',
    hour: '2-digit', minute: '2-digit', hour12: false,
  }).format(d)
  return s.replace(/\./g, ':') + ' WIB'
}
