import Phaser from 'phaser';
import { ensureTextures } from '../assets';
import { audio } from '../audio';
import { showModal, closeModal } from '../ui/modals';

const W = 920, H = 520;

type Shard = { sprite: Phaser.GameObjects.Sprite; collected: boolean };
type Enemy = { sprite: Phaser.Physics.Arcade.Sprite; hp: number };

export class RealmScene extends Phaser.Scene {
  private player!: Phaser.Physics.Arcade.Sprite;
  private cursors!: Phaser.Types.Input.Keyboard.CursorKeys;
  private wasd!: { W: Phaser.Input.Keyboard.Key; A: Phaser.Input.Keyboard.Key; S: Phaser.Input.Keyboard.Key; D: Phaser.Input.Keyboard.Key };

  private shards: Shard[] = [];
  private shardsCollected = 0;
  private guardian!: Enemy;
  private guardianActive = false;

  private stamina = 100;
  private staminaBar!: Phaser.GameObjects.Graphics;
  private shardText!: Phaser.GameObjects.Text;

  private over = false;

  constructor() { super('Realm'); }

  create(): void {
    ensureTextures(this);
    audio.sfx('click');
    this.over = false;
    this.shardsCollected = 0;
    this.stamina = 100;
    this.guardianActive = false;

    this.buildWorld();
    this.buildPlayer();
    this.buildShards();
    this.buildGuardian();
    this.buildInput();
    this.buildHud();
  }

  private buildWorld(): void {
    // Gradient background - dark mystical realm
    const bg = this.add.graphics();
    bg.fillGradientStyle(0x0d0815, 0x0d0815, 0x140a20, 0x140a20, 1);
    bg.fillRect(0, 0, W, H);

    // Stone floor tiles with mystical pattern
    for (let x = 0; x < W; x += 60) {
      for (let y = 0; y < H; y += 60) {
        const shade = Math.random() > 0.5 ? 0x1a1525 : 0x14101f;
        this.add.rectangle(x + 30, y + 30, 56, 56, shade).setAlpha(0.8);

        // Occasional rune marks
        if (Math.random() > 0.85) {
          this.add.text(x + 30, y + 30, ['✦', '✧', '◈', '◇'][Math.floor(Math.random() * 4)], {
            fontFamily: 'monospace', fontSize: '12px', color: '#a87ffb',
          }).setOrigin(0.5).setAlpha(0.2);
        }
      }
    }

    // Atmospheric particles - mystical energy
    for (let i = 0; i < 25; i++) {
      const p = this.add.circle(
        Math.random() * W,
        Math.random() * H,
        Math.random() * 3 + 1,
        0xa87ffb,
        Math.random() * 0.3 + 0.1
      );
      this.tweens.add({
        targets: p,
        y: p.y - 100,
        alpha: 0,
        duration: 3000 + Math.random() * 2000,
        repeat: -1,
        onRepeat: () => {
          p.y = H + 20;
          p.x = Math.random() * W;
          p.alpha = Math.random() * 0.3 + 0.1;
        },
      });
    }

    // Quest giver area with mystical glow
    const elderGlow = this.add.graphics();
    elderGlow.fillStyle(0xa87ffb, 0.15);
    elderGlow.fillCircle(100, H - 60, 50);

    this.add.rectangle(100, H - 60, 80, 40, 0x1f1525);
    this.add.rectangle(100, H - 60, 80, 40, 0xa87ffb, 0.1);
    this.add.text(100, H - 60, 'ELDER\nCHEN', { fontFamily: 'monospace', fontSize: '8px', color: '#a87ffb', align: 'center' }).setOrigin(0.5);
  }

  private buildPlayer(): void {
    this.player = this.physics.add.sprite(100, H - 120, 'player');
    this.player.setCollideWorldBounds(true);
    this.player.body!.setSize(16, 16).setOffset(8, 32);
    this.player.setDepth(10);

    // Player shadow
    this.add.ellipse(100, H - 98, 24, 10, 0x000000, 0.3).setDepth(9);
  }

  private buildShards(): void {
    const positions = [
      { x: 250, y: 150 },
      { x: 600, y: 200 },
      { x: 450, y: 350 },
    ];

    const colors = [0x42c2ff, 0x22c55e, 0xf6b94b];

    for (let i = 0; i < positions.length; i++) {
      const pos = positions[i];
      const color = colors[i];

      // Create shard shape
      const shard = this.add.graphics();
      shard.fillStyle(color, 1);
      shard.beginPath();
      shard.moveTo(pos.x, pos.y - 15);
      shard.lineTo(pos.x + 10, pos.y);
      shard.lineTo(pos.x, pos.y + 15);
      shard.lineTo(pos.x - 10, pos.y);
      shard.closePath();
      shard.fillPath();

      // Inner glow
      shard.fillStyle(0xffffff, 0.4);
      shard.beginPath();
      shard.moveTo(pos.x, pos.y - 8);
      shard.lineTo(pos.x + 5, pos.y);
      shard.lineTo(pos.x, pos.y + 8);
      shard.lineTo(pos.x - 5, pos.y);
      shard.closePath();
      shard.fillPath();

      // Outer glow
      const glow = this.add.circle(pos.x, pos.y, 25, color, 0.2);
      this.tweens.add({ targets: glow, alpha: 0.4, scale: 1.3, duration: 1000, yoyo: true, repeat: -1 });

      // Floating animation
      this.tweens.add({
        targets: shard,
        y: -5,
        duration: 1500,
        yoyo: true,
        repeat: -1,
        ease: 'Sine.inOut',
      });

      this.shards.push({ sprite: this.add.sprite(pos.x, pos.y, '__DEFAULT').setVisible(false), collected: false });
      (this.shards[i] as any).graphics = shard;
    }
  }

  private buildGuardian(): void {
    // Create guardian boss sprite
    const guardianGfx = this.add.graphics();
    guardianGfx.fillStyle(0x6b21a8, 1);

    // Body
    guardianGfx.fillCircle(W / 2, 100, 40);

    // Eyes
    guardianGfx.fillStyle(0xffffff, 1);
    guardianGfx.fillCircle(W / 2 - 15, 90, 8);
    guardianGfx.fillCircle(W / 2 + 15, 90, 8);

    // Pupils
    guardianGfx.fillStyle(0x1a1a1a, 1);
    guardianGfx.fillCircle(W / 2 - 15, 90, 4);
    guardianGfx.fillCircle(W / 2 + 15, 90, 4);

    // Crown/horns
    guardianGfx.fillStyle(0x4c1d95, 1);
    guardianGfx.fillTriangle(W / 2 - 30, 70, W / 2 - 20, 50, W / 2 - 10, 70);
    guardianGfx.fillTriangle(W / 2 + 30, 70, W / 2 + 20, 50, W / 2 + 10, 70);

    // Glow effect
    const guardianGlow = this.add.circle(W / 2, 100, 50, 0x6b21a8, 0.2);
    this.tweens.add({ targets: guardianGlow, alpha: 0.4, scale: 1.2, duration: 1500, yoyo: true, repeat: -1 });

    const sprite = this.physics.add.sprite(W / 2, 100, '__DEFAULT');
    sprite.setAlpha(0.3);
    sprite.setVelocity(0, 0);
    sprite.setVisible(false);
    (this as any).guardianGfx = guardianGfx;

    this.guardian = { sprite, hp: 150 };
  }

  private buildInput(): void {
    this.cursors = this.input.keyboard!.createCursorKeys();
    this.wasd = {
      W: this.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.W),
      A: this.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.A),
      S: this.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.S),
      D: this.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.D),
    };

    this.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.SPACE).on('down', () => this.attack());
    this.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.E).on('down', () => this.interact());

    this.input.keyboard!.addCapture([Phaser.Input.Keyboard.KeyCodes.UP, Phaser.Input.Keyboard.KeyCodes.DOWN, Phaser.Input.Keyboard.KeyCodes.LEFT, Phaser.Input.Keyboard.KeyCodes.RIGHT]);
  }

  private buildHud(): void {
    this.add.text(20, 20, 'LOST REALM', { fontFamily: 'monospace', fontSize: '12px', color: '#a87ffb' });

    this.shardText = this.add.text(20, 40, 'SHARDS: 0 / 3', { fontFamily: 'monospace', fontSize: '11px', color: '#ffd078' });

    // Stamina bar
    this.staminaBar = this.add.graphics();
    this.updateStaminaBar();

    this.add.text(W - 20, 20, 'WASD · SPACE attack · E interact', {
      fontFamily: 'monospace', fontSize: '9px', color: '#8b8d9a',
    }).setOrigin(1, 0);

    this.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.ESC)
      .on('down', () => this.showPause());
  }

  private interact(): void {
    if (this.over) return;

    // Check shards
    for (const shard of this.shards) {
      if (shard.collected) continue;
      const shardX = shard.sprite.x;
      const shardY = shard.sprite.y;
      const dist = Phaser.Math.Distance.Between(this.player.x, this.player.y, shardX, shardY);
      if (dist < 40) {
        shard.collected = true;
        shard.sprite.destroy();
        (shard as any).graphics?.destroy();
        audio.sfx('collect');
        this.shardsCollected++;
        this.shardText.setText(`SHARDS: ${this.shardsCollected} / 3`);

        if (this.shardsCollected >= 3) {
          this.activateGuardian();
        }
        return;
      }
    }

    // Check quest giver
    if (this.player.x < 140 && this.player.y > H - 100) {
      this.showDialogue();
    }
  }

  private activateGuardian(): void {
    this.guardianActive = true;
    this.guardian.sprite.setAlpha(1);

    // Show message
    const msg = this.add.text(W / 2, H / 2, 'THE GUARDIAN AWAKENS', {
      fontFamily: 'monospace', fontSize: '16px', color: '#a87ffb',
    }).setOrigin(0.5).setDepth(100);

    this.tweens.add({ targets: msg, alpha: 0, duration: 2000, onComplete: () => msg.destroy() });
  }

  private attack(): void {
    if (this.over) return;
    if (!this.guardianActive) return;

    const dist = Phaser.Math.Distance.Between(this.player.x, this.player.y, this.guardian.sprite.x, this.guardian.sprite.y);
    if (dist < 80) {
      audio.sfx('hit');
      this.guardian.hp -= 25;

      // Flash effect
      const guardianGfx = (this as any).guardianGfx;
      if (guardianGfx) {
        guardianGfx.clear();
        guardianGfx.fillStyle(0xffffff, 1);
        guardianGfx.fillCircle(W / 2, 100, 40);
        this.time.delayedCall(100, () => {
          guardianGfx.clear();
          guardianGfx.fillStyle(0x6b21a8, 1);
          guardianGfx.fillCircle(W / 2, 100, 40);
          guardianGfx.fillStyle(0xffffff, 1);
          guardianGfx.fillCircle(W / 2 - 15, 90, 8);
          guardianGfx.fillCircle(W / 2 + 15, 90, 8);
          guardianGfx.fillStyle(0x1a1a1a, 1);
          guardianGfx.fillCircle(W / 2 - 15, 90, 4);
          guardianGfx.fillCircle(W / 2 + 15, 90, 4);
          guardianGfx.fillStyle(0x4c1d95, 1);
          guardianGfx.fillTriangle(W / 2 - 30, 70, W / 2 - 20, 50, W / 2 - 10, 70);
          guardianGfx.fillTriangle(W / 2 + 30, 70, W / 2 + 20, 50, W / 2 + 10, 70);
        });
      }

      if (this.guardian.hp <= 0) {
        this.victory();
      }
    }
  }

  private showDialogue(): void {
    this.scene.pause();
    showModal({
      kicker: 'ELDER CHEN',
      title: 'The Lost Realm',
      body: this.shardsCollected >= 3
        ? '<p>You have collected all three shards. The guardian awaits.</p>'
        : `<p>Find the three elemental shards scattered across this realm. Only then will the guardian awaken, and you may defeat it.</p><p>Shards collected: ${this.shardsCollected} / 3</p>`,
      actions: [{ label: 'Continue', onClick: () => { closeModal(); this.scene.resume(); } }],
    });
  }

  private victory(): void {
    this.over = true;

    this.time.delayedCall(500, () => {
      showModal({
        kicker: 'VICTORY',
        title: 'Guardian Defeated!',
        body: '<p>The realm is restored. You may return to the arcade.</p>',
        actions: [{ label: 'Return to Arcade', onClick: () => { closeModal(); this.scene.start('Arcade'); } }],
      });
    });
  }

  private updateStaminaBar(): void {
    this.staminaBar.clear();
    this.staminaBar.fillStyle(0x374151, 1).fillRect(20, 60, 100, 6);
    this.staminaBar.fillStyle(0x22c55e, 1).fillRect(20, 60, this.stamina, 6);
  }

  private showPause(): void {
    this.scene.pause();
    showModal({
      kicker: 'PAUSED',
      title: 'Lost Realm',
      body: '<p>Press Resume to continue.</p>',
      actions: [
        { label: 'Resume', onClick: () => { closeModal(); this.scene.resume(); } },
        { label: 'Quit', kind: 'ghost', onClick: () => { closeModal(); this.scene.start('Arcade'); } },
      ],
    });
  }

  update(_time: number, delta: number): void {
    if (this.over || !this.player?.body) return;

    // Regenerate stamina
    this.stamina = Math.min(100, this.stamina + delta * 0.01);
    this.updateStaminaBar();

    // Player movement
    let vx = 0, vy = 0;
    if (this.cursors.left.isDown || this.wasd.A.isDown) vx = -1;
    if (this.cursors.right.isDown || this.wasd.D.isDown) vx = 1;
    if (this.cursors.up.isDown || this.wasd.W.isDown) vy = -1;
    if (this.cursors.down.isDown || this.wasd.S.isDown) vy = 1;

    const speed = 150;
    this.player.setVelocity(vx * speed, vy * speed);

    // Guardian AI when active
    if (this.guardianActive && this.guardian.hp > 0) {
      const dist = Phaser.Math.Distance.Between(this.player.x, this.player.y, this.guardian.sprite.x, this.guardian.sprite.y);

      if (dist > 100) {
        this.physics.moveToObject(this.guardian.sprite, this.player, 60);
      } else {
        this.guardian.sprite.setVelocity(0, 0);
      }
    }
  }
}
