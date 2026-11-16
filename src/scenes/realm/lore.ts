/**
 * Lost Realm story text and the small save file that survives page reloads.
 * Everything is stored under localStorage keys that start with 'realm-'.
 */

export const GUARDIAN_NAME = 'YUE, THE MOONWARDEN';

export interface LorePage { numeral: string; title: string; line: string }

/** Pages are read in the order the shards are found, then the last one on victory. */
export const PAGES: LorePage[] = [
  {
    numeral: 'I',
    title: 'The Lantern-Keeper',
    line: 'Long ago, Yue carried a lantern through these woods every night, so that no traveller would ever walk home in the dark.',
  },
  {
    numeral: 'II',
    title: 'The Long Winter',
    line: 'When a winter came that would not end, Yue poured its own warmth into the stones to keep the village alive. It became stone too.',
  },
  {
    numeral: 'III',
    title: 'The Broken Heart',
    line: 'Afraid of what the cold had made it, Yue split its heart into three shards and hid them. Then it waited alone, for a very long time.',
  },
  {
    numeral: 'IV',
    title: 'Home',
    line: 'Yue was never guarding the realm from you. It was waiting for someone to bring its heart home. The lantern is lit again.',
  },
];

export type AreaId = 'frost' | 'ruin' | 'ember';

export const AREA_INFO: Record<AreaId, { name: string; color: number; hex: string }> = {
  frost: { name: 'Frozen Grove', color: 0x7fe7ff, hex: '#7fe7ff' },
  ruin: { name: 'Overgrown Ruin', color: 0x6dff9e, hex: '#6dff9e' },
  ember: { name: 'Ember Canyon', color: 0xff9a4d, hex: '#ff9a4d' },
};

/* ------------------------------------------------------------------ */
/* Save file                                                           */
/* ------------------------------------------------------------------ */

function read<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    return raw === null ? fallback : (JSON.parse(raw) as T);
  } catch {
    return fallback;
  }
}

function write(key: string, value: unknown): void {
  try { localStorage.setItem(key, JSON.stringify(value)); } catch { /* storage may be blocked */ }
}

export const save = {
  pages(): number[] { return read<number[]>('realm-pages', []).filter(n => n >= 0 && n < PAGES.length); },
  hasPage(i: number): boolean { return this.pages().includes(i); },
  /** Returns true if the page is new. */
  unlockPage(i: number): boolean {
    const p = this.pages();
    if (p.includes(i)) return false;
    p.push(i);
    write('realm-pages', p.sort());
    return true;
  },
  best(): number | null { return read<number | null>('realm-best', null); },
  /** Returns true if this is a new best. */
  submitTime(ms: number): boolean {
    const b = this.best();
    if (b !== null && b <= ms) return false;
    write('realm-best', ms);
    return true;
  },
  visits(): number { return read<number>('realm-visits', 0); },
  addVisit(): number { const v = this.visits() + 1; write('realm-visits', v); return v; },
  clears(): number { return read<number>('realm-clears', 0); },
  addClear(): number { const c = this.clears() + 1; write('realm-clears', c); return c; },
  hasLantern(): boolean { return read<boolean>('realm-lantern', false); },
  setLantern(): void { write('realm-lantern', true); },
};

export function fmtTime(ms: number): string {
  const s = Math.floor(ms / 1000);
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
}
