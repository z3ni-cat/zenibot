// Sanitasi teks pesan masuk — pertahanan terhadap karakter aneh (virtex dkk).
// Dipakai di handler.js untuk membersihkan teks SEBELUM diproses plugin.
// - Normalisasi Unicode NFC (bentuk kanonik)
// - Buang karakter tak terlihat / pengacau:
//   * C0 & C1 control (kecuali \t \n \r)
//   * zero-width & bidi override: U+200B-U+200F, U+202A-U+202E, U+2066-U+2069
//   * BOM U+FEFF
// - Potong teks super panjang (batas 4000 char — cukup untuk semua perintah)
const MAX_LEN = 4000
// Dibangun via fromCharCode agar tidak ada karakter invisible literal di source.
const BAD_RANGES = [
  [0x0000, 0x0008], [0x000B, 0x000C], [0x000E, 0x001F], // C0 (kecuali \t \n \r)
  [0x007F, 0x009F],                                     // DEL & C1
  [0x200B, 0x200F],                                     // zero-width & bidi marks
  [0x202A, 0x202E],                                     // bidi embeddings/overrides
  [0x2066, 0x2069],                                     // bidi isolates
  [0xFEFF, 0xFEFF],                                     // BOM / zero-width nbsp
]
const BAD_SET = new Set()
for (const [a, b] of BAD_RANGES)
  for (let c = a; c <= b; c++) BAD_SET.add(String.fromCharCode(c))

export function sanitizeText(input) {
  if (!input) return ''
  let t = String(input).normalize('NFC')
  let out = ''
  for (const ch of t) if (!BAD_SET.has(ch)) out += ch
  if (out.length > MAX_LEN) out = out.slice(0, MAX_LEN)
  return out
}
