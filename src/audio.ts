/**
 * Procedural sound: effects and a quiet background loop per area.
 * Everything is synthesised with Web Audio, so there are no audio files.
 * The audio context starts on the first click or key press (browser rule).
 */

export type AudioMode = 'arcade' | 'battle' | 'realm' | 'frontier' | 'none';
export type Sfx =
  | 'click' | 'hit' | 'crit' | 'collect' | 'coin' | 'win' | 'lose' | 'whoosh'
  | 'alert' | 'build' | 'error' | 'special' | 'claw' | 'drop' | 'open' | 'step';

// Chord roots (MIDI) and tempo per mode
const MUSIC: Record<Exclude<AudioMode, 'none'>, { bpm: number; prog: number[][]; wave: OscillatorType; arp: number[] }> = {
  arcade:   { bpm: 96,  prog: [[57, 60, 64], [53, 57, 60], [48, 52, 55], [55, 59, 62]], wave: 'triangle', arp: [0, 1, 2, 1, 2, 0, 1, 2] },
  battle:   { bpm: 132, prog: [[52, 55, 59], [48, 52, 55], [50, 53, 57], [47, 50, 54]], wave: 'square',   arp: [0, 2, 1, 2, 0, 2, 1, 2] },
  realm:    { bpm: 72,  prog: [[50, 57, 62], [46, 53, 58], [48, 55, 60], [45, 52, 57]], wave: 'sine',     arp: [0, 1, 2, 1, 0, 2, 1, 2] },
  frontier: { bpm: 100, prog: [[55, 59, 62], [52, 55, 59], [48, 52, 55], [50, 55, 59]], wave: 'triangle', arp: [0, 2, 1, 2, 0, 1, 2, 1] },
};

const midi = (n: number) => 440 * Math.pow(2, (n - 69) / 12);

class SoundSystem {
  private ctx: AudioContext | null = null;
  private master: GainNode | null = null;
  private sfxBus: GainNode | null = null;
  private musicBus: GainNode | null = null;
  private noise: AudioBuffer | null = null;
  private muted = localStorage.getItem('sound-muted') === '1';
  private mode: AudioMode = 'none';
  private step = 0;
  private nextTime = 0;
  private timer: number | null = null;

  /** Called on the first user gesture. Safe to call repeatedly. */
  start(): void {
    if (this.ctx) { void this.ctx.resume(); return; }
    try {
      this.ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
    } catch {
      return;
    }
    const ctx = this.ctx;
    this.master = ctx.createGain();
    this.master.gain.value = this.muted ? 0 : 0.5;
    const comp = ctx.createDynamicsCompressor();
    this.master.connect(comp).connect(ctx.destination);
    this.sfxBus = ctx.createGain();
    this.sfxBus.gain.value = 0.55;
    this.sfxBus.connect(this.master);
    this.musicBus = ctx.createGain();
    this.musicBus.gain.value = 0.12;
    this.musicBus.connect(this.master);

    this.noise = ctx.createBuffer(1, ctx.sampleRate * 0.5, ctx.sampleRate);
    const d = this.noise.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;

    this.nextTime = ctx.currentTime + 0.1;
    this.timer = window.setInterval(() => this.schedule(), 50);
  }

  /** Switch the background loop. */
  setMode(mode: AudioMode): void {
    if (this.mode === mode) return;
    this.mode = mode;
    this.step = 0;
  }

  toggleMute(): boolean {
    this.muted = !this.muted;
    localStorage.setItem('sound-muted', this.muted ? '1' : '0');
    if (this.master && this.ctx) this.master.gain.setTargetAtTime(this.muted ? 0 : 0.5, this.ctx.currentTime, 0.05);
    return this.muted;
  }

  isMuted(): boolean { return this.muted; }

  private tone(freq: number, dur: number, opts: { type?: OscillatorType; vol?: number; to?: number; at?: number; bus?: GainNode } = {}): void {
    if (!this.ctx) return;
    const t = this.ctx.currentTime + (opts.at ?? 0);
    const o = this.ctx.createOscillator();
    const g = this.ctx.createGain();
    o.type = opts.type ?? 'sine';
    o.frequency.setValueAtTime(freq, t);
    if (opts.to) o.frequency.exponentialRampToValueAtTime(Math.max(20, opts.to), t + dur);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(opts.vol ?? 0.3, t + 0.008);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g).connect(opts.bus ?? this.sfxBus!);
    o.start(t);
    o.stop(t + dur + 0.02);
  }

  private hiss(dur: number, opts: { vol?: number; from?: number; to?: number; at?: number; q?: number } = {}): void {
    if (!this.ctx || !this.noise) return;
    const t = this.ctx.currentTime + (opts.at ?? 0);
    const src = this.ctx.createBufferSource();
    src.buffer = this.noise;
    const f = this.ctx.createBiquadFilter();
    f.type = 'bandpass';
    f.Q.value = opts.q ?? 1.2;
    f.frequency.setValueAtTime(opts.from ?? 1200, t);
    if (opts.to) f.frequency.exponentialRampToValueAtTime(opts.to, t + dur);
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(opts.vol ?? 0.3, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    src.connect(f).connect(g).connect(this.sfxBus!);
    src.start(t);
    src.stop(t + dur + 0.02);
  }

  sfx(type: Sfx): void {
    if (!this.ctx || this.muted) return;
    switch (type) {
      case 'click': this.tone(1100, 0.05, { to: 700, vol: 0.12 }); break;
      case 'step': this.tone(180, 0.03, { type: 'triangle', vol: 0.04 }); break;
      case 'hit': this.tone(260, 0.1, { type: 'square', to: 90, vol: 0.14 }); this.hiss(0.08, { vol: 0.25, from: 2500 }); break;
      case 'crit': this.tone(520, 0.14, { type: 'sawtooth', to: 120, vol: 0.16 }); this.hiss(0.12, { vol: 0.35, from: 4000, to: 600 }); break;
      case 'collect': [880, 1320, 1760].forEach((f, i) => this.tone(f, 0.18, { type: 'triangle', vol: 0.18, at: i * 0.07 })); break;
      case 'coin': this.tone(988, 0.07, { type: 'square', vol: 0.1 }); this.tone(1319, 0.25, { type: 'square', vol: 0.1, at: 0.07 }); break;
      case 'win': [523, 659, 784, 1047, 1319].forEach((f, i) => this.tone(f, 0.3, { type: 'triangle', vol: 0.2, at: i * 0.1 })); break;
      case 'lose': [392, 349, 311, 262].forEach((f, i) => this.tone(f, 0.35, { type: 'triangle', vol: 0.18, at: i * 0.16 })); break;
      case 'whoosh': this.hiss(0.3, { vol: 0.3, from: 400, to: 3000, q: 0.8 }); break;
      case 'alert': [0, 0.22].forEach(at => { this.tone(660, 0.1, { type: 'square', vol: 0.12, at }); this.tone(880, 0.1, { type: 'square', vol: 0.12, at: at + 0.1 }); }); break;
      case 'build': this.tone(140, 0.12, { type: 'square', to: 70, vol: 0.18 }); this.hiss(0.06, { vol: 0.2, from: 900, at: 0.02 }); this.tone(1200, 0.05, { vol: 0.08, at: 0.12 }); break;
      case 'error': this.tone(150, 0.18, { type: 'sawtooth', vol: 0.12 }); break;
      case 'special': this.tone(200, 0.35, { type: 'sawtooth', to: 1400, vol: 0.12 }); this.hiss(0.35, { vol: 0.2, from: 500, to: 5000 }); break;
      case 'claw': this.tone(110, 0.6, { type: 'sawtooth', to: 140, vol: 0.06 }); break;
      case 'drop': this.tone(700, 0.4, { type: 'triangle', to: 120, vol: 0.15 }); break;
      case 'open': this.tone(520, 0.08, { type: 'triangle', vol: 0.12 }); this.tone(780, 0.12, { type: 'triangle', vol: 0.12, at: 0.06 }); break;
    }
  }

  private schedule(): void {
    if (!this.ctx || !this.musicBus || this.mode === 'none') return;
    const m = MUSIC[this.mode];
    const stepDur = 60 / m.bpm / 2; // eighth notes
    while (this.nextTime < this.ctx.currentTime + 0.2) {
      const bar = Math.floor(this.step / 8) % m.prog.length;
      const chord = m.prog[bar];
      const i = this.step % 8;
      const t = this.nextTime - this.ctx.currentTime;
      if (!this.muted) {
        // arpeggio, one octave up
        this.tone(midi(chord[m.arp[i]] + 12), stepDur * 1.6, { type: m.wave, vol: 0.22, at: t, bus: this.musicBus });
        // bass on beats 1 and 3
        if (i === 0 || i === 4) this.tone(midi(chord[0] - 12), stepDur * 3.5, { type: 'triangle', vol: 0.35, at: t, bus: this.musicBus });
        // soft hat in battle
        if (this.mode === 'battle' && i % 2 === 1) this.hiss(0.03, { vol: 0.08, from: 8000, at: t });
      }
      this.nextTime += stepDur;
      this.step++;
    }
  }
}

export const audio = new SoundSystem();
