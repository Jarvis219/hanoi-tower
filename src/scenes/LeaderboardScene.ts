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
    this.listCam.setBackgroundColor(0);
    this.listCam.scrollY = VIEW_TOP;
    this.cameras.main.ignore(this.listContainer);

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
    const cardW = GAME_WIDTH - 32;
    const cx = GAME_WIDTH / 2;
    this.rows.forEach((row, i) => {
      const y = i * ROW_H + 4;
      const cy = y + CARD_H / 2;
      const isTop3 = row.rank <= 3;
      const isSelf = row.isSelf;
      const topColor = isSelf ? 0x3a2e10 : isTop3 ? 0x2a2e4a : 0x1f2236;
      const botColor = isSelf ? 0x2a200a : isTop3 ? 0x1f2236 : 0x171a28;
      const border = isSelf ? 0xf2cc8f : isTop3 ? 0xf2cc8f : 0x4a4e64;

      const card = this.add.graphics();
      card.fillGradientStyle(topColor, topColor, botColor, botColor, 1);
      card.fillRoundedRect(cx - cardW / 2, y, cardW, CARD_H, CARD_R);
      card.lineStyle(isSelf || isTop3 ? 2 : 1, border, isSelf || isTop3 ? 0.95 : 0.4);
      card.strokeRoundedRect(cx - cardW / 2, y, cardW, CARD_H, CARD_R);

      const rankIcon =
        row.rank === 1 ? '🥇' : row.rank === 2 ? '🥈' : row.rank === 3 ? '🥉' : `#${row.rank}`;
      const rank = this.add
        .text(34, cy, rankIcon, {
          fontFamily: 'system-ui, "Segoe UI Emoji", sans-serif',
          fontSize: isTop3 ? '20px' : '14px',
          color: '#ffffff',
          fontStyle: 'bold',
        })
        .setOrigin(0.5);

      const name = this.add
        .text(70, cy - 10, row.displayName, {
          fontFamily: 'system-ui, sans-serif',
          fontSize: '14px',
          color: isSelf ? '#f2cc8f' : '#ffffff',
          fontStyle: isSelf ? 'bold' : 'normal',
        })
        .setOrigin(0, 0.5);

      const sub = this.add
        .text(70, cy + 10, t('leaderboard.row_sub', { level: row.level }), {
          fontFamily: 'system-ui, sans-serif',
          fontSize: '11px',
          color: '#aaaaaa',
        })
        .setOrigin(0, 0.5);

      const score = this.add
        .text(GAME_WIDTH - 24, cy, String(row.score), {
          fontFamily: 'system-ui, sans-serif',
          fontSize: '18px',
          color: '#f2cc8f',
          fontStyle: 'bold',
        })
        .setOrigin(1, 0.5);

      this.listContainer.add([card, rank, name, sub, score]);
    });
    const viewH = VIEW_BOTTOM - VIEW_TOP;
    const totalH = this.rows.length * ROW_H;
    this.maxScroll = Math.max(0, totalH - viewH);
    this.scrollPos = 0;
    this.listCam.scrollY = VIEW_TOP;
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
