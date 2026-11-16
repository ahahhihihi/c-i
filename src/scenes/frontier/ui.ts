/**
 * Small canvas button used by the Frontier HUD. Content is centred on (0,0).
 */
import Phaser from 'phaser';
import { audio } from '../../audio';

export interface BtnOpts {
  w: number;
  h: number;
  color: number;
  /** Fill when enabled. Defaults to a dark panel tinted by `color`. */
  fill?: number;
  radius?: number;
  onClick: () => void;
  /** Called instead of onClick while disabled. */
  onBlocked?: () => void;
}

export class Btn extends Phaser.GameObjects.Container {
  readonly bw: number;
  readonly bh: number;
  private bg: Phaser.GameObjects.Graphics;
  private opts: BtnOpts;
  private hovered = false;
  private down = false;
  enabled = true;
  /** Highlight ring, e.g. when the button wants attention. */
  pulse = false;

  constructor(scene: Phaser.Scene, x: number, y: number, opts: BtnOpts) {
    super(scene, x, y);
    this.opts = opts;
    this.bw = opts.w;
    this.bh = opts.h;
    this.bg = scene.add.graphics();
    this.add(this.bg);
    this.setSize(opts.w, opts.h);
    this.setInteractive({ useHandCursor: true });
    this.on('pointerover', () => { this.hovered = true; this.redraw(); });
    this.on('pointerout', () => { this.hovered = false; this.down = false; this.redraw(); });
    this.on('pointerdown', () => { this.down = true; this.redraw(); });
    this.on('pointerup', () => {
      if (!this.down) return;
      this.down = false;
      this.redraw();
      if (this.enabled) this.opts.onClick();
      else if (this.opts.onBlocked) this.opts.onBlocked();
      else {
        audio.sfx('error');
        scene.tweens.add({ targets: this, x: this.x + 3, duration: 40, yoyo: true, repeat: 2 });
      }
    });
    scene.add.existing(this);
    this.redraw();
  }

  setEnabled(on: boolean): this {
    if (this.enabled === on) return this;
    this.enabled = on;
    if (this.input) this.input.cursor = on ? 'pointer' : 'default';
    this.redraw();
    return this;
  }

  setColor(color: number): this {
    if (this.opts.color !== color) { this.opts.color = color; this.redraw(); }
    return this;
  }

  redraw(): void {
    const { bw: w, bh: h } = this;
    const r = this.opts.radius ?? 8;
    const c = this.opts.color;
    const g = this.bg;
    g.clear();
    const lift = this.enabled && this.hovered && !this.down ? -1 : 0;
    g.fillStyle(0x000000, 0.4).fillRoundedRect(-w / 2 + 1, -h / 2 + 3, w, h, r);
    if (!this.enabled) {
      g.fillStyle(0x15131f, 0.92).fillRoundedRect(-w / 2, -h / 2, w, h, r);
      g.lineStyle(1.5, 0x4a4760, 0.9).strokeRoundedRect(-w / 2, -h / 2, w, h, r);
      this.setAlpha(0.75);
      return;
    }
    this.setAlpha(1);
    const fill = this.opts.fill ?? 0x171427;
    g.fillStyle(fill, 0.96).fillRoundedRect(-w / 2, -h / 2 + lift, w, h, r);
    g.fillStyle(c, this.hovered ? 0.26 : 0.12).fillRoundedRect(-w / 2, -h / 2 + lift, w, h, r);
    g.fillStyle(0xffffff, 0.06).fillRoundedRect(-w / 2 + 2, -h / 2 + 2 + lift, w - 4, h * 0.4, { tl: r - 2, tr: r - 2, bl: 0, br: 0 });
    g.lineStyle(2, c, this.hovered ? 1 : 0.75).strokeRoundedRect(-w / 2, -h / 2 + lift, w, h, r);
    if (this.hovered || this.pulse) g.lineStyle(6, c, 0.18).strokeRoundedRect(-w / 2 - 2, -h / 2 - 2 + lift, w + 4, h + 4, r + 2);
  }
}
