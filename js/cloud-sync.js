// /* ══════════════════════════════════════════════════════════
//    JURNAL INVESTASI — cloud-sync.js
//    Menambahkan sinkronisasi otomatis antar perangkat via Firebase
//    (Authentication + Firestore), TANPA mengubah logika app.js.

//    Cara kerja:
//    - Semua fungsi bisnis di app.js tetap membaca/menulis lewat
//      localStorage seperti biasa (getAccounts, getUserData, dst).
//    - File ini "menyadap" localStorage.setItem untuk key-key
//      penting (akun, data transaksi, pengaturan) dan mendorongnya
//      ke Firestore secara otomatis setiap kali berubah.
//    - File ini juga memasang listener real-time Firestore: begitu
//      ada perubahan dari PERANGKAT LAIN, localStorage di perangkat
//      ini diperbarui otomatis dan halaman di-render ulang.
//    - Login/Register/ubah password/hapus akun dialihkan memakai
//      Firebase Authentication (lebih aman dari password base64
//      lokal sebelumnya), tapi validasi & tampilan form TETAP SAMA.
//    - Tetap bisa dipakai offline: Firestore offline persistence
//      aktif, jadi data tersimpan lokal dulu lalu disinkron begitu
//      koneksi kembali.
// ══════════════════════════════════════════════════════════ */

(function () {
  if (typeof firebase === "undefined") {
    console.warn("Firebase SDK belum dimuat — cek urutan <script> di index.html");
    return;
  }

  firebase.initializeApp(firebaseConfig);
  const auth = firebase.auth();
  const db = firebase.firestore();

  // Simpan data offline & sinkron otomatis saat online kembali
  db.enablePersistence({ synchronizeTabs: true }).catch((err) => {
    console.warn("Firestore offline persistence tidak aktif:", err.code);
  });

  let currentUid = null;
  let applyingRemote = false; // cegah loop: snapshot masuk -> localStorage -> terdeteksi sebagai "perubahan lokal" -> push balik ke cloud
  let unsubProfile = null;
  let unsubData = null;
  const pendingWrites = {}; // debounce per key

  function profileRef(uid) { return db.collection("users").doc(uid); }
  function dataRef(uid)    { return db.collection("users").doc(uid).collection("data").doc("main"); }

  /* ── Terjemahkan pesan error Firebase ke Bahasa Indonesia ── */
  function translateAuthError(code) {
    const map = {
      "auth/email-already-in-use": "Email sudah terdaftar. Silakan masuk.",
      "auth/invalid-email": "Format email tidak valid.",
      "auth/weak-password": "Password terlalu lemah (minimal 6 karakter).",
      "auth/user-not-found": "Akun tidak ditemukan. Silakan daftar dahulu.",
      "auth/wrong-password": "Password salah. Coba lagi.",
      "auth/invalid-credential": "Email atau password salah.",
      "auth/too-many-requests": "Terlalu banyak percobaan. Coba lagi nanti.",
      "auth/network-request-failed": "Tidak ada koneksi internet. Periksa jaringan kamu.",
      "auth/requires-recent-login": "Sesi kamu sudah lama, silakan masuk ulang lalu coba lagi."
    };
    return map[code] || "Terjadi kesalahan. Coba lagi.";
  }

  /* ══════════════════════════════════════
     INTERCEPT localStorage.setItem
     Setiap kali app.js menulis data akun/transaksi/pengaturan,
     dorong juga ke Firestore (kalau sedang login & bukan hasil
     dari menerima data remote).
  ══════════════════════════════════════ */
  const originalSetItem = localStorage.setItem.bind(localStorage);
  localStorage.setItem = function (key, value) {
    originalSetItem(key, value);
    if (applyingRemote || !currentUid) return;

    if (key === ACCOUNTS_KEY) {
      queuePush("profile", () => {
        const accounts = getAccounts();
        const user = accounts[currentEmail()];
        if (user) return profileRef(currentUid).set(user, { merge: true });
      });
    } else if (key === dataKey(currentEmail())) {
      queuePush("data", () => dataRef(currentUid).set(getUserData(currentEmail())));
    } else if (key === SETTINGS_KEY) {
      queuePush("settings", () => profileRef(currentUid).set({ appSettings: getAppSettings() }, { merge: true }));
    }
  };

  function queuePush(tag, fn) {
    clearTimeout(pendingWrites[tag]);
    pendingWrites[tag] = setTimeout(() => {
      fn()?.catch((err) => console.warn("Gagal sinkron (" + tag + "):", err.message));
    }, 350);
  }

  /* ══════════════════════════════════════
     REALTIME LISTENERS — terima perubahan dari perangkat lain
  ══════════════════════════════════════ */
  function attachRealtimeListeners(uid, email) {
    detachRealtimeListeners();
    unsubProfile = profileRef(uid).onSnapshot((doc) => {
      if (!doc.exists) return;
      const remote = doc.data();
      applyingRemote = true;
      const accounts = getAccounts();
      const { appSettings, ...profileFields } = remote;
      accounts[email] = Object.assign({}, accounts[email], profileFields);
      saveAccounts(accounts);
      if (appSettings) saveAppSettings(Object.assign({}, getAppSettings(), appSettings));
      applyingRemote = false;
      if (document.getElementById("app-wrap")?.style.display !== "none") {
        refreshHeaderAvatar();
        if (document.getElementById("page-settings")?.style.display === "block") refreshSettingsUI();
      }
    });

    unsubData = dataRef(uid).onSnapshot((doc) => {
      if (!doc.exists) return;
      applyingRemote = true;
      saveUserData(email, doc.data());
      applyingRemote = false;
      const visiblePage = ["dashboard", "portofolio", "riwayat"].find(
        (p) => document.getElementById("page-" + p)?.style.display === "block"
      );
      if (visiblePage === "dashboard") renderDashboard();
      if (visiblePage === "portofolio") renderPortofolio();
      if (visiblePage === "riwayat") renderRiwayat();
    });
  }
  function detachRealtimeListeners() {
    if (unsubProfile) { unsubProfile(); unsubProfile = null; }
    if (unsubData) { unsubData(); unsubData = null; }
  }

  /* ══════════════════════════════════════
     REGISTER — Firebase Auth + migrasi data lokal lama (jika ada)
  ══════════════════════════════════════ */
  window.doRegister = function () {
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

    // Kalau perangkat ini sebelumnya sudah punya akun lokal dengan
    // email yang sama (dipakai sebelum update cloud), datanya dibawa
    // naik ke cloud alih-alih mulai dari kosong.
    const legacyAccounts = getAccounts();
    const legacyUser = legacyAccounts[email] || null;
    const legacyData = legacyUser ? getUserData(email) : { assets: [], transactions: [] };

    auth.createUserWithEmailAndPassword(email, pass)
      .then(async (cred) => {
        const uid = cred.user.uid;
        const profile = {
          name,
          email,
          pin: legacyUser?.pin || null,
          photo: legacyUser?.photo || null,
          createdAt: legacyUser?.createdAt || Date.now()
        };
        await profileRef(uid).set(profile, { merge: true });
        await dataRef(uid).set(legacyData);

        showSuc(legacyUser
          ? '✅ Akun berhasil dibuat & data lama di perangkat ini otomatis disinkronkan!'
          : '✅ Akun berhasil dibuat! Silakan masuk.');
        document.getElementById('login-email').value = email;
        setTimeout(() => switchLoginTab('login'), 1600);
        auth.signOut();
      })
      .catch((err) => showErr(translateAuthError(err.code)));
  };

  /* ══════════════════════════════════════
     LOGIN — Firebase Auth + tarik data cloud ke localStorage
  ══════════════════════════════════════ */
  window.doLogin = function () {
    const email = document.getElementById('login-email').value.trim().toLowerCase();
    const pass  = document.getElementById('login-password').value;
    if (!email || !pass) return showLoginError('Email dan password wajib diisi.');

    auth.signInWithEmailAndPassword(email, pass)
      .then(async (cred) => {
        const uid = cred.user.uid;
        currentUid = uid;

        const profileSnap = await profileRef(uid).get();
        const dataSnap = await dataRef(uid).get();
        const profile = profileSnap.exists ? profileSnap.data() : { name: email, pin: null, photo: null };
        const data = dataSnap.exists ? dataSnap.data() : { assets: [], transactions: [] };

        applyingRemote = true;
        const accounts = getAccounts();
        accounts[email] = Object.assign({}, accounts[email], profile);
        saveAccounts(accounts);
        saveUserData(email, data);
        if (profile.appSettings) saveAppSettings(Object.assign({}, getAppSettings(), profile.appSettings));
        applyingRemote = false;

        saveSession({ email, loggedAt: Date.now() });
        attachRealtimeListeners(uid, email);
        proceedAfterLogin(email, accounts[email]);
      })
      .catch((err) => showLoginError(translateAuthError(err.code)));
  };

  /* ══════════════════════════════════════
     LOGOUT
  ══════════════════════════════════════ */
  window.doLogout = function () {
    if (!confirm('Yakin ingin keluar dari akun?')) return;
    detachRealtimeListeners();
    currentUid = null;
    auth.signOut().finally(logoutToLogin);
  };

  /* ══════════════════════════════════════
     UBAH PASSWORD — lewat Firebase Auth (reauthenticate dulu)
  ══════════════════════════════════════ */
  window.savePassword = function () {
    const session = getSession();
    if (!session) return;
    const old = document.getElementById('pw-old').value;
    const nw  = document.getElementById('pw-new').value;
    const cnf = document.getElementById('pw-confirm').value;
    const errEl = document.getElementById('pw-error');
    function err(m) { errEl.textContent = m; errEl.style.display = 'block'; }

    if (nw.length < 8) return err('Password baru minimal 8 karakter.');
    if (!/[a-zA-Z]/.test(nw) || !/[0-9]/.test(nw)) return err('Password harus mengandung huruf dan angka.');
    if (nw !== cnf) return err('Konfirmasi password tidak cocok.');

    const user = auth.currentUser;
    if (!user) return err('Sesi berakhir, silakan masuk ulang.');
    const cred = firebase.auth.EmailAuthProvider.credential(session.email, old);

    user.reauthenticateWithCredential(cred)
      .then(() => user.updatePassword(nw))
      .then(() => {
        closeModal('modal-password');
        showToast('✅ Password berhasil diubah');
      })
      .catch((fbErr) => err(translateAuthError(fbErr.code)));
  };

  /* ══════════════════════════════════════
     HAPUS AKUN — reauthenticate lalu hapus dari Auth + Firestore
  ══════════════════════════════════════ */
  window.confirmDeleteAccount = function () {
    const session = getSession();
    if (!session) return;
    const pass = document.getElementById('del-acc-password').value;
    const confirmText = document.getElementById('del-acc-confirm-text').value.trim();
    const errEl = document.getElementById('del-acc-error');
    function err(m) { errEl.textContent = m; errEl.style.display = 'block'; }

    if (confirmText !== 'HAPUS AKUN') return err('Ketik "HAPUS AKUN" persis untuk konfirmasi.');

    const user = auth.currentUser;
    if (!user) return err('Sesi berakhir, silakan masuk ulang.');
    const cred = firebase.auth.EmailAuthProvider.credential(session.email, pass);

    user.reauthenticateWithCredential(cred)
      .then(async () => {
        const uid = user.uid;
        await dataRef(uid).delete().catch(() => {});
        await profileRef(uid).delete().catch(() => {});
        await user.delete();

        detachRealtimeListeners();
        currentUid = null;
        const accounts = getAccounts();
        delete accounts[session.email];
        saveAccounts(accounts);
        LS.del(dataKey(session.email));
        closeModal('modal-delete-account');
        logoutToLogin();
        showToast('Akun telah dihapus');
      })
      .catch((fbErr) => err(translateAuthError(fbErr.code)));
  };

  /* ══════════════════════════════════════
     Pulihkan sesi saat app dibuka ulang (reload / buka app PWA)
     Firebase Auth punya sesi sendiri yang persisten; begitu
     "restored", pasang lagi listener real-time-nya.
  ══════════════════════════════════════ */
  auth.onAuthStateChanged((user) => {
    if (user) {
      currentUid = user.uid;
      const session = getSession();
      if (session && session.email === user.email) {
        attachRealtimeListeners(user.uid, user.email);
      }
    }
  });
})();
