(() => {
  const state = (window.__hungryPwaInstallState ??= { prompts: {} });
  if (state.captureInstalled) return;
  state.captureInstalled = true;

  // Start the worker before the hydrated UI so Chrome can assess installability early.
  if (window.isSecureContext && "serviceWorker" in navigator) {
    state.serviceWorkerReady = navigator.serviceWorker.register("/sw.js", { scope: "/" })
      .then(() => navigator.serviceWorker.ready)
      .catch((error) => {
        state.serviceWorkerError = error instanceof Error ? error.message : String(error);
        return null;
      });
  }

  window.addEventListener("beforeinstallprompt", (event) => {
    const manifest = document.querySelector('link[rel="manifest"]')?.href ?? "";
    const app = manifest.includes("manifest-student")
      ? "student"
      : manifest.includes("manifest-canteen")
        ? "canteen"
        : null;
    if (!app) return;

    event.preventDefault();
    try {
      localStorage.removeItem(`hungry:pwa:installed:${app}`);
    } catch {
      // Keep prompt capture working when browser storage is blocked.
    }
    state.prompts[app] = event;
    window.dispatchEvent(new CustomEvent("hungry-pwa-install-prompt", { detail: { app } }));
  });
})();
