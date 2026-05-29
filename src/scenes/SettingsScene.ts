import Phaser from 'phaser';
import { GAME_HEIGHT, GAME_WIDTH, SCENE_KEYS } from '../config/Constants';
import { audioManager } from '../systems/AudioManager';
import { authManager } from '../systems/supabase/AuthManager';
import { supabaseEnabled } from '../systems/supabase/SupabaseClient';
import { hapticManager } from '../systems/HapticManager';
import { saveManager } from '../systems/SaveManager';
import { setLanguage, t } from '../systems/I18nManager';
import { themeManager } from '../systems/ThemeManager';
import { Button, COLOR } from '../ui/Button';
import { phaserPrompt } from '../ui/phaserPrompt';

const SLIDER_W = 220;
const SLIDER_H = 12;
const PILL_W = 64;
const PILL_H = 32;
const PILL_R = 14;

// Each row helper uses a different Phaser Text origin convention, so to keep
// the visual gap between a section's header line and its first row identical
// across sections (~14px), we offset by the row's "ascent" — how far its
// content extends above its anchor y. SECTION_GAP_* = ascent + 14px gap.
const SECTION_GAP_SLIDER = 47; // slider label origin (0,1), text height ~33px above y
const SECTION_GAP_INLINE = 23; // toggle/language label origin (0,0.5), ~9px above y
const SECTION_GAP_USERNAME = 20; // username label origin (0.5,0.5) at fontSize 12, ~6px above y
const SECTION_GAP_BUTTON = 36; // button height 44 origin center, ~22px above y

export class SettingsScene extends Phaser.Scene {
  private resetConfirming = false;
  private resetBtn!: Button;
  private resetTimer?: Phaser.Time.TimerEvent;
  private editingUsername = false;

  constructor() {
    super({ key: SCENE_KEYS.Settings });
  }

  public create(): void {
    const theme = themeManager.getSelected();
    this.cameras.main.setBackgroundColor(theme.menuBgColor);
    this.add
      .text(GAME_WIDTH / 2, 30, t('settings.title'), {
        fontFamily: 'system-ui, sans-serif',
        fontSize: '28px',
        color: themeManager.accentHex(),
        fontStyle: 'bold',
        stroke: '#000',
        strokeThickness: 4,
      })
      .setOrigin(0.5, 0);

    // Sections, top → bottom: Audio, Preferences, Account, Danger zone.
    // Each `makeSectionHeader` draws AT its y argument; the row immediately
    // after sits at `y + SECTION_GAP_*` so the visual gap from the header
    // line is identical (~14px) across every section regardless of row type.
    let y = 90;
    const SECTION_SPACING = 28; // vertical space between two sections

    this.makeSectionHeader(y, t('settings.section_audio'));
    this.makeSlider(y + SECTION_GAP_SLIDER, t('settings.bgm'), saveManager.bgmVolume, (v) => {
      audioManager.setBgmVolume(v);
    });
    this.makeSlider(y + SECTION_GAP_SLIDER + 60, t('settings.sfx'), saveManager.sfxVolume, (v) => {
      audioManager.setSfxVolume(v);
      audioManager.playSfx('click');
    });
    y = y + SECTION_GAP_SLIDER + 60 + SECTION_SPACING;

    this.makeSectionHeader(y, t('settings.section_prefs'));
    this.makeToggle(
      y + SECTION_GAP_INLINE,
      t('settings.haptic'),
      saveManager.hapticEnabled,
      (next) => {
        saveManager.setHapticEnabled(next);
        if (next) hapticManager.vibrate(60);
      },
    );
    this.makeLanguagePicker(y + SECTION_GAP_INLINE + 44);
    y = y + SECTION_GAP_INLINE + 44 + SECTION_SPACING;

    if (supabaseEnabled) {
      this.makeSectionHeader(y, t('settings.section_account'));
      const usernameY = y + SECTION_GAP_USERNAME;
      this.makeUsernameRow(usernameY);
      // Username stack height: label(0) + name(+18) + edit button center(+44,
      // h=28 → bottom +58). Add ~24px before the linked-account status text.
      this.makeAccountSection(usernameY + 82);
      // Account section bottom (when NOT linked): status(0) + button(+32, h=40
      // → +52) + hint(+60, h=11 → +71). Reserve 88px to keep the next section
      // header clear of the hint text.
      const accountHeight = authManager.isGoogleLinked ? 40 : 88;
      y = usernameY + 82 + accountHeight;
    }

    this.makeSectionHeader(y, t('settings.section_danger'));
    this.resetBtn = new Button(this, {
      x: GAME_WIDTH / 2,
      y: y + SECTION_GAP_BUTTON,
      width: 220,
      height: 44,
      label: t('settings.reset'),
      icon: '🗑',
      fontSize: 14,
      bgColor: COLOR.danger,
      onClick: () => this.handleResetPress(),
    });

    new Button(this, {
      x: GAME_WIDTH / 2,
      y: GAME_HEIGHT - 50,
      width: 200,
      height: 44,
      label: t('settings.back').replace(/^←\s*/, ''),
      icon: '←',
      fontSize: 16,
      bgColor: COLOR.neutral,
      onClick: () => this.scene.start(SCENE_KEYS.MainMenu),
    });
  }

  /**
   * Lightweight section header — gold uppercase label on the left with a
   * thin divider extending to the right edge. Draws AT y; the caller is
   * responsible for placing the first row at the right offset for its type
   * (see SECTION_GAP_* constants below).
   */
  private makeSectionHeader(y: number, label: string): void {
    const text = this.add
      .text(28, y, label.toUpperCase(), {
        fontFamily: 'system-ui, sans-serif',
        fontSize: '11px',
        color: '#f2cc8f',
        fontStyle: 'bold',
      })
      .setOrigin(0, 0.5)
      .setAlpha(0.85);

    const line = this.add.graphics();
    line.lineStyle(1, 0xf2cc8f, 0.18);
    line.lineBetween(28 + text.width + 10, y, GAME_WIDTH - 28, y);
  }

  private makeSlider(
    y: number,
    label: string,
    initial: number,
    onChange: (v: number) => void,
  ): void {
    const x = (GAME_WIDTH - SLIDER_W) / 2;

    this.add
      .text(x, y - 16, label, {
        fontFamily: 'system-ui, sans-serif',
        fontSize: '14px',
        color: '#ffffff',
        fontStyle: 'bold',
      })
      .setOrigin(0, 1);

    const track = this.add.graphics();
    track.fillStyle(0x333355, 1);
    track.fillRoundedRect(x, y - SLIDER_H / 2, SLIDER_W, SLIDER_H, SLIDER_H / 2);

    const fill = this.add.graphics();
    const drawFill = (value: number) => {
      fill.clear();
      const w = SLIDER_W * value;
      if (w <= 2) return;
      fill.fillStyle(0xf2cc8f, 1);
      fill.fillRoundedRect(x, y - SLIDER_H / 2, w, SLIDER_H, SLIDER_H / 2);
    };
    drawFill(initial);

    const knob = this.add
      .circle(x + SLIDER_W * initial, y, 13, 0xffffff)
      .setStrokeStyle(3, 0xf2cc8f)
      .setInteractive({ useHandCursor: true, draggable: true });

    knob.on('drag', (_p: unknown, dx: number) => {
      const clampedX = Phaser.Math.Clamp(dx, x, x + SLIDER_W);
      knob.x = clampedX;
      const value = (clampedX - x) / SLIDER_W;
      drawFill(value);
      onChange(value);
    });
    this.input.setDraggable(knob);
  }

  private makeToggle(
    y: number,
    label: string,
    initial: boolean,
    onChange: (v: boolean) => void,
  ): void {
    this.add
      .text(GAME_WIDTH / 2 - 110, y, label, {
        fontFamily: 'system-ui, sans-serif',
        fontSize: '14px',
        color: '#ffffff',
        fontStyle: 'bold',
      })
      .setOrigin(0, 0.5);

    const pill = this.makePill(
      GAME_WIDTH / 2 + 80,
      y,
      initial ? t('settings.on') : t('settings.off'),
      initial ? COLOR.primary : COLOR.muted,
    );

    let current = initial;
    pill.hit.on('pointerup', () => {
      current = !current;
      this.redrawPill(
        pill,
        current ? t('settings.on') : t('settings.off'),
        current ? COLOR.primary : COLOR.muted,
      );
      onChange(current);
    });
  }

  private makeLanguagePicker(y: number): void {
    this.add
      .text(GAME_WIDTH / 2 - 110, y, t('settings.language'), {
        fontFamily: 'system-ui, sans-serif',
        fontSize: '14px',
        color: '#ffffff',
        fontStyle: 'bold',
      })
      .setOrigin(0, 0.5);

    const isVi = saveManager.language === 'vi';
    const vi = this.makePill(GAME_WIDTH / 2 + 40, y, 'VI', isVi ? COLOR.primary : COLOR.muted);
    const en = this.makePill(GAME_WIDTH / 2 + 112, y, 'EN', !isVi ? COLOR.primary : COLOR.muted);

    vi.hit.on('pointerup', () => {
      void setLanguage('vi').then(() => this.scene.restart());
    });
    en.hit.on('pointerup', () => {
      void setLanguage('en').then(() => this.scene.restart());
    });
  }

  private makePill(
    x: number,
    y: number,
    label: string,
    color: number,
  ): {
    container: Phaser.GameObjects.Container;
    bg: Phaser.GameObjects.Graphics;
    text: Phaser.GameObjects.Text;
    hit: Phaser.GameObjects.Rectangle;
  } {
    const container = this.add.container(x, y);
    const bg = this.add.graphics();
    this.drawPillBg(bg, color);
    const text = this.add
      .text(0, -1, label, {
        fontFamily: 'system-ui, sans-serif',
        fontSize: '13px',
        color: '#ffffff',
        fontStyle: 'bold',
      })
      .setOrigin(0.5);
    const hit = this.add
      .rectangle(0, 0, PILL_W, PILL_H, 0xffffff, 0)
      .setOrigin(0.5)
      .setInteractive({ useHandCursor: true });
    container.add([bg, text, hit]);
    return { container, bg, text, hit };
  }

  private drawPillBg(g: Phaser.GameObjects.Graphics, color: number): void {
    g.clear();
    g.fillStyle(color, 1);
    g.fillRoundedRect(-PILL_W / 2, -PILL_H / 2, PILL_W, PILL_H, PILL_R);
    g.lineStyle(2, 0x000000, 0.25);
    g.strokeRoundedRect(-PILL_W / 2, -PILL_H / 2, PILL_W, PILL_H, PILL_R);
  }

  private redrawPill(
    pill: { bg: Phaser.GameObjects.Graphics; text: Phaser.GameObjects.Text },
    label: string,
    color: number,
  ): void {
    pill.text.setText(label);
    this.drawPillBg(pill.bg, color);
  }

  private makeUsernameRow(y: number): void {
    const name = authManager.displayName;
    // Stack vertically — at 20 chars (max), the centered label+name pair would
    // overflow into each other if placed side-by-side. Two-line layout is
    // bullet-proof regardless of name length and reads better at a glance.
    this.add
      .text(GAME_WIDTH / 2, y, t('account.username'), {
        fontFamily: 'system-ui, sans-serif',
        fontSize: '12px',
        color: '#aaaaaa',
        fontStyle: 'bold',
      })
      .setOrigin(0.5, 0.5);

    this.add
      .text(GAME_WIDTH / 2, y + 18, name, {
        fontFamily: 'system-ui, sans-serif',
        fontSize: '15px',
        color: '#f2cc8f',
        fontStyle: 'bold',
      })
      .setOrigin(0.5, 0.5);

    new Button(this, {
      x: GAME_WIDTH / 2,
      y: y + 44,
      width: 200,
      height: 28,
      label: t('account.edit_username'),
      icon: '✏️',
      fontSize: 12,
      bgColor: COLOR.accent,
      onClick: () => void this.handleEditUsername(),
    });
  }

  private async handleEditUsername(): Promise<void> {
    // Re-entry guard: a Phaser button can fire pointerup twice on fast clicks
    // or some mobile browsers, which would stack two modals and make "cancel"
    // look like it doesn't close anything (it removes one; the other remains).
    if (this.editingUsername) return;
    this.editingUsername = true;
    try {
      const current = saveManager.displayName ?? authManager.displayName;
      const next = await phaserPrompt(this, {
        title: t('account.username_prompt'),
        initialValue: current,
        placeholder: 'Player_XXXX',
        saveLabel: t('account.save'),
        cancelLabel: t('account.cancel'),
        savingLabel: t('account.saving'),
        errorTooShort: t('account.username_too_short'),
        errorTooLong: t('account.username_too_long'),
        minLength: 3,
        maxLength: 20,
        asyncValidator: async (value) => {
          if (value === current) return null; // no-op save
          const result = await authManager.claimUsername(value);
          if (result.ok) return null;
          if (result.reason === 'taken') return t('account.username_taken');
          if (result.reason === 'invalid_chars') return t('account.username_invalid_chars');
          return t('account.username_failed');
        },
      });
      if (next === null) return;
      saveManager.setDisplayName(next);
      this.scene.restart();
    } finally {
      this.editingUsername = false;
    }
  }

  private makeAccountSection(y: number): void {
    const linked = authManager.isGoogleLinked;
    const email = authManager.currentUser?.email;
    const status = linked ? t('account.linked', { email: email ?? 'Google' }) : t('account.guest');

    this.add
      .text(GAME_WIDTH / 2, y, status, {
        fontFamily: 'system-ui, sans-serif',
        fontSize: '12px',
        color: '#cccccc',
        align: 'center',
        wordWrap: { width: GAME_WIDTH - 80 },
      })
      .setOrigin(0.5);

    // Only show the link button when the user is NOT linked. Unlinking is
    // intentionally not exposed in the UI — once you've connected Google, the
    // account stays bonded so the user can never accidentally orphan their
    // cloud save.
    if (!linked) {
      new Button(this, {
        x: GAME_WIDTH / 2,
        y: y + 32,
        width: 280,
        height: 40,
        label: t('account.link_google'),
        icon: '🔐',
        fontSize: 14,
        bgColor: COLOR.secondary,
        onClick: () => void this.handleLinkGoogle(),
      });
      this.add
        .text(GAME_WIDTH / 2, y + 60, t('account.link_google_hint'), {
          fontFamily: 'system-ui, sans-serif',
          fontSize: '11px',
          color: '#9aa0aa',
          align: 'center',
        })
        .setOrigin(0.5);
    }
  }

  private async handleLinkGoogle(): Promise<void> {
    const result = await authManager.linkGoogle();
    if (!result.ok && result.error && result.error !== 'auth/popup-closed-by-user') {
      console.warn('[Settings] link Google failed:', result.error);
    }
    this.scene.restart();
  }

  private handleResetPress(): void {
    if (!this.resetConfirming) {
      this.resetConfirming = true;
      this.resetBtn.setLabel(t('settings.reset_confirm'));
      this.resetBtn.setBgColor(0xff3333);
      this.resetTimer = this.time.delayedCall(3000, () => {
        this.resetConfirming = false;
        this.resetBtn.setLabel(t('settings.reset'));
        this.resetBtn.setBgColor(COLOR.danger);
      });
      return;
    }
    this.resetTimer?.remove(false);
    try {
      localStorage.removeItem('thap-ha-noi.save');
    } catch {
      // ignore
    }
    location.reload();
  }
}
