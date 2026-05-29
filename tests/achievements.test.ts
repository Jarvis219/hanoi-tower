import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const LS_KEY = 'thap-ha-noi.save';

const setupFreshLocalStorage = (): void => {
  const store = new Map<string, string>();
  vi.stubGlobal('localStorage', {
    getItem: (k: string) => store.get(k) ?? null,
    setItem: (k: string, v: string) => store.set(k, v),
    removeItem: (k: string) => store.delete(k),
    clear: () => store.clear(),
    key: (i: number) => Array.from(store.keys())[i] ?? null,
    get length() {
      return store.size;
    },
  });
  localStorage.removeItem(LS_KEY);
};

describe('AchievementManager', () => {
  beforeEach(() => {
    setupFreshLocalStorage();
    vi.resetModules();
  });
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('unlocks at target progress and fires listener once', async () => {
    const { achievementManager } = await import('../src/systems/AchievementManager');
    const { saveManager } = await import('../src/systems/SaveManager');
    let unlocks = 0;
    const off = achievementManager.onUnlock(() => {
      unlocks += 1;
    });
    achievementManager.bump('first_perfect', 1);
    achievementManager.bump('first_perfect', 1); // already unlocked, ignored
    expect(unlocks).toBe(1);
    expect(saveManager.getAchievement('first_perfect').unlocked).toBe(true);
    off();
  });

  it('setIfHigher does not regress progress and unlocks at target', async () => {
    const { achievementManager } = await import('../src/systems/AchievementManager');
    const { saveManager } = await import('../src/systems/SaveManager');
    achievementManager.setIfHigher('combo_5', 3);
    expect(saveManager.getAchievement('combo_5').progress).toBe(3);
    achievementManager.setIfHigher('combo_5', 2); // not higher
    expect(saveManager.getAchievement('combo_5').progress).toBe(3);
    achievementManager.setIfHigher('combo_5', 5);
    expect(saveManager.getAchievement('combo_5').unlocked).toBe(true);
  });

  it('recordRun appends to leaderboard sorted desc, max 10 entries', async () => {
    const { saveManager } = await import('../src/systems/SaveManager');
    for (let i = 0; i < 15; i += 1) {
      saveManager.recordRun(100 + i * 10, i, 'classic');
    }
    const board = saveManager.getLeaderboard('classic');
    expect(board.length).toBe(10);
    expect(board[0]!.score).toBe(240); // top
    expect(board[9]!.score).toBe(150); // 10th
  });
});

describe('ThemeManager', () => {
  beforeEach(() => {
    setupFreshLocalStorage();
    vi.resetModules();
  });
  afterEach(() => vi.unstubAllGlobals());

  it('only Hanoi unlocked at fresh save', async () => {
    const { themeManager } = await import('../src/systems/ThemeManager');
    expect(themeManager.isUnlocked('hanoi')).toBe(true);
    expect(themeManager.isUnlocked('hue')).toBe(false);
    expect(themeManager.isUnlocked('danang')).toBe(false);
    expect(themeManager.isUnlocked('saigon')).toBe(false);
  });

  it('Hue unlocks at highLevel 50', async () => {
    const { saveManager } = await import('../src/systems/SaveManager');
    const { themeManager } = await import('../src/systems/ThemeManager');
    saveManager.recordRun(0, 50, 'classic');
    expect(themeManager.isUnlocked('hue')).toBe(true);
    expect(themeManager.isUnlocked('danang')).toBe(false);
    expect(themeManager.isUnlocked('saigon')).toBe(false);
  });

  it('Da Nang unlocks at highLevel 100', async () => {
    const { saveManager } = await import('../src/systems/SaveManager');
    const { themeManager } = await import('../src/systems/ThemeManager');
    saveManager.recordRun(0, 100, 'classic');
    expect(themeManager.isUnlocked('hue')).toBe(true);
    expect(themeManager.isUnlocked('danang')).toBe(true);
    expect(themeManager.isUnlocked('saigon')).toBe(false);
  });

  it('Saigon unlocks at highLevel 150', async () => {
    const { saveManager } = await import('../src/systems/SaveManager');
    const { themeManager } = await import('../src/systems/ThemeManager');
    saveManager.recordRun(0, 150, 'classic');
    expect(themeManager.isUnlocked('saigon')).toBe(true);
  });

  it('select() returns false for locked theme and keeps Hanoi selected', async () => {
    const { themeManager } = await import('../src/systems/ThemeManager');
    expect(themeManager.select('saigon')).toBe(false);
    expect(themeManager.getSelected().id).toBe('hanoi');
  });
});
