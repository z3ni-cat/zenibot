// Plugin loader: baca semua file .js di folder plugin/ dan owner/
// Setiap plugin wajib: export default { name, run } dan opsional { alias, description }
import { readdir } from 'fs/promises'
import path from 'path'

export async function loadPlugins(dir) {
  const map = new Map()
  let files = []
  try {
    files = (await readdir(dir)).filter((f) => f.endsWith('.js'))
  } catch {
    console.log(`[loader] folder plugin tidak ditemukan: ${dir}`)
    return map
  }
  for (const f of files) {
    try {
      const mod = await import(path.join(dir, f))
      const p = mod.default
      if (!p?.name || typeof p.run !== 'function') {
        console.log(`[loader] lewati ${f}: format plugin tidak valid`)
        continue
      }
      const name = p.name.toLowerCase()
      map.set(name, p)
      for (const a of p.alias || []) map.set(String(a).toLowerCase(), p)
      console.log(`[loader] dimuat: ${p.name}`)
    } catch (e) {
      console.log(`[loader] gagal memuat ${f}: ${e.message}`)
    }
  }
  return map
}
