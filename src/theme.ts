/**
 * Shared look: fonts, palette, and neon helpers used by every scene.
 * Fonts are bundled locally (see main.ts), so the piece works offline.
 */
import Phaser from 'phaser';

export const FONT = {
  /** Chunky arcade marquee face. Latin only: use for short titles and numbers. */
  display: '"Bungee", "Space Grotesk", sans-serif',
  /** Body and UI text. */
  ui: '"Space Grotesk", system-ui, sans-serif',
  /** Labels, HUD, data. */
  mono: '"DM Mono", ui-monospace, monospace',
};

/** Palette. Numbers for Phaser graphics, strings for text. */
export const C = {
  night: 0x07060f,
  ink: 0x0d0b1a,
  panel: 0x141127,
  gold: 0xffd078,
  amber: 0xffb347,
  red: 0xff4d6d,
  pink: 0xff4fd8,
  cyan: 0x3ee6ff,
  teal: 0x2de2b0,
  violet: 0xa47bff,
  green: 0x5cff8a,
  white: 0xffffff,
  muted: 0x8b89a6,
};

export const HEX = {
  gold: '#ffd078', amber: '#ffb347', red: '#ff4d6d', pink: '#ff4fd8', cyan: '#3ee6ff',
  teal: '#2de2b0', violet: '#a47bff', green: '#5cff8a', white: '#ffffff', muted: '#8b89a6', ink: '#0d0b1a',
};

export function toHex(color: number): string {
  return '#' + color.toString(16).padStart(6, '0');
}

/** Glowing sign text. Size is in logical (920x520) pixels. */
export function neonText(
  scene: Phaser.Scene, x: number, y: number, text: string,
  opts: { size?: number; color?: string; glow?: string; font?: string; blur?: number; align?: string } = {},
): Phaser.GameObjects.Text {
  const color = opts.color ?? HEX.gold;
  const t = scene.add.text(x, y, text, {
    fontFamily: opts.font ?? FONT.display,
    fontSize: `${opts.size ?? 24}px`,
    color,
    align: opts.align ?? 'center',
  }).setOrigin(0.5);
  t.setShadow(0, 0, opts.glow ?? color, opts.blur ?? 12, true, true);
  return t;
}

/** Plain readable label. */
export function label(
  scene: Phaser.Scene, x: number, y: number, text: string,
  opts: { size?: number; color?: string; font?: string; align?: string; wrap?: number; bold?: boolean } = {},
): Phaser.GameObjects.Text {
  return scene.add.text(x, y, text, {
    fontFamily: opts.font ?? FONT.ui,
    fontSize: `${opts.size ?? 13}px`,
    color: opts.color ?? HEX.white,
    align: opts.align ?? 'left',
    fontStyle: opts.bold ? 'bold' : 'normal',
    wordWrap: opts.wrap ? { width: opts.wrap } : undefined,
    lineSpacing: 3,
  });
}

/** Rounded glass panel with a coloured edge. Returns the graphics object. */
export function glassPanel(
  scene: Phaser.Scene, x: number, y: number, w: number, h: number,
  edge: number = C.gold, opts: { alpha?: number; radius?: number; fill?: number } = {},
): Phaser.GameObjects.Graphics {
  const g = scene.add.graphics();
  const r = opts.radius ?? 10;
  g.fillStyle(0x000000, 0.35).fillRoundedRect(x + 3, y + 5, w, h, r);
  g.fillStyle(opts.fill ?? C.panel, opts.alpha ?? 0.92).fillRoundedRect(x, y, w, h, r);
  g.lineStyle(2, edge, 0.9).strokeRoundedRect(x, y, w, h, r);
  g.lineStyle(6, edge, 0.12).strokeRoundedRect(x - 2, y - 2, w + 4, h + 4, r + 2);
  return g;
}

/** Soft bloom and vignette on a scene's main camera (WebGL only; no-op otherwise). */
export function cinematicCamera(scene: Phaser.Scene, opts: { bloom?: number; vignette?: number } = {}): void {
  const cam = scene.cameras.main as any;
  if (!cam.postFX || scene.game.renderer.type !== Phaser.WEBGL) return;
  if (opts.bloom !== 0) cam.postFX.addBloom(0xffffff, 1, 1, 1, opts.bloom ?? 1.15, 4);
  if (opts.vignette !== 0) cam.postFX.addVignette(0.5, 0.5, opts.vignette ?? 0.88, 0.32);
}

/** Add a glow outline to a game object when WebGL is available. */
export function addGlow(obj: Phaser.GameObjects.GameObject, color: number, strength = 4): void {
  const fx = (obj as any).preFX;
  if (fx) fx.addGlow(color, strength, 0, false, 0.1, 12);
}

/** Small screen shake + flash used for impacts. */
export function impact(scene: Phaser.Scene, intensity = 0.006, ms = 120): void {
  scene.cameras.main.shake(ms, intensity);
}

/** Floating text that rises and fades (damage numbers, +gold, etc.). */
export function floatText(scene: Phaser.Scene, x: number, y: number, text: string, color = HEX.gold, size = 16): void {
  const t = scene.add.text(x, y, text, {
    fontFamily: FONT.display, fontSize: `${size}px`, color,
  }).setOrigin(0.5).setDepth(1000);
  t.setShadow(0, 2, '#000000', 4, true, true);
  scene.tweens.add({ targets: t, y: y - 34, alpha: 0, duration: 750, ease: 'Cubic.out', onComplete: () => t.destroy() });
}

/** One-off radial particle burst without needing a texture file. */
export function burst(scene: Phaser.Scene, x: number, y: number, color: number, count = 12, speed = 120): void {
  for (let i = 0; i < count; i++) {
    const a = (Math.PI * 2 * i) / count + Math.random() * 0.4;
    const d = speed * (0.5 + Math.random() * 0.7);
    const p = scene.add.circle(x, y, 1.5 + Math.random() * 2.5, color, 1).setDepth(999);
    p.setBlendMode(Phaser.BlendModes.ADD);
    scene.tweens.add({
      targets: p, x: x + Math.cos(a) * d * 0.4, y: y + Math.sin(a) * d * 0.4, alpha: 0, scale: 0.2,
      duration: 380 + Math.random() * 220, ease: 'Cubic.out', onComplete: () => p.destroy(),
    });
  }
}
