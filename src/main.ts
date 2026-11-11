import Phaser from 'phaser';
import './style.css';
import { ArcadeScene } from './scenes/ArcadeScene';
import { BattleScene } from './scenes/BattleScene';
import { RealmScene } from './scenes/RealmScene';
import { FrontierScene } from './scenes/FrontierScene';

const game = new Phaser.Game({
  type: Phaser.AUTO,
  parent: 'game',
  width: 920,
  height: 520,
  backgroundColor: '#0b0e16',
  pixelArt: true,
  physics: { default: 'arcade', arcade: { debug: false } },
  scale: { mode: Phaser.Scale.FIT, autoCenter: Phaser.Scale.CENTER_BOTH },
  scene: [ArcadeScene, BattleScene, RealmScene, FrontierScene],
  input: { keyboard: { target: window } },
});

// Make canvas focusable
game.events.once(Phaser.Core.Events.READY, () => {
  game.canvas.setAttribute('tabindex', '0');
  game.canvas.style.outline = 'none';
});

(window as any).game = game;
