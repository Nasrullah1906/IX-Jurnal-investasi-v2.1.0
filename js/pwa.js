/* ══════════════════════════════════════════════════════════
   JURNAL INVESTASI — pwa.js
   Registrasi service worker, tombol "Pasang" (install prompt),
   dan banner "Versi baru tersedia" (update otomatis).
══════════════════════════════════════════════════════════ */

let swRegistration = null;
let deferredInstallPrompt = null;

/* ── Registrasi service worker ── */
if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    navigator.serviceWorker
      .register("./sw.js")
      .then((reg) => {
        swRegistration = reg;

        // Ada worker baru yang sedang menunggu (misal user buka tab lama saat versi baru sudah di-deploy)
        if (reg.waiting) showUpdateBanner();

        // Pantau worker baru yang baru saja ditemukan
        reg.addEventListener("updatefound", () => {
          const newWorker = reg.installing;
          if (!newWorker) return;
          newWorker.addEventListener("statechange", () => {
            if (newWorker.state === "installed" && navigator.serviceWorker.controller) {
              // Ada versi baru siap dipakai, tampilkan banner
              showUpdateBanner();
            }
          });
        });
      })
      .catch((err) => console.warn("Gagal mendaftarkan service worker:", err));

    // Setelah service worker baru mengambil alih, reload sekali agar semua aset terbaru terpakai
    let refreshing = false;
    navigator.serviceWorker.addEventListener("controllerchange", () => {
      if (refreshing) return;
      refreshing = true;
      window.location.reload();
    });
  });
}

function showUpdateBanner() {
  const banner = document.getElementById("update-banner");
  if (banner) banner.style.display = "flex";
}
document.getElementById("update-btn")?.addEventListener("click", () => {
  if (swRegistration && swRegistration.waiting) {
    swRegistration.waiting.postMessage({ type: "SKIP_WAITING" });
  }
  const banner = document.getElementById("update-banner");
  if (banner) banner.style.display = "none";
});

/* ── Tombol "Pasang" (install prompt) ── */
window.addEventListener("beforeinstallprompt", (e) => {
  e.preventDefault();
  deferredInstallPrompt = e;
  const dismissed = localStorage.getItem("ji_install_dismissed");
  if (!dismissed) {
    const banner = document.getElementById("install-banner");
    if (banner) banner.style.display = "flex";
  }
});

document.getElementById("install-btn")?.addEventListener("click", async () => {
  const banner = document.getElementById("install-banner");
  if (banner) banner.style.display = "none";
  if (!deferredInstallPrompt) return;
  deferredInstallPrompt.prompt();
  await deferredInstallPrompt.userChoice;
  deferredInstallPrompt = null;
});

document.getElementById("install-close")?.addEventListener("click", () => {
  const banner = document.getElementById("install-banner");
  if (banner) banner.style.display = "none";
  localStorage.setItem("ji_install_dismissed", "1");
});

// Sembunyikan banner pasang begitu aplikasi sudah terpasang / dijalankan sebagai app
window.addEventListener("appinstalled", () => {
  const banner = document.getElementById("install-banner");
  if (banner) banner.style.display = "none";
  deferredInstallPrompt = null;
});
