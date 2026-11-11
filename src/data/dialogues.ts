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
  questions: { q: string; a: string; codes?: string[] }[];
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
    role: 'Arcade Veteran · Jiliehuo Regular',
    portrait: 'warm',
    x: 180, y: 280,
    questions: [
      {
        q: 'What makes the hardware here special?',
        a: "You sit before an authentic candy cabinet running Street Fighter III: 3rd Strike on genuine Sanwa parts. You cannot replicate that input timing or microswitch feedback on an emulator. The defensible moat of arcades is no longer compute—it's physical human-interface hardware.",
        codes: ['COMP: Competitive Mastery', 'PLAT: Platform Specificity'],
      },
      {
        q: 'How much do you typically spend?',
        a: "RMB 50-60. If I hold the cabinet on a win streak, one token lasts twenty minutes because winner-stays-on. We don't make small talk—you place your coin on the monitor glass to establish challenge priority.",
        codes: ['VALU: Perceived Utility', 'SPND: Direct Capital Outlay'],
      },
      {
        q: 'What about mobile games?',
        a: "Mobile titles like Honor of Kings are cognitive fast food—login streaks and cosmetic gacha. Here, executing a multi-hit hit-confirm belongs exclusively to your nervous system. You cannot purchase a competitive advantage.",
        codes: ['MONA: Monetization Literacy'],
      },
    ],
  },
  {
    id: 'xiao-mei',
    name: 'Xiao Mei',
    role: 'Mall Visitor · Fengyun Zaiqi',
    portrait: 'violet',
    x: 620, y: 240,
    questions: [
      {
        q: 'How do the claw machines work?',
        a: "We spent RMB 100 chasing a Sanrio plush that retails for RMB 15 on Taobao. You're not buying a textile object—you're buying the ten-second tension cycle where the crane hoists the prize, trembles, and threatens to slip. That emotional release is worth the RMB 100.",
        codes: ['VALU: Emotional Utility', 'MONA: Near-Miss Design'],
      },
      {
        q: 'How do you pay?',
        a: "Each claw has an integrated QR code. You scan WeChat Pay on the glass, authorize RMB 6 for two attempts. You never confront the psychological weight of spending physical banknotes. It's frictionless.",
        codes: ['FRIC: Reduced Friction'],
      },
      {
        q: 'Why not play the fighting cabinets?',
        a: "Traditional fighting cabinets look intimidating—men slamming controls at extreme speed with no tutorials. Claw machines require zero cognitive onboarding. That's why spend is higher here.",
        codes: ['ONBD: Onboarding Friction'],
      },
    ],
  },
  {
    id: 'zhang-ming',
    name: 'Zhang Ming',
    role: 'Family Parent · Castle in the Sky',
    portrait: 'cool',
    x: 380, y: 350,
    questions: [
      {
        q: 'How does the dual-currency work?',
        a: "Tokens burn fast on 3-minute simulators. Marbles are temporal stretching—you pour 200 steel balls into a hopper and that RMB 20 purchase occupies my son for 45 uninterrupted minutes. He experiences the illusion of earned labor.",
        codes: ['VALU: Temporal Duration', 'SPND: Capital Velocity'],
      },
      {
        q: 'Why prefer arcades over mobile games?',
        a: "I forbid digital gacha at home—in-app purchases are an invisible drain. Here, RMB 67 is bounded. He runs around, practices coordination, hoards paper tickets for an eraser worth two yuan. It's controlled, tangible.",
        codes: ['SOCI: Intergenerational Bonding'],
      },
    ],
  },
  {
    id: 'mr-zhou',
    name: 'Mr. Zhou',
    role: 'SLG Whale · RMB 15K-30K/mo',
    portrait: 'warm',
    x: 750, y: 320,
    questions: [
      {
        q: 'How much do you spend on games?',
        a: "RMB 15,000-30,000 monthly; top alliance members hit RMB 100,000 during castle battles. We lack fine motor dexterity for MOBAs. What we possess is disposable capital. In an SLG, capital translates directly into march speed, troop tiers, and territory.",
        codes: ['SPND: Whale Monetization', 'COMP: Capitalized Mastery'],
      },
      {
        q: 'How does the alliance system work?',
        a: "When I buy an RMB 648 pack, all 200 alliance members get a chest. Free-to-play players supply garrison numbers and scouting; paying leaders provide nuclear deterrent power and economic subsidies. It's executive management on a phone.",
        codes: ['SOCI: Alliance Hierarchy'],
      },
    ],
  },
  {
    id: 'alex',
    name: 'Alex',
    role: 'MOBA Player · Honor of Kings',
    portrait: 'violet',
    x: 520, y: 260,
    questions: [
      {
        q: 'Why is Honor of Kings so dominant?',
        a: "When you meet someone new, you exchange WeChat and someone asks: 'What rank are you in Kings? Let's 5-stack.' It transcends social strata. As long as Tencent controls the WeChat graph, this game cannot be displaced.",
        codes: ['SOCI: Social Embeddedness', 'COMM: Platform Infrastructure'],
      },
      {
        q: 'Do skins give advantage?',
        a: "Skins offer nominal bonuses (+10 attack), but elite skins alter animation-cancel responsiveness. Han Xin's Street Haunter feels lighter and reacts frames faster than default. It's mechanical edge disguised as cosmetics.",
        codes: ['SPND: Cosmetic Monetization', 'COMP: Mechanical Edge'],
      },
      {
        q: 'What keeps you playing?',
        a: "The ranking algorithm tethers win-rate near 50%. A string of defeats induces ladder anxiety—you refuse to end your evening on a star deduction. You're logged in until 2 AM trying to recover rank.",
        codes: ['RETN: Retention Hooks'],
      },
    ],
  },
  {
    id: 'yuki',
    name: 'Yuki',
    role: 'RPG Enthusiast · Genshin / FWJ',
    portrait: 'cool',
    x: 280, y: 420,
    questions: [
      {
        q: 'What draws you to Genshin Impact?',
        a: "Genshin is an aesthetic sanctuary. I pull on banners based on narrative devotion—Chú lì. HoYoverse spends six weeks developing a character's musical leitmotif and emotional arc. By the time the banner drops, I'm committed regardless of meta viability.",
        codes: ['ATTA: Narrative Attachment'],
      },
      {
        q: 'What about Fantasy Westward Journey?',
        a: "FWJ operates as a financial commodity market. When I acquire high-tier equipment on NetEase's marketplace for RMB 8,000, I'm not consuming—I'm parking capital. Two years later, I can liquidate back onto the exchange.",
        codes: ['VALU: Capital Preservation', 'COMM: Asset Trading'],
      },
      {
        q: 'How do arcades compare?',
        a: "Physical arcades offer zero emotional continuity. When credits drop to zero, the machine resets. I require persistent worlds where narrative progression and digital assets accumulate over years.",
        codes: ['PROG: Progression Persistence'],
      },
    ],
  },
  {
    id: 'manager-liu',
    name: 'Manager Liu',
    role: 'Floor Technician · Shanghai',
    portrait: 'cool',
    x: 580, y: 400,
    questions: [
      {
        q: 'What about traditional video cabinets?',
        a: "Traditional cabinets generate low revenue per square meter—a master player occupies Street Fighter for an hour on three tokens. We retain them as environmental dressing for authentic arcade aura.",
        codes: ['VALU: Revenue Density'],
      },
      {
        q: 'How do claw machines really work?',
        a: "Claw machines run on payout parameters. The technician sets the ratio—say 1-in-18 attempts. The claw lifts with full grip, then cuts voltage 50% at the top, dropping the toy. Only when the threshold is satisfied does it hold to the chute.",
        codes: ['MONA: Algorithmic Rigging'],
      },
      {
        q: 'Has digital payment changed things?',
        a: "Mini-Program scanning reduced theft and labor. But you sacrifice acoustic marketing. The sound of fifty brass tokens clattering into a metal tray turns every head on the floor. It's irreproducible sensory advertising.",
        codes: ['SOCI: Sensory Social Proof'],
      },
    ],
  },
  {
    id: 'dev-zhang',
    name: 'Developer Zhang',
    role: 'Indie Developer · Shanghai',
    portrait: 'warm',
    x: 820, y: 380,
    questions: [
      {
        q: 'What is the biggest challenge for indies?',
        a: "Securing an NPPA publishing license (ISBN). Review pipelines require exhaustive checks. For a five-person team with twelve months runway, waiting eighteen months for a license cycle is existentially fatal.",
        codes: ['FRIC: Regulatory Obstacles'],
      },
      {
        q: 'How do developers survive without licenses?',
        a: "Chinese indie developers rely on Steam Global as an offshore lifeline. Steam operates internationally without requiring a localized ISBN. Over 75% of our audience is domestic, but revenue clears through international rails.",
        codes: ['COMM: External Infrastructure'],
      },
      {
        q: 'How is AI changing development?',
        a: "We deploy AI for rapid pre-production concept art and script translation, reducing timelines 40%. But AI cannot balance a combat loop. Venture capital has abandoned non-live-service indie games.",
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
          <p><strong>Translation:</strong> Single-lane turret push distills competitive loop. J (special) cancels basic attack recovery frames—skill-based mechanical edge. Turret aggro redirects when attacking enemy hero in range.</p>
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
