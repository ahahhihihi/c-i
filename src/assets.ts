/**
 * Improved procedural sprite generation - Sims-style characters, arcade cabinets
 */
import Phaser from 'phaser';

export function ensureTextures(scene: Phaser.Scene): void {
  // Player - Sims style
  if (!scene.textures.exists('player')) makePlayer(scene);

  // NPCs - varied appearances
  const npcStyles = [
    { key: 'npc_warm', skinTone: 0xf5d0c5, hairColor: 0x4a3728, shirtColor: 0xf6b94b },
    { key: 'npc_cool', skinTone: 0xe8beac, hairColor: 0x1a1a1a, shirtColor: 0x42c2ff },
    { key: 'npc_violet', skinTone: 0xd4a574, hairColor: 0x8b4513, shirtColor: 0xa87ffb },
    { key: 'npc_gold', skinTone: 0xf5d0c5, hairColor: 0xdaa520, shirtColor: 0x22c55e },
  ];
  for (const style of npcStyles) {
    if (!scene.textures.exists(style.key)) makeNpc(scene, style.key, style.skinTone, style.hairColor, style.shirtColor);
  }

  // Arcade cabinets - detailed
  const cabinets = [
    { key: 'cabinet_battle', primary: 0xf6b94b, secondary: 0x1a1a2e, accent: 0xffd078 },
    { key: 'cabinet_realm', primary: 0xa87ffb, secondary: 0x1a1a2e, accent: 0xc4a1ff },
    { key: 'cabinet_frontier', primary: 0x42c2ff, secondary: 0x1a1a2e, accent: 0x78d4ff },
  ];
  for (const cab of cabinets) {
    if (!scene.textures.exists(cab.key)) makeCabinet(scene, cab.key, cab.primary, cab.secondary, cab.accent);
  }

  // Exhibit board
  if (!scene.textures.exists('exhibit')) makeExhibit(scene);

  // Floor tiles
  if (!scene.textures.exists('floor_tile')) makeFloorTile(scene);
}

function makePlayer(scene: Phaser.Scene): void {
  const g = scene.add.graphics();
  const w = 32, h = 48;

  // Shadow
  g.fillStyle(0x000000, 0.3);
  g.fillEllipse(w / 2, h - 2, 20, 8);

  // Legs
  g.fillStyle(0x3b5998, 1); // Blue jeans
  g.fillRoundedRect(8, 30, 7, 14, 2);
  g.fillRoundedRect(17, 30, 7, 14, 2);

  // Shoes
  g.fillStyle(0x2d2d2d, 1);
  g.fillRoundedRect(7, 42, 9, 4, 1);
  g.fillRoundedRect(16, 42, 9, 4, 1);

  // Body/torso
  g.fillStyle(0x2563eb, 1); // Blue shirt
  g.fillRoundedRect(6, 18, 20, 16, 3);

  // Arms
  g.fillStyle(0xf5d0c5, 1); // Skin
  g.fillRoundedRect(2, 20, 5, 12, 2); // Left arm
  g.fillRoundedRect(25, 20, 5, 12, 2); // Right arm

  // Hands
  g.fillCircle(4, 33, 3);
  g.fillCircle(28, 33, 3);

  // Neck
  g.fillStyle(0xf5d0c5, 1);
  g.fillRect(13, 14, 6, 5);

  // Head
  g.fillStyle(0xf5d0c5, 1);
  g.fillCircle(16, 10, 9);

  // Hair
  g.fillStyle(0x4a3728, 1);
  g.fillRoundedRect(8, 2, 16, 10, 4);

  // Eyes
  g.fillStyle(0x1a1a1a, 1);
  g.fillCircle(13, 9, 2);
  g.fillCircle(19, 9, 2);

  // Eye highlights
  g.fillStyle(0xffffff, 1);
  g.fillCircle(13.5, 8.5, 0.8);
  g.fillCircle(19.5, 8.5, 0.8);

  // Smile
  g.lineStyle(1, 0xcc6666);
  g.beginPath();
  g.arc(16, 12, 3, 0.2, Math.PI - 0.2);
  g.strokePath();

  g.generateTexture('player', w, h);
  g.destroy();
}

function makeNpc(scene: Phaser.Scene, key: string, skinTone: number, hairColor: number, shirtColor: number): void {
  const g = scene.add.graphics();
  const w = 36, h = 52;

  // Shadow
  g.fillStyle(0x000000, 0.25);
  g.fillEllipse(w / 2, h - 2, 22, 8);

  // Legs
  g.fillStyle(0x2d3748, 1);
  g.fillRoundedRect(9, 34, 8, 14, 2);
  g.fillRoundedRect(19, 34, 8, 14, 2);

  // Shoes
  g.fillStyle(0x1a1a1a, 1);
  g.fillRoundedRect(8, 46, 10, 4, 1);
  g.fillRoundedRect(18, 46, 10, 4, 1);

  // Body
  g.fillStyle(shirtColor, 1);
  g.fillRoundedRect(6, 20, 24, 18, 4);

  // Arms
  g.fillStyle(skinTone, 1);
  g.fillRoundedRect(2, 22, 5, 14, 2);
  g.fillRoundedRect(29, 22, 5, 14, 2);

  // Hands
  g.fillCircle(4, 37, 3);
  g.fillCircle(32, 37, 3);

  // Neck
  g.fillRect(15, 16, 6, 5);

  // Head
  g.fillCircle(18, 10, 10);

  // Hair
  g.fillStyle(hairColor, 1);
  g.fillRoundedRect(8, 1, 20, 12, 5);

  // Sides of hair
  g.fillRect(7, 8, 4, 8);
  g.fillRect(25, 8, 4, 8);

  // Eyes
  g.fillStyle(0x1a1a1a, 1);
  g.fillCircle(14, 10, 2.5);
  g.fillCircle(22, 10, 2.5);

  // Eye whites
  g.fillStyle(0xffffff, 1);
  g.fillCircle(14.5, 9.5, 1);
  g.fillCircle(22.5, 9.5, 1);

  // Eyebrows
  g.lineStyle(1.5, hairColor);
  g.lineBetween(11, 6, 17, 7);
  g.lineBetween(19, 7, 25, 6);

  // Nose
  g.fillStyle(0xd4a574, 1);
  g.fillCircle(18, 13, 1.5);

  // Smile
  g.lineStyle(1.5, 0xcc7777);
  g.beginPath();
  g.arc(18, 14, 4, 0.3, Math.PI - 0.3);
  g.strokePath();

  g.generateTexture(key, w, h);
  g.destroy();
}

function makeCabinet(scene: Phaser.Scene, key: string, primary: number, secondary: number, accent: number): void {
  const g = scene.add.graphics();
  const w = 90, h = 120;

  // Cabinet body - side panels
  g.fillStyle(secondary, 1);
  g.fillRoundedRect(0, 10, w, h - 10, 6);

  // Side panel details
  g.fillStyle(0x0a0a15, 1);
  g.fillRect(2, 20, 6, 80);
  g.fillRect(w - 8, 20, 6, 80);

  // Top marquee light box
  g.fillStyle(primary, 1);
  g.fillRoundedRect(8, 0, w - 16, 25, 4);

  // Marquee inner glow
  g.fillStyle(accent, 0.4);
  g.fillRoundedRect(12, 4, w - 24, 17, 3);

  // Marquee light reflections
  g.fillStyle(0xffffff, 0.3);
  g.fillRect(14, 6, 20, 3);
  g.fillRect(w - 40, 6, 20, 3);

  // Screen bezel
  g.fillStyle(0x0a0a15, 1);
  g.fillRoundedRect(10, 28, w - 20, 50, 3);

  // Screen
  g.fillStyle(0x000510, 1);
  g.fillRoundedRect(14, 32, w - 28, 42, 2);

  // Screen glow/reflection
  g.fillStyle(primary, 0.15);
  g.fillRect(16, 34, w - 32, 20);

  // Scanlines effect
  g.lineStyle(1, 0x000000, 0.3);
  for (let y = 34; y < 72; y += 2) {
    g.lineBetween(16, y, w - 16, y);
  }

  // Control panel base
  g.fillStyle(0x1a1a2e, 1);
  g.fillRoundedRect(8, 82, w - 16, 30, 3);

  // Control panel overlay
  g.fillStyle(secondary, 1);
  g.fillRoundedRect(12, 86, w - 24, 22, 2);

  // Joystick base
  g.fillStyle(0x1a1a1a, 1);
  g.fillCircle(25, 97, 10);
  g.fillStyle(0x2d2d2d, 1);
  g.fillCircle(25, 97, 7);

  // Joystick shaft
  g.fillStyle(0x1a1a1a, 1);
  g.fillCircle(25, 97, 4);

  // Joystick ball
  g.fillStyle(0xe53935, 1);
  g.fillCircle(25, 97, 5);
  g.fillStyle(0xff6659, 0.5);
  g.fillCircle(23, 95, 2);

  // Buttons
  const buttonColors = [primary, 0x22c55e, 0xef4444];
  const buttonX = [50, 62, 74];
  for (let i = 0; i < 3; i++) {
    g.fillStyle(0x1a1a1a, 1);
    g.fillCircle(buttonX[i], 97, 7);
    g.fillStyle(buttonColors[i], 1);
    g.fillCircle(buttonX[i], 97, 5);
    g.fillStyle(0xffffff, 0.3);
    g.fillCircle(buttonX[i] - 1, 95, 1.5);
  }

  // Coin slot
  g.fillStyle(0x0a0a15, 1);
  g.fillRect(w / 2 - 8, 110, 16, 4);
  g.fillStyle(0x2d2d2d, 1);
  g.fillRect(w / 2 - 5, 111, 10, 2);

  // Cabinet feet
  g.fillStyle(0x0a0a15, 1);
  g.fillRect(5, h - 3, 15, 3);
  g.fillRect(w - 20, h - 3, 15, 3);

  g.generateTexture(key, w, h);
  g.destroy();
}

function makeExhibit(scene: Phaser.Scene): void {
  const g = scene.add.graphics();
  const w = 100, h = 80;

  // Shadow
  g.fillStyle(0x000000, 0.3);
  g.fillRoundedRect(4, 4, w, h, 4);

  // Board frame - wood grain effect
  g.fillStyle(0x5c4033, 1);
  g.fillRoundedRect(0, 0, w, h, 4);

  // Wood grain lines
  g.lineStyle(1, 0x4a3528, 0.5);
  for (let y = 5; y < h - 5; y += 8) {
    g.lineBetween(5, y, w - 5, y + 2);
  }

  // Inner frame
  g.fillStyle(0x3d2817, 1);
  g.fillRoundedRect(6, 6, w - 12, h - 12, 2);

  // Content area (canvas/matting)
  g.fillStyle(0xf5f5dc, 1);
  g.fillRoundedRect(10, 10, w - 20, h - 24, 2);

  // Header plaque
  g.fillStyle(0xd4a559, 1);
  g.fillRoundedRect(15, h - 18, w - 30, 12, 2);

  // Plaque shine
  g.fillStyle(0xffd078, 0.3);
  g.fillRect(17, h - 16, w - 36, 3);

  // Mounting brackets
  g.fillStyle(0x8b7355, 1);
  g.fillRect(10, 3, 8, 6);
  g.fillRect(w - 18, 3, 8, 6);

  g.generateTexture('exhibit', w, h);
  g.destroy();
}

function makeFloorTile(scene: Phaser.Scene): void {
  const g = scene.add.graphics();
  const w = 64, h = 64;

  // Base tile
  g.fillStyle(0x1a1f2e, 1);
  g.fillRect(0, 0, w, h);

  // Subtle pattern
  g.fillStyle(0x1f2937, 1);
  g.fillRect(0, 0, 32, 32);
  g.fillRect(32, 32, 32, 32);

  // Grid lines
  g.lineStyle(1, 0x2d3748, 0.5);
  g.lineBetween(0, 32, w, 32);
  g.lineBetween(32, 0, 32, h);

  g.generateTexture('floor_tile', w, h);
  g.destroy();
}

export function createAnimations(scene: Phaser.Scene): void {
  // Walking animation would go here if we had multiple frames
  // For now, just ensure player texture exists
}
