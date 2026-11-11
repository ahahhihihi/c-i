/**
 * Procedural sprite generation - no external assets needed
 */
import Phaser from 'phaser';

export function ensureTextures(scene: Phaser.Scene): void {
  // Player frames
  if (!scene.textures.exists('player_idle')) makePlayerFrame(scene, 'player_idle', 0);
  if (!scene.textures.exists('player_walk')) makePlayerFrame(scene, 'player_walk', 1);

  // NPC frames (3 variants)
  const npcStyles = [
    { key: 'npc_warm', body: 0xf6b94b, head: 0xffe4c4 },
    { key: 'npc_cool', body: 0x42c2ff, head: 0xffe4c4 },
    { key: 'npc_violet', body: 0xa87ffb, head: 0xffe4c4 },
  ];
  for (const style of npcStyles) {
    if (!scene.textures.exists(style.key)) makeNpcFrame(scene, style.key, style.body, style.head);
  }

  // Arcade machine cabinets (3 colors)
  const cabinets = [
    { key: 'cabinet_battle', color: 0xf6b94b },
    { key: 'cabinet_realm', color: 0xa87ffb },
    { key: 'cabinet_frontier', color: 0x42c2ff },
  ];
  for (const cab of cabinets) {
    if (!scene.textures.exists(cab.key)) makeCabinetFrame(scene, cab.key, cab.color);
  }

  // Exhibit board
  if (!scene.textures.exists('exhibit')) makeExhibitFrame(scene);
}

function makePlayerFrame(scene: Phaser.Scene, key: string, frame: number): void {
  const g = scene.add.graphics();
  g.fillStyle(0x0b0e16, 0.5);
  g.fillEllipse(14, 30, 18, 6); // shadow

  // Body
  g.fillStyle(0x4a5568, 1);
  g.fillRoundedRect(6, 10, 16, 14, 3);

  // Head
  g.fillStyle(0xffe4c4, 1);
  g.fillCircle(14, 8, 5);

  // Eyes
  g.fillStyle(0x1a202c, 1);
  g.fillRect(11, 7, 2, 2);
  g.fillRect(15, 7, 2, 2);

  // Legs (alternate based on frame)
  g.fillStyle(0x2d3748, 1);
  if (frame === 0) {
    g.fillRect(8, 24, 5, 6);
    g.fillRect(15, 24, 5, 6);
  } else {
    g.fillRect(6, 24, 5, 6);
    g.fillRect(17, 24, 5, 6);
  }

  g.generateTexture(key, 28, 32);
  g.destroy();
}

function makeNpcFrame(scene: Phaser.Scene, key: string, bodyColor: number, headColor: number): void {
  const g = scene.add.graphics();
  g.fillStyle(0x0b0e16, 0.4);
  g.fillEllipse(18, 42, 22, 8);

  // Body
  g.fillStyle(bodyColor, 1);
  g.fillRoundedRect(5, 18, 26, 20, 4);

  // Head
  g.fillStyle(headColor, 1);
  g.fillCircle(18, 12, 9);

  // Face
  g.fillStyle(0x1a202c, 1);
  g.fillRect(14, 10, 3, 3);
  g.fillRect(20, 10, 3, 3);

  // Smile
  g.lineStyle(1, 0x1a202c);
  g.beginPath();
  g.arc(18, 14, 4, 0.2, Math.PI - 0.2);
  g.strokePath();

  g.generateTexture(key, 36, 46);
  g.destroy();
}

function makeCabinetFrame(scene: Phaser.Scene, key: string, color: number): void {
  const g = scene.add.graphics();

  // Cabinet body
  g.fillStyle(0x1a1f2e, 1);
  g.fillRoundedRect(2, 2, 76, 98, 6);

  // Screen bezel
  g.fillStyle(0x0d1019, 1);
  g.fillRoundedRect(8, 8, 64, 48, 4);

  // Screen glow
  g.fillStyle(color, 0.15);
  g.fillRoundedRect(10, 10, 60, 44, 3);

  // Marquee (top light)
  g.fillStyle(color, 1);
  g.fillRoundedRect(12, 4, 56, 12, 2);

  // Control panel
  g.fillStyle(0x2d3748, 1);
  g.fillRect(12, 62, 56, 30);

  // Joystick
  g.fillStyle(0x1a202c, 1);
  g.fillCircle(24, 78, 6);
  g.fillStyle(0x4a5568, 1);
  g.fillCircle(24, 78, 3);

  // Buttons
  g.fillStyle(color, 1);
  g.fillCircle(50, 72, 5);
  g.fillCircle(62, 76, 4);

  g.generateTexture(key, 80, 102);
  g.destroy();
}

function makeExhibitFrame(scene: Phaser.Scene): void {
  const g = scene.add.graphics();

  // Board frame
  g.fillStyle(0x1a1f2e, 1);
  g.fillRoundedRect(0, 0, 90, 70, 4);

  // Content area
  g.fillStyle(0x0d1019, 1);
  g.fillRoundedRect(6, 6, 78, 50, 2);

  // Header bar
  g.fillStyle(0x2d3748, 1);
  g.fillRect(6, 6, 78, 14);

  // Accent line
  g.fillStyle(0xffd078, 1);
  g.fillRect(6, 58, 78, 3);

  // Label
  g.fillStyle(0xffd078, 1);
  g.fillCircle(45, 42, 8);

  g.generateTexture('exhibit', 90, 70);
  g.destroy();
}

/**
 * Make animations for player
 */
export function createAnimations(scene: Phaser.Scene): void {
  if (!scene.anims.exists('player_walk')) {
    scene.anims.create({
      key: 'player_walk',
      frames: [
        { key: 'player_idle' },
        { key: 'player_walk' },
      ],
      frameRate: 6,
      repeat: -1,
    });
  }
}
