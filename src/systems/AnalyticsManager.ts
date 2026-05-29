/**
 * Lightweight analytics façade. By default a no-op so we can wire calls
 * throughout the game without pulling in a tracking SDK. Swap the
 * implementation for Plausible / GA later by replacing the `track` body.
 */

type EventName =
  | 'game_started'
  | 'game_over'
  | 'powerup_used'
  | 'achievement_unlocked'
  | 'theme_selected'
  | 'language_changed'
  | 'shared';

type Props = Record<string, string | number | boolean>;

class AnalyticsManagerImpl {
  private enabled = true;

  public setEnabled(enabled: boolean): void {
    this.enabled = enabled;
  }

  public track(event: EventName, props: Props = {}): void {
    if (!this.enabled) return;
    // No-op stub. Replace with Plausible / GA / custom endpoint when ready.
    // Keep logs out of the console in production by checking import.meta.env.DEV.
    if (import.meta.env.DEV) {
      console.debug('[analytics]', event, props);
    }
  }
}

export const analyticsManager = new AnalyticsManagerImpl();
