const $ = (id) => document.getElementById(id)
const rupiah = (n) => 'Rp' + Number(n || 0).toLocaleString('id-ID')
function toast(msg, err) {
  const t = $('toast'); t.textContent = msg; t.className = 'toast' + (err ? ' error' : '')
  t.classList.remove('hidden'); setTimeout(() => t.classList.add('hidden'), 2600)
}
async function api(path, opts = {}) {
  const r = await fetch(path, { ...opts, headers: { 'Content-Type': 'application/json', ...(opts.headers || {}) } })
  const d = await r.json().catch(() => ({}))
  if (!r.ok) throw new Error(d.error || 'gagal')
  return d
}
function esc(s) { return String(s ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c])) }

// ---------- login ----------
async function init() {
  const me = await api('api/me')
  const setup = await api('api/setup-needed')
  if (me.user) { enterApp() } else {
    $('app').classList.add('hidden'); $('login-view').classList.remove('hidden')
    if (setup.needed) {
      $('login-form').classList.add('hidden')
      $('setup-form').classList.remove('hidden')
    }
  }
}
function loginErr(msg) { $('login-err').textContent = msg; $('login-err').classList.remove('hidden') }
async function doSetup() {
  const t = $('stoken').value.trim(), p1 = $('spw').value, p2 = $('spw2').value
  if (!t) return loginErr('isi token setup dari Fein')
  if (p1.length < 6) return loginErr('password minimal 6 karakter')
  if (p1 !== p2) return loginErr('password tidak sama')
  try {
    await api('api/setup', { method: 'POST', body: JSON.stringify({ token: t, password: p1 }) })
    enterApp()
  } catch (e) { loginErr(e.message) }
}
async function doLogin() {
  try {
    await api('api/login', { method: 'POST', body: JSON.stringify({ password: $('pw').value }) })
    enterApp()
  } catch (e) { $('login-err').textContent = e.message; $('login-err').classList.remove('hidden') }
}
async function doLogout() { await api('api/logout', { method: 'POST' }); location.reload() }
$('pw')?.addEventListener('keydown', (e) => { if (e.key === 'Enter') doLogin() })

function enterApp() {
  $('login-view').classList.add('hidden'); $('app').classList.remove('hidden')
  loadStats(); loadProducts(); loadCategories(); loadOrders()
}
function showTab(t) {
  document.querySelectorAll('#tabs button').forEach((b) => b.classList.toggle('active', b.dataset.tab === t))
  document.querySelectorAll('.tab').forEach((s) => s.classList.add('hidden'))
  $('tab-' + t).classList.remove('hidden')
}

// ---------- dashboard ----------
async function loadStats() {
  const s = await api('api/stats')
  $('stats').innerHTML = [
    [s.products, 'Produk'], [s.categories, 'Kategori'], [s.stockTotal, 'Total stok'],
    [s.ordersToday, 'Order hari ini'], [s.ordersPaid, 'Order lunas'],
    [rupiah(s.revenue), 'Omzet lunas'],
  ].map(([v, l]) => `<div class="stat"><div class="v">${v}</div><div class="l">${l}</div></div>`).join('')
  const recent = await api('api/orders?limit=5')
  $('recent-orders').innerHTML = recent.map(orderRow).join('') || '<div class="muted">Belum ada order</div>'
}
function orderRow(o) {
  const t = new Date(o.createdAt).toLocaleString('id-ID', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })
  return `<div class="row"><div><b>${esc(o.invoiceCode || '')}</b> — ${esc(o._pname || o.productName || '')}
    <div class="sub">${rupiah(o.amount)} · ${t}</div></div>
    <span class="badge ${o.status}">${o.status}</span></div>`
}

// ---------- produk ----------
let catCache = []
async function loadCategories() {
  catCache = await api('api/categories')
  $('pcat').innerHTML = '<option value="">Semua kategori</option>' +
    catCache.map((c) => `<option value="${c.id}">${c.emoji} ${esc(c.name)}</option>`).join('')
  $('cat-list').innerHTML = catCache.map((c) => `
    <div class="row"><div>${c.emoji} <b>${esc(c.name)}</b><div class="sub">id: ${c.id}</div></div>
    <div><button class="btn small" onclick='openCategoryModal(${JSON.stringify(c.id)})'>Edit</button>
    <button class="btn small danger" onclick="delCategory('${c.id}')">Hapus</button></div></div>`).join('')
}
async function loadProducts() {
  const q = $('pq').value, cat = $('pcat').value
  const list = await api(`api/products?q=${encodeURIComponent(q)}&cat=${encodeURIComponent(cat)}`)
  const catName = (id) => { const c = catCache.find((x) => x.id === id); return c ? c.emoji + ' ' + c.name : '-' }
  $('product-grid').innerHTML = list.map((p) => `
    <div class="pcard">
      <img src="api/covers/${p.id}?t=${Date.now()}" loading="lazy" onerror="this.style.display='none'">
      <div class="body">
        <div class="name">${esc(p.name)}</div>
        <div class="meta">${catName(p.categoryId)} · antrean: ${p.stockQueue} · manual: ${p.stock}</div>
        <div class="price">${rupiah(p.price)}</div>
        <div class="actions">
          <button class="btn small" onclick="openProductModal('${p.id}')">Edit</button>
          <button class="btn small" onclick="openStockModal('${p.id}','${esc(p.name)}')">Stok</button>
          <button class="btn small danger" onclick="delProduct('${p.id}')">Hapus</button>
        </div>
      </div>
    </div>`).join('') || '<div class="muted">Tidak ada produk</div>'
}
function openProductModal(id) {
  const isEdit = !!id
  api('api/products/' + id).then((p) => fillProductModal(p, true)).catch(() => fillProductModal(null, false))
  async function fillProductModal(p, edit) {
    if (!edit && isEdit) return // masih loading
    const cats = catCache.map((c) => `<option value="${c.id}" ${p?.categoryId === c.id ? 'selected' : ''}>${c.emoji} ${esc(c.name)}</option>`).join('')
    $('modal-body').innerHTML = `
      <h2>${edit ? 'Edit' : 'Tambah'} Produk</h2>
      ${edit ? `<img class="preview" src="api/covers/${p.id}?t=${Date.now()}">` : ''}
      <label>Nama produk *</label><input id="f-name" value="${esc(p?.name || '')}" ${edit ? 'disabled' : ''}>
      <label>Judul tampil</label><input id="f-title" value="${esc((p?.title || '').replace(/^\*|\*$/g, ''))}" placeholder="cth: Netflix Sharing">
      <label>Kategori</label><select id="f-cat"><option value="">—</option>${cats}</select>
      <div class="frow">
        <div><label>Harga (Rp) *</label><input id="f-price" type="number" min="0" value="${p?.price ?? ''}"></div>
        <div><label>Stok manual</label><input id="f-stock" type="number" min="0" value="${p?.stock ?? 0}"></div>
      </div>
      <label>Banner / thumbnail (opsional — kosong = thumbnail default)</label>
      <input id="f-cover" type="file" accept="image/*">
      ${edit ? `<label style="margin-top:4px"><input type="checkbox" id="f-rmcover" style="width:auto"> hapus banner (kembali ke default)</label>` : ''}
      <label>Deskripsi</label><textarea id="f-desc">${esc(p?.description || '')}</textarea>
      <label>Rules (maks 500 karakter, opsional)</label><textarea id="f-rules" style="min-height:60px">${esc(p?.rules || '')}</textarea>
      <div class="mactions">
        <button class="btn" onclick="closeModal()">Batal</button>
        <button class="btn primary" onclick="saveProduct('${edit ? p.id : ''}')">Simpan</button>
      </div>`
    $('modal').classList.remove('hidden')
  }
}
async function saveProduct(id) {
  const fd = new FormData()
  const v = (x) => $(x).value
  fd.append('name', v('f-name')); fd.append('title', v('f-title'))
  fd.append('categoryId', v('f-cat')); fd.append('price', v('f-price'))
  fd.append('stock', v('f-stock')); fd.append('description', v('f-desc'))
  fd.append('rules', v('f-rules'))
  const cov = $('f-cover').files[0]; if (cov) fd.append('cover', cov)
  if ($('f-rmcover')?.checked) fd.append('removeCover', '1')
  try {
    const r = await fetch(id ? `api/products/${id}` : 'api/products', { method: id ? 'PUT' : 'POST', body: fd })
    const d = await r.json().catch(() => ({}))
    if (!r.ok) throw new Error(d.error || 'gagal')
    closeModal(); toast('✅ Produk tersimpan'); loadProducts(); loadStats()
  } catch (e) { toast('❌ ' + e.message, true) }
}
async function delProduct(id) {
  if (!confirm('Hapus produk ini? (cover & stok ikut terhapus)')) return
  try { await api('api/products/' + id, { method: 'DELETE' }); toast('🗑️ Produk dihapus'); loadProducts(); loadStats() }
  catch (e) { toast('❌ ' + e.message, true) }
}
// ---------- stok ----------
async function openStockModal(id, name) {
  const p = await api('api/products/' + id)
  const q = p.stockQueue.map((e, i) => `${i + 1}. ${Object.entries(e).map(([k, v]) => k + ': ' + v).join(' | ')}`).join('\n')
  $('modal-body').innerHTML = `
    <h2>📦 Stok — ${esc(name)}</h2>
    <div class="sub muted" style="margin-bottom:8px">Antrean: ${p.stockQueue.length} · Manual: ${p.stock} · Rules: ${p.rules ? 'ada' : '-'}</div>
    <label>Isi antrean saat ini</label>
    <div class="stockbox">${esc(q) || '(kosong)'}</div>
    <label>Tambah stok (format seperti WA)</label>
    <textarea id="f-stockadd" placeholder="1. email|password&#10;- Pin : 1122&#10;2. email2|pass2"></textarea>
    <div class="mactions">
      <button class="btn danger" onclick="clearStock('${id}')">Kosongkan</button>
      <button class="btn" onclick="closeModal()">Tutup</button>
      <button class="btn primary" onclick="addStock('${id}')">Tambah</button>
    </div>`
  $('modal').classList.remove('hidden')
}
async function addStock(id) {
  try {
    const d = await api(`api/products/${id}/stock`, { method: 'POST', body: JSON.stringify({ text: $('f-stockadd').value }) })
    toast(`✅ ${d.added} stok ditambahkan (total ${d.total})`); closeModal(); loadProducts(); loadStats()
  } catch (e) { toast('❌ ' + e.message, true) }
}
async function clearStock(id) {
  if (!confirm('Kosongkan SEMUA antrean stok produk ini?')) return
  await api(`api/products/${id}/stock`, { method: 'DELETE' }); toast('🗑️ Stok dikosongkan'); closeModal(); loadProducts(); loadStats()
}
// ---------- kategori ----------
function openCategoryModal(id) {
  const c = catCache.find((x) => x.id === id)
  $('modal-body').innerHTML = `
    <h2>${c ? 'Edit' : 'Tambah'} Kategori</h2>
    <label>Nama kategori *</label><input id="f-cname" value="${esc(c?.name || '')}">
    <label>Emoji</label><input id="f-cemoji" value="${esc(c?.emoji || '📦')}" maxlength="4">
    <div class="mactions">
      <button class="btn" onclick="closeModal()">Batal</button>
      <button class="btn primary" onclick="saveCategory('${c?.id || ''}')">Simpan</button>
    </div>`
  $('modal').classList.remove('hidden')
}
async function saveCategory(id) {
  try {
    const body = { name: $('f-cname').value, emoji: $('f-cemoji').value }
    await api(id ? `api/categories/${id}` : 'api/categories', { method: id ? 'PUT' : 'POST', body: JSON.stringify(body) })
    closeModal(); toast('✅ Kategori tersimpan'); loadCategories()
  } catch (e) { toast('❌ ' + e.message, true) }
}
async function delCategory(id) {
  if (!confirm('Hapus kategori ini?')) return
  try { await api('api/categories/' + id, { method: 'DELETE' }); toast('🗑️ Kategori dihapus'); loadCategories() }
  catch (e) { toast('❌ ' + e.message, true) }
}
// ---------- orders ----------
async function loadOrders() {
  const s = $('ostatus').value
  const list = await api(`api/orders?limit=100&status=${s}`)
  $('order-list').innerHTML = list.map(orderRow).join('') || '<div class="muted">Belum ada order</div>'
}
function closeModal() { $('modal').classList.add('hidden') }
$('modal').addEventListener('click', (e) => { if (e.target.id === 'modal') closeModal() })
init()
