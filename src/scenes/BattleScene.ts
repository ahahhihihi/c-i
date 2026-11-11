import Phaser from 'phaser';
import { ensureTextures } from '../assets';
import { audio } from '../audio';
import { fitToScreen } from '../view';
import { TEX_SCALE, spawnSim } from '../sims';
import { showModal, closeModal } from '../ui/modals';

const W = 920, H = 520;

type Unit = { sprite: Phaser.Physics.Arcade.Sprite; hp: number; maxHp: number; team: 'player' | 'enemy'; atkCd: number };

export class BattleScene extends Phaser.Scene {
  private player!: Phaser.Physics.Arcade.Sprite;
  private cursors!: Phaser.Types.Input.Keyboard.CursorKeys;
  private wasd!: { W: Phaser.Input.Keyboard.Key; A: Phaser.Input.Keyboard.Key; S: Phaser.Input.Keyboard.Key; D: Phaser.Input.Keyboard.Key };

  private playerShadow!: Phaser.GameObjects.Ellipse;
  private enemies: Unit[] = [];
  private minions: Unit[] = [];
  private turret!: { sprite: Phaser.GameObjects.Rectangle; hp: number; maxHp: number };

  private specialCd = 0;
  private gold = 0;
  private goldText!: Phaser.GameObjects.Text;
  private cooldownBar!: Phaser.GameObjects.Graphics;
  private turretHpBar!: Phaser.GameObjects.Graphics;

  private over = false;
  private won = false;

  constructor() { super('Battle'); }

  create(): void {
    fitToScreen(this);
    ensureTextures(this);
    audio.sfx('click');
    this.over = false;
    this.won = false;
    this.gold = 0;
    this.specialCd = 0;

    this.buildArena();
    this.buildPlayer();
    this.buildTurret();
    this.buildInput();
    this.buildHud();

    // Spawn minions every 3s
    this.time.addEvent({ delay: 3000, callback: this.spawnMinionWave, callbackScope: this, loop: true });

    // Spawn enemy hero every 12s
    this.time.addEvent({ delay: 12000, callback: this.spawnEnemy, callbackScope: this, loop: true });
  }

  private buildArena(): void {
    // Gradient background
    const bg = this.add.graphics();
    bg.fillGradientStyle(0x0a0e19, 0x0a0e19, 0x0f1525, 0x0f1525, 1);
    bg.fillRect(0, 0, W, H);

    // Wood-plank lane
    this.add.tileSprite(W / 2, H / 2, W - 40, H - 100, 'floor_wood').setTileScale(1 / TEX_SCALE).setAlpha(0.9);

    // Lane markers
    for (let y = 100; y < H - 50; y += 80) {
      this.add.rectangle(W / 2, y, 200, 2, 0x1f2937);
    }

    // Side decorations
    this.add.rectangle(10, H / 2, 8, H - 80, 0x1f2937);
    this.add.rectangle(W - 10, H / 2, 8, H - 80, 0x1f2937);

    // Top spawn area with glow
    const spawnGlow = this.add.graphics();
    spawnGlow.fillStyle(0xef4444, 0.1);
    spawnGlow.fillRoundedRect(W / 2 - 150, 40, 300, 50, 4);

    this.add.rectangle(W / 2, 60, W - 100, 40, 0x1f2937);
    this.add.rectangle(W / 2, 60, W - 100, 40, 0xef4444, 0.1);
    this.add.text(W / 2, 60, 'ENEMY SPAWN', { fontFamily: 'monospace', fontSize: '11px', color: '#ef4444' }).setOrigin(0.5);

    // Bottom player area with glow
    const baseGlow = this.add.graphics();
    baseGlow.fillStyle(0x22c55e, 0.1);
    baseGlow.fillRoundedRect(W / 2 - 150, H - 70, 300, 50, 4);

    this.add.rectangle(W / 2, H - 50, W - 100, 40, 0x1f2937);
    this.add.rectangle(W / 2, H - 50, W - 100, 40, 0x22c55e, 0.1);
    this.add.text(W / 2, H - 50, 'PLAYER BASE', { fontFamily: 'monospace', fontSize: '11px', color: '#22c55e' }).setOrigin(0.5);
  }

  private buildPlayer(): void {
    this.player = spawnSim(this, W / 2, H - 100);
    this.player.setCollideWorldBounds(true);
    this.player.setDepth(10);

    // Shadow
    this.playerShadow = this.add.ellipse(W / 2, H - 72, 26, 10, 0x000000, 0.3).setDepth(9);
  }

  private buildTurret(): void {
    // Turret base
    const base = this.add.graphics();
    base.fillStyle(0x1f2937, 1);
    base.fillRoundedRect(W / 2 - 40, 100, 80, 10, 3);

    // Turret body
    const turretSprite = this.add.rectangle(W / 2, 80, 50, 60, 0x374151);
    turretSprite.setStrokeStyle(3, 0xef4444);

    // Turret top
    const top = this.add.graphics();
    top.fillStyle(0xef4444, 1);
    top.fillCircle(W / 2, 55, 12);
    top.fillStyle(0xff6659, 0.5);
    top.fillCircle(W / 2 - 3, 53, 4);

    // Glow effect
    const glow = this.add.graphics();
    glow.fillStyle(0xef4444, 0.15);
    glow.fillCircle(W / 2, 80, 50);
    this.tweens.add({ targets: glow, alpha: 0.25, duration: 1500, yoyo: true, repeat: -1 });

    this.turret = { sprite: turretSprite, hp: 200, maxHp: 200 };
    this.turretHpBar = this.add.graphics();
    this.updateTurretHp();
  }

  private buildInput(): void {
    this.cursors = this.input.keyboard!.createCursorKeys();
    this.wasd = {
      W: this.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.W),
      A: this.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.A),
      S: this.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.S),
      D: this.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.D),
    };

    // Attack
    this.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.SPACE)
      .on('down', () => this.attack());

    // Special
    this.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.J)
      .on('down', () => this.special());

    this.input.keyboard!.addCapture([Phaser.Input.Keyboard.KeyCodes.UP, Phaser.Input.Keyboard.KeyCodes.DOWN, Phaser.Input.Keyboard.KeyCodes.LEFT, Phaser.Input.Keyboard.KeyCodes.RIGHT]);
  }

  private buildHud(): void {
    this.add.text(20, 20, 'BATTLE ARENA', { fontFamily: 'monospace', fontSize: '14px', color: '#ffd078' });

    this.goldText = this.add.text(20, 40, 'GOLD: 0', { fontFamily: 'monospace', fontSize: '13px', color: '#ffd078' });

    // Cooldown bar
    this.cooldownBar = this.add.graphics();
    this.updateCooldownBar();

    // Controls hint
    this.add.text(W - 20, 20, 'WASD · SPACE attack · J special', {
      fontFamily: 'monospace', fontSize: '11px', color: '#8b8d9a',
    }).setOrigin(1, 0);

    // ESC to pause
    this.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.ESC)
      .on('down', () => this.showPause());
  }

  private spawnMinionWave(): void {
    if (this.over) return;

    // Enemy minions from top
    for (let i = 0; i < 2; i++) {
      const x = W / 2 + (i === 0 ? -40 : 40);
      const sprite = spawnSim(this, x, 80);
      sprite.setTint(0xef4444);
      sprite.setVelocityY(60);
      this.minions.push({ sprite, hp: 30, maxHp: 30, team: 'enemy', atkCd: 0 });
    }
  }

  private spawnEnemy(): void {
    if (this.over || this.enemies.length >= 2) return;

    const sprite = spawnSim(this, W / 2, 80);
    sprite.setTint(0xef4444);
    sprite.setScale(1.3 / TEX_SCALE);
    this.enemies.push({ sprite, hp: 80, maxHp: 80, team: 'enemy', atkCd: 0 });
  }

  private attack(): void {
    if (this.over) return;
    audio.sfx('hit');

    // Find nearest enemy in range
    const range = 80;
    let nearest: Unit | null = null;
    let nearestDist = Infinity;

    for (const e of [...this.enemies, ...this.minions.filter(m => m.team === 'enemy')]) {
      const dist = Phaser.Math.Distance.Between(this.player.x, this.player.y, e.sprite.x, e.sprite.y);
      if (dist < range && dist < nearestDist) {
        nearestDist = dist;
        nearest = e;
      }
    }

    if (nearest) {
      nearest.hp -= 20;
      this.showDamage(nearest.sprite.x, nearest.sprite.y, 20);

      if (nearest.hp <= 0) {
        nearest.sprite.destroy();
        this.gold += 15;
        this.goldText.setText(`GOLD: ${this.gold}`);
        this.enemies = this.enemies.filter(e => e !== nearest);
        this.minions = this.minions.filter(m => m !== nearest);
      }
    }

    // Attack animation
    this.player.setTint(0x22c55e);
    this.time.delayedCall(100, () => this.player.clearTint());
  }

  private special(): void {
    if (this.over || this.specialCd > 0) return;

    this.specialCd = 5000;
    audio.sfx('click');

    // AoE damage
    const range = 150;
    for (const e of [...this.enemies, ...this.minions.filter(m => m.team === 'enemy')]) {
      const dist = Phaser.Math.Distance.Between(this.player.x, this.player.y, e.sprite.x, e.sprite.y);
      if (dist < range) {
        e.hp -= 40;
        this.showDamage(e.sprite.x, e.sprite.y, 40);
        if (e.hp <= 0) {
          e.sprite.destroy();
          this.gold += 15;
          this.enemies = this.enemies.filter(en => en !== e);
          this.minions = this.minions.filter(m => m !== e);
        }
      }
    }

    this.goldText.setText(`GOLD: ${this.gold}`);

    // Visual effect
    const circle = this.add.circle(this.player.x, this.player.y, range, 0xffd078, 0.3);
    this.tweens.add({ targets: circle, alpha: 0, scale: 1.5, duration: 300, onComplete: () => circle.destroy() });
  }

  private showDamage(x: number, y: number, dmg: number): void {
    const text = this.add.text(x, y - 20, `-${dmg}`, {
      fontFamily: 'monospace', fontSize: '14px', color: '#ffd078',
    }).setOrigin(0.5);

    this.tweens.add({
      targets: text, y: y - 50, alpha: 0, duration: 500, onComplete: () => text.destroy(),
    });
  }

  private updateCooldownBar(): void {
    this.cooldownBar.clear();
    const pct = Math.max(0, 1 - this.specialCd / 5000);
    this.cooldownBar.fillStyle(0x374151, 1).fillRect(20, 60, 100, 8);
    this.cooldownBar.fillStyle(pct >= 1 ? 0x22c55e : 0xffd078, 1).fillRect(20, 60, 100 * pct, 8);
  }

  private updateTurretHp(): void {
    this.turretHpBar.clear();
    const pct = this.turret.hp / this.turret.maxHp;
    this.turretHpBar.fillStyle(0x374151, 1).fillRect(this.turret.sprite.x - 40, this.turret.sprite.y + 50, 80, 6);
    this.turretHpBar.fillStyle(0xef4444, 1).fillRect(this.turret.sprite.x - 40, this.turret.sprite.y + 50, 80 * pct, 6);
  }

  private showPause(): void {
    this.scene.pause();
    showModal({
      kicker: 'PAUSED',
      title: 'Battle Arena',
      body: '<p>Press Resume to continue.</p>',
      actions: [
        { label: 'Resume', onClick: () => { closeModal(); this.scene.resume(); } },
        { label: 'Quit', kind: 'ghost', onClick: () => { closeModal(); this.scene.start('Arcade'); } },
      ],
    });
  }

  private gameOver(won: boolean): void {
    this.over = true;
    this.won = won;

    this.time.delayedCall(500, () => {
      showModal({
        kicker: won ? 'VICTORY' : 'DEFEAT',
        title: won ? 'Tower Destroyed!' : 'You Fell',
        body: `<p>Gold earned: ${this.gold}</p>`,
        actions: [{ label: 'Return to Arcade', onClick: () => { closeModal(); this.scene.start('Arcade'); } }],
      });
    });
  }

  update(_time: number, delta: number): void {
    if (this.over || !this.player?.body) return;

    // Cooldown
    if (this.specialCd > 0) {
      this.specialCd -= delta;
      this.updateCooldownBar();
    }

    // Player movement
    let vx = 0, vy = 0;
    if (this.cursors.left.isDown || this.wasd.A.isDown) vx = -1;
    if (this.cursors.right.isDown || this.wasd.D.isDown) vx = 1;
    if (this.cursors.up.isDown || this.wasd.W.isDown) vy = -1;
    if (this.cursors.down.isDown || this.wasd.S.isDown) vy = 1;

    this.player.setVelocity(vx * 200, vy * 200);
    this.playerShadow.setPosition(this.player.x, this.player.y + 28);

    // Enemy AI
    for (const e of this.enemies) {
      const dist = Phaser.Math.Distance.Between(this.player.x, this.player.y, e.sprite.x, e.sprite.y);

      if (dist > 60) {
        this.physics.moveToObject(e.sprite, this.player, 80);
      } else {
        e.sprite.setVelocity(0, 0);
        e.atkCd -= delta;
        if (e.atkCd <= 0) {
          e.atkCd = 1000;
          // Damage player would go here
        }
      }
    }

    // Minions move down
    for (const m of this.minions) {
      if (m.team === 'enemy') {
        m.sprite.setVelocityY(50);

        // Check if reaches turret
        if (m.sprite.y > 70 && m.sprite.y < 120 && Math.abs(m.sprite.x - W / 2) < 40) {
          this.turret.hp -= 5;
          this.updateTurretHp();
          m.sprite.destroy();
          this.minions = this.minions.filter(mi => mi !== m);
        }
      }
    }

    // Check win
    if (this.turret.hp <= 0) {
      this.gameOver(true);
    }
  }
}
