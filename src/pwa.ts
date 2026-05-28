import { registerSW } from 'virtual:pwa-register';

/**
 * Wire up the service worker so the app refreshes when a new build is
 * deployed. Shows a single in-page banner that the user can confirm to
 * apply the update.
 */
export const setupPWA = (): void => {
  const updateSW = registerSW({
    immediate: true,
    onNeedRefresh: () => {
      const banner = document.createElement('div');
      banner.style.cssText = `
        position:fixed;left:50%;bottom:16px;transform:translateX(-50%);
        background:#1a1a2e;color:#f2cc8f;padding:12px 18px;border-radius:8px;
        border:1px solid #f2cc8f;font-family:system-ui,sans-serif;font-size:14px;
        box-shadow:0 4px 16px rgba(0,0,0,.4);z-index:9999;display:flex;gap:12px;align-items:center;
      `;
      banner.innerHTML = `
        <span>🆕 Phiên bản mới có sẵn</span>
        <button id="pwa-update" style="background:#f2cc8f;color:#1a1a2e;border:0;padding:6px 12px;border-radius:6px;font-weight:bold;cursor:pointer;">Cập nhật</button>
        <button id="pwa-dismiss" style="background:transparent;color:#aaa;border:0;cursor:pointer;">✕</button>
      `;
      document.body.appendChild(banner);
      banner.querySelector('#pwa-update')?.addEventListener('click', () => {
        void updateSW(true);
      });
      banner.querySelector('#pwa-dismiss')?.addEventListener('click', () => banner.remove());
    },
    onOfflineReady: () => {
      // Optionally show "ready to use offline" toast. Keep silent for now.
    },
  });
};
