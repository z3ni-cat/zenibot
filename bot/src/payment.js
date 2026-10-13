import { BOT_NAME } from './brand.js'
// Payment gateway — sayabayar.com (QRIS)
//
// API key via env SAYABAYAR_API_KEY (disimpan aman di server, tidak di kode).
// Alur: createQrisInvoice() -> kirim QR ke pembeli -> orderWatcher mem-poll
// status tiap 30 detik -> paid: kirim stok otomatis | expired: beri tahu pembeli.
const BASE = 'https://api.sayabayar.com/v1'

function apiKey() {
  return process.env.SAYABAYAR_API_KEY || ''
}

export function paymentReady() {
  return Boolean(apiKey())
}

async function api(path, opts = {}) {
  const res = await fetch(`${BASE}${path}`, {
    ...opts,
    headers: {
      'Content-Type': 'application/json',
      'X-API-Key': apiKey(),
      ...(opts.headers || {}),
    },
  })
  const data = await res.json().catch(() => ({}))
  if (!res.ok || data.success === false) {
    throw new Error(data.message || data.error || `sayabayar_http_${res.status}`)
  }
  return data
}

// Buat invoice QRIS. amount dalam rupiah (integer).
// expired_minutes: 60 (minimal dari sayabayar).
export async function createQrisInvoice({ amount, description, customerName }) {
  const data = await api('/invoices', {
    method: 'POST',
    body: JSON.stringify({
      customer_name: customerName || 'Pembeli ' + BOT_NAME,
      amount,
      description,
      payment_method: 'qris',
      expired_minutes: 60,
    }),
  })
  const d = data.data || {}
  const pc = d.payment_channel || {}
  return {
    id: d.id,
    invoiceNumber: d.invoice_number,
    amount: d.amount_to_pay || amount,
    qrisString: pc.qris_string || null,
    paymentUrl: d.payment_url || null,
    expiredAt: d.expired_at || null,
  }
}

// pending | paid | expired | user_confirmed | ...
export async function getInvoiceStatus(id) {
  const data = await api(`/invoices/${id}`)
  return data.data?.status || 'unknown'
}

// Percepat deteksi pembayaran QRIS (opsional, 1-2 detik).
export async function confirmInvoice(id) {
  const data = await api(`/invoices/${id}/confirm`, { method: 'POST' })
  return data.data?.status || 'unknown'
}
