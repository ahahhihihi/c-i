/**
 * Full-window rendering. The canvas matches the window size, and each scene
 * zooms its fixed 920x520 layout to fit. Everything is drawn as vectors or
 * supersampled textures, so it stays sharp at any size.
 */
import Phaser from 'phaser';

export const WORLD_W = 920;
export const WORLD_H = 520;

/** Zoom that fits the world inside a viewport. */
export function fitZoom(width: number, height: number): number {
  return Math.min(width / WORLD_W, height / WORLD_H);
}

/** Render text at a higher internal resolution so it stays crisp when zoomed. */
export function installCrispText(): void {
  const dpr = window.devicePixelRatio || 1;
  const zoom = fitZoom(window.screen.width, window.screen.height);
  const res = Math.min(4, Math.max(2, Math.ceil(zoom * dpr)));
  const proto = Phaser.GameObjects.GameObjectFactory.prototype as any;
  const original = proto.text;
  proto.text = function (...args: unknown[]) {
    const t = original.apply(this, args);
    t.setResolution(res);
    return t;
  };
}

/** Call at the start of a scene's create(). Keeps the world centred and fitted. */
export function fitToScreen(scene: Phaser.Scene): void {
  const apply = () => {
    const { width, height } = scene.scale;
    const cam = scene.cameras.main;
    cam.setZoom(fitZoom(width, height));
    cam.centerOn(WORLD_W / 2, WORLD_H / 2);
  };
  apply();
  scene.scale.on('resize', apply);
  scene.events.once(Phaser.Scenes.Events.SHUTDOWN, () => scene.scale.off('resize', apply));
}

/** Scales modals to the window so they read from across a room. */
export function installUiZoom(): void {
  const apply = () => {
    const z = Phaser.Math.Clamp(Math.min(window.innerWidth / 1100, window.innerHeight / 700), 1, 2);
    document.documentElement.style.setProperty('--ui-zoom', z.toFixed(3));
  };
  apply();
  window.addEventListener('resize', apply);
}

export function toggleFullscreen(): void {
  if (document.fullscreenElement) void document.exitFullscreen();
  else void document.documentElement.requestFullscreen?.();
}
