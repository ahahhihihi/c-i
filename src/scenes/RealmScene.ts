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
    // Dark realm background
    this.add.rectangle(W / 2, H / 2, W, H, 0x0d1117);

    // Stone floor tiles
    for (let x = 0; x < W; x += 60) {
      for (let y = 0; y < H; y += 60) {
        const shade = Math.random() > 0.5 ? 0x1a1f2e : 0x141927;
        this.add.rectangle(x + 30, y + 30, 56, 56, shade).setAlpha(0.7);
      }
    }

    // Atmospheric particles
    for (let i = 0; i < 20; i++) {
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

    // Quest giver area
    this.add.rectangle(100, H - 60, 80, 40, 0x1f2937);
    this.add.text(100, H - 60, 'ELDER\nCHEN', { fontFamily: 'monospace', fontSize: '8px', color: '#a87ffb', align: 'center' }).setOrigin(0.5);
  }

  private buildPlayer(): void {
    this.player = this.physics.add.sprite(100, H - 120, 'player_idle');
    this.player.setCollideWorldBounds(true);
    this.player.body!.setSize(14, 14);
    this.player.setDepth(10);
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
      const sprite = this.add.sprite(pos.x, pos.y, 'player_idle');
      sprite.setTint(colors[i]);
      sprite.setScale(0.6);
      sprite.setVisible(true);

      // Glow
      const glow = this.add.circle(pos.x, pos.y, 20, colors[i], 0.2);
      this.tweens.add({ targets: glow, alpha: 0.4, scale: 1.3, duration: 1000, yoyo: true, repeat: -1 });

      this.shards.push({ sprite, collected: false });
    }
  }

  private buildGuardian(): void {
    const sprite = this.physics.add.sprite(W / 2, 100, 'player_idle');
    sprite.setTint(0x6b21a8);
    sprite.setScale(2);
    sprite.setAlpha(0.3);
    sprite.setVelocity(0, 0);

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
      const dist = Phaser.Math.Distance.Between(this.player.x, this.player.y, shard.sprite.x, shard.sprite.y);
      if (dist < 40) {
        shard.collected = true;
        shard.sprite.destroy();
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

      // Flash
      this.guardian.sprite.setTint(0xffffff);
      this.time.delayedCall(100, () => this.guardian.sprite.setTint(0x6b21a8));

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
