import Phaser from 'phaser';
import { ensureTextures, createAnimations } from '../assets';
import { audio } from '../audio';
import { showModal, closeModal, showDialogue, showExhibit, showGameIntro } from '../ui/modals';
import { NPCS, EXHIBITS, MACHINES } from '../data/dialogues';

const W = 920, H = 520;

export class ArcadeScene extends Phaser.Scene {
  private player!: Phaser.Physics.Arcade.Sprite;
  private cursors!: Phaser.Types.Input.Keyboard.CursorKeys;
  private wasd!: { W: Phaser.Input.Keyboard.Key; A: Phaser.Input.Keyboard.Key; S: Phaser.Input.Keyboard.Key; D: Phaser.Input.Keyboard.Key };
  private interactKey!: Phaser.Input.Keyboard.Key;

  private interactables: { type: 'npc' | 'exhibit' | 'machine'; x: number; y: number; data: any }[] = [];
  private nearestInteractable: { type: string; data: any } | null = null;

  private hintEl!: HTMLElement;

  constructor() { super('Arcade'); }

  create(): void {
    ensureTextures(this);
    createAnimations(this);

    this.buildFloor();
    this.buildMachines();
    this.buildNpcs();
    this.buildExhibits();
    this.buildPlayer();
    this.buildInput();
    this.buildHud();

    this.hintEl = document.getElementById('hint')!;
    this.updateHint('WASD / CLICK to move · E to interact');
  }

  private buildFloor(): void {
    // Dark floor with subtle grid
    this.add.rectangle(W / 2, H / 2 + 40, W, H - 80, 0x0d1019);

    // Floor tiles
    for (let x = 20; x < W; x += 60) {
      for (let y = 100; y < H - 20; y += 50) {
        const shade = ((x / 60) + (y / 50)) % 2 === 0 ? 0x111827 : 0x0f1525;
        this.add.rectangle(x + 30, y + 25, 58, 48, shade).setAlpha(0.6);
      }
    }

    // Top border / marquee
    this.add.rectangle(W / 2, 45, W, 90, 0x1a1f2e);
    this.add.rectangle(W / 2, 90, W, 2, 0x3a4560);

    // Title
    this.add.text(W / 2, 35, 'MAIN FLOOR', {
      fontFamily: 'monospace', fontSize: '14px', color: '#ffd078', letterSpacing: 4,
    }).setOrigin(0.5);

    this.add.text(W / 2, 55, 'WALK AROUND · INTERACT WITH MACHINES, PEOPLE, EXHIBITS', {
      fontFamily: 'monospace', fontSize: '9px', color: '#8b8d9a', letterSpacing: 1,
    }).setOrigin(0.5);
  }

  private buildMachines(): void {
    for (const m of MACHINES) {
      // Cabinet sprite
      const cabinet = this.add.image(m.x, m.y, `cabinet_${m.id}`);
      cabinet.setScale(0.9);

      // Glow under cabinet
      const glow = this.add.ellipse(m.x, m.y + 45, 90, 25, m.color, 0.15);
      this.tweens.add({ targets: glow, alpha: 0.25, duration: 1500, yoyo: true, repeat: -1 });

      // Label
      this.add.text(m.x, m.y + 60, m.label.toUpperCase(), {
        fontFamily: 'monospace', fontSize: '9px', color: '#ffd078', letterSpacing: 1,
      }).setOrigin(0.5);

      // Hit area
      const hit = this.add.rectangle(m.x, m.y + 10, 85, 110, 0x000000, 0.001)
        .setInteractive({ useHandCursor: true });

      hit.on('pointerdown', () => this.openMachine(m.id));
      hit.on('pointerover', () => this.updateHint(`E / CLICK to play ${m.label}`));
      hit.on('pointerout', () => this.updateHint('WASD / CLICK to move · E to interact'));

      this.interactables.push({ type: 'machine', x: m.x, y: m.y + 30, data: m });
    }
  }

  private buildNpcs(): void {
    for (const npc of NPCS) {
      const sprite = this.add.image(npc.x, npc.y, `npc_${npc.portrait}`);

      // Name label
      this.add.text(npc.x, npc.y - 32, npc.name, {
        fontFamily: 'monospace', fontSize: '8px', color: '#ffffff',
        backgroundColor: '#0a0f19aa', padding: { x: 4, y: 2 },
      }).setOrigin(0.5);

      // Idle animation
      this.tweens.add({
        targets: sprite,
        y: npc.y - 3,
        duration: 1800,
        yoyo: true,
        repeat: -1,
        ease: 'Sine.inOut',
      });

      // Hit area
      const hit = this.add.rectangle(npc.x, npc.y, 40, 55, 0x000000, 0.001)
        .setInteractive({ useHandCursor: true });

      hit.on('pointerdown', () => this.openNpc(npc));
      hit.on('pointerover', () => this.updateHint(`E / CLICK to talk to ${npc.name}`));
      hit.on('pointerout', () => this.updateHint('WASD / CLICK to move · E to interact'));

      this.interactables.push({ type: 'npc', x: npc.x, y: npc.y, data: npc });
    }
  }

  private buildExhibits(): void {
    for (const ex of EXHIBITS) {
      const board = this.add.image(ex.x, ex.y, 'exhibit');

      // Glow
      const glow = this.add.rectangle(ex.x, ex.y, 95, 75, 0xffd078, 0.08);
      this.tweens.add({ targets: glow, alpha: 0.15, duration: 2000, yoyo: true, repeat: -1 });

      // Hit area
      const hit = this.add.rectangle(ex.x, ex.y, 100, 80, 0x000000, 0.001)
        .setInteractive({ useHandCursor: true });

      hit.on('pointerdown', () => this.openExhibit(ex));
      hit.on('pointerover', () => this.updateHint(`E / CLICK to view exhibit`));
      hit.on('pointerout', () => this.updateHint('WASD / CLICK to move · E to interact'));

      this.interactables.push({ type: 'exhibit', x: ex.x, y: ex.y, data: ex });
    }
  }

  private buildPlayer(): void {
    this.player = this.physics.add.sprite(460, 450, 'player_idle');
    this.player.setCollideWorldBounds(true);
    this.player.body!.setSize(14, 14).setOffset(7, 18);
    this.player.setDepth(100);

    // Click to move
    this.input.on('pointerdown', (ptr: Phaser.Input.Pointer) => {
      if (ptr.y > 100 && ptr.y < H - 20) {
        // Only if not clicking an interactable
        const clickedInteractable = this.interactables.some(i => {
          const dist = Phaser.Math.Distance.Between(ptr.x, ptr.y, i.x, i.y);
          return dist < 60;
        });
        if (!clickedInteractable) {
          this.physics.moveToObject(this.player, { x: ptr.x, y: ptr.y }, 180);
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

    // Capture arrow keys to prevent scroll
    this.input.keyboard!.addCapture([
      Phaser.Input.Keyboard.KeyCodes.UP,
      Phaser.Input.Keyboard.KeyCodes.DOWN,
      Phaser.Input.Keyboard.KeyCodes.LEFT,
      Phaser.Input.Keyboard.KeyCodes.RIGHT,
    ]);
  }

  private buildHud(): void {
    // Mute button
    const muteBtn = this.add.text(W - 15, 15, audio.isMuted() ? 'SOUND OFF' : 'SOUND ON', {
      fontFamily: 'monospace', fontSize: '9px', color: '#8b8d9a',
      backgroundColor: '#0a0f1988', padding: { x: 6, y: 3 },
    }).setOrigin(1, 0).setInteractive({ useHandCursor: true });

    muteBtn.on('pointerdown', () => {
      const muted = audio.toggleMute();
      muteBtn.setText(muted ? 'SOUND OFF' : 'SOUND ON');
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
      portrait: npc.portrait,
      questions: npc.questions,
    });
  }

  private openExhibit(ex: any): void {
    audio.sfx('click');
    showExhibit({ title: ex.title, tabs: ex.tabs });
  }

  update(): void {
    if (!this.player?.body) return;

    // Keyboard movement
    let vx = 0, vy = 0;
    if (this.cursors.left.isDown || this.wasd.A.isDown) vx = -1;
    if (this.cursors.right.isDown || this.wasd.D.isDown) vx = 1;
    if (this.cursors.up.isDown || this.wasd.W.isDown) vy = -1;
    if (this.cursors.down.isDown || this.wasd.S.isDown) vy = 1;

    // Apply velocity
    if (vx !== 0 || vy !== 0) {
      this.player.body.velocity.set(0, 0); // Stop click-to-move
      const speed = 180;
      this.player.setVelocity(vx * speed, vy * speed);
      this.player.play('player_walk', true);
      if (vx !== 0) this.player.setFlipX(vx < 0);
    } else if (this.player.body.velocity.length() < 10) {
      this.player.setVelocity(0, 0);
      this.player.anims.stop();
      this.player.setTexture('player_idle');
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
