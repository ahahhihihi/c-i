/**
 * Procedural art for Frontier: icons, trees, rocks, chests, banners,
 * the dusk map, and the building drawings. No image files.
 */
import Phaser from 'phaser';
import { TEX_SCALE, makeSim } from '../../sims';
import { WORLD_W, WORLD_H } from '../../view';

export type Res = 'wood' | 'food' | 'stone';
export type BuildKind = 'farm' | 'palisade' | 'tower';

export const RES_COLOR: Record<Res, string> = { wood: '#e0a465', food: '#ffd45c', stone: '#c9d3e0' };

/** Overscan: backgrounds reach this far beyond the world on every side. */
const OVER = 420;

function tex(scene: Phaser.Scene, key: string, w: number, h: number, draw: (g: Phaser.GameObjects.Graphics) => void): void {
  if (scene.textures.exists(key)) return;
  const g = scene.add.graphics().setScale(TEX_SCALE);
  draw(g);
  g.generateTexture(key, w * TEX_SCALE, h * TEX_SCALE);
  g.destroy();
}

export function ensureFrontierArt(scene: Phaser.Scene): void {
  // Soft radial glow, tinted at use
  if (!scene.textures.exists('fr_glow')) {
    const c = scene.textures.createCanvas('fr_glow', 128, 128)!;
    const ctx = c.getContext();
    const grd = ctx.createRadialGradient(64, 64, 0, 64, 64, 64);
    grd.addColorStop(0, 'rgba(255,255,255,1)');
    grd.addColorStop(0.25, 'rgba(255,255,255,0.55)');
    grd.addColorStop(0.6, 'rgba(255,255,255,0.12)');
    grd.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = grd;
    ctx.fillRect(0, 0, 128, 128);
    c.refresh();
  }

  tex(scene, 'fr_wood', 20, 20, g => {
    g.fillStyle(0x6b3f1f, 1); g.fillRoundedRect(2, 9, 16, 6, 3);
    g.fillStyle(0x8f5a2e, 1); g.fillRoundedRect(3, 4, 15, 6, 3);
    g.fillStyle(0xe8c08a, 1); g.fillCircle(16, 7, 2.6); g.fillCircle(15.5, 12, 2.6);
    g.fillStyle(0xa36b3a, 1); g.fillCircle(16, 7, 1.1); g.fillCircle(15.5, 12, 1.1);
    g.fillStyle(0xffffff, 0.18); g.fillRect(4, 5, 10, 1.2);
  });
  tex(scene, 'fr_food', 20, 20, g => {
    g.lineStyle(1.4, 0xb98a2a, 1);
    g.lineBetween(10, 18, 10, 6); g.lineBetween(10, 18, 6, 7); g.lineBetween(10, 18, 14, 7);
    g.fillStyle(0xffd45c, 1);
    for (const [x, y] of [[10, 4], [10, 7.5], [6, 5], [6.5, 8.5], [14, 5], [13.5, 8.5]] as const) g.fillEllipse(x, y, 3.2, 4.4);
    g.fillStyle(0xd9902a, 1); g.fillRect(7, 13, 6, 2);
  });
  tex(scene, 'fr_stone', 20, 20, g => {
    g.fillStyle(0x6e7787, 1);
    g.fillPoints([{ x: 3, y: 15 }, { x: 5, y: 7 }, { x: 11, y: 3 }, { x: 17, y: 7 }, { x: 18, y: 15 }, { x: 10, y: 18 }] as any, true);
    g.fillStyle(0xb7c2d2, 1);
    g.fillPoints([{ x: 5, y: 8 }, { x: 11, y: 4 }, { x: 15, y: 7.5 }, { x: 10, y: 10 }] as any, true);
    g.fillStyle(0x4b5260, 1);
    g.fillPoints([{ x: 10, y: 18 }, { x: 18, y: 15 }, { x: 17, y: 9 }, { x: 11, y: 12 }] as any, true);
  });
  tex(scene, 'fr_shield', 20, 20, g => {
    g.fillStyle(0x3ee6ff, 1);
    g.fillPoints([{ x: 3, y: 4 }, { x: 10, y: 1.5 }, { x: 17, y: 4 }, { x: 16, y: 12 }, { x: 10, y: 18.5 }, { x: 4, y: 12 }] as any, true);
    g.fillStyle(0x0f5d73, 1);
    g.fillPoints([{ x: 10, y: 4 }, { x: 15, y: 5.5 }, { x: 14.2, y: 11.5 }, { x: 10, y: 16 }] as any, true);
    g.fillStyle(0xffffff, 0.5); g.fillRect(5.5, 5, 1.5, 6);
  });
  tex(scene, 'fr_sword', 20, 20, g => {
    g.lineStyle(3, 0xff4d6d, 1); g.lineBetween(4, 16, 15, 5);
    g.lineStyle(1.2, 0xffd0d8, 1); g.lineBetween(6, 14, 15, 5);
    g.lineStyle(2.4, 0xffd078, 1); g.lineBetween(3, 12, 8, 17);
    g.fillStyle(0xffd078, 1); g.fillCircle(3, 17, 1.6);
  });
  tex(scene, 'fr_clock', 20, 20, g => {
    g.fillStyle(0xffffff, 0.12); g.fillCircle(10, 10, 8);
    g.lineStyle(1.8, 0xc4d0e6, 1); g.strokeCircle(10, 10, 7.5);
    g.lineBetween(10, 10, 10, 5); g.lineBetween(10, 10, 13.5, 11.5);
  });
  tex(scene, 'fr_person', 20, 20, g => {
    g.fillStyle(0xc4d0e6, 1); g.fillCircle(10, 6, 3.6);
    g.fillRoundedRect(4.5, 10.5, 11, 8, { tl: 5, tr: 5, bl: 1, br: 1 });
  });
  tex(scene, 'fr_bolt', 20, 20, g => {
    g.fillStyle(0xffe36b, 1);
    g.fillPoints([{ x: 12, y: 1 }, { x: 4, y: 11 }, { x: 9, y: 11 }, { x: 7, y: 19 }, { x: 16, y: 8 }, { x: 11, y: 8 }] as any, true);
  });
  tex(scene, 'fr_chest', 14, 12, g => {
    g.fillStyle(0x7a4520, 1); g.fillRoundedRect(1, 4, 12, 7, 1.5);
    g.fillStyle(0xa8642e, 1); g.fillRoundedRect(1, 1, 12, 4.5, { tl: 3, tr: 3, bl: 0, br: 0 });
    g.fillStyle(0xffd078, 1); g.fillRect(1, 4.5, 12, 1.2); g.fillRect(6, 3.5, 2, 4);
    g.fillStyle(0xffffff, 0.6); g.fillRect(2.5, 2, 3, 0.8);
  });
  tex(scene, 'fr_banner', 16, 34, g => {
    g.fillStyle(0x6b4a2e, 1); g.fillRect(2, 1, 2, 33);
    g.fillStyle(0xffd078, 1); g.fillCircle(3, 1.5, 1.6);
    g.fillStyle(0x3ee6ff, 1);
    g.fillPoints([{ x: 4, y: 3 }, { x: 15, y: 3 }, { x: 15, y: 18 }, { x: 9.5, y: 14.5 }, { x: 4, y: 18 }] as any, true);
    g.fillStyle(0x0f5d73, 1); g.fillCircle(9.5, 9, 3);
    g.fillStyle(0xffffff, 1); g.fillCircle(9.5, 9, 1.4);
  });
  tex(scene, 'fr_tree0', 40, 48, g => {
    g.fillStyle(0x000000, 0.3); g.fillEllipse(20, 44, 30, 8);
    g.fillStyle(0x3d2a1a, 1); g.fillRect(17.5, 30, 5, 14);
    g.fillStyle(0x16302a, 1); g.fillCircle(20, 22, 15); g.fillCircle(11, 27, 9); g.fillCircle(29, 27, 9);
    g.fillStyle(0x234536, 1); g.fillCircle(17, 18, 10); g.fillCircle(26, 22, 8);
    g.fillStyle(0x3b6b47, 0.9); g.fillCircle(14, 14, 5); g.fillCircle(22, 12, 4);
  });
  tex(scene, 'fr_tree1', 32, 52, g => {
    g.fillStyle(0x000000, 0.3); g.fillEllipse(16, 48, 24, 7);
    g.fillStyle(0x3d2a1a, 1); g.fillRect(14, 38, 4, 10);
    g.fillStyle(0x112822, 1); g.fillTriangle(16, 2, 2, 42, 30, 42);
    g.fillStyle(0x1d3d30, 1); g.fillTriangle(16, 2, 5, 32, 27, 32);
    g.fillStyle(0x2f5a40, 1); g.fillTriangle(16, 2, 9, 20, 21, 20);
    g.fillStyle(0x4b7a52, 0.7); g.fillTriangle(16, 4, 11, 16, 15, 16);
  });
  tex(scene, 'fr_rock', 30, 22, g => {
    g.fillStyle(0x000000, 0.3); g.fillEllipse(15, 19, 26, 6);
    g.fillStyle(0x4a505c, 1);
    g.fillPoints([{ x: 2, y: 18 }, { x: 5, y: 8 }, { x: 13, y: 3 }, { x: 23, y: 5 }, { x: 28, y: 13 }, { x: 26, y: 19 }] as any, true);
    g.fillStyle(0x7d8696, 1);
    g.fillPoints([{ x: 6, y: 9 }, { x: 13, y: 4.5 }, { x: 21, y: 6.5 }, { x: 14, y: 11 }] as any, true);
    g.fillStyle(0x343843, 1);
    g.fillPoints([{ x: 14, y: 11 }, { x: 21, y: 6.5 }, { x: 27, y: 13 }, { x: 25, y: 18 }, { x: 15, y: 18 }] as any, true);
  });
  tex(scene, 'fr_spark', 8, 8, g => { g.fillStyle(0xffffff, 1); g.fillCircle(4, 4, 3); });

  // Raiders and allies use the shared Sims generator with their own colours
  if (!scene.textures.exists('fr_raider')) {
    makeSim(scene, 'fr_raider', { skin: 0xc79a7a, hair: 0x1a1010, hairStyle: 'short', top: 0x8e1b2e, bottom: 0x2a1616, eye: 0x2a0a0a });
  }
  if (!scene.textures.exists('fr_ally')) {
    makeSim(scene, 'fr_ally', { skin: 0xe9c2a0, hair: 0xd9d9e8, hairStyle: 'short', top: 0x1aa6c9, bottom: 0x1d2a44, eye: 0x2a6fb5 });
  }
}

/** Map geometry, in world coordinates. */
export const MAP = {
  top: 64,
  bottom: 388,
  town: { x: 470, y: 205 },
  drop: { x: 470, y: 246 },
  fire: { x: 470, y: 272 },
  gate: { x: 682, y: 296 },
  nodes: {
    wood: { x: 182, y: 212, spread: 34 },
    food: { x: 262, y: 340, spread: 32 },
    stone: { x: 770, y: 140, spread: 30 },
  },
  plots: [
    { x: 360, y: 140 }, { x: 580, y: 140 }, { x: 330, y: 230 }, { x: 612, y: 230 },
    { x: 375, y: 322 }, { x: 565, y: 322 }, { x: 470, y: 104 }, { x: 470, y: 340 },
  ],
  plotW: 74,
  plotH: 54,
};

const rnd = () => new Phaser.Math.RandomDataGenerator(['frontier-dusk']);

/** Static map: ground, paths, forest, fields, quarry, plaza. Returns torch glows for later tinting. */
export function drawMap(scene: Phaser.Scene): { torches: Phaser.GameObjects.Image[]; fire: Phaser.GameObjects.Image } {
  const r = rnd();
  const g = scene.add.graphics().setDepth(-10);
  const L = -OVER, T = -OVER, R = WORLD_W + OVER, B = WORLD_H + OVER;

  // Dusk ground
  g.fillGradientStyle(0x1b2a24, 0x1b2a24, 0x263222, 0x263222, 1);
  g.fillRect(L, T, R - L, B - T);
  for (let i = 0; i < 160; i++) {
    const x = r.between(L, R), y = r.between(T, B);
    g.fillStyle(r.pick([0x2f3d27, 0x1a2620, 0x34422a, 0x223127]), r.realInRange(0.25, 0.6));
    g.fillEllipse(x, y, r.between(40, 140), r.between(16, 50));
  }
  // Warm dusk light pooling around the town
  const warm = scene.add.image(MAP.town.x, MAP.town.y + 30, 'fr_glow').setDepth(-9).setTint(0xffa850).setAlpha(0.22).setScale(6.5, 4.2);
  warm.setBlendMode(Phaser.BlendModes.ADD);

  // Paths
  const path = (pts: [number, number][], w = 16) => {
    const curve = new Phaser.Curves.Spline(pts.map(([x, y]) => new Phaser.Math.Vector2(x, y)));
    const p = curve.getPoints(48);
    g.lineStyle(w + 6, 0x3a2c1c, 0.5); g.strokePoints(p);
    g.lineStyle(w, 0x6e5536, 0.75); g.strokePoints(p);
    g.lineStyle(w * 0.35, 0x8d7048, 0.45); g.strokePoints(p);
  };
  path([[470, 250], [600, 285], [720, 302], [900, 308], [R, 312]], 20); // raider road
  path([[440, 240], [330, 220], [230, 214], [170, 212]]);
  path([[450, 258], [360, 300], [280, 330]]);
  path([[500, 230], [640, 175], [760, 145]]);

  // Fields
  const fx = 196, fy = 300, fw = 128, fh = 78;
  g.fillStyle(0x3b2a18, 1); g.fillRoundedRect(fx, fy, fw, fh, 6);
  for (let i = 0; i < 7; i++) {
    const y = fy + 8 + i * 10;
    g.fillStyle(0x5a4224, 1); g.fillRect(fx + 6, y, fw - 12, 5);
    for (let x = fx + 9; x < fx + fw - 8; x += 7) {
      g.fillStyle(r.pick([0xc9a640, 0xd8b44a, 0xa98a34]), 1);
      g.fillTriangle(x, y + 4, x + 2.5, y - 4, x + 5, y + 4);
    }
  }
  g.lineStyle(2, 0x6b4a2e, 1); g.strokeRoundedRect(fx, fy, fw, fh, 6);

  // Quarry: a pale bowl with cliffs, extends off the top-right
  g.fillStyle(0x3d3f45, 1); g.fillEllipse(800, 110, 300, 150);
  g.fillStyle(0x50535b, 1); g.fillEllipse(790, 122, 210, 92);
  g.fillStyle(0x666a73, 1); g.fillEllipse(780, 132, 130, 48);
  g.fillStyle(0x2c2e33, 1); g.fillEllipse(890, 40, 260, 110);
  for (let i = 0; i < 9; i++) {
    const x = r.between(700, 900), y = r.between(80, 175);
    scene.add.image(x, y, 'fr_rock').setScale(r.realInRange(0.25, 0.42)).setDepth(y);
  }
  for (let i = 0; i < 30; i++) {
    const x = r.between(840, R), y = r.between(T, 70);
    scene.add.image(x, y, 'fr_rock').setScale(r.realInRange(0.4, 0.8)).setDepth(y);
  }

  // Forest: dense on the left, a ring of trees around the whole map
  const tree = (x: number, y: number, s = 1) => {
    const key = r.pick(['fr_tree0', 'fr_tree1', 'fr_tree1']);
    scene.add.image(x, y, key).setOrigin(0.5, 0.92).setScale((s * r.realInRange(0.28, 0.4))).setDepth(y);
  };
  for (let i = 0; i < 260; i++) {
    const x = r.between(L, 150), y = r.between(T, B);
    if (x > 120 && Math.abs(y - 212) < 40) continue;
    tree(x, y, x > 60 ? 1 : 1.25);
  }
  for (let i = 0; i < 40; i++) tree(r.between(150, 200), r.between(70, 170));
  for (let i = 0; i < 30; i++) tree(r.between(150, 190), r.between(250, 290));
  for (let i = 0; i < 70; i++) tree(r.between(150, 700), r.between(T, 70), 1.2);
  for (let i = 0; i < 60; i++) tree(r.between(L, R), r.between(WORLD_H + 10, B), 1.2);
  for (let i = 0; i < 60; i++) {
    const x = r.between(870, R), y = r.between(180, B);
    if (Math.abs(y - 310) < 30) continue;
    tree(x, y, 1.1);
  }
  // Felled logs at the forest edge
  for (const [x, y] of [[196, 236], [205, 196]] as const) scene.add.image(x, y, 'fr_wood').setScale(0.4).setDepth(y);

  // Plaza with a neon cyan ring, the arcade's mark
  g.fillStyle(0x4a3a28, 0.55); g.fillEllipse(MAP.town.x, MAP.town.y + 30, 260, 150);
  g.lineStyle(1.5, 0x3ee6ff, 0.35); g.strokeEllipse(MAP.town.x, MAP.town.y + 30, 270, 160);
  g.lineStyle(6, 0x3ee6ff, 0.06); g.strokeEllipse(MAP.town.x, MAP.town.y + 30, 274, 164);

  // Plot pads
  for (const p of MAP.plots) {
    g.fillStyle(0x2a2218, 0.6);
    g.fillRoundedRect(p.x - MAP.plotW / 2, p.y - MAP.plotH / 2, MAP.plotW, MAP.plotH, 6);
  }

  // Torches along the road and plaza
  const torches: Phaser.GameObjects.Image[] = [];
  for (const [x, y] of [[640, 262], [640, 330], [720, 270], [720, 334], [400, 186], [540, 186], [866, 290], [866, 334]] as const) {
    g.fillStyle(0x3d2a1a, 1); g.fillRect(x - 1.5, y - 12, 3, 14);
    g.fillStyle(0xffc860, 1); g.fillCircle(x, y - 13, 2.4);
    const t = scene.add.image(x, y - 13, 'fr_glow').setTint(0xffa040).setScale(0.5).setAlpha(0.8).setDepth(y + 1);
    t.setBlendMode(Phaser.BlendModes.ADD);
    torches.push(t);
  }

  // Fire pit
  g.fillStyle(0x2a2420, 1); g.fillCircle(MAP.fire.x, MAP.fire.y, 9);
  g.fillStyle(0x6a5d50, 1);
  for (let a = 0; a < 8; a++) g.fillCircle(MAP.fire.x + Math.cos(a * 0.785) * 9, MAP.fire.y + Math.sin(a * 0.785) * 7, 2.4);
  g.fillStyle(0xff8a2a, 1); g.fillTriangle(MAP.fire.x - 5, MAP.fire.y + 2, MAP.fire.x, MAP.fire.y - 10, MAP.fire.x + 5, MAP.fire.y + 2);
  g.fillStyle(0xffe08a, 1); g.fillTriangle(MAP.fire.x - 2.5, MAP.fire.y + 2, MAP.fire.x, MAP.fire.y - 5, MAP.fire.x + 2.5, MAP.fire.y + 2);
  const fire = scene.add.image(MAP.fire.x, MAP.fire.y - 3, 'fr_glow').setTint(0xff9a3a).setScale(1.1).setAlpha(0.9).setDepth(MAP.fire.y + 1);
  fire.setBlendMode(Phaser.BlendModes.ADD);

  // Area labels
  // Bake the static drawing once: a Graphics object is re-tessellated every frame
  const RES_MUL = 1.5;
  const rt = scene.add.renderTexture(L, T, (R - L) * RES_MUL, (B - T) * RES_MUL).setOrigin(0).setScale(1 / RES_MUL).setDepth(-10);
  g.setScale(RES_MUL);
  rt.draw(g, -L * RES_MUL, -T * RES_MUL);
  g.destroy();

  const sign = (x: number, y: number, text: string) => {
    const t = scene.add.text(x, y, text, { fontFamily: '"DM Mono", monospace', fontSize: '12px', color: '#c4d0e6' })
      .setOrigin(0.5).setDepth(800).setAlpha(0.85);
    t.setShadow(0, 1, '#000000', 4, true, true);
  };
  sign(178, 178, 'FOREST');
  sign(260, 292, 'FIELDS');
  sign(770, 86, 'QUARRY');
  sign(800, 360, 'RAIDER ROAD');

  return { torches, fire };
}

/** Town hall in the middle of the plaza. */
export function drawTownHall(scene: Phaser.Scene): Phaser.GameObjects.Container {
  const { x, y } = MAP.town;
  const c = scene.add.container(x, y).setDepth(y + 30);
  const g = scene.add.graphics();
  g.fillStyle(0x000000, 0.35); g.fillEllipse(0, 34, 110, 18);
  // Walls
  g.fillStyle(0x7a4d30, 1); g.fillRect(-44, -6, 88, 40);
  g.fillStyle(0x5e3a24, 1); g.fillRect(-44, 22, 88, 12);
  g.lineStyle(1, 0x4a2c1a, 0.7);
  for (let i = 0; i < 4; i++) g.lineBetween(-44, i * 9 - 2, 44, i * 9 - 2);
  // Roof
  g.fillStyle(0x5a2622, 1); g.fillTriangle(-54, -4, 0, -40, 54, -4);
  g.fillStyle(0x7c3530, 1); g.fillTriangle(-54, -4, 0, -40, 0, -4);
  g.fillStyle(0xffffff, 0.08); g.fillTriangle(-44, -8, 0, -36, -10, -8);
  // Door
  g.fillStyle(0x2a1810, 1); g.fillRoundedRect(-9, 12, 18, 22, { tl: 9, tr: 9, bl: 0, br: 0 });
  g.fillStyle(0xffb347, 0.9); g.fillRoundedRect(-6, 16, 12, 18, { tl: 6, tr: 6, bl: 0, br: 0 });
  // Windows
  g.fillStyle(0xffc860, 1);
  for (const wx of [-33, -21, 15, 27]) g.fillRect(wx, 2, 7, 9);
  g.fillStyle(0xfff1c0, 1); g.fillCircle(0, -18, 4);
  c.add(g);
  for (const [wx, wy, s] of [[-26, 6, 0.5], [21, 6, 0.5], [0, 22, 0.6], [0, -18, 0.3]] as const) {
    const gl = scene.add.image(wx, wy, 'fr_glow').setTint(0xffb050).setScale(s).setAlpha(0.8);
    gl.setBlendMode(Phaser.BlendModes.ADD);
    c.add(gl);
  }
  // Neon sign
  const t = scene.add.text(0, -50, 'TOWN', { fontFamily: '"Bungee", sans-serif', fontSize: '13px', color: '#3ee6ff' }).setOrigin(0.5);
  t.setShadow(0, 0, '#3ee6ff', 10, true, true);
  c.add(t);
  return c;
}

/** Draws one finished building centred on (0,0) of a plot. */
export function drawBuilding(g: Phaser.GameObjects.Graphics, kind: BuildKind): void {
  if (kind === 'farm') {
    // Crop patch
    g.fillStyle(0x3b2a18, 1); g.fillRoundedRect(-34, 4, 68, 20, 3);
    for (let i = 0; i < 3; i++) {
      g.fillStyle(0x5a4224, 1); g.fillRect(-31, 7 + i * 6, 62, 3);
      for (let x = -30; x < 30; x += 6) { g.fillStyle(0xd8b44a, 1); g.fillTriangle(x, 10 + i * 6, x + 2, 4 + i * 6, x + 4, 10 + i * 6); }
    }
    // Barn
    g.fillStyle(0x000000, 0.3); g.fillEllipse(-8, 6, 44, 8);
    g.fillStyle(0x9c3f2a, 1); g.fillRect(-24, -14, 32, 20);
    g.fillStyle(0x5e2318, 1); g.fillTriangle(-28, -13, -8, -28, 12, -13);
    g.fillStyle(0xf4e3c8, 1); g.fillRect(-13, -6, 10, 12);
    g.lineStyle(1, 0x9c3f2a, 1); g.lineBetween(-13, -6, -3, 6); g.lineBetween(-3, -6, -13, 6);
    g.fillStyle(0xffc860, 1); g.fillRect(-21, -10, 5, 5);
    // Silo
    g.fillStyle(0xb9b2a4, 1); g.fillRect(14, -18, 12, 24);
    g.fillStyle(0x8a8478, 1); g.fillEllipse(20, -18, 12, 7);
  } else if (kind === 'palisade') {
    g.fillStyle(0x000000, 0.3); g.fillEllipse(0, 20, 72, 10);
    for (let i = 0; i < 11; i++) {
      const x = -32 + i * 6.4;
      const h = 30 + (i % 2) * 5;
      g.fillStyle(i % 2 ? 0x6b4a2e : 0x7d5836, 1);
      g.fillRect(x - 2.6, 18 - h, 5.2, h);
      g.fillTriangle(x - 2.6, 18 - h, x, 12 - h, x + 2.6, 18 - h);
    }
    g.fillStyle(0x4a3220, 1); g.fillRect(-34, 0, 68, 3); g.fillRect(-34, 10, 68, 3);
    // Shield crest
    g.fillStyle(0x3ee6ff, 0.9); g.fillCircle(0, -4, 5);
    g.fillStyle(0x0f5d73, 1); g.fillCircle(0, -4, 2.5);
  } else {
    g.fillStyle(0x000000, 0.3); g.fillEllipse(0, 22, 40, 8);
    g.lineStyle(3, 0x6b4a2e, 1);
    g.lineBetween(-12, 22, -7, -20); g.lineBetween(12, 22, 7, -20);
    g.lineStyle(1.5, 0x5a3c22, 1);
    g.lineBetween(-11, 14, 10, 2); g.lineBetween(11, 14, -10, 2); g.lineBetween(-9, -2, 8, -14); g.lineBetween(9, -2, -8, -14);
    g.fillStyle(0x7d5836, 1); g.fillRect(-13, -30, 26, 12);
    g.fillStyle(0x5a2622, 1); g.fillTriangle(-16, -29, 0, -42, 16, -29);
    g.fillStyle(0xffc860, 1); g.fillRect(-4, -27, 8, 6);
  }
}

/** Scaffolding drawn while a building is under construction. */
export function drawScaffold(g: Phaser.GameObjects.Graphics, p: number): void {
  g.lineStyle(1.5, 0x3ee6ff, 0.5);
  g.strokeRoundedRect(-30, -22, 60, 44, 4);
  g.fillStyle(0x7d5836, 1);
  const n = Math.max(1, Math.round(p * 6));
  for (let i = 0; i < n; i++) g.fillRect(-26 + i * 9, 18 - 30 * Math.min(1, p * 1.4), 3, 30 * Math.min(1, p * 1.4));
  g.fillStyle(0x5a3c22, 1);
  g.fillRect(-28, 12, 56, 3);
  if (p > 0.4) g.fillRect(-28, -2, 56, 3);
  // Material pile
  g.fillStyle(0x8f5a2e, 1); g.fillRoundedRect(14, 12, 14, 5, 2); g.fillRoundedRect(16, 8, 12, 5, 2);
}
