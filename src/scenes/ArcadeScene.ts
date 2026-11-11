import Phaser from 'phaser';
import { ensureTextures } from '../assets';
import { audio } from '../audio';
import { showModal, closeModal, showDialogue, showExhibit, showGameIntro } from '../ui/modals';
import { NPCS, EXHIBITS, MACHINES } from '../data/dialogues';

const W = 920, H = 520;

export class ArcadeScene extends Phaser.Scene {
  private player!: Phaser.Physics.Arcade.Sprite;
  private cursors!: Phaser.Types.Input.Keyboard.CursorKeys;
  private wasd!: { W: Phaser.Input.Keyboard.Key; A: Phaser.Input.Keyboard.Key; S: Phaser.Input.Keyboard.Key; D: Phaser.Input.Keyboard.Key };
  private interactKey!: Phaser.Input.Keyboard.Key;

  private interactables: { type: 'npc' | 'exhibit' | 'machine'; x: number; y: number; data: any; glow?: Phaser.GameObjects.Graphics }[] = [];
  private nearestInteractable: { type: string; data: any } | null = null;

  private hintEl!: HTMLElement;
  private targetPos: { x: number; y: number } | null = null;

  constructor() { super('Arcade'); }

  create(): void {
    ensureTextures(this);
    audio.sfx('click');

    this.buildEnvironment();
    this.buildMachines();
    this.buildExhibits();
    this.buildNpcs();
    this.buildPlayer();
    this.buildInput();
    this.buildHud();

    this.hintEl = document.getElementById('hint')!;
    this.updateHint('WASD / CLICK to move · E to interact');
  }

  private buildEnvironment(): void {
    // Gradient background
    const bg = this.add.graphics();
    bg.fillGradientStyle(0x0a0e19, 0x0a0e19, 0x0f1525, 0x0f1525, 1);
    bg.fillRect(0, 0, W, H);

    // Checkered floor
    for (let x = 0; x < W; x += 64) {
      for (let y = 80; y < H; y += 64) {
        const isDark = ((x / 64) + (y / 64)) % 2 === 0;
        const color = isDark ? 0x1a1f2e : 0x1f2937;
        this.add.rectangle(x + 32, y + 32, 64, 64, color);

        // Subtle grid lines
        const grid = this.add.graphics();
        grid.lineStyle(1, 0x2d3748, 0.3);
        grid.strokeRect(x, y, 64, 64);
      }
    }

    // Top wall / marquee area
    const wall = this.add.graphics();
    wall.fillStyle(0x0d1019, 1);
    wall.fillRect(0, 0, W, 80);

    // Neon-style border
    wall.lineStyle(3, 0xffd078, 0.8);
    wall.lineBetween(0, 80, W, 80);

    // Title with glow effect
    const titleShadow = this.add.text(W / 2 + 2, 28, 'MAIN ARCADE FLOOR', {
      fontFamily: 'monospace', fontSize: '18px', color: '#ffd078', letterSpacing: 4,
    }).setOrigin(0.5).setAlpha(0.3);

    const title = this.add.text(W / 2, 26, 'MAIN ARCADE FLOOR', {
      fontFamily: 'monospace', fontSize: '18px', color: '#ffd078', letterSpacing: 4,
    }).setOrigin(0.5);

    // Subtitle
    this.add.text(W / 2, 52, 'WALK · INTERACT · PLAY', {
      fontFamily: 'monospace', fontSize: '10px', color: '#8b8d9a', letterSpacing: 2,
    }).setOrigin(0.5);

    // Ambient particles
    for (let i = 0; i < 15; i++) {
      const p = this.add.circle(
        Math.random() * W,
        Math.random() * H,
        Math.random() * 2 + 1,
        0xffd078,
        Math.random() * 0.15 + 0.05
      );
      this.tweens.add({
        targets: p,
        y: p.y - 150,
        alpha: 0,
        duration: 4000 + Math.random() * 3000,
        repeat: -1,
        delay: Math.random() * 2000,
        onRepeat: () => {
          p.y = H + 20;
          p.x = Math.random() * W;
          p.alpha = Math.random() * 0.15 + 0.05;
        },
      });
    }

    // Side decorations - arcade posters
    this.add.rectangle(30, 200, 40, 60, 0x1f2937).setStrokeStyle(1, 0xffd078, 0.5);
    this.add.text(30, 200, 'GAMES', { fontFamily: 'monospace', fontSize: '8px', color: '#ffd078' }).setOrigin(0.5);

    this.add.rectangle(W - 30, 200, 40, 60, 0x1f2937).setStrokeStyle(1, 0xffd078, 0.5);
    this.add.text(W - 30, 200, 'PLAY', { fontFamily: 'monospace', fontSize: '8px', color: '#ffd078' }).setOrigin(0.5);
  }

  private buildMachines(): void {
    for (const m of MACHINES) {
      // Cabinet sprite
      const cabinet = this.add.image(m.x, m.y, `cabinet_${m.id}`);
      cabinet.setScale(0.95).setDepth(10);

      // Glow under cabinet
      const glow = this.add.graphics();
      glow.fillStyle(m.color, 0.12);
      glow.fillEllipse(m.x, m.y + 55, 100, 30);
      this.tweens.add({ targets: glow, alpha: 0.18, duration: 1800, yoyo: true, repeat: -1 });

      // Floating label
      const labelBg = this.add.rectangle(m.x, m.y + 75, 100, 20, 0x0a0e19, 0.85);
      labelBg.setStrokeStyle(1, m.color, 0.6);
      this.add.text(m.x, m.y + 75, m.label.toUpperCase(), {
        fontFamily: 'monospace', fontSize: '9px', color: '#ffd078', letterSpacing: 1,
      }).setOrigin(0.5);

      // Hit area
      const hit = this.add.rectangle(m.x, m.y + 15, 95, 115, 0x000000, 0.001)
        .setInteractive({ useHandCursor: true })
        .setDepth(15);

      hit.on('pointerdown', () => this.openMachine(m.id));
      hit.on('pointerover', () => {
        this.updateHint(`E / CLICK to play ${m.label}`);
        cabinet.setTint(0xffffff);
      });
      hit.on('pointerout', () => {
        this.updateHint('WASD / CLICK to move · E to interact');
        cabinet.clearTint();
      });

      this.interactables.push({ type: 'machine', x: m.x, y: m.y + 35, data: m, glow });
    }
  }

  private buildExhibits(): void {
    for (const ex of EXHIBITS) {
      const board = this.add.image(ex.x, ex.y, 'exhibit').setScale(0.9).setDepth(5);

      // Glow
      const glow = this.add.graphics();
      glow.fillStyle(0xffd078, 0.08);
      glow.fillRoundedRect(ex.x - 50, ex.y - 38, 100, 76, 4);
      this.tweens.add({ targets: glow, alpha: 0.12, duration: 2000, yoyo: true, repeat: -1 });

      // Label
      this.add.text(ex.x, ex.y + 50, 'EXHIBIT', {
        fontFamily: 'monospace', fontSize: '8px', color: '#8b8d9a',
      }).setOrigin(0.5);

      // Hit area
      const hit = this.add.rectangle(ex.x, ex.y, 105, 85, 0x000000, 0.001)
        .setInteractive({ useHandCursor: true })
        .setDepth(6);

      hit.on('pointerdown', () => this.openExhibit(ex));
      hit.on('pointerover', () => this.updateHint(`E / CLICK to view exhibit`));
      hit.on('pointerout', () => this.updateHint('WASD / CLICK to move · E to interact'));

      this.interactables.push({ type: 'exhibit', x: ex.x, y: ex.y, data: ex, glow });
    }
  }

  private buildNpcs(): void {
    // Shuffle NPCs to randomize which portrait style each gets
    const portraits: Array<'warm' | 'cool' | 'violet' | 'gold'> = ['warm', 'cool', 'violet', 'gold', 'warm', 'cool', 'violet', 'gold'];

    for (let i = 0; i < NPCS.length; i++) {
      const npc = NPCS[i];
      const portrait = portraits[i];

      const sprite = this.add.image(npc.x, npc.y, `npc_${portrait}`).setDepth(20);

      // Shadow
      this.add.ellipse(npc.x, npc.y + 24, 28, 10, 0x000000, 0.3).setDepth(19);

      // Name label with background
      const nameBg = this.add.rectangle(npc.x, npc.y - 36, 90, 16, 0x0a0e19, 0.85);
      nameBg.setStrokeStyle(1, 0xffd078, 0.4);
      this.add.text(npc.x, npc.y - 36, npc.name, {
        fontFamily: 'monospace', fontSize: '9px', color: '#ffffff',
      }).setOrigin(0.5).setDepth(21);

      // Idle animation - gentle breathing
      this.tweens.add({
        targets: sprite,
        y: npc.y - 2,
        scaleX: 0.97,
        scaleY: 1.01,
        duration: 2000,
        yoyo: true,
        repeat: -1,
        ease: 'Sine.inOut',
      });

      // Hit area
      const hit = this.add.rectangle(npc.x, npc.y, 45, 60, 0x000000, 0.001)
        .setInteractive({ useHandCursor: true })
        .setDepth(25);

      hit.on('pointerdown', () => this.openNpc(npc));
      hit.on('pointerover', () => {
        this.updateHint(`E / CLICK to talk to ${npc.name}`);
        sprite.setTint(0xffeedd);
      });
      hit.on('pointerout', () => {
        this.updateHint('WASD / CLICK to move · E to interact');
        sprite.clearTint();
      });

      this.interactables.push({ type: 'npc', x: npc.x, y: npc.y, data: npc });
    }
  }

  private buildPlayer(): void {
    // Spawn point
    this.player = this.physics.add.sprite(460, 450, 'player');
    this.player.setCollideWorldBounds(true);
    this.player.body!.setSize(16, 16).setOffset(8, 32);
    this.player.setDepth(100);

    // Player shadow
    const shadow = this.add.ellipse(460, 450 + 22, 24, 10, 0x000000, 0.35).setDepth(99);

    // Update shadow position with player
    this.events.on('update', () => {
      shadow.setPosition(this.player.x, this.player.y + 22);
    });

    // Click to move on floor
    this.input.on('pointerdown', (ptr: Phaser.Input.Pointer) => {
      if (ptr.y > 90 && ptr.y < H - 10) {
        // Check if clicking an interactable
        const clickedInteractable = this.interactables.some(i => {
          const dist = Phaser.Math.Distance.Between(ptr.x, ptr.y, i.x, i.y);
          return dist < 50;
        });

        if (!clickedInteractable) {
          this.targetPos = { x: ptr.x, y: ptr.y };
          this.physics.moveToObject(this.player, this.targetPos, 200);
        }
      }
    });
  }

  private buildInput(): void {
    this.cursors = this.input.keyboard!.createCursorKeys();
    this.wasd = {
      W: this.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.W),
      A: this.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.A),
      S: this.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.S),
      D: this.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.D),
    };
    this.interactKey = this.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.E);

    this.input.keyboard!.addCapture([
      Phaser.Input.Keyboard.KeyCodes.UP,
      Phaser.Input.Keyboard.KeyCodes.DOWN,
      Phaser.Input.Keyboard.KeyCodes.LEFT,
      Phaser.Input.Keyboard.KeyCodes.RIGHT,
    ]);
  }

  private buildHud(): void {
    // Mute button
    const muteBtn = this.add.text(W - 15, 15, audio.isMuted() ? '🔇 SOUND OFF' : '🔊 SOUND ON', {
      fontFamily: 'monospace', fontSize: '9px', color: '#8b8d9a',
      backgroundColor: '#0a0f1988', padding: { x: 6, y: 3 },
    }).setOrigin(1, 0).setInteractive({ useHandCursor: true }).setDepth(200);

    muteBtn.on('pointerdown', () => {
      const muted = audio.toggleMute();
      muteBtn.setText(muted ? '🔇 SOUND OFF' : '🔊 SOUND ON');
      audio.sfx('click');
    });
  }

  private updateHint(text: string): void {
    if (this.hintEl) this.hintEl.textContent = text;
  }

  private openMachine(id: 'battle' | 'realm' | 'frontier'): void {
    audio.sfx('click');
    showGameIntro({
      game: id,
      onStart: () => {
        closeModal();
        this.scene.start(id === 'battle' ? 'Battle' : id === 'realm' ? 'Realm' : 'Frontier');
      },
    });
  }

  private openNpc(npc: any): void {
    audio.sfx('click');
    showDialogue({
      name: npc.name,
      role: npc.role,
      portrait: npc.portrait || 'warm',
      questions: npc.questions,
    });
  }

  private openExhibit(ex: any): void {
    audio.sfx('click');
    showExhibit({ title: ex.title, tabs: ex.tabs });
  }

  update(_time: number, delta: number): void {
    if (!this.player?.body) return;

    // Keyboard movement
    let vx = 0, vy = 0;
    if (this.cursors.left.isDown || this.wasd.A.isDown) vx = -1;
    if (this.cursors.right.isDown || this.wasd.D.isDown) vx = 1;
    if (this.cursors.up.isDown || this.wasd.W.isDown) vy = -1;
    if (this.cursors.down.isDown || this.wasd.S.isDown) vy = 1;

    // Apply velocity
    if (vx !== 0 || vy !== 0) {
      this.targetPos = null;
      this.player.body.velocity.set(0, 0);
      const speed = 200;
      this.player.setVelocity(vx * speed, vy * speed);
      if (vx !== 0) this.player.setFlipX(vx < 0);
    } else if (this.targetPos) {
      // Check if reached target
      const dist = Phaser.Math.Distance.Between(this.player.x, this.player.y, this.targetPos.x, this.targetPos.y);
      if (dist < 10) {
        this.player.setVelocity(0, 0);
        this.targetPos = null;
      }
    } else {
      this.player.setVelocity(0, 0);
    }

    // Check proximity to interactables
    let nearest: { type: string; data: any } | null = null;
    let nearestDist = Infinity;

    for (const i of this.interactables) {
      const dist = Phaser.Math.Distance.Between(this.player.x, this.player.y, i.x, i.y);
      if (dist < nearestDist && dist < 70) {
        nearestDist = dist;
        nearest = { type: i.type, data: i.data };
      }
    }

    this.nearestInteractable = nearest;

    // E key to interact
    if (Phaser.Input.Keyboard.JustDown(this.interactKey) && nearest) {
      if (nearest.type === 'machine') this.openMachine(nearest.data.id);
      else if (nearest.type === 'npc') this.openNpc(nearest.data);
      else if (nearest.type === 'exhibit') this.openExhibit(nearest.data);
    }

    // Update location
    const locEl = document.getElementById('location');
    if (locEl) locEl.textContent = 'MAIN FLOOR';
  }
}
