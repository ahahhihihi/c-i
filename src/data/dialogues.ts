/**
 * NPC and Exhibit data - all research content lives here
 */

export interface NPCData {
  id: string;
  name: string;
  role: string;
  portrait: 'warm' | 'cool' | 'violet';
  x: number;
  y: number;
  questions: { q: string; a: string; takeaway?: string; codes?: string[] }[];
}

export interface ExhibitData {
  id: string;
  x: number;
  y: number;
  title: string;
  tabs: { id: string; label: string; content: string }[];
}

// NPCs positioned organically around the arcade floor
export const NPCS: NPCData[] = [
  {
    id: 'chen-wei',
    name: 'Chen Wei',
    role: 'Fighting-game regular · Street Jiliehuo',
    portrait: 'warm',
    x: 180, y: 280,
    questions: [
      {
        q: 'What makes the hardware here special?',
        a: "This is a real candy cabinet running Street Fighter III: 3rd Strike, with genuine Sanwa parts. You can't get that input timing or that microswitch click from an emulator. These days an arcade's edge isn't computing power. It's the physical hardware in your hands.",
        takeaway: "Arcades survive on what a phone can't copy: real buttons and exact timing.",
        codes: ['COMP: Competitive Mastery', 'PLAT: Platform Specificity'],
      },
      {
        q: 'How much do you typically spend?',
        a: "About 50 to 60 yuan. If I'm on a win streak, a single token can last twenty minutes, because the winner stays on. Nobody makes small talk here. You just put your coin on the monitor glass to claim the next game.",
        takeaway: "Money buys a turn, not a win. Skill decides how long a coin lasts.",
        codes: ['VALU: Perceived Utility', 'SPND: Direct Capital Outlay'],
      },
      {
        q: 'What about mobile games?',
        a: "Mobile games like Honor of Kings feel like fast food to me. It's login streaks and cosmetic gacha. Here, landing a multi-hit combo is all you, your hands and your nerves. You can't buy an advantage.",
        takeaway: "For skill players, the arcade's fairness is part of what they pay for.",
        codes: ['MONA: Monetization Literacy'],
      },
    ],
  },
  {
    id: 'xiao-mei',
    name: 'Xiao Mei',
    role: 'Visitor · Fengyun Zaiqi',
    portrait: 'violet',
    x: 620, y: 240,
    questions: [
      {
        q: 'How do the claw machines work?',
        a: "We spent 100 yuan chasing a Sanrio plush that sells for 15 yuan on Taobao. But we weren't really buying a toy. We were buying those ten seconds, when the claw lifts the prize, it wobbles, and it almost slips. That rush was worth the 100 yuan.",
        takeaway: "The product is the near-miss, not the prize.",
        codes: ['VALU: Emotional Utility', 'MONA: Near-Miss Design'],
      },
      {
        q: 'How do you pay?',
        a: "Every machine has a QR code on it. You scan it with WeChat Pay, and 6 yuan gets you two tries. You never have to hand over real cash, so it doesn't feel like spending. It's super easy.",
        takeaway: "Scanning a QR code removes the pain of paying, so spending speeds up.",
        codes: ['FRIC: Reduced Friction'],
      },
      {
        q: 'Why not play the fighting cabinets?',
        a: "The fighting cabinets look scary. People are hammering the buttons at crazy speed, and there's no tutorial. A claw machine needs no explanation at all, so people spend more there.",
        takeaway: "Claw machines need nothing to learn, so casual visitors spend more on them.",
        codes: ['ONBD: Onboarding Friction'],
      },
    ],
  },
  {
    id: 'zhang-ming',
    name: 'Zhang Ming',
    role: 'Parent · Castle in the Sky',
    portrait: 'cool',
    x: 380, y: 350,
    questions: [
      {
        q: 'How does the dual-currency work?',
        a: "Tokens go fast on the three-minute simulators. Marbles last much longer. I put 200 steel balls in the hopper for 20 yuan, and my son stays busy for 45 minutes straight. He feels like he's earning every one of them.",
        takeaway: "Marbles stretch each yuan into minutes. Parents are buying time.",
        codes: ['VALU: Temporal Duration', 'SPND: Capital Velocity'],
      },
      {
        q: 'Why prefer arcades over mobile games?',
        a: "I don't allow gacha games at home, because in-app purchases quietly drain your money. Here, the 67 yuan I spend has a limit. He runs around, works on his coordination, and saves paper tickets for an eraser worth two yuan. It feels controlled, and it's real.",
        takeaway: "A fixed, visible budget feels safer to parents than open-ended in-app spending.",
        codes: ['SOCI: Intergenerational Bonding'],
      },
    ],
  },
  {
    id: 'mr-zhou',
    name: 'Mr. Zhou',
    role: 'Strategy game big spender · ¥15,000 to 30,000 a month',
    portrait: 'warm',
    x: 750, y: 320,
    questions: [
      {
        q: 'How much do you spend on games?',
        a: "Between 15,000 and 30,000 yuan a month. During castle battles, the top alliance members can spend 100,000. I don't have the hand speed for MOBAs. What I do have is money to spend. In a strategy game, money turns straight into faster marches, stronger troops, and more territory.",
        takeaway: "In strategy games, money stands in for skill. Spending is how you compete.",
        codes: ['SPND: Whale Monetization', 'COMP: Capitalized Mastery'],
      },
      {
        q: 'How does the alliance system work?',
        a: "When I buy a 648 yuan pack, all 200 alliance members get a chest. The free players bring the numbers for garrisons and scouting. The paying leaders bring the firepower and keep the economy going. It's like running a company from your phone.",
        takeaway: "Big spenders pay for the whole alliance, and free players supply the numbers. Each side needs the other.",
        codes: ['SOCI: Alliance Hierarchy'],
      },
    ],
  },
  {
    id: 'alex',
    name: 'Alex',
    role: 'Honor of Kings player',
    portrait: 'violet',
    x: 520, y: 260,
    questions: [
      {
        q: 'Why is Honor of Kings so dominant?',
        a: "When you meet someone new, you swap WeChat, and sooner or later someone asks, 'What's your rank in Kings? Let's play five-stack.' It cuts across every social group. As long as Tencent owns the WeChat network, nothing is going to replace this game.",
        takeaway: "Honor of Kings is part of social life, tied into WeChat.",
        codes: ['SOCI: Social Embeddedness', 'COMM: Platform Infrastructure'],
      },
      {
        q: 'Do skins give advantage?',
        a: "On paper, skins give a small bonus, like plus 10 attack. But the top skins also change how fast your animations cancel. Han Xin's Street Haunter feels lighter and reacts a few frames faster than the default. It's a gameplay edge disguised as a cosmetic.",
        takeaway: "A cosmetic can carry a real, hidden gameplay edge.",
        codes: ['SPND: Cosmetic Monetization', 'COMP: Mechanical Edge'],
      },
      {
        q: 'What keeps you playing?',
        a: "The matchmaking keeps your win rate close to 50 percent. After a few losses you get ladder anxiety, and you don't want to end the night on a lost star. So you're still logged in at 2 AM, trying to win your rank back.",
        takeaway: "Matchmaking that holds you near 50 percent turns every loss into a reason to play again.",
        codes: ['RETN: Retention Hooks'],
      },
    ],
  },
  {
    id: 'yuki',
    name: 'Yuki',
    role: 'RPG player · Genshin Impact and Fantasy Westward Journey',
    portrait: 'cool',
    x: 280, y: 420,
    questions: [
      {
        q: 'What draws you to Genshin Impact?',
        a: "Genshin feels like a place I go to relax and enjoy beautiful things. I pull on a banner because I love the character's story. HoYoverse spends six weeks on a character's theme music and emotional arc. By the time the banner opens, I'm already in, whether or not they're strong in the meta.",
        takeaway: "Players pay out of attachment to a character, not for power.",
        codes: ['ATTA: Narrative Attachment'],
      },
      {
        q: 'What about Fantasy Westward Journey?',
        a: "Fantasy Westward Journey works more like a financial market. When I buy top gear on NetEase's marketplace for 8,000 yuan, I'm not spending it. I'm parking my money. Two years later, I can sell it back on the exchange.",
        takeaway: "In some games, items work as stored value that can be sold later.",
        codes: ['VALU: Capital Preservation', 'COMM: Asset Trading'],
      },
      {
        q: 'How do arcades compare?',
        a: "Arcades don't give you anything that lasts. When your credits hit zero, the machine just resets. I want a persistent world, where my story and my items build up over years.",
        takeaway: "Phone RPGs sell persistence, something an arcade can't offer.",
        codes: ['PROG: Progression Persistence'],
      },
    ],
  },
  {
    id: 'manager-liu',
    name: 'Manager Liu',
    role: 'Arcade floor technician · Shanghai',
    portrait: 'cool',
    x: 580, y: 400,
    questions: [
      {
        q: 'What about traditional video cabinets?',
        a: "Traditional cabinets earn very little per square meter. A strong player can stay on Street Fighter for an hour on three tokens. We keep them mostly for atmosphere, so the place still feels like a real arcade.",
        takeaway: "Skill cabinets earn little per square meter. They stay for atmosphere.",
        codes: ['VALU: Revenue Density'],
      },
      {
        q: 'How do claw machines really work?',
        a: "Claw machines run on payout settings. The technician sets a ratio, say one win in 18 tries. The claw lifts with a full grip, then the power drops by half at the top, so the toy falls. It only holds all the way to the chute once the count is reached.",
        takeaway: "The operator sets the odds, not the player's skill.",
        codes: ['MONA: Algorithmic Rigging'],
      },
      {
        q: 'Has digital payment changed things?',
        a: "Scanning with the mini-program cut theft and saved on staff. But we lost the sound. Fifty brass tokens clattering into a metal tray makes everyone on the floor look over. You can't copy that kind of advertising.",
        takeaway: "QR payment saved costs but removed the sound that used to draw a crowd.",
        codes: ['SOCI: Sensory Social Proof'],
      },
    ],
  },
  {
    id: 'dev-zhang',
    name: 'Developer Zhang',
    role: 'Indie game developer · Shanghai',
    portrait: 'warm',
    x: 820, y: 380,
    questions: [
      {
        q: 'What is the biggest challenge for indies?',
        a: "Getting a publishing license from the NPPA, the ISBN. The review process is exhaustive. For a team of five with twelve months of funding, waiting eighteen months for a license can end the studio.",
        takeaway: "A license wait can outlast a small studio's money.",
        codes: ['FRIC: Regulatory Obstacles'],
      },
      {
        q: 'How do developers survive without licenses?',
        a: "Chinese indie developers rely on Steam Global to survive. It works internationally and doesn't need a local ISBN. More than 75 percent of our players are in China, but the money still arrives through international channels.",
        takeaway: "Steam lets Chinese indies reach Chinese players without a local license.",
        codes: ['COMM: External Infrastructure'],
      },
      {
        q: 'How is AI changing development?',
        a: "We use AI for quick concept art and script translation, which cuts our timelines by about 40 percent. But AI can't balance a combat loop. And investors have walked away from indie games that aren't live-service.",
        takeaway: "AI speeds up production, but funding has moved to live-service games.",
        codes: ['PLAT: Production Constraints'],
      },
    ],
  },
];

// Exhibits positioned around the floor
export const EXHIBITS: ExhibitData[] = [
  {
    id: 'ex-venues',
    x: 120, y: 180,
    title: 'Three Spaces: Fieldwork Sites',
    tabs: [
      {
        id: 'jiliehuo',
        label: 'Jiliehuo (SH)',
        content: `
          <div class="venue-card">
            <div class="venue-kicker">VENUE A · SUBCULTURAL LEGACY ARCADE</div>
            <div class="venue-title">Street Jiliehuo (街机烈火)</div>
            <p class="venue-desc">Final bastion of competitive fighting game subculture in Shanghai.</p>
          </div>
          <div class="stat-row">
            <div class="stat-item"><div class="stat-label">SPEND</div><div class="stat-value gold">≈ RMB 54</div></div>
            <div class="stat-item"><div class="stat-label">HARDWARE</div><div class="stat-value">CRT cabinets, Sanwa sticks</div></div>
            <div class="stat-item"><div class="stat-label">PAYMENT</div><div class="stat-value">Physical tokens only</div></div>
            <div class="stat-item"><div class="stat-label">CYCLE</div><div class="stat-value">5-25 min (skill-dependent)</div></div>
          </div>
        `,
      },
      {
        id: 'fengyun',
        label: 'Fengyun (SH)',
        content: `
          <div class="venue-card">
            <div class="venue-kicker">VENUE B · TRANSIT CONCOURSE ARCADE</div>
            <div class="venue-title">Fengyun Zaiqi (风云再起)</div>
            <p class="venue-desc">High-velocity commercial concourse beneath People's Square.</p>
          </div>
          <div class="stat-row">
            <div class="stat-item"><div class="stat-label">SPEND</div><div class="stat-value gold">≈ RMB 105</div></div>
            <div class="stat-item"><div class="stat-label">HARDWARE</div><div class="stat-value">UFO catchers, dance stages</div></div>
            <div class="stat-item"><div class="stat-label">PAYMENT</div><div class="stat-value">WeChat QR on machine</div></div>
            <div class="stat-item"><div class="stat-label">CYCLE</div><div class="stat-value">15-30 sec per pull</div></div>
          </div>
        `,
      },
      {
        id: 'castle',
        label: 'Castle (NJ)',
        content: `
          <div class="venue-card">
            <div class="venue-kicker">VENUE C · FAMILY ENTERTAINMENT CENTER</div>
            <div class="venue-title">Castle in the Sky (天空之城)</div>
            <p class="venue-desc">Mall-anchor FEC in Aqua City, Nanjing.</p>
          </div>
          <div class="stat-row">
            <div class="stat-item"><div class="stat-label">SPEND</div><div class="stat-value gold">≈ RMB 67</div></div>
            <div class="stat-item"><div class="stat-label">HARDWARE</div><div class="stat-value">Marble pushers, simulators</div></div>
            <div class="stat-item"><div class="stat-label">PAYMENT</div><div class="stat-value">Dual: Tokens + Marbles</div></div>
            <div class="stat-item"><div class="stat-label">CYCLE</div><div class="stat-value">Bimodal: short/fast + long</div></div>
          </div>
        `,
      },
    ],
  },
  {
    id: 'ex-velocity',
    x: 450, y: 150,
    title: 'Capital Velocity vs Temporal Elasticity',
    tabs: [
      {
        id: 'fast',
        label: 'High Velocity',
        content: `
          <h4>Rapid Burn Model</h4>
          <p><strong>Physical:</strong> UFO claw machines at Fengyun Zaiqi. 15-30 second cycles. Spend rate: RMB 100 in 15 minutes. Driven by near-miss dopamine and frictionless QR micropayments.</p>
          <p><strong>Digital:</strong> SLG whale monetization. RMB 648 resource packs. Top alliance spenders invest RMB 15,000-100,000 monthly to accelerate construction and conquer cross-server castles.</p>
        `,
      },
      {
        id: 'slow',
        label: 'Temporal Elastic',
        content: `
          <h4>Extended Dwell Model</h4>
          <p><strong>Physical:</strong> Marble pushers at Castle in the Sky. 200 steel balls for RMB 19.50 lasts 45 uninterrupted minutes. Parents buy extended peace with bounded expenditure.</p>
          <p><strong>Digital:</strong> Monthly passes in open-world RPGs. RMB 30 Welkin card + seasonal battle pass. Daily 15-minute commissions sustain engagement across multi-year horizons.</p>
        `,
      },
    ],
  },
  {
    id: 'ex-synthesis',
    x: 780, y: 200,
    title: 'Fieldwork to Mini-Games',
    tabs: [
      {
        id: 'battle',
        label: 'Battle Arena',
        content: `
          <h4>MOBA Archetype</h4>
          <p><strong>Grounded in:</strong> P-01 (hardware mastery) and P-05 (animation-cancel mechanics)</p>
          <p><strong>Translation:</strong> Single-lane turret push distills competitive loop. J (special) cancels basic attack recovery frames, which gives a skill-based mechanical edge. Turret aggro redirects when attacking enemy hero in range.</p>
        `,
      },
      {
        id: 'realm',
        label: 'Lost Realm',
        content: `
          <h4>RPG Archetype</h4>
          <p><strong>Grounded in:</strong> P-06 (narrative attachment, gated progression)</p>
          <p><strong>Translation:</strong> Guardian is invulnerable until 3 elemental shards collected. Stamina economy constrains combat evasion. NPC dialogue adapts to inventory state.</p>
        `,
      },
      {
        id: 'frontier',
        label: 'Frontier',
        content: `
          <h4>SLG Archetype</h4>
          <p><strong>Grounded in:</strong> P-07 (resource anxiety, acceleration mechanics)</p>
          <p><strong>Translation:</strong> Wood/Food/Stone tick in real-time. Starvation triggers 50% worker debuff. Speed-up button demonstrates psychological relief behind monetized acceleration.</p>
        `,
      },
    ],
  },
];

// Machine data
export const MACHINES = [
  { id: 'battle' as const, x: 200, y: 140, label: 'Battle Arena', color: 0xf6b94b },
  { id: 'realm' as const, x: 550, y: 180, label: 'Lost Realm', color: 0xa87ffb },
  { id: 'frontier' as const, x: 800, y: 130, label: 'Frontier', color: 0x42c2ff },
];
