/**
 * Simulated spending across the whole visit. Games and hub exhibits record
 * what the visitor "spent", and the exit receipt compares it with the money
 * real players spent in the fieldwork. Resets when the page reloads.
 */

export type SpendKind = 'arcade' | 'claw' | 'moba' | 'rpg' | 'slg';

export interface SpendEntry { rmb: number; kind: SpendKind; what: string; at: number }

type Listener = (total: number, last: SpendEntry) => void;

const entries: SpendEntry[] = [];
const listeners = new Set<Listener>();

export const wallet = {
  /** Record a simulated purchase. `what` is shown on the receipt, e.g. "Speed-up". */
  spend(rmb: number, kind: SpendKind, what: string): void {
    const e = { rmb, kind, what, at: Date.now() };
    entries.push(e);
    const t = this.total();
    listeners.forEach(l => l(t, e));
  },
  total(): number {
    return entries.reduce((s, e) => s + e.rmb, 0);
  },
  byKind(kind: SpendKind): number {
    return entries.filter(e => e.kind === kind).reduce((s, e) => s + e.rmb, 0);
  },
  entries(): readonly SpendEntry[] {
    return entries;
  },
  onChange(l: Listener): () => void {
    listeners.add(l);
    return () => listeners.delete(l);
  },
};
