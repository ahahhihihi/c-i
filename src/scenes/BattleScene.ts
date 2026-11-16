/**
 * Cabinet 01, Battle Arena: a one-lane Honor of Kings style push.
 *
 * Research mechanics built into play:
 *  - Tower aggro rule: hitting the enemy hero inside the enemy tower's range
 *    makes the tower switch to you.
 *  - A "cosmetic" skin for RMB 88 that secretly speeds up attack recovery.
 *  - A star ladder that persists across matches, plus a night clock, to
 *    reproduce the "one more match" pull Alex describes.
 */
import Phaser from 'phaser';
import { ensureTextures } from '../assets';
import { audio } from '../audio';
import { fitToScreen, setHint, setLocation } from '../view';
import { spawnSim, TEX_SCALE } from '../sims';
import { showModal, closeModal, showDebrief, isModalOpen, type GameIntro } from '../ui/modals';
import { FONT, HEX, C, neonText, label, glassPanel, cinematicCamera, impact, floatText, burst } from '../theme';
import { wallet } from '../wallet';
import {
  ensureBattleTextures, drawArena, starPoints,
  LANE_L, LANE_R, LANE_CX, BLUE, RED, BLUE_HEX, RED_HEX,
} from './battle/art';
import { ladder, tierOf, clockText, STARS_PER_TIER } from './battle/rank';

export const INTRO: GameIntro = {
  number: '01',
  genre: 'MOBA',
  title: 'Battle Arena',
  realWorld: "Modelled on Honor of Kings, China's most-played mobile game",
  pitch: 'Push one lane with your minions, land the killing blows for gold, and win a star on the ranked ladder.',
  controls: [['WASD', 'Move'], ['Space', 'Attack (hold)'], ['J', 'Slam (area hit)'], ['Esc', 'Pause']],
  goal: 'Destroy the red tower before the enemy destroys yours.',
  accent: 'gold',
};

type Team = 'blue' | 'red';
type Kind = 'hero' | 'melee' | 'caster' | 'turret';

interface Ent {
  kind: Kind;
  team: Team;
  x: number; y: number;
  hp: number; maxHp: number;
  radius: number;
  alive: boolean;
  atk: number; range: number; recovery: number; atkT: number; speed: number;
  kbx: number; kby: number;
  flash: number; flashing: boolean;
  bob: number; lunge: number; lungeA: number; moving: boolean;
  laneX: number;
  sprite?: Phaser.GameObjects.Image | Phaser.GameObjects.Sprite;
  shadow?: Phaser.GameObjects.Image;
  // towers
  core?: Phaser.GameObjects.Image;
  coreGlow?: Phaser.GameObjects.Image;
  parts?: Phaser.GameObjects.GameObject[];
  target?: Ent | null;
  aggro?: Ent | null;
  aggroUntil?: number;
}

interface Shot { img: Phaser.GameObjects.Image; target: Ent; src: Ent; dmg: number; speed: number; big: boolean }

const BASE_REC = 520;   // ms between attacks, default skin
const SKIN_REC = 430;   // with the RMB 88 skin: about 17% faster
const SKIN_PCT = Math.round((1 - SKIN_REC / BASE_REC) * 100);
const SKIN_PRICE = 88;
const TOWER_HP = 700;
const MINION_SIEGE = 3; // minions hit towers harder, so waves that reach a tower matter
const TOWER_RANGE = 120;
const WAVE_EVERY = 11000;
const PLAYER_RESPAWN = 6000;
const ENEMY_RESPAWN = 8000;
const SPECIAL_CD = 7000;
const SPECIAL_R = 95;
const LEVEL_AT = [0, 120, 280, 480, 720, 1000];

const QUOTE_SKIN = "On paper, skins give a small bonus, like plus 10 attack. But the top skins also change how fast your animations cancel. Han Xin's Street Haunter feels lighter and reacts a few frames faster than the default. It's a gameplay edge disguised as a cosmetic.";
const QUOTE_LADDER = "The matchmaking keeps your win rate close to 50 percent. After a few losses you get ladder anxiety, and you don't want to end the night on a lost star. So you're still logged in at 2 AM, trying to win your rank back.";

export class BattleScene extends Phaser.Scene {
  private keys!: {
    up: Phaser.Input.Keyboard.Key; down: Phaser.Input.Keyboard.Key; left: Phaser.Input.Keyboard.Key; right: Phaser.Input.Keyboard.Key;
    w: Phaser.Input.Keyboard.Key; a: Phaser.Input.Keyboard.Key; s: Phaser.Input.Keyboard.Key; d: Phaser.Input.Keyboard.Key;
    space: Phaser.Input.Keyboard.Key; j: Phaser.Input.Keyboard.Key; esc: Phaser.Input.Keyboard.Key; p: Phaser.Input.Keyboard.Key;
  };

  private units: Ent[] = [];
  private shots: Shot[] = [];
  private player!: Ent;
  private enemy!: Ent;
  private blueTower!: Ent;
  private redTower!: Ent;

  private fx!: Phaser.GameObjects.Graphics;
  private bars!: Phaser.GameObjects.Graphics;
  private youTag!: Phaser.GameObjects.Text;
  private enemyTag!: Phaser.GameObjects.Text;
  private respawnText!: Phaser.GameObjects.Text;
  private aggroMark!: Phaser.GameObjects.Text;

  // HUD
  private hud!: Phaser.GameObjects.Graphics;
  private hudTexts: Record<string, Phaser.GameObjects.Text> = {};
  private coachText!: Phaser.GameObjects.Text;
  private coachFlash!: Phaser.GameObjects.Image;

  // State (reset in create)
  private elapsed = 0;
  private over = false;
  private quitting = false;
  private nextWaveAt = 0;
  private gold = 0;
  private goldEarned = 0;
  private level = 1;
  private lastHits = 0;
  private kills = 0;
  private deaths = 0;
  private attacks = 0;
  private respawnAt = 0;
  private deathAt = 0;
  private enemyRespawnAt = 0;
  private enemyState: 'push' | 'retreat' = 'push';
  private enemyHurtAt = -99999;
  private specialCd = 0;
  private specialWind = 0;
  private facing = -Math.PI / 2;
  private skinOffered = false;
  private skinChoice: 'bought' | 'owned' | 'skipped' | 'none' = 'none';
  private trailT = 0;
  private tipsShown = new Set<string>();
  private coachHold = 0;
  private lines!: Phaser.GameObjects.Graphics;
  private starsBefore = 0;

  constructor() { super('Battle'); }

  create(): void {
    // Reset everything: Phaser reuses this instance between matches
    this.units = [];
    this.shots = [];
    this.hudTexts = {};
    this.elapsed = 0;
    this.over = false;
    this.quitting = false;
    this.nextWaveAt = 1500;
    this.gold = 0;
    this.goldEarned = 0;
    this.level = 1;
    this.lastHits = 0;
    this.kills = 0;
    this.deaths = 0;
    this.attacks = 0;
    this.respawnAt = 0;
    this.deathAt = 0;
    this.enemyRespawnAt = 0;
    this.enemyState = 'push';
    this.enemyHurtAt = -99999;
    this.specialCd = 0;
    this.specialWind = 0;
    this.facing = -Math.PI / 2;
    this.skinOffered = ladder.skinOwned;
    this.skinChoice = ladder.skinOwned ? 'owned' : 'none';
    this.trailT = 0;
    this.tipsShown = new Set();
    this.coachHold = 0;
    this.starsBefore = ladder.total;
    this.time.timeScale = 1;

    fitToScreen(this);
    ensureTextures(this);
    ensureBattleTextures(this);
    audio.setMode('battle');
    setLocation('CABINET 01 · BATTLE ARENA');
    setHint('<kbd>WASD</kbd> Move <kbd>Space</kbd> Attack <kbd>J</kbd> Slam <kbd>Esc</kbd> Pause');
    cinematicCamera(this, { bloom: 0.9 });
    this.cameras.main.fadeIn(400, 0, 0, 0);

    drawArena(this, (keep) => this.buildPanels(keep));
    this.fx = this.add.graphics().setDepth(7);
    this.bars = this.add.graphics().setDepth(900);
    this.lines = this.add.graphics().setDepth(890);

    this.blueTower = this.makeTower('blue', LANE_CX, 430);
    this.redTower = this.makeTower('red', LANE_CX, 92);
    this.player = this.makeHero('blue', LANE_CX, 470, ladder.skinOwned ? 'bt_skin' : 'player');
    this.enemy = this.makeHero('red', LANE_CX, 40, 'bt_enemy');
    this.enemy.alive = false;
    this.enemy.sprite!.setVisible(false);
    this.enemy.shadow!.setVisible(false);
    this.enemyRespawnAt = 4000;

    this.youTag = this.add.text(0, 0, 'YOU', { fontFamily: FONT.mono, fontSize: '12px', color: BLUE_HEX }).setOrigin(0.5).setDepth(901);
    this.youTag.setShadow(0, 1, '#000', 3, true, true);
    this.enemyTag = this.add.text(0, 0, 'ENEMY', { fontFamily: FONT.mono, fontSize: '12px', color: RED_HEX }).setOrigin(0.5).setDepth(901).setVisible(false);
    this.enemyTag.setShadow(0, 1, '#000', 3, true, true);
    this.respawnText = neonText(this, LANE_CX, 330, '', { size: 22, color: HEX.cyan }).setDepth(950).setVisible(false);
    this.aggroMark = neonText(this, 0, 0, '!', { size: 22, color: RED_HEX }).setDepth(951).setVisible(false);

    this.buildInput();
    this.buildHud();
    this.coach('start', 'Your minions march up the lane. Hit enemy minions as they die: only the killing blow earns gold.');

    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => { setHint(''); });
  }

  /* ------------------------------------------------------------------ */
  /* Construction                                                        */
  /* ------------------------------------------------------------------ */

  private baseEnt(kind: Kind, team: Team, x: number, y: number): Ent {
    return {
      kind, team, x, y, hp: 1, maxHp: 1, radius: 8, alive: true,
      atk: 0, range: 0, recovery: 1000, atkT: 0, speed: 0,
      kbx: 0, kby: 0, flash: 0, flashing: false, bob: Math.random() * 6, lunge: 0, lungeA: 0, moving: false, laneX: x,
    };
  }

  private makeHero(team: Team, x: number, y: number, tex: string): Ent {
    const e = this.baseEnt('hero', team, x, y);
    e.radius = 10;
    if (team === 'blue') {
      Object.assign(e, { hp: 300, maxHp: 300, atk: 24, range: 46, recovery: ladder.skinOwned ? SKIN_REC : BASE_REC, speed: 150 });
    } else {
      Object.assign(e, { hp: 300, maxHp: 300, atk: 20, range: 44, recovery: 640, speed: 120 });
    }
    const sp = spawnSim(this, x, y, tex);
    (sp.body as Phaser.Physics.Arcade.Body).moves = false;
    sp.setOrigin(0.5, 0.9);
    e.sprite = sp;
    e.shadow = this.add.image(x, y, 'bt_glow').setTint(team === 'blue' ? BLUE : RED).setScale(0.55, 0.2)
      .setBlendMode(Phaser.BlendModes.ADD).setAlpha(0.9).setDepth(8);
    this.units.push(e);
    return e;
  }

  private makeMinion(team: Team, kind: 'melee' | 'caster', x: number, y: number): Ent {
    const e = this.baseEnt(kind, team, x, y);
    if (kind === 'melee') Object.assign(e, { hp: 70, maxHp: 70, atk: 9, range: 14, recovery: 1000, speed: 42, radius: 8 });
    else Object.assign(e, { hp: 45, maxHp: 45, atk: 11, range: 80, recovery: 1400, speed: 42, radius: 7 });
    e.atkT = 300 + Math.random() * 400;
    const key = `bt_${kind}_${team}`;
    e.sprite = this.add.image(x, y, key).setScale(1 / TEX_SCALE).setOrigin(0.5, 0.85);
    e.shadow = this.add.image(x, y, 'bt_glow').setTint(team === 'blue' ? BLUE : RED).setScale(0.3, 0.1)
      .setBlendMode(Phaser.BlendModes.ADD).setAlpha(0.7).setDepth(8);
    e.sprite.setAlpha(0);
    this.tweens.add({ targets: e.sprite, alpha: 1, duration: 300 });
    this.units.push(e);
    return e;
  }

  private makeTower(team: Team, x: number, y: number): Ent {
    const e = this.baseEnt('turret', team, x, y);
    Object.assign(e, { hp: TOWER_HP, maxHp: TOWER_HP, atk: 32, range: TOWER_RANGE, recovery: 1100, radius: 24 });
    e.target = null; e.aggro = null; e.aggroUntil = 0;
    const col = team === 'blue' ? BLUE : RED;
    const g = this.add.graphics().setDepth(100 + y);
    // plinth
    g.fillStyle(0x000000, 0.45).fillEllipse(x + 4, y + 16, 76, 24);
    g.fillStyle(0x24243a, 1).fillEllipse(x, y + 12, 68, 22);
    g.lineStyle(2, col, 0.8).strokeEllipse(x, y + 12, 68, 22);
    // body
    g.fillStyle(col, 0.18).fillRect(x - 24, y - 44, 48, 60);
    g.fillStyle(0x3c3c5c, 1).fillRect(x - 18, y - 40, 36, 52);
    g.fillStyle(0x56567e, 1).fillRect(x - 18, y - 40, 10, 52);
    g.fillStyle(0x24243a, 1).fillRect(x + 8, y - 40, 10, 52);
    g.lineStyle(2, col, 0.9).strokeRect(x - 18, y - 40, 36, 52);
    g.fillStyle(col, 0.85).fillRect(x - 18, y - 6, 36, 3).fillRect(x - 18, y - 26, 36, 2);
    // crown
    g.fillStyle(0x5a5a86, 1).fillRect(x - 24, y - 50, 48, 10);
    g.fillStyle(0x3c3c5c, 1).fillTriangle(x - 24, y - 50, x - 16, y - 62, x - 8, y - 50);
    g.fillTriangle(x + 8, y - 50, x + 16, y - 62, x + 24, y - 50);
    g.lineStyle(1.5, col, 0.9).strokeRect(x - 24, y - 50, 48, 10);
    const coreGlow = this.add.image(x, y - 62, 'bt_glow').setTint(col).setScale(1.1).setBlendMode(Phaser.BlendModes.ADD).setDepth(101 + y);
    const core = this.add.image(x, y - 62, 'bt_glow').setTint(0xffffff).setScale(0.28).setBlendMode(Phaser.BlendModes.ADD).setDepth(102 + y);
    const gem = this.add.graphics().setDepth(101 + y);
    gem.fillStyle(col, 1).fillTriangle(x, y - 78, x + 10, y - 62, x - 10, y - 62).fillTriangle(x, y - 48, x + 10, y - 62, x - 10, y - 62);
    gem.fillStyle(0xffffff, 0.5).fillTriangle(x, y - 78, x, y - 62, x - 10, y - 62);
    this.tweens.add({ targets: coreGlow, scale: 1.35, alpha: 0.75, duration: 900, yoyo: true, repeat: -1, ease: 'Sine.inOut' });
    this.tweens.add({ targets: gem, y: -3, duration: 1200, yoyo: true, repeat: -1, ease: 'Sine.inOut' });
    e.core = core; e.coreGlow = coreGlow; e.parts = [g, gem, coreGlow, core];
    return e;
  }

  private buildInput(): void {
    const kb = this.input.keyboard!;
    const K = Phaser.Input.Keyboard.KeyCodes;
    this.keys = {
      up: kb.addKey(K.UP), down: kb.addKey(K.DOWN), left: kb.addKey(K.LEFT), right: kb.addKey(K.RIGHT),
      w: kb.addKey(K.W), a: kb.addKey(K.A), s: kb.addKey(K.S), d: kb.addKey(K.D),
      space: kb.addKey(K.SPACE), j: kb.addKey(K.J), esc: kb.addKey(K.ESC), p: kb.addKey(K.P),
    };
    kb.addCapture([K.UP, K.DOWN, K.LEFT, K.RIGHT, K.SPACE]);
    kb.resetKeys();
  }

  /* ------------------------------------------------------------------ */
  /* HUD                                                                 */
  /* ------------------------------------------------------------------ */

  private buildHud(): void {
    const D = 2000;
    const t = (key: string, x: number, y: number, text: string, opts: Parameters<typeof label>[4] = {}) => {
      const o = label(this, x, y, text, opts).setDepth(D + 1);
      this.hudTexts[key] = o;
      return o;
    };
    this.hud = this.add.graphics().setDepth(D + 1);

    // Rank
    t('rankK', 32, 28, 'RANKED · SOLO LANE', { font: FONT.mono, size: 12, color: HEX.muted });
    t('tier', 32, 46, '', { font: FONT.display, size: 22, color: HEX.gold });
    t('clock', 32, 120, '', { font: FONT.mono, size: 13, color: HEX.muted });

    // Hero
    t('heroK', 32, 172, 'YOUR HERO', { font: FONT.mono, size: 12, color: BLUE_HEX });
    t('lv', 290, 168, '', { font: FONT.display, size: 18, color: HEX.cyan }).setOrigin(1, 0);
    t('hp', 161, 204, '', { font: FONT.mono, size: 14, color: HEX.white }).setOrigin(0.5);
    t('goldK', 32, 228, 'GOLD', { font: FONT.mono, size: 12, color: HEX.muted });
    t('gold', 32, 244, '', { font: FONT.display, size: 24, color: HEX.gold });
    t('skinK', 170, 228, 'SKIN', { font: FONT.mono, size: 12, color: HEX.muted });
    t('skin', 170, 248, '', { font: FONT.ui, size: 15, color: HEX.white, bold: true });

    // Special
    t('spK', 32, 334, 'SPECIAL', { font: FONT.mono, size: 12, color: HEX.muted });
    neonText(this, 90, 422, 'J', { size: 30, color: HEX.gold }).setDepth(D + 2);
    t('spName', 158, 372, 'SLAM', { font: FONT.display, size: 20, color: HEX.gold });
    t('spDesc', 158, 402, 'Hits everything\naround you and\nknocks it back.', { font: FONT.ui, size: 13, color: HEX.muted });
    t('spState', 158, 462, '', { font: FONT.mono, size: 15, color: HEX.green });

    // Match
    t('timeK', 630, 28, 'MATCH TIME', { font: FONT.mono, size: 12, color: HEX.muted });
    t('time', 630, 44, '', { font: FONT.display, size: 30, color: HEX.white });
    t('lhK', 630, 92, 'LAST HITS', { font: FONT.mono, size: 12, color: HEX.muted });
    t('lh', 630, 108, '', { font: FONT.display, size: 20, color: HEX.gold });
    t('kdK', 770, 92, 'KILLS / DEATHS', { font: FONT.mono, size: 12, color: HEX.muted });
    t('kd', 770, 108, '', { font: FONT.display, size: 20, color: HEX.white });

    // Towers
    t('rtK', 630, 174, 'RED TOWER', { font: FONT.mono, size: 12, color: RED_HEX });
    t('rt', 888, 172, '', { font: FONT.mono, size: 14, color: HEX.white }).setOrigin(1, 0);
    t('btK', 630, 240, 'YOUR TOWER', { font: FONT.mono, size: 12, color: BLUE_HEX });
    t('bt', 888, 238, '', { font: FONT.mono, size: 14, color: HEX.white }).setOrigin(1, 0);

    // Coach
    t('coachK', 630, 334, 'COACH', { font: FONT.mono, size: 12, color: HEX.teal });
    this.coachText = t('coach', 630, 356, '', { font: FONT.ui, size: 15, color: HEX.white, wrap: 258 });
    this.coachFlash = this.add.image(759, 413, 'bt_glow').setTint(C.teal).setScale(2.6, 1.6).setAlpha(0)
      .setBlendMode(Phaser.BlendModes.ADD).setDepth(D + 1);
  }

  /** HUD panel frames are static, so they are baked into the arena texture. */
  private buildPanels(keep: <T extends Phaser.GameObjects.GameObject>(o: T) => T): void {
    const D = 2000;
    keep(glassPanel(this, 16, 16, 290, 132, C.gold, { alpha: 0.86 }).setDepth(D));
    keep(glassPanel(this, 16, 160, 290, 150, BLUE, { alpha: 0.86 }).setDepth(D));
    keep(glassPanel(this, 16, 322, 290, 182, C.gold, { alpha: 0.86 }).setDepth(D));
    keep(glassPanel(this, 614, 16, 290, 132, C.gold, { alpha: 0.86 }).setDepth(D));
    keep(glassPanel(this, 614, 160, 290, 150, RED, { alpha: 0.86 }).setDepth(D));
    keep(glassPanel(this, 614, 322, 290, 182, C.teal, { alpha: 0.86 }).setDepth(D));
  }

  private setT(key: string, v: string, color?: string): void {
    const o = this.hudTexts[key];
    if (!o) return;
    if (o.text !== v) o.setText(v);
    // setColor redraws and re-uploads the text texture, so only call it on change
    if (color && o.style.color !== color) o.setColor(color);
  }

  /** Show a coach tip once. Urgent tips hold the box for a few seconds so routine tips can't bury them. */
  private coach(id: string, text: string, urgent = false): void {
    if (this.tipsShown.has(id)) return;
    if (!urgent && this.elapsed < this.coachHold) return;
    this.tipsShown.add(id);
    if (urgent) this.coachHold = this.elapsed + 5000;
    this.coachText.setText(text).setAlpha(0);
    this.tweens.add({ targets: this.coachText, alpha: 1, duration: 250 });
    this.coachFlash.setAlpha(0.7);
    this.tweens.add({ targets: this.coachFlash, alpha: 0, duration: 900 });
  }

  private drawStars(g: Phaser.GameObjects.Graphics, x: number, y: number, filled: number, r = 11, gap = 30): void {
    for (let i = 0; i < STARS_PER_TIER; i++) {
      const on = i < filled;
      const pts = starPoints(x + i * gap, y, r, r * 0.45);
      g.fillStyle(on ? C.gold : 0x2a2840, 1).fillPoints(pts, true);
      g.lineStyle(1.5, on ? 0xfff1c9 : 0x4a4766, on ? 0.9 : 0.8).strokePoints(pts, true);
    }
  }

  private updateHud(): void {
    const g = this.hud;
    g.clear();
    // During the end screen, keep showing the pre-match rank so the star animation is the reveal
    const tier = tierOf(this.over ? this.starsBefore : ladder.total);
    const played = this.over ? ladder.matches - 1 : ladder.matches;
    this.setT('tier', tier.name.toUpperCase());
    this.drawStars(g, 44, 96, tier.stars);
    this.setT('clock', `${clockText(played)} · MATCH ${played + 1}`);

    const p = this.player;
    this.setT('lv', `LV ${this.level}`);
    const hpPct = p.alive ? Math.max(0, p.hp / p.maxHp) : 0;
    g.fillStyle(0x0a0a14, 1).fillRoundedRect(32, 194, 258, 20, 5);
    g.fillStyle(hpPct > 0.35 ? BLUE : C.red, 1).fillRoundedRect(32, 194, Math.max(6, 258 * hpPct), 20, 5);
    g.fillStyle(0xffffff, 0.18).fillRect(36, 196, Math.max(0, 258 * hpPct - 8), 5);
    for (let i = 100; i < p.maxHp; i += 100) g.fillStyle(0x000000, 0.4).fillRect(32 + (258 * i) / p.maxHp, 194, 2, 20);
    this.setT('hp', p.alive ? `${Math.ceil(p.hp)} / ${p.maxHp}` : 'RESPAWNING');
    this.setT('gold', `${this.gold}`);
    this.setT('skin', ladder.skinOwned ? 'Neon Haunter' : 'Default', ladder.skinOwned ? HEX.pink : HEX.white);

    // Special radial
    const cx = 90, cy = 422, R = 44;
    const ready = this.specialCd <= 0;
    g.fillStyle(0x0a0a14, 1).fillCircle(cx, cy, R);
    if (ready) {
      g.lineStyle(4, C.gold, 1).strokeCircle(cx, cy, R);
      g.lineStyle(10, C.gold, 0.18 + 0.12 * Math.sin(this.elapsed / 160)).strokeCircle(cx, cy, R + 4);
    } else {
      const pct = 1 - this.specialCd / SPECIAL_CD;
      g.fillStyle(C.gold, 0.25).slice(cx, cy, R, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * pct, false).fillPath();
      g.lineStyle(3, 0x4a4766, 1).strokeCircle(cx, cy, R);
      g.lineStyle(4, C.gold, 1).beginPath().arc(cx, cy, R, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * pct, false).strokePath();
    }
    this.setT('spState', ready ? 'READY' : `${(this.specialCd / 1000).toFixed(1)}s`, ready ? HEX.green : HEX.muted);

    const s = Math.floor(this.elapsed / 1000);
    this.setT('time', `${Math.floor(s / 60)}:${(s % 60).toString().padStart(2, '0')}`);
    this.setT('lh', `${this.lastHits}`);
    this.setT('kd', `${this.kills} / ${this.deaths}`);

    for (const [tw, y, key, col] of [[this.redTower, 194, 'rt', RED], [this.blueTower, 260, 'bt', BLUE]] as const) {
      const pct = Math.max(0, tw.hp / tw.maxHp);
      g.fillStyle(0x0a0a14, 1).fillRoundedRect(630, y, 258, 22, 5);
      g.fillStyle(col, 1).fillRoundedRect(630, y, Math.max(6, 258 * pct), 22, 5);
      g.fillStyle(0xffffff, 0.2).fillRect(634, y + 2, Math.max(0, 258 * pct - 8), 6);
      this.setT(key, `${Math.max(0, Math.ceil(tw.hp))}`);
    }
  }

  /* ------------------------------------------------------------------ */
  /* Main loop                                                           */
  /* ------------------------------------------------------------------ */

  update(_time: number, deltaMs: number): void {
    const dt = Math.min(deltaMs, 50) / 1000;
    if (!this.over) {
      if (Phaser.Input.Keyboard.JustDown(this.keys.esc) || Phaser.Input.Keyboard.JustDown(this.keys.p)) {
        this.showPause();
        return;
      }
      this.elapsed += dt * 1000;
      this.updateWaves();
      this.updatePlayer(dt);
      this.updateEnemyHero(dt);
      for (const u of this.units) if (u.alive && u.kind !== 'hero') this.updateMinion(u, dt);
      this.updateTower(this.blueTower, dt);
      this.updateTower(this.redTower, dt);
      this.separate();
      this.updateShots(dt);
      this.checkTips();
      this.maybeOfferSkin();
    }
    this.integrate(dt);
    this.drawDynamic();
    this.updateHud();
  }

  private updateWaves(): void {
    if (this.elapsed < this.nextWaveAt) return;
    this.nextWaveAt += WAVE_EVERY;
    for (const dx of [-28, 0, 28]) {
      this.makeMinion('blue', 'melee', LANE_CX + dx, 486);
      this.makeMinion('red', 'melee', LANE_CX + dx, 34);
    }
    this.makeMinion('blue', 'caster', LANE_CX, 508);
    this.makeMinion('red', 'caster', LANE_CX, 12);
  }

  /* ------------------------------------------------------------------ */
  /* Player                                                              */
  /* ------------------------------------------------------------------ */

  private updatePlayer(dt: number): void {
    const p = this.player;
    const k = this.keys;
    if (this.specialCd > 0) {
      this.specialCd -= dt * 1000;
      if (this.specialCd <= 0 && p.alive) floatText(this, p.x, p.y - 70, 'SLAM READY', HEX.gold, 13);
    }
    if (!p.alive) {
      const left = Math.ceil((this.respawnAt - this.elapsed) / 1000);
      this.respawnText.setVisible(true).setText(`RESPAWN IN ${Math.max(0, left)}`);
      if (this.elapsed >= this.respawnAt) this.respawnPlayer();
      return;
    }
    this.respawnText.setVisible(false);
    p.atkT -= dt * 1000;

    let vx = 0, vy = 0;
    if (k.left.isDown || k.a.isDown) vx -= 1;
    if (k.right.isDown || k.d.isDown) vx += 1;
    if (k.up.isDown || k.w.isDown) vy -= 1;
    if (k.down.isDown || k.s.isDown) vy += 1;
    p.moving = vx !== 0 || vy !== 0;
    if (p.moving) {
      const len = Math.hypot(vx, vy);
      const sp = p.speed * (this.specialWind > 0 ? 0.4 : 1);
      p.x += (vx / len) * sp * dt;
      p.y += (vy / len) * sp * dt;
      this.facing = Math.atan2(vy, vx);
      if (vx !== 0) (p.sprite as Phaser.GameObjects.Sprite).setFlipX(vx < 0);
    }

    // Fountain heals
    if (p.y > 470) p.hp = Math.min(p.maxHp, p.hp + 70 * dt);

    // Skin trail
    if (ladder.skinOwned && p.moving) {
      this.trailT -= dt;
      if (this.trailT <= 0) {
        this.trailT = 0.05;
        const d = this.add.image(p.x + (Math.random() - 0.5) * 10, p.y - 10, 'bt_glow').setTint(Math.random() < 0.5 ? C.pink : C.gold)
          .setScale(0.12).setBlendMode(Phaser.BlendModes.ADD).setDepth(99 + p.y);
        this.tweens.add({ targets: d, alpha: 0, scale: 0.02, y: d.y - 8, duration: 420, onComplete: () => d.destroy() });
      }
    }

    if (Phaser.Input.Keyboard.JustDown(k.j)) this.startSpecial();
    if (this.specialWind > 0) {
      this.specialWind -= dt;
      if (this.specialWind <= 0) this.slam();
    }
    const pressed = Phaser.Input.Keyboard.JustDown(k.space);
    if (pressed || k.space.isDown) this.playerAttack(pressed);
  }

  private respawnPlayer(): void {
    const p = this.player;
    p.alive = true;
    p.hp = p.maxHp;
    p.x = LANE_CX; p.y = 488; p.kbx = 0; p.kby = 0;
    p.sprite!.setVisible(true).setAlpha(0);
    p.shadow!.setVisible(true);
    this.tweens.add({ targets: p.sprite, alpha: 1, duration: 300 });
    burst(this, p.x, p.y - 20, BLUE, 18, 160);
    audio.sfx('collect');
    this.respawnText.setVisible(false);
  }

  private playerAttack(forced: boolean): void {
    const p = this.player;
    if (p.atkT > 0 || this.specialWind > 0) return;
    const target = this.nearestEnemy(p, p.range);
    if (!target && !forced) return;
    p.atkT = p.recovery;
    const ang = target ? Math.atan2(target.y - p.y, target.x - p.x) : this.facing;
    this.facing = ang;
    this.swing(p, ang, ladder.skinOwned ? C.pink : C.cyan);
    if (!target) { audio.sfx('whoosh'); return; }
    this.attacks++;
    const crit = Math.random() < 0.15;
    const dmg = Math.round(p.atk * (crit ? 1.7 : 1));
    this.hurt(target, dmg, p, { crit, kb: target.kind === 'hero' ? 70 : 120 });
    audio.sfx(crit ? 'crit' : 'hit');
    burst(this, target.x, target.y - 14, crit ? C.pink : C.white, crit ? 14 : 7, crit ? 150 : 90);
    if (crit) impact(this, 0.004, 90);
    if (target === this.enemy) this.checkAggro(p, this.redTower);
  }

  private startSpecial(): void {
    if (this.specialCd > 0 || this.specialWind > 0 || !this.player.alive) return;
    this.specialWind = 0.28;
    this.specialCd = SPECIAL_CD;
    audio.sfx('whoosh');
  }

  private slam(): void {
    const p = this.player;
    if (!p.alive) return;
    audio.sfx('special');
    impact(this, 0.012, 220);
    burst(this, p.x, p.y - 8, C.gold, 26, 260);
    const ring = this.add.image(p.x, p.y - 6, 'bt_glow').setTint(C.gold).setScale(0.4).setBlendMode(Phaser.BlendModes.ADD).setDepth(950);
    this.tweens.add({ targets: ring, scale: (SPECIAL_R * 2.6) / 128, alpha: 0, duration: 380, ease: 'Cubic.out', onComplete: () => ring.destroy() });
    const wave = this.add.graphics().setDepth(950).setPosition(p.x, p.y - 6).setBlendMode(Phaser.BlendModes.ADD);
    wave.lineStyle(5, C.gold, 1).strokeCircle(0, 0, SPECIAL_R);
    wave.setScale(0.3);
    this.tweens.add({ targets: wave, scale: 1.05, alpha: 0, duration: 340, ease: 'Cubic.out', onComplete: () => wave.destroy() });
    let hitHero = false;
    for (const e of this.units) {
      if (!e.alive || e.team === p.team) continue;
      if (Phaser.Math.Distance.Between(p.x, p.y, e.x, e.y) - e.radius > SPECIAL_R) continue;
      this.hurt(e, 55 + (this.level - 1) * 4, p, { kb: 260, big: true });
      if (e === this.enemy) hitHero = true;
    }
    if (hitHero) this.checkAggro(p, this.redTower);
  }

  private swing(u: Ent, ang: number, col: number): void {
    const g = this.add.graphics().setDepth(101 + u.y).setPosition(u.x, u.y - 14).setBlendMode(Phaser.BlendModes.ADD);
    const r = u.range + 10;
    g.fillStyle(col, 0.35).slice(0, 0, r, ang - 0.95, ang + 0.95, false).fillPath();
    g.lineStyle(3, 0xffffff, 0.9).beginPath().arc(0, 0, r, ang - 0.95, ang + 0.95, false).strokePath();
    g.lineStyle(6, col, 0.5).beginPath().arc(0, 0, r - 4, ang - 0.8, ang + 0.8, false).strokePath();
    g.setScale(0.7);
    this.tweens.add({ targets: g, scale: 1, alpha: 0, duration: 160, ease: 'Cubic.out', onComplete: () => g.destroy() });
    u.lunge = 1; u.lungeA = ang;
  }

  /* ------------------------------------------------------------------ */
  /* Enemy hero AI                                                       */
  /* ------------------------------------------------------------------ */

  private updateEnemyHero(dt: number): void {
    const e = this.enemy;
    if (!e.alive) {
      if (this.elapsed >= this.enemyRespawnAt) {
        e.alive = true; e.hp = e.maxHp; e.x = LANE_CX; e.y = 26; e.kbx = 0; e.kby = 0;
        e.sprite!.setVisible(true).setAlpha(0);
        e.shadow!.setVisible(true);
        this.enemyTag.setVisible(true);
        this.tweens.add({ targets: e.sprite, alpha: 1, duration: 300 });
        burst(this, e.x, e.y - 20, RED, 16, 150);
        this.enemyState = 'push';
        if (this.kills === 0 && this.deaths === 0) this.coach('enemy', 'The enemy hero has joined. Trade hits, but watch your HP. Your base heals you.');
      }
      return;
    }
    e.atkT -= dt * 1000;
    const pct = e.hp / e.maxHp;

    if (this.enemyState === 'push' && pct < 0.3) {
      this.enemyState = 'retreat';
      floatText(this, e.x, e.y - 70, 'RETREATING', RED_HEX, 13);
      this.coach('retreat', 'Their hero is low and running home. Push the tower while it is gone.');
    }
    if (this.enemyState === 'retreat') {
      this.moveToward(e, LANE_CX, 24, dt);
      if (e.y < 50) e.hp = Math.min(e.maxHp, e.hp + 70 * dt);
      if (e.hp / e.maxHp > 0.9) this.enemyState = 'push';
      return;
    }

    // Pick a target
    const p = this.player;
    const towerSafe = (x: number, y: number) =>
      Phaser.Math.Distance.Between(x, y, this.blueTower.x, this.blueTower.y) > TOWER_RANGE + 14 ||
      this.units.some(u => u.alive && u.team === 'red' && u.kind !== 'hero' &&
        Phaser.Math.Distance.Between(u.x, u.y, this.blueTower.x, this.blueTower.y) < TOWER_RANGE);
    let target: Ent | null = null;
    const pd = p.alive ? Phaser.Math.Distance.Between(e.x, e.y, p.x, p.y) : Infinity;
    const angry = this.elapsed - this.enemyHurtAt < 2500;
    if (p.alive && pd < 120 && pct > 0.45 && towerSafe(p.x, p.y) && (angry || p.hp / p.maxHp < pct + 0.15)) target = p;
    if (!target) {
      let best = 130;
      for (const u of this.units) {
        if (!u.alive || u.team !== 'blue' || u.kind === 'hero') continue;
        const d = Phaser.Math.Distance.Between(e.x, e.y, u.x, u.y);
        if (d < best && towerSafe(u.x, u.y)) { best = d; target = u; }
      }
    }
    if (!target && this.blueTower.alive && towerSafe(this.blueTower.x, this.blueTower.y + 200) &&
        this.units.some(u => u.alive && u.team === 'red' && u.kind !== 'hero' &&
          Phaser.Math.Distance.Between(u.x, u.y, this.blueTower.x, this.blueTower.y) < TOWER_RANGE)) {
      target = this.blueTower;
    }

    if (target) {
      const d = Phaser.Math.Distance.Between(e.x, e.y, target.x, target.y) - target.radius;
      if (d <= e.range) {
        e.moving = false;
        if (e.atkT <= 0) {
          e.atkT = e.recovery;
          const ang = Math.atan2(target.y - e.y, target.x - e.x);
          this.swing(e, ang, RED);
          this.hurt(target, e.atk, e, { kb: target.kind === 'hero' ? 60 : 100 });
          if (target === p) {
            audio.sfx('hit');
            this.checkAggro(e, this.blueTower);
          }
        }
      } else {
        this.moveToward(e, target.x, target.y, dt);
      }
    } else {
      // Walk just behind the front red minion, or hold near home
      let front = -1;
      for (const u of this.units) if (u.alive && u.team === 'red' && u.kind !== 'hero') front = Math.max(front, u.y);
      const ty = front > 0 ? front - 24 : 170;
      if (towerSafe(LANE_CX, ty) && Math.abs(e.y - ty) > 6) this.moveToward(e, LANE_CX + 30, ty, dt);
      else e.moving = false;
    }
  }

  private moveToward(u: Ent, tx: number, ty: number, dt: number): void {
    const d = Phaser.Math.Distance.Between(u.x, u.y, tx, ty);
    if (d < 2) { u.moving = false; return; }
    const step = Math.min(d, u.speed * dt);
    u.x += ((tx - u.x) / d) * step;
    u.y += ((ty - u.y) / d) * step;
    u.moving = true;
    if (u.kind === 'hero' && Math.abs(tx - u.x) > 4) (u.sprite as Phaser.GameObjects.Sprite).setFlipX(tx < u.x);
  }

  /* ------------------------------------------------------------------ */
  /* Minions and towers                                                  */
  /* ------------------------------------------------------------------ */

  private updateMinion(m: Ent, dt: number): void {
    m.atkT -= dt * 1000;
    const foeTower = m.team === 'blue' ? this.redTower : this.blueTower;
    let target: Ent | null = null;
    let best = 80;
    for (const u of this.units) {
      if (!u.alive || u.team === m.team || u.kind === 'hero') continue;
      const d = Phaser.Math.Distance.Between(m.x, m.y, u.x, u.y);
      if (d < best) { best = d; target = u; }
    }
    if (!target && foeTower.alive && Phaser.Math.Distance.Between(m.x, m.y, foeTower.x, foeTower.y) < 90) target = foeTower;
    if (!target) {
      best = 55;
      for (const u of this.units) {
        if (!u.alive || u.team === m.team || u.kind !== 'hero') continue;
        const d = Phaser.Math.Distance.Between(m.x, m.y, u.x, u.y);
        if (d < best) { best = d; target = u; }
      }
    }
    if (target) {
      const d = Phaser.Math.Distance.Between(m.x, m.y, target.x, target.y) - target.radius - m.radius;
      if (d <= m.range) {
        m.moving = false;
        if (m.atkT <= 0) {
          m.atkT = m.recovery;
          if (m.kind === 'melee') {
            m.lunge = 1; m.lungeA = Math.atan2(target.y - m.y, target.x - m.x);
            const dmg = target.kind === 'turret' ? m.atk * MINION_SIEGE : m.atk;
            this.hurt(target, dmg, m, { kb: target.kind === 'melee' || target.kind === 'caster' ? 25 : 0 });
          } else {
            this.fire(m, target, target.kind === 'turret' ? m.atk * MINION_SIEGE : m.atk, false);
          }
        }
      } else {
        this.moveToward(m, target.x, target.y, dt);
      }
    } else {
      const dir = m.team === 'blue' ? -1 : 1;
      m.y += dir * m.speed * dt;
      m.x += (m.laneX - m.x) * Math.min(1, dt * 1.5);
      m.moving = true;
    }
  }

  private updateTower(t: Ent, dt: number): void {
    if (!t.alive) return;
    t.atkT -= dt * 1000;
    const inRange = (u: Ent | null | undefined) =>
      !!u && u.alive && Phaser.Math.Distance.Between(t.x, t.y, u.x, u.y) <= t.range + u.radius;
    if (t.aggro && (!inRange(t.aggro) || this.elapsed > (t.aggroUntil ?? 0))) t.aggro = null;
    if (t.aggro) t.target = t.aggro;
    else if (!inRange(t.target)) {
      t.target = null;
      let best = Infinity;
      for (const u of this.units) {
        if (u.team === t.team || u.kind === 'hero' || !inRange(u)) continue;
        const d = Phaser.Math.Distance.Between(t.x, t.y, u.x, u.y);
        if (d < best) { best = d; t.target = u; }
      }
      if (!t.target) {
        for (const u of this.units) {
          if (u.team === t.team || u.kind !== 'hero' || !inRange(u)) continue;
          const d = Phaser.Math.Distance.Between(t.x, t.y, u.x, u.y);
          if (d < best) { best = d; t.target = u; }
        }
      }
    }
    if (t.target && t.atkT <= 0) {
      t.atkT = t.recovery;
      this.fire(t, t.target, t.target.kind === 'hero' ? 60 : 32, true);
    }
  }

  /** The aggro rule from the exhibit: hit their hero under their tower and the tower targets you. */
  private checkAggro(attacker: Ent, tower: Ent): void {
    if (!tower.alive || !attacker.alive) return;
    if (Phaser.Math.Distance.Between(attacker.x, attacker.y, tower.x, tower.y) > tower.range + attacker.radius) return;
    const fresh = tower.aggro !== attacker;
    tower.aggro = attacker;
    tower.target = attacker;
    tower.aggroUntil = this.elapsed + 3500;
    if (fresh) {
      tower.atkT = Math.min(tower.atkT, 250);
      if (attacker === this.player) {
        audio.sfx('alert');
        floatText(this, attacker.x, attacker.y - 76, 'TOWER AGGRO', RED_HEX, 15);
        this.coach('aggro', 'Tower aggro! You hit their hero inside its tower range, so the tower now shoots you. Step back out of the red ring.', true);
      }
    }
  }

  private fire(src: Ent, target: Ent, dmg: number, big: boolean): void {
    const col = src.team === 'blue' ? (big ? 0x7fd0ff : BLUE) : (big ? 0xff7a8e : RED);
    const sx = src.x, sy = big ? src.y - 62 : src.y - 18;
    const img = this.add.image(sx, sy, 'bt_glow').setTint(col).setScale(big ? 0.34 : 0.16)
      .setBlendMode(Phaser.BlendModes.ADD).setDepth(800);
    this.shots.push({ img, target, src, dmg, speed: big ? 380 : 260, big });
    if (big) {
      src.core?.setScale(0.45);
      this.tweens.add({ targets: src.core, scale: 0.28, duration: 200 });
    }
  }

  private updateShots(dt: number): void {
    for (const s of this.shots) {
      if (!s.target.alive) { s.img.destroy(); s.img = null as any; continue; }
      const tx = s.target.x, ty = s.target.y - (s.target.kind === 'turret' ? 30 : 14);
      const d = Phaser.Math.Distance.Between(s.img.x, s.img.y, tx, ty);
      const step = s.speed * dt;
      if (d <= step + 4) {
        this.hurt(s.target, s.dmg, s.src, { kb: s.big ? 80 : 0, big: s.big });
        burst(this, tx, ty, s.img.tintTopLeft, s.big ? 12 : 5, s.big ? 120 : 60);
        if (s.big && s.target === this.player) { impact(this, 0.006, 120); audio.sfx('hit'); }
        s.img.destroy(); s.img = null as any;
        continue;
      }
      s.img.x += ((tx - s.img.x) / d) * step;
      s.img.y += ((ty - s.img.y) / d) * step;
      if (s.big && Math.random() < 0.6) {
        const tr = this.add.image(s.img.x, s.img.y, 'bt_glow').setTint(s.img.tintTopLeft).setScale(0.14)
          .setBlendMode(Phaser.BlendModes.ADD).setDepth(799);
        this.tweens.add({ targets: tr, alpha: 0, scale: 0.02, duration: 220, onComplete: () => tr.destroy() });
      }
    }
    this.shots = this.shots.filter(s => s.img);
  }

  /* ------------------------------------------------------------------ */
  /* Damage                                                              */
  /* ------------------------------------------------------------------ */

  private nearestEnemy(u: Ent, range: number): Ent | null {
    let best: Ent | null = null;
    let bd = Infinity;
    const foes = [...this.units, this.redTower, this.blueTower];
    for (const e of foes) {
      if (!e.alive || e.team === u.team) continue;
      const d = Phaser.Math.Distance.Between(u.x, u.y, e.x, e.y) - e.radius;
      if (d <= range && d < bd) { bd = d; best = e; }
    }
    return best;
  }

  private hurt(t: Ent, amount: number, src: Ent | null, opts: { crit?: boolean; kb?: number; big?: boolean } = {}): void {
    if (!t.alive || this.over) return;
    t.hp -= amount;
    t.flash = 0.08;
    if (src && opts.kb && t.kind !== 'turret') {
      const a = Math.atan2(t.y - src.y, t.x - src.x);
      const k = t.kind === 'hero' ? opts.kb * 0.6 : opts.kb;
      t.kbx += Math.cos(a) * k; t.kby += Math.sin(a) * k;
    }
    if (t === this.enemy && src === this.player) this.enemyHurtAt = this.elapsed;
    if (src === this.player) {
      floatText(this, t.x + (Math.random() - 0.5) * 12, t.y - (t.kind === 'turret' ? 70 : 36),
        opts.crit ? `${amount}!` : `${amount}`, opts.crit ? HEX.pink : HEX.gold, opts.crit ? 20 : 14);
    } else if (t === this.player) {
      floatText(this, t.x + (Math.random() - 0.5) * 12, t.y - 40, `-${amount}`, RED_HEX, opts.big ? 18 : 13);
    } else if (t.kind === 'hero' && (src?.kind === 'turret' || src?.kind === 'hero')) {
      floatText(this, t.x, t.y - 40, `-${amount}`, HEX.white, 13);
    }
    if (t.hp <= 0) this.kill(t, src);
  }

  private kill(t: Ent, src: Ent | null): void {
    t.alive = false;
    t.hp = 0;
    const col = t.team === 'blue' ? BLUE : RED;
    if (t.kind === 'turret') {
      this.endMatch(t.team === 'red');
      return;
    }
    burst(this, t.x, t.y - 12, col, t.kind === 'hero' ? 24 : 12, t.kind === 'hero' ? 200 : 110);
    if (t.kind === 'hero') {
      impact(this, 0.01, 200);
      t.sprite!.setVisible(false);
      t.shadow!.setVisible(false);
      if (t === this.player) {
        this.deaths++;
        this.deathAt = this.elapsed;
        this.respawnAt = this.elapsed + PLAYER_RESPAWN;
        this.specialWind = 0;
        audio.sfx('lose');
        this.coach('death', 'You fell. Heroes respawn at base after a short timer. Stay near your minions so towers shoot them first.', true);
      } else {
        this.enemyTag.setVisible(false);
        this.enemyRespawnAt = this.elapsed + ENEMY_RESPAWN;
        audio.sfx('win');
        const g = src === this.player ? 150 : 60;
        if (src === this.player) this.kills++;
        this.addGold(g, t.x, t.y);
        floatText(this, t.x, t.y - 64, src === this.player ? 'HERO DOWN' : 'ASSIST', HEX.cyan, 18);
      }
      return;
    }
    // Minion
    const sp = t.sprite!;
    this.tweens.add({ targets: sp, alpha: 0, scaleY: 0.1 / TEX_SCALE, duration: 220, onComplete: () => sp.destroy() });
    t.shadow!.destroy();
    if (src === this.player) {
      this.lastHits++;
      audio.sfx('coin');
      this.addGold(t.kind === 'melee' ? 24 : 30, t.x, t.y);
      if (this.lastHits === 1) this.coach('lh', 'Last hit! Gold only goes to whoever lands the killing blow. Watch for low HP bars.');
    }
    this.units = this.units.filter(u => u !== t);
  }

  private addGold(n: number, x: number, y: number): void {
    this.gold += n;
    this.goldEarned += n;
    floatText(this, x, y - 50, `+${n} GOLD`, HEX.gold, 14);
    while (this.level < LEVEL_AT.length && this.goldEarned >= LEVEL_AT[this.level]) {
      this.level++;
      const p = this.player;
      p.atk += 3; p.maxHp += 25; p.hp = Math.min(p.maxHp, p.hp + 25);
      if (p.alive) {
        floatText(this, p.x, p.y - 84, `LEVEL ${this.level}`, HEX.cyan, 16);
        burst(this, p.x, p.y - 20, C.cyan, 14, 120);
      }
    }
  }

  /* ------------------------------------------------------------------ */
  /* Physics-lite, sprite sync, and drawing                              */
  /* ------------------------------------------------------------------ */

  private separate(): void {
    const us = this.units.filter(u => u.alive);
    for (let i = 0; i < us.length; i++) {
      const a = us[i];
      for (let j = i + 1; j < us.length; j++) {
        const b = us[j];
        const dx = b.x - a.x, dy = b.y - a.y;
        const d = Math.hypot(dx, dy) || 0.01;
        const min = a.radius + b.radius;
        if (d >= min) continue;
        const push = (min - d) / 2;
        const wa = a.kind === 'hero' ? 0.25 : 1, wb = b.kind === 'hero' ? 0.25 : 1;
        a.x -= (dx / d) * push * wa; a.y -= (dy / d) * push * wa;
        b.x += (dx / d) * push * wb; b.y += (dy / d) * push * wb;
      }
      for (const t of [this.blueTower, this.redTower]) {
        if (!t.alive) continue;
        const dx = a.x - t.x, dy = a.y - t.y;
        const d = Math.hypot(dx, dy) || 0.01;
        const min = t.radius + a.radius;
        if (d < min) { a.x = t.x + (dx / d) * min; a.y = t.y + (dy / d) * min; }
      }
    }
  }

  private integrate(dt: number): void {
    const damp = Math.exp(-10 * dt);
    for (const u of this.units) {
      if (!this.over) {
        u.x += u.kbx * dt; u.y += u.kby * dt;
        u.kbx *= damp; u.kby *= damp;
        u.x = Phaser.Math.Clamp(u.x, LANE_L + 8, LANE_R - 8);
        u.y = Phaser.Math.Clamp(u.y, u.kind === 'hero' ? 18 : 0, u.kind === 'hero' ? 506 : 520);
      }
      u.lunge = Math.max(0, u.lunge - dt * 7);
      u.flash -= dt;
      const sp = u.sprite;
      if (!sp || !sp.active) continue;
      if (u.flash > 0 && !u.flashing) { sp.setTintFill(0xffffff); u.flashing = true; }
      else if (u.flash <= 0 && u.flashing) { sp.clearTint(); u.flashing = false; }
      if (u.moving && !this.over) u.bob += dt * 14;
      const bob = u.moving ? -Math.abs(Math.sin(u.bob)) * (u.kind === 'hero' ? 2.5 : 2) : 0;
      const lo = Math.sin(u.lunge * Math.PI) * (u.kind === 'hero' ? 7 : 5);
      sp.setPosition(u.x + Math.cos(u.lungeA) * lo, u.y + bob + Math.sin(u.lungeA) * lo);
      if (u.kind === 'caster') sp.y += Math.sin(this.elapsed / 220 + u.laneX) * 1.5 - 2;
      sp.setDepth(100 + u.y);
      u.shadow?.setPosition(u.x, u.y);
    }
    for (const t of [this.blueTower, this.redTower]) {
      t.flash -= dt;
      if (t.core && t.alive) {
        if (t.flash > 0 && !t.flashing) { t.core.setTint(0xff3355); t.flashing = true; }
        else if (t.flash <= 0 && t.flashing) { t.core.setTint(0xffffff); t.flashing = false; }
      }
    }
  }

  private drawDynamic(): void {
    const fx = this.fx, bars = this.bars, lines = this.lines;
    fx.clear(); bars.clear(); lines.clear();
    const p = this.player;
    const pulse = 0.5 + 0.5 * Math.sin(this.elapsed / 120);

    // Tower range rings and targeting lines
    for (const t of [this.redTower, this.blueTower]) {
      if (!t.alive) continue;
      const col = t.team === 'red' ? RED : BLUE;
      const playerIn = t.team === 'red' && p.alive &&
        Phaser.Math.Distance.Between(p.x, p.y, t.x, t.y) <= t.range + p.radius;
      const onPlayer = t.target === p && p.alive;
      if (onPlayer) {
        fx.fillStyle(RED, 0.08 + 0.06 * pulse).fillCircle(t.x, t.y, t.range);
        fx.lineStyle(3, RED, 0.6 + 0.4 * pulse).strokeCircle(t.x, t.y, t.range);
      } else if (playerIn) {
        fx.fillStyle(col, 0.06).fillCircle(t.x, t.y, t.range);
        fx.lineStyle(2, col, 0.6).strokeCircle(t.x, t.y, t.range);
      } else {
        fx.lineStyle(1.5, col, 0.22).strokeCircle(t.x, t.y, t.range);
      }
      const tg = t.target;
      if (tg && tg.alive) {
        const heavy = tg.kind === 'hero';
        const lc = heavy ? (t.team === 'red' ? 0xff2244 : 0x66c8ff) : col;
        lines.lineStyle(heavy ? 8 : 3, lc, heavy ? 0.25 : 0.1).lineBetween(t.x, t.y - 62, tg.x, tg.y - 14);
        lines.lineStyle(heavy ? 3 : 1.2, lc, heavy ? 0.6 + 0.4 * pulse : 0.4).lineBetween(t.x, t.y - 62, tg.x, tg.y - 14);
        if (heavy) lines.lineStyle(2, lc, 0.8).strokeCircle(tg.x, tg.y - 14, 16 + 4 * pulse);
      }
      // Tower HP bar
      const pct = Math.max(0, t.hp / t.maxHp);
      bars.fillStyle(0x05050a, 0.9).fillRect(t.x - 34, t.y - 98, 68, 8);
      bars.fillStyle(col, 1).fillRect(t.x - 33, t.y - 97, 66 * pct, 6);
    }
    const aggroOnPlayer = this.redTower.alive && this.redTower.target === p && p.alive;
    this.aggroMark.setVisible(aggroOnPlayer);
    if (aggroOnPlayer) this.aggroMark.setPosition(p.x, p.y - 90).setScale(1 + 0.2 * pulse);

    // Special telegraph
    if (this.specialWind > 0 && p.alive) {
      const k = 1 - this.specialWind / 0.28;
      fx.fillStyle(C.gold, 0.1 + 0.15 * k).fillCircle(p.x, p.y - 6, SPECIAL_R);
      fx.lineStyle(2, C.gold, 0.9).strokeCircle(p.x, p.y - 6, SPECIAL_R);
      fx.lineStyle(4, 0xffffff, 0.8).strokeCircle(p.x, p.y - 6, SPECIAL_R * k);
    }

    // Unit HP bars
    for (const u of this.units) {
      if (!u.alive) continue;
      const pct = Math.max(0, u.hp / u.maxHp);
      const col = u.team === 'blue' ? BLUE : RED;
      if (u.kind === 'hero') {
        const w = 46, y = u.y - 66;
        bars.fillStyle(0x05050a, 0.9).fillRect(u.x - w / 2 - 1, y - 1, w + 2, 8);
        bars.fillStyle(u === p ? 0x5cff8a : col, 1).fillRect(u.x - w / 2, y, w * pct, 6);
        for (let i = 100; i < u.maxHp; i += 100) bars.fillStyle(0x000000, 0.6).fillRect(u.x - w / 2 + (w * i) / u.maxHp, y, 1, 6);
      } else {
        const w = 20, y = u.y - 26;
        // Gold glow on minions you can last-hit right now
        const lhable = u.team === 'red' && u.hp <= p.atk && p.alive;
        bars.fillStyle(0x05050a, 0.85).fillRect(u.x - w / 2 - 1, y - 1, w + 2, 5);
        bars.fillStyle(lhable ? C.gold : col, 1).fillRect(u.x - w / 2, y, w * pct, 3);
      }
    }
    if (p.alive) this.youTag.setVisible(true).setPosition(p.x, p.y - 76); else this.youTag.setVisible(false);
    if (this.enemy.alive) this.enemyTag.setPosition(this.enemy.x, this.enemy.y - 76);
  }

  private checkTips(): void {
    const p = this.player;
    if (this.elapsed > 14000) this.coach('keys', 'Hold SPACE to keep swinging. Press J for a slam that hits everything around you.');
    if (p.alive && this.redTower.alive) {
      const inRed = Phaser.Math.Distance.Between(p.x, p.y, this.redTower.x, this.redTower.y) <= TOWER_RANGE + 20;
      if (inRed) {
        if (this.enemy.alive && Phaser.Math.Distance.Between(p.x, p.y, this.enemy.x, this.enemy.y) < 140) {
          this.coach('rule', 'Tower rule: if you hit their hero while inside the red ring, the tower switches to you.');
        }
        const shield = this.units.some(u => u.alive && u.team === 'blue' && u.kind !== 'hero' &&
          Phaser.Math.Distance.Between(u.x, u.y, this.redTower.x, this.redTower.y) < TOWER_RANGE);
        if (!shield) this.coach('tank', 'The red tower shoots heroes when none of your minions are in its ring. Let your minions walk in first.');
      }
    }
    if (this.redTower.hp < TOWER_HP * 0.5) this.coach('redhalf', 'Their tower is at half HP. Keep pushing with your minions in front.');
    if (this.blueTower.hp < TOWER_HP * 0.5) this.coach('bluehalf', 'Your tower is at half HP. Go back and clear the red minions.');
  }

  /* ------------------------------------------------------------------ */
  /* The skin shop                                                       */
  /* ------------------------------------------------------------------ */

  private maybeOfferSkin(): void {
    if (this.skinOffered || isModalOpen()) return;
    const deadLong = !this.player.alive && this.elapsed - this.deathAt > 900;
    if (this.elapsed < 32000 && !deadLong) return;
    this.skinOffered = true;
    this.input.keyboard?.resetKeys();
    this.scene.pause();
    let before = '', after = '';
    try {
      before = this.textures.getBase64('player');
      after = this.textures.getBase64('bt_skin');
    } catch { /* preview is optional */ }
    const img = (src: string, name: string, col: string) => src
      ? `<div style="text-align:center"><div style="width:84px;height:134px;margin:0 auto;background:url(${src}) center/contain no-repeat;filter:drop-shadow(0 0 10px ${col})"></div><div style="font:500 12px var(--font-mono);color:${col};margin-top:4px">${name}</div></div>`
      : '';
    showModal({
      kicker: 'HERO SHOP · TODAY ONLY',
      title: 'Neon Haunter skin',
      accent: 'pink',
      dismissable: false,
      body: `
        <div style="display:flex;gap:22px;align-items:center">
          ${img(before, 'DEFAULT', '#5cb8ff')}
          ${before ? '<div style="font-size:26px;color:var(--muted)">→</div>' : ''}
          ${img(after, 'NEON HAUNTER', '#ff4fd8')}
          <div style="flex:1">
            <p>A brand new look for your hero: gold armour, pink hair, and a neon trail.</p>
            <p><strong>Cosmetic. RMB ${SKIN_PRICE}.</strong></p>
            <p style="font-size:14px;color:var(--muted)">Match gold can't buy skins. Real money only.</p>
          </div>
        </div>`,
      actions: [
        { label: 'No thanks', kind: 'ghost', key: 'N', onClick: () => { this.skinChoice = 'skipped'; closeModal(); } },
        { label: `Buy for RMB ${SKIN_PRICE}`, key: 'B', onClick: () => { this.buySkin(); closeModal(); } },
      ],
      onClose: () => { this.input.keyboard?.resetKeys(); this.scene.resume(); },
    });
  }

  private buySkin(): void {
    wallet.spend(SKIN_PRICE, 'moba', 'Hero skin');
    ladder.skinOwned = true;
    this.skinChoice = 'bought';
    const p = this.player;
    p.recovery = SKIN_REC;
    (p.sprite as Phaser.GameObjects.Sprite).setTexture('bt_skin');
    audio.sfx('coin');
    this.time.delayedCall(50, () => {
      burst(this, p.x, p.y - 20, C.pink, 22, 180);
      burst(this, p.x, p.y - 20, C.gold, 16, 120);
      floatText(this, p.x, p.y - 84, 'NEW SKIN', HEX.pink, 16);
    });
    this.coach('skin', 'Skin equipped. Looks good! Purely cosmetic, says the shop.');
  }

  /* ------------------------------------------------------------------ */
  /* Pause, end of match, debrief                                        */
  /* ------------------------------------------------------------------ */

  private showPause(): void {
    if (isModalOpen()) return;
    this.input.keyboard?.resetKeys();
    this.scene.pause();
    showModal({
      kicker: 'PAUSED',
      title: 'Battle Arena',
      body: '<p>The match is paused. The other team is waiting.</p>',
      actions: [
        { label: 'Quit to museum', kind: 'ghost', key: 'Q', onClick: () => { this.quitting = true; closeModal(); this.scene.start('Arcade', { from: 'battle' }); } },
        { label: 'Resume', key: 'Enter', onClick: () => closeModal() },
      ],
      onClose: () => {
        if (this.quitting) return;
        this.input.keyboard?.resetKeys();
        this.scene.resume();
      },
    });
  }

  private endMatch(won: boolean): void {
    if (this.over) return;
    this.over = true;
    this.input.keyboard?.resetKeys();
    for (const s of this.shots) s.img.destroy();
    this.shots = [];
    this.aggroMark.setVisible(false);
    this.respawnText.setVisible(false);
    const tower = won ? this.redTower : this.blueTower;
    tower.alive = false;
    const col = won ? RED : BLUE;
    impact(this, 0.022, 600);
    audio.sfx('crit');
    this.time.delayedCall(120, () => audio.sfx('special'));
    for (let i = 0; i < 5; i++) {
      this.time.delayedCall(i * 110, () => burst(this, tower.x + (Math.random() - 0.5) * 40, tower.y - 30 - Math.random() * 40, i % 2 ? col : C.gold, 22, 260));
    }
    this.cameras.main.flash(260, 255, 255, 255, false);
    for (const part of tower.parts ?? []) {
      this.tweens.add({ targets: part, alpha: 0, y: '+=18', duration: 900, ease: 'Cubic.in' });
    }

    const banner = neonText(this, LANE_CX, 220, won ? 'VICTORY' : 'DEFEAT', {
      size: 62, color: won ? HEX.teal : RED_HEX, blur: 22,
    }).setDepth(3000).setScale(2.4).setAlpha(0);
    this.tweens.add({ targets: banner, scale: 1, alpha: 1, duration: 420, ease: 'Back.out' });

    this.starsBefore = ladder.total;
    ladder.total = Math.max(0, ladder.total + (won ? 1 : -1));
    ladder.matches++;
    if (won) ladder.wins++;

    this.time.delayedCall(1100, () => this.starAnimation(won));
    this.time.delayedCall(3400, () => this.debrief(won));
  }

  private starAnimation(won: boolean): void {
    const D = 3001;
    const cx = LANE_CX, cy = 320;
    const before = tierOf(this.starsBefore);
    const after = tierOf(ladder.total);
    glassPanel(this, cx - 170, cy - 50, 340, 112, C.gold, { alpha: 0.95 }).setDepth(D);
    const title = label(this, cx, cy - 34, `${before.name.toUpperCase()} RANK`, { font: FONT.display, size: 16, color: HEX.gold, align: 'center' })
      .setOrigin(0.5).setDepth(D + 1);
    const g = this.add.graphics().setDepth(D + 1);
    const sx = cx - 72, sy = cy + 6, gap = 36;
    const sameTier = before.name === after.name;
    const shown = sameTier ? Math.min(before.stars, after.stars) : (won ? before.stars : 0);
    this.drawStars(g, sx, sy, shown, 14, gap);
    const note = label(this, cx, cy + 40, '', { font: FONT.mono, size: 14, color: HEX.white, align: 'center' }).setOrigin(0.5).setDepth(D + 1);

    if (won) {
      const idx = sameTier ? before.stars : before.stars;
      const st = this.add.graphics().setDepth(D + 2).setPosition(sx + Math.min(idx, STARS_PER_TIER - 1) * gap, sy);
      st.fillStyle(C.gold, 1).fillPoints(starPoints(0, 0, 14, 6.3), true);
      st.lineStyle(2, 0xffffff, 1).strokePoints(starPoints(0, 0, 14, 6.3), true);
      st.setScale(3).setAlpha(0);
      this.tweens.add({
        targets: st, scale: 1, alpha: 1, duration: 450, delay: 300, ease: 'Back.out',
        onComplete: () => {
          audio.sfx('coin');
          burst(this, st.x, st.y, C.gold, 18, 150);
          if (!sameTier) { title.setText(`PROMOTED TO ${after.name.toUpperCase()}`); }
        },
      });
      note.setText('+1 STAR');
      note.setColor(HEX.green);
    } else {
      if (before.stars > 0) {
        const idx = before.stars - 1;
        const st = this.add.graphics().setDepth(D + 2).setPosition(sx + idx * gap, sy);
        st.fillStyle(C.gold, 1).fillPoints(starPoints(0, 0, 14, 6.3), true);
        this.tweens.add({
          targets: st, y: sy + 30, alpha: 0, angle: 40, duration: 600, delay: 400, ease: 'Cubic.in',
          onStart: () => { audio.sfx('error'); burst(this, st.x, st.y, C.red, 14, 120); },
        });
      } else if (ladder.total !== this.starsBefore) {
        this.time.delayedCall(400, () => {
          audio.sfx('error');
          title.setText(`DEMOTED TO ${after.name.toUpperCase()}`);
          g.clear();
          this.drawStars(g, sx, sy, after.stars, 14, gap);
        });
      }
      note.setText(`-1 STAR · ${clockText(ladder.matches)}`);
      note.setColor(RED_HEX);
    }
  }

  private debrief(won: boolean): void {
    const secs = Math.floor(this.elapsed / 1000);
    const time = `${Math.floor(secs / 60)}:${(secs % 60).toString().padStart(2, '0')}`;
    const after = tierOf(ladder.total);
    const skinVal = { bought: `RMB ${SKIN_PRICE}`, owned: 'OWNED', skipped: 'SKIPPED', none: 'NOT OFFERED' }[this.skinChoice];
    const hasSkin = ladder.skinOwned;
    const extra = Math.max(1, Math.round(this.attacks * (1 - SKIN_REC / BASE_REC)));

    let felt = won
      ? `You took the tower in ${time} with ${this.lastHits} last hits. `
      : `Your tower fell after ${time}. `;
    felt += hasSkin
      ? `The RMB ${SKIN_PRICE} skin was sold as a new look. It also made every attack ${SKIN_PCT} percent faster, which gave you about ${extra} extra hits this match. `
      : `You skipped the RMB ${SKIN_PRICE} skin. The shop called it cosmetic, but it makes every attack ${SKIN_PCT} percent faster. `;
    felt += won
      ? `You won a star: ${after.name}, ${after.stars} of ${STARS_PER_TIER}.`
      : `You lost a star. It is now ${clockText(ladder.matches)}. One more match would win it back.`;

    const finding = won
      ? {
        quote: QUOTE_SKIN,
        who: 'ALEX · HONOR OF KINGS PLAYER',
        point: `<b>A paid edge, labelled cosmetic.</b> The advantage is small, hidden, and sold for real money. At Jiliehuo, Chen Wei's arcade, the rule is the opposite: you can't buy an advantage there.`,
      }
      : {
        quote: QUOTE_LADDER,
        who: 'ALEX · HONOR OF KINGS PLAYER',
        point: `<b>Losing is built to feel fixable.</b> Matchmaking keeps wins and losses near even, so a lost star always seems one match away from coming back. That pull keeps players logged in.`,
      };

    showDebrief({
      outcome: won ? 'win' : 'lose',
      kicker: `BATTLE ARENA · ${won ? 'VICTORY' : 'DEFEAT'}`,
      title: won ? 'Tower down!' : 'Your tower fell',
      stats: [
        { label: 'MATCH TIME', value: time },
        { label: 'LAST HITS', value: `${this.lastHits}` },
        { label: 'GOLD EARNED', value: `${this.goldEarned}` },
        { label: 'DEATHS', value: `${this.deaths}` },
        { label: 'SKIN', value: skinVal },
        { label: `RANK · ${after.name.toUpperCase()} ${after.stars}/${STARS_PER_TIER}`, value: won ? '+1 STAR' : '-1 STAR' },
      ],
      felt,
      finding,
      onReplay: () => this.scene.restart(),
      onExit: () => this.scene.start('Arcade', { from: 'battle' }),
      replayLabel: 'One more match?',
    });
  }
}
