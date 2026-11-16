/**
 * Screen-space overlay for Lost Realm. Runs as its own scene on top of the
 * world so the world camera can zoom and follow without moving the HUD.
 */
import Phaser from 'phaser';
import { fitToScreen, WORLD_W, WORLD_H } from '../../view';
import { FONT, HEX, C, glassPanel, label, neonText, toHex } from '../../theme';
import { drawShard } from './art';
import { GUARDIAN_NAME, fmtTime, type LorePage } from './lore';

export interface HudState {
  hp: number; maxHp: number;
  stamina: number; maxStamina: number;
  shards: (number | null)[];   // colour of each found shard, null if missing
  pages: number; totalPages: number;
  elapsed: number;
  boss: { hp: number; max: number; phase: number } | null;
}

export class RealmHud extends Phaser.Scene {
  private getState!: () => HudState;
  private bars!: Phaser.GameObjects.Graphics;
  private shardIcons: Phaser.GameObjects.Graphics[] = [];
  private shardColors: (number | null | undefined)[] = [];
  private ready = false;
  private timerText!: Phaser.GameObjects.Text;
  private pagesText!: Phaser.GameObjects.Text;
  private objText!: Phaser.GameObjects.Text;
  private objBg!: Phaser.GameObjects.Graphics;
  private bossGroup!: Phaser.GameObjects.Container;
  private bossBar!: Phaser.GameObjects.Graphics;
  private bossShown = false;
  private bossShownHp = 1;
  private caption: Phaser.GameObjects.Container | null = null;
  private captionReadyAt = 0;
  private lowFlash!: Phaser.GameObjects.Rectangle;

  constructor() { super('RealmHud'); }

  init(data: { getState: () => HudState }): void {
    this.getState = data.getState;
    this.shardIcons = [];
    this.shardColors = [];
    this.bossShown = false;
    this.bossShownHp = 1;
    this.caption = null;
    this.ready = false;
  }

  create(): void {
    fitToScreen(this);

    // Damage vignette, sized well past the layout so it covers wide screens
    this.lowFlash = this.add.rectangle(WORLD_W / 2, WORLD_H / 2, WORLD_W * 4, WORLD_H * 4, C.red, 0).setDepth(0);

    // Top-left status panel
    glassPanel(this, 14, 12, 238, 92, C.violet, { alpha: 0.72 });
    neonText(this, 26, 30, 'LOST REALM', { size: 15, color: HEX.violet, blur: 8 }).setOrigin(0, 0.5);
    this.timerText = label(this, 240, 30, '0:00', { font: FONT.mono, size: 13, color: HEX.white }).setOrigin(1, 0.5);
    label(this, 26, 50, 'HP', { font: FONT.mono, size: 12, color: HEX.muted }).setOrigin(0, 0.5);
    label(this, 26, 68, 'STAMINA', { font: FONT.mono, size: 12, color: HEX.muted }).setOrigin(0, 0.5);
    this.bars = this.add.graphics();
    label(this, 26, 89, 'SHARDS', { font: FONT.mono, size: 12, color: HEX.muted }).setOrigin(0, 0.5);
    for (let i = 0; i < 3; i++) {
      const g = this.add.graphics({ x: 104 + i * 22, y: 89 }).setScale(0.42);
      this.shardIcons.push(g);
      this.shardColors.push(undefined);
    }
    this.pagesText = label(this, 240, 89, 'PAGES 0/4', { font: FONT.mono, size: 12, color: HEX.gold }).setOrigin(1, 0.5);

    // Objective pill, top centre
    this.objBg = this.add.graphics();
    this.objText = label(this, WORLD_W / 2, 26, '', { size: 15, color: HEX.white, bold: true }).setOrigin(0.5);
    this.objText.setShadow(0, 1, '#000000', 4, true, true);

    // Boss bar, bottom centre (above the DOM hint pill)
    const bx = WORLD_W / 2, by = 440;
    const bossBg = this.add.graphics();
    bossBg.fillStyle(0x000000, 0.55).fillRoundedRect(-262, -8, 524, 26, 6);
    bossBg.lineStyle(1.5, C.violet, 0.9).strokeRoundedRect(-262, -8, 524, 26, 6);
    this.bossBar = this.add.graphics();
    const bossName = neonText(this, 0, -24, GUARDIAN_NAME, { size: 17, color: '#e9dcff', glow: HEX.violet, blur: 14 });
    this.bossGroup = this.add.container(bx, by, [bossBg, this.bossBar, bossName]).setAlpha(0).setVisible(false);

    this.ready = true;
    this.paint();
  }

  setObjective(text: string): void {
    if (!this.ready || this.objText.text === text) return;
    this.objText.setText(text);
    this.objBg.clear();
    if (!text) return;
    const w = this.objText.width + 34;
    this.objBg.fillStyle(0x0d0b1a, 0.78).fillRoundedRect(WORLD_W / 2 - w / 2, 12, w, 28, 14);
    this.objBg.lineStyle(1, C.violet, 0.7).strokeRoundedRect(WORLD_W / 2 - w / 2, 12, w, 28, 14);
    this.objText.setAlpha(0);
    this.tweens.add({ targets: this.objText, alpha: 1, duration: 300 });
  }

  /** Big centred message that fades on its own. */
  banner(text: string, color = HEX.violet, sub = ''): void {
    if (!this.ready) return;
    const t = neonText(this, WORLD_W / 2, 150, text, { size: 26, color: '#ffffff', glow: color, blur: 18 }).setDepth(50).setAlpha(0).setScale(0.8);
    const s = sub ? label(this, WORLD_W / 2, 182, sub, { size: 16, color: '#e9e4ff', align: 'center' }).setOrigin(0.5).setDepth(50).setAlpha(0) : null;
    if (s) s.setShadow(0, 1, '#000000', 4, true, true);
    this.tweens.add({ targets: t, alpha: 1, scale: 1, duration: 350, ease: 'Back.out' });
    if (s) this.tweens.add({ targets: s, alpha: 1, duration: 400, delay: 150 });
    this.tweens.add({
      targets: s ? [t, s] : [t], alpha: 0, duration: 600, delay: 2200,
      onComplete: () => { t.destroy(); s?.destroy(); },
    });
  }

  hurtFlash(): void {
    if (!this.ready) return;
    this.lowFlash.setAlpha(0.22);
    this.tweens.add({ targets: this.lowFlash, alpha: 0, duration: 380 });
  }

  showBoss(on: boolean): void {
    if (!this.ready || on === this.bossShown) return;
    this.bossShown = on;
    this.bossGroup.setVisible(true);
    this.tweens.add({ targets: this.bossGroup, alpha: on ? 1 : 0, duration: 500, onComplete: () => { if (!on) this.bossGroup.setVisible(false); } });
  }

  /* -------------------------- story caption -------------------------- */

  captionOpen(): boolean { return this.caption !== null; }
  captionReady(): boolean { return this.caption !== null && this.time.now >= this.captionReadyAt; }

  showCaption(page: LorePage, color: number, tag: string): void {
    if (!this.ready) return;
    this.closeCaption();
    const cx = WORLD_W / 2, cy = WORLD_H / 2 + 6;
    const w = 600, h = 214;
    const dim = this.add.rectangle(0, 0, WORLD_W * 4, WORLD_H * 4, 0x05030c, 0.55);
    const panel = this.add.graphics();
    panel.fillStyle(0x000000, 0.4).fillRoundedRect(-w / 2 + 4, -h / 2 + 6, w, h, 14);
    panel.fillStyle(0x120d26, 0.95).fillRoundedRect(-w / 2, -h / 2, w, h, 14);
    panel.lineStyle(2, color, 0.95).strokeRoundedRect(-w / 2, -h / 2, w, h, 14);
    panel.lineStyle(8, color, 0.12).strokeRoundedRect(-w / 2 - 3, -h / 2 - 3, w + 6, h + 6, 16);
    // Shard emblem
    const emblem = this.add.graphics({ x: -w / 2 + 52, y: -10 }).setScale(1.5);
    drawShard(emblem, color);
    const halo = this.add.image(-w / 2 + 52, -10, 'realm_soft').setTint(color).setScale(0.6).setAlpha(0.6).setBlendMode(Phaser.BlendModes.ADD);
    this.tweens.add({ targets: halo, scale: 0.75, alpha: 0.35, duration: 1200, yoyo: true, repeat: -1 });

    const left = -w / 2 + 100;
    const kicker = label(this, left, -h / 2 + 24, `LORE PAGE ${page.numeral} OF IV  ·  ${tag}`, { font: FONT.mono, size: 12, color: toHex(color) });
    const title = this.add.text(left, -h / 2 + 46, page.title.toUpperCase(), {
      fontFamily: FONT.display, fontSize: '24px', color: '#ffffff',
    }).setShadow(0, 0, toHex(color), 12, true, true);
    const body = label(this, left, -h / 2 + 88, page.line, { size: 17, color: '#ece8ff', wrap: w - 130 });
    const more = label(this, w / 2 - 22, h / 2 - 22, 'E  Continue', { font: FONT.mono, size: 12, color: HEX.muted }).setOrigin(1, 0.5).setAlpha(0);

    const card = this.add.container(cx, cy, [panel, halo, emblem, kicker, title, body, more]).setDepth(80);
    dim.setPosition(cx, cy).setDepth(79);
    card.setAlpha(0).setScale(0.94);
    dim.setAlpha(0);
    this.tweens.add({ targets: card, alpha: 1, scale: 1, duration: 450, ease: 'Cubic.out' });
    this.tweens.add({ targets: dim, alpha: 1, duration: 450 });
    body.setAlpha(0);
    this.tweens.add({ targets: body, alpha: 1, duration: 900, delay: 300 });
    this.tweens.add({ targets: more, alpha: 1, duration: 400, delay: 1100 });
    this.captionReadyAt = this.time.now + 700;
    this.caption = this.add.container(0, 0, [dim, card]).setDepth(79);
  }

  closeCaption(): void {
    const c = this.caption;
    if (!c) return;
    this.caption = null;
    this.tweens.add({ targets: c, alpha: 0, duration: 250, onComplete: () => c.destroy() });
  }

  /* ------------------------------ frame ------------------------------ */

  update(): void { this.paint(); }

  private paint(): void {
    const s = this.getState?.();
    if (!s || !this.bars) return;
    const g = this.bars;
    g.clear();
    const bx = 92, bw = 148;
    const hpF = Phaser.Math.Clamp(s.hp / s.maxHp, 0, 1);
    const stF = Phaser.Math.Clamp(s.stamina / s.maxStamina, 0, 1);
    g.fillStyle(0x000000, 0.55).fillRoundedRect(bx, 44, bw, 11, 4).fillRoundedRect(bx, 62, bw, 11, 4);
    g.fillStyle(hpF < 0.3 ? C.red : 0xff6f9a, 1).fillRoundedRect(bx, 44, Math.max(4, bw * hpF), 11, 4);
    g.fillStyle(0xffffff, 0.25).fillRect(bx + 3, 45, Math.max(0, bw * hpF - 6), 2);
    g.fillStyle(stF < 0.2 ? C.amber : C.teal, 1).fillRoundedRect(bx, 62, Math.max(4, bw * stF), 11, 4);
    g.fillStyle(0xffffff, 0.25).fillRect(bx + 3, 63, Math.max(0, bw * stF - 6), 2);

    s.shards.forEach((c, i) => {
      if (this.shardColors[i] === c) return;
      this.shardColors[i] = c;
      const ic = this.shardIcons[i];
      ic.clear();
      if (c === null) {
        ic.lineStyle(2, 0x6b6890, 1).strokePoints([
          new Phaser.Math.Vector2(0, -20), new Phaser.Math.Vector2(11, -4), new Phaser.Math.Vector2(6, 20),
          new Phaser.Math.Vector2(-6, 20), new Phaser.Math.Vector2(-11, -4)], true);
      } else {
        drawShard(ic, c);
        ic.setScale(0.8);
        this.tweens.add({ targets: ic, scale: 0.42, duration: 500, ease: 'Back.out' });
      }
    });

    this.timerText.setText(fmtTime(s.elapsed));
    this.pagesText.setText(`PAGES ${s.pages}/${s.totalPages}`);

    if (s.boss) {
      const f = Phaser.Math.Clamp(s.boss.hp / s.boss.max, 0, 1);
      this.bossShownHp += (f - this.bossShownHp) * 0.08;
      const bb = this.bossBar;
      bb.clear();
      bb.fillStyle(0xffffff, 0.35).fillRoundedRect(-258, -4, 516 * this.bossShownHp, 18, 4);
      bb.fillStyle(s.boss.phase === 2 ? 0x8fd8ff : 0xb48bff, 1).fillRoundedRect(-258, -4, Math.max(0, 516 * f), 18, 4);
      bb.fillStyle(0xffffff, 0.3).fillRect(-254, -2, Math.max(0, 516 * f - 8), 3);
      bb.lineStyle(2, 0xffffff, 0.7).lineBetween(0, -6, 0, 16);
    }
  }
}
