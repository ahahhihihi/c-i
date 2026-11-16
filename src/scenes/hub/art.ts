/**
 * Museum hall art. Static parts are painted once into textures (canvas
 * renderer, supersampled), so the hall costs almost nothing per frame.
 */
import Phaser from 'phaser';
import { makeSim, type SimLook } from '../../sims';
import { WINGS, HALL_W, type Wing } from '../../data/museum';

/** Wall occupies y < FLOOR_Y. Things stand on the wall line at WALL_LINE. */
export const FLOOR_Y = 250;
export const WALL_LINE = 296;
/** Painted area extends past the 520px view for tall screens. */
export const TOP = -160;
export const BOTTOM = 760;

const S = 2; // wall supersampling

/** Graphics wrapper that offsets every coordinate, so one painter can fill many textures. */
export class Pen {
  constructor(public g: Phaser.GameObjects.Graphics, public ox = 0, public oy = 0) {}
  fill(c: number, a = 1): this { this.g.fillStyle(c, a); return this; }
  line(w: number, c: number, a = 1): this { this.g.lineStyle(w, c, a); return this; }
  rect(x: number, y: number, w: number, h: number): this { this.g.fillRect(x - this.ox, y - this.oy, w, h); return this; }
  srect(x: number, y: number, w: number, h: number): this { this.g.strokeRect(x - this.ox, y - this.oy, w, h); return this; }
  rr(x: number, y: number, w: number, h: number, r: number): this { this.g.fillRoundedRect(x - this.ox, y - this.oy, w, h, r); return this; }
  srr(x: number, y: number, w: number, h: number, r: number): this { this.g.strokeRoundedRect(x - this.ox, y - this.oy, w, h, r); return this; }
  circle(x: number, y: number, r: number): this { this.g.fillCircle(x - this.ox, y - this.oy, r); return this; }
  scircle(x: number, y: number, r: number): this { this.g.strokeCircle(x - this.ox, y - this.oy, r); return this; }
  ellipse(x: number, y: number, w: number, h: number): this { this.g.fillEllipse(x - this.ox, y - this.oy, w, h); return this; }
  tri(x1: number, y1: number, x2: number, y2: number, x3: number, y3: number): this {
    this.g.fillTriangle(x1 - this.ox, y1 - this.oy, x2 - this.ox, y2 - this.oy, x3 - this.ox, y3 - this.oy); return this;
  }
  seg(x1: number, y1: number, x2: number, y2: number): this { this.g.lineBetween(x1 - this.ox, y1 - this.oy, x2 - this.ox, y2 - this.oy); return this; }
  /** Vertical gradient using bands (canvas graphics have no gradients). */
  vgrad(x: number, y: number, w: number, h: number, top: number, bottom: number, bands = 24): this {
    const a = Phaser.Display.Color.IntegerToColor(top), b = Phaser.Display.Color.IntegerToColor(bottom);
    for (let i = 0; i < bands; i++) {
      const t = i / (bands - 1);
      const c = Phaser.Display.Color.GetColor(a.red + (b.red - a.red) * t, a.green + (b.green - a.green) * t, a.blue + (b.blue - a.blue) * t);
      this.fill(c, 1).rect(x, y + (h * i) / bands, w, h / bands + 1);
    }
    return this;
  }
  /** Neon tube: wide faint halo, then a bright core. */
  neon(x1: number, y1: number, x2: number, y2: number, c: number, w = 3): this {
    this.line(w * 7, c, 0.05).seg(x1, y1, x2, y2);
    this.line(w * 3.5, c, 0.14).seg(x1, y1, x2, y2);
    this.line(w, c, 1).seg(x1, y1, x2, y2);
    this.line(Math.max(1, w * 0.35), 0xffffff, 0.8).seg(x1, y1, x2, y2);
    return this;
  }
  neonBox(x: number, y: number, w: number, h: number, r: number, c: number, lw = 3): this {
    this.line(lw * 7, c, 0.05).srr(x, y, w, h, r);
    this.line(lw * 3.5, c, 0.14).srr(x, y, w, h, r);
    this.line(lw, c, 1).srr(x, y, w, h, r);
    this.line(Math.max(1, lw * 0.35), 0xffffff, 0.7).srr(x, y, w, h, r);
    return this;
  }
  /** Soft round glow made of stacked translucent circles. */
  glow(x: number, y: number, r: number, c: number, a = 0.25): this {
    for (let i = 6; i >= 1; i--) this.fill(c, (a / 6) * (7 - i) * 0.35).ellipse(x, y, (r * 2 * i) / 6, (r * 2 * i) / 6);
    return this;
  }
}

function shade(c: number, amt: number): number {
  const k = Phaser.Display.Color.IntegerToColor(c);
  const f = (v: number) => Phaser.Math.Clamp(Math.round(v + amt), 0, 255);
  return Phaser.Display.Color.GetColor(f(k.red), f(k.green), f(k.blue));
}

/** Paint a region into a texture and place it in the world. */
function bake(scene: Phaser.Scene, key: string, x0: number, y0: number, w: number, h: number, scale: number, paint: (p: Pen) => void, depth = 0): Phaser.GameObjects.Image {
  if (!scene.textures.exists(key)) {
    const g = scene.add.graphics().setScale(scale);
    paint(new Pen(g, x0, y0));
    g.generateTexture(key, Math.ceil(w * scale), Math.ceil(h * scale));
    g.destroy();
  }
  return scene.add.image(x0, y0, key).setOrigin(0).setScale(1 / scale).setDepth(depth);
}

/* ------------------------------------------------------------------ */
/* Wall                                                                */
/* ------------------------------------------------------------------ */

function paintWall(p: Pen, x0: number, x1: number): void {
  // Base wall, per wing tint
  for (const w of WINGS) {
    const a = Math.max(x0, w.x0), b = Math.min(x1, w.x1);
    if (a >= b) continue;
    const tint = w.id === 'backstage' ? 0x08121a : 0x0c0919;
    p.vgrad(a, TOP, b - a, FLOOR_Y - TOP, 0x040309, shade(tint, 8), 30);

    // Vertical panel seams and soft wash of the wing colour near the floor
    for (let x = Math.ceil(a / 44) * 44; x < b; x += 44) p.fill(0xffffff, 0.025).rect(x, TOP, 1.2, FLOOR_Y - TOP);
    p.fill(w.color, 0.05).rect(a, FLOOR_Y - 90, b - a, 90);
    p.fill(w.color, 0.05).rect(a, FLOOR_Y - 40, b - a, 40);

    // Ceiling truss
    p.fill(0x000000, 0.6).rect(a, TOP, b - a, 70);
    p.line(2, 0x2a2440, 1);
    for (let x = Math.ceil(a / 60) * 60; x < b; x += 60) { p.seg(x, TOP + 50, x + 30, TOP + 70); p.seg(x + 30, TOP + 70, x + 60, TOP + 50); }
    p.fill(0x2a2440, 1).rect(a, TOP + 48, b - a, 3).rect(a, TOP + 70, b - a, 3);

    // Baseboard neon
    p.fill(0x05040b, 1).rect(a, FLOOR_Y - 6, b - a, 10);
    p.neon(a, FLOOR_Y - 2, b, FLOOR_Y - 2, w.color, 2);
  }

  // Wing dividers: tall pillars with neon tubes
  for (const w of WINGS) {
    if (w.x0 === 0 || w.x0 < x0 - 40 || w.x0 > x1 + 40) continue;
    const x = w.x0;
    p.vgrad(x - 18, TOP, 36, FLOOR_Y - TOP + 6, 0x0a0814, 0x1a1530, 20);
    p.fill(0x000000, 0.35).rect(x + 12, TOP, 6, FLOOR_Y - TOP + 6);
    p.neon(x - 9, TOP + 80, x - 9, FLOOR_Y - 12, WINGS[WINGS.indexOf(w) - 1].color, 2.2);
    p.neon(x + 9, TOP + 80, x + 9, FLOOR_Y - 12, w.color, 2.2);
    p.fill(0x221c3a, 1).rr(x - 24, FLOOR_Y - 8, 48, 14, 3);
  }
}

/** Shopfront recreating a real venue, sitting on the wall line. */
function paintFacade(p: Pen, x: number, w: number, color: number, kind: 'skill' | 'time' | 'speed'): void {
  const top = 138, bottom = FLOOR_Y + 2;
  // Frame and sign band
  p.fill(0x000000, 0.45).rr(x + 4, top + 6, w, bottom - top, 6);
  p.fill(0x120e22, 1).rr(x, top, w, bottom - top, 6);
  p.fill(0x07060d, 1).rect(x + 6, top + 6, w - 12, 26);
  // Awning
  const ay = top + 34;
  const stripes = Math.floor(w / 20);
  for (let i = 0; i < stripes; i++) {
    p.fill(i % 2 ? color : shade(color, -90), 1).rect(x + 4 + i * ((w - 8) / stripes), ay, (w - 8) / stripes + 0.5, 14);
    p.fill(i % 2 ? color : shade(color, -90), 1).tri(
      x + 4 + i * ((w - 8) / stripes), ay + 14,
      x + 4 + (i + 1) * ((w - 8) / stripes), ay + 14,
      x + 4 + (i + 0.5) * ((w - 8) / stripes), ay + 22);
  }
  // Window with a peek inside
  const wy = ay + 26, wh = bottom - wy - 6;
  p.fill(0x05040a, 1).rect(x + 10, wy, w - 20, wh);
  p.fill(color, 0.08).rect(x + 10, wy, w - 20, wh);
  if (kind === 'skill') {
    // Rows of fighting cabinets, screens lit
    for (let i = 0; i < 5; i++) {
      const cx = x + 24 + i * ((w - 48) / 4);
      p.fill(0x1b1630, 1).rr(cx - 13, wy + 10, 26, wh - 10, 3);
      p.fill(i % 2 ? 0x3ee6ff : 0xffb347, 0.75).rect(cx - 9, wy + 15, 18, 13);
      p.fill(0xff4d6d, 1).circle(cx - 5, wy + 34, 2);
      p.fill(0xffffff, 0.7).circle(cx + 3, wy + 34, 1.6).circle(cx + 8, wy + 34, 1.6);
    }
  } else if (kind === 'time') {
    // Marble pushers and a carousel horse silhouette
    for (let i = 0; i < 3; i++) {
      const cx = x + 40 + i * ((w - 80) / 2);
      p.fill(0x1f1638, 1).rr(cx - 22, wy + 8, 44, wh - 8, 4);
      p.fill(0xa47bff, 0.5).rect(cx - 18, wy + 12, 36, 20);
      for (let m = 0; m < 9; m++) p.fill(0xe8e6ff, 0.9).circle(cx - 14 + (m % 5) * 7, wy + 18 + Math.floor(m / 5) * 7, 2);
    }
  } else {
    // Claw machines in a row, glowing pink and cyan
    for (let i = 0; i < 4; i++) {
      const cx = x + 30 + i * ((w - 60) / 3);
      const c = i % 2 ? 0x3ee6ff : 0xff4fd8;
      p.fill(0x1a1030, 1).rect(cx - 16, wy + 6, 32, wh - 6);
      p.fill(c, 0.25).rect(cx - 13, wy + 9, 26, 26);
      p.line(1.5, c, 1).srect(cx - 13, wy + 9, 26, 26);
      p.fill(0xffc6e8, 1).circle(cx - 6, wy + 30, 4);
      p.fill(0xbfe8ff, 1).circle(cx + 4, wy + 31, 4);
      p.line(1, 0xdddddd, 1).seg(cx, wy + 9, cx, wy + 18);
    }
  }
  // Glass reflections
  p.fill(0xffffff, 0.06).tri(x + 10, wy, x + 60, wy, x + 10, wy + wh);
  p.fill(0xffffff, 0.04).tri(x + w - 80, wy, x + w - 50, wy, x + w - 110, wy + wh);
  p.neonBox(x, top, w, bottom - top, 6, color, 1.6);
}

/** A wall screen (content is drawn live on top). */
function paintMonitor(p: Pen, x: number, y: number, w: number, h: number, color: number): void {
  p.fill(0x000000, 0.5).rr(x + 4, y + 6, w, h, 6);
  p.fill(0x05040a, 1).rr(x, y, w, h, 6);
  p.fill(color, 0.07).rr(x + 6, y + 6, w - 12, h - 12, 3);
  p.line(1, 0xffffff, 0.04);
  for (let yy = y + 8; yy < y + h - 6; yy += 3) p.seg(x + 6, yy, x + w - 6, yy);
  p.neonBox(x, y, w, h, 6, color, 1.4);
  // Wall mount
  p.fill(0x1a1530, 1).rect(x + w / 2 - 8, y + h, 16, FLOOR_Y - y - h);
}

export function buildHall(scene: Phaser.Scene): void {
  // Wall: baked in chunks
  const CH = 880;
  for (let x0 = 0, i = 0; x0 < HALL_W; x0 += CH, i++) {
    const x1 = Math.min(HALL_W, x0 + CH);
    bake(scene, `hall_wall_${i}`, x0, TOP, x1 - x0, FLOOR_Y + 10 - TOP, S, (p) => {
      paintWall(p, x0 - 40, x1 + 40);
      for (const w of WINGS) {
        if (w.id === 'skill' || w.id === 'time' || w.id === 'speed') {
          const fx = w.x0 + 40;
          if (fx < x1 && fx + 250 > x0) paintFacade(p, fx, 250, w.color, w.id);
        }
      }
      // Wing A data screen, backstage license wall
      if (1430 < x1 && 1610 > x0) paintMonitor(p, 1430, 140, 180, 92, 0xffb347);
      if (3640 < x1 && 3880 > x0) paintMonitor(p, 3650, 140, 200, 92, 0x2de2b0);
      // Exit: conclusion wall and door
      if (4000 < x1 && 4400 > x0) {
        p.fill(0x000000, 0.4).rr(4006, 136, 262, 104, 8);
        p.fill(0x0a0816, 1).rr(4002, 132, 262, 104, 8);
        p.neonBox(4002, 132, 262, 104, 8, 0xffd078, 1.6);
        // Door
        p.fill(0x050409, 1).rr(4296, 150, 74, FLOOR_Y - 148, 4);
        p.fill(0x2de2b0, 0.08).rr(4300, 154, 66, FLOOR_Y - 156, 3);
        p.line(2, 0x1a1530, 1).seg(4333, 154, 4333, FLOOR_Y);
        p.fill(0xc9c5e6, 1).rect(4326, 200, 3, 12).rect(4337, 200, 3, 12);
        p.neonBox(4296, 150, 74, FLOOR_Y - 148, 4, 0x2de2b0, 1.4);
        p.fill(0x0a2a1c, 1).rr(4302, 124, 62, 20, 3);
      }
      // Entrance: fieldwork map frame
      if (560 < x1 && 740 > x0) paintMonitor(p, 560, 140, 170, 92, 0xffd078);
    }, 1);
  }

  // Floor: one carpet tile per wing
  for (const w of WINGS) {
    const key = `carpet_${w.id}`;
    if (!scene.textures.exists(key)) makeCarpet(scene, key, w);
    scene.add.tileSprite(w.x0, FLOOR_Y, w.x1 - w.x0, BOTTOM - FLOOR_Y, key).setOrigin(0).setTileScale(1 / 3).setDepth(0);
  }

  // Floor shading: dark at the wall, glossy reflection band, and darker toward the viewer
  bake(scene, 'hall_floor_shade', 0, FLOOR_Y, 400, BOTTOM - FLOOR_Y, 1, (p) => {
    for (let i = 0; i < 30; i++) p.fill(0x000000, 0.55 * (1 - i / 30)).rect(0, FLOOR_Y + i * 2, 400, 2);
    for (let i = 0; i < 40; i++) p.fill(0x000000, (i / 40) * 0.35).rect(0, 470 + i * 7, 400, 7);
  }, 2).setDisplaySize(HALL_W, BOTTOM - FLOOR_Y);

  // Neon reflections on the floor under each wing's baseboard
  for (const w of WINGS) {
    const r = scene.add.rectangle(w.x0, FLOOR_Y + 2, w.x1 - w.x0, 16, w.color, 0.13).setOrigin(0).setDepth(2);
    r.setBlendMode(Phaser.BlendModes.ADD);
  }
}

/* ------------------------------------------------------------------ */
/* Carpet: the classic arcade-carpet confetti pattern                  */
/* ------------------------------------------------------------------ */

function makeCarpet(scene: Phaser.Scene, key: string, wing: Wing): void {
  const T = 160, K = 3;
  const g = scene.add.graphics().setScale(K);
  const p = new Pen(g);
  const base = wing.id === 'backstage' ? 0x0b1418 : 0x0d0a1e;
  p.fill(base, 1).rect(0, 0, T, T);
  if (wing.id === 'backstage') {
    // Concrete with a painted walkway
    for (let i = 0; i < 60; i++) p.fill(0xffffff, 0.03).circle((i * 53) % T, (i * 97) % T, 1 + (i % 3));
    p.fill(0x2de2b0, 0.08).rect(0, 70, T, 2).rect(0, 120, T, 2);
    for (let x = 0; x < T; x += 20) p.fill(0x2de2b0, 0.06).tri(x, 72, x + 10, 72, x + 5, 80);
  } else {
    const palette = {
      entrance: [0xffd078, 0x3ee6ff, 0xff4fd8],
      skill: [0xffb347, 0x3ee6ff, 0xff4d6d],
      time: [0xa47bff, 0x2de2b0, 0xffd078],
      speed: [0xff4fd8, 0x3ee6ff, 0xffd078],
      exit: [0xffd078, 0xa47bff, 0x2de2b0],
    }[wing.id as 'entrance'] ?? [0xffd078, 0x3ee6ff, 0xff4fd8];
    // Deterministic pseudo-random confetti
    let seed = wing.x0 + 7;
    const rnd = () => { seed = (seed * 9301 + 49297) % 233280; return seed / 233280; };
    for (let i = 0; i < 38; i++) {
      const x = rnd() * T, y = rnd() * T, c = palette[i % 3], a = 0.55 + rnd() * 0.35, s = 4 + rnd() * 6;
      const kind = i % 4;
      p.fill(c, a);
      if (kind === 0) p.circle(x, y, s * 0.45);
      else if (kind === 1) p.tri(x, y - s * 0.6, x + s * 0.6, y + s * 0.5, x - s * 0.6, y + s * 0.5);
      else if (kind === 2) { p.line(2, c, a); p.g.beginPath(); p.g.moveTo(x - s, y); for (let k = 1; k <= 4; k++) p.g.lineTo(x - s + (k * s) / 2, y + (k % 2 ? -s * 0.4 : s * 0.4)); p.g.strokePath(); }
      else { p.line(1.6, c, a); p.scircle(x, y, s * 0.5); }
    }
    // Tiny stars
    for (let i = 0; i < 30; i++) p.fill(0xffffff, 0.15 + rnd() * 0.2).circle(rnd() * T, rnd() * T, 0.6);
  }
  g.generateTexture(key, T * K, T * K);
  g.destroy();
}

/* ------------------------------------------------------------------ */
/* Station props                                                       */
/* ------------------------------------------------------------------ */

function prop(scene: Phaser.Scene, key: string, w: number, h: number, paint: (p: Pen) => void, scale = 3): void {
  if (scene.textures.exists(key)) return;
  const g = scene.add.graphics().setScale(scale);
  paint(new Pen(g));
  g.generateTexture(key, w * scale, h * scale);
  g.destroy();
}

export function makeProps(scene: Phaser.Scene): void {
  // Claw machine (hub version) 84x160
  prop(scene, 'hub_claw', 84, 160, (p) => {
    p.fill(0x000000, 0.35).ellipse(42, 156, 80, 10);
    p.fill(0x1a0f2e, 1).rr(4, 18, 76, 136, 6);
    p.fill(0xff4fd8, 1).rr(2, 2, 80, 22, 6);
    p.fill(0xffffff, 0.35).rr(6, 5, 72, 6, 3);
    p.fill(0x07050d, 1).rect(10, 28, 64, 80);
    p.fill(0x3ee6ff, 0.12).rect(10, 28, 64, 80);
    // Gantry and claw
    p.fill(0xcfd3e6, 1).rect(10, 32, 64, 3).rect(40, 35, 3, 22);
    p.line(2, 0xcfd3e6, 1).seg(41, 57, 34, 66).seg(42, 57, 49, 66);
    // Plush pile
    const plush = [0xffb5d8, 0xbfe8ff, 0xfff2a8, 0xc9b5ff, 0xb5ffd9, 0xffc9a8];
    for (let i = 0; i < 11; i++) {
      const x = 16 + (i * 13) % 54, y = 96 - Math.floor(i / 5) * 10 + (i % 2) * 3;
      p.fill(plush[i % plush.length], 1).circle(x, y, 7);
      p.fill(plush[i % plush.length], 1).circle(x - 4, y - 6, 2.6).circle(x + 4, y - 6, 2.6);
      p.fill(0x2a1a2e, 1).circle(x - 2.5, y - 1, 1).circle(x + 2.5, y - 1, 1);
    }
    p.fill(0xffffff, 0.12).tri(10, 28, 34, 28, 10, 80);
    p.line(2, 0x3ee6ff, 1).srect(10, 28, 64, 80);
    // Panel, chute, QR
    p.fill(0x2a1846, 1).rr(8, 112, 68, 22, 4);
    p.fill(0x111111, 1).circle(24, 123, 6);
    p.fill(0xff4d6d, 1).circle(24, 121, 4);
    p.fill(0xff4fd8, 1).circle(56, 123, 6);
    p.fill(0xffffff, 1).rr(30, 137, 22, 14, 2);
    for (let i = 0; i < 14; i++) p.fill(0x111111, 1).rect(32 + (i * 7) % 18, 139 + Math.floor(i / 3) * 2.4, 2.4, 2);
    p.fill(0x07050d, 1).rect(60, 136, 14, 14);
  });

  // Marble pusher 120x140
  prop(scene, 'hub_marbles', 120, 140, (p) => {
    p.fill(0x000000, 0.35).ellipse(60, 136, 116, 10);
    p.fill(0x1c1336, 1).rr(4, 14, 112, 120, 8);
    p.fill(0xa47bff, 1).rr(2, 0, 116, 22, 8);
    p.fill(0xffffff, 0.3).rr(8, 4, 104, 5, 2);
    // Tiers
    p.fill(0x07050d, 1).rect(12, 28, 96, 72);
    p.fill(0xa47bff, 0.12).rect(12, 28, 96, 72);
    for (let t = 0; t < 3; t++) {
      p.fill(0x6b4fb8, 1).rect(14 + t * 6, 50 + t * 18, 92 - t * 12, 5);
      for (let m = 0; m < 13 - t * 3; m++) p.fill(0xe8e6ff, 1).circle(20 + t * 6 + m * 7, 46 + t * 18, 3);
    }
    p.fill(0xffffff, 0.12).tri(12, 28, 40, 28, 12, 90);
    p.line(2, 0xa47bff, 1).srect(12, 28, 96, 72);
    // Tray and counter
    p.fill(0x2a1e4a, 1).rr(10, 104, 100, 24, 5);
    p.fill(0x07050d, 1).rr(14, 110, 50, 12, 3);
    for (let m = 0; m < 9; m++) p.fill(0xd8d4f0, 1).circle(20 + m * 5, 116, 2.4);
    p.fill(0x05040a, 1).rr(70, 108, 42, 16, 3);
  });

  // Receipt kiosk 70x130
  prop(scene, 'hub_kiosk', 70, 130, (p) => {
    p.fill(0x000000, 0.35).ellipse(35, 126, 66, 9);
    p.fill(0x1a1530, 1).rr(10, 40, 50, 86, 6);
    p.fill(0x2a2448, 1).rr(4, 10, 62, 40, 6);
    p.fill(0x05040a, 1).rr(10, 16, 50, 24, 3);
    p.fill(0xffd078, 0.18).rr(10, 16, 50, 24, 3);
    p.fill(0x05040a, 1).rect(18, 56, 34, 4);
    // Paper ribbon
    p.fill(0xf7f3e6, 1).rect(22, 58, 26, 30);
    for (let i = 0; i < 6; i++) p.fill(0x999999, 1).rect(25, 62 + i * 4, 14 + (i % 3) * 4, 1.4);
    p.fill(0xf7f3e6, 1).tri(22, 88, 26, 92, 30, 88).tri(30, 88, 34, 92, 38, 88).tri(38, 88, 42, 92, 48, 88);
    p.line(2, 0xffd078, 1).srr(4, 10, 62, 40, 6);
  });

  // Token tray pedestal 80x90
  prop(scene, 'hub_tray', 80, 90, (p) => {
    p.fill(0x000000, 0.35).ellipse(40, 86, 74, 9);
    p.fill(0x14202a, 1).rect(18, 34, 44, 50);
    p.fill(0x1e2e3a, 1).rr(12, 28, 56, 10, 3);
    p.fill(0x6b7480, 1).rr(6, 14, 68, 18, 4);
    p.fill(0x3a424c, 1).rr(9, 17, 62, 12, 3);
    for (let i = 0; i < 22; i++) {
      const x = 14 + (i * 11) % 52, y = 20 + (i % 3) * 3;
      p.fill(0xd8a43a, 1).ellipse(x, y, 9, 5);
      p.fill(0xffe08a, 1).ellipse(x - 1, y - 1, 5, 2);
    }
  });

  // Map pin
  prop(scene, 'hub_pin', 16, 22, (p) => {
    p.fill(0xff4d6d, 1).circle(8, 7, 6);
    p.fill(0xff4d6d, 1).tri(3, 10, 13, 10, 8, 21);
    p.fill(0xffffff, 1).circle(8, 7, 2.4);
  });
}

/* ------------------------------------------------------------------ */
/* Interviewees: one distinct Sim each                                 */
/* ------------------------------------------------------------------ */

export const NPC_LOOKS: Record<string, SimLook> = {
  'chen-wei':    { skin: 0xe9c19f, hair: 0x15151a, hairStyle: 'short', top: 0xffb347, bottom: 0x2b2f45, eye: 0x3a2a1a },
  'alex':        { skin: 0xf2cdb0, hair: 0x2a1f1a, hairStyle: 'curly', top: 0x3ee6ff, bottom: 0x1f2a44, eye: 0x2a2a2a },
  'zhang-ming':  { skin: 0xd9a983, hair: 0x1d1d1d, hairStyle: 'short', top: 0x6e7bff, bottom: 0x8a7a5a, eye: 0x3a2a1a },
  'yuki':        { skin: 0xf6d5bd, hair: 0x4a2a66, hairStyle: 'long', top: 0xc9a7ff, bottom: 0x3a3556, eye: 0x6b3fa0 },
  'xiao-mei':    { skin: 0xf0c9a8, hair: 0x2a1c14, hairStyle: 'bun', top: 0xff7ac8, bottom: 0x3a2a4a, eye: 0x4b2a1a },
  'mr-zhou':     { skin: 0xd8a47e, hair: 0x9a9aa0, hairStyle: 'short', top: 0x2a2f45, bottom: 0x1a1d2b, eye: 0x2a2a2a },
  'manager-liu': { skin: 0xc68e66, hair: 0x15151a, hairStyle: 'short', top: 0x2de2b0, bottom: 0x22303a, eye: 0x2a2a2a },
  'dev-zhang':   { skin: 0xe9b896, hair: 0x3a2a1a, hairStyle: 'curly', top: 0x5cff8a, bottom: 0x2d3748, eye: 0x2f6e4e },
};

export function makeNpcSims(scene: Phaser.Scene): void {
  for (const [id, look] of Object.entries(NPC_LOOKS)) {
    const key = `sim_${id}`;
    if (!scene.textures.exists(key)) makeSim(scene, key, look);
  }
}
