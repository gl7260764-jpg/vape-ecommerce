// Runs before the store is interactive: registers the service worker, and keeps the browser's install
// prompt (Chrome, Edge, Samsung Internet) for the store's own Install buttons. The prompt can fire
// before React mounts, so it's caught here rather than in a component.
try {
  window.addEventListener("beforeinstallprompt", (event) => {
    event.preventDefault();
    window.__bvsaInstallPrompt = event as InstallPromptEvent;
    window.dispatchEvent(new Event("bvsa-install-ready"));
  });
  window.addEventListener("appinstalled", () => {
    window.__bvsaInstallPrompt = null;
    window.dispatchEvent(new Event("bvsa-app-installed"));
  });

  if ("serviceWorker" in navigator && process.env.NODE_ENV === "production") {
    const register = () => void navigator.serviceWorker.register("/sw.js", { scope: "/" }).catch(() => {});
    if (document.readyState === "complete") register();
    else window.addEventListener("load", register, { once: true });
  }
} catch {
  // an old browser without these APIs: the store works without the app
}
