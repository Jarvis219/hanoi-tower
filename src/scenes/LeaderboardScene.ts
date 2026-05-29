import Phaser from 'phaser';
import { GAME_HEIGHT, GAME_WIDTH, SCENE_KEYS } from '../config/Constants';
import { authManager } from '../systems/supabase/AuthManager';
import { supabaseEnabled } from '../systems/supabase/SupabaseClient';
import { leaderboardService, type LeaderboardRow } from '../systems/supabase/LeaderboardService';
import { t } from '../systems/I18nManager';
import { themeManager } from '../systems/ThemeManager';
import { Button, COLOR } from '../ui/Button';
import type { LeaderboardPeriod } from '../types/Cloud';
import type { GameMode } from '../types/SaveData';

const VIEW_TOP = 200;
const VIEW_BOTTOM = GAME_HEIGHT - 110;
const ROW_H = 56;
const CARD_H = ROW_H - 8;
const CARD_R = 10;

type Tab = { mode: GameMode; period: LeaderboardPeriod };

const TABS_MODE: GameMode[] = ['classic', 'daily'];
const TABS_PERIOD: LeaderboardPeriod[] = ['daily', 'weekly', 'alltime'];

export class LeaderboardScene extends Phaser.Scene {
  private current: Tab = { mode: 'classic', period: 'alltime' };
  private listContainer!: Phaser.GameObjects.Container;
  private listCam!: Phaser.Cameras.Scene2D.Camera;
  private uiObjects: Phaser.GameObjects.GameObject[] = [];
  private modeButtons: Button[] = [];
  private periodButtons: Button[] = [];
  private rows: LeaderboardRow[] = [];
  private statusText!: Phaser.GameObjects.Text;
  private myRankText!: Phaser.GameObjects.Text;
  private scrollPos = 0;
  private maxScroll = 0;
  private dragStartY = 0;
  private dragStartScroll = 0;
  private dragging = false;
  private inputBound = false;

  constructor() {
    super({ key: SCENE_KEYS.Leaderboard });
  }

  public create(): void {
    const theme = themeManager.getSelected();
    this.cameras.main.setBackgroundColor(theme.menuBgColor);
    this.uiObjects = [];

    const title = this.add
      .text(GAME_WIDTH / 2, 32, t('leaderboard.title'), {
        fontFamily: 'system-ui, sans-serif',
        fontSize: '28px',
        color: themeManager.accentHex(),
        fontStyle: 'bold',
        stroke: '#000',
        strokeThickness: 4,
      })
      .setOrigin(0.5, 0);
    this.uiObjects.push(title);

    this.statusText = this.add
      .text(GAME_WIDTH / 2, 78, '', {
        fontFamily: 'system-ui, sans-serif',
        fontSize: '13px',
        color: '#cccccc',
      })
      .setOrigin(0.5);
    this.uiObjects.push(this.statusText);

    this.buildModeTabs();
    this.buildPeriodTabs();

    // Place the list container at world-y = VIEW_TOP so its items live in a
    // world region the tabs never occupy. listCam.scrollY = VIEW_TOP means the
    // camera's top edge maps to world-y = VIEW_TOP — anything above (tabs at
    // y=110/154) falls outside the camera's view and is clipped, rather than
    // rendering at screen-y = camera.y + worldY which would overlap the list.
    this.listContainer = this.add.container(0, VIEW_TOP);

    const viewH = VIEW_BOTTOM - VIEW_TOP;
    this.listCam = this.cameras.add(0, VIEW_TOP, GAME_WIDTH, viewH);
    // Transparent sub-cam → main camera's theme menuBgColor shows through
    // the gaps between rows. `setBackgroundColor(0)` was painting opaque
    // black over the viewport.
    this.listCam.transparent = true;
    this.listCam.scrollY = VIEW_TOP;
    this.cameras.main.ignore(this.listContainer);

    // Single accent divider under tabs (visual parity with
    // Themes/Achievements). Sub-cam viewport already clips list bleed —
    // no full solid panel needed.
    const divider = this.add.graphics();
    divider.fillStyle(theme.accentColor, 0.55);
    divider.fillRect(20, VIEW_TOP - 2, GAME_WIDTH - 40, 1);
    this.uiObjects.push(divider);

    this.myRankText = this.add
      .text(GAME_WIDTH / 2, GAME_HEIGHT - 80, '', {
        fontFamily: 'system-ui, sans-serif',
        fontSize: '13px',
        color: '#f2cc8f',
        fontStyle: 'bold',
      })
      .setOrigin(0.5);
    this.uiObjects.push(this.myRankText);

    const backBtn = new Button(this, {
      x: GAME_WIDTH / 2,
      y: GAME_HEIGHT - 40,
      width: 200,
      height: 44,
      label: t('leaderboard.back').replace(/^←\s*/, ''),
      icon: '←',
      fontSize: 16,
      bgColor: COLOR.neutral,
      onClick: () => this.scene.start(SCENE_KEYS.MainMenu),
    });
    this.uiObjects.push(backBtn);

    this.listCam.ignore(this.uiObjects);
    this.bindScrollInput(viewH);

    if (!supabaseEnabled) {
      this.statusText.setText(t('leaderboard.offline'));
      return;
    }
    void this.refresh();
  }

  private buildModeTabs(): void {
    const y = 110;
    const totalW = GAME_WIDTH - 60;
    const w = totalW / TABS_MODE.length - 6;
    TABS_MODE.forEach((mode, i) => {
      const x = 30 + w / 2 + i * (w + 6);
      const b = new Button(this, {
        x,
        y,
        width: w,
        height: 36,
        label: t(`leaderboard.mode_${mode}`),
        fontSize: 13,
        bgColor: mode === this.current.mode ? COLOR.primary : COLOR.neutral,
        onClick: () => {
          this.current.mode = mode;
          this.buildModeTabs();
          this.buildPeriodTabs();
          void this.refresh();
        },
      });
      this.modeButtons.push(b);
      this.uiObjects.push(b);
    });
  }

  private buildPeriodTabs(): void {
    const y = 154;
    const totalW = GAME_WIDTH - 60;
    const w = totalW / TABS_PERIOD.length - 6;
    TABS_PERIOD.forEach((period, i) => {
      const x = 30 + w / 2 + i * (w + 6);
      const b = new Button(this, {
        x,
        y,
        width: w,
        height: 32,
        label: t(`leaderboard.period_${period}`),
        fontSize: 12,
        bgColor: period === this.current.period ? COLOR.accent : COLOR.muted,
        onClick: () => {
          this.current.period = period;
          this.buildPeriodTabs();
          void this.refresh();
        },
      });
      this.periodButtons.push(b);
      this.uiObjects.push(b);
    });
  }

  private async refresh(): Promise<void> {
    this.statusText.setText(t('leaderboard.loading'));
    this.myRankText.setText('');
    this.listContainer.removeAll(true);

    const { rows, myRank, cached } = await leaderboardService.fetchTop(
      this.current.mode,
      this.current.period,
    );
    this.rows = rows;

    if (rows.length === 0) {
      this.statusText.setText(t('leaderboard.empty'));
      return;
    }
    this.statusText.setText(
      cached ? t('leaderboard.cached') : t('leaderboard.count', { n: rows.length }),
    );
    this.renderRows();

    if (myRank !== undefined) {
      const label =
        myRank > 100
          ? t('leaderboard.my_rank_outside')
          : t('leaderboard.my_rank', { rank: myRank });
      this.myRankText.setText(label);
    } else if (authManager.currentUid) {
      this.myRankText.setText(t('leaderboard.no_rank_yet'));
    }
  }

  private renderRows(): void {
    const theme = themeManager.getSelected();
    const cardW = GAME_WIDTH - 32;
    const cx = GAME_WIDTH / 2;
    this.rows.forEach((row, i) => {
      const y = i * ROW_H + 4;
      const cy = y + CARD_H / 2;
      const isSelf = row.isSelf;

      // Trophy-tier palette for top 3 — 3 distinct metallic gradients.
      // Self override paints over its own bg but keeps the gold treatment.
      let topColor: number;
      let botColor: number;
      let border: number;
      let stripeColor: number;
      let cardScale = 1;
      if (row.rank === 1) {
        // Gold — bright warm yellow
        topColor = 0xfde68a;
        botColor = 0x8a6020;
        border = 0xffd700;
        stripeColor = 0xffd700;
        cardScale = 1.02;
      } else if (row.rank === 2) {
        // Silver — cool steel grey
        topColor = 0xe5e7eb;
        botColor = 0x4b5263;
        border = 0xc0c8d6;
        stripeColor = 0xc0c8d6;
      } else if (row.rank === 3) {
        // Bronze — warm copper
        topColor = 0xe4a766;
        botColor = 0x5a3414;
        border = 0xcd7f32;
        stripeColor = 0xcd7f32;
      } else if (isSelf) {
        topColor = 0x3a2e10;
        botColor = 0x2a200a;
        border = 0xf2cc8f;
        stripeColor = 0xf2cc8f;
      } else {
        topColor = theme.skyColor;
        botColor = this.darken(theme.skyColor, 0.55);
        border = theme.accentColor;
        stripeColor = theme.accentColor;
      }
      const isTop3 = row.rank <= 3;
      const cardW2 = cardW * cardScale;
      const cardH2 = CARD_H * cardScale;

      const card = this.add.graphics();
      card.fillGradientStyle(topColor, topColor, botColor, botColor, 1);
      card.fillRoundedRect(cx - cardW2 / 2, y, cardW2, cardH2, CARD_R);
      // Top 3 get thicker, more opaque border. Self also stands out.
      const borderW = row.rank === 1 ? 3 : isSelf || isTop3 ? 2 : 1;
      const borderA = isSelf || isTop3 ? 1 : 0.6;
      card.lineStyle(borderW, border, borderA);
      card.strokeRoundedRect(cx - cardW2 / 2, y, cardW2, cardH2, CARD_R);

      // Outer trophy glow for #1 only.
      if (row.rank === 1) {
        const glow = this.add.graphics();
        glow.lineStyle(2, border, 0.35);
        glow.strokeRoundedRect(
          cx - cardW2 / 2 - 3,
          y - 3,
          cardW2 + 6,
          cardH2 + 6,
          CARD_R + 3,
        );
        glow.lineStyle(2, border, 0.18);
        glow.strokeRoundedRect(
          cx - cardW2 / 2 - 6,
          y - 6,
          cardW2 + 12,
          cardH2 + 12,
          CARD_R + 6,
        );
        this.listContainer.add(glow);
      }

      // Left accent stripe — wider/brighter for top 3.
      const stripe = this.add.graphics();
      stripe.fillStyle(stripeColor, isSelf || isTop3 ? 0.95 : 0.85);
      const stripeW = isTop3 ? 6 : 4;
      stripe.fillRoundedRect(cx - cardW2 / 2 + 4, y + 4, stripeW, cardH2 - 8, 2);

      const rankIcon =
        row.rank === 1 ? '🥇' : row.rank === 2 ? '🥈' : row.rank === 3 ? '🥉' : `#${row.rank}`;
      // Dark text on bright metallic for top 3 reads better than white.
      const rankColor = isTop3 ? '#1a1a1a' : '#ffffff';
      const rank = this.add
        .text(40, cy, rankIcon, {
          fontFamily: 'system-ui, "Segoe UI Emoji", sans-serif',
          fontSize: row.rank === 1 ? '26px' : isTop3 ? '22px' : '14px',
          color: rankColor,
          fontStyle: 'bold',
          stroke: '#000',
          strokeThickness: isTop3 ? 2 : 3,
        })
        .setOrigin(0.5);

      const name = this.add
        .text(74, cy - 10, row.displayName, {
          fontFamily: 'system-ui, sans-serif',
          fontSize: '14px',
          color: isSelf ? '#f2cc8f' : '#ffffff',
          fontStyle: 'bold',
          stroke: '#000',
          strokeThickness: 3,
        })
        .setOrigin(0, 0.5);

      const sub = this.add
        .text(74, cy + 10, t('leaderboard.row_sub', { level: row.level }), {
          fontFamily: 'system-ui, sans-serif',
          fontSize: '11px',
          color: '#ffffff',
          stroke: '#000',
          strokeThickness: 2,
        })
        .setOrigin(0, 0.5)
        .setAlpha(0.85);

      const score = this.add
        .text(GAME_WIDTH - 24, cy, String(row.score), {
          fontFamily: 'system-ui, sans-serif',
          fontSize: '18px',
          color: '#f2cc8f',
          fontStyle: 'bold',
          stroke: '#000',
          strokeThickness: 3,
        })
        .setOrigin(1, 0.5);

      this.listContainer.add([card, stripe, rank, name, sub, score]);
    });
    const viewH = VIEW_BOTTOM - VIEW_TOP;
    const totalH = this.rows.length * ROW_H;
    this.maxScroll = Math.max(0, totalH - viewH);
    this.scrollPos = 0;
    this.listCam.scrollY = VIEW_TOP;
  }

  private darken(color: number, amt: number): number {
    const r = Math.max(0, ((color >> 16) & 0xff) * (1 - amt));
    const g = Math.max(0, ((color >> 8) & 0xff) * (1 - amt));
    const b = Math.max(0, (color & 0xff) * (1 - amt));
    return ((r & 0xff) << 16) | ((g & 0xff) << 8) | (b & 0xff);
  }

  private bindScrollInput(viewH: number): void {
    if (this.inputBound) return;
    this.inputBound = true;
    const inView = (y: number): boolean => y >= VIEW_TOP && y <= VIEW_BOTTOM;

    this.input.on('pointerdown', (pointer: Phaser.Input.Pointer) => {
      if (!inView(pointer.y) || this.maxScroll === 0) return;
      this.dragging = true;
      this.dragStartY = pointer.y;
      this.dragStartScroll = this.scrollPos;
    });
    this.input.on('pointermove', (pointer: Phaser.Input.Pointer) => {
      if (!this.dragging || !pointer.isDown) return;
      const delta = pointer.y - this.dragStartY;
      this.scrollPos = Phaser.Math.Clamp(this.dragStartScroll - delta, 0, this.maxScroll);
      this.listCam.scrollY = VIEW_TOP + this.scrollPos;
    });
    const release = (): void => {
      this.dragging = false;
    };
    this.input.on('pointerup', release);
    this.input.on('pointerupoutside', release);
    this.input.on(
      'wheel',
      (pointer: Phaser.Input.Pointer, _o: unknown, _dx: number, dy: number) => {
        if (!inView(pointer.y) || this.maxScroll === 0) return;
        this.scrollPos = Phaser.Math.Clamp(this.scrollPos + dy * 0.6, 0, this.maxScroll);
        this.listCam.scrollY = VIEW_TOP + this.scrollPos;
      },
    );
    // Suppress unused-var: viewH consumed implicitly via VIEW_BOTTOM/VIEW_TOP
    void viewH;
  }
}
