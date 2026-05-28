export interface ShareInput {
  text: string;
  url?: string;
  /** Optional canvas to grab a screenshot from (e.g., game canvas). */
  canvas?: HTMLCanvasElement;
}

export interface ShareResult {
  method: 'native' | 'clipboard' | 'none';
  ok: boolean;
}

const canvasToBlob = (canvas: HTMLCanvasElement): Promise<Blob | null> =>
  new Promise((resolve) => canvas.toBlob((b) => resolve(b), 'image/png'));

/**
 * Share via Web Share API if available; fall back to clipboard copy.
 * Quietly returns 'none' if both fail (e.g., file:// or insecure context).
 */
export const shareScore = async (input: ShareInput): Promise<ShareResult> => {
  const url = input.url ?? (typeof location !== 'undefined' ? location.href : '');
  const text = input.text;

  // Try native Web Share with file when canvas provided
  try {
    if (typeof navigator !== 'undefined' && 'share' in navigator) {
      const nav = navigator as Navigator & {
        share?: (data: ShareData) => Promise<void>;
        canShare?: (data: ShareData) => boolean;
      };
      const baseData: ShareData = { text, url, title: text };

      if (input.canvas && nav.canShare) {
        const blob = await canvasToBlob(input.canvas);
        if (blob) {
          const file = new File([blob], 'thap-ha-noi.png', { type: 'image/png' });
          const withFile: ShareData = { ...baseData, files: [file] };
          if (nav.canShare(withFile) && nav.share) {
            await nav.share(withFile);
            return { method: 'native', ok: true };
          }
        }
      }

      if (nav.share) {
        await nav.share(baseData);
        return { method: 'native', ok: true };
      }
    }
  } catch {
    // User cancelled or share failed — fall through to clipboard.
  }

  try {
    if (typeof navigator !== 'undefined' && navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(`${text} ${url}`.trim());
      return { method: 'clipboard', ok: true };
    }
  } catch {
    // Fall through
  }

  return { method: 'none', ok: false };
};
