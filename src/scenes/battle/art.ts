/**
 * Battle Arena art: procedural textures (minions, glow, sims) and the
 * jungle-temple lane background. Everything is drawn at runtime.
 */
import Phaser from 'phaser';
import { TEX_SCALE, makeSim } from '../../sims';

export const LANE_L = 330;
export const LANE_R = 590;
export const LANE_CX = 460;
export const RIVER_Y = 262;

export const BLUE = 0x3ea8ff;
export const BLUE_HEX = '#5cb8ff';
export const RED = 0xff3d5e;
export const RED_HEX = '#ff5c78';

/** Soft round glow, white, for tinting with additive blend. */
function makeGlow(scene: Phaser.Scene): void {
  if (scene.textures.exists('bt_glow')) return;
  const size = 128;
  const tex = scene.textures.createCanvas('bt_glow', size, size)!;
  const ctx = tex.getContext();
  const g = ctx.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
  g.addColorStop(0, 'rgba(255,255,255,1)');
  g.addColorStop(0.25, 'rgba(255,255,255,0.55)');
  g.addColorStop(0.6, 'rgba(255,255,255,0.12)');
  g.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, size, size);
  tex.refresh();
}

/** Melee minion: a squat shield-bearer. 24x24 logical. */
function makeMelee(scene: Phaser.Scene, key: string, main: number, dark: number, light: number): void {
  if (scene.textures.exists(key)) return;
  const g = scene.add.graphics().setScale(TEX_SCALE);
  g.fillStyle(0x000000, 0.3).fillEllipse(12, 21, 18, 6);
  // body
  g.fillStyle(dark, 1).fillRoundedRect(5, 7, 14, 13, 4);
  g.fillStyle(main, 1).fillRoundedRect(5, 6, 14, 11, 4);
  // helmet
  g.fillStyle(dark, 1).fillCircle(12, 6, 5.5);
  g.fillStyle(main, 1).fillCircle(12, 5.5, 4.6);
  g.fillStyle(0xffffff, 0.9).fillRect(9.5, 5, 5, 1.6);
  // shield
  g.fillStyle(light, 1).fillRoundedRect(2, 9, 7, 9, 2);
  g.fillStyle(0xffffff, 0.6).fillRect(4, 11, 3, 1);
  // spear
  g.lineStyle(1.6, 0xe9e4d6, 1).lineBetween(19, 3, 19, 20);
  g.fillStyle(0xffffff, 1).fillTriangle(17.5, 4, 20.5, 4, 19, 0);
  // feet
  g.fillStyle(0x15121f, 1).fillRect(7, 19, 4, 2).fillRect(13, 19, 4, 2);
  g.generateTexture(key, 24 * TEX_SCALE, 24 * TEX_SCALE);
  g.destroy();
}

/** Caster minion: a hovering orb with a robe. 22x26 logical. */
function makeCaster(scene: Phaser.Scene, key: string, main: number, dark: number, light: number): void {
  if (scene.textures.exists(key)) return;
  const g = scene.add.graphics().setScale(TEX_SCALE);
  g.fillStyle(0x000000, 0.25).fillEllipse(11, 24, 14, 4);
  // robe
  g.fillStyle(dark, 1).fillTriangle(11, 6, 3, 21, 19, 21);
  g.fillStyle(main, 1).fillTriangle(11, 6, 5, 19, 17, 19);
  // hood
  g.fillStyle(dark, 1).fillCircle(11, 7, 4.5);
  g.fillStyle(0x0b0915, 1).fillCircle(11, 7.5, 2.8);
  g.fillStyle(light, 1).fillCircle(10, 7.5, 0.8).fillCircle(12, 7.5, 0.8);
  // staff orb
  g.lineStyle(1.3, 0xc9b28a, 1).lineBetween(18, 4, 18, 20);
  g.fillStyle(light, 0.5).fillCircle(18, 3.5, 3.6);
  g.fillStyle(0xffffff, 1).fillCircle(18, 3.5, 1.8);
  g.generateTexture(key, 22 * TEX_SCALE, 26 * TEX_SCALE);
  g.destroy();
}

export function ensureBattleTextures(scene: Phaser.Scene): void {
  makeGlow(scene);
  makeMelee(scene, 'bt_melee_blue', 0x3ea8ff, 0x1d4f8f, 0x9fe3ff);
  makeMelee(scene, 'bt_melee_red', 0xff4d6d, 0x8f1d36, 0xffb3c0);
  makeCaster(scene, 'bt_caster_blue', 0x4fc3ff, 0x1d4f8f, 0x9ff6ff);
  makeCaster(scene, 'bt_caster_red', 0xff5a7a, 0x8f1d36, 0xffd0a0);
  if (!scene.textures.exists('bt_enemy')) {
    makeSim(scene, 'bt_enemy', { skin: 0xd9a37f, hair: 0xf1f1f1, hairStyle: 'short', top: 0xd8283f, bottom: 0x2a1622, eye: 0xc0392b });
  }
  if (!scene.textures.exists('bt_skin')) {
    makeSim(scene, 'bt_skin', { skin: 0xf0c9a8, hair: 0xff4fd8, hairStyle: 'curly', top: 0xffc23d, bottom: 0x2b1d4a, eye: 0x3ee6ff });
  }
}

/** Seeded random so the background is identical every match. */
function rng(seed: number): () => number {
  let s = seed >>> 0;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 4294967296;
  };
}

const lerpColor = (a: number, b: number, t: number): number => {
  const c = Phaser.Display.Color.Interpolate.ColorWithColor(
    Phaser.Display.Color.ValueToColor(a), Phaser.Display.Color.ValueToColor(b), 100, Math.round(t * 100));
  return Phaser.Display.Color.GetColor(c.r, c.g, c.b);
};

/**
 * Night jungle temple: dark foliage, a stone lane with team-coloured edge
 * glow, a river with a bridge, and the two bases. Extends 320px past the
 * 920x520 world on every side.
 */
export function drawArena(scene: Phaser.Scene, extra?: (keep: <T extends Phaser.GameObjects.GameObject>(o: T) => T) => void): void {
  const r = rng(1337);
  const X0 = -340, Y0 = -340, X1 = 1260, Y1 = 860;
  // Static layers are collected and baked into one texture at the end:
  // hundreds of live Graphics shapes are far too slow to redraw every frame.
  const bake: Phaser.GameObjects.GameObject[] = [];
  const keep = <T extends Phaser.GameObjects.GameObject>(o: T): T => { bake.push(o); return o; };

  // Ground with a red (top) to blue (bottom) tint
  const ground = keep(scene.add.graphics()).setDepth(0);
  ground.fillGradientStyle(0x1a0716, 0x1a0716, 0x061226, 0x061226, 1);
  ground.fillRect(X0, Y0, X1 - X0, Y1 - Y0);

  // Foliage clumps outside the lane
  const leaves = keep(scene.add.graphics()).setDepth(1);
  const greens = [0x06140f, 0x0a1f17, 0x0d2a1e, 0x123526];
  for (let i = 0; i < 520; i++) {
    const x = X0 + r() * (X1 - X0);
    const y = Y0 + r() * (Y1 - Y0);
    if (x > LANE_L - 24 && x < LANE_R + 24) continue;
    const rad = 10 + r() * 34;
    leaves.fillStyle(greens[Math.floor(r() * greens.length)], 0.95);
    leaves.fillCircle(x, y, rad);
    if (r() < 0.5) {
      leaves.fillStyle(0x1a4a33, 0.55);
      leaves.fillEllipse(x - rad * 0.3, y - rad * 0.35, rad * 0.9, rad * 0.5);
    }
  }
  // Glowing flowers and mushrooms in the undergrowth
  const flowerCols = [0xff4fd8, 0x3ee6ff, 0x5cff8a, 0xffd078];
  for (let i = 0; i < 70; i++) {
    const side = r() < 0.5 ? -1 : 1;
    const x = side < 0 ? X0 + r() * (LANE_L - 40 - X0) : LANE_R + 40 + r() * (X1 - LANE_R - 40);
    const y = Y0 + r() * (Y1 - Y0);
    const col = flowerCols[Math.floor(r() * flowerCols.length)];
    keep(scene.add.image(x, y, 'bt_glow').setTint(col).setScale(0.12 + r() * 0.16).setAlpha(0.75)
      .setBlendMode(Phaser.BlendModes.ADD).setDepth(2));
  }

  // River across the middle
  const river = keep(scene.add.graphics()).setDepth(2);
  river.fillStyle(0x0b4a5a, 0.85).fillRect(X0, RIVER_Y - 18, X1 - X0, 36);
  river.fillStyle(0x1aa6b8, 0.35).fillRect(X0, RIVER_Y - 8, X1 - X0, 16);
  river.lineStyle(2, 0x3ee6ff, 0.55).lineBetween(X0, RIVER_Y - 18, X1, RIVER_Y - 18).lineBetween(X0, RIVER_Y + 18, X1, RIVER_Y + 18);
  for (let i = 0; i < 18; i++) {
    const sx = r() < 0.5 ? X0 + r() * (LANE_L - X0 - 180) : LANE_R + 10 + r() * (X1 - LANE_R - 180);
    const s = scene.add.image(sx, RIVER_Y - 12 + r() * 24, 'bt_glow')
      .setTint(0x3ee6ff).setScale(0.18, 0.06).setAlpha(0.7).setBlendMode(Phaser.BlendModes.ADD).setDepth(2);
    scene.tweens.add({ targets: s, x: s.x + 160, alpha: 0.1, duration: 3000 + r() * 3000, yoyo: true, repeat: -1, ease: 'Sine.inOut' });
  }

  // Stone lane tiles
  const lane = keep(scene.add.graphics()).setDepth(4);
  lane.fillStyle(0x000000, 0.5).fillRect(LANE_L - 6, Y0, LANE_R - LANE_L + 12, Y1 - Y0);
  const T = 26;
  const stones = [0x1c1f33, 0x202439, 0x191c2d, 0x23273f];
  for (let y = -26 * 14; y < Y1; y += T) {
    for (let x = LANE_L; x < LANE_R; x += T) {
      if (y > RIVER_Y - 30 && y < RIVER_Y + 20) continue;
      lane.fillStyle(stones[Math.floor(r() * stones.length)], 1).fillRect(x + 1, y + 1, T - 2, T - 2);
      lane.fillStyle(0xffffff, 0.04).fillRect(x + 1, y + 1, T - 2, 2);
    }
  }
  // Wooden bridge over the river
  const planks = [0x5a3e2c, 0x684834, 0x523826];
  for (let y = RIVER_Y - 30; y < RIVER_Y + 20; y += 10) {
    lane.fillStyle(planks[Math.floor(r() * planks.length)], 1).fillRect(LANE_L, y, LANE_R - LANE_L, 9);
    lane.fillStyle(0xffffff, 0.06).fillRect(LANE_L, y, LANE_R - LANE_L, 1);
    lane.fillStyle(0x2a1a12, 0.8).fillRect(LANE_L + 40 + r() * 160, y, 2, 9);
  }
  lane.fillStyle(0x3a2a20, 1).fillRect(LANE_L - 6, RIVER_Y - 32, 6, 54).fillRect(LANE_R, RIVER_Y - 32, 6, 54);
  // Moss creeping onto the stones
  for (let i = 0; i < 90; i++) {
    const x = LANE_L + (r() < 0.5 ? r() * 40 : LANE_R - LANE_L - r() * 40);
    const y = Y0 + r() * (Y1 - Y0);
    if (Math.abs(y - RIVER_Y) < 34) continue;
    lane.fillStyle(0x1f4a30, 0.35 + r() * 0.3).fillCircle(x, y, 3 + r() * 8);
  }

  // Lane centre runes
  const runes = keep(scene.add.graphics()).setDepth(5).setBlendMode(Phaser.BlendModes.ADD);
  for (let y = 40; y < 500; y += 52) {
    if (Math.abs(y - RIVER_Y) < 40) continue;
    const col = lerpColor(RED, BLUE, Phaser.Math.Clamp((y - 60) / 400, 0, 1));
    runes.lineStyle(1.5, col, 0.3);
    runes.strokeCircle(LANE_CX, y, 7);
    runes.lineBetween(LANE_CX - 11, y, LANE_CX + 11, y);
  }

  // Edge glow, red at the top fading to blue at the bottom
  const edge = keep(scene.add.graphics()).setDepth(5).setBlendMode(Phaser.BlendModes.ADD);
  for (let y = Y0; y < Y1; y += 6) {
    const t = Phaser.Math.Clamp((y - 120) / 280, 0, 1);
    const col = lerpColor(RED, BLUE, t);
    for (const x of [LANE_L - 3, LANE_R + 3]) {
      edge.lineStyle(10, col, 0.1).lineBetween(x, y, x, y + 6);
      edge.lineStyle(2, col, 0.85).lineBetween(x, y, x, y + 6);
    }
  }

  // Torches along the lane edges
  for (let y = 30; y < 520; y += 70) {
    if (Math.abs(y - RIVER_Y) < 30) continue;
    const col = y < RIVER_Y ? 0xff7a5c : 0x5cd0ff;
    for (const x of [LANE_L - 12, LANE_R + 12]) {
      keep(scene.add.rectangle(x, y + 6, 4, 12, 0x2a2232).setDepth(5));
      const fl = scene.add.image(x, y, 'bt_glow').setTint(col).setScale(0.32).setBlendMode(Phaser.BlendModes.ADD).setDepth(6);
      scene.tweens.add({ targets: fl, scale: 0.42, alpha: 0.7, duration: 300 + r() * 400, yoyo: true, repeat: -1, ease: 'Sine.inOut' });
    }
  }

  // Bases: glowing platforms past each end of the lane
  const bases = keep(scene.add.graphics()).setDepth(5);
  for (const [y, col, dir] of [[8, RED, -1], [512, BLUE, 1]] as const) {
    bases.fillStyle(0x10101c, 1).fillEllipse(LANE_CX, y + dir * 10, 300, 90);
    bases.lineStyle(3, col, 0.9).strokeEllipse(LANE_CX, y + dir * 10, 300, 90);
    bases.lineStyle(10, col, 0.15).strokeEllipse(LANE_CX, y + dir * 10, 312, 100);
    bases.lineStyle(1.5, col, 0.5).strokeEllipse(LANE_CX, y + dir * 10, 200, 56);
    const gl = scene.add.image(LANE_CX, y, 'bt_glow').setTint(col).setScale(2.6, 0.9).setAlpha(0.35)
      .setBlendMode(Phaser.BlendModes.ADD).setDepth(5);
    scene.tweens.add({ targets: gl, alpha: 0.55, duration: 1600, yoyo: true, repeat: -1, ease: 'Sine.inOut' });
  }

  extra?.(keep);

  // Bake: draw every static layer, in depth order, into one texture sized for the display
  const dpr = window.devicePixelRatio || 1;
  const S = Phaser.Math.Clamp(Math.min(window.screen.width / 920, window.screen.height / 520) * dpr, 1, 2);
  const rt = scene.add.renderTexture(X0, Y0, (X1 - X0) * S, (Y1 - Y0) * S).setOrigin(0).setScale(1 / S).setDepth(0);
  const sorted = (bake as unknown as (Phaser.GameObjects.GameObject & Phaser.GameObjects.Components.Depth & Phaser.GameObjects.Components.Transform)[])
    .sort((a, b) => a.depth - b.depth);
  for (const o of sorted) {
    o.setPosition(o.x * S, o.y * S);
    o.setScale(o.scaleX * S, o.scaleY * S);
    rt.draw(o, -X0 * S, -Y0 * S);
    o.destroy();
  }

  // Fireflies
  for (let i = 0; i < 26; i++) {
    // keep clear of the HUD panels at x 16-306 and 614-904
    const x = i % 3 === 0 ? -150 + r() * 160 : i % 3 === 1 ? 1066 - r() * 160 : 320 + r() * 280;
    const y = -40 + r() * 600;
    const f = scene.add.image(x, y, 'bt_glow').setTint(r() < 0.5 ? 0xd8ff7a : 0xffd078).setScale(0.07)
      .setBlendMode(Phaser.BlendModes.ADD).setDepth(950).setAlpha(0);
    scene.tweens.add({
      targets: f, x: x + (r() - 0.5) * 90, y: y + (r() - 0.5) * 70, alpha: { from: 0, to: 0.9 },
      duration: 2200 + r() * 2600, yoyo: true, repeat: -1, delay: r() * 3000, ease: 'Sine.inOut',
    });
  }
}

/** Five-pointed star polygon for rank stars. */
export function starPoints(cx: number, cy: number, outer: number, inner: number): Phaser.Math.Vector2[] {
  const pts: Phaser.Math.Vector2[] = [];
  for (let i = 0; i < 10; i++) {
    const a = -Math.PI / 2 + (i * Math.PI) / 5;
    const rr = i % 2 === 0 ? outer : inner;
    pts.push(new Phaser.Math.Vector2(cx + Math.cos(a) * rr, cy + Math.sin(a) * rr));
  }
  return pts;
}
