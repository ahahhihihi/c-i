import Phaser from 'phaser';
import { ensureTextures } from '../assets';
import { audio } from '../audio';
import { SIM_BODY } from '../sims';
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
  private mood = { fun: 60, social: 45, energy: 80 };
  private moodBars!: Phaser.GameObjects.Graphics;
  private moodRows: Array<{ label: string; key: 'fun' | 'social' | 'energy'; color: number }> = [];
  private playerPlumbob!: Phaser.GameObjects.Image;
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
    this.buildMoodPanel();

    this.hintEl = document.getElementById('hint')!;
    this.updateHint('WASD / CLICK to move · E to interact');
  }

  private buildEnvironment(): void {
    // Wood floor
    this.add.tileSprite(W / 2, 80 + (H - 80) / 2, W, H - 80, 'floor_wood').setDepth(0);

    // Warm light pooling from the windows, darker toward the edges
    const light = this.add.graphics().setDepth(1);
    light.fillStyle(0xfff1c9, 0.10);
    light.fillEllipse(280, 200, 340, 160);
    light.fillEllipse(640, 200, 340, 160);
    const vignette = this.add.graphics().setDepth(2);
    vignette.fillStyle(0x1b0f05, 0.22);
    vignette.fillRect(0, 80, 40, H - 80);
    vignette.fillRect(W - 40, 80, 40, H - 80);
    vignette.fillRect(0, H - 30, W, 30);

    // Big rug under the machines
    const rug = this.add.graphics().setDepth(1);
    const rx = 90, ry = 130, rw = W - 180, rh = 250;
    rug.fillStyle(0x000000, 0.18);
    rug.fillRoundedRect(rx + 4, ry + 5, rw, rh, 14);
    rug.fillStyle(0x8e2f45, 1);
    rug.fillRoundedRect(rx, ry, rw, rh, 14);
    rug.lineStyle(3, 0xe9c46a, 1);
    rug.strokeRoundedRect(rx + 10, ry + 10, rw - 20, rh - 20, 10);
    rug.lineStyle(1, 0xe9c46a, 0.6);
    rug.strokeRoundedRect(rx + 18, ry + 18, rw - 36, rh - 36, 8);
    rug.fillStyle(0xa23a52, 1);
    rug.fillRoundedRect(rx + 24, ry + 24, rw - 48, rh - 48, 6);
    for (let i = 0; i < 9; i++) {
      const dx = rx + 70 + i * ((rw - 140) / 8);
      rug.fillStyle(0xe9c46a, 0.55);
      rug.fillTriangle(dx, ry + rh / 2 - 12, dx + 10, ry + rh / 2, dx, ry + rh / 2 + 12);
      rug.fillTriangle(dx, ry + rh / 2 - 12, dx - 10, ry + rh / 2, dx, ry + rh / 2 + 12);
    }

    // Back wall: striped wallpaper, wainscot, trim
    const wall = this.add.graphics().setDepth(3);
    wall.fillStyle(0x7fa6c9, 1);
    wall.fillRect(0, 0, W, 80);
    for (let x = 0; x < W; x += 24) {
      wall.fillStyle(0x6f97bb, 1);
      wall.fillRect(x, 0, 12, 56);
    }
    wall.fillStyle(0xf3e9d2, 1);
    wall.fillRect(0, 56, W, 24);
    wall.lineStyle(1, 0xd8c9a6, 1);
    for (let x = 0; x < W; x += 46) wall.strokeRect(x + 4, 60, 38, 16);
    wall.fillStyle(0x8a5a33, 1);
    wall.fillRect(0, 52, W, 5);
    wall.fillStyle(0x5e3b1e, 1);
    wall.fillRect(0, 76, W, 4);
    wall.fillStyle(0x000000, 0.25);
    wall.fillRect(0, 80, W, 6);
    wall.fillStyle(0x000000, 0.12);
    wall.fillRect(0, 86, W, 6);

    // Windows
    for (const wx of [280, 640]) {
      wall.fillStyle(0x5e3b1e, 1);
      wall.fillRoundedRect(wx - 44, 8, 88, 46, 3);
      wall.fillStyle(0x9fd8ff, 1);
      wall.fillRect(wx - 39, 13, 78, 36);
      wall.fillStyle(0xd5f0ff, 1);
      wall.fillRect(wx - 39, 13, 78, 14);
      wall.fillStyle(0xffffff, 0.8);
      wall.fillEllipse(wx - 15, 22, 22, 7);
      wall.fillEllipse(wx + 12, 28, 18, 6);
      wall.fillStyle(0x5e3b1e, 1);
      wall.fillRect(wx - 1, 13, 3, 36);
      wall.fillRect(wx - 39, 30, 78, 3);
    }

    // Name plaque
    wall.fillStyle(0x000000, 0.25);
    wall.fillRoundedRect(W / 2 - 124, 12, 252, 40, 8);
    wall.fillStyle(0x4a2f17, 1);
    wall.fillRoundedRect(W / 2 - 128, 8, 252, 40, 8);
    wall.lineStyle(2, 0xe9c46a, 1);
    wall.strokeRoundedRect(W / 2 - 124, 12, 244, 32, 6);
    this.add.text(W / 2, 22, 'MAIN ARCADE FLOOR', {
      fontFamily: 'monospace', fontSize: '15px', color: '#ffe9a8', fontStyle: 'bold',
    }).setOrigin(0.5).setDepth(4);
    this.add.text(W / 2, 38, 'WALK · INTERACT · PLAY', {
      fontFamily: 'monospace', fontSize: '9px', color: '#d9c08a',
    }).setOrigin(0.5).setDepth(4);

    // Houseplants in the corners
    for (const [px, py] of [[34, 112], [W - 34, 112], [34, H - 44], [W - 34, H - 44]] as const) {
      this.add.image(px, py, 'plant').setDepth(py);
    }

    // Floating dust motes in the window light
    for (let i = 0; i < 14; i++) {
      const p = this.add.circle(Math.random() * W, 90 + Math.random() * (H - 120), Math.random() * 1.5 + 0.8, 0xfff6d0, 0.35).setDepth(2);
      this.tweens.add({
        targets: p, y: p.y - 60, x: p.x + (Math.random() * 40 - 20), alpha: 0,
        duration: 4000 + Math.random() * 3000, repeat: -1, delay: Math.random() * 2000,
        onRepeat: () => { p.y = 90 + Math.random() * (H - 120); p.x = Math.random() * W; p.alpha = 0.35; },
      });
    }
  }

  /** Green plumbob that bobs and spins above a character. */
  private addPlumbob(x: number, y: number, tint?: number, bob = true): Phaser.GameObjects.Image {
    const pb = this.add.image(x, y, 'plumbob').setDepth(300);
    if (tint !== undefined) pb.setTint(tint);
    if (bob) this.tweens.add({ targets: pb, y: y - 5, duration: 900, yoyo: true, repeat: -1, ease: 'Sine.inOut' });
    this.tweens.add({ targets: pb, scaleX: 0.25, duration: 1100, yoyo: true, repeat: -1, ease: 'Sine.inOut' });
    return pb;
  }

  /** Sims-style mood panel on the wall (top-left). */
  private buildMoodPanel(): void {
    const x = 12, y = 10;
    const g = this.add.graphics().setDepth(200);
    g.fillStyle(0x16324f, 0.92);
    g.fillRoundedRect(x, y, 190, 62, 8);
    g.lineStyle(2, 0xbfe3ff, 0.9);
    g.strokeRoundedRect(x, y, 190, 62, 8);
    const rows: Array<{ label: string; key: 'fun' | 'social' | 'energy'; color: number }> = [
      { label: 'FUN', key: 'fun', color: 0x4ade80 },
      { label: 'SOCIAL', key: 'social', color: 0xfacc15 },
      { label: 'ENERGY', key: 'energy', color: 0x38bdf8 },
    ];
    this.moodBars = this.add.graphics().setDepth(201);
    rows.forEach((r, i) => {
      this.add.text(x + 10, y + 8 + i * 18, r.label, {
        fontFamily: 'monospace', fontSize: '9px', color: '#d6ecff',
      }).setDepth(201);
    });
    this.moodRows = rows;
    this.drawMood();
  }

  private drawMood(): void {
    const x = 12 + 64, y = 10;
    this.moodBars.clear();
    this.moodRows.forEach((r, i) => {
      const by = y + 9 + i * 18;
      this.moodBars.fillStyle(0x0a1a2c, 1).fillRoundedRect(x, by, 112, 9, 3);
      this.moodBars.fillStyle(r.color, 1).fillRoundedRect(x, by, Math.max(4, 112 * (this.mood[r.key] / 100)), 9, 3);
      this.moodBars.fillStyle(0xffffff, 0.3).fillRect(x + 2, by + 1, Math.max(0, 112 * (this.mood[r.key] / 100) - 4), 2);
    });
  }

  private bumpMood(key: 'fun' | 'social' | 'energy', amt: number): void {
    this.mood[key] = Phaser.Math.Clamp(this.mood[key] + amt, 0, 100);
    this.drawMood();
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
      this.add.ellipse(npc.x, npc.y + 28, 28, 10, 0x000000, 0.25).setDepth(19);
      this.addPlumbob(npc.x, npc.y - 58, 0x9be7a8);

      // Name label with background
      const nameBg = this.add.rectangle(npc.x, npc.y - 44, 90, 16, 0x16324f, 0.9).setDepth(20);
      nameBg.setStrokeStyle(1, 0xbfe3ff, 0.8);
      this.add.text(npc.x, npc.y - 44, npc.name, {
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
      const hit = this.add.rectangle(npc.x, npc.y, 45, 64, 0x000000, 0.001)
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
    this.player.body!.setSize(SIM_BODY.w, SIM_BODY.h).setOffset(SIM_BODY.ox, SIM_BODY.oy);
    this.player.setDepth(100);

    // Player shadow
    const shadow = this.add.ellipse(460, 450 + 28, 26, 10, 0x000000, 0.3).setDepth(99);
    this.playerPlumbob = this.addPlumbob(460, 450 - 48, undefined, false);

    // Update shadow position with player
    this.events.on('update', () => {
      shadow.setPosition(this.player.x, this.player.y + 28);
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
    this.bumpMood('fun', 15);
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
    this.bumpMood('social', 15);
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

  update(time: number, delta: number): void {
    if (!this.player?.body) return;

    this.playerPlumbob.setPosition(this.player.x, this.player.y - 48 + Math.sin(time / 280) * 4);
    if (Math.floor(time / 1000) !== Math.floor((time - delta) / 1000)) this.bumpMood('energy', -0.5);

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
