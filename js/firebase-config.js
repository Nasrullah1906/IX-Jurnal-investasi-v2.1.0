/* ══════════════════════════════════════════════════════════
   JURNAL INVESTASI — firebase-config.js
   ISI file ini dengan konfigurasi project Firebase KAMU SENDIRI.

   Cara mendapatkannya:
   1. Buka https://console.firebase.google.com → buat project baru (gratis)
   2. Di dashboard project → klik ikon "</>" (Add app → Web)
   3. Daftarkan app (nama bebas), JANGAN centang Firebase Hosting
   4. Copy object "firebaseConfig" yang muncul, tempel di bawah ini
   5. Di menu kiri: Authentication → Get started → aktifkan
      metode "Email/Password"
   6. Di menu kiri: Firestore Database → Create database →
      pilih "Start in production mode" → pilih lokasi terdekat
      (mis. asia-southeast2 / Jakarta)
   7. Tempel Firestore Security Rules dari file
      firestore.rules (disertakan) ke tab "Rules" di Firestore
══════════════════════════════════════════════════════════ */

const firebaseConfig = {
  apiKey: "AIzaSyClFbswv2uMhFVNYLxls05K-p9t2uq1Yg0",
  authDomain: "informatikxau-cbe2a.firebaseapp.com",
  databaseURL: "https://informatikxau-cbe2a-default-rtdb.asia-southeast1.firebasedatabase.app",
  projectId: "informatikxau-cbe2a",
  storageBucket: "informatikxau-cbe2a.firebasestorage.app",
  messagingSenderId: "139510084909",
  appId: "1:139510084909:web:d6a8f9c07e1c2375df8fa4",
  measurementId: "G-W8K3E4ZHGP"
};

// const FIREBASE_CONFIG = {
//   apiKey: "GANTI_DENGAN_API_KEY_KAMU",
//   authDomain: "GANTI.firebaseapp.com",
//   projectId: "GANTI_PROJECT_ID",
//   storageBucket: "GANTI.appspot.com",
//   messagingSenderId: "GANTI_SENDER_ID",
//   appId: "GANTI_APP_ID"
// };
