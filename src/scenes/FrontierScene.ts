/**
 * Cabinet 03: Frontier. A three-minute settlement SLG.
 * Workers walk between the town and the forest, fields and quarry. Buildings
 * sit on plots behind construction timers. Raiders march in on a countdown.
 * Every wait has a one-click price next to it, and before the last raid an
 * alliance pack offers 200 chests and allied troops for 648 yuan.
 */
import Phaser from 'phaser';
import { audio } from '../audio';
import { fitToScreen, setHint, setLocation, WORLD_W } from '../view';
import { showModal, closeModal, isModalOpen, showDebrief, type GameIntro } from '../ui/modals';
import { ensureTextures } from '../assets';
import { TEX_SCALE } from '../sims';
import { wallet } from '../wallet';
import { FONT, HEX, C, glassPanel, cinematicCamera, floatText, burst, impact } from '../theme';
import {
  ensureFrontierArt, drawMap, drawTownHall, drawBuilding, drawScaffold, MAP, RES_COLOR,
  type Res, type BuildKind,
} from './frontier/art';
import { Btn } from './frontier/ui';

export const INTRO: GameIntro = {
  number: '03',
  genre: 'SLG · STRATEGY',
  title: 'Frontier',
  realWorld: 'Modelled on Rise of Kingdoms and other alliance strategy games',
  pitch: 'Grow a settlement against the clock and survive three raids, while a one-click price tag offers to make every wait disappear.',
  controls: [['Mouse', 'Assign workers, build, buy'], ['+ / −', 'Move a worker to a job'], ['Esc', 'Pause']],
  goal: 'Keep the town standing through 3 raids. Feed your workers, build palisades and towers, and post guards.',
  accent: 'cyan',
};

type Job = Res | 'guard' | 'idle';
const JOBS: Exclude<Job, 'idle'>[] = ['wood', 'food', 'stone', 'guard'];
const RES: Res[] = ['wood', 'food', 'stone'];

/** Output per worker per second. */
const RATE: Record<Res, number> = { wood: 0.6, food: 0.75, stone: 0.42 };
/** Food each worker eats per second. */
const EAT = 0.1;
const FARM_FOOD = 0.6;
const BUILD: Record<BuildKind, { name: string; cost: Partial<Record<Res, number>>; time: number; effect: string; color: number; pref: number[] }> = {
  farm:     { name: 'Farm',       cost: { wood: 8 },            time: 10, effect: '+0.6 food/s',     color: C.gold,   pref: [4, 2, 7, 0, 6, 1, 3, 5] },
  palisade: { name: 'Palisade',   cost: { wood: 6, stone: 8 },  time: 14, effect: '+8 defence',      color: C.cyan,   pref: [3, 5, 1, 7, 6, 0, 2, 4] },
  tower:    { name: 'Watchtower', cost: { wood: 10, stone: 6 }, time: 12, effect: '+5 def +1/guard', color: C.violet, pref: [1, 3, 5, 6, 0, 7, 2, 4] },
};
const RECRUIT = { cost: { food: 10 } as Partial<Record<Res, number>>, time: 8 };
const RAID_STRENGTH = [14, 26, 48];
const RAID_WAIT = [45, 50, 55];
const TOWN_HP = 60;
const BASE_DEF = 4;
const MAX_WORKERS = 12;
const ALLY_DEF = 60;
const ALLY_PRICE = 648;
const LOOKS = ['player', 'npc_warm', 'npc_cool', 'npc_violet', 'npc_gold'];
const WORKER_SCALE = 0.42 / TEX_SCALE;

/** Set a text colour only when it changes: setColor re-renders the text. */
function tc(t: Phaser.GameObjects.Text, color: string): void {
  if (t.style.color !== color) t.setColor(color);
}

type Phase = 'wait' | 'march' | 'clash' | 'result' | 'over';

interface Worker {
  spr: Phaser.GameObjects.Image;
  carry: Phaser.GameObjects.Image;
  job: Job;
  state: 'go' | 'work' | 'back' | 'post';
  x: number; y: number;
  tx: number; ty: number;
  t: number;
  since: number;
  phase: number;
}

interface Timer {
  left: number;
  total: number;
  bar: Phaser.GameObjects.Graphics;
  label: Phaser.GameObjects.Text;
  btn: Btn;
  price: Phaser.GameObjects.Text;
  bx: number; by: number;
}

interface Building { kind: BuildKind; plot: number }

interface Card { btn: Btn; status: Phaser.GameObjects.Text; effect: string }

export class FrontierScene extends Phaser.Scene {
  // Economy
  private res!: Record<Res, number>;
  private workers!: Worker[];
  private buildings!: Building[];
  private starving!: boolean;
  private hp!: number;
  private clock!: number;
  private farmTick!: number;

  // Timers
  private build!: (Timer & { kind: BuildKind; plot: number; gfx: Phaser.GameObjects.Graphics }) | null;
  private training!: Timer | null;

  // Raid
  private phase!: Phase;
  private round!: number;
  private countdown!: number;
  private alerted!: Set<number>;
  private raiders!: { spr: Phaser.GameObjects.Image; glow: Phaser.GameObjects.Image }[];
  private allies!: Phaser.GameObjects.Image[];
  private allyBought!: boolean;
  private offered!: boolean;
  private raidsSurvived!: number;

  // Money and time
  private spent!: number;
  private purchases!: number;
  private skipped!: number;
  private waited!: number;

  // Display
  private plotGfx!: Phaser.GameObjects.Graphics[];
  private torches!: Phaser.GameObjects.Image[];
  private fire!: Phaser.GameObjects.Image;
  private resText!: Record<Res, Phaser.GameObjects.Text>;
  private rateText!: Record<Res, Phaser.GameObjects.Text>;
  private roundText!: Phaser.GameObjects.Text;
  private countText!: Phaser.GameObjects.Text;
  private defText!: Phaser.GameObjects.Text;
  private raidText!: Phaser.GameObjects.Text;
  private skipBtn!: Btn;
  private skipPrice!: Phaser.GameObjects.Text;
  private hpBar!: Phaser.GameObjects.Graphics;
  private spentText!: Phaser.GameObjects.Text;
  private jobCount!: Record<string, Phaser.GameObjects.Text>;
  private jobRate!: Record<string, Phaser.GameObjects.Text>;
  private workerHeader!: Phaser.GameObjects.Text;
  private idleText!: Phaser.GameObjects.Text;
  private cards!: Record<BuildKind | 'recruit', Card>;
  private pill!: Phaser.GameObjects.Text;
  private pillUntil!: number;
  private edge!: Phaser.GameObjects.Graphics;
  private hintCleared!: boolean;

  constructor() { super('Frontier'); }

  create(): void {
    // Reset everything: Phaser reuses this instance between visits
    this.res = { wood: 12, food: 14, stone: 6 };
    this.workers = [];
    this.buildings = [];
    this.starving = false;
    this.hp = TOWN_HP;
    this.clock = 0;
    this.farmTick = 0;
    this.build = null;
    this.training = null;
    this.phase = 'wait';
    this.round = 1;
    this.countdown = RAID_WAIT[0];
    this.alerted = new Set();
    this.raiders = [];
    this.allies = [];
    this.allyBought = false;
    this.offered = false;
    this.raidsSurvived = 0;
    this.spent = 0;
    this.purchases = 0;
    this.skipped = 0;
    this.waited = 0;
    this.pillUntil = 0;
    this.hintCleared = false;
    this.jobCount = {};
    this.jobRate = {};

    fitToScreen(this);
    ensureTextures(this);
    ensureFrontierArt(this);
    audio.setMode('frontier');
    setLocation('CABINET 03 · FRONTIER');
    setHint('Use <kbd>+</kbd> and <kbd>−</kbd> to move workers. Build before the raid. <kbd>Esc</kbd> Pause');
    cinematicCamera(this, { bloom: 0.9, vignette: 0.9 });

    const map = drawMap(this);
    this.torches = map.torches;
    this.fire = map.fire;
    drawTownHall(this);
    this.plotGfx = MAP.plots.map(p => this.add.graphics({ x: p.x, y: p.y }).setDepth(p.y + 20));
    this.plotGfx.forEach((_, i) => this.drawPlot(i));

    this.buildHud();
    this.buildWorkerPanel();
    this.buildCards();

    this.edge = this.add.graphics().setDepth(1900);

    const start: Job[] = ['wood', 'wood', 'food', 'food', 'stone', 'stone'];
    start.forEach((j, i) => this.addWorker(j, MAP.drop.x - 30 + i * 12, MAP.drop.y + 10));

    this.showPill('Survive 3 raids. Build defences, post guards, keep everyone fed.', 6, HEX.cyan);

    const onPause = () => this.openPause();
    this.input.keyboard!.on('keydown-ESC', onPause);
    this.input.keyboard!.on('keydown-P', onPause);
    this.input.on('pointerdown', () => this.clearHint());
    this.time.delayedCall(14000, () => this.clearHint());
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      this.input.keyboard?.off('keydown-ESC', onPause);
      this.input.keyboard?.off('keydown-P', onPause);
    });

    this.refreshHud();
  }

  /* ---------------------------------------------------------------- */
  /* HUD                                                               */
  /* ---------------------------------------------------------------- */

  private txt(x: number, y: number, s: string, size: number, color: string, font = FONT.ui, bold = false): Phaser.GameObjects.Text {
    return this.add.text(x, y, s, { fontFamily: font, fontSize: `${size}px`, color, fontStyle: bold ? 'bold' : 'normal' }).setDepth(2001);
  }

  private icon(x: number, y: number, key: string, px: number): Phaser.GameObjects.Image {
    return this.add.image(x, y, key).setScale(px / (20 * TEX_SCALE)).setDepth(2001);
  }

  private buildHud(): void {
    glassPanel(this, 8, 6, 282, 52, C.cyan).setDepth(2000);
    this.resText = {} as any;
    this.rateText = {} as any;
    RES.forEach((r, i) => {
      const gx = 14 + i * 92;
      this.icon(gx + 14, 32, `fr_${r}`, 24);
      this.resText[r] = this.txt(gx + 30, 11, '0', 18, RES_COLOR[r], FONT.display);
      this.rateText[r] = this.txt(gx + 31, 36, '', 12, HEX.muted, FONT.mono);
    });

    glassPanel(this, 298, 6, 280, 52, C.red).setDepth(2000);
    this.roundText = this.txt(310, 11, 'ROUND 1/3', 12, HEX.cyan, FONT.mono);
    this.countText = this.txt(309, 26, '0:45', 20, HEX.white, FONT.display);
    this.icon(400, 21, 'fr_shield', 16);
    this.defText = this.txt(411, 13, '', 14, HEX.cyan, FONT.ui, true);
    this.icon(400, 43, 'fr_sword', 16);
    this.raidText = this.txt(411, 35, '', 14, HEX.red, FONT.ui, true);

    this.skipBtn = new Btn(this, 536, 32, { w: 72, h: 42, color: C.pink, onClick: () => this.buySkip() }).setDepth(2001);
    const sl = this.add.text(0, -9, 'SKIP WAIT', { fontFamily: FONT.mono, fontSize: '12px', color: HEX.white }).setOrigin(0.5);
    this.skipPrice = this.add.text(0, 8, '¥68', { fontFamily: FONT.display, fontSize: '14px', color: HEX.gold }).setOrigin(0.5);
    this.skipBtn.add([sl, this.skipPrice]);

    glassPanel(this, 586, 6, 132, 52, C.pink).setDepth(2000);
    this.txt(596, 11, 'TOWN', 12, HEX.muted, FONT.mono);
    this.hpBar = this.add.graphics().setDepth(2001);
    this.txt(596, 36, 'SPENT', 12, HEX.muted, FONT.mono);
    this.spentText = this.txt(708, 31, '¥0', 16, HEX.pink, FONT.display).setOrigin(1, 0);

    this.pill = this.add.text(WORLD_W / 2, 72, '', {
      fontFamily: FONT.ui, fontSize: '14px', fontStyle: 'bold', color: HEX.white,
      backgroundColor: '#0d0b1add', padding: { x: 12, y: 4 },
    }).setOrigin(0.5, 0).setDepth(1950).setVisible(false);
  }

  private buildWorkerPanel(): void {
    glassPanel(this, 8, 394, 438, 120, C.cyan).setDepth(2000);
    this.workerHeader = this.txt(20, 401, '', 12, HEX.cyan, FONT.mono);
    this.idleText = this.txt(434, 401, '', 12, HEX.muted, FONT.mono).setOrigin(1, 0);
    const label: Record<string, string> = { wood: 'WOOD', food: 'FOOD', stone: 'STONE', guard: 'GUARD' };
    const iconKey: Record<string, string> = { wood: 'fr_wood', food: 'fr_food', stone: 'fr_stone', guard: 'fr_shield' };
    const color: Record<string, number> = { wood: 0xe0a465, food: 0xffd45c, stone: 0xc9d3e0, guard: C.cyan };
    JOBS.forEach((job, i) => {
      const cx = 66 + i * 106;
      if (i > 0) this.add.graphics().setDepth(2001).fillStyle(0xffffff, 0.07).fillRect(cx - 53, 424, 1, 80);
      this.icon(cx - 26, 430, iconKey[job], 18);
      this.txt(cx - 14, 423, label[job], 14, job === 'guard' ? HEX.cyan : HEX.white, FONT.ui, true);
      this.jobRate[job] = this.txt(cx, 442, '', 12, HEX.muted, FONT.mono).setOrigin(0.5, 0);
      const minus = new Btn(this, cx - 32, 478, { w: 34, h: 34, color: C.red, onClick: () => this.moveWorker(job, -1) }).setDepth(2001);
      minus.add(this.add.text(0, -1, '−', { fontFamily: FONT.display, fontSize: '20px', color: HEX.red }).setOrigin(0.5));
      const plus = new Btn(this, cx + 32, 478, { w: 34, h: 34, color: color[job], onClick: () => this.moveWorker(job, 1) }).setDepth(2001);
      plus.add(this.add.text(0, -1, '+', { fontFamily: FONT.display, fontSize: '20px', color: '#' + color[job].toString(16).padStart(6, '0') }).setOrigin(0.5));
      this.jobCount[job] = this.txt(cx, 478, '0', 22, HEX.white, FONT.display).setOrigin(0.5);
    });
  }

  private buildCards(): void {
    glassPanel(this, 454, 394, 458, 120, C.gold).setDepth(2000);
    this.cards = {} as any;
    const defs: { id: BuildKind | 'recruit'; name: string; effect: string; cost: Partial<Record<Res, number>>; time: number; color: number }[] = [
      ...(['farm', 'palisade', 'tower'] as BuildKind[]).map(k => ({ id: k, ...BUILD[k] })),
      { id: 'recruit', name: 'Recruit', effect: '+1 worker', cost: RECRUIT.cost, time: RECRUIT.time, color: C.green },
    ];
    defs.forEach((d, i) => {
      const cx = 515 + i * 112;
      const btn = new Btn(this, cx, 454, {
        w: 104, h: 104, color: d.color, radius: 10,
        onClick: () => d.id === 'recruit' ? this.startRecruit() : this.startBuild(d.id),
      }).setDepth(2001);
      // Picture
      if (d.id === 'recruit') {
        btn.add(this.add.image(0, -24, 'player').setScale(0.5 / TEX_SCALE));
      } else {
        const g = this.add.graphics().setScale(0.6).setPosition(0, -28);
        drawBuilding(g, d.id);
        btn.add(g);
      }
      btn.add(this.add.text(0, -4, d.name, { fontFamily: FONT.ui, fontSize: '14px', fontStyle: 'bold', color: HEX.white }).setOrigin(0.5));
      const status = this.add.text(0, 13, d.effect, { fontFamily: FONT.ui, fontSize: '12px', color: HEX.muted }).setOrigin(0.5);
      btn.add(status);
      // Cost row, centred
      const parts: { key: string; n: string }[] = [];
      for (const r of RES) if (d.cost[r]) parts.push({ key: `fr_${r}`, n: `${d.cost[r]}` });
      parts.push({ key: 'fr_clock', n: `${d.time}s` });
      const items: Phaser.GameObjects.GameObject[] = [];
      let x = 0;
      const row: { img: Phaser.GameObjects.Image; t: Phaser.GameObjects.Text }[] = [];
      for (const p of parts) {
        const img = this.add.image(0, 33, p.key).setScale(14 / (20 * TEX_SCALE));
        const t = this.add.text(0, 33, p.n, { fontFamily: FONT.mono, fontSize: '13px', color: HEX.white }).setOrigin(0, 0.5);
        row.push({ img, t });
        x += 15 + t.width + 6;
      }
      let px = -(x - 6) / 2;
      for (const { img, t } of row) {
        img.setX(px + 7); t.setX(px + 16);
        px += 15 + t.width + 6;
        items.push(img, t);
      }
      btn.add(items);
      this.cards[d.id] = { btn, status, effect: d.effect };
    });
  }

  private clearHint(): void {
    if (this.hintCleared) return;
    this.hintCleared = true;
    setHint('');
  }

  private showPill(text: string, secs: number, color: string = HEX.white): void {
    this.pill.setText(text).setColor(color).setVisible(true).setAlpha(1);
    this.pillUntil = this.clock + secs;
  }

  private refreshHud(): void {
    const mult = this.starving ? 0.5 : 1;
    const n = (j: Job) => this.workers.filter(w => w.job === j).length;
    const farms = this.count('farm');
    for (const r of RES) {
      this.resText[r].setText(`${Math.floor(this.res[r])}`);
      let rate = n(r) * RATE[r] * mult;
      if (r === 'food') rate += farms * FARM_FOOD * mult - this.workers.length * EAT;
      tc(this.rateText[r].setText(`${rate >= 0 ? '+' : ''}${rate.toFixed(1)}/s`), rate < 0 ? HEX.red : HEX.muted);
    }
    tc(this.resText.food, this.starving ? HEX.red : RES_COLOR.food);

    this.roundText.setText(`ROUND ${this.round}/3`);
    const cd = Math.max(0, Math.ceil(this.countdown));
    if (this.phase === 'wait') {
      this.countText.setText(`${Math.floor(cd / 60)}:${String(cd % 60).padStart(2, '0')}`);
      tc(this.countText, cd <= 10 ? HEX.red : HEX.white);
    } else if (this.phase !== 'over') {
      tc(this.countText.setText('RAID'), HEX.red);
    }
    const def = this.defence();
    const str = RAID_STRENGTH[this.round - 1];
    tc(this.defText.setText(`DEFENCE ${def}`), def >= str ? HEX.green : HEX.cyan);
    this.raidText.setText(`RAID ${str}`);

    const can = this.phase === 'wait';
    this.skipBtn.setEnabled(can);
    this.skipPrice.setText(`¥${this.priceFor(this.countdown, true)}`);

    this.hpBar.clear();
    const f = Phaser.Math.Clamp(this.hp / TOWN_HP, 0, 1);
    this.hpBar.fillStyle(0x000000, 0.5).fillRoundedRect(636, 13, 72, 10, 4);
    this.hpBar.fillStyle(f > 0.5 ? C.green : f > 0.25 ? C.amber : C.red, 1).fillRoundedRect(636, 13, Math.max(4, 72 * f), 10, 4);

    this.spentText.setText(`¥${this.spent}`);

    for (const j of JOBS) this.jobCount[j].setText(`${n(j)}`);
    const towers = this.count('tower');
    this.jobRate.wood.setText(`${(RATE.wood * mult).toFixed(1)}/s each`);
    this.jobRate.food.setText(`${(RATE.food * mult).toFixed(1)}/s each`);
    this.jobRate.stone.setText(`${(RATE.stone * mult).toFixed(1)}/s each`);
    this.jobRate.guard.setText(`+${this.guardValue(towers)} def each`);
    this.workerHeader.setText(`WORKERS ${this.workers.length}/${MAX_WORKERS}${this.starving ? '   STARVING: OUTPUT −50%' : ''}`);
    tc(this.workerHeader, this.starving ? HEX.red : HEX.cyan);
    const idle = n('idle');
    tc(this.idleText.setText(idle ? `IDLE ${idle}` : 'IDLE 0'), idle ? HEX.gold : HEX.muted);

    this.refreshCards();
  }

  private refreshCards(): void {
    for (const k of ['farm', 'palisade', 'tower'] as BuildKind[]) {
      const c = this.cards[k];
      const why = this.build ? 'BUILDER BUSY'
        : this.freePlot(k) < 0 ? 'NO FREE PLOT'
        : this.missing(BUILD[k].cost);
      this.setCard(c, why);
    }
    const c = this.cards.recruit;
    const why = this.training ? 'TRAINING'
      : this.workers.length >= MAX_WORKERS ? `MAX ${MAX_WORKERS}`
      : this.missing(RECRUIT.cost);
    this.setCard(c, why);
  }

  private setCard(c: Card, why: string): void {
    c.btn.setEnabled(!why && this.phase !== 'over');
    tc(c.status.setText(why || c.effect), why ? HEX.red : HEX.muted);
  }

  /* ---------------------------------------------------------------- */
  /* Rules                                                             */
  /* ---------------------------------------------------------------- */

  private count(kind: BuildKind): number {
    return this.buildings.filter(b => b.kind === kind).length;
  }

  private guardValue(towers: number): number {
    const v = 2 + Math.min(2, towers);
    return this.starving ? Math.max(1, Math.floor(v / 2)) : v;
  }

  private defence(): number {
    const guards = this.workers.filter(w => w.job === 'guard').length;
    const towers = this.count('tower');
    return BASE_DEF + guards * this.guardValue(towers) + this.count('palisade') * 8 + towers * 5 + (this.allyBought ? ALLY_DEF : 0);
  }

  private missing(cost: Partial<Record<Res, number>>): string {
    for (const r of RES) if ((cost[r] ?? 0) > this.res[r]) return `NEED ${r.toUpperCase()}`;
    return '';
  }

  private freePlot(kind: BuildKind): number {
    const used = new Set(this.buildings.map(b => b.plot));
    if (this.build) used.add(this.build.plot);
    return BUILD[kind].pref.find(i => !used.has(i)) ?? -1;
  }

  /** Simulated price of skipping `left` seconds. */
  private priceFor(left: number, raid = false): number {
    if (raid) return left > 30 ? 68 : left > 10 ? 30 : 6;
    return left > 10 ? 68 : left > 5 ? 30 : 6;
  }

  private pay(rmb: number, what: string, x: number, y: number): void {
    wallet.spend(rmb, 'slg', what);
    this.spent += rmb;
    this.purchases++;
    audio.sfx('coin');
    const t = this.add.text(x, y, `¥${rmb} paid ✓`, {
      fontFamily: FONT.ui, fontStyle: 'bold', fontSize: '15px', color: HEX.green,
      backgroundColor: '#0d0b1ae6', padding: { x: 8, y: 4 },
    }).setOrigin(0.5).setDepth(2100);
    this.tweens.add({ targets: t, y: y - 26, alpha: { from: 1, to: 0 }, delay: 500, duration: 700, onComplete: () => t.destroy() });
    burst(this, x, y, C.gold, 10, 90);
    this.tweens.add({ targets: this.spentText, scale: { from: 1.5, to: 1 }, duration: 350, ease: 'Back.out' });
    this.clearHint();
  }

  /* ---------------------------------------------------------------- */
  /* Workers                                                           */
  /* ---------------------------------------------------------------- */

  private addWorker(job: Job, x: number, y: number): Worker {
    const spr = this.add.image(x, y, LOOKS[this.workers.length % LOOKS.length]).setOrigin(0.5, 0.92).setScale(WORKER_SCALE);
    const carry = this.add.image(x, y, 'fr_wood').setScale(0.2).setVisible(false);
    const w: Worker = { spr, carry, job, state: 'post', x, y, tx: x, ty: y, t: 0, since: this.clock, phase: Math.random() * 6 };
    this.workers.push(w);
    this.assign(w, job);
    return w;
  }

  private assign(w: Worker, job: Job): void {
    w.job = job;
    w.since = this.clock;
    w.carry.setVisible(false);
    w.spr.setAngle(0);
    if (job === 'wood' || job === 'food' || job === 'stone') {
      const n = MAP.nodes[job];
      w.state = 'go';
      w.tx = n.x + Phaser.Math.Between(-n.spread, n.spread) * (job === 'wood' ? 0.4 : 1);
      w.ty = n.y + Phaser.Math.Between(-n.spread, n.spread) * (job === 'food' ? 0.6 : 1);
    } else {
      w.state = 'post';
      this.layoutPosts();
    }
  }

  /** Spread guards along the gate line and idle workers around the fire. */
  private layoutPosts(): void {
    const guards = this.workers.filter(w => w.job === 'guard');
    guards.forEach((w, i) => {
      w.tx = MAP.gate.x - Math.floor(i / 6) * 16;
      w.ty = 262 + (i % 6) * 13;
    });
    const idle = this.workers.filter(w => w.job === 'idle');
    idle.forEach((w, i) => {
      const a = Math.PI * 0.15 + i * 0.7;
      w.tx = MAP.fire.x + Math.cos(a) * 30;
      w.ty = MAP.fire.y + Math.sin(a) * 18 + 6;
    });
  }

  private moveWorker(job: Exclude<Job, 'idle'>, delta: number): void {
    this.clearHint();
    if (this.phase === 'over') return;
    if (delta < 0) {
      const pool = this.workers.filter(w => w.job === job);
      if (!pool.length) { audio.sfx('error'); return; }
      const w = pool.sort((a, b) => Phaser.Math.Distance.Between(a.x, a.y, MAP.drop.x, MAP.drop.y) - Phaser.Math.Distance.Between(b.x, b.y, MAP.drop.x, MAP.drop.y))[0];
      this.assign(w, 'idle');
    } else {
      let pool = this.workers.filter(w => w.job === 'idle');
      if (!pool.length) {
        // Take from the busiest other job
        const counts = JOBS.filter(j => j !== job).map(j => ({ j, n: this.workers.filter(w => w.job === j).length }));
        counts.sort((a, b) => b.n - a.n);
        if (!counts[0] || counts[0].n === 0) { audio.sfx('error'); return; }
        pool = this.workers.filter(w => w.job === counts[0].j);
      }
      this.assign(pool[pool.length - 1], job);
    }
    audio.sfx('click');
    this.refreshHud();
  }

  private stepWorkers(dt: number): void {
    const speed = (this.starving ? 26 : 52) * dt;
    const mult = this.starving ? 0.5 : 1;
    for (const w of this.workers) {
      const dx = w.tx - w.x, dy = w.ty - w.y;
      const d = Math.hypot(dx, dy);
      const moving = d > 1.5 && w.state !== 'work';
      if (moving) {
        const s = Math.min(d, speed);
        w.x += (dx / d) * s;
        w.y += (dy / d) * s;
        w.phase += dt * (this.starving ? 7 : 13);
        if (Math.abs(dx) > 0.5) w.spr.setFlipX(dx < 0);
      } else if (w.state === 'go') {
        w.state = 'work';
        w.t = 1.6;
      } else if (w.state === 'back') {
        const r = w.job as Res;
        const amt = RATE[r] * mult * (this.clock - w.since);
        w.since = this.clock;
        this.res[r] += amt;
        if (amt >= 0.5) floatText(this, w.x, w.y - 30, `+${amt.toFixed(1)}`, RES_COLOR[r], 13);
        w.carry.setVisible(false);
        this.assign(w, r);
      }
      if (w.state === 'work') {
        w.t -= dt * mult;
        w.spr.setAngle(Math.sin(this.clock * 14 + w.phase) * 7);
        if (w.t <= 0) {
          w.spr.setAngle(0);
          w.state = 'back';
          w.tx = MAP.drop.x + Phaser.Math.Between(-16, 16);
          w.ty = MAP.drop.y + Phaser.Math.Between(-4, 8);
          w.carry.setTexture(`fr_${w.job}`).setVisible(true);
        }
      }
      const bob = moving ? Math.abs(Math.sin(w.phase)) * -2 : (w.state === 'post' ? Math.sin(this.clock * 2 + w.phase) * 0.6 : 0);
      w.spr.setPosition(w.x, w.y + bob).setDepth(w.y);
      w.carry.setPosition(w.x, w.y - 30 + bob).setDepth(w.y + 1);
      if (this.starving) w.spr.setTint(0x6070a0); else w.spr.clearTint();
    }
  }

  private killWorker(w: Worker): void {
    this.workers.splice(this.workers.indexOf(w), 1);
    burst(this, w.x, w.y - 12, C.red, 10, 80);
    w.carry.destroy();
    this.tweens.add({ targets: w.spr, alpha: 0, angle: 90, duration: 500, onComplete: () => w.spr.destroy() });
  }

  /* ---------------------------------------------------------------- */
  /* Building and training                                             */
  /* ---------------------------------------------------------------- */

  private drawPlot(i: number): void {
    const g = this.plotGfx[i];
    g.clear();
    const b = this.buildings.find(x => x.plot === i);
    if (b) { drawBuilding(g, b.kind); return; }
    if (this.build?.plot === i) { drawScaffold(g, 1 - this.build.left / this.build.total); return; }
    // Empty plot: dashed outline
    const w = MAP.plotW, h = MAP.plotH;
    g.lineStyle(1.5, C.cyan, 0.3);
    for (let x = -w / 2; x < w / 2; x += 8) { g.lineBetween(x, -h / 2, x + 4, -h / 2); g.lineBetween(x, h / 2, x + 4, h / 2); }
    for (let y = -h / 2; y < h / 2; y += 8) { g.lineBetween(-w / 2, y, -w / 2, y + 4); g.lineBetween(w / 2, y, w / 2, y + 4); }
  }

  private makeTimer(x: number, y: number, total: number, onBuy: () => void): Timer {
    const bar = this.add.graphics().setDepth(1800);
    const label = this.add.text(x, y - 13, '', { fontFamily: FONT.mono, fontSize: '12px', color: HEX.white }).setOrigin(0.5).setDepth(1801);
    label.setShadow(0, 1, '#000000', 3, true, true);
    const btn = new Btn(this, x, y + 18, { w: 66, h: 26, color: C.pink, fill: 0x2a0f2a, onClick: onBuy }).setDepth(1801);
    btn.pulse = true;
    btn.add(this.add.image(-20, 0, 'fr_bolt').setScale(14 / (20 * TEX_SCALE)));
    const price = this.add.text(6, 0, '', { fontFamily: FONT.display, fontSize: '14px', color: HEX.gold }).setOrigin(0.5);
    btn.add(price);
    this.tweens.add({ targets: btn, scale: { from: 1, to: 1.06 }, duration: 600, yoyo: true, repeat: -1, ease: 'Sine.inOut' });
    return { left: total, total, bar, label, btn, price, bx: x, by: y };
  }

  private drawTimer(t: Timer): void {
    const w = 64, p = 1 - t.left / t.total;
    t.bar.clear();
    t.bar.fillStyle(0x000000, 0.7).fillRoundedRect(t.bx - w / 2 - 1, t.by - 4, w + 2, 9, 4);
    t.bar.fillStyle(C.cyan, 1).fillRoundedRect(t.bx - w / 2, t.by - 3, Math.max(4, w * p), 7, 3);
    t.label.setText(`${Math.ceil(t.left)}s`);
    t.price.setText(`¥${this.priceFor(t.left)}`);
  }

  private destroyTimer(t: Timer): void {
    t.bar.destroy(); t.label.destroy(); t.btn.destroy();
  }

  private spendRes(cost: Partial<Record<Res, number>>): void {
    for (const r of RES) this.res[r] -= cost[r] ?? 0;
  }

  private startBuild(kind: BuildKind): void {
    const plot = this.freePlot(kind);
    if (plot < 0 || this.build || this.missing(BUILD[kind].cost)) return;
    this.spendRes(BUILD[kind].cost);
    const p = MAP.plots[plot];
    const t = this.makeTimer(p.x, p.y < 150 ? p.y + 40 : p.y - 58, BUILD[kind].time, () => this.buyBuild());
    this.build = { ...t, kind, plot, gfx: this.plotGfx[plot] };
    audio.sfx('build');
    burst(this, p.x, p.y + 10, 0xc8a070, 14, 90);
    this.drawPlot(plot);
    this.drawTimer(this.build);
    this.refreshHud();
  }

  private buyBuild(): void {
    const b = this.build;
    if (!b) return;
    const price = this.priceFor(b.left);
    this.pay(price, 'Speed-up', b.btn.x, b.btn.y);
    this.skipped += b.left;
    this.finishBuild(true);
  }

  private finishBuild(paid = false): void {
    const b = this.build;
    if (!b) return;
    if (!paid) this.waited += b.total;
    this.build = null;
    this.destroyTimer(b);
    this.buildings.push({ kind: b.kind, plot: b.plot });
    this.drawPlot(b.plot);
    const p = MAP.plots[b.plot];
    audio.sfx('build');
    burst(this, p.x, p.y, 0xd8b890, 18, 130);
    burst(this, p.x, p.y - 10, BUILD[b.kind].color, 10, 110);
    this.tweens.add({ targets: b.gfx, scaleY: { from: 0.6, to: 1 }, scaleX: { from: 1.15, to: 1 }, duration: 380, ease: 'Back.out' });
    floatText(this, p.x, p.y - 30, `${BUILD[b.kind].name.toUpperCase()} READY`, HEX.cyan, 14);
    this.refreshHud();
  }

  private startRecruit(): void {
    if (this.training || this.workers.length >= MAX_WORKERS || this.missing(RECRUIT.cost)) return;
    this.spendRes(RECRUIT.cost);
    this.training = this.makeTimer(MAP.town.x, MAP.town.y - 66, RECRUIT.time, () => this.buyRecruit());
    audio.sfx('click');
    this.drawTimer(this.training);
    this.refreshHud();
  }

  private buyRecruit(): void {
    const t = this.training;
    if (!t) return;
    this.pay(this.priceFor(t.left), 'Speed-up', t.btn.x, t.btn.y);
    this.skipped += t.left;
    this.finishRecruit(true);
  }

  private finishRecruit(paid = false): void {
    const t = this.training;
    if (!t) return;
    if (!paid) this.waited += t.total;
    this.training = null;
    this.destroyTimer(t);
    const w = this.addWorker('idle', MAP.town.x, MAP.town.y + 30);
    burst(this, w.x, w.y - 12, C.green, 12, 90);
    audio.sfx('collect');
    floatText(this, MAP.town.x, MAP.town.y - 20, 'NEW WORKER', HEX.green, 14);
    this.showPill('New worker is idle at the fire. Press + on a job.', 4, HEX.gold);
    this.refreshHud();
  }

  /* ---------------------------------------------------------------- */
  /* Raids                                                             */
  /* ---------------------------------------------------------------- */

  private buySkip(): void {
    if (this.phase !== 'wait') return;
    const price = this.priceFor(this.countdown, true);
    this.pay(price, 'Speed-up', this.skipBtn.x, this.skipBtn.y + 34);
    this.skipped += this.countdown;
    this.countdown = 0;
    this.startRaid();
  }

  private startRaid(): void {
    this.phase = 'march';
    audio.sfx('alert');
    this.showPill(`Raid ${this.round} is here! Strength ${RAID_STRENGTH[this.round - 1]} vs your defence ${this.defence()}`, 5, HEX.red);
    const n = 4 + this.round * 3;
    for (let i = 0; i < n; i++) {
      const sx = WORLD_W + 30 + Math.random() * 90;
      const sy = 268 + Math.random() * 70;
      const spr = this.add.image(sx, sy, 'fr_raider').setOrigin(0.5, 0.92).setScale(0.48 / TEX_SCALE).setFlipX(true).setDepth(sy);
      const glow = this.add.image(sx - 8, sy - 30, 'fr_glow').setTint(0xff4020).setScale(0.35).setDepth(sy + 1);
      glow.setBlendMode(Phaser.BlendModes.ADD);
      this.raiders.push({ spr, glow });
      this.tweens.add({ targets: spr, angle: { from: -5, to: 5 }, duration: 220, yoyo: true, repeat: -1 });
      this.tweens.add({
        targets: spr, x: 742 + Math.random() * 50, duration: 3200 + Math.random() * 500, ease: 'Sine.out',
        delay: i * 60,
      });
    }
    this.time.delayedCall(3900, () => this.clash());
  }

  private clash(): void {
    this.phase = 'clash';
    impact(this, 0.01, 260);
    let k = 0;
    this.time.addEvent({
      delay: 160, repeat: 10, callback: () => {
        const x = 700 + Math.random() * 50, y = 262 + Math.random() * 76;
        burst(this, x, y, k % 2 ? C.red : C.gold, 8, 90);
        if (k++ % 2 === 0) audio.sfx('hit');
      },
    });
    for (const w of this.workers.filter(w => w.job === 'guard')) {
      this.tweens.add({ targets: w, x: w.x + 14, duration: 140, yoyo: true, repeat: 4 });
    }
    for (const a of this.allies) this.tweens.add({ targets: a, x: a.x + 14, duration: 150, yoyo: true, repeat: 4 });
    for (const r of this.raiders) this.tweens.add({ targets: r.spr, x: r.spr.x - 12, duration: 150, yoyo: true, repeat: 4 });
    this.time.delayedCall(1900, () => this.resolveRaid());
  }

  private resolveRaid(): void {
    this.phase = 'result';
    const def = this.defence();
    const str = RAID_STRENGTH[this.round - 1];
    const lines: string[] = [];

    // Upkeep: the troops eat before every raid
    const upkeep = this.workers.length;
    this.res.food -= upkeep;
    lines.push(`Upkeep: ${upkeep} food`);
    if (this.res.food <= 0) {
      this.res.food = 0;
      this.setStarving(true);
      lines.push('Food ran out. Starving!');
    }

    let title: string; let color: string;
    if (def >= str) {
      title = 'RAID REPELLED';
      color = HEX.green;
      lines.unshift(`Your defence (${def}) beat the raiders (${str}).`, 'No losses.');
      audio.sfx('collect');
      for (const r of this.raiders) {
        r.spr.setFlipX(false);
        this.tweens.add({ targets: r.spr, x: WORLD_W + 120, duration: 1600, ease: 'Sine.in' });
      }
    } else {
      const d = str - def;
      title = 'THE TOWN WAS HIT';
      color = HEX.red;
      this.hp = Math.max(0, this.hp - d);
      const lost: string[] = [];
      for (const r of RES) {
        const l = Math.min(Math.floor(this.res[r]), Math.round(d));
        if (l > 0) { this.res[r] -= l; lost.push(`${l} ${r}`); }
      }
      const dead = Math.min(this.workers.length, Math.floor(d / 8));
      const order = [...this.workers].sort((a, b) => (a.job === 'guard' ? 0 : 1) - (b.job === 'guard' ? 0 : 1));
      for (let i = 0; i < dead; i++) this.killWorker(order[i]);
      lines.unshift(`Raiders (${str}) broke through your defence (${def}).`, `Town took ${d} damage.${dead ? ` ${dead} worker${dead > 1 ? 's' : ''} lost.` : ''}`);
      if (lost.length) lines.splice(2, 0, `Looted: ${lost.join(', ')}`);
      impact(this, 0.016, 400);
      audio.sfx('hit');
      for (const r of this.raiders) {
        this.tweens.add({ targets: r.spr, x: MAP.town.x + 60 + Math.random() * 40, y: MAP.town.y + 30 + Math.random() * 30, duration: 900, ease: 'Sine.inOut' });
      }
      for (let i = 0; i < 6; i++) {
        this.time.delayedCall(400 + i * 180, () => {
          burst(this, MAP.town.x - 40 + Math.random() * 80, MAP.town.y - 20 + Math.random() * 40, i % 2 ? C.amber : C.red, 14, 110);
          floatText(this, MAP.town.x, MAP.town.y - 40, `-${Math.ceil(d / 6)}`, HEX.red, 16);
        });
      }
    }
    this.showResult(title, color, lines);
    this.refreshHud();

    this.time.delayedCall(3600, () => {
      for (const r of this.raiders) {
        this.tweens.killTweensOf(r.spr);
        this.tweens.add({ targets: [r.spr, r.glow], alpha: 0, duration: 400, onComplete: () => { r.spr.destroy(); r.glow.destroy(); } });
      }
      this.raiders = [];
      this.afterRaid();
    });
  }

  private showResult(title: string, color: string, lines: string[]): void {
    const w = 330, h = 40 + lines.length * 20 + 14;
    const x = WORLD_W / 2 - w / 2, y = 150;
    const c = this.add.container(0, 0).setDepth(1500);
    c.add(glassPanel(this, x, y, w, h, Phaser.Display.Color.HexStringToColor(color).color));
    const t = this.add.text(WORLD_W / 2, y + 12, title, { fontFamily: FONT.display, fontSize: '20px', color }).setOrigin(0.5, 0);
    t.setShadow(0, 0, color, 10, true, true);
    c.add(t);
    lines.forEach((l, i) => c.add(this.add.text(WORLD_W / 2, y + 42 + i * 20, l, { fontFamily: FONT.ui, fontSize: '14px', color: HEX.white }).setOrigin(0.5, 0)));
    c.setAlpha(0).setScale(0.9);
    this.tweens.add({ targets: c, alpha: 1, duration: 250 });
    this.time.delayedCall(3400, () => this.tweens.add({ targets: c, alpha: 0, duration: 300, onComplete: () => c.destroy() }));
  }

  private afterRaid(): void {
    const alive = this.hp > 0 && (this.workers.length > 0 || this.training !== null);
    if (!alive) { this.endGame(false); return; }
    this.raidsSurvived++;
    if (this.round >= 3) { this.endGame(true); return; }
    this.round++;
    this.countdown = RAID_WAIT[this.round - 1];
    this.alerted = new Set();
    this.phase = 'wait';
    this.refreshHud();
    if (this.round === 3 && !this.offered) this.time.delayedCall(700, () => this.offerAlliance());
  }

  private setStarving(on: boolean): void {
    if (this.starving === on) return;
    this.starving = on;
    if (on) {
      audio.sfx('error');
      this.showPill('STARVING: workers are weak. Output and guards at 50%.', 6, HEX.red);
    } else {
      this.showPill('Fed again. Workers back to full strength.', 3, HEX.green);
    }
    this.refreshHud();
  }

  /* ---------------------------------------------------------------- */
  /* Alliance pack                                                     */
  /* ---------------------------------------------------------------- */

  private offerAlliance(): void {
    if (this.phase !== 'wait' || isModalOpen()) return;
    this.offered = true;
    this.scene.pause();
    showModal({
      kicker: 'ALLIANCE CHAT',
      title: 'The last raid is the biggest yet',
      accent: 'cyan',
      body: `
        <p>Raid strength <b>${RAID_STRENGTH[2]}</b>. Your defence right now: <b>${this.defence()}</b>.</p>
        <p>Your alliance leader is selling the <b>Alliance Pack</b>. Buy it and all 200 members get a chest,
        and allied troops march in to hold your gate (+${ALLY_DEF} defence).</p>
      `,
      actions: [
        { label: 'No thanks', kind: 'ghost', key: 'Esc', onClick: () => closeModal() },
        { label: `Buy · ¥${ALLY_PRICE}`, key: 'Enter', onClick: () => { closeModal(); this.buyAlliance(); } },
      ],
      onClose: () => this.scene.resume(),
    });
  }

  private buyAlliance(): void {
    if (this.allyBought) return;
    this.allyBought = true;
    this.pay(ALLY_PRICE, 'Alliance Pack', WORLD_W / 2, 120);
    audio.sfx('win');
    for (const r of RES) this.res[r] += 20;

    const msg = this.add.text(WORLD_W / 2, 200, '200 CHESTS SENT TO YOUR ALLIANCE', {
      fontFamily: FONT.display, fontSize: '22px', color: HEX.cyan,
    }).setOrigin(0.5).setDepth(1600);
    msg.setShadow(0, 0, HEX.cyan, 14, true, true);
    this.tweens.add({ targets: msg, scale: { from: 0.5, to: 1 }, duration: 400, ease: 'Back.out' });
    this.tweens.add({ targets: msg, alpha: 0, delay: 2600, duration: 500, onComplete: () => msg.destroy() });

    for (let i = 0; i < 200; i++) {
      const chest = this.add.image(WORLD_W / 2 + Phaser.Math.Between(-30, 30), 60, 'fr_chest').setScale(0.25).setDepth(1400);
      const tx = Phaser.Math.Between(210, 880), ty = Phaser.Math.Between(90, 380);
      this.tweens.add({
        targets: chest, x: tx, y: ty, angle: Phaser.Math.Between(-30, 30), delay: i * 7, duration: 650, ease: 'Back.out',
        onComplete: () => {
          if (i % 25 === 0) audio.sfx('coin');
          this.tweens.add({
            targets: chest, x: MAP.drop.x, y: MAP.drop.y, scale: 0.12, alpha: 0.2, delay: 900 + Math.random() * 400, duration: 500,
            ease: 'Cubic.in', onComplete: () => chest.destroy(),
          });
        },
      });
    }
    // Banners around the plaza
    const spots = [[372, 196], [568, 196], [400, 270], [540, 270], [650, 252], [650, 342]];
    spots.forEach(([x, y], i) => {
      const b = this.add.image(x, y, 'fr_banner').setOrigin(0.15, 1).setScale(0).setDepth(y);
      this.tweens.add({ targets: b, scale: 0.4, delay: 600 + i * 120, duration: 400, ease: 'Back.out' });
      this.tweens.add({ targets: b, angle: { from: -3, to: 3 }, duration: 900, yoyo: true, repeat: -1, delay: i * 90 });
    });
    // Allied troops march in from the forest road
    for (let i = 0; i < 12; i++) {
      const tx = 700 + (i % 2) * 16, ty = 258 + Math.floor(i / 2) * 15;
      const a = this.add.image(-30 - i * 14, 214 + (i % 3) * 8, 'fr_ally').setOrigin(0.5, 0.92).setScale(0.46 / TEX_SCALE).setDepth(ty);
      this.allies.push(a);
      this.tweens.add({ targets: a, x: 440, y: 250, delay: 900 + i * 90, duration: 1500 });
      this.tweens.add({
        targets: a, x: tx, y: ty, delay: 2400 + i * 90, duration: 1300,
        onComplete: () => a.setDepth(ty),
      });
    }
    this.showPill(`Allies hold the gate: +${ALLY_DEF} defence, +20 of every resource`, 5, HEX.cyan);
    this.refreshHud();
  }

  /* ---------------------------------------------------------------- */
  /* Pause and end                                                     */
  /* ---------------------------------------------------------------- */

  private openPause(): void {
    if (isModalOpen() || this.phase === 'over') return;
    this.scene.pause();
    let quit = false;
    showModal({
      kicker: 'PAUSED',
      title: 'Frontier',
      accent: 'cyan',
      body: '<p>The timers are frozen. Nobody is charging you for this wait.</p>',
      actions: [
        { label: 'Quit to museum', kind: 'ghost', onClick: () => { quit = true; closeModal(); } },
        { label: 'Resume', key: 'Enter', onClick: () => closeModal() },
      ],
      onClose: () => {
        this.scene.resume();
        if (quit) this.scene.start('Arcade', { from: 'frontier' });
      },
    });
  }

  private endGame(won: boolean): void {
    this.phase = 'over';
    this.refreshHud();
    if (this.build) { this.destroyTimer(this.build); }
    if (this.training) { this.destroyTimer(this.training); }
    if (won) {
      for (let i = 0; i < 5; i++) this.time.delayedCall(i * 220, () => burst(this, 300 + Math.random() * 320, 120 + Math.random() * 160, [C.gold, C.cyan, C.pink][i % 3], 18, 160));
    } else {
      impact(this, 0.02, 500);
      for (let i = 0; i < 8; i++) this.time.delayedCall(i * 140, () => burst(this, MAP.town.x - 40 + Math.random() * 80, MAP.town.y + Math.random() * 30, C.red, 16, 140));
    }
    this.time.delayedCall(1400, () => this.debrief(won));
  }

  private debrief(won: boolean): void {
    const spent = this.spent;
    const skipped = Math.round(this.skipped);
    const waited = Math.round(this.waited);
    const built = this.buildings.length;

    let felt: string;
    if (spent > 0) {
      felt = `You paid ¥${spent} in ${this.purchases} tap${this.purchases > 1 ? 's' : ''}`
        + (skipped > 0 ? ` and skipped ${skipped} seconds of waiting.` : '.')
        + (this.allyBought ? ` The alliance pack alone was ¥${ALLY_PRICE}.` : '')
        + ' Each tap was one click with no confirm, so the relief arrived before the cost registered.';
    } else {
      felt = `You paid nothing and sat through ${waited} seconds of build and training timers. `
        + 'The pink price tag sat next to every one of them, one click away.';
    }

    let finding: { quote: string; who: string; point: string };
    const zhou = 'Mr. Zhou, SLG player, spends ¥15,000 to ¥30,000 a month';
    if (this.allyBought) {
      finding = {
        quote: 'When I buy a 648 yuan pack, all 200 alliance members get a chest. The free players bring the numbers for garrisons and scouting. The paying leaders bring the firepower and keep the economy going.',
        who: zhou,
        point: `Your ¥${spent} is ${Math.max(1, Math.round(spent / 150))}% of his cheapest month. One whale's pack keeps 200 free players playing, and they make his alliance big enough to matter.`,
      };
    } else if (this.purchases >= 3) {
      finding = {
        quote: "You never have to hand over real cash, so it doesn't feel like spending. It's super easy.",
        who: 'Xiao Mei, visitor at Fengyun Zaiqi arcade, Shanghai',
        point: `Your ${this.purchases} one-click payments added up to ¥${spent} in one short game. Strategy games use the same frictionless pay as her QR-code claw machines, and Mr. Zhou spends ¥15,000 to ¥30,000 a month that way.`,
      };
    } else {
      finding = {
        quote: 'In a strategy game, money turns straight into faster marches, stronger troops, and more territory.',
        who: zhou,
        point: spent > 0
          ? `Your ¥${spent} bought ${skipped} seconds. In SLGs the timer is the product: it is built to be uncomfortable so that skipping it feels worth paying for.`
          : 'You played on patience alone. In SLGs the timer is the product: it is built to be uncomfortable so that skipping it feels worth paying for.',
      };
    }

    showDebrief({
      outcome: won ? 'win' : 'lose',
      kicker: `FRONTIER · ${won ? 'SURVIVED' : 'FALLEN'}`,
      title: won ? (this.allyBought ? 'Saved by the alliance' : 'The settlement held!') : 'The town fell',
      stats: [
        { label: 'Raids survived', value: `${this.raidsSurvived}/3` },
        { label: 'Buildings', value: `${built}` },
        { label: 'Workers', value: `${this.workers.length}` },
        { label: 'Simulated spend', value: `¥${spent}` },
        { label: 'Seconds skipped', value: `${skipped}s` },
      ],
      felt,
      finding,
      onReplay: () => this.scene.restart(),
      onExit: () => this.scene.start('Arcade', { from: 'frontier' }),
    });
  }

  /* ---------------------------------------------------------------- */
  /* Frame                                                             */
  /* ---------------------------------------------------------------- */

  update(_time: number, delta: number): void {
    const dt = Math.min(delta, 100) / 1000;
    this.clock += dt;

    if (this.phase !== 'over') {
      const mult = this.starving ? 0.5 : 1;
      // Farms and eating tick continuously
      const farms = this.count('farm');
      this.res.food += farms * FARM_FOOD * mult * dt - this.workers.length * EAT * dt;
      this.farmTick += dt;
      if (this.farmTick >= 5) {
        this.farmTick = 0;
        for (const b of this.buildings.filter(b => b.kind === 'farm')) {
          const p = MAP.plots[b.plot];
          floatText(this, p.x, p.y - 26, `+${(FARM_FOOD * mult * 5).toFixed(1)}`, RES_COLOR.food, 13);
        }
      }
      if (this.res.food <= 0) { this.res.food = 0; this.setStarving(true); }
      else if (this.starving && this.res.food >= 8) this.setStarving(false);

      if (this.build) {
        this.build.left -= dt;
        if (this.build.left <= 0) this.finishBuild();
        else { this.drawTimer(this.build); this.drawPlot(this.build.plot); }
      }
      if (this.training) {
        this.training.left -= dt;
        if (this.training.left <= 0) this.finishRecruit();
        else this.drawTimer(this.training);
      }

      if (this.phase === 'wait') {
        this.countdown -= dt;
        const s = Math.ceil(this.countdown);
        if ((s === 10 || s === 5) && !this.alerted.has(s)) {
          this.alerted.add(s);
          audio.sfx('alert');
          if (s === 10) this.showPill('Raiders sighted on the road!', 3, HEX.red);
        }
        if (this.countdown <= 0) { this.countdown = 0; this.startRaid(); }
      }
      this.refreshHud();
    }

    this.stepWorkers(dt);
    for (const a of this.allies) a.setDepth(a.y);
    for (const r of this.raiders) {
      r.spr.setDepth(r.spr.y);
      r.glow.setPosition(r.spr.x + (r.spr.flipX ? -8 : 8), r.spr.y - 30 + Math.sin(this.clock * 20 + r.spr.y) * 0.8);
    }

    // Firelight flicker; torches turn red when raiders are near
    const danger = (this.phase === 'wait' && this.countdown <= 10) || this.phase === 'march' || this.phase === 'clash';
    this.torches.forEach((t, i) => {
      t.setAlpha(0.65 + Math.sin(this.clock * 9 + i * 1.7) * 0.12 + Math.random() * 0.06);
      t.setTint(danger ? 0xff2a2a : 0xffa040).setScale(danger ? 0.7 : 0.5);
    });
    this.fire.setAlpha(0.8 + Math.sin(this.clock * 7) * 0.1 + Math.random() * 0.08);

    // Red flashing edge around whatever the screen shows
    this.edge.clear();
    if (danger || this.starving) {
      const v = this.cameras.main.worldView;
      const a = (danger ? 0.35 : 0.18) * (0.6 + 0.4 * Math.sin(this.clock * (danger ? 8 : 3)));
      const col = danger ? C.red : 0x7f8fb0;
      for (let i = 0; i < 4; i++) {
        this.edge.lineStyle(10 + i * 10, col, a / (i + 1));
        this.edge.strokeRect(v.x + 4 + i * 5, v.y + 4 + i * 5, v.width - 8 - i * 10, v.height - 8 - i * 10);
      }
    }

    if (this.pill.visible && this.clock > this.pillUntil) {
      this.pill.setAlpha(this.pill.alpha - dt * 3);
      if (this.pill.alpha <= 0) this.pill.setVisible(false);
    }
  }
}

