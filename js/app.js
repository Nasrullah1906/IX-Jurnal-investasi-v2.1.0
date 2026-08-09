/* ══════════════════════════════════════════════════════════
   JURNAL INVESTASI — app.js
   Storage: semua data disimpan di localStorage perangkat.
══════════════════════════════════════════════════════════ */

const LS = {
  get:  k => { try { return JSON.parse(localStorage.getItem(k)); } catch { return null; } },
  set:  (k, v) => localStorage.setItem(k, JSON.stringify(v)),
  del:  k => localStorage.removeItem(k)
};

const ACCOUNTS_KEY = 'ji_accounts';
const SESSION_KEY  = 'ji_session';
const SETTINGS_KEY = 'ji_settings';
const dataKey = email => 'ji_data_' + email;

const KATEGORI = {
  crypto:    { label: 'Kripto',     icon: '🪙', unit: 'coin' },
  emas:      { label: 'Emas',       icon: '🥇', unit: 'gram' },
  saham:     { label: 'Saham',      icon: '📈', unit: 'lembar' },
  reksadana: { label: 'Reksadana',  icon: '💼', unit: 'unit' },
  lainnya:   { label: 'Lainnya',    icon: '📦', unit: 'unit' }
};
const CHART_COLORS = ['#38D39F','#D9B15C','#60A5FA','#F1707A','#C084FC','#FB923C','#34D3D3','#A3E635','#F472B6','#FACC15'];

/* ══════════════════════════════════════
   STORAGE — accounts / session / settings
══════════════════════════════════════ */
function getAccounts()      { return LS.get(ACCOUNTS_KEY) || {}; }
function saveAccounts(a)    { LS.set(ACCOUNTS_KEY, a); }
function getSession()       { return LS.get(SESSION_KEY); }
function saveSession(s)     { LS.set(SESSION_KEY, s); }
function getAppSettings()   { return Object.assign({ pinOnOpen:true, haptic:true, liveKripto:true, theme:'dark', currency:'idr' }, LS.get(SETTINGS_KEY) || {}); }
function saveAppSettings(s) { LS.set(SETTINGS_KEY, s); }

function getUserData(email) {
  return Object.assign({ assets: [], transactions: [] }, LS.get(dataKey(email)) || {});
}
function saveUserData(email, data) { LS.set(dataKey(email), data); }

function currentEmail() {
  const s = getSession();
  return s ? s.email : null;
}
function currentData() {
  const email = currentEmail();
  return email ? getUserData(email) : { assets: [], transactions: [] };
}
function persistCurrentData(data) {
  const email = currentEmail();
  if (email) saveUserData(email, data);
}

/* ══════════════════════════════════════
   HELPERS
══════════════════════════════════════ */
function uid() { return Date.now().toString(36) + Math.random().toString(36).slice(2, 7); }

/* ══════════════════════════════════════
   MATA UANG TAMPILAN (USD / IDR)
   Semua data tetap disimpan dalam IDR di storage.
   Fungsi di bawah hanya mengonversi tampilan.
══════════════════════════════════════ */
const USD_RATE_KEY = 'ji_usd_rate';
const FALLBACK_USD_IDR = 16300; // dipakai kalau belum pernah fetch & sedang offline
let CURRENT_USD_RATE = null;

function getStoredUsdRate() {
  const cached = LS.get(USD_RATE_KEY);
  return cached && cached.rate ? cached : null;
}
function activeUsdRate() {
  if (CURRENT_USD_RATE) return CURRENT_USD_RATE;
  const cached = getStoredUsdRate();
  return cached ? cached.rate : FALLBACK_USD_IDR;
}
async function refreshUsdRate(force = false) {
  const cached = getStoredUsdRate();
  const isFresh = cached && (Date.now() - cached.ts) < 6 * 60 * 60 * 1000; // 6 jam
  if (isFresh && !force) { CURRENT_USD_RATE = cached.rate; return cached.rate; }
  try {
    const res = await fetch('https://api.frankfurter.app/latest?from=USD&to=IDR');
    const json = await res.json();
    const rate = json?.rates?.IDR;
    if (rate) {
      CURRENT_USD_RATE = rate;
      LS.set(USD_RATE_KEY, { rate, ts: Date.now() });
      return rate;
    }
  } catch { /* offline — pakai cache/fallback */ }
  CURRENT_USD_RATE = cached ? cached.rate : FALLBACK_USD_IDR;
  return CURRENT_USD_RATE;
}
function toDisplayAmount(idrAmount) {
  const settings = getAppSettings();
  if (settings.currency === 'usd') return (idrAmount || 0) / activeUsdRate();
  return idrAmount || 0;
}
function fmtRp(n) {
  const settings = getAppSettings();
  n = n || 0;
  if (settings.currency === 'usd') {
    const usd = toDisplayAmount(n);
    return '$' + Math.abs(usd).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  }
  n = Math.round(n);
  return 'Rp' + Math.abs(n).toLocaleString('id-ID');
}
function fmtSignedRp(n) { return (n >= 0 ? '+' : '-') + fmtRp(Math.abs(n)); }
function fmtNum(n, d = 4) {
  if (n === undefined || n === null || isNaN(n)) return '0';
  return parseFloat(n.toFixed(d)).toLocaleString('id-ID', { maximumFractionDigits: d });
}
function fmtDate(iso) {
  if (!iso) return '—';
  const d = new Date(iso + 'T00:00:00');
  const bulan = ['Jan','Feb','Mar','Apr','Mei','Jun','Jul','Agu','Sep','Okt','Nov','Des'];
  return d.getDate() + ' ' + bulan[d.getMonth()] + ' ' + d.getFullYear();
}
function todayISO() {
  const d = new Date();
  return d.getFullYear() + '-' + String(d.getMonth()+1).padStart(2,'0') + '-' + String(d.getDate()).padStart(2,'0');
}
function haptic() {
  const s = getAppSettings();
  if (s.haptic && navigator.vibrate) navigator.vibrate(10);
}
function showToast(msg) {
  const el = document.getElementById('toast');
  el.textContent = msg;
  el.classList.add('show');
  clearTimeout(showToast._t);
  showToast._t = setTimeout(() => el.classList.remove('show'), 2200);
}
function setAvatarEl(el, photoData, name) {
  if (!el) return;
  if (photoData) {
    el.innerHTML = `<img src="${photoData}" alt="" />`;
  } else {
    el.textContent = (name || 'U').trim().charAt(0).toUpperCase();
  }
}

/* ══════════════════════════════════════
   LOGIN / REGISTER
══════════════════════════════════════ */
function switchLoginTab(tab) {
  document.getElementById('tab-login').classList.toggle('active', tab === 'login');
  document.getElementById('tab-register').classList.toggle('active', tab === 'register');
  document.getElementById('form-login').classList.toggle('active', tab === 'login');
  document.getElementById('form-register').classList.toggle('active', tab === 'register');
}

function showLoginError(msg) {
  const el = document.getElementById('login-error');
  el.textContent = msg; el.style.display = 'block';
  setTimeout(() => el.style.display = 'none', 3200);
}
function showForgotMsg() {
  const el = document.getElementById('login-success');
  el.textContent = '💡 Reset password: hapus data aplikasi (Pengaturan browser) lalu daftar ulang.';
  el.style.display = 'block';
  setTimeout(() => el.style.display = 'none', 4000);
}

function doLogin() {
  const email = document.getElementById('login-email').value.trim().toLowerCase();
  const pass  = document.getElementById('login-password').value;
  if (!email || !pass) return showLoginError('Email dan password wajib diisi.');
  const accounts = getAccounts();
  const user = accounts[email];
  if (!user) return showLoginError('Akun tidak ditemukan. Silakan daftar dahulu.');
  if (user.password !== btoa(unescape(encodeURIComponent(pass)))) return showLoginError('Password salah. Coba lagi.');

  saveSession({ email, loggedAt: Date.now() });
  proceedAfterLogin(email, user);
}

function doRegister() {
  const name    = document.getElementById('reg-name').value.trim();
  const email   = document.getElementById('reg-email').value.trim().toLowerCase();
  const pass    = document.getElementById('reg-password').value;
  const confirm = document.getElementById('reg-confirm').value;
  const errEl = document.getElementById('reg-error');
  const sucEl = document.getElementById('reg-success');
  function showErr(m) { errEl.textContent = m; errEl.style.display = 'block'; sucEl.style.display = 'none'; }
  function showSuc(m) { sucEl.textContent = m; sucEl.style.display = 'block'; errEl.style.display = 'none'; }

  if (!name) return showErr('Nama lengkap wajib diisi.');
  if (!email || !email.includes('@')) return showErr('Format email tidak valid.');
  if (pass.length < 8) return showErr('Password minimal 8 karakter.');
  if (!/[a-zA-Z]/.test(pass)) return showErr('Password harus mengandung huruf.');
  if (!/[0-9]/.test(pass)) return showErr('Password harus mengandung angka.');
  if (pass !== confirm) return showErr('Konfirmasi password tidak cocok.');

  const accounts = getAccounts();
  if (accounts[email]) return showErr('Email sudah terdaftar. Silakan masuk.');

  accounts[email] = { name, password: btoa(unescape(encodeURIComponent(pass))), pin: null, photo: null, createdAt: Date.now() };
  saveAccounts(accounts);
  saveUserData(email, { assets: [], transactions: [] });

  showSuc('✅ Akun berhasil dibuat! Silakan masuk.');
  document.getElementById('login-email').value = email;
  setTimeout(() => switchLoginTab('login'), 1400);
}

function proceedAfterLogin(email, user) {
  const settings = getAppSettings();
  if (user.pin && settings.pinOnOpen) {
    showPinPage(email, user);
  } else {
    enterApp();
  }
}

function doLogout() {
  if (!confirm('Yakin ingin keluar dari akun?')) return;
  logoutToLogin();
}
function logoutToLogin() {
  LS.del(SESSION_KEY);
  document.getElementById('app-wrap').style.display = 'none';
  document.getElementById('page-pin').style.display = 'none';
  document.getElementById('page-login').style.display = 'flex';
  switchLoginTab('login');
  document.getElementById('login-email').value = '';
  document.getElementById('login-password').value = '';
}

/* ══════════════════════════════════════
   PIN
══════════════════════════════════════ */
let pinBuffer = '';
function showPinPage(email, user) {
  pinBuffer = '';
  updatePinDots();
  document.getElementById('pin-user-name').textContent = user.name || email;
  document.getElementById('pin-user-email').textContent = email;
  setAvatarEl(document.getElementById('pin-avatar'), user.photo, user.name);
  document.getElementById('pin-error-msg').textContent = '';
  document.getElementById('page-login').style.display = 'none';
  document.getElementById('page-pin').style.display = 'flex';
}
function pinPress(d) {
  if (pinBuffer.length >= 6) return;
  haptic();
  pinBuffer += d;
  updatePinDots();
  if (pinBuffer.length === 6) setTimeout(checkPIN, 120);
}
function pinDel() { haptic(); pinBuffer = pinBuffer.slice(0, -1); updatePinDots(); }
function updatePinDots(error = false) {
  for (let i = 0; i < 6; i++) {
    const dot = document.getElementById('pd' + i);
    dot.className = 'pin-dot' + (i < pinBuffer.length ? ' filled' : '') + (error ? ' error' : '');
  }
}
function checkPIN() {
  const session = getSession();
  if (!session) return logoutToLogin();
  const accounts = getAccounts();
  const user = accounts[session.email];
  if (!user) return logoutToLogin();
  if (user.pin === pinBuffer) {
    enterApp();
  } else {
    updatePinDots(true);
    document.getElementById('pin-error-msg').textContent = '❌ PIN salah, coba lagi';
    setTimeout(() => { pinBuffer = ''; updatePinDots(); document.getElementById('pin-error-msg').textContent = ''; }, 900);
  }
}

/* ══════════════════════════════════════
   ENTER APP / NAVIGATION
══════════════════════════════════════ */
function enterApp() {
  document.getElementById('page-login').style.display = 'none';
  document.getElementById('page-pin').style.display = 'none';
  document.getElementById('app-wrap').style.display = 'block';
  refreshHeaderAvatar();
  showPage('dashboard');
}

function refreshHeaderAvatar() {
  const session = getSession();
  if (!session) return;
  const user = getAccounts()[session.email] || {};
  setAvatarEl(document.getElementById('header-avatar'), user.photo, user.name);
}

function showPage(page) {
  ['dashboard','catat','portofolio','riwayat','settings'].forEach(p => {
    document.getElementById('page-' + p).style.display = p === page ? 'block' : 'none';
    document.getElementById('nav-' + p).classList.toggle('active', p === page);
  });
  if (page === 'dashboard')   renderDashboard();
  if (page === 'catat')       renderCatatForm();
  if (page === 'portofolio')  renderPortofolio();
  if (page === 'riwayat')     renderRiwayat();
  if (page === 'settings')    refreshSettingsUI();
  window.scrollTo(0, 0);
}

/* ══════════════════════════════════════
   PORTFOLIO MATH
══════════════════════════════════════ */
function assetStats(asset, transactions) {
  const txs = transactions.filter(t => t.assetId === asset.id);
  const totalUnit  = txs.reduce((s, t) => s + t.unit, 0);
  const totalModal = txs.reduce((s, t) => s + t.nominal, 0);
  const avgPrice   = totalUnit > 0 ? totalModal / totalUnit : 0;
  const currentPrice = (asset.currentPrice && asset.currentPrice > 0) ? asset.currentPrice : avgPrice;
  const nilai = totalUnit * currentPrice;
  const untungRugi = nilai - totalModal;
  const persen = totalModal > 0 ? (untungRugi / totalModal) * 100 : 0;
  return { totalUnit, totalModal, avgPrice, currentPrice, nilai, untungRugi, persen, count: txs.length };
}

function portfolioSummary() {
  const data = currentData();
  let totalModal = 0, totalNilai = 0;
  const rows = data.assets.map(a => {
    const st = assetStats(a, data.transactions);
    totalModal += st.totalModal;
    totalNilai += st.nilai;
    return { asset: a, ...st };
  }).filter(r => r.count > 0);
  const untungRugi = totalNilai - totalModal;
  const persen = totalModal > 0 ? (untungRugi / totalModal) * 100 : 0;
  return { rows, totalModal, totalNilai, untungRugi, persen };
}

/* ══════════════════════════════════════
   DASHBOARD
══════════════════════════════════════ */
function renderDashboard() {
  const { rows, totalModal, totalNilai, untungRugi, persen } = portfolioSummary();

  document.getElementById('dash-total-nilai').textContent = fmtRp(totalNilai);
  const subEl = document.getElementById('dash-total-pnl');
  subEl.textContent = `${fmtSignedRp(untungRugi)} (${untungRugi >= 0 ? '+' : ''}${persen.toFixed(1)}%)`;
  subEl.className = 'hero-sub ' + (untungRugi >= 0 ? 'profit' : 'loss');
  document.getElementById('dash-total-modal').textContent = fmtRp(totalModal);
  document.getElementById('dash-asset-count').textContent = rows.length;

  renderComposition('dash-donut', 'dash-legend', rows);
  renderMonthlyBar('dash-bar-chart');
  renderRecentTx('dash-recent-list');
}

function renderRecentTx(containerId) {
  const data = currentData();
  const el = document.getElementById(containerId);
  const list = [...data.transactions].sort((a, b) => b.ts - a.ts).slice(0, 5);
  if (list.length === 0) {
    el.innerHTML = `<div class="empty-state"><div class="empty-icon">📝</div><p>Belum ada transaksi.<br>Catat pembelian pertamamu untuk mulai mengisi jurnal.</p></div>`;
    return;
  }
  el.innerHTML = list.map(t => txItemHtml(t, data)).join('');
}

function txItemHtml(t, data) {
  const asset = data.assets.find(a => a.id === t.assetId) || { name: '—', kategori: 'lainnya' };
  const kat = KATEGORI[asset.kategori] || KATEGORI.lainnya;
  return `
    <div class="tx-item">
      <div class="tx-icon">${kat.icon}</div>
      <div class="tx-main">
        <div class="tx-title">${asset.name}</div>
        <div class="tx-sub">${fmtNum(t.unit)} ${asset.unit || kat.unit} @ ${fmtRp(t.hargaPerUnit)}</div>
      </div>
      <div class="tx-right">
        <div class="tx-amount">${fmtRp(t.nominal)}</div>
        <div class="tx-date">${fmtDate(t.tanggal)}</div>
      </div>
    </div>`;
}

/* ══════════════════════════════════════
   CATAT (tambah transaksi)
══════════════════════════════════════ */
function renderCatatForm() {
  const data = currentData();
  const sel = document.getElementById('tx-asset');
  sel.innerHTML = data.assets.length
    ? data.assets.map(a => `<option value="${a.id}">${(KATEGORI[a.kategori]||KATEGORI.lainnya).icon} ${a.name}</option>`).join('')
    : `<option value="">— Belum ada aset —</option>`;
  document.getElementById('tx-date').value = todayISO();
  document.getElementById('tx-price').value = '';
  document.getElementById('tx-nominal').value = '';
  document.getElementById('tx-note').value = '';
  updateUnitPreview();
}

function updateUnitPreview() {
  const price = parseFloat(document.getElementById('tx-price').value) || 0;
  const nominal = parseFloat(document.getElementById('tx-nominal').value) || 0;
  const sel = document.getElementById('tx-asset');
  const data = currentData();
  const asset = data.assets.find(a => a.id === sel.value);
  const unitLabel = asset ? (asset.unit || KATEGORI[asset.kategori]?.unit) : 'unit';
  const el = document.getElementById('tx-unit-preview');
  if (price > 0 && nominal > 0) {
    el.textContent = `≈ ${fmtNum(nominal / price)} ${unitLabel} akan dicatat`;
  } else {
    el.textContent = 'Isi harga per unit & nominal untuk melihat estimasi unit.';
  }
}

function saveTransaction() {
  const data = currentData();
  const assetId = document.getElementById('tx-asset').value;
  const tanggal = document.getElementById('tx-date').value;
  const harga = parseFloat(document.getElementById('tx-price').value);
  const nominal = parseFloat(document.getElementById('tx-nominal').value);
  const catatan = document.getElementById('tx-note').value.trim();

  if (!assetId) return showToast('⚠️ Tambah / pilih aset dahulu');
  if (!tanggal) return showToast('⚠️ Tanggal wajib diisi');
  if (!harga || harga <= 0) return showToast('⚠️ Harga per unit wajib diisi');
  if (!nominal || nominal <= 0) return showToast('⚠️ Nominal investasi wajib diisi');

  const tx = { id: uid(), assetId, tanggal, hargaPerUnit: harga, nominal, unit: nominal / harga, catatan, ts: Date.now() };
  data.transactions.unshift(tx);
  persistCurrentData(data);

  showToast('✅ Transaksi tersimpan');
  haptic();
  renderCatatForm();
  renderDashboard();
}

/* ══════════════════════════════════════
   ASET BARU (modal)
══════════════════════════════════════ */
let selectedNewAssetKategori = 'crypto';
function openNewAsset() {
  document.getElementById('new-asset-name').value = '';
  document.getElementById('new-asset-coingecko').value = '';
  selectedNewAssetKategori = 'crypto';
  refreshAssetKategoriUI();
  openModal('modal-new-asset');
}
function selectAssetKategori(kat) {
  selectedNewAssetKategori = kat;
  refreshAssetKategoriUI();
}
function refreshAssetKategoriUI() {
  document.querySelectorAll('.asset-type-btn').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.kat === selectedNewAssetKategori);
  });
  document.getElementById('coingecko-field').style.display = selectedNewAssetKategori === 'crypto' ? 'block' : 'none';
}
function saveNewAsset() {
  const name = document.getElementById('new-asset-name').value.trim();
  const coingeckoId = document.getElementById('new-asset-coingecko').value.trim().toLowerCase();
  if (!name) return showToast('⚠️ Nama aset wajib diisi');

  const data = currentData();
  const kat = KATEGORI[selectedNewAssetKategori];
  const asset = { id: uid(), name, kategori: selectedNewAssetKategori, unit: kat.unit, coingeckoId: coingeckoId || null, currentPrice: null, updatedAt: null };
  data.assets.push(asset);
  persistCurrentData(data);
  closeModal('modal-new-asset');
  showToast('✅ Aset ditambahkan');

  // refresh whichever view is open
  document.getElementById('tx-asset') && renderCatatForm();
  const activePage = document.querySelector('.nav-item.active')?.id;
  if (activePage === 'nav-portofolio') renderPortofolio();
  if (activePage === 'nav-dashboard') renderDashboard();
  // select the newly created asset in catat form
  setTimeout(() => { const s = document.getElementById('tx-asset'); if (s) s.value = asset.id; updateUnitPreview(); }, 0);
}

/* ══════════════════════════════════════
   PORTOFOLIO
══════════════════════════════════════ */
function renderPortofolio() {
  const { rows, totalModal, totalNilai, untungRugi, persen } = portfolioSummary();

  document.getElementById('pf-total-modal').textContent = fmtRp(totalModal);
  document.getElementById('pf-total-nilai').textContent = fmtRp(totalNilai);
  const pnlEl = document.getElementById('pf-total-pnl');
  pnlEl.textContent = `${fmtSignedRp(untungRugi)} (${untungRugi >= 0 ? '+' : ''}${persen.toFixed(1)}%)`;
  pnlEl.className = 'hero-stat-value ' + (untungRugi >= 0 ? 'profit' : 'loss');

  const listEl = document.getElementById('portfolio-list');
  if (rows.length === 0) {
    listEl.innerHTML = `<div class="empty-state"><div class="empty-icon">📊</div><p>Belum ada aset dengan transaksi.<br>Catat pembelian pertamamu di menu Catat.</p></div>`;
    return;
  }
  listEl.innerHTML = rows.map(r => {
    const kat = KATEGORI[r.asset.kategori] || KATEGORI.lainnya;
    const isLive = !!r.asset.coingeckoId;
    return `
    <div class="asset-item">
      <div class="asset-top">
        <div class="asset-name-wrap">
          <div class="asset-icon">${kat.icon}</div>
          <div>
            <div class="asset-name">${r.asset.name}</div>
            <div class="asset-cat">${kat.label} ${isLive ? '· <span class=\"badge live\">LIVE</span>' : ''}</div>
          </div>
        </div>
        <div class="asset-pnl">
          <div class="asset-pnl-val ${r.untungRugi >= 0 ? 'profit' : 'loss'}">${fmtSignedRp(r.untungRugi)}</div>
          <div class="asset-pnl-pct ${r.untungRugi >= 0 ? 'profit' : 'loss'}">${r.untungRugi >= 0 ? '+' : ''}${r.persen.toFixed(1)}%</div>
        </div>
      </div>
      <div class="asset-detail-row"><span class="dk">Total Unit</span><span class="dv">${fmtNum(r.totalUnit)} ${r.asset.unit}</span></div>
      <div class="asset-detail-row"><span class="dk">Harga Rata-rata</span><span class="dv">${fmtRp(r.avgPrice)}</span></div>
      <div class="asset-detail-row"><span class="dk">Harga Sekarang</span><span class="dv">${fmtRp(r.currentPrice)}</span></div>
      <div class="asset-detail-row"><span class="dk">Modal / Nilai</span><span class="dv">${fmtRp(r.totalModal)} → ${fmtRp(r.nilai)}</span></div>
      <div style="display:flex;gap:8px;margin-top:10px;">
        <button class="btn-ghost" style="flex:1;" onclick="openUpdatePrice('${r.asset.id}')">✏️ Update Harga</button>
        <button class="btn-ghost" style="flex:1;" onclick="openAssetHistory('${r.asset.id}')">📋 Riwayat</button>
      </div>
    </div>`;
  }).join('');
}

/* Update harga sekarang (manual atau live CoinGecko) */
let updatePriceAssetId = null;
function openUpdatePrice(assetId) {
  updatePriceAssetId = assetId;
  const data = currentData();
  const asset = data.assets.find(a => a.id === assetId);
  if (!asset) return;
  document.getElementById('up-asset-name').textContent = asset.name;
  document.getElementById('up-price-input').value = asset.currentPrice || '';
  document.getElementById('up-live-btn').style.display = asset.coingeckoId ? 'block' : 'none';
  openModal('modal-update-price');
}
function saveUpdatePrice() {
  const price = parseFloat(document.getElementById('up-price-input').value);
  if (!price || price <= 0) return showToast('⚠️ Harga tidak valid');
  const data = currentData();
  const asset = data.assets.find(a => a.id === updatePriceAssetId);
  if (!asset) return;
  asset.currentPrice = price;
  asset.updatedAt = Date.now();
  persistCurrentData(data);
  closeModal('modal-update-price');
  showToast('✅ Harga diperbarui');
  renderPortofolio(); renderDashboard();
}
async function fetchLivePrice() {
  const data = currentData();
  const asset = data.assets.find(a => a.id === updatePriceAssetId);
  if (!asset || !asset.coingeckoId) return;
  const btn = document.getElementById('up-live-btn');
  const originalText = btn.textContent;
  btn.textContent = '⏳ Mengambil harga...';
  try {
    const res = await fetch(`https://api.coingecko.com/api/v3/simple/price?ids=${encodeURIComponent(asset.coingeckoId)}&vs_currencies=idr`);
    const json = await res.json();
    const price = json?.[asset.coingeckoId]?.idr;
    if (price) {
      document.getElementById('up-price-input').value = price;
      showToast('✅ Harga live diambil');
    } else {
      showToast('⚠️ ID CoinGecko tidak ditemukan');
    }
  } catch {
    showToast('⚠️ Gagal mengambil harga (cek koneksi)');
  }
  btn.textContent = originalText;
}

/* Riwayat per-aset (dari kartu portofolio) */
function openAssetHistory(assetId) {
  const data = currentData();
  const asset = data.assets.find(a => a.id === assetId);
  if (!asset) return;
  document.getElementById('ah-title').textContent = asset.name + ' — Riwayat';
  const txs = data.transactions.filter(t => t.assetId === assetId).sort((a,b)=>b.ts-a.ts);
  const el = document.getElementById('ah-list');
  el.innerHTML = txs.length
    ? txs.map(t => `
      <div class="tx-item">
        <div class="tx-icon">${(KATEGORI[asset.kategori]||KATEGORI.lainnya).icon}</div>
        <div class="tx-main">
          <div class="tx-title">${fmtNum(t.unit)} ${asset.unit}</div>
          <div class="tx-sub">@ ${fmtRp(t.hargaPerUnit)}${t.catatan ? ' · ' + t.catatan : ''}</div>
        </div>
        <div class="tx-right">
          <div class="tx-amount">${fmtRp(t.nominal)}</div>
          <div class="tx-date">${fmtDate(t.tanggal)}</div>
        </div>
        <button class="tx-del" onclick="deleteTransaction('${t.id}', true)">×</button>
      </div>`).join('')
    : `<div class="empty-state"><div class="empty-icon">📋</div><p>Belum ada transaksi untuk aset ini.</p></div>`;
  openModal('modal-asset-history');
}

/* ══════════════════════════════════════
   RIWAYAT (semua transaksi)
══════════════════════════════════════ */
let riwayatFilter = 'semua';
function renderRiwayat() {
  const data = currentData();
  const chipsEl = document.getElementById('riwayat-chips');
  const cats = ['semua', ...new Set(data.assets.map(a => a.kategori))];
  chipsEl.innerHTML = cats.map(c => {
    const label = c === 'semua' ? 'Semua' : (KATEGORI[c]?.label || c);
    return `<div class="chip ${riwayatFilter === c ? 'active' : ''}" onclick="setRiwayatFilter('${c}')">${label}</div>`;
  }).join('');

  let txs = [...data.transactions].sort((a, b) => b.ts - a.ts);
  if (riwayatFilter !== 'semua') {
    const idsInCat = data.assets.filter(a => a.kategori === riwayatFilter).map(a => a.id);
    txs = txs.filter(t => idsInCat.includes(t.assetId));
  }

  const el = document.getElementById('riwayat-list');
  document.getElementById('riwayat-count').textContent = txs.length + ' transaksi';
  if (txs.length === 0) {
    el.innerHTML = `<div class="empty-state"><div class="empty-icon">📋</div><p>Belum ada riwayat transaksi.</p></div>`;
    return;
  }
  el.innerHTML = txs.map(t => {
    const asset = data.assets.find(a => a.id === t.assetId) || { name: '(dihapus)', kategori: 'lainnya', unit: 'unit' };
    const kat = KATEGORI[asset.kategori] || KATEGORI.lainnya;
    return `
    <div class="tx-item">
      <div class="tx-icon">${kat.icon}</div>
      <div class="tx-main">
        <div class="tx-title">${asset.name}</div>
        <div class="tx-sub">${fmtNum(t.unit)} ${asset.unit} @ ${fmtRp(t.hargaPerUnit)}${t.catatan ? ' · ' + t.catatan : ''}</div>
      </div>
      <div class="tx-right">
        <div class="tx-amount">${fmtRp(t.nominal)}</div>
        <div class="tx-date">${fmtDate(t.tanggal)}</div>
      </div>
      <button class="tx-del" onclick="deleteTransaction('${t.id}')">×</button>
    </div>`;
  }).join('');
}
function setRiwayatFilter(c) { riwayatFilter = c; renderRiwayat(); }

function deleteTransaction(id, fromAssetHistory) {
  if (!confirm('Hapus transaksi ini?')) return;
  const data = currentData();
  data.transactions = data.transactions.filter(t => t.id !== id);
  persistCurrentData(data);
  showToast('🗑️ Transaksi dihapus');
  renderRiwayat(); renderDashboard();
  if (fromAssetHistory && updatePriceAssetId) openAssetHistory(updatePriceAssetId);
  if (document.getElementById('page-portofolio').style.display === 'block') renderPortofolio();
}

/* ══════════════════════════════════════
   CHARTS (SVG, tanpa library eksternal)
══════════════════════════════════════ */
function renderComposition(donutId, legendId, rows) {
  const donutEl = document.getElementById(donutId);
  const legendEl = document.getElementById(legendId);
  if (!rows || rows.length === 0) {
    donutEl.innerHTML = `<div class="empty-state" style="padding:1.5rem 1rem;"><div class="empty-icon">🥧</div><p>Belum ada data komposisi.</p></div>`;
    legendEl.innerHTML = '';
    return;
  }
  const total = rows.reduce((s, r) => s + r.nilai, 0) || 1;
  const cx = 90, cy = 90, r = 68, sw = 24;
  const circ = 2 * Math.PI * r;
  let offset = 0;
  const segs = rows.map((row, i) => {
    const frac = row.nilai / total;
    const len = frac * circ;
    const seg = `<circle cx="${cx}" cy="${cy}" r="${r}" fill="none" stroke="${CHART_COLORS[i % CHART_COLORS.length]}"
      stroke-width="${sw}" stroke-dasharray="${len} ${circ - len}" stroke-dashoffset="${-offset}"
      transform="rotate(-90 ${cx} ${cy})" stroke-linecap="butt"/>`;
    offset += len;
    return seg;
  }).join('');
  donutEl.innerHTML = `
    <svg viewBox="0 0 180 180" style="width:100%;max-width:220px;display:block;margin:0 auto;">
      ${segs}
      <text x="90" y="85" text-anchor="middle" font-family="Fraunces,serif" font-size="15" font-weight="600" fill="var(--text)">${rows.length}</text>
      <text x="90" y="102" text-anchor="middle" font-size="9.5" fill="var(--text-muted)">ASET</text>
    </svg>`;
  legendEl.innerHTML = rows.map((row, i) => `
    <div class="legend-row">
      <div class="legend-dot" style="background:${CHART_COLORS[i % CHART_COLORS.length]}"></div>
      <div class="legend-name">${row.asset.name}</div>
      <div class="legend-val">${((row.nilai / total) * 100).toFixed(1)}%</div>
    </div>`).join('');
}

function renderMonthlyBar(containerId) {
  const data = currentData();
  const el = document.getElementById(containerId);
  const now = new Date();
  const months = [];
  for (let i = 5; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    months.push({ key: d.getFullYear() + '-' + String(d.getMonth()+1).padStart(2,'0'), label: ['Jan','Feb','Mar','Apr','Mei','Jun','Jul','Agu','Sep','Okt','Nov','Des'][d.getMonth()], value: 0 });
  }
  data.transactions.forEach(t => {
    const key = t.tanggal.slice(0, 7);
    const m = months.find(m => m.key === key);
    if (m) m.value += t.nominal;
  });
  const max = Math.max(...months.map(m => m.value), 1);
  const w = 280, h = 120, barW = 28, gap = (w - barW * 6) / 7;
  let bars = '';
  months.forEach((m, i) => {
    const bh = Math.max((m.value / max) * (h - 26), m.value > 0 ? 4 : 0);
    const x = gap + i * (barW + gap);
    const y = h - 20 - bh;
    bars += `<rect x="${x}" y="${y}" width="${barW}" height="${bh}" rx="5" fill="${m.value > 0 ? 'var(--primary)' : 'var(--surface3)'}" fill-opacity="${m.value > 0 ? 0.9 : 1}"/>`;
    bars += `<text x="${x + barW/2}" y="${h - 5}" text-anchor="middle" font-size="9.5" fill="var(--text-muted)">${m.label}</text>`;
  });
  el.innerHTML = `<svg viewBox="0 0 ${w} ${h}" style="width:100%;display:block;" preserveAspectRatio="xMidYMid meet">${bars}</svg>`;
}

/* ══════════════════════════════════════
   SETTINGS
══════════════════════════════════════ */
function refreshSettingsUI() {
  const session = getSession();
  const settings = getAppSettings();
  const accounts = getAccounts();
  if (session) {
    const user = accounts[session.email] || {};
    document.getElementById('sett-name').textContent = user.name || '—';
    document.getElementById('sett-email').textContent = session.email;
    setAvatarEl(document.getElementById('sett-avatar'), user.photo, user.name);
    document.getElementById('pin-status-desc').textContent = user.pin ? 'Aktif — klik untuk ubah PIN' : 'Belum diatur — klik untuk memasang PIN';
  }
  setToggle('toggle-pin-onopen', settings.pinOnOpen);
  setToggle('toggle-haptic', settings.haptic);
  setToggle('toggle-live', settings.liveKripto);
  setToggle('toggle-theme', settings.theme === 'light');
  refreshCurrencyUI();
}
function refreshCurrencyUI() {
  const settings = getAppSettings();
  document.querySelectorAll('.currency-btn').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.currency === settings.currency);
  });
}
async function setCurrency(cur) {
  const s = getAppSettings();
  if (s.currency === cur) return;
  s.currency = cur;
  saveAppSettings(s);
  haptic();
  refreshCurrencyUI();
  if (cur === 'usd') await refreshUsdRate();
  // refresh semua tampilan angka yang sedang aktif
  renderDashboard();
  const activePage = document.querySelector('.nav-item.active')?.id;
  if (activePage === 'nav-portofolio') renderPortofolio();
  if (activePage === 'nav-riwayat') renderRiwayat();
  showToast(cur === 'usd' ? '✅ Mata uang diubah ke USD' : '✅ Mata uang diubah ke IDR');
}
function setToggle(id, on) { document.getElementById(id).classList.toggle('on', !!on); }

function togglePinOnOpen() { const s = getAppSettings(); s.pinOnOpen = !s.pinOnOpen; saveAppSettings(s); setToggle('toggle-pin-onopen', s.pinOnOpen); }
function toggleHapticFeedback() { const s = getAppSettings(); s.haptic = !s.haptic; saveAppSettings(s); setToggle('toggle-haptic', s.haptic); }
function toggleLiveKripto() { const s = getAppSettings(); s.liveKripto = !s.liveKripto; saveAppSettings(s); setToggle('toggle-live', s.liveKripto); }

function applyTheme(theme) { document.body.classList.toggle('theme-light', theme === 'light'); }
function toggleTheme() {
  const s = getAppSettings();
  s.theme = s.theme === 'light' ? 'dark' : 'light';
  saveAppSettings(s);
  applyTheme(s.theme);
  setToggle('toggle-theme', s.theme === 'light');
  haptic();
}

/* ── Edit profil (nama, email, foto) ── */
let pendingPhotoData = null;
function openEditProfile() {
  const session = getSession();
  const accounts = getAccounts();
  if (!session) return;
  const user = accounts[session.email] || {};
  document.getElementById('edit-name').value = user.name || '';
  document.getElementById('edit-email').value = session.email;
  pendingPhotoData = null;
  const preview = document.getElementById('edit-avatar-preview');
  setAvatarEl(preview, user.photo, user.name);
  const fi = document.getElementById('photo-upload-input');
  if (fi) fi.value = '';
  openModal('modal-profile');
}
function handlePhotoUpload(event) {
  const file = event.target.files[0];
  if (!file) return;
  if (file.size > 3 * 1024 * 1024) return showToast('⚠️ Ukuran foto maksimal 3MB');
  const reader = new FileReader();
  reader.onload = e => {
    pendingPhotoData = e.target.result;
    document.getElementById('edit-avatar-preview').innerHTML = `<img src="${pendingPhotoData}" alt="" />`;
  };
  reader.readAsDataURL(file);
}
function saveProfile() {
  const session = getSession();
  const accounts = getAccounts();
  if (!session) return;
  const newName = document.getElementById('edit-name').value.trim();
  const newEmail = document.getElementById('edit-email').value.trim().toLowerCase();
  if (!newName) return showToast('⚠️ Nama tidak boleh kosong');
  if (!newEmail.includes('@')) return showToast('⚠️ Format email tidak valid');

  const user = accounts[session.email];
  if (pendingPhotoData !== null) user.photo = pendingPhotoData;
  user.name = newName;

  if (newEmail !== session.email) {
    if (accounts[newEmail]) return showToast('⚠️ Email sudah dipakai akun lain');
    const oldData = getUserData(session.email);
    accounts[newEmail] = user;
    delete accounts[session.email];
    saveAccounts(accounts);
    saveUserData(newEmail, oldData);
    LS.del(dataKey(session.email));
    saveSession({ email: newEmail, loggedAt: Date.now() });
  } else {
    saveAccounts(accounts);
  }
  pendingPhotoData = null;
  closeModal('modal-profile');
  refreshSettingsUI();
  refreshHeaderAvatar();
  showToast('✅ Profil diperbarui');
}

/* ── Ubah password ── */
function openChangePassword() {
  document.getElementById('pw-old').value = '';
  document.getElementById('pw-new').value = '';
  document.getElementById('pw-confirm').value = '';
  document.getElementById('pw-error').style.display = 'none';
  openModal('modal-password');
}
function savePassword() {
  const session = getSession();
  const accounts = getAccounts();
  if (!session) return;
  const user = accounts[session.email];
  const old = document.getElementById('pw-old').value;
  const nw  = document.getElementById('pw-new').value;
  const cnf = document.getElementById('pw-confirm').value;
  const errEl = document.getElementById('pw-error');
  function err(m) { errEl.textContent = m; errEl.style.display = 'block'; }

  if (user.password !== btoa(unescape(encodeURIComponent(old)))) return err('Password lama salah.');
  if (nw.length < 8) return err('Password baru minimal 8 karakter.');
  if (!/[a-zA-Z]/.test(nw) || !/[0-9]/.test(nw)) return err('Password harus mengandung huruf dan angka.');
  if (nw !== cnf) return err('Konfirmasi password tidak cocok.');

  user.password = btoa(unescape(encodeURIComponent(nw)));
  saveAccounts(accounts);
  closeModal('modal-password');
  showToast('✅ Password berhasil diubah');
}

/* ── PIN setup / ubah ── */
let pinSetupStep = 0, pinSetupFirst = '', pinSetupBuffer = '';
function openChangePIN() {
  pinSetupStep = 0; pinSetupFirst = ''; pinSetupBuffer = '';
  updatePinSetupDots();
  document.getElementById('pin-setup-step').textContent = 'Masukkan 6 digit PIN baru';
  document.getElementById('pin-setup-error').textContent = '';
  openModal('modal-pin');
}
function pinSetupPress(d) {
  if (pinSetupBuffer.length >= 6) return;
  haptic();
  pinSetupBuffer += d;
  updatePinSetupDots();
  if (pinSetupBuffer.length === 6) setTimeout(processPinSetup, 150);
}
function pinSetupDel() { pinSetupBuffer = pinSetupBuffer.slice(0, -1); updatePinSetupDots(); }
function updatePinSetupDots() { for (let i = 0; i < 6; i++) document.getElementById('spd' + i).classList.toggle('filled', i < pinSetupBuffer.length); }
function processPinSetup() {
  if (pinSetupStep === 0) {
    pinSetupFirst = pinSetupBuffer; pinSetupBuffer = '';
    updatePinSetupDots(); pinSetupStep = 1;
    document.getElementById('pin-setup-step').textContent = 'Konfirmasi PIN kamu';
  } else {
    if (pinSetupBuffer === pinSetupFirst) {
      const session = getSession();
      const accounts = getAccounts();
      if (session && accounts[session.email]) { accounts[session.email].pin = pinSetupBuffer; saveAccounts(accounts); }
      closeModal('modal-pin');
      refreshSettingsUI();
      showToast('✅ PIN berhasil diatur');
    } else {
      document.getElementById('pin-setup-error').textContent = '❌ PIN tidak cocok, mulai ulang';
      setTimeout(() => {
        pinSetupStep = 0; pinSetupFirst = ''; pinSetupBuffer = '';
        updatePinSetupDots();
        document.getElementById('pin-setup-step').textContent = 'Masukkan 6 digit PIN baru';
        document.getElementById('pin-setup-error').textContent = '';
      }, 1100);
    }
  }
}

/* ── Kelola data: export / import / hapus ── */
function exportData() {
  const session = getSession();
  if (!session) return;
  const accounts = getAccounts();
  const user = accounts[session.email];
  const data = currentData();
  const payload = { app: 'Jurnal Investasi', version: 1, exportedAt: new Date().toISOString(), profile: { name: user.name, email: session.email }, ...data };
  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `jurnal-investasi-${todayISO()}.json`;
  document.body.appendChild(a); a.click(); document.body.removeChild(a);
  URL.revokeObjectURL(url);
  showToast('⬇️ Data diekspor');
}
function triggerImport() { document.getElementById('import-file-input').click(); }
function handleImportFile(event) {
  const file = event.target.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = e => {
    try {
      const json = JSON.parse(e.target.result);
      if (!Array.isArray(json.assets) || !Array.isArray(json.transactions)) throw new Error('format');
      if (!confirm('Impor akan MENGGABUNGKAN data ini dengan data yang sudah ada. Lanjutkan?')) return;
      const data = currentData();
      const idMap = {};
      json.assets.forEach(a => {
        const newId = uid();
        idMap[a.id] = newId;
        data.assets.push({ ...a, id: newId });
      });
      json.transactions.forEach(t => {
        data.transactions.push({ ...t, id: uid(), assetId: idMap[t.assetId] || t.assetId });
      });
      persistCurrentData(data);
      showToast('✅ Data berhasil diimpor');
      renderDashboard();
    } catch {
      showToast('⚠️ File tidak valid');
    }
  };
  reader.readAsText(file);
  event.target.value = '';
}
function openClearData() {
  if (!confirm('Hapus SEMUA aset & transaksi kamu? Tindakan ini tidak dapat dibatalkan.')) return;
  persistCurrentData({ assets: [], transactions: [] });
  showToast('🗑️ Semua data dihapus');
  renderDashboard();
}

/* ── Hapus akun ── */
function openDeleteAccount() {
  document.getElementById('del-acc-password').value = '';
  document.getElementById('del-acc-confirm-text').value = '';
  document.getElementById('del-acc-error').style.display = 'none';
  openModal('modal-delete-account');
}
function confirmDeleteAccount() {
  const session = getSession();
  const accounts = getAccounts();
  if (!session) return;
  const user = accounts[session.email];
  const pass = document.getElementById('del-acc-password').value;
  const confirmText = document.getElementById('del-acc-confirm-text').value.trim();
  const errEl = document.getElementById('del-acc-error');
  function err(m) { errEl.textContent = m; errEl.style.display = 'block'; }

  if (user.password !== btoa(unescape(encodeURIComponent(pass)))) return err('Password salah.');
  if (confirmText !== 'HAPUS AKUN') return err('Ketik "HAPUS AKUN" persis untuk konfirmasi.');

  delete accounts[session.email];
  saveAccounts(accounts);
  LS.del(dataKey(session.email));
  closeModal('modal-delete-account');
  logoutToLogin();
  showToast('Akun telah dihapus');
}

/* ══════════════════════════════════════
   MODAL HELPERS
══════════════════════════════════════ */
function openModal(id) { document.getElementById(id).classList.add('open'); }
function closeModal(id) { document.getElementById(id).classList.remove('open'); }
function toggleEye(inputId, btnId) {
  const inp = document.getElementById(inputId);
  const btn = document.getElementById(btnId);
  if (!inp || !btn) return;
  if (inp.type === 'password') { inp.type = 'text'; btn.textContent = '🙈'; }
  else { inp.type = 'password'; btn.textContent = '👁'; }
}

/* ══════════════════════════════════════
   INIT
══════════════════════════════════════ */
(function init() {
  applyTheme(getAppSettings().theme);
  if (getAppSettings().currency === 'usd') refreshUsdRate();

  document.querySelectorAll('.modal-overlay').forEach(overlay => {
    overlay.addEventListener('click', e => { if (e.target === overlay) overlay.classList.remove('open'); });
  });
  document.getElementById('tx-price')?.addEventListener('input', updateUnitPreview);
  document.getElementById('tx-nominal')?.addEventListener('input', updateUnitPreview);
  document.getElementById('tx-asset')?.addEventListener('change', updateUnitPreview);

  const session = getSession();
  if (session) {
    const accounts = getAccounts();
    const user = accounts[session.email];
    if (user) { proceedAfterLogin(session.email, user); return; }
  }
  document.getElementById('page-login').style.display = 'flex';
})();
