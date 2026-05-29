const KEY = 'thap-ha-noi.consent';

type Choice = 'accepted' | 'rejected' | null;

interface StoredConsent {
  choice: 'accepted' | 'rejected';
  at: string;
}

class ConsentManager {
  private cached: Choice = null;
  private resolvedFromStorage = false;

  private load(): Choice {
    if (this.resolvedFromStorage) return this.cached;
    try {
      const raw = localStorage.getItem(KEY);
      if (raw) {
        const parsed = JSON.parse(raw) as StoredConsent;
        this.cached = parsed.choice;
      }
    } catch {
      // ignore
    }
    this.resolvedFromStorage = true;
    return this.cached;
  }

  private save(choice: 'accepted' | 'rejected'): void {
    try {
      const payload: StoredConsent = { choice, at: new Date().toISOString() };
      localStorage.setItem(KEY, JSON.stringify(payload));
      this.cached = choice;
    } catch {
      // ignore
    }
  }

  public hasDecided(): boolean {
    return this.load() !== null;
  }

  public hasAccepted(): boolean {
    return this.load() === 'accepted';
  }

  public accept(): void {
    this.save('accepted');
  }

  public reject(): void {
    this.save('rejected');
  }

  public reset(): void {
    try {
      localStorage.removeItem(KEY);
    } catch {
      // ignore
    }
    this.cached = null;
    this.resolvedFromStorage = false;
  }
}

export const consentManager = new ConsentManager();
