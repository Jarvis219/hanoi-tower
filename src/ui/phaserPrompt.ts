import Phaser from 'phaser';
import { GAME_HEIGHT, GAME_WIDTH } from '../config/Constants';
import { Button, COLOR } from './Button';

// Phaser-rendered modal prompt with a single DOM <input> overlay for the text
// field. The Phaser scene renders the backdrop, card, title, error message,
// Save/Cancel buttons, and the spinner — everything that benefits from theme
// consistency. The text field itself is a native <input> positioned exactly
// over where Phaser would have drawn it, styled to match the theme.
//
// Why the input is native rather than Phaser-rendered:
//   • Browsers refuse to deliver `input` events reliably to inputs that are
//     offscreen or fully transparent (iOS Safari is the worst offender).
//   • A real input gives us mobile virtual-keyboard popup, IME composition,
//     paste/copy/cut, selection, undo/redo, and accessibility for free.

export interface PhaserPromptOptions {
  title: string;
  initialValue?: string;
  placeholder?: string;
  saveLabel?: string;
  cancelLabel?: string;
  savingLabel?: string;
  errorTooShort?: string;
  errorTooLong?: string;
  minLength?: number;
  maxLength?: number;
  /**
   * Async server-side validator. Returns `null` to accept the value (modal
   * closes), or a non-empty string error to surface inline (modal stays open).
   */
  asyncValidator?: (value: string) => Promise<string | null>;
}

const Z_BACKDROP = 1000;
const Z_CARD = 1001;
const Z_CONTENT = 1002;
const Z_BUTTON = 1005;
const MIN_SPINNER_VISIBLE_MS = 300;

export const phaserPrompt = (
  scene: Phaser.Scene,
  options: PhaserPromptOptions,
): Promise<string | null> => {
  const min = options.minLength ?? 1;
  const max = options.maxLength ?? 64;

  return new Promise((resolve) => {
    let closed = false;
    let busy = false;
    const disposables: Array<() => void> = [];

    // ─── Phaser visuals ────────────────────────────────────────────────────
    const cx = GAME_WIDTH / 2;
    const cy = GAME_HEIGHT / 2;
    const cardW = 360;
    const cardH = 240;

    const backdrop = scene.add
      .rectangle(cx, cy, GAME_WIDTH, GAME_HEIGHT, 0x000000, 0.72)
      .setDepth(Z_BACKDROP)
      .setInteractive();
    disposables.push(() => backdrop.destroy());

    const card = scene.add.graphics().setDepth(Z_CARD);
    card.fillStyle(0x1f2236, 1).fillRoundedRect(cx - cardW / 2, cy - cardH / 2, cardW, cardH, 14);
    card.lineStyle(1, 0x3d405b, 1).strokeRoundedRect(cx - cardW / 2, cy - cardH / 2, cardW, cardH, 14);
    disposables.push(() => card.destroy());

    const titleText = scene.add
      .text(cx, cy - cardH / 2 + 24, options.title, {
        fontFamily: 'system-ui, sans-serif',
        fontSize: '16px',
        color: '#f2cc8f',
        fontStyle: 'bold',
      })
      .setOrigin(0.5, 0)
      .setDepth(Z_CONTENT);
    disposables.push(() => titleText.destroy());

    // Input box coords (in Phaser game-space). The DOM input is positioned
    // exactly here in screen-space — Phaser does NOT draw the input visual.
    // Letting the native <input> render its own background/text/caret avoids
    // the offscreen-input keystroke issues some browsers have (iOS Safari
    // especially refuses to deliver `input` events to inputs at top:-9999px).
    const inputW = cardW - 40;
    const inputH = 44;
    const inputY = cy - 16;

    const errorText = scene.add
      .text(cx, inputY + 38, '', {
        fontFamily: 'system-ui, sans-serif',
        fontSize: '12px',
        color: '#e07a5f',
        align: 'center',
        wordWrap: { width: inputW },
      })
      .setOrigin(0.5, 0)
      .setDepth(Z_CONTENT);
    disposables.push(() => errorText.destroy());

    // Buttons
    const buttonY = cy + cardH / 2 - 32;
    const btnW = (inputW - 12) / 2;
    const cancelBtn = new Button(scene, {
      x: cx - btnW / 2 - 6,
      y: buttonY,
      width: btnW,
      height: 38,
      label: options.cancelLabel ?? 'Cancel',
      fontSize: 14,
      bgColor: COLOR.neutral,
      onClick: () => done(null),
    });
    cancelBtn.setDepth(Z_BUTTON);
    disposables.push(() => cancelBtn.destroy());

    const saveBtn = new Button(scene, {
      x: cx + btnW / 2 + 6,
      y: buttonY,
      width: btnW,
      height: 38,
      label: options.saveLabel ?? 'Save',
      fontSize: 14,
      bgColor: COLOR.primary,
      disabled: true, // start disabled — enabled only after the user edits the value
      onClick: () => void tryCommit(),
    });
    saveBtn.setDepth(Z_BUTTON);
    disposables.push(() => saveBtn.destroy());

    // Save is enabled only when the trimmed value differs from the initial one
    // AND we're not in the middle of an async validation. Re-uses a single
    // resolver so setBusy and onDomInput stay in sync.
    const initialTrimmed = (options.initialValue ?? '').trim();
    let hasChange = false;
    const refreshSaveBtn = (): void => {
      saveBtn.setDisabled(busy || !hasChange);
    };

    // Spinner — rotating arc next to the Save button label while validating.
    const spinner = scene.add.graphics().setDepth(Z_BUTTON + 1).setVisible(false);
    disposables.push(() => spinner.destroy());

    let spinnerAngle = 0;
    let spinnerTimer: Phaser.Time.TimerEvent | undefined;
    const drawSpinner = (): void => {
      spinner.clear();
      const sx = saveBtn.x - btnW / 2 + 14;
      const sy = saveBtn.y;
      spinner.lineStyle(2, 0x1a1a2e, 0.25);
      spinner.strokeCircle(sx, sy, 6);
      spinner.lineStyle(2, 0x1a1a2e, 1);
      spinner.beginPath();
      spinner.arc(sx, sy, 6, spinnerAngle, spinnerAngle + Math.PI * 1.2);
      spinner.strokePath();
    };

    // ─── DOM input (visible, theme-matched) ────────────────────────────────
    // We overlay a real <input> at the Phaser input box location so keystroke
    // events, IME composition, paste, selection, and the mobile virtual
    // keyboard all work natively. The DOM input is styled to look like part
    // of the Phaser modal (same colours, font, rounded border, gold caret).
    const domInput = document.createElement('input');
    domInput.type = 'text';
    domInput.value = options.initialValue ?? '';
    domInput.maxLength = max;
    if (options.placeholder) domInput.placeholder = options.placeholder;
    domInput.autocapitalize = 'none';
    domInput.autocomplete = 'off';
    domInput.spellcheck = false;
    // font-size:16px is the minimum that prevents iOS Safari from auto-zooming
    // on focus — anything smaller and the entire page jumps in scale.
    domInput.style.cssText =
      'position:fixed;box-sizing:border-box;' +
      'background:#0f1020;color:#fff;font-family:system-ui,-apple-system,sans-serif;' +
      'font-size:16px;padding:0 12px;border:2px solid #f2cc8f;border-radius:8px;' +
      'outline:none;caret-color:#f2cc8f;z-index:10000;';
    document.body.appendChild(domInput);
    disposables.push(() => domInput.remove());

    // Position + size the DOM input so it overlays the Phaser input box exactly,
    // accounting for the canvas's current scale (Phaser FIT mode).
    const positionDomInput = (): void => {
      const canvas = scene.game.canvas as HTMLCanvasElement;
      const r = canvas.getBoundingClientRect();
      const sx = r.width / GAME_WIDTH;
      const sy = r.height / GAME_HEIGHT;
      domInput.style.left = `${r.left + (cx - inputW / 2) * sx}px`;
      domInput.style.top = `${r.top + (inputY - inputH / 2) * sy}px`;
      domInput.style.width = `${inputW * sx}px`;
      domInput.style.height = `${inputH * sy}px`;
    };
    positionDomInput();

    // Reposition on viewport / Phaser scale changes (orientation, mobile kb).
    const onResize = (): void => positionDomInput();
    scene.scale.on('resize', onResize);
    window.addEventListener('resize', onResize);
    disposables.push(() => {
      scene.scale.off('resize', onResize);
      window.removeEventListener('resize', onResize);
    });

    // Focus + select-all on next frame (focus from a synchronous user gesture
    // is required for iOS to surface the virtual keyboard).
    scene.time.delayedCall(0, () => {
      try {
        domInput.focus();
        domInput.setSelectionRange(0, domInput.value.length);
      } catch {
        // ignore — some browsers throw if focus is called too early
      }
    });

    const onDomInput = (): void => {
      errorText.setText('');
      hasChange = domInput.value.trim() !== initialTrimmed;
      refreshSaveBtn();
    };
    domInput.addEventListener('input', onDomInput);
    disposables.push(() => domInput.removeEventListener('input', onDomInput));

    // Phaser-side click handling: clicks outside the card dismiss the modal.
    // Clicks on the input area go to the DOM input directly (it's on top of
    // the canvas), so we don't need to special-case them here.
    backdrop.on('pointerdown', (_p: Phaser.Input.Pointer, x: number, y: number) => {
      const inCard =
        x >= cx - cardW / 2 &&
        x <= cx + cardW / 2 &&
        y >= cy - cardH / 2 &&
        y <= cy + cardH / 2;
      if (inCard) return;
      if (!busy) done(null);
    });

    const setBusy = (b: boolean): void => {
      if (closed) return;
      busy = b;
      refreshSaveBtn();
      saveBtn.setLabel(b ? options.savingLabel ?? '...' : options.saveLabel ?? 'Save');
      if (b) {
        spinner.setVisible(true);
        spinnerAngle = 0;
        drawSpinner();
        spinnerTimer = scene.time.addEvent({
          delay: 16,
          loop: true,
          callback: () => {
            spinnerAngle += 0.18;
            drawSpinner();
          },
        });
      } else {
        spinner.setVisible(false);
        spinnerTimer?.remove();
        spinnerTimer = undefined;
      }
    };

    const cleanup = (): void => {
      // Remove all disposable resources in reverse order — last-created first.
      while (disposables.length) {
        const dispose = disposables.pop();
        try {
          dispose?.();
        } catch {
          // ignore
        }
      }
      window.removeEventListener('keydown', onKey);
    };

    const done = (value: string | null): void => {
      if (closed) return;
      closed = true;
      cleanup();
      resolve(value);
    };

    const tryCommit = async (): Promise<void> => {
      if (busy) return;
      const v = domInput.value.trim();
      errorText.setText('');
      if (v.length < min) {
        errorText.setText(options.errorTooShort ?? `Min ${min}`);
        return;
      }
      if (v.length > max) {
        errorText.setText(options.errorTooLong ?? `Max ${max}`);
        return;
      }
      if (options.asyncValidator) {
        setBusy(true);
        const startedAt = performance.now();
        try {
          const remote = await options.asyncValidator(v);
          if (closed) return;
          const elapsed = performance.now() - startedAt;
          if (elapsed < MIN_SPINNER_VISIBLE_MS) {
            await new Promise((r) => setTimeout(r, MIN_SPINNER_VISIBLE_MS - elapsed));
          }
          if (closed) return;
          if (remote) {
            errorText.setText(remote);
            setBusy(false);
            domInput.focus();
            return;
          }
        } catch (err) {
          if (closed) return;
          errorText.setText((err as Error).message);
          setBusy(false);
          return;
        }
      }
      done(v);
    };

    const onKey = (e: KeyboardEvent): void => {
      if (e.key === 'Escape') {
        e.preventDefault();
        done(null);
      } else if (e.key === 'Enter' && document.activeElement === domInput && !busy) {
        e.preventDefault();
        void tryCommit();
      }
    };
    window.addEventListener('keydown', onKey);
  });
};
