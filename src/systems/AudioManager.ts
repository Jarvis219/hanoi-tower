import { Howl, Howler } from 'howler';
import { saveManager } from './SaveManager';

export type SfxKey = 'drop' | 'thud' | 'slice' | 'perfect' | 'gameover' | 'click';

interface SoundDef {
  src: string[];
  loop?: boolean;
  volume?: number;
}

/**
 * Audio is optional in this build — files may not exist yet. Howl handles
 * missing files by logging once; we additionally guard with feature flags
 * so the game runs silently rather than crashing if the assets aren't
 * present. Real .mp3/.ogg files go under public/assets/audio/.
 */
const SFX_DEFS: Record<SfxKey, SoundDef> = {
  drop: { src: ['assets/audio/drop.ogg', 'assets/audio/drop.mp3'] },
  thud: { src: ['assets/audio/thud.ogg', 'assets/audio/thud.mp3'] },
  slice: { src: ['assets/audio/slice.ogg', 'assets/audio/slice.mp3'] },
  perfect: { src: ['assets/audio/perfect.ogg', 'assets/audio/perfect.mp3'] },
  gameover: { src: ['assets/audio/gameover.ogg', 'assets/audio/gameover.mp3'] },
  click: { src: ['assets/audio/click.ogg', 'assets/audio/click.mp3'] },
};

const BGM_SRC: string[] = ['assets/audio/bgm.ogg', 'assets/audio/bgm.mp3'];

class AudioManagerImpl {
  private sfx: Partial<Record<SfxKey, Howl>> = {};
  private bgm?: Howl;
  private bgmId?: number;
  private bgmVolume: number;
  private sfxVolume: number;
  private muted = false;
  private suspendedDueToError = false;

  constructor() {
    this.bgmVolume = saveManager.bgmVolume;
    this.sfxVolume = saveManager.sfxVolume;
    Howler.volume(1);
  }

  public setBgmVolume(v: number): void {
    this.bgmVolume = v;
    saveManager.setBgmVolume(v);
    this.bgm?.volume(v);
  }

  public setSfxVolume(v: number): void {
    this.sfxVolume = v;
    saveManager.setSfxVolume(v);
  }

  public setMuted(muted: boolean): void {
    this.muted = muted;
    Howler.mute(muted);
  }

  public getBgmVolume(): number {
    return this.bgmVolume;
  }

  public getSfxVolume(): number {
    return this.sfxVolume;
  }

  public isMuted(): boolean {
    return this.muted;
  }

  public playSfx(key: SfxKey, pitch = 1): void {
    if (this.muted || this.sfxVolume <= 0 || this.suspendedDueToError) return;
    try {
      let sound = this.sfx[key];
      if (!sound) {
        sound = new Howl({
          src: SFX_DEFS[key].src,
          volume: this.sfxVolume,
          onloaderror: () => {
            // missing audio file is non-fatal; suppress further attempts of this key
            this.sfx[key] = undefined;
          },
        });
        this.sfx[key] = sound;
      }
      const id = sound.play();
      sound.volume(this.sfxVolume, id);
      sound.rate(pitch, id);
    } catch {
      this.suspendedDueToError = true;
    }
  }

  public playBgm(): void {
    if (this.muted || this.bgmVolume <= 0 || this.suspendedDueToError) return;
    try {
      if (!this.bgm) {
        this.bgm = new Howl({
          src: BGM_SRC,
          loop: true,
          volume: this.bgmVolume,
          html5: true, // streaming so we don't decode the whole file
          onloaderror: () => {
            this.bgm = undefined;
          },
        });
      }
      if (this.bgm && !this.bgm.playing(this.bgmId)) {
        this.bgmId = this.bgm.play();
      }
    } catch {
      this.suspendedDueToError = true;
    }
  }

  public stopBgm(fadeMs = 400): void {
    if (!this.bgm || this.bgmId === undefined) return;
    this.bgm.fade(this.bgmVolume, 0, fadeMs, this.bgmId);
    const idToStop = this.bgmId;
    setTimeout(() => this.bgm?.stop(idToStop), fadeMs + 50);
    this.bgmId = undefined;
  }
}

export const audioManager = new AudioManagerImpl();
