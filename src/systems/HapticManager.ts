import { saveManager } from './SaveManager';

const supportsVibrate = (): boolean =>
  typeof navigator !== 'undefined' && typeof navigator.vibrate === 'function';

class HapticManagerImpl {
  public vibrate(durationMs: number): void {
    if (!saveManager.hapticEnabled) return;
    if (!supportsVibrate()) return;
    try {
      navigator.vibrate(durationMs);
    } catch {
      // Some browsers throw on unhandled gestures; ignore.
    }
  }

  public pattern(pattern: number[]): void {
    if (!saveManager.hapticEnabled) return;
    if (!supportsVibrate()) return;
    try {
      navigator.vibrate(pattern);
    } catch {
      // ignore
    }
  }
}

export const hapticManager = new HapticManagerImpl();
