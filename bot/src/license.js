// Sistem lisensi ZeniBot — edisi Lite (gratis) vs Full (berbayar).
//
//   LICENSE_TIER   'lite' (default) | 'premium'
//   LITE_MAX_PRODUCTS  batas produk di Lite (default 10)
//   FULL_PRICE       harga full version (default Rp150.000)
//   SALES_CONTACT    kontak pembelian (mis. https://wa.me/628xx)
//   PROMO_EVERY_HOURS  jeda pesan promo ke owner, jam (default 6, 0 = mati)
//
// Cara upgrade ke Full: beli lisensi, dapat file lisensi + admin panel,
// lalu set LICENSE_TIER=premium di .env.
export const TIER = String(process.env.LICENSE_TIER || 'lite').toLowerCase()
export const isPremium = () => TIER === 'premium'
export const LITE_MAX_PRODUCTS = Math.max(1, parseInt(process.env.LITE_MAX_PRODUCTS || '10', 10))
export const FULL_PRICE = process.env.FULL_PRICE || 'Rp150.000'
export const SALES_CONTACT = process.env.SALES_CONTACT || ''
export const PROMO_EVERY_HOURS = parseFloat(process.env.PROMO_EVERY_HOURS || '6')

const contactLine = () =>
  SALES_CONTACT ? `\n📞 Hubungi: ${SALES_CONTACT}` : ''

export function upsellText(feature) {
  return (
    `🔓 *Fitur Premium* — ${feature} hanya tersedia di *ZeniBot Full Version*.\n\n` +
    `Buka semua fitur (${FULL_PRICE}, sekali bayar):\n` +
    `✅ Admin panel web\n` +
    `✅ Tanpa batas produk\n` +
    `✅ SMM panel & market monitor\n` +
    `✅ Jasa generate video AI\n` +
    `✅ Tanpa pesan promo` +
    contactLine()
  )
}

export function promoText() {
  return (
    `💡 *Suka dengan ZeniBot?*\n\n` +
    `Kamu memakai versi Lite (gratis). Upgrade ke *Full Version* — ${FULL_PRICE} sekali bayar, dapatkan:\n` +
    `✅ Admin panel web (kelola toko tanpa perintah chat)\n` +
    `✅ Tanpa batas jumlah produk\n` +
    `✅ SMM panel, market monitor & jasa video AI\n` +
    `✅ Tanpa pesan promo ini 😄` +
    contactLine()
  )
}
