/**
 * The museum hall. A long neon arcade the visitor walks through, left to right:
 * entrance, three wings (SKILL, TIME, SPEED), backstage, and the exit.
 * Scene key stays 'Arcade' because every game returns here by that name.
 */
import Phaser from 'phaser';
import { ensureTextures } from '../assets';
import { audio } from '../audio';
import { setHint, setLocation } from '../view';
import { TEX_SCALE, spawnSim } from '../sims';
import { FONT, HEX, C, neonText, label, cinematicCamera, toHex } from '../theme';
import { wallet } from '../wallet';
import { speech } from '../speech';
import {
  showModal, closeModal, showDialogue, showExhibit, showGameIntro, isModalOpen, type GameIntro,
} from '../ui/modals';
import { NPCS } from '../data/dialogues';
import {
  WINGS, HALL_W, ENTRANCE, NPC_PLACES, VENUES, BUY_A_WIN, PRICE_OF_A_MINUTE, LICENSE_WALL,
  TOKEN_TRAY, DESIGN_NOTES, CONCLUSION, REAL_SPEND, wingAt, type Wing, type WingId,
} from '../data/museum';
import { INTRO as BATTLE_INTRO } from './BattleScene';
import { INTRO as REALM_INTRO } from './RealmScene';
import { INTRO as FRONTIER_INTRO } from './FrontierScene';
import { buildHall, makeProps, makeNpcSims, FLOOR_Y, WALL_LINE, TOP, BOTTOM } from './hub/art';

const VIEW_H = 520;
const MIN_Y = 318, MAX_Y = 500;
const SPEED = 240;

type Kind = 'cabinet' | 'npc' | 'exhibit' | 'claw' | 'exit';

interface Station {
  id: string;
  kind: Kind;
  wing: WingId;
  /** Where the visitor stands to use it. */
  x: number;
  y: number;
  /** Prompt bubble position. */
  px: number;
  py: number;
  verb: string;
  name: string;
  color: number;
  use: () => void;
  /** Clickable area in world coords. */
  hit: Phaser.Geom.Rectangle;
  /** Shown once visited. */
  tick?: Phaser.GameObjects.Text;
  sprite?: Phaser.GameObjects.Image;
  /** Hidden once visited (e.g. an NPC's plumbob). */
  extra?: Phaser.GameObjects.Image;
}

const CABINETS: { id: 'battle' | 'realm' | 'frontier'; x: number; wing: WingId; scene: string; intro: GameIntro; color: number }[] = [
  { id: 'battle', x: 1270, wing: 'skill', scene: 'Battle', intro: BATTLE_INTRO, color: 0xffb347 },
  { id: 'realm', x: 2280, wing: 'time', scene: 'Realm', intro: REALM_INTRO, color: 0xa47bff },
  { id: 'frontier', x: 3160, wing: 'speed', scene: 'Frontier', intro: FRONTIER_INTRO, color: 0x3ee6ff },
];

export class ArcadeScene extends Phaser.Scene {
  private player!: Phaser.Physics.Arcade.Sprite;
  private shadow!: Phaser.GameObjects.Ellipse;
  private plumbob!: Phaser.GameObjects.Image;
  private keys!: Record<string, Phaser.Input.Keyboard.Key>;
  private cursors!: Phaser.Types.Input.Keyboard.CursorKeys;

  private stations: Station[] = [];
  private nearest: Station | null = null;
  private target: { x: number; y: number; station?: Station } | null = null;
  private prompt!: Phaser.GameObjects.Container;
  private promptText!: Phaser.GameObjects.Text;
  private promptBg!: Phaser.GameObjects.Graphics;
  private promptKey!: Phaser.GameObjects.Text;
  private promptFor = '';
  private selector!: Phaser.GameObjects.Graphics;
  private hud: HTMLElement | null = null;
  private camX = 0;
  private from: string | null = null;
  private currentWing: Wing | null = null;
  private walkPhase = 0;
  private unsubWallet: (() => void) | null = null;

  constructor() { super('Arcade'); }

  init(data: { from?: string }): void {
    this.from = data?.from ?? null;
  }

  create(): void {
    // Reset everything: Phaser reuses this instance between visits
    this.stations = [];
    this.nearest = null;
    this.target = null;
    this.currentWing = null;
    this.walkPhase = 0;

    ensureTextures(this);
    makeProps(this);
    makeNpcSims(this);
    audio.setMode('arcade');

    buildHall(this);
    this.buildEntrance();
    for (const w of WINGS) this.buildWingSigns(w);
    this.buildFacades();
    this.buildCabinets();
    this.buildDataStations();
    this.buildNpcs();
    this.buildExit();
    this.buildAmbience();
    this.buildPlayer();
    this.buildPrompt();
    this.buildInput();
    this.buildHud();
    this.setupCamera();
    cinematicCamera(this, { bloom: 0.8, vignette: 0 });
    (this.cameras.main as any).postFX?.addVignette(0.5, 0.5, 1.15, 0.22);

    if (this.from) {
      const v = `cab-${this.from}`;
      this.markVisited(v);
      this.cameras.main.fadeIn(500, 7, 6, 15);
    } else {
      this.cameras.main.fadeIn(900, 7, 6, 15);
    }
    this.refreshTicks();

    this.events.on(Phaser.Scenes.Events.RESUME, this.onResume, this);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, this.onShutdown, this);
  }

  /* ---------------------------------------------------------------- */
  /* Visited state, kept for the whole visit in the game registry      */
  /* ---------------------------------------------------------------- */

  private visited(): Set<string> {
    let s = this.registry.get('visited') as Set<string> | undefined;
    if (!s) { s = new Set(); this.registry.set('visited', s); }
    return s;
  }

  private markVisited(id: string): void {
    this.visited().add(id);
    this.refreshTicks();
    this.updateHud();
  }

  private refreshTicks(): void {
    const v = this.visited();
    for (const st of this.stations) {
      if (st.tick) st.tick.setVisible(v.has(st.id));
      if (st.extra) st.extra.setVisible(!v.has(st.id));
    }
  }

  /* ---------------------------------------------------------------- */
  /* Entrance                                                          */
  /* ---------------------------------------------------------------- */

  private buildEntrance(): void {
    const cx = 300;
    label(this, cx, 34, ENTRANCE.kicker, { font: FONT.mono, size: 12, color: HEX.muted, align: 'center' })
      .setOrigin(0.5, 0).setDepth(5).setLetterSpacing(2);
    const lines = ENTRANCE.title.split('\n');
    const t1 = neonText(this, cx, 74, lines[0], { size: 38, color: '#fff3d1', glow: HEX.gold, blur: 18 }).setDepth(5);
    const t2 = neonText(this, cx, 114, lines[1], { size: 38, color: '#ffe0f6', glow: HEX.pink, blur: 18 }).setDepth(5);
    this.flicker(t1, 0.9);
    this.flicker(t2, 0.7);
    label(this, cx, 142, ENTRANCE.thesis, { size: 13.5, color: '#d8d4f0', align: 'center', wrap: 500 })
      .setOrigin(0.5, 0).setDepth(5);

    ENTRANCE.teaser.forEach((t, i) => {
      const x = cx - 150 + i * 150;
      neonText(this, x, 212, t.word, { size: 20, color: '#ffffff', glow: toHex(t.color), blur: 14 }).setDepth(5);
      label(this, x, 228, t.line, { size: 12, color: toHex(t.color), align: 'center', font: FONT.mono }).setOrigin(0.5, 0).setDepth(5);
    });

    // Painted floor instructions near the spawn point
    const decal = this.add.container(260, 462).setDepth(3);
    const g = this.add.graphics();
    g.fillStyle(0x0d0b1a, 0.9).fillRoundedRect(-215, -22, 430, 44, 22);
    g.lineStyle(2, C.gold, 0.7).strokeRoundedRect(-215, -22, 430, 44, 22);
    decal.add(g);
    decal.add(label(this, 0, 0, 'WALK WITH A/D OR ←/→   ·   PRESS E TO INTERACT', { font: FONT.mono, size: 13, color: HEX.gold, align: 'center' }).setOrigin(0.5));
    // Pulsing arrow pointing into the hall
    const arrow = neonText(this, 560, 462, '→', { size: 34, color: HEX.gold, font: FONT.ui }).setDepth(3);
    this.tweens.add({ targets: arrow, x: 590, alpha: 0.4, duration: 700, yoyo: true, repeat: -1, ease: 'Sine.inOut' });

    // Fieldwork map on its monitor (frame is in the wall texture at 560..730, 140..232)
    const mx = 645, my = 186;
    const map = this.add.graphics().setDepth(4);
    map.lineStyle(3, C.cyan, 0.5);
    map.beginPath(); map.moveTo(578, 210); map.lineTo(610, 196); map.lineTo(650, 200); map.lineTo(700, 178); map.lineTo(716, 182); map.strokePath();
    label(this, mx, 150, 'WHERE I WENT', { font: FONT.mono, size: 12, color: HEX.gold, align: 'center' }).setOrigin(0.5, 0).setDepth(4);
    const pin = (x: number, y: number, name: string, sub: string) => {
      const p = this.add.image(x, y, 'hub_pin').setScale(1 / 3).setOrigin(0.5, 1).setDepth(4);
      this.tweens.add({ targets: p, y: y - 3, duration: 900, yoyo: true, repeat: -1, ease: 'Sine.inOut', delay: x });
      label(this, x, y + 4, name, { size: 12, bold: true, align: 'center' }).setOrigin(0.5, 0).setDepth(4);
      label(this, x, y + 19, sub, { size: 12, color: HEX.muted, align: 'center', font: FONT.mono }).setOrigin(0.5, 0).setDepth(4);
    };
    pin(598, 196, 'Nanjing', '1 arcade');
    pin(698, 176, 'Shanghai', '2 arcades');

    this.addStation({
      id: 'map', kind: 'exhibit', wing: 'entrance', x: mx, y: 330, px: mx, py: 128, verb: 'Look at', name: 'the fieldwork map',
      color: C.gold, hit: new Phaser.Geom.Rectangle(560, 140, 170, 100),
      use: () => showExhibit({
        kicker: 'FIELDWORK · 3 ARCADES · 8 INTERVIEWS', title: 'Where the research happened', accent: 'gold',
        tabs: [
          { id: 'v-skill', label: 'Street Jiliehuo', content: VENUES.skill },
          { id: 'v-time', label: 'Castle in the Sky', content: VENUES.time },
          { id: 'v-speed', label: 'Fengyun Zaiqi', content: VENUES.speed },
        ],
        onClose: () => this.markVisited('map'),
      }),
    });
  }

  /* ---------------------------------------------------------------- */
  /* Wing signage                                                      */
  /* ---------------------------------------------------------------- */

  private buildWingSigns(w: Wing): void {
    if (!w.word) return;
    const cx = (w.x0 + w.x1) / 2;
    const hex = toHex(w.color);
    label(this, cx, 34, `${w.tag}${w.pair ? '  /  ARCADE + ' + w.pair.toUpperCase() : ''}`, { font: FONT.mono, size: 12, color: hex, align: 'center' })
      .setOrigin(0.5, 0).setDepth(5).setLetterSpacing(2);
    const word = neonText(this, cx, 72, w.word, { size: 44, color: '#ffffff', glow: hex, blur: 22 }).setDepth(5);
    this.flicker(word, 0.4);
    label(this, cx, 100, w.headline, { size: 15, color: '#ece9ff', align: 'center', wrap: 600, bold: true })
      .setOrigin(0.5, 0).setDepth(5);
  }

  /** Real neon sometimes stutters. */
  private flicker(obj: Phaser.GameObjects.Text, chance: number): void {
    this.time.addEvent({
      delay: 2600 + Math.random() * 3000, loop: true, callback: () => {
        if (Math.random() > chance) return;
        this.tweens.chain({ targets: obj, tweens: [
          { alpha: 0.35, duration: 50 }, { alpha: 1, duration: 60 }, { alpha: 0.5, duration: 40 }, { alpha: 1, duration: 80 },
        ] });
      },
    });
  }

  /* ---------------------------------------------------------------- */
  /* Venue shopfronts                                                  */
  /* ---------------------------------------------------------------- */

  private buildFacades(): void {
    for (const w of WINGS) {
      if (!w.venue) continue;
      const fx = w.x0 + 40, fw = 250, cx = fx + fw / 2;
      const hex = toHex(w.color);
      const sign = neonText(this, cx, 157, `${w.venue.zh}  ${w.venue.name.toUpperCase()}`, {
        size: 14, color: '#ffffff', glow: hex, blur: 10, font: `${FONT.display}, "Noto Sans CJK SC", "PingFang SC", "Microsoft YaHei", sans-serif`,
      }).setDepth(5);
      this.flicker(sign, 0.5);
      const plate = label(this, cx, 262, `RECREATED FROM FIELDWORK · ${w.venue.city.toUpperCase()}`, { font: FONT.mono, size: 12, color: hex, align: 'center' })
        .setOrigin(0.5, 0).setDepth(4).setAlpha(0.85);
      plate.setLetterSpacing(1);
      const key = w.id as 'skill' | 'time' | 'speed';
      this.addStation({
        id: `venue-${key}`, kind: 'exhibit', wing: w.id, x: cx, y: 330, px: cx, py: 124, verb: 'Step into', name: w.venue.name,
        color: w.color, hit: new Phaser.Geom.Rectangle(fx, 138, fw, 115),
        use: () => showExhibit({
          kicker: `${w.tag} · ${w.word} · THE REAL PLACE`, title: w.venue!.name, accent: w.accent,
          tabs: [{ id: `ven-${key}`, label: w.venue!.name, content: VENUES[key] }],
          onClose: () => this.markVisited(`venue-${key}`),
        }),
      });
    }
  }

  /* ---------------------------------------------------------------- */
  /* Game cabinets                                                     */
  /* ---------------------------------------------------------------- */

  private buildCabinets(): void {
    for (const cab of CABINETS) {
      const x = cab.x;
      const hex = toHex(cab.color);
      // Spotlight from the ceiling
      const light = this.add.graphics().setDepth(3).setBlendMode(Phaser.BlendModes.ADD);
      light.fillStyle(cab.color, 0.07).fillTriangle(x - 18, -20, x + 18, -20, x + 120, WALL_LINE + 40);
      light.fillStyle(cab.color, 0.07).fillTriangle(x - 18, -20, x - 120, WALL_LINE + 40, x + 120, WALL_LINE + 40);
      light.fillStyle(cab.color, 0.18).fillEllipse(x, WALL_LINE + 14, 220, 46);
      this.tweens.add({ targets: light, alpha: 0.65, duration: 1600 + Math.random() * 600, yoyo: true, repeat: -1, ease: 'Sine.inOut' });

      const CS = 1.15;
      const scale = CS / TEX_SCALE;
      const sprite = this.add.image(x, WALL_LINE, `cabinet_${cab.id}`).setOrigin(0.5, 1).setScale(scale).setDepth(WALL_LINE);
      const top = WALL_LINE - 120 * CS;
      // Living screen, over the cabinet's own screen (14,32,62x42 in a 90x120 cabinet)
      const scr = { x: x - 45 * CS + 14 * CS, y: top + 32 * CS, w: 62 * CS, h: 42 * CS };
      const screen = this.add.graphics().setDepth(WALL_LINE + 1);
      this.drawAttract(screen, cab.id, scr, 0);
      this.time.addEvent({ delay: 120, loop: true, callback: () => this.drawAttract(screen, cab.id, scr, this.time.now) });
      const insert = label(this, x, scr.y + scr.h - 14, 'INSERT COIN', { font: FONT.mono, size: 12, color: hex, align: 'center' })
        .setOrigin(0.5, 0).setDepth(WALL_LINE + 2);
      this.tweens.add({ targets: insert, alpha: 0.15, duration: 520, yoyo: true, repeat: -1, ease: 'Stepped' });

      // Marquee label
      neonText(this, x, top - 12, `${cab.intro.number} ${cab.intro.title.toUpperCase()}`, { size: 15, color: '#ffffff', glow: hex, blur: 12 })
        .setDepth(WALL_LINE + 2);
      const tick = label(this, x + 62, top + 16, 'PLAYED ✓', { font: FONT.mono, size: 12, color: HEX.teal })
        .setOrigin(0, 0.5).setDepth(WALL_LINE + 2).setVisible(false);

      this.addStation({
        id: `cab-${cab.id}`, kind: 'cabinet', wing: cab.wing, x, y: 334, px: x, py: top - 34, verb: 'Play', name: cab.intro.title,
        color: cab.color, hit: new Phaser.Geom.Rectangle(x - 60, top - 20, 120, WALL_LINE - top + 24), tick, sprite,
        use: () => {
          const intro: GameIntro = { ...cab.intro, realWorld: `${cab.intro.realWorld}. ${DESIGN_NOTES[cab.id]}` };
          showGameIntro(intro, () => {
            audio.sfx('coin');
            this.cameras.main.fadeOut(350, 7, 6, 15);
            this.cameras.main.once(Phaser.Cameras.Scene2D.Events.FADE_OUT_COMPLETE, () => this.scene.start(cab.scene));
          });
        },
      });
    }
  }

  /** Tiny looping "attract mode" animation on each cabinet screen. */
  private drawAttract(g: Phaser.GameObjects.Graphics, id: string, r: { x: number; y: number; w: number; h: number }, t: number): void {
    g.clear();
    const s = t / 1000;
    g.fillStyle(0x02010a, 1).fillRect(r.x, r.y, r.w, r.h);
    if (id === 'battle') {
      // Two heroes trading hits in a lane
      g.fillStyle(0x1a2a1a, 1).fillRect(r.x + r.w / 2 - 10, r.y, 20, r.h);
      const a = Math.sin(s * 3) * 6;
      g.fillStyle(0x3ee6ff, 1).fillCircle(r.x + r.w / 2 - 4, r.y + r.h - 14 + a, 4);
      g.fillStyle(0xff4d6d, 1).fillCircle(r.x + r.w / 2 + 4, r.y + 12 - a, 4);
      if (Math.sin(s * 6) > 0.7) g.fillStyle(0xffd078, 1).fillCircle(r.x + r.w / 2, r.y + r.h / 2, 3);
    } else if (id === 'realm') {
      // A crystal spinning over a starfield
      for (let i = 0; i < 8; i++) g.fillStyle(0xffffff, 0.4 + 0.4 * Math.sin(s * 2 + i)).fillCircle(r.x + ((i * 23) % r.w), r.y + ((i * 13) % (r.h - 14)), 0.8);
      const w = 8 * Math.abs(Math.cos(s * 1.6)) + 2;
      const cx = r.x + r.w / 2, cy = r.y + r.h / 2 - 6;
      g.fillStyle(0xa47bff, 1).fillTriangle(cx, cy - 12, cx + w, cy, cx - w, cy);
      g.fillStyle(0x6b3fd0, 1).fillTriangle(cx, cy + 12, cx + w, cy, cx - w, cy);
    } else {
      // A town with a countdown bar
      const cx = r.x + r.w / 2, cy = r.y + r.h / 2;
      g.fillStyle(0x2a2a18, 1).fillRect(r.x, cy + 6, r.w, r.h / 2 - 6);
      g.fillStyle(0xffb347, 1).fillRect(cx - 7, cy - 2, 14, 9);
      g.fillStyle(0xff4d6d, 1).fillTriangle(cx - 9, cy - 2, cx + 9, cy - 2, cx, cy - 10);
      const p = (s % 4) / 4;
      g.fillStyle(0x3ee6ff, 1).fillRect(r.x + 4, r.y + 4, (r.w - 8) * p, 3);
    }
    g.fillStyle(0xffffff, 0.06).fillRect(r.x, r.y, r.w, r.h / 2);
  }

  /* ---------------------------------------------------------------- */
  /* Data stations                                                     */
  /* ---------------------------------------------------------------- */

  private buildDataStations(): void {
    // Wing A monitor: can you buy a win? (frame 1430..1610, 140..232)
    {
      const cx = 1520;
      label(this, cx, 150, 'CAN YOU BUY A WIN?', { font: FONT.display, size: 14, color: HEX.amber, align: 'center' }).setOrigin(0.5, 0).setDepth(4);
      const rowA = label(this, 1446, 178, 'ARCADE', { font: FONT.mono, size: 12, color: HEX.muted }).setDepth(4);
      const rowB = label(this, 1446, 202, 'PHONE', { font: FONT.mono, size: 12, color: HEX.muted }).setDepth(4);
      const ansA = neonText(this, 1570, 186, 'NO', { size: 16, color: HEX.teal }).setDepth(4);
      const ansB = neonText(this, 1570, 210, 'SORT OF', { size: 14, color: HEX.red }).setDepth(4);
      this.tweens.add({ targets: ansB, alpha: 0.35, duration: 700, yoyo: true, repeat: -1 });
      void rowA; void rowB; void ansA;
      this.addStation({
        id: 'buy-a-win', kind: 'exhibit', wing: 'skill', x: cx, y: 330, px: cx, py: 124, verb: 'Read', name: 'Can you buy a win?',
        color: C.amber, hit: new Phaser.Geom.Rectangle(1430, 140, 180, 110),
        use: () => showExhibit({ kicker: 'WING A · SKILL · FINDING', title: 'Can you buy a win?', accent: 'gold',
          tabs: [{ id: 'baw', label: 'Compare', content: BUY_A_WIN }], onClose: () => this.markVisited('buy-a-win') }),
      });
    }

    // Wing B: marble pusher, the price of a minute
    {
      const x = 2110;
      const img = this.add.image(x, WALL_LINE, 'hub_marbles').setOrigin(0.5, 1).setScale(1.0 / 3).setDepth(WALL_LINE);
      neonText(this, x, WALL_LINE - 166, 'THE PRICE OF A MINUTE', { size: 13, color: '#ffffff', glow: HEX.violet, blur: 10 }).setDepth(WALL_LINE + 2);
      const counter = label(this, x + 31, WALL_LINE - 24, '45:00', { font: FONT.mono, size: 12, color: HEX.violet })
        .setOrigin(0.5).setDepth(WALL_LINE + 2);
      // Marbles trickle down the tiers forever
      this.time.addEvent({ delay: 380, loop: true, callback: () => {
        const m = this.add.circle(x - 40 + Math.random() * 80, WALL_LINE - 120, 2.6, 0xe8e6ff).setDepth(WALL_LINE + 1);
        this.tweens.add({ targets: m, y: WALL_LINE - 52, x: m.x + (Math.random() * 10 - 5), duration: 900, ease: 'Bounce.out', onComplete: () => m.destroy() });
      } });
      let secs = 45 * 60;
      this.time.addEvent({ delay: 1000, loop: true, callback: () => {
        secs = secs > 0 ? secs - 1 : 45 * 60;
        counter.setText(`${String(Math.floor(secs / 60)).padStart(2, '0')}:${String(secs % 60).padStart(2, '0')}`);
      } });
      const tick = label(this, x + 50, WALL_LINE - 150, '✓', { size: 14, color: HEX.teal }).setDepth(WALL_LINE + 2).setVisible(false);
      this.addStation({
        id: 'marbles', kind: 'exhibit', wing: 'time', x, y: 332, px: x, py: WALL_LINE - 188, verb: 'Drop marbles in', name: 'the pusher',
        color: C.violet, hit: new Phaser.Geom.Rectangle(x - 62, WALL_LINE - 172, 124, 176), tick, sprite: img,
        use: () => {
          audio.sfx('coin');
          for (let i = 0; i < 24; i++) {
            const m = this.add.circle(x - 40 + Math.random() * 80, WALL_LINE - 140, 2.8, 0xffffff).setDepth(WALL_LINE + 1);
            this.tweens.add({ targets: m, y: WALL_LINE - 40, x: m.x + (Math.random() * 20 - 10), duration: 700 + Math.random() * 600, delay: i * 30, ease: 'Bounce.out', onComplete: () => m.destroy() });
          }
          this.time.delayedCall(650, () => showExhibit({ kicker: 'WING B · TIME · FINDING', title: 'The price of a minute', accent: 'violet',
            tabs: [{ id: 'pom', label: 'Minutes per yuan', content: PRICE_OF_A_MINUTE }], onClose: () => this.markVisited('marbles') }));
        },
      });
    }

    // Wing C: the claw machine (its own playable scene)
    {
      const x = 2990;
      const img = this.add.image(x, WALL_LINE, 'hub_claw').setOrigin(0.5, 1).setScale(0.95 / 3).setDepth(WALL_LINE);
      const glow = this.add.ellipse(x, WALL_LINE + 6, 120, 30, C.pink, 0.25).setDepth(3).setBlendMode(Phaser.BlendModes.ADD);
      this.tweens.add({ targets: glow, alpha: 0.08, duration: 800, yoyo: true, repeat: -1 });
      neonText(this, x, WALL_LINE - 164, 'TRY THE CLAW', { size: 14, color: '#ffffff', glow: HEX.pink, blur: 12 }).setDepth(WALL_LINE + 2);
      const price = label(this, x, WALL_LINE + 6, '¥6 · 2 TRIES · SCAN TO PAY', { font: FONT.mono, size: 12, color: HEX.pink, align: 'center' })
        .setOrigin(0.5, 0).setDepth(WALL_LINE + 2);
      this.tweens.add({ targets: price, alpha: 0.4, duration: 900, yoyo: true, repeat: -1 });
      const tick = label(this, x + 44, WALL_LINE - 140, '✓', { size: 14, color: HEX.teal }).setDepth(WALL_LINE + 2).setVisible(false);
      this.addStation({
        id: 'claw', kind: 'claw', wing: 'speed', x, y: 334, px: x, py: WALL_LINE - 214, verb: 'Play', name: 'the claw machine',
        color: C.pink, hit: new Phaser.Geom.Rectangle(x - 44, WALL_LINE - 172, 88, 176), tick, sprite: img,
        use: () => {
          this.markVisited('claw');
          audio.sfx('coin');
          this.hideHud(true);
          setHint('');
          this.scene.pause();
          this.scene.setVisible(false);
          this.scene.launch('Claw', { returnTo: 'Arcade' });
        },
      });
    }

    // Backstage: the token tray
    {
      const x = 3560;
      const img = this.add.image(x, WALL_LINE, 'hub_tray').setOrigin(0.5, 1).setScale(1.1 / 3).setDepth(WALL_LINE);
      neonText(this, x, WALL_LINE - 148, 'LISTEN', { size: 14, color: '#ffffff', glow: HEX.teal, blur: 10 }).setDepth(WALL_LINE + 2);
      label(this, x, WALL_LINE - 134, 'THE SOUND QR\nCODES REPLACED', { font: FONT.mono, size: 12, color: HEX.teal, align: 'center' })
        .setOrigin(0.5, 0).setDepth(WALL_LINE + 2);
      const tick = label(this, x + 46, WALL_LINE - 70, '✓', { size: 14, color: HEX.teal }).setDepth(WALL_LINE + 2).setVisible(false);
      this.addStation({
        id: 'tray', kind: 'exhibit', wing: 'backstage', x, y: 332, px: x, py: WALL_LINE - 166, verb: 'Pour', name: '50 tokens',
        color: C.teal, hit: new Phaser.Geom.Rectangle(x - 45, WALL_LINE - 104, 90, 108), tick, sprite: img,
        use: () => {
          // A long clatter of tokens, then the quote
          for (let i = 0; i < 50; i++) {
            this.time.delayedCall(i * 26 + Math.random() * 30, () => audio.sfx(i % 3 ? 'step' : 'coin'));
            const c = this.add.ellipse(x - 20 + Math.random() * 40, WALL_LINE - 120, 6, 3.5, 0xffd078).setDepth(WALL_LINE + 1);
            this.tweens.add({ targets: c, y: WALL_LINE - 78 + Math.random() * 6, x: c.x + Math.random() * 16 - 8, duration: 500, delay: i * 24, ease: 'Bounce.out',
              onComplete: () => this.tweens.add({ targets: c, alpha: 0, duration: 800, delay: 600, onComplete: () => c.destroy() }) });
          }
          this.time.delayedCall(1500, () => showExhibit({ kicker: 'BACKSTAGE · RULES', title: 'The sound of fifty tokens', accent: 'teal',
            tabs: [{ id: 'tt', label: 'Manager Liu', content: TOKEN_TRAY }], onClose: () => this.markVisited('tray') }));
        },
      });
    }

    // Backstage: the license wall (frame 3650..3850, 140..232)
    {
      const cx = 3750;
      label(this, cx, 148, 'WAITING FOR A LICENSE', { font: FONT.display, size: 13, color: HEX.teal, align: 'center' }).setOrigin(0.5, 0).setDepth(4);
      label(this, 3664, 172, 'MONEY LEFT', { font: FONT.mono, size: 12, color: HEX.muted }).setDepth(4);
      label(this, 3664, 200, 'LICENSE WAIT', { font: FONT.mono, size: 12, color: HEX.muted }).setDepth(4);
      const bars = this.add.graphics().setDepth(4);
      const money = label(this, 3836, 186, '12 mo', { font: FONT.mono, size: 12, color: HEX.teal }).setOrigin(1, 0).setDepth(4);
      const wait = label(this, 3836, 214, '0 mo', { font: FONT.mono, size: 12, color: HEX.red }).setOrigin(1, 0).setDepth(4);
      let m = 0;
      this.time.addEvent({ delay: 300, loop: true, callback: () => {
        m = (m + 0.4) % 22;
        const month = Math.min(18, m);
        const left = Math.max(0, 12 - month);
        bars.clear();
        bars.fillStyle(0x1a2a2a, 1).fillRect(3664, 188, 130, 8).fillRect(3664, 216, 130, 8);
        bars.fillStyle(C.teal, 1).fillRect(3664, 188, 130 * (left / 18), 8);
        bars.fillStyle(C.red, 1).fillRect(3664, 216, 130 * (month / 18), 8);
        money.setText(left > 0 ? `${left.toFixed(0)} mo` : 'OUT');
        money.setColor(left > 0 ? HEX.teal : HEX.red);
        wait.setText(`${month.toFixed(0)} mo`);
      } });
      this.addStation({
        id: 'license', kind: 'exhibit', wing: 'backstage', x: cx, y: 330, px: cx, py: 124, verb: 'Read', name: 'the license wall',
        color: C.teal, hit: new Phaser.Geom.Rectangle(3650, 140, 200, 110),
        use: () => showExhibit({ kicker: 'BACKSTAGE · RULES · FINDING', title: 'Waiting for permission', accent: 'teal',
          tabs: [{ id: 'lic', label: 'The license wait', content: LICENSE_WALL }], onClose: () => this.markVisited('license') }),
      });
    }
  }

  /* ---------------------------------------------------------------- */
  /* Interviewees                                                      */
  /* ---------------------------------------------------------------- */

  private buildNpcs(): void {
    for (const npc of NPCS) {
      const place = NPC_PLACES[npc.id];
      if (!place) continue;
      const wing = WINGS.find(w => w.id === place.wing)!;
      const hex = toHex(wing.color);
      const { x, y } = place;
      this.add.ellipse(x, y + 29, 30, 10, 0x000000, 0.45).setDepth(y - 1);
      const glow = this.add.ellipse(x, y + 29, 60, 18, wing.color, 0.22).setDepth(y - 2).setBlendMode(Phaser.BlendModes.ADD);
      this.tweens.add({ targets: glow, alpha: 0.08, duration: 1400, yoyo: true, repeat: -1 });
      const sprite = this.add.image(x, y, `sim_${npc.id}`).setScale(1 / TEX_SCALE).setDepth(y);
      this.tweens.add({ targets: sprite, y: y - 1.5, scaleY: 1.015 / TEX_SCALE, duration: 1700 + Math.random() * 500, yoyo: true, repeat: -1, ease: 'Sine.inOut' });

      const pb = this.add.image(x, y - 66, 'plumbob').setScale(0.8 / TEX_SCALE).setDepth(y + 1);
      this.tweens.add({ targets: pb, y: y - 70, duration: 900, yoyo: true, repeat: -1, ease: 'Sine.inOut' });
      this.tweens.add({ targets: pb, scaleX: 0.2 / TEX_SCALE, duration: 1100, yoyo: true, repeat: -1, ease: 'Sine.inOut' });

      // Name tag
      const nameT = label(this, x, y - 40, npc.name, { size: 13, bold: true, align: 'center' }).setOrigin(0.5).setDepth(y + 2);
      const bw = nameT.width + 18;
      const tag = this.add.graphics().setDepth(y + 1);
      tag.fillStyle(0x0d0b1a, 0.88).fillRoundedRect(x - bw / 2, y - 50, bw, 20, 10);
      tag.lineStyle(1.5, wing.color, 0.9).strokeRoundedRect(x - bw / 2, y - 50, bw, 20, 10);
      const tick = label(this, x + bw / 2 + 4, y - 40, '✓', { size: 13, color: HEX.teal }).setOrigin(0, 0.5).setDepth(y + 2).setVisible(false);

      const where = wing.venue ? `${wing.tag} · ${wing.word}` : wing.tag;
      this.addStation({
        id: `npc-${npc.id}`, kind: 'npc', wing: place.wing, x, y: y + 6, px: x, py: y - 72, verb: 'Talk to', name: npc.name,
        color: wing.color, hit: new Phaser.Geom.Rectangle(x - 22, y - 52, 44, 86), tick, sprite, extra: pb,
        use: () => showDialogue({
          name: npc.name, role: npc.role, where, accent: wing.accent,
          portrait: this.portrait(`sim_${npc.id}`),
          questions: npc.questions,
          onClose: () => this.markVisited(`npc-${npc.id}`),
        }),
      });
      void hex;
    }
  }

  /** Head-and-shoulders crop of a Sim texture as a data URL, for the interview card. */
  private portrait(key: string): string | undefined {
    const tex = this.textures.get(key);
    const src = tex.getSourceImage() as HTMLCanvasElement;
    if (!src || !(src instanceof HTMLCanvasElement)) return undefined;
    const c = document.createElement('canvas');
    const size = src.width;
    c.width = size; c.height = size;
    const ctx = c.getContext('2d')!;
    ctx.drawImage(src, 0, -size * 0.02, size, size, 0, 0, size, size);
    return c.toDataURL();
  }

  /* ---------------------------------------------------------------- */
  /* Exit: conclusion, receipt, door                                   */
  /* ---------------------------------------------------------------- */

  private buildExit(): void {
    // Conclusion wall text (frame 4010..4246, 132..236)
    const cx = 4133;
    label(this, cx, 140, 'WHAT THE THREE SPACES SELL', { font: FONT.display, size: 13, color: HEX.gold, align: 'center' }).setOrigin(0.5, 0).setDepth(4);
    const rows: [string, string, string][] = [
      ['SKILL', 'a fair fight, then an edge', HEX.amber],
      ['TIME', 'minutes, then years', HEX.violet],
      ['SPEED', 'the end of waiting', HEX.pink],
      ['RULES', 'who sets the odds', HEX.teal],
    ];
    rows.forEach(([w, line, col], i) => {
      neonText(this, 4056, 170 + i * 18, w, { size: 13, color: '#ffffff', glow: col, blur: 8 }).setDepth(4);
      label(this, 4090, 170 + i * 18, line, { size: 12.5, color: '#d8d4f0' }).setOrigin(0, 0.5).setDepth(4);
    });
    this.addStation({
      id: 'conclusion', kind: 'exhibit', wing: 'exit', x: cx, y: 330, px: cx, py: 116, verb: 'Read', name: 'the conclusion',
      color: C.gold, hit: new Phaser.Geom.Rectangle(4002, 132, 262, 110),
      use: () => this.showConclusion(),
    });

    // Receipt kiosk on the floor
    const kx = 4205, ky = 420;
    this.add.ellipse(kx, ky + 4, 80, 22, C.gold, 0.18).setDepth(ky - 2).setBlendMode(Phaser.BlendModes.ADD);
    const kiosk = this.add.image(kx, ky + 8, 'hub_kiosk').setOrigin(0.5, 1).setScale(1.1 / 3).setDepth(ky);
    neonText(this, kx, ky - 150, 'YOUR RECEIPT', { size: 13, color: '#ffffff', glow: HEX.gold, blur: 10 }).setDepth(ky + 1);
    this.addStation({
      id: 'receipt', kind: 'exhibit', wing: 'exit', x: kx, y: ky + 18, px: kx, py: ky - 168, verb: 'Print', name: 'your receipt',
      color: C.gold, hit: new Phaser.Geom.Rectangle(kx - 30, ky - 140, 60, 150), sprite: kiosk,
      use: () => { audio.sfx('build'); this.showReceipt(); },
    });

    // Exit door
    neonText(this, 4333, 134, 'EXIT  出口', { size: 12, color: '#d9fff2', glow: HEX.teal, blur: 8, font: `${FONT.display}, "Noto Sans CJK SC", "PingFang SC", "Microsoft YaHei", sans-serif` }).setDepth(4);
    this.addStation({
      id: 'door', kind: 'exit', wing: 'exit', x: 4333, y: 330, px: 4333, py: 112, verb: 'Leave', name: 'the museum',
      color: C.teal, hit: new Phaser.Geom.Rectangle(4296, 120, 74, 132),
      use: () => this.showGoodbye(),
    });
  }

  private showConclusion(): void {
    showModal({
      kicker: 'CONCLUSION', title: CONCLUSION.title, accent: 'gold', className: 'conclusion-modal',
      body: `<div class="conclusion">${CONCLUSION.points.map(p => `
        <div class="c-row"><span class="c-word" style="--c:${p.color}">${p.word}</span><p>${p.text}</p></div>`).join('')}</div>`,
      actions: [{ label: 'Close', kind: 'ghost', key: 'Esc', onClick: closeModal }],
      onClose: () => this.markVisited('conclusion'),
    });
  }

  private showReceipt(): void {
    const entries = wallet.entries();
    const total = wallet.total();
    const v = this.visited();
    const cabs = CABINETS.filter(c => v.has(`cab-${c.id}`)).length;
    const talks = NPCS.filter(n => v.has(`npc-${n.id}`)).length;
    // Group spending by item
    const grouped = new Map<string, { n: number; rmb: number }>();
    for (const e of entries) {
      const g = grouped.get(e.what) ?? { n: 0, rmb: 0 };
      g.n++; g.rmb += e.rmb;
      grouped.set(e.what, g);
    }
    const lines = [...grouped.entries()].map(([what, g]) =>
      `<div class="r-line"><span>${what}${g.n > 1 ? ` ×${g.n}` : ''}</span><span>¥${g.rmb.toLocaleString()}</span></div>`).join('')
      || '<div class="r-line r-muted"><span>Nothing bought. Strong willpower.</span><span>¥0</span></div>';
    // Mr. Zhou's lower estimate: ¥15,000 a month
    const perMinute = 15000 / (30 * 24 * 60);
    const mins = total / perMinute;
    const zhou = total > 0
      ? `At his lower estimate of ¥15,000 a month, Mr. Zhou spends your ¥${total.toLocaleString()} in about ${mins < 90 ? `${Math.max(1, Math.round(mins))} minutes` : `${(mins / 60).toFixed(1)} hours`}.`
      : 'At his lower estimate, Mr. Zhou spends about ¥21 every hour, day and night.';

    showModal({
      kicker: 'EXIT · YOUR VISIT', title: '', accent: 'gold', className: 'receipt-modal',
      body: `
        <div class="receipt">
          <div class="r-head">THREE SPACES ARCADE<small>SHANGHAI · NANJING · ${new Date().toLocaleDateString()}</small></div>
          <div class="r-sec">YOU SPENT (SIMULATED)</div>
          ${lines}
          <div class="r-total"><span>TOTAL</span><span>¥${total.toLocaleString()}</span></div>
          <div class="r-sec">REAL PLAYERS I INTERVIEWED</div>
          ${REAL_SPEND.map(r => `<div class="r-line"><span>${r.who}</span><span>${r.rmb}</span></div>`).join('')}
          <p class="r-note">${zhou}</p>
          <div class="r-sec">YOUR VISIT</div>
          <div class="r-line"><span>Cabinets played ${cabs}/3 · People met ${talks}/${NPCS.length}</span><span>${v.has('claw') ? 'Claw ✓' : ''}</span></div>
          <div class="r-barcode"></div>
          <div class="r-foot">THANK YOU FOR PLAYING</div>
        </div>`,
      actions: [
        { label: 'Read the conclusion', kind: 'ghost', onClick: () => { closeModal(); this.showConclusion(); } },
        { label: 'Close', key: 'Esc', onClick: closeModal },
      ],
      onClose: () => this.markVisited('receipt'),
    });
  }

  private showGoodbye(): void {
    showModal({
      kicker: 'THANK YOU', title: 'Three spaces, one arcade', accent: 'teal',
      body: `<p>${ENTRANCE.thesis}</p>
        <p>Every quote and number in this museum comes from my fieldwork at Street Jiliehuo and Fengyun Zaiqi in Shanghai, Castle in the Sky in Nanjing, and interviews with players, staff, and developers.</p>`,
      actions: [
        { label: 'Your receipt', kind: 'ghost', onClick: () => { closeModal(); this.showReceipt(); } },
        { label: 'Back to the entrance', key: 'Enter', onClick: () => { closeModal(); this.teleport(200); } },
      ],
    });
  }

  private teleport(x: number): void {
    this.cameras.main.fadeOut(400, 7, 6, 15);
    this.cameras.main.once(Phaser.Cameras.Scene2D.Events.FADE_OUT_COMPLETE, () => {
      this.player.setPosition(x, 400);
      this.target = null;
      this.camX = x;
      this.cameras.main.fadeIn(500, 7, 6, 15);
    });
  }

  /* ---------------------------------------------------------------- */
  /* Atmosphere                                                        */
  /* ---------------------------------------------------------------- */

  private buildAmbience(): void {
    // Drifting light motes in each wing's colour
    for (let i = 0; i < 90; i++) {
      const x = Math.random() * HALL_W;
      const w = wingAt(x);
      const m = this.add.circle(x, 40 + Math.random() * 460, 0.8 + Math.random() * 1.6, w.color, 0.5).setDepth(900);
      m.setBlendMode(Phaser.BlendModes.ADD);
      this.tweens.add({
        targets: m, y: m.y - 40 - Math.random() * 60, x: m.x + Math.random() * 30 - 15, alpha: 0,
        duration: 4000 + Math.random() * 4000, repeat: -1, delay: Math.random() * 4000,
      });
    }
    // Ceiling spotlights over the wing signs
    const beams = this.add.graphics().setDepth(2).setBlendMode(Phaser.BlendModes.ADD);
    for (const w of WINGS) {
      if (!w.word) continue;
      const cx = (w.x0 + w.x1) / 2;
      beams.fillStyle(w.color, 0.05).fillTriangle(cx - 30, TOP, cx + 30, TOP, cx + 260, FLOOR_Y);
      beams.fillStyle(w.color, 0.05).fillTriangle(cx - 30, TOP, cx - 260, FLOOR_Y, cx + 260, FLOOR_Y);
    }
    void BOTTOM;
  }

  /* ---------------------------------------------------------------- */
  /* Player, prompt, input                                             */
  /* ---------------------------------------------------------------- */

  private buildPlayer(): void {
    const cab = CABINETS.find(c => c.id === this.from);
    const x = cab ? cab.x : 200;
    const y = cab ? 350 : 400;
    this.player = spawnSim(this, x, y);
    this.player.setDepth(y);
    this.shadow = this.add.ellipse(x, y + 29, 30, 10, 0x000000, 0.45);
    this.plumbob = this.add.image(x, y - 50, 'plumbob').setScale(1 / TEX_SCALE).setDepth(1000);
    this.camX = x;
  }

  private buildPrompt(): void {
    this.promptBg = this.add.graphics();
    this.promptKey = label(this, 0, 0, 'E', { size: 13, bold: true, color: HEX.ink, font: FONT.mono }).setOrigin(0.5);
    this.promptText = label(this, 0, 0, '', { size: 14, bold: true }).setOrigin(0, 0.5);
    this.prompt = this.add.container(0, 0, [this.promptBg, this.promptKey, this.promptText]).setDepth(2000).setVisible(false);
    this.promptFor = '';
    this.selector = this.add.graphics().setDepth(1500);
  }

  private showPrompt(st: Station): void {
    if (this.promptFor !== st.id) {
      this.promptFor = st.id;
      this.promptText.setText(`${st.verb} ${st.name}`);
      const w = this.promptText.width + 46, h = 28;
      this.promptBg.clear();
      this.promptBg.fillStyle(0x0d0b1a, 0.95).fillRoundedRect(-w / 2, -h / 2, w, h, 14);
      this.promptBg.lineStyle(2, st.color, 1).strokeRoundedRect(-w / 2, -h / 2, w, h, 14);
      this.promptBg.fillStyle(st.color, 1).fillRoundedRect(-w / 2 + 6, -10, 20, 20, 6);
      this.promptKey.setPosition(-w / 2 + 16, 0);
      this.promptText.setPosition(-w / 2 + 34, 0);
      this.prompt.setScale(0.6);
      this.tweens.add({ targets: this.prompt, scale: 1, duration: 180, ease: 'Back.out' });
    }
    this.prompt.setVisible(false);
    this.drawSelector(st);
  }

  /** Animated corner brackets around the station you can use. */
  private drawSelector(st: Station): void {
    const r = st.hit, g = this.selector;
    const pad = 6 + Math.sin(this.time.now / 180) * 2.5, L = 12;
    const x0 = r.x - pad, y0 = r.y - pad, x1 = r.right + pad, y1 = r.bottom + pad;
    g.clear();
    for (const [w, a] of [[7, 0.18], [2.5, 1]] as const) {
      g.lineStyle(w, st.color, a);
      g.beginPath();
      g.moveTo(x0, y0 + L); g.lineTo(x0, y0); g.lineTo(x0 + L, y0);
      g.moveTo(x1 - L, y0); g.lineTo(x1, y0); g.lineTo(x1, y0 + L);
      g.moveTo(x1, y1 - L); g.lineTo(x1, y1); g.lineTo(x1 - L, y1);
      g.moveTo(x0 + L, y1); g.lineTo(x0, y1); g.lineTo(x0, y1 - L);
      g.strokePath();
    }
  }

  private buildInput(): void {
    const kb = this.input.keyboard!;
    this.cursors = kb.createCursorKeys();
    this.keys = kb.addKeys('W,A,S,D,E,ENTER,SPACE') as Record<string, Phaser.Input.Keyboard.Key>;
    kb.addCapture([Phaser.Input.Keyboard.KeyCodes.UP, Phaser.Input.Keyboard.KeyCodes.DOWN, Phaser.Input.Keyboard.KeyCodes.LEFT,
      Phaser.Input.Keyboard.KeyCodes.RIGHT, Phaser.Input.Keyboard.KeyCodes.SPACE]);

    const use = () => { if (!isModalOpen() && this.nearest) this.useStation(this.nearest); };
    this.keys.E.on('down', use);
    this.keys.ENTER.on('down', use);
    this.keys.SPACE.on('down', use);

    this.input.on('pointerdown', (ptr: Phaser.Input.Pointer) => {
      if (isModalOpen()) return;
      const wx = ptr.worldX, wy = ptr.worldY;
      const st = this.stations.find(s => s.hit.contains(wx, wy));
      if (st) {
        if (this.nearest === st) { this.useStation(st); return; }
        this.target = { x: st.x, y: Phaser.Math.Clamp(st.y, MIN_Y, MAX_Y), station: st };
        return;
      }
      this.target = { x: Phaser.Math.Clamp(wx, 40, HALL_W - 40), y: Phaser.Math.Clamp(wy, MIN_Y, MAX_Y) };
      const ring = this.add.circle(this.target.x, this.target.y + 28, 4, C.gold, 0).setStrokeStyle(2, C.gold, 0.9).setDepth(3);
      this.tweens.add({ targets: ring, radius: 18, alpha: 0, duration: 450, onComplete: () => ring.destroy() });
    });

    this.input.on('pointermove', (ptr: Phaser.Input.Pointer) => {
      const over = this.stations.some(s => s.hit.contains(ptr.worldX, ptr.worldY));
      this.input.setDefaultCursor(over ? 'pointer' : 'default');
    });
  }

  private useStation(st: Station): void {
    this.target = null;
    this.player.setVelocity(0, 0);
    audio.sfx('click');
    // Face the thing you're using
    this.player.setFlipX(st.x < this.player.x - 4);
    st.use();
  }

  /* ---------------------------------------------------------------- */
  /* HUD: hall map and visit progress (DOM, so it stays crisp)         */
  /* ---------------------------------------------------------------- */

  private buildHud(): void {
    document.getElementById('hub-hud')?.remove();
    const hud = document.createElement('div');
    hud.id = 'hub-hud';
    hud.innerHTML = `
      <div class="mm">
        ${WINGS.map(w => `<button class="mm-seg" data-x="${(w.x0 + w.x1) / 2}" style="flex:${w.x1 - w.x0};--c:${toHex(w.color)}">
          <span>${w.word || w.tag}</span></button>`).join('')}
        <div class="mm-dot"></div>
      </div>
      <div class="mm-stats"></div>`;
    document.getElementById('app')!.appendChild(hud);
    hud.querySelectorAll<HTMLButtonElement>('.mm-seg').forEach(b => b.addEventListener('click', () => {
      if (isModalOpen()) return;
      audio.sfx('click');
      const x = parseFloat(b.dataset.x!);
      this.target = { x, y: Phaser.Math.Clamp(this.player.y, MIN_Y, MAX_Y) };
    }));
    this.hud = hud;
    this.unsubWallet?.();
    this.unsubWallet = wallet.onChange(() => this.updateHud());
    this.updateHud();
  }

  private updateHud(): void {
    if (!this.hud) return;
    const v = this.visited();
    const cabs = CABINETS.filter(c => v.has(`cab-${c.id}`)).length + (v.has('claw') ? 1 : 0);
    const talks = NPCS.filter(n => v.has(`npc-${n.id}`)).length;
    const exhibits = ['map', 'venue-skill', 'venue-time', 'venue-speed', 'buy-a-win', 'marbles', 'tray', 'license', 'conclusion'].filter(id => v.has(id)).length;
    const stats = this.hud.querySelector('.mm-stats') as HTMLElement;
    stats.innerHTML = `
      <span><b>${cabs}</b>/4 machines played</span>
      <span><b>${talks}</b>/${NPCS.length} people met</span>
      <span><b>${exhibits}</b>/9 exhibits</span>
      <span class="spent">¥<b>${wallet.total().toLocaleString()}</b> spent</span>`;
  }

  private hideHud(hidden: boolean): void {
    this.hud?.classList.toggle('hidden', hidden);
  }

  private onResume(): void {
    this.scene.setVisible(true);
    audio.setMode('arcade');
    this.hideHud(false);
    this.updateHud();
    this.currentWing = null;
    this.input.keyboard?.resetKeys();
  }

  private onShutdown(): void {
    this.events.off(Phaser.Scenes.Events.RESUME, this.onResume, this);
    this.hud?.remove();
    this.hud = null;
    this.unsubWallet?.();
    this.unsubWallet = null;
    this.input.setDefaultCursor('default');
    speech.stop();
    setHint('');
    setLocation('');
  }

  /* ---------------------------------------------------------------- */
  /* Camera                                                            */
  /* ---------------------------------------------------------------- */

  private setupCamera(): void {
    const apply = () => {
      const { width, height } = this.scale;
      const zoom = Math.min(height / VIEW_H, width / 640);
      this.cameras.main.setZoom(zoom);
      this.placeCamera(true);
    };
    apply();
    this.scale.on('resize', apply);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => this.scale.off('resize', apply));
  }

  private placeCamera(snap = false): void {
    const cam = this.cameras.main;
    const viewW = cam.width / cam.zoom;
    const want = Phaser.Math.Clamp(this.player.x, viewW / 2, HALL_W - viewW / 2);
    this.camX = snap ? want : Phaser.Math.Linear(this.camX, want, 0.09);
    cam.centerOn(this.camX, VIEW_H / 2);
    if (this.hud) {
      const dot = this.hud.querySelector('.mm-dot') as HTMLElement;
      dot.style.left = `${(this.player.x / HALL_W) * 100}%`;
    }
  }

  /* ---------------------------------------------------------------- */
  /* Helpers                                                           */
  /* ---------------------------------------------------------------- */

  private addStation(st: Station): void {
    this.stations.push(st);
  }

  update(time: number): void {
    if (!this.player?.body) return;
    const busy = isModalOpen();

    // Movement
    let vx = 0, vy = 0;
    if (!busy) {
      if (this.cursors.left.isDown || this.keys.A.isDown) vx -= 1;
      if (this.cursors.right.isDown || this.keys.D.isDown) vx += 1;
      if (this.cursors.up.isDown || this.keys.W.isDown) vy -= 1;
      if (this.cursors.down.isDown || this.keys.S.isDown) vy += 1;
    }
    if (vx || vy) {
      this.target = null;
      const len = Math.hypot(vx, vy);
      this.player.setVelocity((vx / len) * SPEED, (vy / len) * SPEED * 0.75);
    } else if (this.target && !busy) {
      const dx = this.target.x - this.player.x, dy = this.target.y - this.player.y;
      const d = Math.hypot(dx, dy);
      if (d < 8) {
        this.player.setVelocity(0, 0);
        const st = this.target.station;
        this.target = null;
        if (st) this.useStation(st);
      } else {
        const sp = Math.min(SPEED * 1.15, d * 6);
        this.player.setVelocity((dx / d) * sp, (dy / d) * sp);
      }
    } else {
      this.player.setVelocity(0, 0);
    }

    // Keep inside the walkable floor
    const body = this.player.body as Phaser.Physics.Arcade.Body;
    if (this.player.y < MIN_Y) { this.player.y = MIN_Y; if (body.velocity.y < 0) body.velocity.y = 0; }
    if (this.player.y > MAX_Y) { this.player.y = MAX_Y; if (body.velocity.y > 0) body.velocity.y = 0; }
    this.player.x = Phaser.Math.Clamp(this.player.x, 30, HALL_W - 30);

    const moving = Math.abs(body.velocity.x) + Math.abs(body.velocity.y) > 5;
    if (Math.abs(body.velocity.x) > 5) this.player.setFlipX(body.velocity.x < 0);
    this.walkPhase = moving ? this.walkPhase + 0.32 : 0;
    const bob = moving ? Math.abs(Math.sin(this.walkPhase)) * 2.2 : 0;
    this.player.setDepth(this.player.y);
    this.player.setDisplayOrigin(this.player.width / 2, this.player.height / 2 + bob * TEX_SCALE);
    this.shadow.setPosition(this.player.x, this.player.y + 29).setDepth(this.player.y - 1);
    this.plumbob.setPosition(this.player.x, this.player.y - 50 - bob + Math.sin(time / 280) * 3);

    // Nearest station
    let best: Station | null = null, bestD = Infinity;
    for (const st of this.stations) {
      const d = Math.hypot(st.x - this.player.x, (st.y - this.player.y) * 1.4);
      const reach = st.kind === 'npc' ? 64 : 82;
      if (d < reach && d < bestD) { best = st; bestD = d; }
    }
    if (busy) best = null;
    if (best) this.showPrompt(best); else { this.prompt.setVisible(false); this.promptFor = ''; this.selector.clear(); }
    if (best !== this.nearest) {
      this.nearest?.sprite?.clearTint();
      best?.sprite?.setTint(0xffffff);
      this.nearest = best;
    }
    // NPCs turn to face the visitor when close
    for (const st of this.stations) {
      if (st.kind === 'npc' && st.sprite) {
        const near = Math.abs(st.x - this.player.x) < 160;
        if (near) st.sprite.setFlipX(this.player.x < st.x);
      }
    }

    // Hint pill and location
    const wing = wingAt(this.player.x);
    if (wing !== this.currentWing) {
      this.currentWing = wing;
      setLocation(wing.venue ? `${wing.tag} · ${wing.word} · ${wing.venue.name.toUpperCase()}` : wing.tag);
      if (wing.word && wing.id !== 'entrance') audio.sfx('whoosh');
    }
    if (busy) setHint('');
    else if (best) setHint(`<kbd>E</kbd> <b style="color:${toHex(best.color)}">${best.verb} ${best.name}</b>`);
    else if (wing.id === 'entrance') setHint('<kbd>A</kbd><kbd>D</kbd> or <kbd>←</kbd><kbd>→</kbd> Walk · click anywhere to walk there');
    else setHint('<kbd>WASD</kbd> Walk · <kbd>E</kbd> at anything that glows · click the map to jump');

    this.placeCamera();
  }
}
