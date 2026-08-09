# Jurnal Investasi

Aplikasi web (PWA) untuk mencatat pembelian rutin (DCA) — kripto, emas, saham, reksadana, dan aset lainnya. Semua data tersimpan di perangkat kamu sendiri (`localStorage`), tanpa server/backend.

**Demo:** aktifkan GitHub Pages lalu buka `https://<username>.github.io/<nama-repo>/`

## ✨ Fitur

- **Masuk / Daftar akun** dengan email & password (tersimpan lokal di perangkat), dilindungi opsi **PIN 6-digit** saat membuka aplikasi
- **Dashboard** terpisah: ringkasan total modal, nilai portofolio, untung/rugi, grafik komposisi aset, tren investasi bulanan, dan transaksi terbaru
- Catat setiap pembelian: aset, tanggal, harga per unit, nominal investasi (unit dihitung otomatis)
- Halaman **Portofolio**: rincian tiap aset (unit, harga rata-rata, harga sekarang, untung/rugi) dengan update harga manual atau **harga live kripto via CoinGecko**
- Halaman **Riwayat** transaksi dengan filter per kategori aset
- Grafik komposisi (donut) & tren bulanan (bar) — dibuat native dengan SVG, tanpa dependensi eksternal, agar tetap ringan & 100% offline
- **Pengaturan** lengkap: edit profil (nama, email, **foto profil** via upload), ubah password, atur/ubah PIN, mode gelap/terang, **mata uang tampilan (USD/IDR)**, toggle harga live, ekspor & impor data (JSON), hapus semua data, hapus akun
- **Bisa dipasang sebagai aplikasi (PWA)** — jalan offline setelah pertama dibuka
- 100% front-end, tidak ada data yang dikirim ke server manapun (kecuali permintaan harga live opsional ke CoinGecko)

## 📁 Struktur proyek

```
jurnal-investasi/
├── index.html          # markup halaman (login, PIN, dashboard, catat, portofolio, riwayat, pengaturan)
├── manifest.json        # manifest PWA (nama, ikon, warna tema)
├── sw.js                 # service worker (cache offline + update otomatis)
├── favicon.ico
├── css/
│   └── style.css         # design system (tema gelap/terang, komponen, dsb)
├── js/
│   ├── app.js             # logika aplikasi (auth, PIN, data, dashboard, chart SVG)
│   └── pwa.js              # registrasi service worker + tombol pasang + banner update
└── icons/                 # ikon PWA berbagai ukuran (192, 512, maskable, apple-touch, favicon)
```

> **Catatan:** folder `icons/` perlu diisi sendiri (belum disertakan) — buat ikon `icon-192.png`, `icon-512.png`, `maskable-192.png`, `maskable-512.png`, `apple-touch-icon.png`, `favicon-32.png`, `favicon-16.png` sesuai logo kamu, lalu taruh di folder ini.

## ☁️ Sinkronisasi Otomatis Antar Perangkat (Firebase)

Sejak versi ini, akun & data **disinkronkan otomatis secara real-time** antar semua perangkat yang login dengan email yang sama, memakai [Firebase](https://firebase.google.com) (gratis untuk pemakaian pribadi). Aplikasi **tetap bisa dipakai offline** — perubahan disimpan lokal dulu, lalu otomatis disinkron begitu koneksi kembali.

### Setup (wajib dilakukan sekali sebelum deploy)

1. Buka [Firebase Console](https://console.firebase.google.com) → **Add project** (gratis, tidak perlu kartu kredit).
2. Di dashboard project → klik ikon **`</>`** (Add app → Web) → daftarkan app (nama bebas, **jangan** centang Firebase Hosting).
3. Copy object `firebaseConfig` yang muncul, tempel ke `js/firebase-config.js` (ganti semua nilai `GANTI_...`).
4. Menu kiri → **Authentication** → **Get started** → aktifkan metode **Email/Password**.
5. Menu kiri → **Firestore Database** → **Create database** → pilih **"Start in production mode"** → pilih lokasi terdekat (mis. `asia-southeast2` untuk Jakarta).
6. Tab **Rules** di Firestore → tempel isi file `firestore.rules` (disertakan di repo ini) → **Publish**. Ini memastikan tiap user **hanya bisa mengakses datanya sendiri**.
7. Push ke GitHub seperti biasa, deploy ulang.

### Cara kerja

- Saat **Daftar**: akun dibuat di Firebase Authentication. Kalau perangkat itu sebelumnya sudah punya data lokal dengan email yang sama (dari sebelum update ini), data itu **otomatis dibawa naik ke cloud**, tidak hilang.
- Saat **Masuk** di perangkat baru: data terbaru dari cloud otomatis ditarik turun.
- Setiap perubahan (transaksi baru, edit profil, ganti pengaturan, dll) otomatis terkirim ke cloud dan **muncul real-time** di perangkat lain yang sedang terbuka.
- PIN 6-digit tetap berfungsi sebagai kunci lokal per perangkat (tidak memengaruhi sinkronisasi).

> **Catatan keamanan:** dengan Firebase Auth, password kamu tidak lagi disimpan sebagai teks/encoded di perangkat — ditangani penuh oleh Firebase, jauh lebih aman dari metode lokal sebelumnya.

## 🔐 Tentang akun & data

- Akun & profil (nama, foto, PIN) tersimpan di **Firebase Authentication + Firestore** (cloud), dan **di-cache lokal** di `localStorage` supaya tetap bisa dipakai offline.
- Gunakan **Ekspor JSON** secara berkala di menu Pengaturan → Kelola Data sebagai cadangan tambahan di luar cloud.

## 💱 Mata Uang Tampilan (USD/IDR)

- Semua data tetap **disimpan dalam Rupiah (IDR)** di `localStorage` — mengubah mata uang tampilan hanya mengubah cara angka ditampilkan, tidak mengubah data tersimpan.
- Saat memilih **USD**, aplikasi mengambil kurs USD→IDR terkini via API publik gratis ([frankfurter.app](https://www.frankfurter.app/)), lalu menyimpan cache-nya selama 6 jam agar tetap bisa dipakai offline.
- Jika sedang offline dan belum pernah mengambil kurs sebelumnya, aplikasi memakai kurs cadangan (fallback) di dalam kode.
- Atur di **Pengaturan → Mata Uang Tampilan**.

## 🚀 Menjalankan secara lokal

PWA butuh dilayani lewat HTTP (bukan dibuka langsung sebagai file), karena service worker tidak berjalan pada protokol `file://`.

```bash
# opsi 1: Python
python3 -m http.server 8080

# opsi 2: Node (npx)
npx serve .
```

Lalu buka `http://localhost:8080`.

## 🌐 Deploy ke GitHub Pages

1. Push repo ini ke GitHub.
2. Buka **Settings → Pages**.
3. Source: **Deploy from a branch**, branch `main`, folder `/ (root)`.
4. Tunggu beberapa menit, situs akan aktif di `https://<username>.github.io/<nama-repo>/`.

> Catatan: jika repo di-deploy di subfolder (misalnya `username.github.io/repo-name/`), semua path di proyek ini sudah relatif (`./`) sehingga otomatis kompatibel — tidak perlu ubah apa pun.

## 📲 Memasang sebagai aplikasi

- **Android/Desktop (Chrome/Edge):** klik tombol **"Pasang"** di banner atas dashboard, atau ikon install di address bar.
- **iOS (Safari):** tombol Share → **"Add to Home Screen"**.

## 🔄 Update otomatis

Saat ada versi baru ter-deploy, aplikasi akan menampilkan banner "Versi baru tersedia" di bagian bawah layar. Klik **Perbarui** untuk memuat versi terbaru tanpa kehilangan data (data tetap di `localStorage`, tidak terpengaruh oleh update cache).

Jika kamu mengubah file apa pun di `css/`, `js/`, atau `index.html`, **naikkan `CACHE_VERSION` di `sw.js`** supaya pengguna lama otomatis mendapat file terbaru.

## 🛠️ Lisensi

Bebas dipakai dan dimodifikasi untuk keperluan pribadi. Lihat `LICENSE`.
