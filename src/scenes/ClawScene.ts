/**
 * Wing C: a playable, rigged claw machine.
 *
 * Fieldwork: at Fengyun Zaiqi the machines run on payout settings. The claw
 * lifts with full grip, then drops to half power at the top so the prize
 * slips. Only when the try counter reaches the payout number (1 in 18) does it
 * hold all the way to the chute. Payment is one QR scan, ¥6 for two tries.
 *
 * Launched by the hub with { returnTo }. Resumes that scene when done.
 */
import Phaser from 'phaser';
import { C, FONT, HEX, cinematicCamera, glassPanel, neonText, burst, impact } from '../theme';
import { fitToScreen, fitZoom, setHint, setLocation, WORLD_H, WORLD_W } from '../view';
import { audio } from '../audio';
import { wallet } from '../wallet';
import { showModal, closeModal, isModalOpen } from '../ui/modals';
import {
  CHUTE, DOOR, FLOOR_Y, GLASS, PASTELS, QR_BOX, RAIL_Y,
  PlushKind, drawCabinetBack, drawCabinetFront, drawPlush, drawQR, drawRoom, drawSparkle,
} from './claw/art';

const PAYOUT = 18;
const PRICE = 6;
const TRIES_PER_PAY = 2;
const ONLINE_PRICE = 15;
const AIM_SECONDS = 15;
const REST_X = CHUTE.x + CHUTE.w / 2;
const TOP_Y = 116;
const MIN_X = REST_X;
const MAX_X = GLASS.x + GLASS.w - 22;
const MOVE_SPEED = 120;
const GRAPH_SECONDS = 11;

const XIAO_MEI_1 = "We spent 100 yuan chasing a Sanrio plush that sells for 15 yuan on Taobao. But we weren't really buying a toy. We were buying those ten seconds, when the claw lifts the prize, it wobbles, and it almost slips.";
const XIAO_MEI_2 = "Every machine has a QR code on it. You scan it with WeChat Pay, and 6 yuan gets you two tries. You never have to hand over real cash, so it doesn't feel like spending.";
const LIU = 'Claw machines run on payout settings. The technician sets a ratio, say one win in 18 tries. The claw lifts with a full grip, then the power drops by half at the top, so the toy falls. It only holds all the way to the chute once the count is reached.';

type State = 'idle' | 'aim' | 'busy' | 'ending';

interface Plush {
  c: Phaser.GameObjects.Container;
  kind: PlushKind;
  r: number;
  home: { x: number; y: number; rot: number; depth: number };
  gone: boolean;
}

interface Btn {
  root: Phaser.GameObjects.Container;
  bg: Phaser.GameObjects.Graphics;
  text: Phaser.GameObjects.Text;
  w: number; h: number; color: number;
}

export class ClawScene extends Phaser.Scene {
  private returnTo = 'Arcade';

  // Play state
  private state!: State;
  private credits!: number;
  private spent!: number;
  private tries!: number;
  private nearMisses!: number;
  private won!: boolean;
  private machineCount!: number;
  private timeLeft!: number;
  private holdDir!: number;
  private stepClock!: number;
  private promptedTech!: boolean;
  private techSeen!: boolean;

  // Claw
  private claw!: { x: number; y: number; open: number; grip: number };
  private wob!: { amp: number; slip: number; swing: number };
  private held!: Plush | null;
  private led!: number;

  // Grip trace for the technician graph
  private trace!: { t: number; g: number }[];
  private traceStart!: number;
  private tracing!: boolean;
  private cutAt!: number | null;

  // Display
  private plushes!: Plush[];
  private clawG!: Phaser.GameObjects.Graphics;
  private stick!: Phaser.GameObjects.Graphics;
  private lcdTime!: Phaser.GameObjects.Text;
  private lcdCredit!: Phaser.GameObjects.Text;
  private spentText!: Phaser.GameObjects.Text;
  private triesText!: Phaser.GameObjects.Text;
  private gapBar!: Phaser.GameObjects.Graphics;
  private gapText!: Phaser.GameObjects.Text;
  private caption!: Phaser.GameObjects.Text;
  private captionCard!: Phaser.GameObjects.Graphics;
  private howTo!: Phaser.GameObjects.Container;
  private tech!: Phaser.GameObjects.Container;
  private techOn!: boolean;
  private techCount!: Phaser.GameObjects.Text;
  private techGrip!: Phaser.GameObjects.Text;
  private techBar!: Phaser.GameObjects.Graphics;
  private graph!: Phaser.GameObjects.Graphics;
  private techBtn!: Btn;
  private payBtn!: Phaser.GameObjects.Container;
  private qr!: Phaser.GameObjects.Container;
  private bulbs!: Phaser.GameObjects.Arc[];
  private redVeil!: Phaser.GameObjects.Rectangle;
  private bigWord!: Phaser.GameObjects.Text;
  private pulses!: Phaser.Tweens.Tween[];
  private keys!: Record<string, Phaser.Input.Keyboard.Key>;
  /** Dramatic close-up during the near-miss. Null when the camera is at rest. */
  private camFocus!: { x: number; y: number; z: number } | null;

  constructor() { super('Claw'); }

  init(data: { returnTo?: string } | undefined): void {
    this.returnTo = data?.returnTo ?? 'Arcade';
  }

  create(): void {
    // Reset everything: Phaser reuses this instance between visits
    this.state = 'idle';
    this.credits = 0;
    this.spent = 0;
    this.tries = 0;
    this.nearMisses = 0;
    this.won = false;
    this.machineCount = Phaser.Math.Between(13, 16);
    this.timeLeft = AIM_SECONDS;
    this.holdDir = 0;
    this.stepClock = 0;
    this.promptedTech = false;
    this.techSeen = false;
    this.claw = { x: REST_X, y: TOP_Y, open: 0.35, grip: 0 };
    this.wob = { amp: 0, slip: 0, swing: 0 };
    this.held = null;
    this.led = 0;
    this.trace = [];
    this.traceStart = 0;
    this.tracing = false;
    this.cutAt = null;
    this.plushes = [];
    this.techOn = false;
    this.pulses = [];
    this.camFocus = null;

    // Draw above the paused hub, whatever order the scene list is in
    this.scene.bringToTop();
    fitToScreen(this);
    setLocation('WING C · THE CLAW');
    setHint('<kbd>A</kbd><kbd>D</kbd> Move <kbd>Space</kbd> Drop <kbd>T</kbd> Technician view <kbd>Esc</kbd> Leave');
    this.cameras.main.setBackgroundColor(C.night);
    cinematicCamera(this, { bloom: 0.9, vignette: 0.9 });

    // Opaque base so the paused hub never shows through
    this.add.rectangle(WORLD_W / 2, WORLD_H / 2, WORLD_W + 2000, WORLD_H + 2000, C.night, 1).setDepth(-10);
    drawRoom(this);
    drawCabinetBack(this);
    this.buildPile();
    this.clawG = this.add.graphics().setDepth(50);
    const front = drawCabinetFront(this);
    this.bulbs = front.bulbs;
    neonText(this, 400, 47, 'LUCKY CLAW', { size: 26, color: HEX.pink, glow: HEX.pink, blur: 14 }).setDepth(73);
    this.buildDeck();
    this.buildQR();
    this.buildLeftPanel();
    this.buildRightPanel();

    this.redVeil = this.add.rectangle(WORLD_W / 2, WORLD_H / 2, WORLD_W + 800, WORLD_H + 800, C.red, 0)
      .setDepth(95).setBlendMode(Phaser.BlendModes.ADD);
    this.bigWord = this.add.text(400, 200, '', {
      fontFamily: FONT.display, fontSize: '40px', color: HEX.gold, align: 'center',
    }).setOrigin(0.5).setDepth(120).setAlpha(0);
    this.bigWord.setShadow(0, 0, HEX.pink, 16, true, true);

    // Marquee chase lights
    let chase = 0;
    this.time.addEvent({
      delay: 160, loop: true, callback: () => {
        chase++;
        this.bulbs.forEach((b, i) => b.setFillStyle((i + chase) % 3 === 0 ? C.pink : C.gold, (i + chase) % 3 === 0 ? 1 : 0.45));
      },
    });

    // Input
    const kb = this.input.keyboard!;
    const keys = kb.addKeys('A,D,LEFT,RIGHT,SPACE') as Record<string, Phaser.Input.Keyboard.Key>;
    const onSpace = () => { if (!isModalOpen()) this.drop(); };
    const onT = () => { if (!isModalOpen()) this.toggleTech(); };
    const onEsc = () => { if (!isModalOpen()) this.requestLeave(); };
    kb.on('keydown-SPACE', onSpace);
    kb.on('keydown-T', onT);
    kb.on('keydown-ESC', onEsc);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      kb.off('keydown-SPACE', onSpace);
      kb.off('keydown-T', onT);
      kb.off('keydown-ESC', onEsc);
    });
    this.keys = keys;

    this.setCaption('Scan the QR code to play. ¥6 gets you 2 tries.');
    this.refresh();
  }

  /* ---------------------------------------------------------------- */
  /* Build                                                             */
  /* ---------------------------------------------------------------- */

  private buildPile(): void {
    const kinds: PlushKind[] = ['bunny', 'cat', 'bear'];
    const rows = [
      { y: FLOOR_Y - 18, xs: [346, 381, 416, 451, 486, 520] },
      { y: FLOOR_Y - 42, xs: [363, 398, 470, 505] },
      { y: FLOOR_Y - 64, xs: [381, 488] },
    ];
    let n = 0;
    rows.forEach((row, ri) => row.xs.forEach(x => {
      const kind = kinds[(n * 2 + ri) % 3];
      const color = PASTELS[(n * 5 + ri) % PASTELS.length];
      this.addPlush(kind, color, 17, x + Phaser.Math.Between(-2, 2), row.y, 20 + ri * 4 + (n % 3));
      n++;
    }));
    // The coveted prize: a white kitten with a bow, on top in the middle
    const hero = this.addPlush('hero', 0xfffaf5, 21, 436, FLOOR_Y - 54, 34);
    hero.home.rot = 0.05;
    hero.c.setRotation(0.05);
    const sparkles: Phaser.GameObjects.Graphics[] = [];
    [[-24, -26, 6], [26, -12, 5], [-18, 20, 4], [22, 22, 4.5]].forEach(([x, y, s], i) => {
      const g = this.add.graphics({ x, y });
      drawSparkle(g, s, i % 2 ? 0xfff1a8 : 0xffffff);
      g.setBlendMode(Phaser.BlendModes.ADD);
      hero.c.add(g);
      sparkles.push(g);
      this.tweens.add({ targets: g, scale: { from: 0.2, to: 1.2 }, alpha: { from: 0.2, to: 1 }, angle: 45, duration: 650 + i * 120, yoyo: true, repeat: -1, delay: i * 260, ease: 'Sine.inOut' });
    });
    const halo = this.add.circle(0, 0, 30, 0xfff1a8, 0.12).setBlendMode(Phaser.BlendModes.ADD);
    hero.c.addAt(halo, 0);
    this.tweens.add({ targets: halo, scale: { from: 0.9, to: 1.25 }, alpha: { from: 0.18, to: 0.05 }, duration: 1100, yoyo: true, repeat: -1 });
  }

  private addPlush(kind: PlushKind, color: number, r: number, x: number, y: number, depth: number): Plush {
    const g = this.add.graphics();
    drawPlush(g, kind, color, r);
    const rot = Phaser.Math.FloatBetween(-0.3, 0.3);
    const c = this.add.container(x, y, [g]).setDepth(depth).setRotation(rot);
    const p: Plush = { c, kind, r, home: { x, y, rot, depth }, gone: false };
    this.plushes.push(p);
    return p;
  }

  private buildDeck(): void {
    const deckY = GLASS.y + GLASS.h + 6;
    this.stick = this.add.graphics().setDepth(82);
    // LCD
    const lab = (x: number, y: number, s: string) => this.add.text(x, y, s, { fontFamily: FONT.mono, fontSize: '12px', color: HEX.cyan }).setOrigin(0.5).setDepth(82).setAlpha(0.7);
    lab(376, deckY + 27, 'TIME');
    lab(422, deckY + 27, 'CREDIT');
    this.lcdTime = this.add.text(376, deckY + 47, '--', { fontFamily: FONT.display, fontSize: '18px', color: HEX.gold }).setOrigin(0.5).setDepth(82);
    this.lcdCredit = this.add.text(422, deckY + 47, '0', { fontFamily: FONT.display, fontSize: '18px', color: HEX.cyan }).setOrigin(0.5).setDepth(82);
    this.lcdTime.setShadow(0, 0, HEX.gold, 8, true, true);
    this.lcdCredit.setShadow(0, 0, HEX.cyan, 8, true, true);

    // Arrow buttons either side of the joystick (hold to move)
    const arrow = (x: number, dir: number) => {
      const g = this.add.graphics({ x, y: deckY + 40 }).setDepth(82);
      const draw = (hot: boolean) => {
        g.clear();
        g.fillStyle(hot ? C.cyan : 0x1b1030, 1).fillCircle(0, 0, 15);
        g.lineStyle(2, C.cyan, 1).strokeCircle(0, 0, 15);
        g.fillStyle(hot ? C.ink : C.cyan, 1).fillTriangle(dir * 7, 0, -dir * 5, -7, -dir * 5, 7);
      };
      draw(false);
      const z = this.add.zone(x, deckY + 40, 36, 36).setInteractive({ useHandCursor: true }).setDepth(83);
      z.on('pointerdown', () => { this.holdDir = dir; draw(true); audio.start(); });
      const release = () => { if (this.holdDir === dir) this.holdDir = 0; draw(false); };
      z.on('pointerup', release);
      z.on('pointerout', release);
    };
    arrow(256, -1);
    arrow(334, 1);

    // DROP button
    const bx = 494, by = deckY + 40;
    const btn = this.add.graphics({ x: bx, y: by }).setDepth(82);
    const drawBtn = (down: boolean) => {
      btn.clear();
      btn.fillStyle(0x000000, 0.45).fillEllipse(0, 6, 64, 26);
      btn.fillStyle(0x9b1650, 1).fillEllipse(0, down ? 3 : 2, 58, 24);
      btn.fillStyle(C.pink, 1).fillEllipse(0, down ? 0 : -4, 54, 22);
      btn.fillStyle(0xffffff, 0.4).fillEllipse(-8, down ? -4 : -8, 22, 7);
      btn.lineStyle(10, C.pink, 0.12).strokeEllipse(0, -2, 70, 32);
    };
    drawBtn(false);
    const dropLab = this.add.text(bx, by - 3, 'DROP', { fontFamily: FONT.display, fontSize: '13px', color: '#3a0420' }).setOrigin(0.5).setDepth(83);
    const z = this.add.zone(bx, by, 70, 40).setInteractive({ useHandCursor: true }).setDepth(84);
    z.on('pointerdown', () => { drawBtn(true); dropLab.y = by; this.drop(); });
    const up = () => { drawBtn(false); dropLab.y = by - 3; };
    z.on('pointerup', up);
    z.on('pointerout', up);
    this.add.text(bx, by + 24, 'SPACE', { fontFamily: FONT.mono, fontSize: '12px', color: HEX.muted }).setOrigin(0.5).setDepth(82);
    this.add.text(295, by + 24, 'A  ·  D', { fontFamily: FONT.mono, fontSize: '12px', color: HEX.muted }).setOrigin(0.5).setDepth(82);
  }

  private drawStick(dir: number): void {
    const deckY = GLASS.y + GLASS.h + 6;
    const x = 295, y = deckY + 46;
    const g = this.stick;
    g.clear();
    g.fillStyle(0x000000, 0.4).fillEllipse(x, y + 3, 34, 12);
    g.fillStyle(0x15091f, 1).fillEllipse(x, y, 30, 10);
    const tx = x + dir * 10, ty = y - 28;
    g.lineStyle(5, 0xc9c6dc, 1).lineBetween(x, y, tx, ty);
    g.fillStyle(C.red, 1).fillCircle(tx, ty, 10);
    g.fillStyle(0xffffff, 0.5).fillCircle(tx - 3, ty - 4, 3.5);
  }

  private buildQR(): void {
    const c = this.add.container(QR_BOX.x + QR_BOX.w / 2, QR_BOX.y + QR_BOX.h / 2).setDepth(86);
    const ring = this.add.graphics();
    ring.lineStyle(8, C.green, 0.25).strokeRoundedRect(-QR_BOX.w / 2 - 6, -QR_BOX.h / 2 - 6, QR_BOX.w + 12, QR_BOX.h + 12, 10);
    ring.lineStyle(2, C.green, 1).strokeRoundedRect(-QR_BOX.w / 2 - 3, -QR_BOX.h / 2 - 3, QR_BOX.w + 6, QR_BOX.h + 6, 8);
    const g = this.add.graphics();
    drawQR(g, -26, -32, 52);
    const lab = this.add.text(0, 30, 'SCAN · ¥6', { fontFamily: FONT.display, fontSize: '12px', color: '#0d0b1a' }).setOrigin(0.5);
    g.fillStyle(C.green, 1).fillRoundedRect(-34, 22, 68, 16, 4);
    c.add([ring, g, lab]);
    this.tweens.add({ targets: ring, alpha: { from: 1, to: 0.25 }, duration: 700, yoyo: true, repeat: -1 });
    this.pulses.push(this.tweens.add({ targets: c, scale: { from: 1, to: 1.07 }, duration: 700, yoyo: true, repeat: -1, ease: 'Sine.inOut' }));
    this.qr = c;
    const z = this.add.zone(c.x, c.y, QR_BOX.w + 10, QR_BOX.h + 10).setInteractive({ useHandCursor: true }).setDepth(87);
    z.on('pointerdown', () => this.pay());
  }

  private buildLeftPanel(): void {
    const x = 22, w = 190;
    glassPanel(this, x, 24, w, 300, C.pink).setDepth(100);
    const t = (tx: number, ty: number, s: string, size: number, color: string, font = FONT.mono) =>
      this.add.text(tx, ty, s, { fontFamily: font, fontSize: `${size}px`, color }).setDepth(101);

    t(x + 16, 38, 'YOUR VISIT', 12, HEX.muted);
    t(x + 16, 62, 'SPENT', 12, HEX.pink);
    this.spentText = t(x + 16, 76, '¥0', 36, HEX.pink, FONT.display);
    this.spentText.setShadow(0, 0, HEX.pink, 10, true, true);
    t(x + 16, 130, 'TRIES', 12, HEX.cyan);
    this.triesText = t(x + 16, 144, '0', 28, HEX.white, FONT.display);

    const div = this.add.graphics().setDepth(101);
    div.lineStyle(1, 0xffffff, 0.12).lineBetween(x + 14, 190, x + w - 14, 190);

    // Mini hero plush
    const mini = this.add.graphics({ x: x + 34, y: 226 }).setDepth(101);
    drawPlush(mini, 'hero', 0xfffaf5, 15);
    t(x + 58, 204, 'This plush costs', 14, HEX.white, FONT.ui);
    const online = t(x + 58, 222, '¥15 online', 18, HEX.teal, FONT.display);
    online.setShadow(0, 0, HEX.teal, 6, true, true);

    this.gapBar = this.add.graphics().setDepth(101);
    this.gapText = t(x + 16, 290, '', 13, HEX.muted, FONT.ui);

    // Pay button
    const py = 336, ph = 160;
    const c = this.add.container(x, py).setDepth(100);
    const bg = this.add.graphics();
    const paint = (hot: boolean) => {
      bg.clear();
      bg.fillStyle(0x000000, 0.35).fillRoundedRect(3, 5, w, ph, 12);
      bg.fillStyle(hot ? 0x173a26 : 0x10261b, 0.96).fillRoundedRect(0, 0, w, ph, 12);
      bg.lineStyle(2, C.green, 1).strokeRoundedRect(0, 0, w, ph, 12);
      bg.lineStyle(8, C.green, hot ? 0.3 : 0.12).strokeRoundedRect(-2, -2, w + 4, ph + 4, 14);
    };
    paint(false);
    const qr = this.add.graphics();
    drawQR(qr, 16, 22, 52);
    const l1 = this.add.text(84, 18, 'Scan to pay', { fontFamily: FONT.ui, fontSize: '16px', color: HEX.white, fontStyle: 'bold' });
    const l2 = this.add.text(84, 40, '¥6', { fontFamily: FONT.display, fontSize: '26px', color: HEX.green });
    const l3 = this.add.text(84, 72, 'for 2 tries', { fontFamily: FONT.ui, fontSize: '14px', color: HEX.white });
    const l4 = this.add.text(w / 2, 104, 'WeChat Pay  ·  one tap', { fontFamily: FONT.mono, fontSize: '12px', color: HEX.green }).setOrigin(0.5, 0);
    const pill = this.add.graphics();
    pill.fillStyle(C.green, 1).fillRoundedRect(16, 124, w - 32, 26, 13);
    const l5 = this.add.text(w / 2, 137, 'TAP TO SCAN', { fontFamily: FONT.display, fontSize: '13px', color: '#0d0b1a' }).setOrigin(0.5);
    c.add([bg, qr, l1, l2, l3, l4, pill, l5]);
    const z = this.add.zone(x, py, w, ph).setOrigin(0).setInteractive({ useHandCursor: true }).setDepth(102);
    z.on('pointerover', () => paint(true));
    z.on('pointerout', () => paint(false));
    z.on('pointerdown', () => this.pay());
    this.payBtn = c;
    this.pulses.push(this.tweens.add({ targets: pill, alpha: { from: 1, to: 0.55 }, duration: 600, yoyo: true, repeat: -1 }));
  }

  private makeButton(x: number, y: number, w: number, h: number, label: string, color: number, onClick: () => void): Btn {
    const root = this.add.container(x, y).setDepth(100);
    const bg = this.add.graphics();
    const text = this.add.text(w / 2, h / 2, label, { fontFamily: FONT.ui, fontSize: '15px', color: HEX.white, fontStyle: 'bold' }).setOrigin(0.5);
    root.add([bg, text]);
    const b: Btn = { root, bg, text, w, h, color };
    this.paintButton(b, false);
    const z = this.add.zone(x, y, w, h).setOrigin(0).setInteractive({ useHandCursor: true }).setDepth(102);
    z.on('pointerover', () => this.paintButton(b, true));
    z.on('pointerout', () => this.paintButton(b, false));
    z.on('pointerdown', () => { audio.sfx('click'); onClick(); });
    return b;
  }

  private paintButton(b: Btn, hot: boolean, on = false): void {
    b.bg.clear();
    b.bg.fillStyle(on ? b.color : hot ? 0x241a3d : C.panel, on ? 0.9 : 0.94).fillRoundedRect(0, 0, b.w, b.h, 9);
    b.bg.lineStyle(2, b.color, hot || on ? 1 : 0.7).strokeRoundedRect(0, 0, b.w, b.h, 9);
    b.text.setColor(on ? HEX.ink : HEX.white);
  }

  private buildRightPanel(): void {
    const x = 606, w = 292;
    this.techBtn = this.makeButton(x, 24, w, 36, 'Technician view   [T]', C.amber, () => this.toggleTech());
    this.makeButton(x, 466, w, 32, 'Leave the machine   [Esc]', C.muted, () => this.requestLeave());

    this.captionCard = glassPanel(this, x, 70, w, 78, C.cyan).setDepth(100);
    this.caption = this.add.text(x + 16, 109, '', {
      fontFamily: FONT.ui, fontSize: '17px', color: HEX.white, wordWrap: { width: w - 32 }, lineSpacing: 3,
    }).setOrigin(0, 0.5).setDepth(101);

    // How to play (default)
    const how = this.add.container(0, 0).setDepth(100);
    how.add(glassPanel(this, x, 158, w, 298, C.pink));
    how.add(this.add.text(x + 16, 172, 'HOW IT WORKS', { fontFamily: FONT.mono, fontSize: '12px', color: HEX.pink }));
    const steps = [
      ['1', 'Scan to pay. ¥6 gets you 2 tries.'],
      ['2', 'Move the claw with A and D. You have 15 seconds.'],
      ['3', 'Press Space to drop. Grab the sparkly kitten.'],
    ];
    steps.forEach(([n, s], i) => {
      const y = 202 + i * 72;
      const g = this.add.graphics();
      g.fillStyle(C.pink, 1).fillCircle(x + 32, y + 14, 14);
      how.add(g);
      how.add(this.add.text(x + 32, y + 14, n, { fontFamily: FONT.display, fontSize: '15px', color: HEX.ink }).setOrigin(0.5));
      how.add(this.add.text(x + 58, y, s, { fontFamily: FONT.ui, fontSize: '16px', color: HEX.white, wordWrap: { width: w - 76 }, lineSpacing: 3 }));
    });
    how.add(this.add.text(x + w / 2, 430, 'Real machines at Fengyun Zaiqi, Shanghai', { fontFamily: FONT.mono, fontSize: '12px', color: HEX.muted }).setOrigin(0.5));
    this.howTo = how;

    // Technician view (hidden)
    const tech = this.add.container(0, 0).setDepth(100).setVisible(false);
    tech.add(glassPanel(this, x, 158, w, 298, C.amber, { fill: 0x1a1208 }));
    tech.add(this.add.text(x + 16, 170, 'TECHNICIAN VIEW', { fontFamily: FONT.mono, fontSize: '13px', color: HEX.amber }));
    tech.add(this.add.text(x + w - 16, 170, 'HIDDEN SETTINGS', { fontFamily: FONT.mono, fontSize: '12px', color: HEX.red }).setOrigin(1, 0));
    const row = (y: number, k: string, v: string, color: string) => {
      tech.add(this.add.text(x + 16, y, k, { fontFamily: FONT.ui, fontSize: '14px', color: HEX.muted }));
      const t = this.add.text(x + w - 16, y - 3, v, { fontFamily: FONT.display, fontSize: '17px', color }).setOrigin(1, 0);
      tech.add(t);
      return t;
    };
    row(194, 'Payout ratio', '1 : 18', HEX.gold);
    this.techCount = row(220, 'This machine', '', HEX.white);
    this.techBar = this.add.graphics();
    tech.add(this.techBar);
    this.techGrip = row(262, 'Grip at the top', '50%', HEX.red);
    tech.add(this.add.text(x + 16, 292, 'GRIP POWER, THIS TRY', { fontFamily: FONT.mono, fontSize: '12px', color: HEX.amber }));
    this.graph = this.add.graphics();
    tech.add(this.graph);
    // Graph guide labels (graph box: x 622..882, y 310..406, value v at y 398 - 0.8v)
    tech.add(this.add.text(876, 317, 'FULL GRIP 100%', { fontFamily: FONT.mono, fontSize: '12px', color: HEX.green }).setOrigin(1, 1));
    tech.add(this.add.text(876, 357, 'TOP OF LIFT 50%', { fontFamily: FONT.mono, fontSize: '12px', color: HEX.red }).setOrigin(1, 1));
    tech.add(this.add.text(x + 16, 420, 'Only try 18 holds all the way to the chute. Every other try drops to 50% at the top.', {
      fontFamily: FONT.ui, fontSize: '12px', color: HEX.white, wordWrap: { width: w - 32 }, lineSpacing: 2,
    }));
    this.tech = tech;
  }

  /* ---------------------------------------------------------------- */
  /* Flow                                                              */
  /* ---------------------------------------------------------------- */

  private pay(): void {
    if (this.state === 'ending') return;
    audio.start();
    audio.sfx('coin');
    wallet.spend(PRICE, 'claw', 'Claw machine (2 tries)');
    this.spent += PRICE;
    this.credits += TRIES_PER_PAY;
    this.toast();
    this.tweens.add({ targets: this.spentText, scale: { from: 1.25, to: 1 }, duration: 300, ease: 'Back.out' });
    if (this.state === 'idle') this.startTry();
    this.refresh();
  }

  private toast(): void {
    const c = this.add.container(400, 128).setDepth(300).setAlpha(0);
    const g = this.add.graphics();
    g.fillStyle(0x000000, 0.4).fillRoundedRect(-104, -20, 212, 46, 23);
    g.fillStyle(0x07c160, 1).fillRoundedRect(-108, -24, 216, 46, 23);
    g.fillStyle(0xffffff, 1).fillCircle(-82, -1, 13);
    g.lineStyle(3.5, 0x07c160, 1);
    g.beginPath(); g.moveTo(-88, -1); g.lineTo(-83, 4); g.lineTo(-75, -6); g.strokePath();
    const t = this.add.text(-60, -1, 'WeChat Pay  ¥6', { fontFamily: FONT.ui, fontSize: '18px', color: '#ffffff', fontStyle: 'bold' }).setOrigin(0, 0.5);
    c.add([g, t]);
    this.tweens.add({ targets: c, alpha: 1, y: 118, duration: 180, ease: 'Back.out' });
    this.tweens.add({ targets: c, alpha: 0, y: 104, delay: 1300, duration: 300, onComplete: () => c.destroy() });
  }

  private startTry(): void {
    if (this.credits <= 0 || this.state === 'ending') return;
    this.credits--;
    this.machineCount++;
    this.state = 'aim';
    this.timeLeft = AIM_SECONDS;
    this.claw.open = 0.35;
    this.claw.grip = 0;
    if (!this.promptedTech || this.techSeen) {
      this.setCaption(this.tries === 0
        ? 'Move with A and D. Line up over a plush and press Space.'
        : `Try ${this.tries + 1}. Line up and press Space.`);
    }
    this.refresh();
  }

  private async drop(): Promise<void> {
    if (this.state !== 'aim') return;
    this.state = 'busy';
    this.holdDir = 0;
    this.tries++;
    this.refresh();
    const payout = this.machineCount >= PAYOUT;
    const c = this.claw;

    // Pick the topmost plush under the claw
    const target = this.plushes
      .filter(p => !p.gone && Math.abs(p.c.x - c.x) < p.r + 7)
      .sort((a, b) => (a.c.y - a.r) - (b.c.y - b.r))[0] ?? null;
    const downY = target ? target.c.y - 30 : FLOOR_Y - 40;

    this.trace = [];
    this.cutAt = null;
    this.tracing = true;
    this.traceStart = this.time.now;
    audio.sfx('claw');
    await this.tween({ targets: c, open: 1, duration: 300 });
    if (this.gone()) return;
    await this.tween({ targets: c, y: downY, duration: 400 + (downY - c.y) * 5, ease: 'Sine.inOut' });
    if (this.gone()) return;

    // Close the prongs
    audio.sfx('claw');
    await this.tween({ targets: c, open: target ? 0.12 : 0, grip: 100, duration: 450, ease: 'Quad.out' });
    if (this.gone()) return;

    if (!target) {
      await this.tween({ targets: c, y: TOP_Y, duration: 1100, ease: 'Sine.inOut' });
      if (this.gone()) return;
      this.setCaption('Missed. Line the claw up over a plush.');
      await this.returnHome(false);
      return;
    }

    // Lift with full grip
    this.held = target;
    target.c.setDepth(48);
    this.wob.amp = 0.06; this.wob.slip = 0; this.wob.swing = 0;
    this.setCaption(target.kind === 'hero' ? 'You got the kitten! Lifting...' : 'Got one! Lifting...');
    await this.tween({ targets: c, y: TOP_Y, duration: 1500, ease: 'Sine.inOut' });
    if (this.gone()) return;

    if (payout) {
      await this.carryAndWin(target);
      return;
    }

    // Top of the lift: the power cut
    this.cutAt = (this.time.now - this.traceStart) / 1000;
    audio.sfx('alert');
    impact(this, 0.003, 160);
    this.flickerLed();
    this.setCaption('Almost...');
    this.camFocus = { x: WORLD_W / 2, y: WORLD_H / 2, z: 1 };
    this.tweens.add({ targets: this.camFocus, x: c.x + 60, y: 200, z: 1.12, duration: 700, ease: 'Sine.inOut' });
    this.tween({ targets: c, grip: 50, open: 0.42, duration: 380, ease: 'Quad.in' });
    this.tween({ targets: this.wob, amp: 1, slip: 12, duration: 1900, ease: 'Sine.in' });
    this.tween({ targets: c, x: Math.max(MIN_X, c.x - Math.min(70, (c.x - MIN_X) * 0.5)), duration: 2100, ease: 'Sine.inOut' });
    this.heartbeat(3);
    this.tweens.add({ targets: this.redVeil, fillAlpha: 0.1, duration: 330, yoyo: true, repeat: 2 });
    await this.wait(2100);
    if (this.gone()) return;

    // Slip
    this.held = null;
    this.wob.amp = 0;
    audio.sfx('drop');
    this.nearMisses++;
    c.grip = 0;
    const p = target;
    p.c.setDepth(p.home.depth);
    this.tweens.add({ targets: p.c, x: p.home.x, y: p.home.y, rotation: p.home.rot, duration: 650, ease: 'Bounce.out' });
    this.tween({ targets: c, open: 0.7, duration: 200 });
    this.time.delayedCall(560, () => { burst(this, p.home.x, p.home.y, C.pink, 14, 90); impact(this, 0.004, 120); });
    this.flash('SO CLOSE!', HEX.gold);
    this.setCaption(this.nearMisses === 1 ? 'So close! It slipped right at the top.' : 'It slipped again. Same spot, same moment.');
    this.tweens.add({
      targets: this.camFocus, x: WORLD_W / 2, y: WORLD_H / 2, z: 1, duration: 800, ease: 'Sine.inOut',
      onComplete: () => { this.camFocus = null; this.resetCamera(); },
    });
    this.refresh();
    await this.wait(900);
    if (this.gone()) return;

    if (this.nearMisses === 1 && !this.techSeen) {
      this.promptedTech = true;
      this.setCaption('Press T to see what the technician sees.');
      audio.sfx('click');
      this.pulseTechButton();
    }
    await this.returnHome(true);
  }

  private async carryAndWin(p: Plush): Promise<void> {
    const c = this.claw;
    this.setCaption('It is holding...');
    this.heartbeat(2);
    await this.tween({ targets: c, x: REST_X, duration: 400 + (c.x - REST_X) * 7, ease: 'Sine.inOut' });
    if (this.gone()) return;
    await this.wait(250);
    // Release over the chute
    this.held = null;
    this.tween({ targets: c, open: 1, grip: 0, duration: 260 });
    audio.sfx('drop');
    p.gone = true;
    p.c.setDepth(30);
    await this.tween({ targets: p.c, y: CHUTE.y + CHUTE.h + 30, rotation: 0.6, duration: 520, ease: 'Quad.in' });
    if (this.gone()) return;
    // Pops out of the prize door
    p.c.setDepth(88).setPosition(DOOR.x + DOOR.w / 2, DOOR.y + 20).setRotation(0).setScale(0.4);
    this.tweens.add({ targets: p.c, scale: 1, y: DOOR.y + DOOR.h / 2 + 2, duration: 520, ease: 'Back.out' });
    this.won = true;
    audio.sfx('win');
    this.confetti();
    burst(this, DOOR.x + DOOR.w / 2, DOOR.y + 20, C.gold, 22, 160);
    this.flash('YOU WON!', HEX.gold);
    this.setCaption(`You won! The counter reached its payout: try 18 of 18.`);
    this.tracing = false;
    this.refresh();
    this.tween({ targets: c, open: 0.35, duration: 300 });
    this.state = 'ending';
    await this.wait(2600);
    if (!this.scene.isActive() || isModalOpen()) return;
    this.showSummary();
  }

  private async returnHome(_grabbed: boolean): Promise<void> {
    const c = this.claw;
    await this.tween({ targets: c, x: REST_X, duration: 300 + Math.abs(c.x - REST_X) * 5, ease: 'Sine.inOut' });
    if (this.gone()) return;
    await this.tween({ targets: c, open: 0.35, grip: 0, duration: 250 });
    if (this.gone()) return;
    this.tracing = false;
    this.state = 'idle';
    if (this.credits > 0) {
      await this.wait(500);
      if (this.gone() || this.state !== 'idle') return;
      this.startTry();
    } else {
      if (!(this.promptedTech && !this.techSeen)) this.setCaption('Out of tries. Scan again: ¥6 for 2 more.');
      this.refresh();
    }
  }

  private toggleTech(): void {
    if (this.state === 'ending') return;
    this.techOn = !this.techOn;
    this.tech.setVisible(this.techOn);
    this.howTo.setVisible(!this.techOn);
    this.paintButton(this.techBtn, false, this.techOn);
    audio.sfx(this.techOn ? 'whoosh' : 'click');
    if (this.techOn && !this.techSeen) {
      this.techSeen = true;
      if (this.promptedTech) {
        this.setCaption(this.nearMisses > 0
          ? 'The grip was cut to half at the top. That slip was set by the technician.'
          : 'The grip is set to drop to half power at the top.');
      }
    }
    this.refresh();
  }

  private pulseTechButton(): void {
    const r = this.techBtn.root;
    this.tweens.add({ targets: r, scale: { from: 1, to: 1.04 }, duration: 380, yoyo: true, repeat: 5, ease: 'Sine.inOut' });
    this.paintButton(this.techBtn, true);
  }

  /* ---------------------------------------------------------------- */
  /* Leaving                                                           */
  /* ---------------------------------------------------------------- */

  private resetCamera(): void {
    const cam = this.cameras.main;
    cam.setZoom(fitZoom(this.scale.width, this.scale.height));
    cam.centerOn(WORLD_W / 2, WORLD_H / 2);
  }

  private requestLeave(): void {
    if (this.state === 'ending' && !this.won) return;
    if (this.won) { if (!isModalOpen()) this.showSummary(); return; }
    this.state = 'ending';
    this.tweens.killTweensOf(this.claw);
    this.tweens.killTweensOf(this.wob);
    if (this.camFocus) { this.tweens.killTweensOf(this.camFocus); this.camFocus = null; this.resetCamera(); }
    if (this.tries > 0 || this.spent > 0) this.showSummary();
    else this.exit();
  }

  private showSummary(): void {
    const spent = this.spent;
    const ratio = spent / ONLINE_PRICE;
    const priceLine = spent > ONLINE_PRICE
      ? ` That is ${ratio.toFixed(1)} times the online price.`
      : '';
    const felt = this.won
      ? `You paid ¥${spent} for a plush that costs ¥15 online.${priceLine} Every payment was one tap.`
      : `You paid ¥${spent} and left with nothing. The plush costs ¥15 online.${priceLine} Every payment was one tap.`;
    const miss = this.nearMisses > 0
      ? ` The claw almost had it ${this.nearMisses === 1 ? 'once' : `${this.nearMisses} times`}, and each slip was set in advance.`
      : '';
    const stat = (v: string, l: string) => `<div class="debrief-stat"><div class="v">${v}</div><div class="l">${l}</div></div>`;
    showModal({
      kicker: 'WING C · THE CLAW',
      title: this.won ? 'You won the plush.' : 'The claw kept your money.',
      accent: 'pink',
      className: 'debrief-modal',
      dismissable: false,
      body: `
        <div class="debrief-grid">
          <div class="debrief-col">
            <h4>Your run</h4>
            <div class="debrief-stats">
              ${stat(`¥${spent}`, 'YOU SPENT')}
              ${stat('¥15', 'PLUSH ONLINE')}
              ${stat(String(this.tries), 'TRIES')}
              ${stat(String(this.nearMisses), 'NEAR-MISSES')}
            </div>
            <p class="debrief-felt" style="font-size:16px">${felt}${miss}</p>
            <p class="debrief-point"><b>The point:</b> The machine sells the near-miss, not the toy, and one-tap QR payment makes each new try feel painless.</p>
          </div>
          <div class="debrief-col">
            <h4>In the field</h4>
            <p class="debrief-quote" style="font-size:14px;line-height:1.45">“${XIAO_MEI_1}”</p>
            <p class="debrief-quote" style="font-size:14px;line-height:1.45;margin-top:6px">“${XIAO_MEI_2}”</p>
            <p class="debrief-who">XIAO MEI · VISITOR, FENGYUN ZAIQI, SHANGHAI</p>
            <p class="debrief-quote" style="font-size:14px;line-height:1.45;margin-top:12px">“${LIU}”</p>
            <p class="debrief-who">MANAGER LIU · FLOOR TECHNICIAN</p>
          </div>
        </div>
      `,
      actions: [{ label: 'Back to the museum', key: 'Enter', onClick: () => { closeModal(); this.exit(); } }],
    });
  }

  private exit(): void {
    this.state = 'ending';
    setHint('');
    setLocation('');
    const back = this.returnTo;
    const mgr = this.scene;
    if (mgr.isPaused(back)) mgr.resume(back);
    else if (!mgr.isActive(back) && mgr.get(back)) mgr.launch(back);
    mgr.stop();
  }

  /* ---------------------------------------------------------------- */
  /* Effects                                                           */
  /* ---------------------------------------------------------------- */

  private heartbeat(n: number): void {
    for (let i = 0; i < n; i++) {
      this.time.delayedCall(i * 660, () => {
        if (this.state === 'ending' && !this.won) return;
        audio.sfx('hit');
        this.time.delayedCall(150, () => audio.sfx('step'));
      });
    }
  }

  private flickerLed(): void {
    this.led = 1;
    this.time.addEvent({ delay: 70, repeat: 5, callback: () => { this.led = this.led ? 0 : 1; } });
    this.time.delayedCall(450, () => { this.led = 2; });
  }

  private flash(word: string, color: string): void {
    const t = this.bigWord;
    this.tweens.killTweensOf(t);
    t.setText(word).setColor(color).setAlpha(0).setScale(0.6);
    this.tweens.add({ targets: t, alpha: 1, scale: 1, duration: 260, ease: 'Back.out' });
    this.tweens.add({ targets: t, alpha: 0, delay: 1300, duration: 400 });
  }

  private confetti(): void {
    const cols = [C.pink, C.cyan, C.gold, C.green, C.violet, 0xffffff, ...PASTELS];
    for (let i = 0; i < 140; i++) {
      const x = Phaser.Math.Between(-100, 1020);
      const r = this.add.rectangle(x, Phaser.Math.Between(-140, -10), Phaser.Math.Between(5, 9), Phaser.Math.Between(8, 14), Phaser.Utils.Array.GetRandom(cols), 1)
        .setDepth(200).setRotation(Math.random() * 3);
      this.tweens.add({
        targets: r, y: WORLD_H + 60, x: x + Phaser.Math.Between(-90, 90), rotation: r.rotation + Phaser.Math.FloatBetween(-8, 8),
        duration: Phaser.Math.Between(1700, 3200), delay: Phaser.Math.Between(0, 500), ease: 'Sine.in', onComplete: () => r.destroy(),
      });
    }
  }

  /* ---------------------------------------------------------------- */
  /* Per frame                                                         */
  /* ---------------------------------------------------------------- */

  update(time: number, delta: number): void {
    const dt = Math.min(delta, 100) / 1000;
    const keys = this.keys;
    let dir = 0;
    if (this.state === 'aim' && !isModalOpen()) {
      if (keys.A.isDown || keys.LEFT.isDown) dir -= 1;
      if (keys.D.isDown || keys.RIGHT.isDown) dir += 1;
      if (dir === 0) dir = this.holdDir;
      const nx = Phaser.Math.Clamp(this.claw.x + dir * MOVE_SPEED * dt, MIN_X, MAX_X);
      if (nx !== this.claw.x) {
        this.claw.x = nx;
        this.stepClock -= dt;
        if (this.stepClock <= 0) { audio.sfx('step'); this.stepClock = 0.14; }
      }
      this.timeLeft -= dt;
      if (this.timeLeft <= 0) { this.timeLeft = 0; void this.drop(); }
    }
    this.drawStick(dir);

    // Held plush hangs from the prongs and wobbles
    if (this.held) {
      const w = Math.sin(time * 0.013) * this.wob.amp;
      this.held.c.x = this.claw.x + w * 5;
      this.held.c.y = this.claw.y + 30 + this.wob.slip;
      this.held.c.rotation = w * 0.45 + this.wob.slip * 0.01;
    }

    if (this.tracing) {
      const t = (this.time.now - this.traceStart) / 1000;
      const last = this.trace[this.trace.length - 1];
      if (!last || t - last.t > 0.04) this.trace.push({ t, g: this.claw.grip });
    }

    if (this.camFocus) {
      const cam = this.cameras.main;
      cam.setZoom(fitZoom(this.scale.width, this.scale.height) * this.camFocus.z);
      cam.centerOn(this.camFocus.x, this.camFocus.y);
    }
    this.drawClaw(time);
    this.lcdTime.setText(this.state === 'aim' ? String(Math.ceil(this.timeLeft)) : '--');
    this.lcdTime.setColor(this.state === 'aim' && this.timeLeft < 5 ? HEX.red : HEX.gold);
    if (this.techOn) this.drawGraph();
  }

  private drawClaw(time: number): void {
    const g = this.clawG;
    const { x, y, open } = this.claw;
    g.clear();
    // Carriage
    g.fillStyle(0x000000, 0.3).fillRoundedRect(x - 18, RAIL_Y - 6, 36, 16, 4);
    g.fillStyle(0xd9d6ea, 1).fillRoundedRect(x - 17, RAIL_Y - 8, 34, 15, 4);
    g.fillStyle(0xffffff, 0.6).fillRect(x - 13, RAIL_Y - 6, 26, 2);
    g.fillStyle(C.pink, 1).fillCircle(x - 9, RAIL_Y, 2).fillCircle(x + 9, RAIL_Y, 2);
    // Cable
    g.lineStyle(2, 0xbfc3d9, 1).lineBetween(x, RAIL_Y + 6, x, y - 8);

    const steel = 0xc9c6dc, hi = 0xffffff;
    const a = 0.22 + open * 0.75;
    // Back prong
    g.lineStyle(5, 0x8a86a3, 1);
    g.beginPath(); g.moveTo(x, y + 6); g.lineTo(x, y + 26); g.lineTo(x - 2, y + 38); g.strokePath();
    for (const s of [-1, 1]) {
      const bx = x + s * 9, by = y + 6;
      const ex = bx + s * Math.sin(a) * 25, ey = by + Math.cos(a) * 25;
      const b = a - 1.3;
      const tx = ex + s * Math.sin(b) * 20, ty = ey + Math.cos(b) * 20;
      g.lineStyle(6, 0x55506e, 1);
      g.beginPath(); g.moveTo(bx, by); g.lineTo(ex, ey); g.lineTo(tx, ty); g.strokePath();
      g.lineStyle(3, steel, 1);
      g.beginPath(); g.moveTo(bx, by); g.lineTo(ex, ey); g.lineTo(tx, ty); g.strokePath();
      g.lineStyle(1, hi, 0.7).lineBetween(bx, by, ex, ey);
      g.fillStyle(steel, 1).fillCircle(ex, ey, 3.2).fillCircle(tx, ty, 2.6);
    }
    // Hub
    g.fillStyle(0x55506e, 1).fillRoundedRect(x - 16, y - 9, 32, 18, 6);
    g.fillStyle(steel, 1).fillRoundedRect(x - 15, y - 10, 30, 16, 6);
    g.fillStyle(hi, 0.5).fillRect(x - 11, y - 8, 22, 2);
    // Grip LED
    const grip = this.claw.grip;
    let ledCol = 0x3a3550;
    if (this.led === 1) ledCol = C.red;
    else if (grip >= 90) ledCol = C.green;
    else if (grip > 0) ledCol = C.amber;
    g.fillStyle(ledCol, 1).fillCircle(x, y - 2, 3.5);
    if (ledCol !== 0x3a3550) g.fillStyle(ledCol, 0.3).fillCircle(x, y - 2, 8);
    // Sparks when the power is weak and a plush is held
    if (this.held && grip < 90 && grip > 0 && Math.sin(time * 0.05) > 0.6) {
      g.fillStyle(C.gold, 0.9).fillCircle(x + Phaser.Math.Between(-14, 14), y + Phaser.Math.Between(-6, 8), 1.6);
    }
  }

  private drawGraph(): void {
    const g = this.graph;
    const x0 = 622, y0 = 310, w = 260, h = 96;
    g.clear();
    g.fillStyle(0x000000, 0.4).fillRoundedRect(x0, y0, w, h, 6);
    g.lineStyle(1, 0xffffff, 0.08);
    for (let i = 1; i < 4; i++) g.lineBetween(x0, y0 + (h * i) / 4, x0 + w, y0 + (h * i) / 4);
    const py = (v: number) => y0 + h - 8 - (v / 100) * (h - 16);
    // 100 and 50 guides
    g.lineStyle(1, C.green, 0.35).lineBetween(x0, py(100), x0 + w, py(100));
    g.lineStyle(1, C.red, 0.5);
    for (let xx = x0; xx < x0 + w; xx += 8) g.lineBetween(xx, py(50), xx + 4, py(50));
    const px = (t: number) => x0 + 6 + (t / GRAPH_SECONDS) * (w - 12);
    if (this.cutAt !== null) {
      g.fillStyle(C.red, 0.18).fillRect(px(this.cutAt) - 2, y0 + 2, 4, h - 4);
    }
    if (this.trace.length > 1) {
      g.lineStyle(6, C.amber, 0.18);
      g.beginPath();
      this.trace.forEach((p, i) => { const X = Math.min(px(p.t), x0 + w - 4); i ? g.lineTo(X, py(p.g)) : g.moveTo(X, py(p.g)); });
      g.strokePath();
      g.lineStyle(2, C.amber, 1);
      g.beginPath();
      this.trace.forEach((p, i) => { const X = Math.min(px(p.t), x0 + w - 4); i ? g.lineTo(X, py(p.g)) : g.moveTo(X, py(p.g)); });
      g.strokePath();
      const last = this.trace[this.trace.length - 1];
      g.fillStyle(C.amber, 1).fillCircle(Math.min(px(last.t), x0 + w - 4), py(last.g), 3);
    }
  }


  /* ---------------------------------------------------------------- */
  /* HUD                                                               */
  /* ---------------------------------------------------------------- */

  private setCaption(s: string): void {
    if (this.caption.text === s) return;
    this.caption.setText(s);
    this.caption.setFontSize(s.length > 62 ? 15 : 17);
    this.tweens.add({ targets: this.caption, alpha: { from: 0.2, to: 1 }, duration: 250 });
  }

  private refresh(): void {
    this.spentText.setText(`¥${this.spent}`);
    this.triesText.setText(String(this.tries));
    this.lcdCredit.setText(String(this.credits));

    // Spent vs online price bar
    const x = 38, y = 262, w = 158, h = 12;
    const scale = Math.max(30, this.spent * 1.1);
    const g = this.gapBar;
    g.clear();
    g.fillStyle(0xffffff, 0.08).fillRoundedRect(x, y, w, h, 6);
    if (this.spent > 0) g.fillStyle(this.spent > ONLINE_PRICE ? C.pink : C.amber, 1).fillRoundedRect(x, y, Math.max(8, (this.spent / scale) * w), h, 6);
    const mx = x + (ONLINE_PRICE / scale) * w;
    g.fillStyle(C.teal, 1).fillRect(mx - 1.5, y - 5, 3, h + 10);
    this.gapText.setText(this.spent > ONLINE_PRICE
      ? `¥${this.spent - ONLINE_PRICE} more than the plush`
      : `¥${this.spent} spent vs ¥15 online`);
    this.gapText.setColor(this.spent > ONLINE_PRICE ? HEX.pink : HEX.muted);

    // Technician panel
    const n = Math.min(this.machineCount, PAYOUT);
    this.techCount.setText(`try ${n} of 18`);
    const tb = this.techBar;
    tb.clear();
    const bx = 622, by = 244, seg = 260 / PAYOUT;
    for (let i = 0; i < PAYOUT; i++) {
      const col = i === PAYOUT - 1 ? C.gold : i < n ? C.amber : 0x3a3020;
      tb.fillStyle(col, i < n || i === PAYOUT - 1 ? 1 : 0.8).fillRect(bx + i * seg + 1, by, seg - 2, 8);
    }
    const payoutNow = this.machineCount >= PAYOUT && this.state !== 'idle';
    this.techGrip.setText(payoutNow ? '100%  PAYOUT' : '50%');
    this.techGrip.setColor(payoutNow ? HEX.green : HEX.red);

    // Pay prompt pulses only when out of credits
    const needPay = this.credits === 0 && this.state === 'idle';
    this.pulses.forEach(p => (needPay ? p.resume() : p.pause()));
    if (!needPay) this.qr.setScale(1);
    this.payBtn.setAlpha(this.state === 'ending' ? 0.6 : 1);
  }

  /* ---------------------------------------------------------------- */
  /* Async helpers                                                     */
  /* ---------------------------------------------------------------- */

  private tween(cfg: Phaser.Types.Tweens.TweenBuilderConfig): Promise<void> {
    return new Promise(resolve => {
      this.tweens.add({ ...cfg, onComplete: () => resolve(), onStop: () => resolve() });
    });
  }

  private wait(ms: number): Promise<void> {
    // Tween-based so waits stay in step with the tweens they follow
    return new Promise(resolve => {
      this.tweens.addCounter({ from: 0, to: 1, duration: ms, onComplete: () => resolve(), onStop: () => resolve() });
    });
  }

  /** True when the visitor has left mid-sequence. */
  private gone(): boolean {
    return this.state === 'ending' || !this.scene.isActive();
  }
}
