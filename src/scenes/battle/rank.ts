/**
 * Ranked ladder state that survives across matches for the whole visit
 * (resets on page reload), like a real account would.
 */

const TIERS = ['Bronze', 'Silver', 'Gold', 'Platinum', 'Diamond'];
export const STARS_PER_TIER = 5;

export const ladder = {
  /** Total stars on the ladder. 12 = Gold, 2 stars. */
  total: 12,
  matches: 0,
  wins: 0,
  skinOwned: false,
};

export function tierOf(total: number): { name: string; stars: number } {
  const t = Math.max(0, total);
  const idx = Math.min(TIERS.length - 1, Math.floor(t / STARS_PER_TIER));
  const stars = idx === TIERS.length - 1 && t >= TIERS.length * STARS_PER_TIER ? STARS_PER_TIER : t - idx * STARS_PER_TIER;
  return { name: TIERS[idx], stars };
}

/** Pretend wall clock: every match costs about 18 minutes of the night, from 11:40 PM. */
export function clockText(matches: number): string {
  const mins = (23 * 60 + 40 + matches * 18) % (24 * 60);
  const h24 = Math.floor(mins / 60);
  const m = mins % 60;
  const h12 = h24 % 12 === 0 ? 12 : h24 % 12;
  return `${h12}:${m.toString().padStart(2, '0')} ${h24 < 12 ? 'AM' : 'PM'}`;
}
