/**
 * Procedural art for Lost Realm: soft light textures, wisps, the Guardian,
 * Elder Chen, and vector props (crystals, trees, pillars, glowing plants).
 * Props are drawn around (0, 0) so each one can sit at its own depth.
 */
import Phaser from 'phaser';
import { TEX_SCALE, makeSim } from '../../sims';

export const GUARDIAN_W = 160;
export const GUARDIAN_H = 190;

function shade(color: number, amt: number): number {
  const c = Phaser.Display.Color.IntegerToColor(color);
  const f = (v: number) => Phaser.Math.Clamp(Math.round(v + amt), 0, 255);
  return Phaser.Display.Color.GetColor(f(c.red), f(c.green), f(c.blue));
}

function radial(scene: Phaser.Scene, key: string, size: number, stops: [number, number][]): void {
  if (scene.textures.exists(key)) return;
  const tex = scene.textures.createCanvas(key, size, size);
  if (!tex) return;
  const ctx = tex.getContext();
  const r = size / 2;
  const grad = ctx.createRadialGradient(r, r, 0, r, r, r);
  for (const [at, a] of stops) grad.addColorStop(at, `rgba(255,255,255,${a})`);
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, size, size);
  tex.refresh();
}

export function makeRealmTextures(scene: Phaser.Scene): void {
  // Soft round light, used for glows, fog and light pools. 256px wide.
  radial(scene, 'realm_soft', 256, [[0, 1], [0.25, 0.55], [0.6, 0.15], [1, 0]]);
  // Small bright dot for particles. 32px wide.
  radial(scene, 'realm_dot', 32, [[0, 1], [0.3, 0.9], [0.6, 0.25], [1, 0]]);

  if (!scene.textures.exists('realm_elder')) {
    makeSim(scene, 'realm_elder', { skin: 0xe8c3a0, hair: 0xeeeef5, hairStyle: 'bun', top: 0x6b4fc8, bottom: 0x3a2f63, eye: 0x4b3a8a });
  }
  makeWisp(scene);
  makeGuardian(scene);
  makeLantern(scene);
}

/** Flame-like spirit, drawn pale so it can be tinted per area. 36x40. */
function makeWisp(scene: Phaser.Scene): void {
  if (scene.textures.exists('realm_wisp')) return;
  const g = scene.add.graphics().setScale(TEX_SCALE);
  g.fillStyle(0xffffff, 0.25).fillEllipse(18, 24, 34, 30);
  g.fillStyle(0xd8d8d8, 1);
  g.fillTriangle(18, 0, 6, 22, 30, 22);
  g.fillTriangle(9, 4, 5, 22, 18, 16);
  g.fillTriangle(27, 4, 31, 22, 18, 16);
  g.fillCircle(18, 25, 12);
  g.fillStyle(0xffffff, 1).fillCircle(16, 22, 8);
  g.fillStyle(0xffffff, 0.9).fillEllipse(14, 18, 6, 8);
  // eyes
  g.fillStyle(0x140b24, 1).fillEllipse(13, 26, 4, 6).fillEllipse(23, 26, 4, 6);
  g.fillStyle(0xffffff, 1).fillCircle(12.5, 24.5, 1).fillCircle(22.5, 24.5, 1);
  g.generateTexture('realm_wisp', 36 * TEX_SCALE, 40 * TEX_SCALE);
  g.destroy();
}

/** The Guardian: a tall spirit of stone held together by light. */
function makeGuardian(scene: Phaser.Scene): void {
  if (scene.textures.exists('realm_guardian')) return;
  const g = scene.add.graphics().setScale(TEX_SCALE);
  const cx = GUARDIAN_W / 2;
  const stone = 0x433d72, stoneD = 0x2b2650, stoneL = 0x6a62a8, glow = 0xd9c4ff;

  g.fillStyle(0x000000, 0.35).fillEllipse(cx, 180, 130, 18);

  // Robe of stacked stone
  g.fillStyle(stoneD, 1);
  g.fillPoints([{ x: 42, y: 96 }, { x: 118, y: 96 }, { x: 138, y: 176 }, { x: 22, y: 176 }].map(p => new Phaser.Math.Vector2(p.x, p.y)), true);
  g.fillStyle(stone, 1);
  g.fillPoints([{ x: 46, y: 96 }, { x: 104, y: 96 }, { x: 116, y: 174 }, { x: 30, y: 174 }].map(p => new Phaser.Math.Vector2(p.x, p.y)), true);
  // Plates
  const plates: number[][] = [
    [34, 140, 64, 136, 70, 174, 30, 174], [70, 138, 104, 142, 112, 174, 72, 174],
    [44, 104, 78, 102, 76, 134, 40, 138], [82, 102, 114, 104, 120, 140, 80, 134],
  ];
  for (const pl of plates) {
    const pts = [];
    for (let i = 0; i < pl.length; i += 2) pts.push(new Phaser.Math.Vector2(pl[i], pl[i + 1]));
    g.fillStyle(stone, 1).fillPoints(pts, true);
    g.lineStyle(1.2, stoneL, 0.8).strokePoints(pts.slice(0, 2), false);
  }

  // Arms
  g.fillStyle(stoneD, 1).fillRoundedRect(12, 96, 24, 62, 10).fillRoundedRect(124, 96, 24, 62, 10);
  g.fillStyle(stone, 1).fillRoundedRect(14, 96, 18, 58, 9).fillRoundedRect(126, 96, 18, 58, 9);
  g.fillStyle(stoneL, 1).fillCircle(24, 160, 11).fillCircle(136, 160, 11);
  g.fillStyle(shade(stoneL, 30), 0.7).fillCircle(21, 157, 4).fillCircle(133, 157, 4);
  // Shoulders
  g.fillStyle(stone, 1).fillCircle(34, 92, 22).fillCircle(126, 92, 22);
  g.fillStyle(stoneL, 0.9).fillEllipse(30, 84, 22, 14).fillEllipse(122, 84, 22, 14);

  // Glowing seams
  g.lineStyle(2, glow, 0.95);
  g.lineBetween(80, 124, 72, 150); g.lineBetween(72, 150, 78, 172);
  g.lineBetween(80, 124, 94, 146); g.lineBetween(94, 146, 90, 170);
  g.lineBetween(26, 110, 24, 140); g.lineBetween(134, 110, 136, 140);
  g.lineStyle(1.2, glow, 0.6);
  g.lineBetween(52, 150, 58, 172); g.lineBetween(104, 150, 100, 172);

  // Heart socket
  g.fillStyle(0x140f28, 1).fillCircle(cx, 114, 13);
  g.lineStyle(2.5, 0xa47bff, 1).strokeCircle(cx, 114, 13);
  g.lineStyle(1, glow, 0.7).strokeCircle(cx, 114, 17);

  // Neck and head
  g.fillStyle(stoneD, 1).fillRect(cx - 10, 72, 20, 18);
  g.fillStyle(stone, 1).fillRoundedRect(cx - 30, 30, 60, 50, 18);
  g.fillStyle(stoneL, 1).fillRoundedRect(cx - 24, 36, 48, 38, 14);
  g.fillStyle(shade(stoneL, 25), 0.6).fillEllipse(cx - 8, 42, 24, 10);
  // Eyes and brow
  g.fillStyle(stoneD, 1).fillRect(cx - 22, 48, 44, 5);
  g.fillStyle(glow, 1).fillEllipse(cx - 11, 58, 14, 6).fillEllipse(cx + 11, 58, 14, 6);
  g.fillStyle(0xffffff, 1).fillEllipse(cx - 11, 58, 6, 3).fillEllipse(cx + 11, 58, 6, 3);
  // Mouth rune
  g.lineStyle(1.5, glow, 0.8).lineBetween(cx - 6, 68, cx + 6, 68);

  // Crown of floating stones
  for (const [x, y, s] of [[cx - 26, 20, 7], [cx, 10, 9], [cx + 26, 20, 7]] as const) {
    g.fillStyle(stone, 1).fillTriangle(x, y - s * 1.6, x - s, y + s * 0.6, x + s, y + s * 0.6);
    g.fillStyle(stoneL, 1).fillTriangle(x, y - s * 1.6, x - s, y + s * 0.6, x, y + s * 0.6);
    g.fillStyle(glow, 0.9).fillCircle(x, y + s * 0.6 + 4, 1.6);
  }

  g.generateTexture('realm_guardian', GUARDIAN_W * TEX_SCALE, GUARDIAN_H * TEX_SCALE);
  g.destroy();
}

/** Tiny paper lantern companion. 18x26. */
function makeLantern(scene: Phaser.Scene): void {
  if (scene.textures.exists('realm_lantern')) return;
  const g = scene.add.graphics().setScale(TEX_SCALE);
  g.lineStyle(1.2, 0x3a2a1a, 1).lineBetween(9, 0, 9, 5);
  g.fillStyle(0x6b2a1a, 1).fillRoundedRect(4, 4, 10, 3, 1).fillRoundedRect(4, 21, 10, 3, 1);
  g.fillStyle(0xff7a3d, 1).fillEllipse(9, 14, 16, 16);
  g.fillStyle(0xffc46b, 1).fillEllipse(9, 14, 10, 13);
  g.fillStyle(0xfff3c4, 1).fillEllipse(9, 14, 4, 6);
  g.lineStyle(0.8, 0xc4452a, 0.8).lineBetween(5, 10, 5, 18).lineBetween(13, 10, 13, 18);
  g.lineStyle(1, 0xffd078, 1).lineBetween(9, 24, 9, 26);
  g.generateTexture('realm_lantern', 18 * TEX_SCALE, 26 * TEX_SCALE);
  g.destroy();
}

/* ------------------------------------------------------------------ */
/* Vector props (drawn into a Graphics positioned at the prop's feet)   */
/* ------------------------------------------------------------------ */

const V = (x: number, y: number) => new Phaser.Math.Vector2(x, y);

/** Faceted heart shard, about 22x40, centred on (0, 0). */
export function drawShard(g: Phaser.GameObjects.Graphics, color: number): void {
  const d = shade(color, -70), l = shade(color, 60);
  g.fillStyle(d, 1).fillPoints([V(0, -20), V(11, -4), V(6, 20), V(-6, 20), V(-11, -4)], true);
  g.fillStyle(color, 1).fillPoints([V(0, -20), V(11, -4), V(3, 18), V(0, -6)], true);
  g.fillStyle(l, 1).fillPoints([V(0, -20), V(0, -6), V(-6, 18), V(-11, -4)], true);
  g.fillStyle(0xffffff, 0.85).fillPoints([V(-2, -15), V(-7, -4), V(-3, 4)], true);
  g.lineStyle(1, 0xffffff, 0.6).strokePoints([V(0, -20), V(11, -4), V(6, 20), V(-6, 20), V(-11, -4)], true);
}

/** Cluster of ice crystals, base at (0, 0). */
export function drawIceCluster(g: Phaser.GameObjects.Graphics, size: number): void {
  g.fillStyle(0x000000, 0.3).fillEllipse(0, 2, size * 1.6, size * 0.45);
  const spikes: [number, number, number][] = [[-size * 0.45, size * 0.9, -0.25], [size * 0.4, size * 1.0, 0.22], [0, size * 1.5, 0]];
  for (const [ox, h, lean] of spikes) {
    const w = size * 0.32;
    const tip = V(ox + lean * h, -h);
    g.fillStyle(0x3d7fb5, 0.95).fillPoints([V(ox - w, 0), tip, V(ox + w, 0)], true);
    g.fillStyle(0x9fe9ff, 0.95).fillPoints([V(ox - w, 0), tip, V(ox, 0)], true);
    g.fillStyle(0xffffff, 0.7).fillPoints([V(ox - w * 0.55, -h * 0.1), V(tip.x - 1, tip.y + 6), V(ox - w * 0.2, -h * 0.1)], true);
    g.lineStyle(1, 0xd8f7ff, 0.8).strokePoints([V(ox - w, 0), tip, V(ox + w, 0)], false);
  }
}

/** Frosted pine, base at (0, 0). */
export function drawFrostTree(g: Phaser.GameObjects.Graphics, s: number): void {
  g.fillStyle(0x000000, 0.35).fillEllipse(0, 2, 60 * s, 16 * s);
  g.fillStyle(0x2a2238, 1).fillRect(-4 * s, -18 * s, 8 * s, 20 * s);
  const tiers = [[0, 46, 34], [-22, 38, 28], [-42, 28, 22], [-58, 18, 15]];
  for (const [y, w, h] of tiers) {
    g.fillStyle(0x1d3a5c, 1).fillTriangle(-w * s, (y - 8) * s, w * s, (y - 8) * s, 0, (y - 8 - h) * s);
    g.fillStyle(0x2d5b86, 1).fillTriangle(-w * s, (y - 8) * s, 0, (y - 8) * s, 0, (y - 8 - h) * s);
    g.fillStyle(0xdff6ff, 0.9).fillTriangle(-w * 0.55 * s, (y - 8 - h * 0.45) * s, w * 0.2 * s, (y - 8 - h * 0.6) * s, 0, (y - 8 - h) * s);
  }
}

/** Dark violet tree with glowing fruit, base at (0, 0). */
export function drawGlowTree(g: Phaser.GameObjects.Graphics, s: number, fruit: number): void {
  g.fillStyle(0x000000, 0.35).fillEllipse(0, 2, 70 * s, 18 * s);
  g.fillStyle(0x24183a, 1).fillPoints([V(-7 * s, 0), V(-4 * s, -40 * s), V(4 * s, -40 * s), V(8 * s, 0)], true);
  g.lineStyle(4 * s, 0x24183a, 1).lineBetween(0, -30 * s, -18 * s, -48 * s).lineBetween(0, -34 * s, 16 * s, -52 * s);
  for (const [x, y, r] of [[-20, -62, 26], [18, -66, 24], [0, -80, 28], [-4, -56, 22]] as const) {
    g.fillStyle(0x2f1f52, 1).fillCircle(x * s, y * s, r * s);
  }
  for (const [x, y, r] of [[-24, -70, 14], [10, -86, 15], [22, -70, 10]] as const) {
    g.fillStyle(0x45307a, 0.9).fillCircle(x * s, y * s, r * s);
  }
  for (const [x, y] of [[-28, -54], [-8, -72], [14, -58], [28, -76], [0, -96], [-18, -86]] as const) {
    g.fillStyle(fruit, 0.35).fillCircle(x * s, y * s, 5 * s);
    g.fillStyle(fruit, 1).fillCircle(x * s, y * s, 2.4 * s);
  }
}

/** Broken carved pillar, base at (0, 0). */
export function drawPillar(g: Phaser.GameObjects.Graphics, h: number, moss = 0x3fae6a): void {
  g.fillStyle(0x000000, 0.35).fillEllipse(0, 2, 46, 14);
  g.fillStyle(0x2d2a45, 1).fillRect(-17, -10, 34, 12);
  g.fillStyle(0x4a4668, 1).fillRect(-13, -h, 26, h - 6);
  g.fillStyle(0x5e5a82, 1).fillRect(-13, -h, 9, h - 6);
  g.fillStyle(0x38344f, 1).fillRect(5, -h, 8, h - 6);
  // broken top
  g.fillStyle(0x4a4668, 1).fillTriangle(-13, -h, 13, -h, 4, -h - 10);
  // rune
  g.lineStyle(1.5, 0x9cffc0, 0.85).strokeCircle(0, -h * 0.55, 5);
  g.lineBetween(0, -h * 0.55 - 9, 0, -h * 0.55 + 9);
  // moss and vines
  g.fillStyle(moss, 0.9).fillEllipse(-6, -h + 2, 22, 8).fillEllipse(8, -14, 16, 10);
  g.lineStyle(2, moss, 0.9).lineBetween(-10, -h + 4, -6, -h * 0.5).lineBetween(-6, -h * 0.5, -12, -20);
}

/** Low wall section, base along y = 0, centred at x = 0. */
export function drawWall(g: Phaser.GameObjects.Graphics, w: number, h: number): void {
  g.fillStyle(0x000000, 0.35).fillRect(-w / 2 + 2, -4, w, 10);
  g.fillStyle(0x3a3657, 1).fillRect(-w / 2, -h, w, h);
  g.fillStyle(0x524d78, 1).fillRect(-w / 2, -h, w, 7);
  g.lineStyle(1, 0x26233d, 1);
  for (let y = -h + 14; y < 0; y += 12) g.lineBetween(-w / 2, y, w / 2, y);
  for (let x = -w / 2 + 18; x < w / 2; x += 26) g.lineBetween(x, -h + 7, x, 0);
  g.fillStyle(0x3fae6a, 0.85);
  for (let x = -w / 2 + 10; x < w / 2; x += 34) g.fillEllipse(x, -h + 2, 18, 7);
}

/** Canyon rock spire, base at (0, 0). */
export function drawSpire(g: Phaser.GameObjects.Graphics, h: number): void {
  g.fillStyle(0x000000, 0.4).fillEllipse(0, 3, 64, 16);
  g.fillStyle(0x3a1e2c, 1).fillPoints([V(-28, 0), V(-16, -h * 0.6), V(-6, -h), V(10, -h * 0.85), V(20, -h * 0.4), V(30, 0)], true);
  g.fillStyle(0x5c2d36, 1).fillPoints([V(-28, 0), V(-16, -h * 0.6), V(-6, -h), V(-2, 0)], true);
  g.lineStyle(2, 0xff8a3d, 0.9).lineBetween(4, -h * 0.75, 10, -h * 0.4).lineBetween(10, -h * 0.4, 6, -h * 0.1);
  g.fillStyle(0xff9a4d, 0.2).fillEllipse(8, -h * 0.4, 18, h * 0.6);
}

/** Standing stone of the Sanctum, base at (0, 0). */
export function drawMonolith(g: Phaser.GameObjects.Graphics, h: number): void {
  g.fillStyle(0x000000, 0.35).fillEllipse(0, 2, 44, 12);
  g.fillStyle(0x2c2748, 1).fillPoints([V(-15, 0), V(-12, -h), V(4, -h - 8), V(14, -h + 4), V(15, 0)], true);
  g.fillStyle(0x454070, 1).fillPoints([V(-15, 0), V(-12, -h), V(4, -h - 8), V(-2, 0)], true);
  g.lineStyle(1.6, 0xc9a8ff, 0.9);
  g.lineBetween(-4, -h * 0.75, -4, -h * 0.35);
  g.lineBetween(-8, -h * 0.62, 0, -h * 0.62);
  g.strokeCircle(-4, -h * 0.25, 3);
}

/** Glowing mushroom and stalk cluster, base at (0, 0). */
export function drawGlowPlant(g: Phaser.GameObjects.Graphics, color: number, s = 1): void {
  g.fillStyle(color, 0.12).fillEllipse(0, -6 * s, 44 * s, 26 * s);
  const stalks: [number, number, number][] = [[-8, 18, 5], [2, 26, 7], [10, 14, 4]];
  for (const [x, h, r] of stalks) {
    g.lineStyle(2 * s, shade(color, -90), 1).lineBetween(x * s, 0, x * s * 1.2, -h * s);
    g.fillStyle(shade(color, -40), 1).fillEllipse(x * s * 1.2, -h * s, r * 2.6 * s, r * 1.5 * s);
    g.fillStyle(color, 1).fillEllipse(x * s * 1.2, -h * s - r * 0.2 * s, r * 2 * s, r * s);
    g.fillStyle(0xffffff, 0.8).fillCircle(x * s * 1.2 - r * 0.4 * s, -h * s - r * 0.3 * s, r * 0.25 * s);
  }
  g.fillStyle(shade(color, -70), 1);
  g.fillTriangle(-16 * s, 0, -12 * s, -12 * s, -9 * s, 0).fillTriangle(14 * s, 0, 18 * s, -10 * s, 20 * s, 0);
}

/** Paper wish lantern on a pole, base at (0, 0). */
export function drawWishShrine(g: Phaser.GameObjects.Graphics): void {
  g.fillStyle(0x000000, 0.35).fillEllipse(0, 2, 56, 14);
  g.fillStyle(0x3a2a52, 1).fillRoundedRect(-22, -12, 44, 14, 3);
  g.fillStyle(0x5a4480, 1).fillRect(-22, -12, 44, 4);
  g.fillStyle(0x6b2a1a, 1).fillRect(-3, -70, 6, 60);
  g.fillStyle(0x8a3a24, 1).fillRect(-26, -76, 52, 7);
  for (const x of [-16, 16]) {
    g.lineStyle(1, 0x2a1a10, 1).lineBetween(x, -69, x, -62);
    g.fillStyle(0xff7a3d, 0.3).fillCircle(x, -50, 15);
    g.fillStyle(0xff7a3d, 1).fillEllipse(x, -50, 16, 20);
    g.fillStyle(0xffc46b, 1).fillEllipse(x, -50, 9, 14);
  }
}

/** Respawn shrine: a low stone with a floating flame. Base at (0, 0). */
export function drawShrineStone(g: Phaser.GameObjects.Graphics): void {
  g.fillStyle(0x000000, 0.35).fillEllipse(0, 2, 50, 14);
  g.fillStyle(0x2c2748, 1).fillRoundedRect(-18, -22, 36, 24, 6);
  g.fillStyle(0x4a4470, 1).fillRoundedRect(-18, -22, 36, 8, 6);
  g.lineStyle(1.5, 0xc9a8ff, 0.8).strokeCircle(0, -9, 4);
}
