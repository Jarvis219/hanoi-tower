import { consentManager } from './ConsentManager';

const env = import.meta.env;

const PUBLISHER_ID = env.VITE_ADSENSE_PUBLISHER_ID as string | undefined;
const BANNER_SLOT = env.VITE_ADSENSE_BANNER_SLOT as string | undefined;
const INTERSTITIAL_SLOT = env.VITE_ADSENSE_INTERSTITIAL_SLOT as string | undefined;

const INTERSTITIAL_FREQUENCY = 3; // every Nth game over
const INTERSTITIAL_COUNTER_KEY = 'thap-ha-noi.interstitial-counter';

declare global {
  interface Window {
    adsbygoogle?: unknown[];
  }
}

class AdsManager {
  private scriptLoaded = false;
  private scriptLoading: Promise<void> | null = null;

  public get enabled(): boolean {
    return Boolean(PUBLISHER_ID && consentManager.hasAccepted());
  }

  private async ensureScript(): Promise<void> {
    if (this.scriptLoaded) return;
    if (this.scriptLoading) return this.scriptLoading;
    if (!PUBLISHER_ID) return;
    if (!consentManager.hasAccepted()) return;
    this.scriptLoading = new Promise<void>((resolve) => {
      const s = document.createElement('script');
      s.async = true;
      s.crossOrigin = 'anonymous';
      s.src = `https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=${PUBLISHER_ID}`;
      s.onload = (): void => {
        this.scriptLoaded = true;
        resolve();
      };
      s.onerror = (): void => {
        console.warn('[Ads] AdSense script failed to load');
        resolve();
      };
      document.head.appendChild(s);
    });
    return this.scriptLoading;
  }

  /**
   * Mount a banner ad anchored to the bottom of the canvas. The DOM element
   * lives outside Phaser; the game container needs `position: relative` so the
   * banner can absolute-position above the canvas without being clipped.
   */
  public async showBanner(parentId = 'app'): Promise<void> {
    if (!this.enabled || !BANNER_SLOT) return;
    await this.ensureScript();

    const existing = document.getElementById('ads-banner');
    if (existing) return;

    const parent = document.getElementById(parentId);
    if (!parent) return;

    const wrap = document.createElement('div');
    wrap.id = 'ads-banner';
    wrap.style.cssText =
      'position:absolute;bottom:0;left:50%;transform:translateX(-50%);' +
      'width:min(320px,100%);min-height:50px;background:rgba(0,0,0,0.2);' +
      'pointer-events:auto;z-index:5;';

    const ins = document.createElement('ins');
    ins.className = 'adsbygoogle';
    ins.style.display = 'block';
    ins.setAttribute('data-ad-client', PUBLISHER_ID!);
    ins.setAttribute('data-ad-slot', BANNER_SLOT);
    ins.setAttribute('data-ad-format', 'auto');
    ins.setAttribute('data-full-width-responsive', 'true');

    wrap.appendChild(ins);
    parent.appendChild(wrap);

    try {
      (window.adsbygoogle = window.adsbygoogle ?? []).push({});
    } catch (err) {
      console.warn('[Ads] banner push failed:', err);
    }
  }

  public hideBanner(): void {
    const el = document.getElementById('ads-banner');
    if (el) el.remove();
  }

  /**
   * Show an interstitial-style ad gate: dim overlay + ad + skip button (5s timer).
   * Resolves after the user dismisses. No-op when disabled.
   */
  public async maybeShowInterstitial(): Promise<void> {
    if (!this.enabled || !INTERSTITIAL_SLOT) return;
    const counter = this.bumpInterstitialCounter();
    if (counter % INTERSTITIAL_FREQUENCY !== 0) return;
    await this.ensureScript();
    await this.showInterstitialOverlay();
  }

  private bumpInterstitialCounter(): number {
    try {
      const raw = localStorage.getItem(INTERSTITIAL_COUNTER_KEY);
      const n = raw ? parseInt(raw, 10) : 0;
      const next = n + 1;
      localStorage.setItem(INTERSTITIAL_COUNTER_KEY, String(next));
      return next;
    } catch {
      return 0;
    }
  }

  private showInterstitialOverlay(): Promise<void> {
    return new Promise((resolve) => {
      const overlay = document.createElement('div');
      overlay.style.cssText =
        'position:fixed;inset:0;background:rgba(0,0,0,0.85);z-index:10000;' +
        'display:flex;flex-direction:column;align-items:center;justify-content:center;padding:24px;';

      const card = document.createElement('div');
      card.style.cssText =
        'width:min(360px,100%);background:#1a1a2e;border-radius:12px;padding:16px;color:#fff;';

      const adWrap = document.createElement('div');
      adWrap.style.cssText =
        'min-height:250px;background:rgba(255,255,255,0.04);border-radius:8px;overflow:hidden;';
      const ins = document.createElement('ins');
      ins.className = 'adsbygoogle';
      ins.style.cssText = 'display:block;width:100%;min-height:250px;';
      ins.setAttribute('data-ad-client', PUBLISHER_ID!);
      ins.setAttribute('data-ad-slot', INTERSTITIAL_SLOT!);
      ins.setAttribute('data-ad-format', 'auto');
      ins.setAttribute('data-full-width-responsive', 'true');
      adWrap.appendChild(ins);
      card.appendChild(adWrap);

      const skipBtn = document.createElement('button');
      skipBtn.textContent = 'Bỏ qua (5)';
      skipBtn.disabled = true;
      skipBtn.style.cssText =
        'margin-top:12px;padding:10px 20px;border:none;border-radius:8px;font-size:14px;' +
        'background:#3d405b;color:#fff;cursor:pointer;width:100%;font-weight:bold;opacity:0.6;';
      card.appendChild(skipBtn);

      overlay.appendChild(card);
      document.body.appendChild(overlay);

      try {
        (window.adsbygoogle = window.adsbygoogle ?? []).push({});
      } catch {
        // ignore
      }

      let remaining = 5;
      const tick = setInterval(() => {
        remaining -= 1;
        if (remaining > 0) {
          skipBtn.textContent = `Bỏ qua (${remaining})`;
        } else {
          skipBtn.disabled = false;
          skipBtn.style.opacity = '1';
          skipBtn.textContent = 'Bỏ qua ✕';
          clearInterval(tick);
        }
      }, 1000);

      skipBtn.onclick = (): void => {
        if (skipBtn.disabled) return;
        clearInterval(tick);
        overlay.remove();
        resolve();
      };
    });
  }
}

export const adsManager = new AdsManager();
