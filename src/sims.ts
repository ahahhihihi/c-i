/**
 * Sims-style procedural art: chunky-headed characters with shaded faces,
 * the green plumbob, warm wood flooring, and houseplants.
 */
import Phaser from 'phaser';

export const SIM_W = 40;
export const SIM_H = 64;
/** Physics body for sims: small box at the feet. */
export const SIM_BODY = { w: 16, h: 14, ox: 12, oy: 48 };

export type HairStyle = 'short' | 'long' | 'bun' | 'curly';

export interface SimLook {
  skin: number;
  hair: number;
  hairStyle: HairStyle;
  top: number;
  bottom: number;
  eye: number;
}

function shade(color: number, amt: number): number {
  const c = Phaser.Display.Color.IntegerToColor(color);
  const f = (v: number) => Phaser.Math.Clamp(Math.round(v + amt), 0, 255);
  return Phaser.Display.Color.GetColor(f(c.red), f(c.green), f(c.blue));
}

export function makeSim(scene: Phaser.Scene, key: string, look: SimLook): void {
  const g = scene.add.graphics();
  const cx = SIM_W / 2;
  const skinD = shade(look.skin, -28);
  const skinL = shade(look.skin, 14);
  const hairD = shade(look.hair, -30);
  const hairL = shade(look.hair, 35);

  // Soft ground shadow
  g.fillStyle(0x000000, 0.18);
  g.fillEllipse(cx, SIM_H - 4, 26, 9);
  g.fillStyle(0x000000, 0.18);
  g.fillEllipse(cx, SIM_H - 4, 20, 6);

  // Hair behind the head
  g.fillStyle(look.hair, 1);
  if (look.hairStyle === 'long') {
    g.fillRoundedRect(7, 6, 26, 34, 8);
    g.fillStyle(hairD, 1);
    g.fillRoundedRect(7, 28, 26, 12, 6);
  } else if (look.hairStyle === 'bun') {
    g.fillCircle(cx, 2, 5);
    g.fillStyle(hairL, 0.6);
    g.fillCircle(cx - 1.5, 0.5, 2);
  }

  // Legs
  g.fillStyle(look.bottom, 1);
  g.fillRoundedRect(11, 43, 8, 15, 3);
  g.fillRoundedRect(21, 43, 8, 15, 3);
  g.fillStyle(shade(look.bottom, -25), 1);
  g.fillRect(19, 44, 2, 13);
  // Shoes
  g.fillStyle(0xf4f1ea, 1);
  g.fillRoundedRect(10, 56, 10, 5, 2);
  g.fillRoundedRect(20, 56, 10, 5, 2);
  g.fillStyle(0x9a948a, 1);
  g.fillRect(10, 59, 10, 2);
  g.fillRect(20, 59, 10, 2);

  // Arms (behind torso edge) with sleeves
  g.fillStyle(look.skin, 1);
  g.fillRoundedRect(4, 30, 6, 15, 3);
  g.fillRoundedRect(30, 30, 6, 15, 3);
  g.fillStyle(skinD, 1);
  g.fillRoundedRect(30, 34, 6, 11, 3);
  g.fillStyle(look.top, 1);
  g.fillRoundedRect(3, 27, 8, 9, 3);
  g.fillRoundedRect(29, 27, 8, 9, 3);

  // Torso
  g.fillStyle(look.top, 1);
  g.fillRoundedRect(9, 25, 22, 22, 6);
  g.fillStyle(shade(look.top, -30), 1);
  g.fillRoundedRect(9, 38, 22, 9, { tl: 0, tr: 0, bl: 6, br: 6 });
  g.fillStyle(shade(look.top, 40), 0.7);
  g.fillRoundedRect(12, 27, 6, 10, 3);
  // Belt
  g.fillStyle(shade(look.bottom, -45), 1);
  g.fillRect(9, 44, 22, 3);

  // Neck
  g.fillStyle(skinD, 1);
  g.fillRect(17, 21, 6, 7);

  // Ears
  g.fillStyle(look.skin, 1);
  g.fillCircle(8.5, 16, 2.6);
  g.fillCircle(31.5, 16, 2.6);

  // Head (large, Sims proportions)
  g.fillStyle(look.skin, 1);
  g.fillEllipse(cx, 15, 25, 27);
  g.fillStyle(skinL, 0.8);
  g.fillEllipse(cx - 3, 11, 12, 12);
  g.fillStyle(skinD, 0.5);
  g.fillEllipse(cx + 5, 22, 12, 8);

  // Cheek blush
  g.fillStyle(0xff7a7a, 0.28);
  g.fillCircle(12.5, 20, 3);
  g.fillCircle(27.5, 20, 3);

  // Eyes
  for (const ex of [14.5, 25.5]) {
    g.fillStyle(0xffffff, 1);
    g.fillEllipse(ex, 16, 6.5, 7.5);
    g.fillStyle(look.eye, 1);
    g.fillCircle(ex, 16.5, 2.6);
    g.fillStyle(0x0b0b10, 1);
    g.fillCircle(ex, 16.5, 1.4);
    g.fillStyle(0xffffff, 1);
    g.fillCircle(ex - 0.9, 15.4, 0.9);
  }

  // Brows
  g.lineStyle(1.6, hairD, 1);
  g.lineBetween(11.5, 10.5, 17, 10);
  g.lineBetween(23, 10, 28.5, 10.5);

  // Nose + mouth
  g.fillStyle(skinD, 0.8);
  g.fillCircle(cx, 20, 1.3);
  g.lineStyle(1.4, 0xb04a4a, 1);
  g.beginPath();
  g.arc(cx, 21.5, 4, 0.35, Math.PI - 0.35);
  g.strokePath();

  // Hair on top of the head
  g.fillStyle(look.hair, 1);
  if (look.hairStyle === 'curly') {
    for (const [hx, hy, r] of [[11, 5, 6], [20, 2, 7], [29, 5, 6], [8, 11, 4], [32, 11, 4]] as const) {
      g.fillCircle(hx, hy, r);
    }
  } else {
    g.fillEllipse(cx, 6, 27, 14);
    g.fillRoundedRect(7, 5, 5, 12, 2);
    g.fillRoundedRect(28, 5, 5, 12, 2);
  }
  // Fringe sweep and highlight
  g.fillStyle(hairD, 1);
  g.fillEllipse(cx + 5, 9, 14, 5);
  g.fillStyle(hairL, 0.9);
  g.fillEllipse(cx - 5, 3.5, 9, 3);

  g.generateTexture(key, SIM_W, SIM_H);
  g.destroy();
}

/** The green diamond that floats above every Sim. 16x28. */
export function makePlumbob(scene: Phaser.Scene): void {
  if (scene.textures.exists('plumbob')) return;
  const g = scene.add.graphics();
  const w = 16, h = 28, m = w / 2, mid = h / 2;
  g.fillStyle(0x2bbf3f, 1);
  g.fillTriangle(m, 0, w, mid, 0, mid);
  g.fillStyle(0x1a8f2d, 1);
  g.fillTriangle(m, h, w, mid, 0, mid);
  g.fillStyle(0x7dff8a, 1);
  g.fillTriangle(m, 0, m, mid, 0, mid);
  g.fillStyle(0x45d65a, 1);
  g.fillTriangle(m, h, m, mid, 0, mid);
  g.fillStyle(0xffffff, 0.55);
  g.fillTriangle(m - 1, 3, m - 3, mid - 2, m - 1, mid - 3);
  g.generateTexture('plumbob', w, h);
  g.destroy();
}

/** Warm wood-plank floor tile, 64x64, tiles seamlessly. */
export function makeWoodFloor(scene: Phaser.Scene): void {
  if (scene.textures.exists('floor_wood')) return;
  const g = scene.add.graphics();
  const shades = [0xc89358, 0xbf8a50, 0xd09c62, 0xb98350];
  for (let i = 0; i < 4; i++) {
    const y = i * 16;
    g.fillStyle(shades[i], 1);
    g.fillRect(0, y, 64, 16);
    // plank end seams staggered per row
    const seam = (i % 2 === 0) ? 22 : 46;
    g.fillStyle(0x7b5030, 0.55);
    g.fillRect(seam, y, 1, 16);
    // grain
    g.lineStyle(1, 0x9c6b3a, 0.35);
    g.lineBetween(4, y + 5, seam - 4, y + 6);
    g.lineBetween(seam + 4, y + 10, 60, y + 9);
    // top highlight and bottom seam
    g.fillStyle(0xffffff, 0.08);
    g.fillRect(0, y, 64, 1);
    g.fillStyle(0x6b4426, 0.6);
    g.fillRect(0, y + 15, 64, 1);
  }
  g.generateTexture('floor_wood', 64, 64);
  g.destroy();
}

export function makePlant(scene: Phaser.Scene): void {
  if (scene.textures.exists('plant')) return;
  const g = scene.add.graphics();
  g.fillStyle(0x000000, 0.18);
  g.fillEllipse(20, 54, 28, 8);
  // pot
  g.fillStyle(0xb5562f, 1);
  g.fillTriangle(8, 38, 32, 38, 28, 54);
  g.fillTriangle(8, 38, 28, 54, 12, 54);
  g.fillStyle(0xd0703f, 1);
  g.fillRoundedRect(6, 34, 28, 7, 2);
  // leaves
  const leaves: Array<[number, number, number, number]> = [
    [20, 10, 8, 20], [10, 20, 7, 16], [30, 20, 7, 16], [14, 28, 6, 12], [26, 28, 6, 12],
  ];
  for (const [x, y, rx, ry] of leaves) {
    g.fillStyle(0x2f9e44, 1);
    g.fillEllipse(x, y, rx * 2, ry * 2);
    g.fillStyle(0x56c46a, 0.7);
    g.fillEllipse(x - 2, y - 3, rx, ry);
  }
  g.generateTexture('plant', 40, 58);
  g.destroy();
}
