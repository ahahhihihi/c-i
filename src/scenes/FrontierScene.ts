import Phaser from 'phaser';
import { audio } from '../audio';
import { showModal, closeModal } from '../ui/modals';

const W = 920, H = 520;

type Resource = { wood: number; food: number; stone: number };
type Workers = { wood: number; food: number; stone: number };

export class FrontierScene extends Phaser.Scene {
  private resources: Resource = { wood: 12, food: 14, stone: 6 };
  private workers: Workers = { wood: 2, food: 3, stone: 1 };
  private totalWorkers = 6;
  private maxWorkers = 12;

  private round = 1;
  private maxRounds = 3;
  private raidCountdown = 30;

  private buildings: { type: 'farm' | 'palisade'; x: number; y: number }[] = [];

  private resourceText!: Phaser.GameObjects.Text;
  private roundText!: Phaser.GameObjects.Text;
  private countdownText!: Phaser.GameObjects.Text;
  private statusText!: Phaser.GameObjects.Text;

  private gameOver = false;
  private paused = false;

  constructor() { super('Frontier'); }

  create(): void {
    audio.sfx('click');
    this.gameOver = false;
    this.paused = false;
    this.round = 1;
    this.raidCountdown = 30;
    this.buildings = [];
    this.resources = { wood: 12, food: 14, stone: 6 };
    this.workers = { wood: 2, food: 3, stone: 1 };
    this.totalWorkers = 6;

    this.buildUI();
    this.buildWorkerControls();
    this.buildActionButtons();

    // Countdown timer
    this.time.addEvent({
      delay: 1000,
      callback: this.tick,
      callbackScope: this,
      loop: true,
    });
  }

  private buildUI(): void {
    // Gradient background - wilderness
    const bg = this.add.graphics();
    bg.fillGradientStyle(0x0d1117, 0x0d1117, 0x151f2e, 0x151f2e, 1);
    bg.fillRect(0, 0, W, H);

    // Resource panel
    const resourcePanel = this.add.graphics();
    resourcePanel.fillStyle(0x1f2937, 1);
    resourcePanel.fillRoundedRect(10, 10, 290, 90, 6);
    resourcePanel.lineStyle(1, 0x22c55e, 0.3);
    resourcePanel.strokeRoundedRect(10, 10, 290, 90, 6);

    this.add.text(20, 20, 'RESOURCES', { fontFamily: 'monospace', fontSize: '10px', color: '#22c55e' });

    this.resourceText = this.add.text(30, 40, '', {
      fontFamily: 'monospace', fontSize: '11px', color: '#ffd078', lineSpacing: 6,
    });
    this.updateResourceDisplay();

    // Round info panel
    const roundPanel = this.add.graphics();
    roundPanel.fillStyle(0x1f2937, 1);
    roundPanel.fillRoundedRect(W - 220, 10, 210, 90, 6);
    roundPanel.lineStyle(1, 0xef4444, 0.3);
    roundPanel.strokeRoundedRect(W - 220, 10, 210, 90, 6);

    this.roundText = this.add.text(W - 200, 20, 'ROUND 1 / 3', {
      fontFamily: 'monospace', fontSize: '12px', color: '#ffd078',
    });

    this.countdownText = this.add.text(W - 200, 45, 'NEXT RAID: 30s', {
      fontFamily: 'monospace', fontSize: '11px', color: '#ef4444',
    });

    this.statusText = this.add.text(W - 200, 70, 'Workers: 6 / 12', {
      fontFamily: 'monospace', fontSize: '10px', color: '#8b8d9a',
    });

    // Settlement visualization - grass/ground
    const ground = this.add.graphics();
    ground.fillGradientStyle(0x1a2e1a, 0x1a2e1a, 0x1f331a, 0x1f331a, 1);
    ground.fillRoundedRect(W / 2 - 310, H / 2 - 50, 620, 220, 8);

    // Settlement fence outline
    ground.lineStyle(2, 0x5c4033, 0.6);
    ground.strokeRoundedRect(W / 2 - 300, H / 2 - 40, 600, 200, 6);

    // Buildings area label
    this.add.text(W / 2, H / 2 - 60, 'SETTLEMENT', {
      fontFamily: 'monospace', fontSize: '10px', color: '#22c55e',
    }).setOrigin(0.5);

    this.renderBuildings();
  }

  private buildWorkerControls(): void {
    const startY = 180;
    const labels = ['WOOD', 'FOOD', 'STONE'];

    for (let i = 0; i < 3; i++) {
      const y = startY + i * 50;
      const res = ['wood', 'food', 'stone'][i] as keyof Workers;

      // Label
      this.add.text(40, y, labels[i], { fontFamily: 'monospace', fontSize: '11px', color: '#c4d0e6' });

      // Minus button
      const minusBtn = this.add.text(130, y - 5, '−', {
        fontFamily: 'monospace', fontSize: '18px', color: '#ef4444', backgroundColor: '#1f2937', padding: { x: 10, y: 2 },
      }).setInteractive({ useHandCursor: true });

      minusBtn.on('pointerdown', () => this.adjustWorker(res, -1));

      // Count
      const countText = this.add.text(160, y, `${this.workers[res]}`, {
        fontFamily: 'monospace', fontSize: '14px', color: '#ffd078',
      });

      // Plus button
      const plusBtn = this.add.text(190, y - 5, '+', {
        fontFamily: 'monospace', fontSize: '18px', color: '#22c55e', backgroundColor: '#1f2937', padding: { x: 10, y: 2 },
      }).setInteractive({ useHandCursor: true });

      plusBtn.on('pointerdown', () => this.adjustWorker(res, 1));

      // Store reference for updates
      (this as any)[`${res}CountText`] = countText;
    }
  }

  private buildActionButtons(): void {
    // Build Farm button
    const farmBtn = this.add.text(40, 360, 'BUILD FARM (5 wood)', {
      fontFamily: 'monospace', fontSize: '11px', color: '#22c55e',
      backgroundColor: '#1f2937', padding: { x: 10, y: 6 },
    }).setInteractive({ useHandCursor: true });

    farmBtn.on('pointerdown', () => this.buildStructure('farm'));
    farmBtn.on('pointerover', () => farmBtn.setColor('#4ade80'));
    farmBtn.on('pointerout', () => farmBtn.setColor('#22c55e'));

    // Build Palisade button
    const palisadeBtn = this.add.text(200, 360, 'BUILD PALISADE (8 stone)', {
      fontFamily: 'monospace', fontSize: '11px', color: '#60a5fa',
      backgroundColor: '#1f2937', padding: { x: 10, y: 6 },
    }).setInteractive({ useHandCursor: true });

    palisadeBtn.on('pointerdown', () => this.buildStructure('palisade'));
    palisadeBtn.on('pointerover', () => palisadeBtn.setColor('#93c5fd'));
    palisadeBtn.on('pointerout', () => palisadeBtn.setColor('#60a5fa'));

    // Recruit Worker button
    const recruitBtn = this.add.text(400, 360, 'RECRUIT WORKER (10 food)', {
      fontFamily: 'monospace', fontSize: '11px', color: '#f6b94b',
      backgroundColor: '#1f2937', padding: { x: 10, y: 6 },
    }).setInteractive({ useHandCursor: true });

    recruitBtn.on('pointerdown', () => this.recruitWorker());
    recruitBtn.on('pointerover', () => recruitBtn.setColor('#fcd34d'));
    recruitBtn.on('pointerout', () => recruitBtn.setColor('#f6b94b'));

    // Speed up button (shows monetization mechanic)
    const speedBtn = this.add.text(600, 360, '⚡ SPEED UP RAID', {
      fontFamily: 'monospace', fontSize: '11px', color: '#a87ffb',
      backgroundColor: '#1f2937', padding: { x: 10, y: 6 },
    }).setInteractive({ useHandCursor: true });

    speedBtn.on('pointerdown', () => {
      audio.sfx('click');
      this.statusText.setText('Speed-up purchased! (simulated)');
      this.time.delayedCall(2000, () => this.updateStatus());
    });

    // End Round button
    const endBtn = this.add.text(40, 400, 'END ROUND', {
      fontFamily: 'monospace', fontSize: '12px', color: '#ffd078',
      backgroundColor: '#374151', padding: { x: 14, y: 8 },
    }).setInteractive({ useHandCursor: true });

    endBtn.on('pointerdown', () => this.endRound());

    // ESC to pause
    this.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.ESC)
      .on('down', () => this.showPause());
  }

  private adjustWorker(type: keyof Workers, delta: number): void {
    const newTotal = this.totalWorkers + delta;
    if (newTotal < 0 || newTotal > this.maxWorkers) return;

    const newVal = this.workers[type] + delta;
    if (newVal < 0) return;

    this.workers[type] = newVal;
    this.totalWorkers = newTotal;

    // Update display
    (this as any)[`${type}CountText`]?.setText(`${this.workers[type]}`);
    this.updateStatus();
    audio.sfx('click');
  }

  private buildStructure(type: 'farm' | 'palisade'): void {
    if (type === 'farm' && this.resources.wood >= 5) {
      this.resources.wood -= 5;
      this.buildings.push({ type: 'farm', x: 300 + this.buildings.length * 80, y: H / 2 + 60 });
      audio.sfx('click');
    } else if (type === 'palisade' && this.resources.stone >= 8) {
      this.resources.stone -= 8;
      this.buildings.push({ type: 'palisade', x: 300 + this.buildings.length * 80, y: H / 2 + 60 });
      audio.sfx('click');
    }

    this.updateResourceDisplay();
    this.renderBuildings();
  }

  private recruitWorker(): void {
    if (this.resources.food >= 10 && this.totalWorkers < this.maxWorkers) {
      this.resources.food -= 10;
      this.totalWorkers++;
      this.workers.food++; // Auto-assign to food
      this.updateResourceDisplay();
      this.updateStatus();
      audio.sfx('click');
    }
  }

  private renderBuildings(): void {
    this.buildings.forEach(b => {
      const gfx = this.add.graphics();

      if (b.type === 'farm') {
        // Farm house
        gfx.fillStyle(0x8b4513, 1);
        gfx.fillRoundedRect(b.x - 25, b.y - 10, 50, 30, 3);

        // Roof
        gfx.fillStyle(0xa0522d, 1);
        gfx.fillTriangle(b.x - 30, b.y - 10, b.x, b.y - 30, b.x + 30, b.y - 10);

        // Door
        gfx.fillStyle(0x5c4033, 1);
        gfx.fillRect(b.x - 6, b.y + 5, 12, 15);

        // Field crops
        gfx.fillStyle(0x22c55e, 0.8);
        for (let i = 0; i < 3; i++) {
          gfx.fillRect(b.x - 20 + i * 15, b.y + 25, 10, 15);
        }

        this.add.text(b.x, b.y - 5, '🌾', { fontSize: '12px' }).setOrigin(0.5);
      } else {
        // Palisade wall
        gfx.fillStyle(0x5c4033, 1);
        gfx.fillRect(b.x - 25, b.y - 20, 8, 50);
        gfx.fillRect(b.x - 10, b.y - 25, 8, 55);
        gfx.fillRect(b.x + 5, b.y - 25, 8, 55);
        gfx.fillRect(b.x + 20, b.y - 20, 8, 50);

        // Pointed tops
        gfx.fillStyle(0x4a3528, 1);
        gfx.fillTriangle(b.x - 21, b.y - 20, b.x - 17, b.y - 30, b.x - 13, b.y - 20);
        gfx.fillTriangle(b.x - 6, b.y - 25, b.x - 2, b.y - 35, b.x + 2, b.y - 25);
        gfx.fillTriangle(b.x + 9, b.y - 25, b.x + 13, b.y - 35, b.x + 17, b.y - 25);
        gfx.fillTriangle(b.x + 24, b.y - 20, b.x + 28, b.y - 30, b.x + 32, b.y - 20);

        this.add.text(b.x, b.y - 10, '🛡️', { fontSize: '12px' }).setOrigin(0.5);
      }
    });
  }

  private tick(): void {
    if (this.gameOver || this.paused) return;

    this.raidCountdown--;

    if (this.raidCountdown <= 0) {
      this.raid();
    } else {
      this.countdownText.setText(`NEXT RAID: ${this.raidCountdown}s`);
    }

    // Resource generation based on workers
    this.resources.wood += this.workers.wood * 0.5;
    this.resources.food += this.workers.food * 0.8;
    this.resources.stone += this.workers.stone * 0.3;

    this.updateResourceDisplay();
  }

  private raid(): void {
    const farms = this.buildings.filter(b => b.type === 'farm').length;
    const palisades = this.buildings.filter(b => b.type === 'palisade').length;

    const raidPower = 10 + this.round * 5;
    const defense = palisades * 8;
    const damage = Math.max(0, raidPower - defense);

    // Food consumed
    const foodNeeded = this.totalWorkers * 2;
    if (this.resources.food < foodNeeded) {
      // Starvation debuff
      this.statusText.setText('STARVATION! Workers weak');
    } else {
      this.resources.food -= foodNeeded;
    }

    // Apply damage
    if (damage > 0) {
      this.resources.wood = Math.max(0, this.resources.wood - damage);
      this.statusText.setText(`Raid! Lost ${damage} resources`);
    } else {
      this.statusText.setText('Raid repelled by defenses!');
    }

    audio.sfx('hit');
    this.updateResourceDisplay();

    // Check round end
    if (this.round >= this.maxRounds) {
      this.victory();
    } else {
      this.round++;
      this.raidCountdown = 30;
      this.roundText.setText(`ROUND ${this.round} / ${this.maxRounds}`);
    }
  }

  private endRound(): void {
    this.raidCountdown = 0;
  }

  private updateResourceDisplay(): void {
    this.resourceText.setText(
      `Wood: ${Math.floor(this.resources.wood)}\n` +
      `Food: ${Math.floor(this.resources.food)}\n` +
      `Stone: ${Math.floor(this.resources.stone)}`
    );
  }

  private updateStatus(): void {
    this.statusText.setText(`Workers: ${this.totalWorkers} / ${this.maxWorkers}`);
  }

  private victory(): void {
    this.gameOver = true;

    showModal({
      kicker: 'VICTORY',
      title: 'Settlement Survived!',
      body: `<p>You survived ${this.maxRounds} raid waves.</p><p>Resources: Wood ${Math.floor(this.resources.wood)}, Food ${Math.floor(this.resources.food)}, Stone ${Math.floor(this.resources.stone)}</p>`,
      actions: [{ label: 'Return to Arcade', onClick: () => { closeModal(); this.scene.start('Arcade'); } }],
    });
  }

  private showPause(): void {
    this.paused = true;
    this.scene.pause();

    showModal({
      kicker: 'PAUSED',
      title: 'Frontier Settlement',
      body: '<p>Press Resume to continue.</p>',
      actions: [
        { label: 'Resume', onClick: () => { closeModal(); this.paused = false; this.scene.resume(); } },
        { label: 'Quit', kind: 'ghost', onClick: () => { closeModal(); this.scene.start('Arcade'); } },
      ],
    });
  }

  update(): void {
    // Real-time updates handled by timer events
  }
}
