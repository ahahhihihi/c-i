/**
 * Spoken dialogue using the browser's built-in speech synthesis.
 * No audio files or libraries. Each speaker gets a stable voice and pitch.
 */

const KEY = 'voice-enabled';

export const speech = {
  supported(): boolean {
    return typeof window !== 'undefined' && 'speechSynthesis' in window;
  },

  enabled(): boolean {
    return this.supported() && localStorage.getItem(KEY) !== '0';
  },

  setEnabled(on: boolean): void {
    localStorage.setItem(KEY, on ? '1' : '0');
    if (!on) this.stop();
  },

  stop(): void {
    if (this.supported()) window.speechSynthesis.cancel();
  },

  speak(text: string, speaker: string): void {
    if (!this.enabled()) return;
    const synth = window.speechSynthesis;
    synth.cancel();

    // Stable per-speaker variation derived from the name
    let h = 0;
    for (const ch of speaker) h = (h * 31 + ch.charCodeAt(0)) >>> 0;

    const u = new SpeechSynthesisUtterance(text);
    const voices = synth.getVoices().filter(v => v.lang.toLowerCase().startsWith('en'));
    if (voices.length) u.voice = voices[h % voices.length];
    u.pitch = 0.85 + (h % 5) * 0.1;
    u.rate = 0.98;
    synth.speak(u);
  },
};
