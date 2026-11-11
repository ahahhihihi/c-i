/**
 * Ambient audio system with procedural sounds
 */

type AudioMode = 'arcade' | 'battle' | 'realm' | 'frontier';

class AmbientAudio {
  private ctx: AudioContext | null = null;
  private master: GainNode | null = null;
  private sfxGain: GainNode | null = null;
  private muted = false;
  private started = false;

  start(): void {
    if (this.started) return;
    this.started = true;
    try {
      this.ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
      this.master = this.ctx.createGain();
      this.master.gain.value = this.muted ? 0 : 0.08;
      this.master.connect(this.ctx.destination);

      this.sfxGain = this.ctx.createGain();
      this.sfxGain.gain.value = 0.5;
      this.sfxGain.connect(this.master);
    } catch (e) {
      console.warn('Audio unavailable');
    }
  }

  sfx(type: 'click' | 'hit' | 'collect' | 'win' | 'lose'): void {
    if (!this.ctx || !this.sfxGain || this.muted) return;
    const now = this.ctx.currentTime;

    const osc = this.ctx.createOscillator();
    const g = this.ctx.createGain();
    osc.connect(g);
    g.connect(this.sfxGain);

    const freqs: Record<string, number> = {
      click: 800,
      hit: 200,
      collect: 1200,
      win: 600,
      lose: 150,
    };

    osc.frequency.value = freqs[type] || 400;
    osc.type = type === 'hit' ? 'square' : 'sine';

    g.gain.setValueAtTime(0.3, now);
    g.gain.setValueAtTime(0.01, now + 0.1);

    osc.start(now);
    osc.stop(now + 0.15);
  }

  toggleMute(): boolean {
    this.muted = !this.muted;
    if (this.master) this.master.gain.value = this.muted ? 0 : 0.08;
    return this.muted;
  }

  isMuted(): boolean { return this.muted; }
}

export const audio = new AmbientAudio();
