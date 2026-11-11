import Phaser from 'phaser';
import './style.css';
import { ArcadeScene } from './scenes/ArcadeScene';
import { BattleScene } from './scenes/BattleScene';
import { RealmScene } from './scenes/RealmScene';
import { FrontierScene } from './scenes/FrontierScene';
import { installCrispText, installUiZoom, toggleFullscreen } from './view';

installCrispText();
installUiZoom();

const game = new Phaser.Game({
  type: Phaser.AUTO,
  parent: 'game',
  width: '100%',
  height: '100%',
  backgroundColor: '#0b0e16',
  antialias: true,
  roundPixels: false,
  physics: { default: 'arcade', arcade: { debug: false } },
  scale: { mode: Phaser.Scale.RESIZE, autoCenter: Phaser.Scale.NO_CENTER },
  scene: [ArcadeScene, BattleScene, RealmScene, FrontierScene],
  input: { keyboard: { target: window } },
});

// Make canvas focusable
game.events.once(Phaser.Core.Events.READY, () => {
  game.canvas.setAttribute('tabindex', '0');
  game.canvas.style.outline = 'none';
});

// Fullscreen for presenting: button in the top bar, or press F
document.getElementById('fullscreen-btn')?.addEventListener('click', toggleFullscreen);
window.addEventListener('keydown', (e) => {
  if ((e.key === 'f' || e.key === 'F') && !e.ctrlKey && !e.metaKey && !e.altKey) toggleFullscreen();
});

(window as any).game = game;
