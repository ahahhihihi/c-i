import Phaser from 'phaser';
import '@fontsource/bungee/400.css';
import '@fontsource/space-grotesk/400.css';
import '@fontsource/space-grotesk/600.css';
import '@fontsource/space-grotesk/700.css';
import '@fontsource/dm-mono/400.css';
import '@fontsource/dm-mono/500.css';
import './style.css';
import { ArcadeScene } from './scenes/ArcadeScene';
import { BattleScene } from './scenes/BattleScene';
import { RealmScene } from './scenes/RealmScene';
import { FrontierScene } from './scenes/FrontierScene';
import { ClawScene } from './scenes/ClawScene';
import { installCrispText, installUiZoom, toggleFullscreen } from './view';
import { audio } from './audio';

installCrispText();
installUiZoom();

// Browsers only allow sound after a user gesture
const unlock = () => audio.start();
window.addEventListener('pointerdown', unlock);
window.addEventListener('keydown', unlock);

async function boot(): Promise<void> {
  // Canvas text needs fonts loaded before the first frame, or it falls back
  await Promise.all([
    '24px "Bungee"', '16px "Space Grotesk"', 'bold 16px "Space Grotesk"', '16px "DM Mono"',
  ].map(f => document.fonts.load(f).catch(() => undefined)));

  const game = new Phaser.Game({
    type: Phaser.AUTO,
    parent: 'game',
    width: '100%',
    height: '100%',
    backgroundColor: '#07060f',
    antialias: true,
    roundPixels: false,
    physics: { default: 'arcade', arcade: { debug: false } },
    scale: { mode: Phaser.Scale.RESIZE, autoCenter: Phaser.Scale.NO_CENTER },
    scene: [ArcadeScene, BattleScene, RealmScene, FrontierScene, ClawScene],
    input: { keyboard: { target: window } },
  });

  game.events.once(Phaser.Core.Events.READY, () => {
    game.canvas.setAttribute('tabindex', '0');
    game.canvas.style.outline = 'none';
  });

  (window as any).game = game;
}

// Fullscreen for presenting: corner button, or press F
document.getElementById('fullscreen-btn')?.addEventListener('click', toggleFullscreen);
window.addEventListener('keydown', (e) => {
  if ((e.key === 'f' || e.key === 'F') && !e.ctrlKey && !e.metaKey && !e.altKey) toggleFullscreen();
});

void boot();
