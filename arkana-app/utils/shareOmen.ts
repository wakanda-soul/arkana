import { Linking, Share } from 'react-native';

export interface ShareOmenData {
  cardName: string;
  cardNo: string;
  orientation: 'upright' | 'reversed';
  streak?: number;
  proseOmen?: string;
  spreadName?: string;
  advice?: string;
  shadow?: string;
  suit?: string;
  arcana?: string;
  keywords?: string[];
  classic?: string;
}

// Helper to get cleanest insight quote
function getQuote(d: ShareOmenData): string {
  if (d.orientation === 'reversed' && d.shadow) {
    return d.shadow;
  }
  return d.advice || d.proseOmen || 'Consensus confirms the path forward.';
}

// 1. Bespoke Card-Specific Templates with Captivating CT Hooks
const SPECIFIC_CARD_TEMPLATES: Record<string, ((d: ShareOmenData) => string)[]> = {
  // 43: Exit Position (Eight of Cups)
  '43': [
    (d) =>
      `The hardest trade in crypto isn't finding a 10x. It's walking away when the cup is full.\n\nArkana revealed Exit Position (${d.orientation}) for today's consensus.\n\n"${getQuote(d)}"\n\nDay ${d.streak || 1} streak. Leaving the table before the market takes it back.\n#Solana #ArkanaTarot #Seeker #DeFi`,
    (d) =>
      `Unstaking from stale positions to climb higher ground.\n\nDrawn into my daily consensus on @SolanaMobile: Exit Position (${d.orientation}).\n\n"${getQuote(d)}"\n\nStreak: ${d.streak || 1} days 🔥 Real alpha is knowing when a cycle is finished.\n#Solana #ArkanaTarot #Seeker #ClockIn`,
  ],

  // 16: Liquidation (The Tower)
  '16': [
    (d) =>
      `When leverage meets gravity, the blockchain does not negotiate.\n\nArkana drawn: Liquidation (${d.orientation}).\n\n"${getQuote(d)}"\n\nDay ${d.streak || 1}. De-risking my positions before the next block executes.\n#Solana #ArkanaTarot #Seeker #DeFAI`,
    (d) =>
      `The fastest liquidation isn't caused by market volatility—it's caused by stubborn pride.\n\nAltar warning: Liquidation (${d.orientation}).\n\n"${getQuote(d)}"\n\nDay ${d.streak || 1} consensus. Capital preserved is future alpha earned.\n#Solana #ArkanaTarot #Seeker`,
  ],

  // 15: The Rug Pull (The Devil)
  '15': [
    (d) =>
      `Greed is the most effective obfuscation tool in crypto.\n\nArkana flagged today's archetype: The Rug Pull (${d.orientation}).\n\nWarning: "${getQuote(d)}"\n\nDay ${d.streak || 1} streak. Reading bytecode before chasing green candles.\n#Solana #ArkanaTarot #Seeker #DeFAI`,
    (d) =>
      `The contract looked audited. The liquidity was locked. But the incentive structure was poison.\n\nArchetype revealed: The Rug Pull (${d.orientation}).\n\n"${getQuote(d)}"\n\nDay ${d.streak || 1}. Validating code over hype on @SolanaMobile.\n#Solana #ArkanaTarot #Seeker`,
  ],

  // 08: Diamond Hands (Strength)
  '08': [
    (d) =>
      `Conviction isn't holding through a 90% drawdown blindly. It's knowing exactly what you own when everyone else capitulates.\n\nAltar revealed: Diamond Hands (${d.orientation}).\n\n"${getQuote(d)}"\n\nDay ${d.streak || 1} clock-in. Iron hands, cold mind.\n#Solana #ArkanaTarot #Seeker #ClockIn`,
    (d) =>
      `Taming the market's volatility with internal validator calm.\n\nToday's consensus: Diamond Hands (${d.orientation}).\n\n"${getQuote(d)}"\n\nDay ${d.streak || 1} streak. Conviction over noise.\n#Solana #ArkanaTarot #Seeker`,
  ],

  // 00: The New Wallet (The Fool)
  '00': [
    (d) =>
      `Zero transaction history. Absolute unallocated sovereign potential.\n\nDrawn on Seeker Altar: The New Wallet (${d.orientation}).\n\n"${getQuote(d)}"\n\nDay ${d.streak || 1} consensus. Every legend started with an empty address.\n#Solana #ArkanaTarot #Seeker #ClockIn`,
    (d) =>
      `The beginner's mind in an unforgiving market.\n\nArkana revealed: The New Wallet (${d.orientation}).\n\n"${getQuote(d)}"\n\nDay ${d.streak || 1} streak. Open to the cycle, disciplined with execution.\n#Solana #ArkanaTarot #Seeker`,
  ],

  // 19: ATH (The Sun)
  '19': [
    (d) =>
      `Euphoria is the highest tax in crypto. Don't let green candles blind your risk engine.\n\nArkana consensus: ATH (${d.orientation}).\n\n"${getQuote(d)}"\n\nDay ${d.streak || 1} streak. Grateful for the expansion, disciplined with the profit.\n#Solana #ArkanaTarot #Seeker #DeFAI`,
    (d) =>
      `All-Time Highs test your discipline far more than bear markets ever will.\n\nConsensus anchor: ATH (${d.orientation}).\n\n"${getQuote(d)}"\n\nDay ${d.streak || 1} clock-in on @SolanaMobile Seeker.\n#Solana #ArkanaTarot #Seeker`,
  ],

  // 18: FUD (The Moon)
  '18': [
    (d) =>
      `The timeline is screaming, but the state machine is humming without a skip.\n\nArkana revealed: FUD (${d.orientation}).\n\n"${getQuote(d)}"\n\nDay ${d.streak || 1}. Separating on-chain telemetry from timeline panic.\n#Solana #ArkanaTarot #Seeker`,
    (d) =>
      `In the fog of market fear, the disciplined validator sees discounted conviction.\n\nAltar signal: FUD (${d.orientation}).\n\n"${getQuote(d)}"\n\nDay ${d.streak || 1} streak. Looking past the shadows.\n#Solana #ArkanaTarot #Seeker #ClockIn`,
  ],

  // 10: Market Cycle (Wheel of Fortune)
  '10': [
    (d) =>
      `You are never as smart as you feel in a bull run, and never as cooked as you feel in a bear.\n\nArkana anchor: Market Cycle (${d.orientation}).\n\n"${getQuote(d)}"\n\nDay ${d.streak || 1} streak. Riding the rotation with validator composure.\n#Solana #ArkanaTarot #Seeker`,
    (d) =>
      `The market cycle doesn't care about your time horizon—unless you align with it.\n\nConsensus: Market Cycle (${d.orientation}).\n\n"${getQuote(d)}"\n\nDay ${d.streak || 1} clock-in. Playing the long game.\n#Solana #ArkanaTarot #Seeker #ClockIn`,
  ],

  // 53: Cold Storage (Four of Swords)
  '53': [
    (d) =>
      `Sometimes the most profitable on-chain move is doing absolutely nothing.\n\nArkana revealed: Cold Storage (${d.orientation}).\n\n"${getQuote(d)}"\n\nDay ${d.streak || 1}. Disconnecting from the noise, letting the alpha compound in silence.\n#Solana #ArkanaTarot #Seeker`,
    (d) =>
      `Overtrading is the easiest way to bleed alpha. Today's posture: Cold Storage (${d.orientation}).\n\n"${getQuote(d)}"\n\nDay ${d.streak || 1} streak. Resting the keys, protecting the stack.\n#Solana #ArkanaTarot #Seeker`,
  ],

  // 68: Crypto Winter (Five of Pentacles)
  '68': [
    (d) =>
      `Winter is when the tourists leave and the sovereign protocols get built.\n\nAltar transmission: Crypto Winter (${d.orientation}).\n\n"${getQuote(d)}"\n\nDay ${d.streak || 1} consensus. The ledger remembers who stayed through the freeze.\n#Solana #ArkanaTarot #Seeker #ClockIn`,
    (d) =>
      `Surviving the drawdown is the only prerequisite for enjoying the expansion.\n\nArkana signal: Crypto Winter (${d.orientation}).\n\n"${getQuote(d)}"\n\nDay ${d.streak || 1} streak. Enduring conviction.\n#Solana #ArkanaTarot #Seeker`,
  ],

  // 69: Airdrop (Six of Pentacles)
  '69': [
    (d) =>
      `Value flows to those who show up consistently before the snapshot.\n\nToday's archetype: Airdrop (${d.orientation}).\n\n"${getQuote(d)}"\n\nDay ${d.streak || 1} streak clocking in on @SolanaMobile Seeker.\n#Solana #ArkanaTarot #Seeker #ClockIn`,
    (d) =>
      `Decentralized reciprocity. Protocol dividends anchored on Seeker Altar: Airdrop (${d.orientation}).\n\n"${getQuote(d)}"\n\nDay ${d.streak || 1}. Consistency rewarded on-chain.\n#Solana #ArkanaTarot #Seeker`,
  ],

  // 13: The Hard Fork (Death)
  '13': [
    (d) =>
      `Every dead branch pruned makes the root chain stronger.\n\nArkana revealed: The Hard Fork (${d.orientation}).\n\n"${getQuote(d)}"\n\nDay ${d.streak || 1} consensus. Out with legacy baggage, forward into the new block.\n#Solana #ArkanaTarot #Seeker`,
    (d) =>
      `Irreversible state transitions require the courage to let the old fork die.\n\nAltar consensus: The Hard Fork (${d.orientation}).\n\n"${getQuote(d)}"\n\nDay ${d.streak || 1} streak. Upgrading the mental codebase.\n#Solana #ArkanaTarot #Seeker #ClockIn`,
  ],

  // 02: The Oracle (The High Priestess)
  '02': [
    (d) =>
      `The alpha is never on the public timeline. It's encoded in the state machine.\n\nConsulted Arkana: The Oracle (${d.orientation}).\n\n"${getQuote(d)}"\n\nDay ${d.streak || 1} streak. Listening to the quiet signal beneath the noise.\n#Solana #ArkanaTarot #Seeker #DeFAI`,
  ],

  // 01: The Smart Contract Architect (The Magician)
  '01': [
    (d) =>
      `Code is law, but intent is sovereign.\n\nDrawn: The Smart Contract Architect (${d.orientation}).\n\n"${getQuote(d)}"\n\nDay ${d.streak || 1} consensus. Architecting reality block by block.\n#Solana #ArkanaTarot #Seeker #ClockIn`,
  ],

  // 24: Mainnet Launch (Three of Wands)
  '24': [
    (d) =>
      `From testnet simulations to irreversible mainnet consensus.\n\nArkana revealed: Mainnet Launch (${d.orientation}).\n\n"${getQuote(d)}"\n\nDay ${d.streak || 1} streak. Ships leaving the harbor into production.\n#Solana #ArkanaTarot #Seeker #ClockIn`,
  ],

  // 40: Impermanent Loss (Five of Cups)
  '40': [
    (d) =>
      `Chasing 10,000% APY while watching your principal evaporate is the oldest ritual in DeFi.\n\nArkana reality check: Impermanent Loss (${d.orientation}).\n\n"${getQuote(d)}"\n\nDay ${d.streak || 1}. Balancing risk against yield illusions.\n#Solana #ArkanaTarot #Seeker #DeFi`,
  ],

  // 42: Too Many Tokens (Seven of Cups)
  '42': [
    (d) =>
      `A watchlist of 50 altcoins isn't diversification. It's disguised FOMO.\n\nArkana signal: Too Many Tokens (${d.orientation}).\n\n"${getQuote(d)}"\n\nDay ${d.streak || 1} streak. Cutting the dead weight, concentrating conviction.\n#Solana #ArkanaTarot #Seeker`,
  ],

  // 70: Long-Term HODL (Seven of Pentacles)
  '70': [
    (d) =>
      `Trees don't grow faster by pulling on their roots.\n\nArkana consensus: Long-Term HODL (${d.orientation}).\n\n"${getQuote(d)}"\n\nDay ${d.streak || 1} clock-in. Allowing the thesis to mature.\n#Solana #ArkanaTarot #Seeker #ClockIn`,
  ],

  // 29: Instant Finality (Eight of Wands)
  '29': [
    (d) =>
      `Speed is an edge, but velocity without alignment is just a fast liquidation.\n\nDrawn: Instant Finality (${d.orientation}).\n\n"${getQuote(d)}"\n\nDay ${d.streak || 1} streak on @SolanaMobile Seeker. Sub-second consensus.\n#Solana #ArkanaTarot #Seeker`,
  ],

  // 11: The Consensus (Justice)
  '11': [
    (d) =>
      `The ledger doesn't care about narratives. Only verified signatures.\n\nAltar sealed: The Consensus (${d.orientation}).\n\n"${getQuote(d)}"\n\nDay ${d.streak || 1} streak. Validating conviction over noise.\n#Solana #ArkanaTarot #Seeker #DeFAI`,
  ],

  // 04: The Bitcoin King (The Emperor)
  '04': [
    (d) =>
      `Sovereignty is not given; it is computed.\n\nDrawn into daily consensus: The Bitcoin King (${d.orientation}).\n\n"${getQuote(d)}"\n\nDay ${d.streak || 1} streak. Standing firm on unshakeable fundamentals.\n#Solana #ArkanaTarot #Seeker`,
  ],

  // 07: The Bull Run (The Chariot)
  '07': [
    (d) =>
      `Momentum will carry you far, but discipline decides if you keep the spoils.\n\nAltar revealed: The Bull Run (${d.orientation}).\n\n"${getQuote(d)}"\n\nDay ${d.streak || 1} streak. Harnessing the surge with total focus.\n#Solana #ArkanaTarot #Seeker #ClockIn`,
  ],

  // 17: Bull Market (The Star)
  '17': [
    (d) =>
      `Hope is not a trading strategy, but long-term vision is an anchor in market turbulence.\n\nArkana revealed: Bull Market (${d.orientation}).\n\n"${getQuote(d)}"\n\nDay ${d.streak || 1} consensus. Aligning with the higher cycle.\n#Solana #ArkanaTarot #Seeker`,
  ],

  // 20: Snapshot (Judgement)
  '20': [
    (d) =>
      `When the block height is reached, your on-chain history speaks louder than words.\n\nAltar consensus: Snapshot (${d.orientation}).\n\n"${getQuote(d)}"\n\nDay ${d.streak || 1} streak on @SolanaMobile. Accountable to the ledger.\n#Solana #ArkanaTarot #Seeker #ClockIn`,
  ],

  // 21: Mass Adoption (The World)
  '21': [
    (d) =>
      `The cycle completes. Decentralization is no longer an experiment—it is the planetary state machine.\n\nArkana consensus: Mass Adoption (${d.orientation}).\n\n"${getQuote(d)}"\n\nDay ${d.streak || 1} streak. We are early no more; we are here.\n#Solana #ArkanaTarot #Seeker #DeFAI`,
  ],

  // 03: The Seed Phrase (The Empress)
  '03': [
    (d) =>
      `The most critical 12 words of your life. Sovereign custody isn't a feature; it's the entire ethos.\n\nAltar revealed: The Seed Phrase (${d.orientation}).\n\n"${getQuote(d)}"\n\nDay ${d.streak || 1} streak. Guarding sovereign capital with zero trust assumptions.\n#Solana #ArkanaTarot #Seeker #ClockIn`,
  ],

  // 05: The Whale (The Hierophant)
  '05': [
    (d) =>
      `Whales don't announce their moves on Twitter. They leave footprints in the order books.\n\nArkana consensus: The Whale (${d.orientation}).\n\n"${getQuote(d)}"\n\nDay ${d.streak || 1}. Tracking smart capital while the crowd chases noise.\n#Solana #ArkanaTarot #Seeker #DeFAI`,
  ],

  // 06: The Strategic Partnership (The Lovers)
  '06': [
    (d) =>
      `In DeFi, alignment is everything. Two protocols sharing liquidity or two minds synchronizing a thesis.\n\nDrawn: The Strategic Partnership (${d.orientation}).\n\n"${getQuote(d)}"\n\nDay ${d.streak || 1} clock-in. Synchronizing intent on-chain.\n#Solana #ArkanaTarot #Seeker`,
  ],

  // 09: The Solo Validator (The Hermit)
  '09': [
    (d) =>
      `While CT was doom-scrolling, the solo validator was optimizing rust clients in the dark.\n\nArkana signal: The Solo Validator (${d.orientation}).\n\n"${getQuote(d)}"\n\nDay ${d.streak || 1} streak. Silence, focus, and uptime.\n#Solana #ArkanaTarot #Seeker #ClockIn`,
  ],

  // 12: The Staked Position (The Hanged Man)
  '12': [
    (d) =>
      `Voluntarily locking capital to secure consensus. Staking requires patience, trading instant gratification for protocol yield.\n\nArchetype: The Staked Position (${d.orientation}).\n\n"${getQuote(d)}"\n\nDay ${d.streak || 1}. Delayed gratification on @SolanaMobile.\n#Solana #ArkanaTarot #Seeker`,
  ],

  // 14: Smart Contract Audit (Temperance)
  '14': [
    (d) =>
      `Blending speed with formal verification. The best audit is relentless discipline before testing on production.\n\nConsensus anchor: Smart Contract Audit (${d.orientation}).\n\n"${getQuote(d)}"\n\nDay ${d.streak || 1} streak. Math over emotion.\n#Solana #ArkanaTarot #Seeker #DeFAI`,
  ],

  // 22: Genesis Block (Ace of Wands)
  '22': [
    (d) =>
      `One single transaction sparked an entire universe. All sovereign movements begin with a spark.\n\nDrawn: Genesis Block (${d.orientation}).\n\n"${getQuote(d)}"\n\nDay ${d.streak || 1} clock-in. Igniting the cycle.\n#Solana #ArkanaTarot #Seeker #ClockIn`,
  ],

  // 28: Gas War (Seven of Wands)
  '28': [
    (d) =>
      `Priority fees spiking, block space contested. Standing firm when the entire mempool contends for the same slot.\n\nArkana battle signal: Gas War (${d.orientation}).\n\n"${getQuote(d)}"\n\nDay ${d.streak || 1}. High-conviction execution under pressure.\n#Solana #ArkanaTarot #Seeker`,
  ],

  // 35: Yield Farming (Two of Cups)
  '35': [
    (d) =>
      `Mutual liquidity between protocol and user. When incentives align, yields flow naturally without predatory unlocks.\n\nToday's consensus: Yield Farming (${d.orientation}).\n\n"${getQuote(d)}"\n\nDay ${d.streak || 1} streak on Seeker.\n#Solana #ArkanaTarot #DeFi`,
  ],

  // 59: FOMO Chaser (Knight of Swords)
  '59': [
    (d) =>
      `Market-buying green candles on 10x leverage because the timeline was euphoric. The oracle warns of velocity without direction.\n\nAltar warning: FOMO Chaser (${d.orientation}).\n\n"${getQuote(d)}"\n\nDay ${d.streak || 1}. Slowing down execution to save capital.\n#Solana #ArkanaTarot #Seeker`,
  ],

  // 64: Private Key (Ace of Pentacles)
  '64': [
    (d) =>
      `The bedrock of personal sovereignty. If you don't control the elliptic curve signatures, you own nothing.\n\nArkana foundation: Private Key (${d.orientation}).\n\n"${getQuote(d)}"\n\nDay ${d.streak || 1} streak. Sovereign custody confirmed.\n#Solana #ArkanaTarot #Seeker #ClockIn`,
  ],

  // 77: DAO Treasury (King of Pentacles)
  '77': [
    (d) =>
      `Architecting generational capital. The sovereign treasury outlasts every four-year cycle by managing risk like a nation-state.\n\nArchetype: DAO Treasury (${d.orientation}).\n\n"${getQuote(d)}"\n\nDay ${d.streak || 1} consensus. Long-horizon stewardship.\n#Solana #ArkanaTarot #Seeker #DeFAI`,
  ],
};

// 2. Templates for REVERSED Cards (Shadows, Warnings, Cognitive Bias)
const REVERSED_TEMPLATES: ((d: ShareOmenData) => string)[] = [
  (d) =>
    `Arkana flagged an anomaly in my execution bias before I signed the next tx.\n\nDrawn: ${d.cardName} (reversed).\n\nShadow warning: "${getQuote(d)}"\n\nDay ${d.streak || 1} streak. Honoring the signal, sidestepping the trap.\n#Solana #ArkanaTarot #Seeker #DeFAI`,

  (d) =>
    `The market loves punishing overconfidence. Arkana revealed ${d.cardName} (reversed) for today's consensus.\n\n"${getQuote(d)}"\n\nPivoting stance before the next block. Day ${d.streak || 1}.\n#Solana #ArkanaTarot #Seeker`,

  (d) =>
    `Caught slipping by the oracle before the mempool caught me. Archetype: ${d.cardName} (reversed).\n\nShadow insight: "${getQuote(d)}"\n\nDay ${d.streak || 1} streak. Hedging downside, staying humble.\n#Solana #ArkanaTarot #ClockIn`,
];

// 3. Templates for Major Arcana
const MAJOR_TEMPLATES: ((d: ShareOmenData) => string)[] = [
  (d) =>
    `A Major Archetype hit the altar: #${d.cardNo} ${d.cardName} (${d.orientation}).\n\nConsensus transmission: "${getQuote(d)}"\n\nMacro frequency over micro noise. Day ${d.streak || 1} consensus sealed on @SolanaMobile.\n#Solana #ArkanaTarot #Seeker #ClockIn`,

  (d) =>
    `The state machine speaks in archetypes. Drawn into today's consensus: ${d.cardName} (${d.orientation}).\n\n"${getQuote(d)}"\n\nDay ${d.streak || 1} on-chain ritual. Aligning intent with the ledger.\n#ArkanaTarot #Solana #DeFAI`,

  (d) =>
    `Tectonic market energy anchored on Seeker Altar: ${d.cardName} (${d.orientation}).\n\n"${getQuote(d)}"\n\nDay ${d.streak || 1} streak. Big cycles require calm hands.\n#Solana #ArkanaTarot #Seeker`,
];

// 4. Suit: Liquidity (Trading, Exits, Capital Flow)
const LIQUIDITY_TEMPLATES: ((d: ShareOmenData) => string)[] = [
  (d) =>
    `Liquidity flows where discipline anchors. Today's market consensus: ${d.cardName} (${d.orientation}).\n\n"${getQuote(d)}"\n\nDay ${d.streak || 1} streak. Protecting capital, taking conviction bets.\n#Solana #ArkanaTarot #DeFAI`,

  (d) =>
    `Navigating liquidity depth on @SolanaMobile. Archetype #${d.cardNo}: ${d.cardName} (${d.orientation}).\n\nFocus: "${getQuote(d)}"\n\nDay ${d.streak || 1} clock-in. Clarity over chaos.\n#Solana #ArkanaTarot #Seeker`,

  (d) =>
    `The tape never lies, but human emotions do. Consulted Arkana: ${d.cardName} (${d.orientation}).\n\n"${getQuote(d)}"\n\nDay ${d.streak || 1} streak. Riding the flow with zero FOMO.\n#Solana #ArkanaTarot #Seeker #DeFi`,
];

// 5. Suit: Protocols (Computation, MEV, Logic, Code)
const PROTOCOLS_TEMPLATES: ((d: ShareOmenData) => string)[] = [
  (d) =>
    `Execution without conviction is just wasted gas. Calibrated my edge today with ${d.cardName} (${d.orientation}).\n\n"${getQuote(d)}"\n\nDay ${d.streak || 1} consecutive blocks confirmed. Pure signal.\n#Solana #ArkanaTarot #Seeker #DeFAI`,

  (d) =>
    `In a high-frequency market, the calmest validator wins. Drawn: ${d.cardName} (${d.orientation}).\n\n"${getQuote(d)}"\n\nRefining my on-chain signal with @ArkanaOracle. Day ${d.streak || 1}.\n#Solana #ArkanaTarot #Seeker`,

  (d) =>
    `Smart contracts enforce logic; discipline enforces survival. Today's protocol vector: ${d.cardName} (${d.orientation}).\n\n"${getQuote(d)}"\n\nDay ${d.streak || 1} streak on @SolanaMobile.\n#Solana #ArkanaTarot #Seeker`,
];

// 6. Suit: Assets (Pentacles, HODL, Storage, Treasury)
const ASSETS_TEMPLATES: ((d: ShareOmenData) => string)[] = [
  (d) =>
    `Capital preservation precedes capital appreciation. Arkana's security signal: ${d.cardName} (${d.orientation}).\n\n"${getQuote(d)}"\n\nHedged, focused, validating block by block. Day ${d.streak || 1} streak.\n#Solana #ArkanaTarot #Crypto`,

  (d) =>
    `The best risk management is disciplined consensus. Drawn: ${d.cardName} (${d.orientation}) on Seeker Altar.\n\n"${getQuote(d)}"\n\nStaying hedged in the mempool. Day ${d.streak || 1} 🔥\n#Solana #ArkanaTarot #Seeker`,

  (d) =>
    `Wealth on-chain is built in cycles, not single trades. Drawn: ${d.cardName} (${d.orientation}).\n\n"${getQuote(d)}"\n\nDay ${d.streak || 1} clock-in. Guarding the treasury.\n#Solana #ArkanaTarot #ClockIn`,
];

// 7. Suit: Nodes (Wands, Builders, Validators)
const NODES_TEMPLATES: ((d: ShareOmenData) => string)[] = [
  (d) =>
    `Syncing personal intent with the Solana state machine. Drawn: ${d.cardName} (${d.orientation}).\n\n"${getQuote(d)}"\n\nDay ${d.streak || 1} streak clocking in on @SolanaMobile Seeker. The ledger doesn't lie.\n#ArkanaTarot #Solana #ClockIn`,

  (d) =>
    `Block consensus confirmed on @SolanaMobile. Archetype #${d.cardNo}: ${d.cardName} (${d.orientation}).\n\nTransmission: "${getQuote(d)}"\n\nConsensus streak: ${d.streak || 1} consecutive blocks.\n#ArkanaTarot #SolanaMobile #ClockIn`,

  (d) =>
    `A network is only as strong as its validators' conviction. Altar revealed: ${d.cardName} (${d.orientation}).\n\n"${getQuote(d)}"\n\nDay ${d.streak || 1} streak. Staking intent into reality.\n#Solana #ArkanaTarot #Seeker`,
];

// 8. General / Universal Arkana Philosophy
const GENERAL_TEMPLATES: ((d: ShareOmenData) => string)[] = [
  (d) =>
    `The ledger does not lie. Drawn into my daily consensus on @SolanaMobile Seeker: ${d.cardName} (${d.orientation}).\n\n"${getQuote(d)}"\n\nStreak: ${d.streak || 1} days 🔥\n#Solana #Seeker #ArkanaTarot #ClockIn`,

  (d) =>
    `Validating my market mindset before executing the next block. Arkana revealed ${d.cardName} (${d.orientation}) for today's consensus.\n\n"${getQuote(d)}"\n\nDay ${d.streak || 1} streak. Validating conviction over noise.\n#Solana #ArkanaTarot #Seeker #DeFAI`,

  (d) =>
    `"Every block is irreversible." Consulted Arkana, The Solana Oracle: drawn ${d.cardName} (${d.orientation}).\n\nOracle guidance: "${getQuote(d)}"\n\nConsensus streak: ${d.streak || 1} days. Staying hedged.\n#Solana #DeFi #Seeker #ArkanaTarot`,

  (d) =>
    `Clocking in on the Seeker Altar. Daily consensus unlocked: ${d.cardName} (${d.orientation}).\n\n"${getQuote(d)}"\n\nDay ${d.streak || 1} streak 🔥 Refining my on-chain signal with @ArkanaOracle.\n#Seeker #ClockIn #Solana #ArkanaTarot`,
];

/**
 * Intelligent context-aware tweet generator.
 * Blends card-specific hooks, suit themes, reversed shadow warnings,
 * and universal Arkana lore to prevent bot detection and maximize engagement.
 */
export function generateTweetText(data: ShareOmenData): string {
  const rawNo = data.cardNo ? String(data.cardNo).trim() : '';
  const parsedNum = parseInt(rawNo, 10);
  const normalizedNo = !isNaN(parsedNum) ? String(parsedNum).padStart(2, '0') : rawNo;
  const strippedNo = !isNaN(parsedNum) ? String(parsedNum) : rawNo;

  const cardSpecific = SPECIFIC_CARD_TEMPLATES[normalizedNo] || SPECIFIC_CARD_TEMPLATES[strippedNo];

  // 65% priority to dedicated card hook if available
  if (cardSpecific && cardSpecific.length > 0 && Math.random() < 0.65) {
    return cardSpecific[Math.floor(Math.random() * cardSpecific.length)](data);
  }

  // Dynamic candidate pool
  const pool: ((d: ShareOmenData) => string)[] = [];

  if (data.orientation === 'reversed') {
    pool.push(...REVERSED_TEMPLATES);
    pool.push(...REVERSED_TEMPLATES); // Double weight for shadow insights
  }

  if (data.arcana === 'major' || data.suit === 'Major Arcana') {
    pool.push(...MAJOR_TEMPLATES);
  } else if (data.suit === 'Liquidity') {
    pool.push(...LIQUIDITY_TEMPLATES);
  } else if (data.suit === 'Protocols') {
    pool.push(...PROTOCOLS_TEMPLATES);
  } else if (data.suit === 'Assets') {
    pool.push(...ASSETS_TEMPLATES);
  } else if (data.suit === 'Nodes') {
    pool.push(...NODES_TEMPLATES);
  }

  // Always include general templates for organic variety
  pool.push(...GENERAL_TEMPLATES);

  const selected = pool[Math.floor(Math.random() * pool.length)];
  return selected(data);
}

/**
 * Open Twitter / X intent with context-aware tweet
 */
export async function shareToTwitter(data: ShareOmenData) {
  const text = generateTweetText(data);
  const tweetUrl = `https://twitter.com/intent/tweet?text=${encodeURIComponent(text)}`;

  try {
    await Linking.openURL(tweetUrl);
  } catch {
    await Linking.openURL(`https://x.com/intent/tweet?text=${encodeURIComponent(text)}`);
  }
}

/**
 * Native Android system share sheet for sharing to Telegram, Discord, etc.
 */
export async function shareGeneral(data: ShareOmenData) {
  const text = generateTweetText(data);

  await Share.share({
    message: text,
    title: `Arkana Consensus: ${data.cardName}`,
  });
}
