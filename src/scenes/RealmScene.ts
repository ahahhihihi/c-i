/**
 * Cabinet 02 · Lost Realm. A short top-down action RPG about time you keep.
 * Find three heart shards, hear the Guardian's story, break its shield and
 * set it free. Lore pages and best time persist in localStorage ('realm-*').
 */
import Phaser from 'phaser';
import { ensureTextures } from '../assets';
import { audio } from '../audio';
import { fitZoom, setHint, setLocation } from '../view';
import { spawnSim, makePlumbob } from '../sims';
import { FONT, HEX, C, cinematicCamera, floatText as themeFloat, burst as themeBurst, impact, label, toHex } from '../theme';
import { showModal, closeModal, showDebrief, isModalOpen, type GameIntro } from '../ui/modals';
import { wallet } from '../wallet';
import { NPCS } from '../data/dialogues';
import { RealmHud, type HudState } from './realm/RealmHud';
import {
  makeRealmTextures, drawShard, drawIceCluster, drawFrostTree, drawGlowTree, drawPillar, drawWall,
  drawSpire, drawMonolith, drawGlowPlant, drawWishShrine, drawShrineStone,
} from './realm/art';
import { PAGES, AREA_INFO, save, fmtTime, type AreaId } from './realm/lore';

export const INTRO: GameIntro = {
  number: '02',
  genre: 'RPG',
  title: 'Lost Realm',
  realWorld: 'Modelled on Genshin Impact and Fantasy Westward Journey',
  pitch: 'Find the three pieces of a lonely guardian\'s heart and learn its story, then see why a world that remembers you feels different from a machine that resets at zero credits.',
  controls: [['WASD', 'Move'], ['SPACE / Click', 'Attack'], ['SHIFT', 'Dodge roll'], ['E', 'Talk, pick up'], ['ESC', 'Pause']],
  accent: 'violet',
  goal: 'Clear the wisps, collect the three heart shards, break the Guardian\'s shield and set it free. Your lore pages and best time are saved.',
};

const W = 2400, H = 1500;
const ARENA = { x: 1200, y: 400, r: 320 };
const SANCT = { x: 1200, y: 1240 };
const ELDER = { x: 1090, y: 1185 };
const WISH = { x: 1200, y: 1365 };
const GUARD_HOME = { x: 1200, y: 330 };
/** Guardian sprite centre to its feet, and to its heart. */
const G_FEET = 85, G_HEART = 19;

const PLAYER_SPEED = 175;
const MAX_HP = 100, MAX_ST = 100;
const ATTACK_COST = 15, DODGE_COST = 25;
const BOSS_HP = 320;

/** The shared effects draw at depth ~1000; lift them above the y-sorted world. */
function lift(scene: Phaser.Scene, fn: () => void): void {
  const before = scene.children.list.length;
  fn();
  const list = scene.children.list;
  for (let i = before; i < list.length; i++) (list[i] as unknown as Phaser.GameObjects.Components.Depth).setDepth(9600);
}
function floatText(scene: Phaser.Scene, x: number, y: number, text: string, color?: string, size?: number): void {
  lift(scene, () => themeFloat(scene, x, y, text, color, size));
}
function burst(scene: Phaser.Scene, x: number, y: number, color: number, count?: number, speed?: number): void {
  lift(scene, () => themeBurst(scene, x, y, color, count, speed));
}

const DEFAULT_HINT = '<kbd>WASD</kbd> Move <kbd>SPACE</kbd> Attack <kbd>SHIFT</kbd> Dodge <kbd>ESC</kbd> Pause';

type WispState = 'idle' | 'chase' | 'windup' | 'lunge' | 'stun';
interface Wisp {
  sprite: Phaser.Physics.Arcade.Sprite; glow: Phaser.GameObjects.Image;
  area: AreaId; home: { x: number; y: number }; hp: number;
  state: WispState; until: number; cooldown: number; lungeHit: boolean; dead: boolean; phase: number;
}
interface Shard {
  area: AreaId; x: number; y: number; color: number;
  gfx: Phaser.GameObjects.Graphics; glow: Phaser.GameObjects.Image; beam: Phaser.GameObjects.Image;
  seal: Phaser.GameObjects.Graphics; sparkle: Phaser.GameObjects.Particles.ParticleEmitter;
  sealed: boolean; collected: boolean;
}
interface Shrine { x: number; y: number; lit: boolean; flame: Phaser.GameObjects.Image; core: Phaser.GameObjects.Arc }
interface Slam { x: number; y: number; r: number; at: number; objs: Phaser.GameObjects.GameObject[] }
interface Orb { glow: Phaser.GameObjects.Image; core: Phaser.GameObjects.Arc; vx: number; vy: number; until: number }

export class RealmScene extends Phaser.Scene {
  private hud!: RealmHud;
  private player!: Phaser.Physics.Arcade.Sprite;
  private playerLight!: Phaser.GameObjects.Image;
  private arrow!: Phaser.GameObjects.Graphics;
  private keys!: Record<string, Phaser.Input.Keyboard.Key>;
  private cursors!: Phaser.Types.Input.Keyboard.CursorKeys;
  private obstacles!: Phaser.Physics.Arcade.StaticGroup;
  private wispGroup!: Phaser.Physics.Arcade.Group;
  private lastHint = '';
  private lastReal = 0;
  private bakeG: Phaser.GameObjects.Graphics | null = null;
  private bakeList: Phaser.GameObjects.GameObject[] = [];
  private borderG: Phaser.GameObjects.Graphics | null = null;
  private companion: { img: Phaser.GameObjects.Image; glow: Phaser.GameObjects.Image } | null = null;

  // Run state (reset in create)
  private hp = MAX_HP;
  private stamina = MAX_ST;
  private lastStaminaUse = 0;
  private lastHurt = 0;
  private invulnUntil = 0;
  private knockUntil = 0;
  private dodgeUntil = 0;
  private dodgeDir = new Phaser.Math.Vector2(1, 0);
  private lastGhost = 0;
  private attackReady = 0;
  private tiredShown = 0;
  private facing = 0;
  private dead = false;
  private over = false;
  private cutscene = false;
  private story = false;
  private storyDone: (() => void) | null = null;
  private quitting = false;
  private talked = false;
  private elapsed = 0;
  private damageTaken = 0;
  private deaths = 0;
  private wishSpent = 0;
  private visits = 0;
  private pagesAtStart = 0;
  private newBest = false;

  private wisps: Wisp[] = [];
  private shards: Shard[] = [];
  private shardOrder: number[] = [];
  private shrines: Shrine[] = [];
  private respawn = { x: SANCT.x, y: SANCT.y + 20 };

  private guardian!: Phaser.Physics.Arcade.Sprite;
  private gAura!: Phaser.GameObjects.Image;
  private gHeart!: Phaser.GameObjects.Image;
  private gStones: Phaser.GameObjects.Graphics[] = [];
  private shield: Phaser.GameObjects.Graphics | null = null;
  private shieldGlow: Phaser.GameObjects.Image | null = null;
  private awake = false;
  private bossHp = BOSS_HP;
  private phase = 1;
  private bossDead = false;
  private bossInvulnUntil = 0;
  private nextAttack = 0;
  private attackCount = 0;
  private slams: Slam[] = [];
  private orbs: Orb[] = [];

  constructor() { super('Realm'); }

  /* ================================================================== */
  /* Setup                                                               */
  /* ================================================================== */

  create(): void {
    this.resetState();
    ensureTextures(this);
    makePlumbob(this);
    makeRealmTextures(this);
    audio.setMode('realm');
    setLocation('CABINET 02 · LOST REALM');
    setHint(DEFAULT_HINT);

    this.visits = save.addVisit();
    this.pagesAtStart = save.pages().length;

    this.physics.world.setBounds(60, 70, W - 120, H - 130);
    this.obstacles = this.physics.add.staticGroup();
    this.wispGroup = this.physics.add.group();

    // Static ground art is baked into textures on the first visit only
    this.bakeList = [];
    this.borderG = null;
    this.bakeG = this.textures.exists('realm_ground_0_0') ? null : this.make.graphics({}, false);
    this.buildGround();
    this.buildFrostGrove();
    this.buildEmberCanyon();
    this.buildRuin();
    this.buildPond();
    this.buildSanctuary();
    this.buildSanctum();
    this.buildBorder();
    this.buildAtmosphere();
    this.finishGround();
    this.buildPlayer();
    this.buildWispsAndShards();
    this.buildInput();
    this.buildCamera();
    this.launchHud();

    this.physics.add.collider(this.player, this.obstacles);
    this.physics.add.collider(this.wispGroup, this.obstacles);
    this.physics.add.collider(this.player, this.guardian);

    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      this.scene.stop('RealmHud');
      setHint('');
    });

    this.cameras.main.fadeIn(700, 7, 6, 15);
    this.time.delayedCall(900, () => {
      const returning = this.visits > 1 && this.pagesAtStart > 0;
      this.hud.banner('LOST REALM', HEX.violet, returning
        ? `Welcome back. ${this.pagesAtStart} of 4 lore pages are still here.`
        : 'Elder Chen is waiting for you.');
    });
  }

  private resetState(): void {
    this.hp = MAX_HP; this.stamina = MAX_ST;
    this.lastStaminaUse = 0; this.lastHurt = 0; this.invulnUntil = 0; this.knockUntil = 0;
    this.dodgeUntil = 0; this.lastGhost = 0; this.attackReady = 0; this.tiredShown = 0; this.facing = -Math.PI / 2;
    this.dead = false; this.over = false; this.cutscene = false; this.story = false; this.storyDone = null;
    this.quitting = false; this.talked = false; this.lastHint = ''; this.lastReal = 0;
    this.elapsed = 0; this.damageTaken = 0; this.deaths = 0; this.wishSpent = 0; this.newBest = false;
    this.wisps = []; this.shards = []; this.shardOrder = []; this.shrines = [];
    this.respawn = { x: SANCT.x, y: SANCT.y + 20 };
    this.gStones = []; this.shield = null; this.shieldGlow = null;
    this.awake = false; this.bossHp = BOSS_HP; this.phase = 1; this.bossDead = false;
    this.bossInvulnUntil = 0; this.nextAttack = 0; this.attackCount = 0;
    this.slams = []; this.orbs = []; this.companion = null;
  }

  private launchHud(): void {
    if (!this.scene.manager.keys['RealmHud']) this.scene.add('RealmHud', RealmHud, false);
    this.scene.launch('RealmHud', { getState: () => this.hudState() });
    this.hud = this.scene.get('RealmHud') as RealmHud;
  }

  private hudState(): HudState {
    return {
      hp: this.hp, maxHp: MAX_HP, stamina: this.stamina, maxStamina: MAX_ST,
      shards: [0, 1, 2].map(i => (this.shardOrder[i] !== undefined ? this.shards[this.shardOrder[i]].color : null)),
      pages: save.pages().length, totalPages: PAGES.length,
      elapsed: this.elapsed,
      boss: this.awake ? { hp: this.bossHp, max: BOSS_HP, phase: this.phase } : null,
    };
  }

  private buildCamera(): void {
    const cam = this.cameras.main;
    cam.setBounds(0, 0, W, H);
    const apply = () => cam.setZoom(fitZoom(this.scale.width, this.scale.height));
    apply();
    this.scale.on('resize', apply);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => this.scale.off('resize', apply));
    cam.startFollow(this.player, true, 0.09, 0.09, 0, 10);
    cinematicCamera(this, { bloom: 0.9 });
  }

  /* ------------------------------ world ------------------------------ */

  private soft(x: number, y: number, color: number, scale: number, alpha: number, depth = 1, add = true): Phaser.GameObjects.Image {
    const img = this.add.image(x, y, 'realm_soft').setTint(color).setScale(scale).setAlpha(alpha).setDepth(depth);
    if (add) img.setBlendMode(Phaser.BlendModes.ADD);
    return img;
  }

  /** Static light baked into the ground texture (only drawn on the first visit). */
  private groundSoft(x: number, y: number, color: number, scale: number, alpha: number, add = true): void {
    if (!this.bakeG) return;
    const img = this.make.image({ x, y, key: 'realm_soft' }, false).setTint(color).setScale(scale).setAlpha(alpha);
    if (add) img.setBlendMode(Phaser.BlendModes.ADD);
    this.bakeList.push(img);
  }

  /**
   * A y-sorted prop. The vector drawing is baked once into a hi-res texture
   * (shared by every prop with the same key), so it costs one sprite per frame.
   */
  private prop(key: string, x: number, y: number, box: { w: number; h: number; base?: number },
    draw: (g: Phaser.GameObjects.Graphics) => void, body?: { w: number; h: number }): Phaser.GameObjects.Image {
    const S = 3;
    const k = `realm_p_${key}`;
    const base = box.base ?? 12;
    if (!this.textures.exists(k)) {
      const g = this.make.graphics({}, false).setScale(S);
      g.translateCanvas(box.w / 2, box.h - base);
      draw(g);
      g.generateTexture(k, Math.ceil(box.w * S), Math.ceil(box.h * S));
      g.destroy();
    }
    const img = this.add.image(x, y, k).setOrigin(0.5, (box.h - base) / box.h).setScale(1 / S).setDepth(y);
    if (body) this.block(x, y - 4, body.w, body.h);
    return img;
  }

  private block(x: number, y: number, w: number, h: number): void {
    const z = this.add.zone(x, y, w, h);
    this.physics.add.existing(z, true);
    this.obstacles.add(z);
  }

  /** Render the static ground into a few large textures and show them. */
  private finishGround(): void {
    const R = 1.5, CW = 800, CH = 750;
    const strips: { key: string; x: number; y: number; w: number; h: number; list: Phaser.GameObjects.GameObject[]; depth: number }[] = [];
    for (let cx = 0; cx < W / CW; cx++) {
      for (let cy = 0; cy < H / CH; cy++) {
        strips.push({ key: `realm_ground_${cx}_${cy}`, x: cx * CW, y: cy * CH, w: CW, h: CH, list: this.bakeList, depth: -10 });
      }
    }
    const bl = this.borderG ? [this.borderG] : [];
    strips.push(
      { key: 'realm_border_t', x: 0, y: 0, w: W, h: 130, list: bl, depth: 9500 },
      { key: 'realm_border_b', x: 0, y: H - 130, w: W, h: 130, list: bl, depth: 9500 },
      { key: 'realm_border_l', x: 0, y: 130, w: 130, h: H - 260, list: bl, depth: 9500 },
      { key: 'realm_border_r', x: W - 130, y: 130, w: 130, h: H - 260, list: bl, depth: 9500 },
    );
    for (const s of strips) {
      if (!this.textures.exists(s.key)) {
        const dt = this.textures.addDynamicTexture(s.key, Math.ceil(s.w * R), Math.ceil(s.h * R));
        if (dt) {
          dt.camera.setOrigin(0, 0).setZoom(R).setScroll(s.x, s.y);
          dt.draw(s.list);
        }
      }
      this.add.image(s.x, s.y, s.key).setOrigin(0).setScale(1 / R).setDepth(s.depth);
    }
    this.bakeList.forEach(o => o.destroy());
    this.bakeList = [];
    this.bakeG = null;
    this.borderG?.destroy();
    this.borderG = null;
  }

  private buildGround(): void {
    const g = this.bakeG;
    if (g) {
      g.fillGradientStyle(0x0d0928, 0x100b2e, 0x170c30, 0x140b2a, 1).fillRect(0, 0, W, H);
      // Area colour pools (drawn after the base, before details)
      this.bakeList.push(g);
      const pools: [number, number, number, number, number][] = [
        [430, 430, 0x3f8fd6, 4.8, 0.42], [1980, 430, 0xc2502a, 4.8, 0.4], [420, 1150, 0x2f9e5c, 4.6, 0.36],
        [1980, 1150, 0x2c4fa8, 4.4, 0.36], [ARENA.x, ARENA.y, 0x7b4fd6, 4.6, 0.45], [SANCT.x, SANCT.y, 0x8a5fe0, 3.6, 0.4],
        [1200, 820, 0x4a3a9a, 3.2, 0.3],
      ];
      for (const [x, y, c, s, a] of pools) this.groundSoft(x, y, c, s, a, false);
      const d = this.make.graphics({}, false);
      this.bakeList.push(d);
      this.bakeG = d;
      const rnd = new Phaser.Math.RandomDataGenerator(['lost-realm']);
      for (let i = 0; i < 520; i++) {
        const x = rnd.between(0, W), y = rnd.between(0, H);
        if (rnd.frac() < 0.6) {
          d.fillStyle(0x060412, 0.35).fillEllipse(x, y + 1, rnd.between(4, 10), rnd.between(2, 5));
          d.fillStyle(0x2a2350, 0.6).fillEllipse(x, y, rnd.between(4, 9), rnd.between(2, 4));
        } else {
          d.lineStyle(1.2, rnd.pick([0x3b2d6e, 0x2f4a6e, 0x40306a]), 0.8);
          d.lineBetween(x, y, x - 3, y - 7).lineBetween(x, y, x + 1, y - 9).lineBetween(x, y, x + 4, y - 6);
        }
      }
      for (let i = 0; i < 160; i++) {
        d.fillStyle(rnd.pick([0xa47bff, 0x7fe7ff, 0xff9ad8]), rnd.realInRange(0.25, 0.6)).fillCircle(rnd.between(0, W), rnd.between(0, H), rnd.realInRange(0.8, 1.8));
      }
      const paths: [number, number][][] = [
        [[1200, 1140], [1200, 960], [1200, 820], [1200, 720]],
        [[1200, 820], [960, 760], [760, 640], [600, 520]],
        [[1200, 820], [1440, 760], [1640, 640], [1800, 520]],
        [[1200, 960], [960, 1040], [760, 1100], [600, 1140]],
        [[1200, 960], [1440, 1040], [1640, 1100], [1760, 1120]],
      ];
      for (const pts of paths) {
        for (let i = 0; i < pts.length - 1; i++) {
          const [ax, ay] = pts[i], [bx, by] = pts[i + 1];
          const len = Phaser.Math.Distance.Between(ax, ay, bx, by);
          for (let k = 0; k < len; k += 30) {
            const t = k / len;
            const x = ax + (bx - ax) * t + rnd.between(-6, 6), y = ay + (by - ay) * t + rnd.between(-4, 4);
            d.fillStyle(0x050310, 0.5).fillEllipse(x + 1, y + 2, 26, 13);
            d.fillStyle(0x2d2754, 1).fillEllipse(x, y, 25, 12);
            d.fillStyle(0x40387a, 1).fillEllipse(x - 2, y - 2, 18, 7);
            if (rnd.frac() < 0.12) d.fillStyle(0xa47bff, 0.7).fillCircle(x, y - 1, 1.5);
          }
        }
      }
      this.groundSoft(1236, 806, 0xffb347, 0.9, 0.22);
    }

    // Crossroads lantern post
    this.prop('post', 1236, 806, { w: 30, h: 80, base: 8 }, (gg) => {
      gg.fillStyle(0x000000, 0.35).fillEllipse(0, 2, 26, 8);
      gg.fillStyle(0x2a2238, 1).fillRect(-3, -64, 6, 64);
      gg.fillStyle(0x8a3a24, 1).fillRect(-12, -68, 24, 5);
      gg.fillStyle(0xffc46b, 1).fillEllipse(0, -52, 12, 16);
    }, { w: 12, h: 10 });
    this.soft(1236, 754, 0xffb347, 0.5, 0.5, 900);
  }

  private runeCircle(x: number, y: number, r: number, color: number, depth = -6): Phaser.GameObjects.Graphics {
    const g = this.add.graphics({ x, y }).setDepth(depth);
    g.lineStyle(3, color, 0.6).strokeEllipse(0, 0, r * 2, r * 1.1);
    g.lineStyle(1.5, color, 0.45).strokeEllipse(0, 0, r * 1.7, r * 0.94);
    g.lineStyle(1, color, 0.4).strokeEllipse(0, 0, r * 1.0, r * 0.55);
    for (let i = 0; i < 16; i++) {
      const a = (i / 16) * Math.PI * 2;
      const px = Math.cos(a) * r * 0.92, py = Math.sin(a) * r * 0.51;
      g.lineStyle(2, color, 0.8).lineBetween(px - 4, py, px + 4, py);
      if (i % 2 === 0) g.lineBetween(px, py - 4, px, py + 3);
    }
    this.tweens.add({ targets: g, alpha: 0.5, duration: 2200, yoyo: true, repeat: -1, ease: 'Sine.inOut' });
    return g;
  }

  private plant(x: number, y: number, color: number, s = 1, glow = true): void {
    this.prop(`plant_${color}_${s}`, x, y, { w: 50 * s, h: 48 * s, base: 10 }, (gg) => drawGlowPlant(gg, color, s));
    if (glow) this.groundSoft(x, y - 10, color, 0.32, 0.35);
  }

  private buildFrostGrove(): void {
    const g = this.bakeG;
    if (g) {
      const rnd = new Phaser.Math.RandomDataGenerator(['frost']);
      for (let i = 0; i < 40; i++) {
        g.fillStyle(0xcfefff, rnd.realInRange(0.03, 0.07)).fillEllipse(rnd.between(90, 780), rnd.between(110, 780), rnd.between(60, 160), rnd.between(24, 60));
      }
      g.lineStyle(1, 0x9fe9ff, 0.3);
      for (let i = 0; i < 24; i++) {
        const x = rnd.between(120, 760), y = rnd.between(140, 760);
        g.lineBetween(x, y, x + rnd.between(-30, 30), y + rnd.between(-12, 12));
      }
    }
    const trees: [number, number, number][] = [[150, 190, 1.1], [270, 150, 0.9], [560, 160, 1.2], [690, 250, 1.0], [140, 430, 1.15], [210, 640, 1.0], [560, 650, 1.1], [710, 480, 0.95], [480, 210, 0.8], [110, 760, 0.9], [740, 720, 0.85]];
    for (const [x, y, s] of trees) {
      this.prop(`ftree_${s}`, x, y, { w: 100 * s + 10, h: 104 * s + 14 }, (gg) => drawFrostTree(gg, s), { w: 22 * s, h: 14 });
    }
    const ice: [number, number, number][] = [[250, 430, 22], [490, 430, 26], [380, 570, 18], [630, 360, 20], [290, 240, 16], [100, 300, 18]];
    for (const [x, y, s] of ice) {
      this.prop(`ice_${s}`, x, y, { w: s * 3.4, h: s * 1.6 + 20, base: 10 }, (gg) => drawIceCluster(gg, s), { w: s * 1.6, h: 14 });
      this.groundSoft(x, y - s * 0.4, 0x7fe7ff, s / 45, 0.4);
    }
    for (const [x, y] of [[330, 470], [560, 300], [180, 540], [430, 680]] as const) this.plant(x, y, 0x7fe7ff, 0.9);
    this.areaLabel(430, 90, 'FROZEN GROVE', AREA_INFO.frost.hex);
  }

  private buildEmberCanyon(): void {
    const g = this.bakeG;
    if (g) {
      const rnd = new Phaser.Math.RandomDataGenerator(['ember']);
      for (let i = 0; i < 30; i++) {
        g.fillStyle(0x2a0f1a, rnd.realInRange(0.25, 0.5)).fillEllipse(rnd.between(1620, 2320), rnd.between(110, 780), rnd.between(60, 150), rnd.between(30, 70));
      }
    }
    const fissures: [number, number][][] = [
      [[1700, 300], [1760, 340], [1800, 330], [1880, 380], [1930, 370]],
      [[2000, 620], [2050, 560], [2120, 540], [2180, 480], [2260, 470]],
      [[1680, 700], [1760, 690], [1820, 730], [1900, 720]],
      [[2180, 260], [2230, 300], [2300, 300]],
    ];
    const fg = this.add.graphics().setDepth(-5);
    for (const pts of fissures) {
      for (let i = 0; i < pts.length - 1; i++) {
        const [ax, ay] = pts[i], [bx, by] = pts[i + 1];
        fg.lineStyle(9, 0xff5a1f, 0.2).lineBetween(ax, ay, bx, by);
        fg.lineStyle(4, 0xff8a3d, 0.9).lineBetween(ax, ay, bx, by);
        fg.lineStyle(1.5, 0xffe0a0, 0.95).lineBetween(ax, ay, bx, by);
        this.groundSoft((ax + bx) / 2, (ay + by) / 2, 0xff6a2a, 0.45, 0.3);
      }
    }
    this.tweens.add({ targets: fg, alpha: 0.6, duration: 1400, yoyo: true, repeat: -1, ease: 'Sine.inOut' });
    const spires: [number, number, number][] = [[1820, 170, 90], [1960, 150, 110], [2250, 180, 100], [2300, 430, 80], [1790, 420, 70], [2160, 600, 95], [1870, 620, 85], [2130, 200, 64], [2320, 700, 90], [1700, 560, 60]];
    for (const [x, y, h] of spires) this.prop(`spire_${h}`, x, y, { w: 70, h: h + 22, base: 10 }, (gg) => drawSpire(gg, h), { w: 46, h: 16 });
    for (const [x, y] of [[1950, 300], [2200, 380], [1920, 500]] as const) this.plant(x, y, 0xff9a4d, 0.85);
    this.areaLabel(1980, 90, 'EMBER CANYON', AREA_INFO.ember.hex);
  }

  private buildRuin(): void {
    const g = this.bakeG;
    if (g) {
      const rnd = new Phaser.Math.RandomDataGenerator(['ruin']);
      for (let x = 200; x < 480; x += 30) {
        for (let y = 1120; y < 1320; y += 30) {
          if (rnd.frac() < 0.25) continue;
          g.fillStyle(0x2a2648, 0.75).fillRect(x + 1, y + 1, 28, 28);
          g.fillStyle(0x3a3560, 0.55).fillRect(x + 1, y + 1, 28, 4);
        }
      }
      for (let i = 0; i < 26; i++) g.fillStyle(0x2f9e5c, rnd.realInRange(0.12, 0.3)).fillEllipse(rnd.between(110, 760), rnd.between(900, 1420), rnd.between(30, 90), rnd.between(14, 40));
    }
    this.runeCircle(330, 1215, 70, 0x6dff9e, -5);
    this.prop('wall_110', 255, 1105, { w: 120, h: 60, base: 10 }, (gg) => drawWall(gg, 110, 46), { w: 110, h: 14 });
    this.prop('wall_80', 430, 1105, { w: 90, h: 52, base: 10 }, (gg) => drawWall(gg, 80, 38), { w: 80, h: 14 });
    for (const [x, y, h] of [[195, 1180, 70], [200, 1290, 54], [470, 1190, 82], [465, 1300, 48], [560, 1000, 34], [120, 1050, 40]] as const) {
      this.prop(`pillar_${h}`, x, y, { w: 50, h: h + 30, base: 10 }, (gg) => drawPillar(gg, h), { w: 26, h: 14 });
    }
    for (const [x, y, s] of [[130, 940, 1.1], [620, 1360, 1.0], [140, 1390, 0.95], [700, 940, 0.9]] as const) {
      this.prop(`gtree_g_${s}`, x, y, { w: 90 * s, h: 130 * s, base: 12 }, (gg) => drawGlowTree(gg, s, 0x6dff9e), { w: 20, h: 14 });
    }
    for (const [x, y] of [[260, 1250], [400, 1260], [560, 1180], [330, 1390], [620, 1080], [90, 1200]] as const) this.plant(x, y, 0x6dff9e, 1);
    this.areaLabel(420, 885, 'OVERGROWN RUIN', AREA_INFO.ruin.hex);
  }

  private buildPond(): void {
    const cx = 1980, cy = 1160;
    const g = this.add.graphics().setDepth(-5);
    g.fillStyle(0x05030c, 0.6).fillEllipse(cx, cy + 6, 470, 230);
    g.fillStyle(0x0d1a40, 1).fillEllipse(cx, cy, 450, 216);
    g.fillStyle(0x132a5e, 1).fillEllipse(cx, cy - 6, 400, 180);
    g.lineStyle(2, 0x5f8cff, 0.6).strokeEllipse(cx, cy, 450, 216);
    g.fillStyle(0xdfe6ff, 0.7).fillEllipse(cx + 40, cy - 10, 60, 18);
    g.fillStyle(0xdfe6ff, 0.35).fillEllipse(cx + 40, cy + 8, 40, 8).fillEllipse(cx + 44, cy + 20, 26, 5);
    for (const [x, y] of [[cx - 120, cy - 30], [cx - 60, cy + 50], [cx + 130, cy + 30], [cx - 150, cy + 40], [cx + 90, cy - 60]] as const) {
      g.fillStyle(0x1f6b4a, 1).fillEllipse(x, y, 30, 13);
      g.fillStyle(0xff9ad8, 1).fillCircle(x + 4, y - 3, 3);
    }
    this.tweens.add({ targets: g, alpha: 0.88, duration: 2600, yoyo: true, repeat: -1, ease: 'Sine.inOut' });
    const moon = this.soft(cx + 40, cy - 6, 0xbfd0ff, 0.6, 0.35, -4);
    this.tweens.add({ targets: moon, alpha: 0.18, duration: 2600, yoyo: true, repeat: -1, ease: 'Sine.inOut' });
    this.block(cx, cy, 400, 170);
    for (const [x, y, s] of [[1720, 1000, 1.0], [2260, 1010, 1.1], [1740, 1340, 0.9], [2240, 1350, 1.0]] as const) {
      this.prop(`gtree_p_${s}`, x, y, { w: 90 * s, h: 130 * s, base: 12 }, (gg) => drawGlowTree(gg, s, 0xff9ad8), { w: 20, h: 14 });
    }
    for (const [x, y] of [[1860, 1300], [2120, 1310], [1700, 1180], [2290, 1180]] as const) this.plant(x, y, 0xff9ad8, 0.9);
    this.areaLabel(1980, 1010, 'MOON POOL', '#c9b8ff');
  }

  private areaLabel(x: number, y: number, text: string, color: string): void {
    const t = this.add.text(x, y, text, { fontFamily: FONT.display, fontSize: '18px', color }).setOrigin(0.5).setDepth(-3).setAlpha(0.6);
    t.setShadow(0, 0, color, 12, true, true);
  }

  private buildSanctuary(): void {
    this.runeCircle(SANCT.x, SANCT.y, 170, 0xa47bff);
    const elder = this.add.image(ELDER.x, ELDER.y, 'realm_elder').setScale(1 / 3).setDepth(ELDER.y + 26);
    this.tweens.add({ targets: elder, scaleY: 1 / 3 * 1.02, duration: 1400, yoyo: true, repeat: -1, ease: 'Sine.inOut' });
    this.block(ELDER.x, ELDER.y + 24, 18, 12);
    const bob = this.add.image(ELDER.x, ELDER.y - 46, 'plumbob').setScale(1 / 3 * 0.8).setDepth(ELDER.y + 30);
    this.tweens.add({ targets: bob, y: ELDER.y - 52, duration: 1100, yoyo: true, repeat: -1, ease: 'Sine.inOut' });
    label(this, ELDER.x, ELDER.y - 70, 'ELDER CHEN', { font: FONT.mono, size: 12, color: '#e6dcff' }).setOrigin(0.5).setDepth(9300).setShadow(0, 1, '#000000', 3, true, true);
    this.groundSoft(ELDER.x, ELDER.y + 20, 0xa47bff, 0.5, 0.35);

    this.prop('wish', WISH.x, WISH.y, { w: 64, h: 100, base: 10 }, drawWishShrine, { w: 44, h: 12 });
    for (const dx of [-16, 16]) {
      const l = this.soft(WISH.x + dx, WISH.y - 50, 0xff8a3d, 0.32, 0.55, WISH.y + 1);
      this.tweens.add({ targets: l, alpha: 0.3, duration: 900 + dx * 10, yoyo: true, repeat: -1 });
    }
    label(this, WISH.x, WISH.y + 20, 'WISHING LANTERN', { font: FONT.mono, size: 12, color: '#ffd08a' }).setOrigin(0.5).setDepth(9300).setShadow(0, 1, '#000000', 3, true, true);

    this.addShrine(1310, 1190, true);
    this.addShrine(640, 570, false);
    this.addShrine(1760, 790, false);
    this.addShrine(660, 1040, false);
    this.addShrine(1200, 770, false);

    for (const [x, y] of [[1010, 1290], [1390, 1290], [1030, 1110], [1370, 1110], [1110, 1400], [1290, 1400]] as const) this.plant(x, y, 0xc9a8ff, 1);
  }

  private addShrine(x: number, y: number, lit: boolean): void {
    this.prop('shrine', x, y, { w: 54, h: 40, base: 10 }, drawShrineStone, { w: 34, h: 12 });
    const flame = this.soft(x, y - 34, lit ? 0x9cf0ff : 0x6b6890, 0.32, lit ? 0.8 : 0.35, y + 1);
    const core = this.add.circle(x, y - 34, 4, lit ? 0xe8fbff : 0x8b89a6, 1).setDepth(y + 2);
    this.tweens.add({ targets: [flame, core], y: y - 40, duration: 1300, yoyo: true, repeat: -1, ease: 'Sine.inOut' });
    this.shrines.push({ x, y, lit, flame, core });
  }

  private buildSanctum(): void {
    this.runeCircle(ARENA.x, ARENA.y + 30, 290, 0xa47bff);
    const g = this.bakeG;
    if (g) {
      g.fillStyle(0x1b1538, 0.85).fillEllipse(ARENA.x, ARENA.y + 30, 560, 300);
      g.fillStyle(0x251d4c, 0.85).fillEllipse(ARENA.x, ARENA.y + 30, 420, 220);
    }
    for (let i = 0; i < 14; i++) {
      const a = (i / 14) * Math.PI * 2 - Math.PI / 2;
      const deg = Phaser.Math.RadToDeg(a);
      if (deg > 55 && deg < 125) continue;
      const x = ARENA.x + Math.cos(a) * ARENA.r * 1.05, y = ARENA.y + 30 + Math.sin(a) * ARENA.r * 0.62;
      const h = 70 + (i % 3) * 14;
      this.prop(`mono_${h}`, x, y, { w: 46, h: h + 26, base: 10 }, (gg) => drawMonolith(gg, h), { w: 28, h: 14 });
      this.groundSoft(x - 4, y - 10, 0xc9a8ff, 0.3, 0.3);
    }

    this.gAura = this.soft(GUARD_HOME.x, GUARD_HOME.y, 0x8a5fff, 1.6, 0.25, GUARD_HOME.y + G_FEET - 2);
    this.guardian = this.physics.add.sprite(GUARD_HOME.x, GUARD_HOME.y, 'realm_guardian').setScale(1 / 3);
    this.guardian.setImmovable(true).setTint(0x7a7799).setDepth(GUARD_HOME.y + G_FEET);
    const body = this.guardian.body as Phaser.Physics.Arcade.Body;
    body.setCircle(100, 240 - 100, (95 + 60) * 3 - 100);
    body.setAllowGravity(false);
    this.gHeart = this.soft(GUARD_HOME.x, GUARD_HOME.y + G_HEART, 0xffd6f5, 0.2, 0.25, GUARD_HOME.y + G_FEET + 1);

    for (let i = 0; i < 4; i++) {
      const s = this.add.graphics();
      const k = 6 + (i % 2) * 3;
      s.fillStyle(0x433d72, 1).fillTriangle(0, -k * 1.4, -k, k * 0.6, k, k * 0.6);
      s.fillStyle(0x6a62a8, 1).fillTriangle(0, -k * 1.4, -k, k * 0.6, 0, k * 0.6);
      s.lineStyle(1.5, 0xd9c4ff, 0.8).lineBetween(-k * 0.3, 0, k * 0.3, 0);
      this.gStones.push(s);
    }

    this.shieldGlow = this.soft(GUARD_HOME.x, GUARD_HOME.y + 10, 0xa47bff, 1.15, 0.22, GUARD_HOME.y + G_FEET + 3);
    this.shield = this.add.graphics({ x: GUARD_HOME.x, y: GUARD_HOME.y + 10 }).setDepth(GUARD_HOME.y + G_FEET + 4);
    this.drawShield(0);
    this.tweens.add({ targets: this.shieldGlow, alpha: 0.12, duration: 1600, yoyo: true, repeat: -1 });
  }

  private drawShield(cracks: number): void {
    const s = this.shield;
    if (!s) return;
    s.clear();
    const r = 118;
    s.fillStyle(0xa47bff, 0.1).fillCircle(0, 0, r);
    s.lineStyle(2.5, 0xd9c4ff, 0.8).strokeCircle(0, 0, r);
    s.lineStyle(1, 0xd9c4ff, 0.3).strokeCircle(0, 0, r - 10);
    s.lineStyle(1, 0xc9a8ff, 0.22);
    for (let gx = -r; gx <= r; gx += 28) {
      for (let gy = -r; gy <= r; gy += 24) {
        const ox = gx + ((Math.round(gy / 24) % 2) * 14);
        if (ox * ox + gy * gy > (r - 16) * (r - 16)) continue;
        s.strokeCircle(ox, gy, 9);
      }
    }
    if (cracks > 0) {
      const rnd = new Phaser.Math.RandomDataGenerator(['crack']);
      s.lineStyle(2.5, 0xffffff, 0.95);
      for (let i = 0; i < cracks * 4; i++) {
        let a = rnd.realInRange(0, Math.PI * 2), x = Math.cos(a) * 20, y = Math.sin(a) * 20;
        for (let j = 0; j < 4; j++) {
          a += rnd.realInRange(-0.6, 0.6);
          const nx = x + Math.cos(a) * 26, ny = y + Math.sin(a) * 26;
          if (nx * nx + ny * ny > r * r) break;
          s.lineBetween(x, y, nx, ny);
          x = nx; y = ny;
        }
      }
    }
  }

  private buildBorder(): void {
    if (!this.bakeG) return;
    const g = this.make.graphics({}, false);
    this.borderG = g;
    const rnd = new Phaser.Math.RandomDataGenerator(['border']);
    const blob = (x: number, y: number) => {
      const r = rnd.between(50, 95);
      g.fillStyle(0x0a0718, 1).fillCircle(x, y, r);
      g.fillStyle(0x150e2c, 1).fillCircle(x + rnd.between(-10, 10), y + rnd.between(-10, 10), r * 0.6);
      if (rnd.frac() < 0.5) {
        const c = rnd.pick([0xa47bff, 0x7fe7ff, 0xff9ad8, 0x6dff9e]);
        for (let k = 0; k < 3; k++) {
          const px = x + rnd.between(-r * 0.5, r * 0.5), py = y + rnd.between(-r * 0.5, r * 0.5);
          g.fillStyle(c, 0.3).fillCircle(px, py, 4.5);
          g.fillStyle(c, 1).fillCircle(px, py, 2);
        }
      }
    };
    for (let x = -20; x <= W + 20; x += 70) { blob(x, rnd.between(-20, 20)); blob(x, H + rnd.between(-10, 30)); }
    for (let y = 40; y <= H - 40; y += 70) { blob(rnd.between(-30, 10), y); blob(W + rnd.between(-10, 30), y); }
  }

  private buildAtmosphere(): void {
    this.add.particles(0, 0, 'realm_dot', {
      x: { min: 0, max: W }, y: { min: 0, max: H },
      lifespan: { min: 3500, max: 6500 },
      speedX: { min: -14, max: 14 }, speedY: { min: -22, max: 4 },
      scale: { start: 0.42, end: 0.05 },
      alpha: { start: 0.9, end: 0 },
      tint: [0xfff1a8, 0xc9a8ff, 0x9cf0ff, 0xffb6e8],
      blendMode: 'ADD', frequency: 70, quantity: 1,
    }).setDepth(9000);
    this.add.particles(0, 0, 'realm_dot', {
      x: { min: 80, max: 800 }, y: { min: 60, max: 760 },
      lifespan: 4000, speedY: { min: 14, max: 30 }, speedX: { min: -10, max: 6 },
      scale: { start: 0.22, end: 0.1 }, alpha: { start: 0.8, end: 0 },
      tint: 0xeaf8ff, blendMode: 'ADD', frequency: 90,
    }).setDepth(9001);
    this.add.particles(0, 0, 'realm_dot', {
      x: { min: 1620, max: 2340 }, y: { min: 120, max: 800 },
      lifespan: 2600, speedY: { min: -50, max: -20 }, speedX: { min: -10, max: 10 },
      scale: { start: 0.3, end: 0 }, alpha: { start: 1, end: 0 },
      tint: [0xff9a4d, 0xffd078, 0xff5a1f], blendMode: 'ADD', frequency: 90,
    }).setDepth(9001);
    this.add.particles(0, 0, 'realm_dot', {
      x: { min: 100, max: 760 }, y: { min: 900, max: 1420 },
      lifespan: 5000, speedY: { min: -14, max: -4 }, speedX: { min: -8, max: 8 },
      scale: { start: 0.25, end: 0 }, alpha: { start: 0.9, end: 0 },
      tint: [0x6dff9e, 0xd2ffb0], blendMode: 'ADD', frequency: 140,
    }).setDepth(9001);

    // Low drifting fog banks
    const rnd = new Phaser.Math.RandomDataGenerator(['fog']);
    for (let i = 0; i < 8; i++) {
      const x = rnd.between(0, W), y = rnd.between(0, H);
      const f = this.add.image(x, y, 'realm_soft').setTint(rnd.pick([0x8a7bff, 0x6b8cff, 0xb48bff]))
        .setScale(rnd.realInRange(3.5, 5), rnd.realInRange(1.2, 1.8)).setAlpha(rnd.realInRange(0.06, 0.1))
        .setDepth(9200).setBlendMode(Phaser.BlendModes.ADD);
      this.tweens.add({ targets: f, x: x + rnd.between(-260, 260), duration: rnd.between(14000, 22000), yoyo: true, repeat: -1, ease: 'Sine.inOut' });
    }
  }

  private buildPlayer(): void {
    this.playerLight = this.soft(SANCT.x, SANCT.y, 0xc9b4ff, 0.75, 0.22, 2);
    this.player = spawnSim(this, SANCT.x, SANCT.y + 20);
    this.player.setCollideWorldBounds(true);
    this.arrow = this.add.graphics().setDepth(9400);
    this.arrow.fillStyle(0xffffff, 0.9).fillTriangle(10, 0, -5, -7, -5, 7);
    this.arrow.lineStyle(2, 0xa47bff, 1).strokeTriangle(10, 0, -5, -7, -5, 7);
    if (save.hasLantern()) this.spawnCompanion();
  }

  private spawnCompanion(): void {
    if (this.companion) return;
    const img = this.add.image(this.player.x - 30, this.player.y - 30, 'realm_lantern').setScale(1 / 3);
    const glow = this.soft(img.x, img.y, 0xffa94d, 0.4, 0.55, 9000);
    this.companion = { img, glow };
  }

  private buildWispsAndShards(): void {
    const defs: { area: AreaId; x: number; y: number }[] = [
      { area: 'frost', x: 360, y: 330 },
      { area: 'ember', x: 2060, y: 340 },
      { area: 'ruin', x: 330, y: 1215 },
    ];
    defs.forEach(({ area, x, y }) => {
      const color = AREA_INFO[area].color;
      const beam = this.add.image(x, y - 60, 'realm_soft').setTint(color).setScale(0.35, 2.4).setAlpha(0.3).setBlendMode(Phaser.BlendModes.ADD).setDepth(y + 2);
      const glow = this.soft(x, y, color, 0.55, 0.5, y);
      const gfx = this.add.graphics({ x, y: y - 14 }).setDepth(y + 3);
      drawShard(gfx, color);
      const seal = this.add.graphics({ x, y }).setDepth(y + 4);
      seal.lineStyle(2, color, 0.9).strokeCircle(0, -12, 30);
      seal.lineStyle(1, color, 0.5).strokeCircle(0, -12, 38);
      for (let i = 0; i < 6; i++) {
        const a = (i / 6) * Math.PI * 2;
        seal.fillStyle(color, 1).fillCircle(Math.cos(a) * 34, -12 + Math.sin(a) * 34, 2.5);
      }
      this.tweens.add({ targets: seal, angle: 360, duration: 9000, repeat: -1 });
      this.tweens.add({ targets: gfx, y: y - 22, duration: 1400, yoyo: true, repeat: -1, ease: 'Sine.inOut' });
      this.tweens.add({ targets: glow, alpha: 0.25, scale: 0.7, duration: 1100, yoyo: true, repeat: -1 });
      this.tweens.add({ targets: beam, alpha: 0.12, duration: 1700, yoyo: true, repeat: -1 });
      const sparkle = this.add.particles(x, y - 14, 'realm_dot', {
        x: { min: -18, max: 18 }, y: { min: -26, max: 18 }, lifespan: 900,
        speedY: { min: -30, max: -10 }, scale: { start: 0.35, end: 0 }, alpha: { start: 1, end: 0 },
        tint: [0xffffff, color], blendMode: 'ADD', frequency: 120,
      }).setDepth(y + 5);
      this.shards.push({ area, x, y, color, gfx, glow, beam, seal, sparkle, sealed: true, collected: false });

      for (let i = 0; i < 3; i++) {
        const a = (i / 3) * Math.PI * 2 + 0.5;
        this.spawnWisp(area, x + Math.cos(a) * 110, y + Math.sin(a) * 70);
      }
    });
  }

  private spawnWisp(area: AreaId, x: number, y: number): void {
    const color = AREA_INFO[area].color;
    const glow = this.soft(x, y, color, 0.38, 0.55, y);
    const sprite = this.physics.add.sprite(x, y, 'realm_wisp').setScale(1 / 3).setTint(color);
    this.wispGroup.add(sprite);
    const body = sprite.body as Phaser.Physics.Arcade.Body;
    body.setCircle(36, 18, 39);
    sprite.setCollideWorldBounds(true);
    this.wisps.push({ sprite, glow, area, home: { x, y }, hp: 30, state: 'idle', until: 0, cooldown: 0, lungeHit: false, dead: false, phase: Math.random() * 10 });
  }

  private buildInput(): void {
    const kb = this.input.keyboard!;
    this.cursors = kb.createCursorKeys();
    this.keys = kb.addKeys('W,A,S,D,E,SPACE,SHIFT,ENTER,ESC,P') as Record<string, Phaser.Input.Keyboard.Key>;
    this.keys.SPACE.on('down', () => { if (!this.advanceStory()) this.attack(); });
    this.keys.E.on('down', () => { if (!this.advanceStory()) this.interact(); });
    this.keys.ENTER.on('down', () => this.advanceStory());
    this.keys.SHIFT.on('down', () => this.dodge());
    this.keys.ESC.on('down', () => this.showPause());
    this.keys.P.on('down', () => this.showPause());
    this.input.on('pointerdown', (p: Phaser.Input.Pointer) => {
      if (!p.leftButtonDown() || this.advanceStory()) return;
      this.attack(Math.atan2(p.worldY - (this.player.y + 6), p.worldX - this.player.x));
    });
  }

  /* ================================================================== */
  /* Player actions                                                      */
  /* ================================================================== */

  private canAct(): boolean {
    return !this.over && !this.dead && !this.cutscene && !this.story && !isModalOpen();
  }

  private useStamina(cost: number): boolean {
    if (this.stamina < cost) {
      if (this.time.now > this.tiredShown + 700) {
        this.tiredShown = this.time.now;
        floatText(this, this.player.x, this.player.y - 40, 'OUT OF BREATH', HEX.amber, 13);
        audio.sfx('error');
      }
      return false;
    }
    this.stamina -= cost;
    this.lastStaminaUse = this.time.now;
    return true;
  }

  private attack(angle?: number): void {
    if (!this.canAct() || this.time.now < this.attackReady || this.time.now < this.dodgeUntil) return;
    if (!this.useStamina(ATTACK_COST)) return;
    this.attackReady = this.time.now + 300;
    const a = angle ?? this.facing;
    this.facing = a;
    const px = this.player.x, py = this.player.y + 6;

    // Swing arc
    const g = this.add.graphics({ x: px, y: py }).setDepth(this.player.depth + 1).setBlendMode(Phaser.BlendModes.ADD);
    g.fillStyle(0xd9c4ff, 0.28).slice(0, 0, 66, a - 1.1, a + 1.1, false).fillPath();
    g.lineStyle(4, 0xffffff, 0.9).beginPath().arc(0, 0, 60, a - 1.0, a + 1.0, false).strokePath();
    g.lineStyle(8, 0xa47bff, 0.4).beginPath().arc(0, 0, 56, a - 1.0, a + 1.0, false).strokePath();
    this.tweens.add({ targets: g, alpha: 0, scale: 1.18, duration: 200, ease: 'Cubic.out', onComplete: () => g.destroy() });
    this.player.setVelocity(Math.cos(a) * 60, Math.sin(a) * 60);

    let hit = false;
    for (const w of this.wisps) {
      if (w.dead) continue;
      const d = Phaser.Math.Distance.Between(px, py, w.sprite.x, w.sprite.y);
      const diff = Math.abs(Phaser.Math.Angle.Wrap(Math.atan2(w.sprite.y - py, w.sprite.x - px) - a));
      if (d < 76 && (diff < 1.25 || d < 30)) { this.hitWisp(w, a); hit = true; }
    }
    // Guardian
    const gx = this.guardian.x, gy = this.guardian.y + G_FEET - 20;
    const gd = Phaser.Math.Distance.Between(px, py, gx, gy);
    const gdiff = Math.abs(Phaser.Math.Angle.Wrap(Math.atan2(gy - py, gx - px) - a));
    if (!this.bossDead && gd < 110 && (gdiff < 1.4 || gd < 70)) { this.hitGuardian(); hit = true; }
    if (!hit) audio.sfx('step');
  }

  private rollDamage(base: number): { dmg: number; crit: boolean } {
    const crit = Math.random() < 0.2;
    return { dmg: crit ? base * 2 : base + Phaser.Math.Between(-1, 2), crit };
  }

  private hitWisp(w: Wisp, a: number): void {
    const { dmg, crit } = this.rollDamage(13);
    w.hp -= dmg;
    audio.sfx(crit ? 'crit' : 'hit');
    floatText(this, w.sprite.x, w.sprite.y - 22, crit ? `${dmg}!` : `${dmg}`, crit ? HEX.gold : '#ffffff', crit ? 20 : 15);
    burst(this, w.sprite.x, w.sprite.y, AREA_INFO[w.area].color, 8, 110);
    w.sprite.setTintFill(0xffffff);
    this.time.delayedCall(80, () => { if (!w.dead) w.sprite.setTint(AREA_INFO[w.area].color); });
    w.sprite.setVelocity(Math.cos(a) * 320, Math.sin(a) * 320);
    w.state = 'stun'; w.until = this.time.now + 300;
    if (crit) impact(this, 0.004, 90);
    if (w.hp <= 0) this.killWisp(w);
  }

  private killWisp(w: Wisp): void {
    w.dead = true;
    const color = AREA_INFO[w.area].color;
    burst(this, w.sprite.x, w.sprite.y, color, 20, 180);
    burst(this, w.sprite.x, w.sprite.y, 0xffffff, 8, 90);
    const flash = this.soft(w.sprite.x, w.sprite.y, color, 0.3, 0.9, 9000);
    this.tweens.add({ targets: flash, scale: 1.1, alpha: 0, duration: 450, onComplete: () => flash.destroy() });
    w.sprite.destroy(); w.glow.destroy();
    const left = this.wisps.filter(x => x.area === w.area && !x.dead).length;
    if (left === 0) {
      const shard = this.shards.find(s => s.area === w.area)!;
      shard.sealed = false;
      this.tweens.killTweensOf(shard.seal);
      this.tweens.add({ targets: shard.seal, scale: 2, alpha: 0, duration: 500, onComplete: () => shard.seal.destroy() });
      burst(this, shard.x, shard.y - 14, color, 24, 160);
      audio.sfx('special');
      this.hud.banner('THE SHARD IS FREE', AREA_INFO[w.area].hex, `${AREA_INFO[w.area].name} is quiet now.`);
    }
  }

  private dodge(): void {
    if (!this.canAct() || this.time.now < this.dodgeUntil + 120) return;
    if (!this.useStamina(DODGE_COST)) return;
    const v = this.moveVector();
    if (v.lengthSq() === 0) v.set(Math.cos(this.facing), Math.sin(this.facing));
    this.dodgeDir.copy(v.normalize());
    this.dodgeUntil = this.time.now + 230;
    this.invulnUntil = Math.max(this.invulnUntil, this.time.now + 330);
    audio.sfx('whoosh');
  }

  private moveVector(): Phaser.Math.Vector2 {
    const v = new Phaser.Math.Vector2(0, 0);
    if (this.cursors.left.isDown || this.keys.A.isDown) v.x -= 1;
    if (this.cursors.right.isDown || this.keys.D.isDown) v.x += 1;
    if (this.cursors.up.isDown || this.keys.W.isDown) v.y -= 1;
    if (this.cursors.down.isDown || this.keys.S.isDown) v.y += 1;
    return v;
  }

  private hurt(dmg: number, fromX: number, fromY: number): void {
    if (this.over || this.dead || this.cutscene || this.time.now < this.invulnUntil) return;
    this.hp = Math.max(0, this.hp - dmg);
    this.damageTaken += dmg;
    this.invulnUntil = this.time.now + 800;
    this.lastHurt = this.time.now;
    const a = Math.atan2(this.player.y - fromY, this.player.x - fromX);
    this.player.setVelocity(Math.cos(a) * 280, Math.sin(a) * 280);
    this.knockUntil = this.time.now + 160;
    this.player.setTint(0xff7a9a);
    this.time.delayedCall(160, () => this.player.clearTint());
    floatText(this, this.player.x, this.player.y - 36, `-${dmg}`, HEX.red, 17);
    audio.sfx('hit');
    impact(this, 0.007, 140);
    this.hud.hurtFlash();
    if (this.hp <= 0) this.die();
  }

  private die(): void {
    this.dead = true;
    this.deaths++;
    audio.sfx('lose');
    burst(this, this.player.x, this.player.y, 0xc9a8ff, 24, 160);
    this.player.setVelocity(0, 0).setAlpha(0.3);
    this.clearAttacks();
    this.cameras.main.fadeOut(650, 7, 6, 15);
    this.cameras.main.once(Phaser.Cameras.Scene2D.Events.FADE_OUT_COMPLETE, () => {
      this.player.setPosition(this.respawn.x, this.respawn.y).setAlpha(1);
      this.hp = MAX_HP; this.stamina = MAX_ST;
      this.invulnUntil = this.time.now + 1500;
      if (this.awake && !this.bossDead) {
        this.guardian.setPosition(GUARD_HOME.x, GUARD_HOME.y).setVelocity(0, 0);
        this.nextAttack = this.time.now + 3000;
      }
      this.cameras.main.fadeIn(650, 7, 6, 15);
      this.dead = false;
      this.hud.banner('THE SHRINE CARRIES YOU BACK', HEX.cyan, 'Your shards and lore pages are safe.');
    });
  }

  /* ------------------------------ interact ------------------------------ */

  private nearShard(): Shard | null {
    for (const s of this.shards) {
      if (!s.collected && Phaser.Math.Distance.Between(this.player.x, this.player.y + 20, s.x, s.y) < 62) return s;
    }
    return null;
  }
  private nearElder(): boolean { return Phaser.Math.Distance.Between(this.player.x, this.player.y, ELDER.x, ELDER.y) < 80; }
  private nearWish(): boolean { return Phaser.Math.Distance.Between(this.player.x, this.player.y + 20, WISH.x, WISH.y) < 80; }

  private interact(): void {
    if (!this.canAct()) return;
    const s = this.nearShard();
    if (s) {
      if (s.sealed) {
        const n = this.wisps.filter(w => w.area === s.area && !w.dead).length;
        floatText(this, s.x, s.y - 50, `${n} WISP${n === 1 ? '' : 'S'} STILL GUARD IT`, AREA_INFO[s.area].hex, 14);
        audio.sfx('error');
      } else this.collectShard(s);
      return;
    }
    if (this.nearElder()) { this.talkToElder(); return; }
    if (this.nearWish()) { this.openWish(); }
  }

  private collectShard(s: Shard): void {
    s.collected = true;
    const order = this.shardOrder.length;
    this.shardOrder.push(this.shards.indexOf(s));
    const isNew = save.unlockPage(order);
    audio.sfx('collect');
    s.sparkle.stop();
    this.time.delayedCall(1000, () => s.sparkle.destroy());
    burst(this, s.x, s.y - 14, s.color, 28, 200);
    burst(this, s.x, s.y - 14, 0xffffff, 12, 120);
    const ring = this.add.circle(s.x, s.y - 14, 20).setStrokeStyle(3, s.color, 1).setDepth(9000);
    this.tweens.add({ targets: ring, scale: 4, alpha: 0, duration: 700, ease: 'Cubic.out', onComplete: () => ring.destroy() });
    this.tweens.killTweensOf(s.gfx);
    this.tweens.add({ targets: s.gfx, y: s.y - 70, scale: 1.6, duration: 600, ease: 'Cubic.out' });
    this.tweens.add({ targets: [s.gfx], alpha: 0, delay: 600, duration: 300, onComplete: () => s.gfx.destroy() });
    this.tweens.add({ targets: [s.glow, s.beam], alpha: 0, duration: 900, onComplete: () => { s.glow.destroy(); s.beam.destroy(); } });
    this.cameras.main.flash(250, 200, 180, 255);
    this.player.setVelocity(0, 0);
    this.cutscene = true;
    this.brightenHeart();

    this.time.delayedCall(800, () => {
      this.cutscene = false;
      this.openStory(order, s.color, isNew ? 'NEW PAGE SAVED' : 'ALREADY IN YOUR JOURNAL', () => {
        if (this.shardOrder.length === 3) {
          this.hud.banner('THE HEART IS WHOLE', HEX.violet, 'Carry it to the Sanctum in the north.');
          audio.sfx('special');
        } else {
          this.hud.banner(`SHARD ${this.shardOrder.length} OF 3`, toHex(s.color));
        }
      });
    });
  }

  private brightenHeart(): void {
    const n = this.shardOrder.length;
    this.tweens.add({ targets: this.gHeart, alpha: 0.25 + n * 0.2, scale: 0.2 + n * 0.08, duration: 600 });
  }

  private openStory(page: number, color: number, tag: string, after?: () => void): void {
    this.story = true;
    this.physics.world.pause();
    this.player.setVelocity(0, 0);
    this.hud.showCaption(PAGES[page], color, tag);
    this.storyDone = () => {
      this.story = false;
      this.physics.world.resume();
      after?.();
    };
  }

  /** Closes the story card if it is ready. Returns true if the key was used. */
  private advanceStory(): boolean {
    if (!this.story) return false;
    if (this.hud.captionReady() || !this.hud.captionOpen()) {
      this.hud.closeCaption();
      audio.sfx('click');
      const cb = this.storyDone;
      this.storyDone = null;
      cb?.();
    }
    return true;
  }

  private talkToElder(): void {
    this.talked = true;
    const n = this.shardOrder.length;
    const pages = save.pages().length;
    const best = save.best();
    let greet = '';
    if (this.visits > 1 && pages > 0) {
      greet = `<p><b>Welcome back. You've already read ${pages} of ${PAGES.length} pages.</b>${best !== null ? ` Your best time freeing Yue is ${fmtTime(best)}.` : ''} The realm kept them for you.</p>`;
    } else if (this.visits > 1) {
      greet = '<p><b>Welcome back, traveller.</b> I remember your face.</p>';
    }
    let body: string;
    if (n === 0) {
      body = `<p>The Guardian of this realm sleeps in the Sanctum to the north. Its name is Yue. Long ago its heart broke into three shards.</p>
        <p>One lies in the <b>Frozen Grove</b> to the northwest, one in the <b>Ember Canyon</b> to the northeast, and one in the <b>Overgrown Ruin</b> to the southwest. Wisps guard each one. Bring all three to the Sanctum.</p>`;
    } else if (n < 3) {
      body = `<p>You carry ${n} of 3 shards. Listen to them. Each one remembers something about Yue.</p>`;
    } else {
      body = '<p>The heart is whole. Take it to the Sanctum in the north. Yue will fight you at first. It has been alone so long that it has forgotten what a friend looks like.</p>';
    }
    const tip = '<p style="opacity:.75">Shrines heal you, and if you fall you wake at the last one you lit.</p>';
    this.openModal({ kicker: 'ELDER CHEN', title: n === 3 ? 'Go to Yue' : 'The Lost Realm', body: greet + body + tip });
  }

  private openWish(): void {
    if (save.hasLantern()) {
      this.openModal({
        kicker: 'WISHING LANTERN', title: "Yue's Lantern is yours",
        body: '<p>The little lantern from page I follows you now. It stays saved on this machine, even after you leave.</p>',
      });
      return;
    }
    const wish = (rmb: number, guaranteed: boolean) => {
      wallet.spend(rmb, 'rpg', 'Wish');
      this.wishSpent += rmb;
      const got = guaranteed || Math.random() < 0.3;
      this.quitting = true;
      closeModal();
      this.quitting = false;
      burst(this, WISH.x, WISH.y - 50, 0xffb347, 30, 180);
      audio.sfx(got ? 'win' : 'collect');
      if (got) { save.setLantern(); this.spawnCompanion(); }
      this.openModal({
        kicker: `WISH · RMB ${rmb}`,
        title: got ? "You found Yue's Lantern" : 'Only fireflies this time',
        body: got
          ? '<p>A small paper lantern drifts down and follows you. It is the one Yue carried through the woods. It gives no power. It is here because the story makes you want it.</p>'
          : '<p>A handful of fireflies drift up and away. The featured lantern has a 30% chance on a single wish. You can try again, or pay RMB 30 for a sure thing.</p>',
      });
    };
    this.openModal({
      kicker: 'WISHING LANTERN · FEATURED',
      title: "Yue's Lantern",
      body: `<p>A tiny lantern companion that follows you through the realm. It is the lantern from Yue's story. Purely cosmetic: it does not make you stronger, and you never need it to win.</p>
        <p style="opacity:.75">Simulated money. Single wish RMB 6 (30% chance), or RMB 30 for a guaranteed lantern.</p>`,
      actions: [
        { label: 'Not now', kind: 'ghost', onClick: () => closeModal() },
        { label: 'Wish · RMB 6', kind: 'ghost', onClick: () => wish(6, false) },
        { label: 'Guaranteed · RMB 30', onClick: () => wish(30, true) },
      ],
    });
  }

  /** Modal that pauses the world and resumes it on close. */
  private openModal(o: { kicker: string; title: string; body: string; actions?: { label: string; kind?: 'primary' | 'ghost'; onClick: () => void }[] }): void {
    this.player.setVelocity(0, 0);
    if (!this.scene.isPaused()) this.scene.pause();
    showModal({
      kicker: o.kicker, title: o.title, body: o.body, accent: 'violet',
      actions: o.actions ?? [{ label: 'Continue', onClick: () => closeModal() }],
      onClose: () => { if (!this.quitting) this.resumeWorld(); },
    });
  }

  private resumeWorld(): void {
    this.lastReal = 0;
    this.input.keyboard?.resetKeys();
    this.scene.resume();
  }

  private showPause(): void {
    if (this.over || isModalOpen()) return;
    const n = this.shardOrder.length;
    this.openModal({
      kicker: 'PAUSED', title: 'Lost Realm',
      body: `<p>Shards ${n} of 3 · Lore pages ${save.pages().length} of ${PAGES.length} · ${fmtTime(this.elapsed)}</p><p style="opacity:.75">Your lore pages are already saved.</p>`,
      actions: [
        { label: 'Quit to museum', kind: 'ghost', onClick: () => { this.quitting = true; closeModal(); this.quit(); } },
        { label: 'Resume', onClick: () => closeModal() },
      ],
    });
  }

  private quit(): void {
    const n = this.shardOrder.length;
    if (n === 0 && this.deaths === 0) { this.scene.start('Arcade', { from: 'realm' }); return; }
    this.over = true;
    const pages = save.pages().length;
    showDebrief({
      outcome: 'lose',
      kicker: 'LOST REALM · LEFT THE REALM',
      title: 'The realm will wait',
      stats: this.stats(pages),
      felt: `You found ${n} of 3 shards${this.deaths ? ` and fell ${this.deaths} time${this.deaths === 1 ? '' : 's'}` : ''}. Your ${pages} lore page${pages === 1 ? '' : 's'} stay saved here, so next time Elder Chen picks up where you left off. An arcade machine would have reset you to zero.`,
      finding: this.finding(),
      onReplay: () => this.scene.restart(),
      onExit: () => this.scene.start('Arcade', { from: 'realm' }),
    });
  }

  private stats(pages: number): { label: string; value: string }[] {
    return [
      { label: 'Time', value: fmtTime(this.elapsed) },
      { label: 'Shards', value: `${this.shardOrder.length}/3` },
      { label: 'Lore pages kept', value: `${pages}/${PAGES.length}` },
      { label: 'Damage taken', value: `${this.damageTaken}` },
      { label: 'Visits', value: `${this.visits}` },
      { label: 'Best time', value: save.best() !== null ? fmtTime(save.best()!) : 'None yet' },
    ];
  }

  private finding(): { quote: string; who: string; point: string } {
    const yuki = NPCS.find(n => n.id === 'yuki');
    const quote = yuki?.questions.find(q => q.q.startsWith('How do arcades'))?.a
      ?? "Arcades don't give you anything that lasts. When your credits hit zero, the machine just resets. I want a persistent world, where my story and my items build up over years.";
    return {
      quote,
      who: `${yuki?.name ?? 'Yuki'} · ${yuki?.role ?? 'RPG Enthusiast · Genshin / FWJ'}`,
      point: 'Arcades sell minutes that vanish at zero credits. Open-world RPGs sell a story you care about and progress that stays, which is why players like Yuki keep coming back and keep paying.',
    };
  }

  /* ================================================================== */
  /* Guardian                                                            */
  /* ================================================================== */

  private breakShield(): void {
    this.cutscene = true;
    this.player.setVelocity(0, 0);
    const cam = this.cameras.main;
    cam.stopFollow();
    cam.pan(GUARD_HOME.x, GUARD_HOME.y + 40, 700, 'Sine.easeInOut');
    audio.sfx('special');

    // The three shards fly into the heart
    this.shardOrder.forEach((idx, i) => {
      const color = this.shards[idx].color;
      const g = this.add.graphics({ x: this.player.x + (i - 1) * 24, y: this.player.y - 40 }).setDepth(9300);
      drawShard(g, color);
      const tr = this.soft(g.x, g.y, color, 0.35, 0.8, 9299);
      this.tweens.add({
        targets: [g, tr], x: GUARD_HOME.x, y: GUARD_HOME.y + G_HEART, duration: 900, delay: 200 + i * 180, ease: 'Cubic.in',
        onComplete: () => { burst(this, GUARD_HOME.x, GUARD_HOME.y + G_HEART, color, 14, 140); g.destroy(); tr.destroy(); audio.sfx('collect'); },
      });
    });

    this.time.delayedCall(1300, () => { this.drawShield(1); impact(this, 0.004, 150); audio.sfx('hit'); });
    this.time.delayedCall(1700, () => { this.drawShield(3); impact(this, 0.006, 150); audio.sfx('crit'); });
    this.time.delayedCall(2100, () => {
      // Shatter
      const cx = GUARD_HOME.x, cy = GUARD_HOME.y + 10;
      for (let i = 0; i < 36; i++) {
        const a = Math.random() * Math.PI * 2, r = Math.random() * 110;
        const f = this.add.triangle(cx + Math.cos(a) * r, cy + Math.sin(a) * r, 0, 0, 12, 3, 4, 14, 0xd9c4ff, 0.9).setDepth(9300).setBlendMode(Phaser.BlendModes.ADD);
        this.tweens.add({ targets: f, x: f.x + Math.cos(a) * 160, y: f.y + Math.sin(a) * 160 + 40, angle: Phaser.Math.Between(-360, 360), alpha: 0, duration: 900, ease: 'Cubic.out', onComplete: () => f.destroy() });
      }
      this.shield?.destroy(); this.shield = null;
      this.shieldGlow?.destroy(); this.shieldGlow = null;
      burst(this, cx, cy, 0xffffff, 30, 260);
      cam.flash(400, 230, 210, 255);
      impact(this, 0.014, 400);
      audio.sfx('special');
      this.guardian.clearTint();
      this.tweens.add({ targets: this.gAura, alpha: 0.55, scale: 2.2, duration: 600 });
      this.tweens.add({ targets: this.gHeart, alpha: 1, scale: 0.55, duration: 600 });
      this.hud.banner('THE SHIELD SHATTERS', HEX.violet, 'Yue awakens, confused and afraid.');
    });
    this.time.delayedCall(3300, () => {
      cam.startFollow(this.player, true, 0.09, 0.09, 0, 10);
      this.cutscene = false;
      this.awake = true;
      this.hud.showBoss(true);
      this.nextAttack = this.time.now + 1200;
    });
  }

  private hitGuardian(): void {
    const gx = this.guardian.x, gy = this.guardian.y + 20;
    if (!this.awake) {
      floatText(this, gx, gy - 90, this.shardOrder.length === 3 ? 'COME CLOSER' : 'SHIELDED', HEX.violet, 16);
      audio.sfx('error');
      if (this.shieldGlow) { this.shieldGlow.setAlpha(0.6); }
      return;
    }
    if (this.time.now < this.bossInvulnUntil) { floatText(this, gx, gy - 90, 'IMMUNE', HEX.muted, 13); return; }
    const { dmg, crit } = this.rollDamage(14);
    this.bossHp = Math.max(0, this.bossHp - dmg);
    audio.sfx(crit ? 'crit' : 'hit');
    floatText(this, gx + Phaser.Math.Between(-30, 30), gy - 70, crit ? `${dmg}!` : `${dmg}`, crit ? HEX.gold : '#ffffff', crit ? 24 : 17);
    burst(this, (this.player.x + gx) / 2, (this.player.y + gy) / 2 + 20, crit ? C.gold : 0xd9c4ff, crit ? 16 : 9, 140);
    this.guardian.setTintFill(0xffffff);
    this.time.delayedCall(70, () => { if (!this.bossDead) this.phase === 2 ? this.guardian.setTint(0xbfe8ff) : this.guardian.clearTint(); });
    if (crit) impact(this, 0.005, 100);
    if (this.bossHp <= 0) { this.defeatGuardian(); return; }
    if (this.phase === 1 && this.bossHp <= BOSS_HP / 2) this.enterPhase2();
  }

  private enterPhase2(): void {
    this.phase = 2;
    this.bossInvulnUntil = this.time.now + 1600;
    this.clearAttacks();
    this.nextAttack = this.time.now + 2000;
    audio.sfx('special');
    impact(this, 0.01, 300);
    burst(this, this.guardian.x, this.guardian.y, 0xbfe8ff, 30, 240);
    this.guardian.setTint(0xbfe8ff);
    this.gAura.setTint(0x6fc8ff);
    this.hud.banner('YUE REMEMBERS THE WINTER', '#8fd8ff', 'Its attacks come faster now. Keep moving.');
  }

  private clearAttacks(): void {
    for (const s of this.slams) s.objs.forEach(o => o.destroy());
    for (const o of this.orbs) { o.glow.destroy(); o.core.destroy(); }
    this.slams = []; this.orbs = [];
  }

  private bossAct(): void {
    this.attackCount++;
    const ring = this.attackCount % 2 === 0;
    if (ring) this.castRing(); else this.castSlam();
    this.nextAttack = this.time.now + (this.phase === 1 ? 2700 : 1900);
  }

  private castSlam(): void {
    const n = this.phase === 1 ? 2 : 4;
    const pts = [{ x: this.player.x, y: this.player.y + 24 }];
    for (let i = 1; i < n; i++) {
      pts.push({ x: this.player.x + Phaser.Math.Between(-130, 130), y: this.player.y + 24 + Phaser.Math.Between(-90, 90) });
    }
    if (this.phase === 2) pts.push({ x: this.guardian.x, y: this.guardian.y + G_FEET });
    const tele = this.phase === 1 ? 1050 : 820;
    this.tweens.add({ targets: this.guardian, y: this.guardian.y - 14, duration: tele * 0.8, yoyo: true, hold: tele * 0.2, ease: 'Sine.out' });
    pts.forEach((p, i) => {
      const r = 62;
      const at = this.time.now + tele + i * 90;
      const outline = this.add.ellipse(p.x, p.y, r * 2, r * 1.2).setStrokeStyle(3, 0xff7ad9, 0.9).setDepth(-2);
      const fill = this.add.ellipse(p.x, p.y, r * 2, r * 1.2, 0xff4fb0, 0.28).setDepth(-2).setScale(0);
      const glow = this.soft(p.x, p.y, 0xff4fb0, 0.5, 0.35, -2);
      this.tweens.add({ targets: fill, scale: 1, duration: at - this.time.now, ease: 'Linear' });
      this.tweens.add({ targets: outline, alpha: 0.4, duration: 160, yoyo: true, repeat: -1 });
      this.slams.push({ x: p.x, y: p.y, r, at, objs: [outline, fill, glow] });
    });
  }

  private detonate(s: Slam): void {
    s.objs.forEach(o => o.destroy());
    const ring = this.add.ellipse(s.x, s.y, s.r * 2, s.r * 1.2).setStrokeStyle(4, 0xffd6f5, 1).setDepth(-1);
    this.tweens.add({ targets: ring, scale: 1.5, alpha: 0, duration: 380, onComplete: () => ring.destroy() });
    burst(this, s.x, s.y, 0xff7ad9, 14, 160);
    impact(this, 0.005, 120);
    audio.sfx('crit');
    const dx = (this.player.x - s.x) / s.r, dy = (this.player.y + 24 - s.y) / (s.r * 0.6);
    if (dx * dx + dy * dy <= 1) this.hurt(16, s.x, s.y);
  }

  private castRing(): void {
    const charge = this.phase === 1 ? 750 : 600;
    audio.sfx('special');
    const charger = this.soft(this.guardian.x, this.guardian.y + G_HEART, 0xffd6f5, 0.2, 0.9, 9100);
    this.tweens.add({ targets: charger, scale: 1.1, alpha: 0.4, duration: charge, onComplete: () => charger.destroy() });
    const waves = this.phase === 1 ? 1 : 2;
    const count = this.phase === 1 ? 12 : 14;
    const speed = this.phase === 1 ? 150 : 170;
    for (let w = 0; w < waves; w++) {
      this.time.delayedCall(charge + w * 380, () => {
        if (this.bossDead || this.dead || !this.awake) return;
        const ox = this.guardian.x, oy = this.guardian.y + G_HEART;
        const offset = Math.random() * Math.PI + w * (Math.PI / count);
        for (let i = 0; i < count; i++) {
          const a = offset + (i / count) * Math.PI * 2;
          const glow = this.add.image(ox, oy, 'realm_dot').setTint(this.phase === 1 ? 0xd9a8ff : 0x9fe0ff).setScale(1.1).setBlendMode(Phaser.BlendModes.ADD).setDepth(9100);
          const core = this.add.circle(ox, oy, 4.5, 0xffffff, 1).setDepth(9101);
          this.orbs.push({ glow, core, vx: Math.cos(a) * speed, vy: Math.sin(a) * speed * 0.8, until: this.time.now + 4000 });
        }
        audio.sfx('whoosh');
      });
    }
  }

  private updateGuardian(dt: number): void {
    const t = this.time.now;
    // Orbiting crown stones and glow follow the body
    this.gStones.forEach((s, i) => {
      const a = t * 0.0011 * (this.awake ? 1.8 : 1) + (i / this.gStones.length) * Math.PI * 2;
      s.setPosition(this.guardian.x + Math.cos(a) * 92, this.guardian.y + 10 + Math.sin(a) * 34 + Math.sin(t * 0.003 + i) * 4);
      s.setDepth(Math.sin(a) > 0 ? this.guardian.depth + 1 : this.guardian.depth - 1);
      s.setVisible(!this.bossDead);
    });
    this.gAura.setPosition(this.guardian.x, this.guardian.y);
    this.guardian.setDepth(this.guardian.y + G_FEET);
    this.gHeart.setPosition(this.guardian.x, this.guardian.y + G_HEART).setDepth(this.guardian.depth + 0.5);
    this.gAura.setDepth(this.guardian.depth - 0.5);

    if (!this.awake || this.bossDead || this.dead || this.cutscene || this.story) { this.guardian.setVelocity(0, 0); return; }
    // Drift toward the player but stay inside the arena
    const dx = this.player.x - this.guardian.x, dy = this.player.y - (this.guardian.y + G_FEET - 20);
    const d = Math.hypot(dx, dy);
    const sp = this.phase === 1 ? 38 : 58;
    let vx = 0, vy = 0;
    if (d > 150) { vx = (dx / d) * sp; vy = (dy / d) * sp; }
    const hx = this.guardian.x - GUARD_HOME.x, hy = this.guardian.y - GUARD_HOME.y;
    if (Math.hypot(hx + vx, hy + vy) > 200) { vx = -hx * 0.5; vy = -hy * 0.5; }
    this.guardian.setVelocity(vx, vy);

    if (t >= this.nextAttack) this.bossAct();
    for (let i = this.slams.length - 1; i >= 0; i--) {
      if (t >= this.slams[i].at) { this.detonate(this.slams[i]); this.slams.splice(i, 1); }
    }
    const s = dt / 1000;
    for (let i = this.orbs.length - 1; i >= 0; i--) {
      const o = this.orbs[i];
      o.glow.x += o.vx * s; o.glow.y += o.vy * s;
      o.core.setPosition(o.glow.x, o.glow.y);
      const hit = Phaser.Math.Distance.Between(o.glow.x, o.glow.y, this.player.x, this.player.y + 4) < 18;
      if (hit) this.hurt(10, o.glow.x, o.glow.y);
      if (hit || t > o.until) { o.glow.destroy(); o.core.destroy(); this.orbs.splice(i, 1); }
    }
  }

  private defeatGuardian(): void {
    this.bossDead = true;
    this.clearAttacks();
    this.guardian.setVelocity(0, 0);
    this.cutscene = true;
    this.player.setVelocity(0, 0);
    audio.sfx('win');
    this.hud.showBoss(false);
    const cam = this.cameras.main;
    cam.stopFollow();
    cam.pan(this.guardian.x, this.guardian.y + 30, 900, 'Sine.easeInOut');
    cam.flash(600, 255, 240, 255);
    impact(this, 0.01, 500);
    this.guardian.clearTint();
    const gx = this.guardian.x, gy = this.guardian.y;
    const pillar = this.add.image(gx, gy - 200, 'realm_soft').setTint(0xffe6ff).setScale(0.6, 0.1).setAlpha(0).setBlendMode(Phaser.BlendModes.ADD).setDepth(9300);
    this.tweens.add({ targets: pillar, scaleY: 6, alpha: 0.7, duration: 1400, ease: 'Cubic.out' });
    this.tweens.add({ targets: this.gHeart, scale: 2.2, alpha: 1, duration: 1600 });
    this.tweens.add({ targets: this.guardian, alpha: 0, y: gy - 30, duration: 2200, delay: 600 });
    this.tweens.add({ targets: this.gAura, alpha: 0, duration: 2400, delay: 600 });
    for (let i = 0; i < 6; i++) {
      this.time.delayedCall(300 + i * 260, () => burst(this, gx + Phaser.Math.Between(-60, 60), gy + Phaser.Math.Between(-50, 80), [0xffd6f5, 0xa47bff, 0x9fe0ff][i % 3], 18, 200));
    }
    // A lantern rises from where Yue stood
    this.time.delayedCall(1800, () => {
      const lantern = this.add.image(gx, gy + 20, 'realm_lantern').setScale(1 / 3 * 1.6).setDepth(9310).setAlpha(0);
      const lg = this.soft(gx, gy + 20, 0xffa94d, 0.7, 0, 9309);
      this.tweens.add({ targets: [lantern], alpha: 1, y: gy - 40, duration: 1600, ease: 'Sine.out' });
      this.tweens.add({ targets: [lg], alpha: 0.8, y: gy - 40, duration: 1600, ease: 'Sine.out' });
      this.tweens.add({ targets: pillar, alpha: 0, duration: 1600, delay: 600 });
    });
    this.time.delayedCall(3600, () => {
      this.cutscene = false;
      const isNew = save.unlockPage(3);
      this.openStory(3, 0xffd6f5, isNew ? 'NEW PAGE SAVED' : 'ALREADY IN YOUR JOURNAL', () => this.finishRun());
    });
  }

  private finishRun(): void {
    this.over = true;
    this.newBest = save.submitTime(this.elapsed);
    save.addClear();
    const pages = save.pages().length;
    const returning = this.pagesAtStart > 0;
    const best = save.best();
    let felt = `You freed Yue in ${fmtTime(this.elapsed)}${this.newBest ? ', a new best' : best !== null ? ` (best ${fmtTime(best)})` : ''}. `;
    felt += `${pages} of ${PAGES.length} lore pages are saved on this machine${returning ? ', added to what you found on an earlier visit' : ''}, and Elder Chen will remember them next time.`;
    if (this.wishSpent > 0) felt += ` You spent RMB ${this.wishSpent} on a wish. It changed how your run looked, not how hard it was.`;
    showDebrief({
      outcome: 'win',
      kicker: 'LOST REALM · YUE IS FREE',
      title: 'The lantern is lit again',
      stats: this.stats(pages),
      felt,
      finding: this.finding(),
      onReplay: () => this.scene.restart(),
      onExit: () => this.scene.start('Arcade', { from: 'realm' }),
    });
  }

  /* ================================================================== */
  /* Frame                                                               */
  /* ================================================================== */

  update(_t: number, delta: number): void {
    if (!this.player?.body) return;
    const now = this.time.now;
    const frozen = this.over || this.dead || this.cutscene || this.story;
    // Clear time uses the wall clock so slow frames don't shrink it
    const real = performance.now();
    const step = Math.min(real - (this.lastReal || real), 500);
    this.lastReal = real;
    if (!this.over && !this.story && !this.dead && !this.bossDead) this.elapsed += step;

    // Stamina and slow health regen
    if (now - this.lastStaminaUse > 450) this.stamina = Math.min(MAX_ST, this.stamina + delta * 0.034);
    if (now - this.lastHurt > 4000 && !this.dead) this.hp = Math.min(MAX_HP, this.hp + delta * 0.003);

    // Movement
    const v = this.moveVector();
    if (frozen) {
      if (!this.dead) this.player.setVelocity(0, 0);
    } else if (now < this.dodgeUntil) {
      this.player.setVelocity(this.dodgeDir.x * 470, this.dodgeDir.y * 470);
      if (now > this.lastGhost + 35) {
        this.lastGhost = now;
        const ghost = this.add.image(this.player.x, this.player.y, 'player').setScale(1 / 3).setTint(0xa47bff).setAlpha(0.5).setDepth(this.player.depth - 1).setBlendMode(Phaser.BlendModes.ADD);
        this.tweens.add({ targets: ghost, alpha: 0, duration: 260, onComplete: () => ghost.destroy() });
      }
    } else if (now >= this.knockUntil && now >= this.attackReady - 220) {
      if (v.lengthSq() > 0) {
        v.normalize();
        this.facing = Math.atan2(v.y, v.x);
        this.player.setVelocity(v.x * PLAYER_SPEED, v.y * PLAYER_SPEED);
      } else this.player.setVelocity(0, 0);
    }
    const moving = !frozen && v.lengthSq() > 0;
    this.player.setAngle(moving ? Math.sin(now * 0.018) * 5 : 0);
    if (Math.cos(this.facing) < -0.2) this.player.setFlipX(true); else if (Math.cos(this.facing) > 0.2) this.player.setFlipX(false);
    // Invulnerability blink
    this.player.setAlpha(this.dead ? 0.3 : now < this.invulnUntil && now > this.dodgeUntil + 100 ? (Math.floor(now / 70) % 2 ? 0.45 : 1) : 1);
    this.player.setDepth(this.player.y + 26);
    this.playerLight.setPosition(this.player.x, this.player.y + 10);

    if (this.companion) {
      const c = this.companion;
      const tx = this.player.x - 28 * (this.player.flipX ? -1 : 1), ty = this.player.y - 34 + Math.sin(now * 0.004) * 5;
      c.img.x += (tx - c.img.x) * 0.06; c.img.y += (ty - c.img.y) * 0.06;
      c.img.setDepth(this.player.depth + 2).setAngle(Math.sin(now * 0.003) * 8);
      c.glow.setPosition(c.img.x, c.img.y);
    }

    if (!frozen) {
      this.updateShrines();
      this.updateWisps(now);
      if (this.shardOrder.length === 3 && !this.awake && !this.bossDead &&
        Phaser.Math.Distance.Between(this.player.x, this.player.y, GUARD_HOME.x, GUARD_HOME.y + G_FEET) < 240) {
        this.breakShield();
      }
    }
    this.updateGuardian(frozen ? 0 : delta);
    this.updateGuidance(now);
  }

  private updateShrines(): void {
    for (const s of this.shrines) {
      const d = Phaser.Math.Distance.Between(this.player.x, this.player.y + 20, s.x, s.y);
      if (d > 70) continue;
      if (!s.lit) {
        s.lit = true;
        s.flame.setTint(0x9cf0ff).setAlpha(0.8);
        s.core.setFillStyle(0xe8fbff);
        burst(this, s.x, s.y - 34, 0x9cf0ff, 16, 120);
        audio.sfx('collect');
        floatText(this, s.x, s.y - 60, 'SHRINE LIT', HEX.cyan, 14);
      }
      this.respawn = { x: s.x, y: s.y + 40 };
      if (this.hp < MAX_HP - 1) {
        this.hp = MAX_HP;
        floatText(this, this.player.x, this.player.y - 40, 'HEALED', HEX.green, 14);
      }
    }
  }

  private updateWisps(now: number): void {
    const px = this.player.x, py = this.player.y + 6;
    for (const w of this.wisps) {
      if (w.dead) continue;
      const sp = w.sprite;
      const d = Phaser.Math.Distance.Between(px, py, sp.x, sp.y);
      const fromHome = Phaser.Math.Distance.Between(sp.x, sp.y, w.home.x, w.home.y);
      switch (w.state) {
        case 'idle': {
          const tx = w.home.x + Math.cos(now * 0.0012 + w.phase) * 30, ty = w.home.y + Math.sin(now * 0.0016 + w.phase) * 20;
          sp.setVelocity((tx - sp.x) * 1.2, (ty - sp.y) * 1.2);
          if (d < 210) w.state = 'chase';
          break;
        }
        case 'chase': {
          if (fromHome > 420 || d > 360) { w.state = 'idle'; break; }
          if (d < 72 && now > w.cooldown) {
            w.state = 'windup'; w.until = now + 480;
            sp.setVelocity(0, 0);
            this.tweens.add({ targets: sp, scale: 1 / 3 * 1.3, duration: 240, yoyo: true });
            break;
          }
          const s = 78;
          sp.setVelocity(((px - sp.x) / d) * s, ((py - sp.y) / d) * s);
          break;
        }
        case 'windup':
          sp.setVelocity(0, 0);
          if ((Math.floor(now / 60) % 2) === 0) sp.setTintFill(0xffffff); else sp.setTint(AREA_INFO[w.area].color);
          if (now >= w.until) {
            sp.setTint(AREA_INFO[w.area].color);
            w.state = 'lunge'; w.until = now + 260; w.lungeHit = false;
            const a = Math.atan2(py - sp.y, px - sp.x);
            sp.setVelocity(Math.cos(a) * 330, Math.sin(a) * 330);
          }
          break;
        case 'lunge':
          if (!w.lungeHit && d < 28) { w.lungeHit = true; this.hurt(10, sp.x, sp.y); }
          if (now >= w.until) { w.state = 'chase'; w.cooldown = now + 1100; }
          break;
        case 'stun':
          sp.setVelocity(sp.body!.velocity.x * 0.88, sp.body!.velocity.y * 0.88);
          if (now >= w.until) { w.state = 'chase'; w.cooldown = Math.max(w.cooldown, now + 500); }
          break;
      }
      sp.setDepth(sp.y + 14);
      w.glow.setPosition(sp.x, sp.y).setDepth(sp.y + 13).setAlpha(0.45 + Math.sin(now * 0.006 + w.phase) * 0.15);
    }
  }

  private updateGuidance(now: number): void {
    const n = this.shardOrder.length;
    let objective = '';
    let target: { x: number; y: number } | null = null;
    if (this.bossDead) objective = 'Yue is free';
    else if (this.awake) objective = 'Free Yue, the Moonwarden';
    else if (n === 3) { objective = 'Bring the heart to the Sanctum (north)'; target = { x: GUARD_HOME.x, y: GUARD_HOME.y + G_FEET }; }
    else if (!this.talked && n === 0) { objective = 'Talk to Elder Chen'; target = ELDER; }
    else {
      objective = `Find the heart shards  ${n}/3`;
      let best = Infinity;
      for (const s of this.shards) {
        if (s.collected) continue;
        const d = Phaser.Math.Distance.Between(this.player.x, this.player.y, s.x, s.y);
        if (d < best) { best = d; target = s; }
      }
    }
    this.hud.setObjective(objective);

    // Arrow that orbits the player and points at the objective
    const show = !!target && !this.story && !this.cutscene && !this.over &&
      Phaser.Math.Distance.Between(this.player.x, this.player.y, target.x, target.y) > 170;
    this.arrow.setVisible(show);
    if (show && target) {
      const a = Math.atan2(target.y - this.player.y, target.x - this.player.x);
      const r = 52 + Math.sin(now * 0.006) * 4;
      this.arrow.setPosition(this.player.x + Math.cos(a) * r, this.player.y + 6 + Math.sin(a) * r * 0.8).setRotation(a);
    }

    // Context hint
    let hint = DEFAULT_HINT;
    if (this.story) hint = '<kbd>E</kbd> Continue';
    else if (this.cutscene || this.over) hint = '';
    else {
      const s = this.nearShard();
      if (s) hint = s.sealed ? 'Defeat the wisps to free the shard' : '<kbd>E</kbd> Pick up shard';
      else if (this.nearElder()) hint = '<kbd>E</kbd> Talk to Elder Chen';
      else if (this.nearWish()) hint = '<kbd>E</kbd> Make a wish';
      else if (!this.awake && n < 3 && Phaser.Math.Distance.Between(this.player.x, this.player.y, GUARD_HOME.x, GUARD_HOME.y) < 260) hint = 'The shield holds. Bring all three shards.';
      else if (this.awake && !this.bossDead) hint = '<kbd>SPACE</kbd> Attack <kbd>SHIFT</kbd> Dodge through pink circles and light orbs';
    }
    if (hint !== this.lastHint) { this.lastHint = hint; setHint(hint); }
  }
}
