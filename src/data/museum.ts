/**
 * Museum layout and wall text. Every number here comes from the fieldwork
 * (see dialogues.ts and the original exhibit notes); nothing is invented.
 */
import type { Accent } from '../ui/modals';

export type WingId = 'entrance' | 'skill' | 'time' | 'speed' | 'backstage' | 'exit';

export interface Wing {
  id: WingId;
  x0: number;
  x1: number;
  accent: Accent;
  color: number;
  /** Small label above the headline, e.g. 'WING A'. */
  tag: string;
  /** One word, painted huge on the wall. */
  word: string;
  /** One sentence finding, readable while walking past. */
  headline: string;
  /** Real place this wing recreates. */
  venue?: { name: string; zh: string; city: string };
  /** Mobile genre it pairs with. */
  pair?: string;
}

export const HALL_W = 4400;

export const WINGS: Wing[] = [
  {
    id: 'entrance', x0: 0, x1: 760, accent: 'gold', color: 0xffd078,
    tag: 'WELCOME', word: '', headline: '',
  },
  {
    id: 'skill', x0: 760, x1: 1640, accent: 'gold', color: 0xffb347,
    tag: 'WING A', word: 'SKILL',
    headline: 'At the fighting cabinets, money buys a turn. On the phone, it buys an edge.',
    venue: { name: 'Street Jiliehuo', zh: '街机烈火', city: 'Shanghai' },
    pair: 'Honor of Kings',
  },
  {
    id: 'time', x0: 1640, x1: 2520, accent: 'violet', color: 0xa47bff,
    tag: 'WING B', word: 'TIME',
    headline: 'Parents buy their kids minutes. RPG players buy a world that remembers them.',
    venue: { name: 'Castle in the Sky', zh: '天空之城', city: 'Nanjing' },
    pair: 'phone RPGs',
  },
  {
    id: 'speed', x0: 2520, x1: 3400, accent: 'pink', color: 0xff4fd8,
    tag: 'WING C', word: 'SPEED',
    headline: 'The faster you can pay, the less it feels like paying.',
    venue: { name: 'Fengyun Zaiqi', zh: '风云再起', city: 'Shanghai' },
    pair: 'strategy games',
  },
  {
    id: 'backstage', x0: 3400, x1: 3960, accent: 'teal', color: 0x2de2b0,
    tag: 'BACKSTAGE', word: 'RULES',
    headline: 'Someone sets the odds, and someone else waits for permission to sell.',
  },
  {
    id: 'exit', x0: 3960, x1: HALL_W, accent: 'gold', color: 0xffd078,
    tag: 'EXIT', word: '', headline: '',
  },
];

export function wingAt(x: number): Wing {
  return WINGS.find(w => x >= w.x0 && x < w.x1) ?? WINGS[WINGS.length - 1];
}

/** Which wing each interviewee stands in, and where. */
export const NPC_PLACES: Record<string, { wing: WingId; x: number; y: number }> = {
  'chen-wei':    { wing: 'skill', x: 1110, y: 388 },
  'alex':        { wing: 'skill', x: 1385, y: 418 },
  'zhang-ming':  { wing: 'time', x: 1985, y: 392 },
  'yuki':        { wing: 'time', x: 2420, y: 405 },
  'xiao-mei':    { wing: 'speed', x: 2870, y: 410 },
  'mr-zhou':     { wing: 'speed', x: 3300, y: 398 },
  'manager-liu': { wing: 'backstage', x: 3490, y: 400 },
  'dev-zhang':   { wing: 'backstage', x: 3905, y: 405 },
};

export const ENTRANCE = {
  title: 'THREE SPACES,\nONE ARCADE',
  kicker: 'A WALK-THROUGH OF MY FIELDWORK ON GAMES IN CHINA',
  thesis: 'I visited three arcades in Shanghai and Nanjing and interviewed the people who play there and on their phones. Each place sells something different.',
  teaser: [
    { word: 'SKILL', color: 0xffb347, line: 'a fair fight' },
    { word: 'TIME', color: 0xa47bff, line: 'minutes, and years' },
    { word: 'SPEED', color: 0xff4fd8, line: 'no more waiting' },
  ],
  how: 'Walk right. Press E at anything that glows. Play the cabinets, talk to people, and get your receipt at the exit.',
};

/* ------------------------------------------------------------------ */
/* Exhibit pop-up content (HTML)                                       */
/* ------------------------------------------------------------------ */

const venueCard = (kicker: string, title: string, desc: string, stats: [string, string, boolean?][]) => `
  <div class="venue-card">
    <div class="venue-kicker">${kicker}</div>
    <div class="venue-title">${title}</div>
    <p class="venue-desc">${desc}</p>
  </div>
  <div class="stat-row">
    ${stats.map(([l, v, gold]) => `<div class="stat-item"><div class="stat-label">${l}</div><div class="stat-value ${gold ? 'gold' : ''}">${v}</div></div>`).join('')}
  </div>`;

export const VENUES = {
  skill: venueCard('WING A · FIGHTING-GAME ARCADE · SHANGHAI', 'Street Jiliehuo (街机烈火)',
    'One of the last places in Shanghai built around competitive fighting games. Players line up, put a coin on the glass to claim the next game, and the winner stays on.', [
      ['AVERAGE SPEND', '≈ ¥54', true], ['HARDWARE', 'CRT cabinets, Sanwa sticks'],
      ['PAYMENT', 'Physical tokens only'], ['ONE GAME LASTS', '5 to 25 min, depending on skill'],
    ]),
  time: venueCard('WING B · FAMILY ARCADE IN A MALL · NANJING', 'Castle in the Sky (天空之城)',
    'A family arcade anchoring a mall in Aqua City. Two currencies: tokens for quick simulators, and marbles for pusher machines that keep a child busy for most of an hour.', [
      ['AVERAGE SPEND', '≈ ¥67', true], ['HARDWARE', 'Marble pushers, ride simulators'],
      ['PAYMENT', 'Tokens and marbles'], ['ONE GAME LASTS', 'Short and fast, or very long'],
    ]),
  speed: venueCard('WING C · METRO CONCOURSE ARCADE · SHANGHAI', 'Fengyun Zaiqi (风云再起)',
    'A busy arcade in the concourse under People\'s Square. Rows of claw machines and dance stages, each with a QR code on the glass.', [
      ['AVERAGE SPEND', '≈ ¥105', true], ['HARDWARE', 'Claw machines, dance stages'],
      ['PAYMENT', 'WeChat QR code on every machine'], ['ONE GAME LASTS', '15 to 30 seconds'],
    ]),
};

/** Wing A data station: can you buy a win? */
export const BUY_A_WIN = `
  <table class="compare">
    <thead><tr><th></th><th>Fighting cabinet<br><small>Street Jiliehuo</small></th><th>Honor of Kings<br><small>phone MOBA</small></th></tr></thead>
    <tbody>
      <tr><td>What money buys</td><td>A turn. “You can't buy an advantage.”</td><td>Skins. Some top skins “react a few frames faster than the default.”</td></tr>
      <tr><td>What skill buys</td><td>Time. Winner stays on, so one token can last 20 minutes.</td><td>Rank, which friends ask about the moment you swap WeChat.</td></tr>
      <tr><td>What keeps you there</td><td>The next challenger’s coin on the glass.</td><td>A win rate held near 50 percent, and “ladder anxiety” at 2 AM.</td></tr>
    </tbody>
  </table>
  <p class="exhibit-point">Both feel like skill games. Only one of them sells part of the skill.</p>`;

/** Wing B data station: the price of a minute. */
export const PRICE_OF_A_MINUTE = `
  <p>How long the same money lasts depends on what the machine is built to sell.</p>
  <div class="bars">
    <div class="bar-row"><span class="bar-label">Marble pusher</span><span class="bar" style="--w:100%;--c:var(--violet)"></span><span class="bar-val">¥20 → 45 min</span></div>
    <div class="bar-row"><span class="bar-label">Claw machine</span><span class="bar" style="--w:7%;--c:var(--pink)"></span><span class="bar-val">¥100 → 15 min</span></div>
  </div>
  <p class="bar-note">Per yuan, the marble pusher lasts about 15 times longer: roughly 2 minutes 15 seconds per yuan, against 9 seconds per yuan at the claw.</p>
  <h4>The same split on phones</h4>
  <p><strong>Slow:</strong> RPG monthly passes (¥30 Welkin card) and daily 15-minute tasks keep players coming back for years.</p>
  <p><strong>Fast:</strong> strategy-game packs at ¥648. Top alliance spenders put ¥15,000 to 100,000 a month into speeding up.</p>
  <p class="exhibit-point">Some games sell you more time. Others sell you less waiting.</p>`;

/** Backstage: the license wall. */
export const LICENSE_WALL = `
  <p>To sell a game in China, a studio needs a publishing license (an ISBN) from the NPPA.</p>
  <div class="timeline">
    <div class="tl-row"><span class="tl-label">Money left (5-person team)</span><span class="tl-bar" style="--w:40%;--c:var(--teal)">12 months</span></div>
    <div class="tl-row"><span class="tl-label">License wait</span><span class="tl-bar" style="--w:60%;--c:var(--red)">up to 18 months</span></div>
  </div>
  <p>So many Chinese indie studios release on <strong>Steam Global</strong>, which needs no local license. For Developer Zhang, more than 75 percent of players are in China, but the money arrives through international channels.</p>
  <p class="exhibit-point">The biggest obstacle for a small studio is the wait for permission, more than its competitors.</p>`;

/** Backstage: the token tray. */
export const TOKEN_TRAY = `
  <p>“Fifty brass tokens clattering into a metal tray makes everyone on the floor look over. You can't copy that kind of advertising.”</p>
  <p class="debrief-who">MANAGER LIU · ARCADE FLOOR TECHNICIAN</p>
  <p class="exhibit-point">QR payment cut theft and staff costs. It also silenced the arcade's best advert.</p>`;

/** How each cabinet was designed from the fieldwork. */
export const DESIGN_NOTES: Record<'battle' | 'realm' | 'frontier', string> = {
  battle: 'Built from Chen Wei (hardware, no paying to win) and Alex (skins with a hidden edge, ladder anxiety). The skin you can buy really is faster.',
  realm: 'Built from Yuki (paying out of love for a character, worlds that remember you). Your lore pages are saved for next time.',
  frontier: 'Built from Mr. Zhou (money turns into speed, 648 yuan alliance packs) and Xiao Mei (paying that does not feel like paying).',
};

/* ------------------------------------------------------------------ */
/* Exit                                                                */
/* ------------------------------------------------------------------ */

export const CONCLUSION = {
  title: 'What the three spaces sell',
  points: [
    { word: 'SKILL', color: 'var(--gold)', text: 'In a fighting-game arcade, money buys a turn and skill decides how long it lasts. Honor of Kings keeps that feeling, then sells skins that quietly change how a hero handles, and a ladder that keeps you playing.' },
    { word: 'TIME', color: 'var(--violet)', text: 'At a family arcade, ¥20 of marbles buys 45 minutes of a child\'s attention. RPGs sell time on a longer scale: a story and a world that remember you for years, and gear that can be resold.' },
    { word: 'SPEED', color: 'var(--pink)', text: 'Claw machines and strategy games sell the end of waiting. One QR scan or one ¥648 pack, and paying barely feels like spending.' },
    { word: 'RULES', color: 'var(--teal)', text: 'Behind all of it, operators set payout odds, and small studios can wait up to 18 months for a license, so many ship on Steam instead.' },
  ],
};

/** Real spending from the interviews, used on the receipt. */
export const REAL_SPEND = [
  { who: 'Chen Wei, one evening of fighting games', rmb: '¥50 to 60' },
  { who: 'Zhang Ming, a family afternoon', rmb: '¥67' },
  { who: 'Xiao Mei, chasing one ¥15 plush', rmb: '¥100' },
  { who: 'Yuki, one piece of game gear (she calls it saving)', rmb: '¥8,000' },
  { who: 'Mr. Zhou, one month of a strategy game', rmb: '¥15,000 to 30,000' },
];
