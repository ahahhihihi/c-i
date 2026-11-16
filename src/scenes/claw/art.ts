/**
 * Vector art for the claw machine exhibit: room, cabinet, plushies, QR code.
 * Everything is drawn with Graphics so it stays sharp at any zoom.
 */
import Phaser from 'phaser';
import { C } from '../../theme';

/** Glass interior bounds (logical px). */
export const GLASS = { x: 258, y: 72, w: 284, h: 250 };
export const FLOOR_Y = 316;
export const RAIL_Y = 84;
export const CHUTE = { x: 262, y: 238, w: 62, h: 84 };
export const DOOR = { x: 252, y: 414, w: 82, h: 54 };
export const QR_BOX = { x: 452, y: 404, w: 76, h: 76 };
export const CAB = { x: 228, y: 14, w: 344, h: 502 };

export const darken = (c: number, pct: number) => Phaser.Display.Color.IntegerToColor(c).darken(pct).color;
export const lighten = (c: number, pct: number) => Phaser.Display.Color.IntegerToColor(c).lighten(pct).color;

/** Room behind the machine, drawn well beyond the world so no bars show. */
export function drawRoom(scene: Phaser.Scene): void {
  const g = scene.add.graphics().setDepth(0);
  g.fillGradientStyle(0x150b30, 0x150b30, 0x08060f, 0x08060f, 1).fillRect(-320, -320, 1560, 800);
  // Floor
  g.fillStyle(0x0a0716, 1).fillRect(-320, 470, 1560, 680);
  g.lineStyle(1, C.violet, 0.22);
  const vx = 400, vy = 330;
  for (let i = -24; i <= 24; i++) {
    const bx = vx + i * 70;
    g.lineBetween(vx + (bx - vx) * 0.18, 470, bx + (bx - vx) * 2.2, 1150);
  }
  for (let k = 0; k < 12; k++) {
    const y = 470 + Math.pow(k, 1.7) * 9;
    g.lineStyle(1, C.violet, 0.24 - k * 0.012).lineBetween(-320, y, 1240, y);
  }
  g.lineStyle(2, C.pink, 0.35).lineBetween(-320, 470, 1240, 470);

  // Far cabinets in the dark, left and right
  const cab = (x: number, w: number, h: number, screen: number) => {
    const y = 470 - h;
    g.fillStyle(0x110c22, 1).fillRect(x, y, w, h);
    g.fillStyle(screen, 0.16).fillRect(x + 8, y + 20, w - 16, h * 0.32);
    g.fillStyle(screen, 0.5).fillRect(x + 8, y + 6, w - 16, 6);
    g.lineStyle(1, screen, 0.3).strokeRect(x, y, w, h);
    g.fillStyle(screen, 0.06).fillEllipse(x + w / 2, 478, w * 1.4, 16);
  };
  [-300, -210, -120].forEach((x, i) => cab(x, 78, 250 + (i % 2) * 30, [C.cyan, C.amber, C.violet][i]));
  [630, 740, 850, 960, 1070, 1160].forEach((x, i) => cab(x, 80, 240 + (i % 3) * 22, [C.violet, C.teal, C.pink, C.cyan, C.amber, C.green][i]));

  // Back wall neon tubes
  g.lineStyle(3, C.cyan, 0.18).lineBetween(-320, 118, 1240, 118);
  g.lineStyle(10, C.cyan, 0.04).lineBetween(-320, 118, 1240, 118);
  g.lineStyle(3, C.pink, 0.14).lineBetween(-320, 132, 1240, 132);

  // String lights
  for (let i = 0; i < 46; i++) {
    const x = -300 + i * 34;
    const y = -6 + Math.sin(i * 0.9) * 6 + Math.abs(Math.sin(i * 0.31)) * 8;
    const col = [C.pink, C.gold, C.cyan, C.violet][i % 4];
    g.fillStyle(col, 0.12).fillCircle(x, y, 7);
    g.fillStyle(col, 0.9).fillCircle(x, y, 2.2);
  }

  // Spotlight on the machine
  const s = scene.add.graphics().setDepth(1).setBlendMode(Phaser.BlendModes.ADD);
  for (let i = 0; i < 6; i++) {
    s.fillStyle(0xffe6ff, 0.018);
    s.fillTriangle(400, -320, 210 - i * 22, 520, 590 + i * 22, 520);
  }
  // Floor glow under the machine
  s.fillStyle(C.pink, 0.08).fillEllipse(400, 520, 520, 70);
  s.fillStyle(C.cyan, 0.06).fillEllipse(400, 520, 360, 40);
}

/** Cabinet parts behind the plushies (body, back of the glass, chute walls). */
export function drawCabinetBack(scene: Phaser.Scene): void {
  const g = scene.add.graphics().setDepth(10);
  // Body shadow and shell
  g.fillStyle(0x000000, 0.5).fillRoundedRect(CAB.x + 8, CAB.y + 10, CAB.w, CAB.h, 18);
  g.fillGradientStyle(0x2a1240, 0x2a1240, 0x170a26, 0x170a26, 1).fillRoundedRect(CAB.x, CAB.y, CAB.w, CAB.h, 18);
  // Glass interior: deep back panel with a soft gradient
  g.fillGradientStyle(0x22113f, 0x1a1640, 0x2c0f3a, 0x14193a, 1).fillRect(GLASS.x, GLASS.y, GLASS.w, GLASS.h);
  // Back panel pattern: little stars and hearts
  for (let i = 0; i < 38; i++) {
    const x = GLASS.x + 14 + ((i * 53) % (GLASS.w - 28));
    const y = GLASS.y + 26 + ((i * 37) % 170);
    g.fillStyle(i % 2 ? C.pink : C.cyan, 0.16).fillCircle(x, y, 1.6 + (i % 3));
  }
  // Interior light strip
  g.fillStyle(0xffffff, 0.22).fillRect(GLASS.x, GLASS.y, GLASS.w, 4);
  g.fillStyle(C.pink, 0.06).fillRect(GLASS.x, GLASS.y + 4, GLASS.w, 60);
  // Floor of the box
  g.fillStyle(0x3a1d52, 1).fillRect(GLASS.x, FLOOR_Y, GLASS.w, GLASS.y + GLASS.h - FLOOR_Y);
  // Chute: back wall
  g.fillStyle(0x0a0614, 0.9).fillRect(CHUTE.x, CHUTE.y, CHUTE.w, CHUTE.h);
  g.fillStyle(C.cyan, 0.08).fillRect(CHUTE.x, CHUTE.y, CHUTE.w, CHUTE.h);
  // Rail
  g.fillStyle(0x4a4466, 1).fillRect(GLASS.x, RAIL_Y - 4, GLASS.w, 8);
  g.fillStyle(0xffffff, 0.25).fillRect(GLASS.x, RAIL_Y - 4, GLASS.w, 2);
}

/** Front of the cabinet: glass sheen, neon frame, marquee, control deck, lower body. */
export function drawCabinetFront(scene: Phaser.Scene): { bulbs: Phaser.GameObjects.Arc[] } {
  // Chute front: clear acrylic with a cyan edge (in front of plushies)
  const cf = scene.add.graphics().setDepth(55);
  cf.fillStyle(C.cyan, 0.1).fillRect(CHUTE.x, CHUTE.y, CHUTE.w, CHUTE.h);
  cf.lineStyle(2, C.cyan, 0.9).strokeRect(CHUTE.x, CHUTE.y, CHUTE.w, CHUTE.h);
  cf.lineStyle(6, C.cyan, 0.15).strokeRect(CHUTE.x, CHUTE.y, CHUTE.w, CHUTE.h);
  cf.fillStyle(C.cyan, 0.9).fillRect(CHUTE.x + 10, CHUTE.y + 30, CHUTE.w - 20, 18);
  const prize = scene.add.text(CHUTE.x + CHUTE.w / 2, CHUTE.y + 39, 'PRIZE', {
    fontFamily: '"Bungee", sans-serif', fontSize: '12px', color: '#0d0b1a',
  }).setOrigin(0.5).setDepth(56);
  void prize;

  // Glass sheen
  const gl = scene.add.graphics().setDepth(60);
  gl.fillStyle(0xffffff, 0.05).fillRect(GLASS.x, GLASS.y, GLASS.w, GLASS.h);
  gl.fillStyle(0xffffff, 0.07);
  gl.fillTriangle(GLASS.x + 20, GLASS.y, GLASS.x + 70, GLASS.y, GLASS.x + 20, GLASS.y + 120);
  gl.fillStyle(0xffffff, 0.05);
  gl.fillTriangle(GLASS.x + 90, GLASS.y, GLASS.x + 112, GLASS.y, GLASS.x + 20, GLASS.y + 190);
  gl.fillStyle(0xffffff, 0.04);
  gl.fillTriangle(GLASS.x + GLASS.w, GLASS.y + 150, GLASS.x + GLASS.w, GLASS.y + 190, GLASS.x + GLASS.w - 70, GLASS.y + GLASS.h);

  // Neon frame around the glass
  const f = scene.add.graphics().setDepth(70);
  const neon = (x: number, y: number, w: number, h: number, col: number, r: number) => {
    f.lineStyle(14, col, 0.06).strokeRoundedRect(x, y, w, h, r);
    f.lineStyle(8, col, 0.16).strokeRoundedRect(x, y, w, h, r);
    f.lineStyle(3, col, 1).strokeRoundedRect(x, y, w, h, r);
    f.lineStyle(1, 0xffffff, 0.7).strokeRoundedRect(x, y, w, h, r);
  };
  // Pillars hiding glass edges
  f.fillStyle(0x2a1240, 1).fillRect(CAB.x, GLASS.y - 6, GLASS.x - CAB.x, GLASS.h + 12);
  f.fillStyle(0x2a1240, 1).fillRect(GLASS.x + GLASS.w, GLASS.y - 6, CAB.x + CAB.w - GLASS.x - GLASS.w, GLASS.h + 12);
  neon(GLASS.x - 4, GLASS.y - 4, GLASS.w + 8, GLASS.h + 8, C.pink, 8);
  neon(CAB.x + 6, CAB.y + 6, CAB.w - 12, CAB.h - 12, C.cyan, 16);

  // Marquee
  f.fillStyle(0x12081f, 1).fillRoundedRect(CAB.x + 22, CAB.y + 10, CAB.w - 44, 46, 12);
  f.lineStyle(2, C.gold, 0.8).strokeRoundedRect(CAB.x + 22, CAB.y + 10, CAB.w - 44, 46, 12);
  const bulbs: Phaser.GameObjects.Arc[] = [];
  const mx = CAB.x + 22, my = CAB.y + 10, mw = CAB.w - 44, mh = 46;
  for (let i = 0; i < 22; i++) {
    const x = mx + 10 + (i % 11) * ((mw - 20) / 10);
    const y = i < 11 ? my - 0.5 : my + mh + 0.5;
    bulbs.push(scene.add.circle(x, y, 2.6, C.gold, 1).setDepth(72));
  }

  // Control deck (slanted shelf)
  const d = scene.add.graphics().setDepth(80);
  const deckTop = GLASS.y + GLASS.h + 6;
  d.fillStyle(0x000000, 0.35).fillRect(CAB.x, deckTop, CAB.w, 8);
  d.fillGradientStyle(0x3b1a5c, 0x3b1a5c, 0x241038, 0x241038, 1);
  d.beginPath();
  d.moveTo(CAB.x - 14, deckTop + 6);
  d.lineTo(CAB.x + CAB.w + 14, deckTop + 6);
  d.lineTo(CAB.x + CAB.w + 4, deckTop + 74);
  d.lineTo(CAB.x - 4, deckTop + 74);
  d.closePath();
  d.fillPath();
  d.lineStyle(2, C.pink, 0.9).lineBetween(CAB.x - 14, deckTop + 6, CAB.x + CAB.w + 14, deckTop + 6);
  d.lineStyle(2, C.cyan, 0.6).lineBetween(CAB.x - 4, deckTop + 74, CAB.x + CAB.w + 4, deckTop + 74);
  // LCD bezel
  d.fillStyle(0x07060f, 1).fillRoundedRect(352, deckTop + 18, 96, 46, 6);
  d.lineStyle(1, C.cyan, 0.5).strokeRoundedRect(352, deckTop + 18, 96, 46, 6);

  // Lower body: prize door, coin slot, QR plate
  const b = scene.add.graphics().setDepth(80);
  b.fillStyle(0x05030a, 1).fillRoundedRect(DOOR.x, DOOR.y, DOOR.w, DOOR.h, 8);
  b.lineStyle(2, C.gold, 0.8).strokeRoundedRect(DOOR.x, DOOR.y, DOOR.w, DOOR.h, 8);
  b.fillStyle(C.gold, 0.08).fillRoundedRect(DOOR.x, DOOR.y, DOOR.w, 14, { tl: 8, tr: 8, bl: 0, br: 0 });
  b.fillStyle(0x05030a, 1).fillRoundedRect(366, 416, 60, 46, 6);
  b.fillStyle(0x6b6488, 1).fillRect(392, 422, 8, 26);
  b.fillStyle(C.red, 0.85).fillRoundedRect(376, 452, 40, 5, 2);
  // Lower trim light
  b.fillStyle(C.pink, 0.5).fillRect(CAB.x + 20, 492, CAB.w - 40, 3);
  // Feet
  b.fillStyle(0x0d0716, 1).fillRect(CAB.x + 10, CAB.y + CAB.h - 4, 40, 8).fillRect(CAB.x + CAB.w - 50, CAB.y + CAB.h - 4, 40, 8);

  return { bulbs };
}

/* ---------------------------------------------------------------- */
/* Plushies                                                          */
/* ---------------------------------------------------------------- */

export type PlushKind = 'bunny' | 'cat' | 'bear' | 'hero';
export const PASTELS = [0xffb3d9, 0xb8f2d8, 0xd6c2ff, 0xfff1a8, 0xb3e5ff, 0xffcfb3];

/** Draw a plush centred on (0,0) into g. */
export function drawPlush(g: Phaser.GameObjects.Graphics, kind: PlushKind, color: number, r: number): void {
  const dark = darken(color, 22);
  const inner = 0xff8fc4;
  const outline = (fn: () => void) => { g.lineStyle(1.5, dark, 0.8); fn(); };

  // Ears behind the head
  if (kind === 'bunny') {
    for (const s of [-1, 1]) {
      g.fillStyle(color, 1).fillEllipse(s * r * 0.42, -r * 1.05, r * 0.5, r * 1.15);
      outline(() => g.strokeEllipse(s * r * 0.42, -r * 1.05, r * 0.5, r * 1.15));
      g.fillStyle(inner, 0.55).fillEllipse(s * r * 0.42, -r * 1.0, r * 0.24, r * 0.8);
    }
  } else if (kind === 'bear') {
    for (const s of [-1, 1]) {
      g.fillStyle(color, 1).fillCircle(s * r * 0.72, -r * 0.7, r * 0.38);
      outline(() => g.strokeCircle(s * r * 0.72, -r * 0.7, r * 0.38));
      g.fillStyle(dark, 0.5).fillCircle(s * r * 0.72, -r * 0.7, r * 0.2);
    }
  } else {
    for (const s of [-1, 1]) {
      const ax = s * r * 0.92, ay = -r * 0.25, bx = s * r * 0.62, by = -r * 1.12, cx = s * r * 0.15, cy = -r * 0.82;
      g.fillStyle(color, 1).fillTriangle(ax, ay, bx, by, cx, cy);
      outline(() => g.strokeTriangle(ax, ay, bx, by, cx, cy));
      g.fillStyle(inner, 0.5).fillTriangle(s * r * 0.7, -r * 0.45, s * r * 0.6, -r * 0.92, s * r * 0.32, -r * 0.72);
    }
  }

  // Head / body
  g.fillStyle(color, 1).fillCircle(0, 0, r);
  g.fillStyle(dark, 0.18).fillEllipse(0, r * 0.45, r * 1.7, r * 0.9);
  g.fillStyle(0xffffff, 0.35).fillEllipse(-r * 0.35, -r * 0.45, r * 0.8, r * 0.5);
  outline(() => g.strokeCircle(0, 0, r));

  if (kind === 'bear') g.fillStyle(lighten(color, 10), 1).fillEllipse(0, r * 0.28, r * 0.75, r * 0.55);

  // Face
  const eyeY = kind === 'hero' ? 0.05 : -0.02;
  for (const s of [-1, 1]) {
    g.fillStyle(0x2a1a33, 1).fillEllipse(s * r * 0.36, r * eyeY, r * 0.2, r * 0.26);
    g.fillStyle(0xffffff, 1).fillCircle(s * r * 0.36 - r * 0.04, r * eyeY - r * 0.06, r * 0.05);
    g.fillStyle(0xff6fa8, 0.55).fillEllipse(s * r * 0.6, r * 0.28, r * 0.3, r * 0.17);
  }
  if (kind === 'hero' || kind === 'cat') {
    g.fillStyle(0xffc23d, 1).fillEllipse(0, r * 0.2, r * 0.18, r * 0.12);
    g.lineStyle(1.2, 0x2a1a33, 0.8);
    for (const s of [-1, 1]) {
      g.lineBetween(s * r * 0.85, r * 0.12, s * r * 1.18, r * 0.04);
      g.lineBetween(s * r * 0.85, r * 0.24, s * r * 1.18, r * 0.28);
    }
  } else {
    g.lineStyle(1.4, 0x2a1a33, 0.85);
    g.beginPath();
    g.arc(-r * 0.09, r * 0.22, r * 0.09, 0, Math.PI, false);
    g.strokePath();
    g.beginPath();
    g.arc(r * 0.09, r * 0.22, r * 0.09, 0, Math.PI, false);
    g.strokePath();
  }

  // Hero gets a big pink bow
  if (kind === 'hero') {
    const bx = r * 0.55, by = -r * 0.82;
    g.fillStyle(0xff3d8b, 1);
    g.fillTriangle(bx, by, bx - r * 0.5, by - r * 0.32, bx - r * 0.44, by + r * 0.3);
    g.fillTriangle(bx, by, bx + r * 0.5, by - r * 0.32, bx + r * 0.44, by + r * 0.3);
    g.fillStyle(0xff7ab3, 1).fillCircle(bx, by, r * 0.16);
    g.lineStyle(1.2, 0xb0185a, 0.9);
    g.strokeTriangle(bx, by, bx - r * 0.5, by - r * 0.32, bx - r * 0.44, by + r * 0.3);
    g.strokeTriangle(bx, by, bx + r * 0.5, by - r * 0.32, bx + r * 0.44, by + r * 0.3);
  }
}

/** Four-point sparkle star centred on (0,0). */
export function drawSparkle(g: Phaser.GameObjects.Graphics, size: number, color = 0xffffff): void {
  g.fillStyle(color, 1);
  g.fillTriangle(0, -size, size * 0.22, 0, -size * 0.22, 0);
  g.fillTriangle(0, size, size * 0.22, 0, -size * 0.22, 0);
  g.fillTriangle(-size, 0, 0, size * 0.22, 0, -size * 0.22);
  g.fillTriangle(size, 0, 0, size * 0.22, 0, -size * 0.22);
  g.fillStyle(color, 0.25).fillCircle(0, 0, size * 0.5);
}

/** Deterministic fake QR code. */
export function drawQR(g: Phaser.GameObjects.Graphics, x: number, y: number, size: number, fg = 0x0d0b1a, bg = 0xffffff): void {
  const n = 21;
  const m = size / n;
  g.fillStyle(bg, 1).fillRoundedRect(x - m * 1.5, y - m * 1.5, size + m * 3, size + m * 3, m * 1.2);
  g.fillStyle(fg, 1);
  let seed = 7;
  const rnd = () => { seed = (seed * 9301 + 49297) % 233280; return seed / 233280; };
  const finder = (cx: number, cy: number) => (c: number, r: number) => c >= cx && c < cx + 7 && r >= cy && r < cy + 7;
  const finders = [finder(0, 0), finder(14, 0), finder(0, 14)];
  for (let r = 0; r < n; r++) {
    for (let c = 0; c < n; c++) {
      const fi = finders.findIndex(f => f(c, r));
      let on: boolean;
      if (fi >= 0) {
        const ox = fi === 1 ? 14 : 0, oy = fi === 2 ? 14 : 0;
        const lc = c - ox, lr = r - oy;
        const ring = lc === 0 || lc === 6 || lr === 0 || lr === 6;
        const core = lc >= 2 && lc <= 4 && lr >= 2 && lr <= 4;
        on = ring || core;
      } else if ((c === 7 || r === 7) && (c < 8 && r < 8 || c > 12 && r < 8 || c < 8 && r > 12)) {
        on = false;
      } else {
        on = rnd() > 0.52;
      }
      if (on) g.fillRect(x + c * m, y + r * m, m + 0.3, m + 0.3);
    }
  }
}
