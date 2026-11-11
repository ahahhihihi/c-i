/**
 * Improved procedural sprite generation - Sims-style characters, arcade cabinets
 */
import Phaser from 'phaser';
import { TEX_SCALE, makeSim, makePlumbob, makeWoodFloor, makePlant, type SimLook } from './sims';

export function ensureTextures(scene: Phaser.Scene): void {
  // Sims-style characters
  makePlumbob(scene);
  makeWoodFloor(scene);
  makePlant(scene);
  const looks: Record<string, SimLook> = {
    player:     { skin: 0xf0c9a8, hair: 0x5a3a22, hairStyle: 'short', top: 0x2f80ed, bottom: 0x3b4a6b, eye: 0x3a7bd5 },
    npc_warm:   { skin: 0xe9b896, hair: 0x2a1c14, hairStyle: 'long',  top: 0xf2a33a, bottom: 0x4a3b52, eye: 0x6b4423 },
    npc_cool:   { skin: 0xc68e66, hair: 0x15151a, hairStyle: 'short', top: 0x27b5e8, bottom: 0x2d3748, eye: 0x2a2a2a },
    npc_violet: { skin: 0x8d5a3b, hair: 0x3b1f4d, hairStyle: 'bun',   top: 0x9b6bf2, bottom: 0x3a3556, eye: 0x4b2a1a },
    npc_gold:   { skin: 0xf6d5bd, hair: 0xe0a82e, hairStyle: 'curly', top: 0x2fbf71, bottom: 0x364152, eye: 0x2f9e6e },
  };
  for (const [key, look] of Object.entries(looks)) {
    if (!scene.textures.exists(key)) makeSim(scene, key, look);
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

function makeCabinet(scene: Phaser.Scene, key: string, primary: number, secondary: number, accent: number): void {
  const g = scene.add.graphics().setScale(TEX_SCALE);
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

  g.generateTexture(key, w * TEX_SCALE, h * TEX_SCALE);
  g.destroy();
}

function makeExhibit(scene: Phaser.Scene): void {
  const g = scene.add.graphics().setScale(TEX_SCALE);
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

  g.generateTexture('exhibit', w * TEX_SCALE, h * TEX_SCALE);
  g.destroy();
}

function makeFloorTile(scene: Phaser.Scene): void {
  const g = scene.add.graphics().setScale(TEX_SCALE);
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
