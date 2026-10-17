// kopken — entry point alur order Kopken (fallback tombol tanpa sesi aktif).
// Alur utama ditangani sesi di src/kopken.js via handler.
import { startKopkenFlow } from '../src/kopken.js'

export default {
  name: 'kopken',
  alias: [],
  description: 'Mulai pesanan Kopken (diproses manual oleh admin)',
  async run(ctx) {
    // sesi sudah kedaluwarsa / tidak ada -> mulai ulang dari awal
    await startKopkenFlow(ctx)
  },
}
