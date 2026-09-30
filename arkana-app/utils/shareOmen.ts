import { Linking, Share } from 'react-native';
import { translate } from '@/services/i18n';

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
  return d.advice || d.proseOmen || translate('tw_quote_default', 'Consensus confirms the path forward.');
}

// English fallbacks; translations live in services/i18n.tsx under the same keys.
const TWEET_FALLBACKS: Record<string, string> = {
  tw_card_43_a: "The hardest trade in crypto isn't finding a 10x. It's walking away when the cup is full.\n\nArkana revealed Exit Position ({o}) for today's consensus.\n\n\"{quote}\"\n\nDay {streak} streak. Leaving the table before the market takes it back.\n#Solana #ArkanaTarot #Seeker #DeFi",
  tw_card_43_b: "Unstaking from stale positions to climb higher ground.\n\nDrawn into my daily consensus on @SolanaMobile: Exit Position ({o}).\n\n\"{quote}\"\n\nStreak: {streak} days 🔥 Real alpha is knowing when a cycle is finished.\n#Solana #ArkanaTarot #Seeker #ClockIn",
  tw_card_16_a: "When leverage meets gravity, the blockchain does not negotiate.\n\nArkana drawn: Liquidation ({o}).\n\n\"{quote}\"\n\nDay {streak}. De-risking my positions before the next block executes.\n#Solana #ArkanaTarot #Seeker #DeFAI",
  tw_card_16_b: "The fastest liquidation isn't caused by market volatility. It's caused by stubborn pride.\n\nAltar warning: Liquidation ({o}).\n\n\"{quote}\"\n\nDay {streak} consensus. Capital preserved is future alpha earned.\n#Solana #ArkanaTarot #Seeker",
  tw_card_15_a: "Greed is the most effective obfuscation tool in crypto.\n\nArkana flagged today's archetype: The Rug Pull ({o}).\n\nWarning: \"{quote}\"\n\nDay {streak} streak. Reading bytecode before chasing green candles.\n#Solana #ArkanaTarot #Seeker #DeFAI",
  tw_card_15_b: "The contract looked audited. The liquidity was locked. But the incentive structure was poison.\n\nArchetype revealed: The Rug Pull ({o}).\n\n\"{quote}\"\n\nDay {streak}. Validating code over hype on @SolanaMobile.\n#Solana #ArkanaTarot #Seeker",
  tw_card_08_a: "Conviction isn't holding through a 90% drawdown blindly. It's knowing exactly what you own when everyone else capitulates.\n\nAltar revealed: Diamond Hands ({o}).\n\n\"{quote}\"\n\nDay {streak} clock-in. Iron hands, cold mind.\n#Solana #ArkanaTarot #Seeker #ClockIn",
  tw_card_08_b: "Taming the market's volatility with internal validator calm.\n\nToday's consensus: Diamond Hands ({o}).\n\n\"{quote}\"\n\nDay {streak} streak. Conviction over noise.\n#Solana #ArkanaTarot #Seeker",
  tw_card_00_a: "Zero transaction history. Absolute unallocated sovereign potential.\n\nDrawn on Seeker Altar: The New Wallet ({o}).\n\n\"{quote}\"\n\nDay {streak} consensus. Every legend started with an empty address.\n#Solana #ArkanaTarot #Seeker #ClockIn",
  tw_card_00_b: "The beginner's mind in an unforgiving market.\n\nArkana revealed: The New Wallet ({o}).\n\n\"{quote}\"\n\nDay {streak} streak. Open to the cycle, disciplined with execution.\n#Solana #ArkanaTarot #Seeker",
  tw_card_19_a: "Euphoria is the highest tax in crypto. Don't let green candles blind your risk engine.\n\nArkana consensus: ATH ({o}).\n\n\"{quote}\"\n\nDay {streak} streak. Grateful for the expansion, disciplined with the profit.\n#Solana #ArkanaTarot #Seeker #DeFAI",
  tw_card_19_b: "All-Time Highs test your discipline far more than bear markets ever will.\n\nConsensus anchor: ATH ({o}).\n\n\"{quote}\"\n\nDay {streak} clock-in on @SolanaMobile Seeker.\n#Solana #ArkanaTarot #Seeker",
  tw_card_18_a: "The timeline is screaming, but the state machine is humming without a skip.\n\nArkana revealed: FUD ({o}).\n\n\"{quote}\"\n\nDay {streak}. Separating on-chain telemetry from timeline panic.\n#Solana #ArkanaTarot #Seeker",
  tw_card_18_b: "In the fog of market fear, the disciplined validator sees discounted conviction.\n\nAltar signal: FUD ({o}).\n\n\"{quote}\"\n\nDay {streak} streak. Looking past the shadows.\n#Solana #ArkanaTarot #Seeker #ClockIn",
  tw_card_10_a: "You are never as smart as you feel in a bull run, and never as cooked as you feel in a bear.\n\nArkana anchor: Market Cycle ({o}).\n\n\"{quote}\"\n\nDay {streak} streak. Riding the rotation with validator composure.\n#Solana #ArkanaTarot #Seeker",
  tw_card_10_b: "The market cycle doesn't care about your time horizon, unless you align with it.\n\nConsensus: Market Cycle ({o}).\n\n\"{quote}\"\n\nDay {streak} clock-in. Playing the long game.\n#Solana #ArkanaTarot #Seeker #ClockIn",
  tw_card_53_a: "Sometimes the most profitable on-chain move is doing absolutely nothing.\n\nArkana revealed: Cold Storage ({o}).\n\n\"{quote}\"\n\nDay {streak}. Disconnecting from the noise, letting the alpha compound in silence.\n#Solana #ArkanaTarot #Seeker",
  tw_card_53_b: "Overtrading is the easiest way to bleed alpha. Today's posture: Cold Storage ({o}).\n\n\"{quote}\"\n\nDay {streak} streak. Resting the keys, protecting the stack.\n#Solana #ArkanaTarot #Seeker",
  tw_card_68_a: "Winter is when the tourists leave and the sovereign protocols get built.\n\nAltar transmission: Crypto Winter ({o}).\n\n\"{quote}\"\n\nDay {streak} consensus. The ledger remembers who stayed through the freeze.\n#Solana #ArkanaTarot #Seeker #ClockIn",
  tw_card_68_b: "Surviving the drawdown is the only prerequisite for enjoying the expansion.\n\nArkana signal: Crypto Winter ({o}).\n\n\"{quote}\"\n\nDay {streak} streak. Enduring conviction.\n#Solana #ArkanaTarot #Seeker",
  tw_card_69_a: "Value flows to those who show up consistently before the snapshot.\n\nToday's archetype: Airdrop ({o}).\n\n\"{quote}\"\n\nDay {streak} streak clocking in on @SolanaMobile Seeker.\n#Solana #ArkanaTarot #Seeker #ClockIn",
  tw_card_69_b: "Decentralized reciprocity. Protocol dividends anchored on Seeker Altar: Airdrop ({o}).\n\n\"{quote}\"\n\nDay {streak}. Consistency rewarded on-chain.\n#Solana #ArkanaTarot #Seeker",
  tw_card_13_a: "Every dead branch pruned makes the root chain stronger.\n\nArkana revealed: The Hard Fork ({o}).\n\n\"{quote}\"\n\nDay {streak} consensus. Out with legacy baggage, forward into the new block.\n#Solana #ArkanaTarot #Seeker",
  tw_card_13_b: "Irreversible state transitions require the courage to let the old fork die.\n\nAltar consensus: The Hard Fork ({o}).\n\n\"{quote}\"\n\nDay {streak} streak. Upgrading the mental codebase.\n#Solana #ArkanaTarot #Seeker #ClockIn",
  tw_card_02_a: "The alpha is never on the public timeline. It's encoded in the state machine.\n\nConsulted Arkana: The Oracle ({o}).\n\n\"{quote}\"\n\nDay {streak} streak. Listening to the quiet signal beneath the noise.\n#Solana #ArkanaTarot #Seeker #DeFAI",
  tw_card_01_a: "Code is law, but intent is sovereign.\n\nDrawn: The Smart Contract Architect ({o}).\n\n\"{quote}\"\n\nDay {streak} consensus. Architecting reality block by block.\n#Solana #ArkanaTarot #Seeker #ClockIn",
  tw_card_24_a: "From testnet simulations to irreversible mainnet consensus.\n\nArkana revealed: Mainnet Launch ({o}).\n\n\"{quote}\"\n\nDay {streak} streak. Ships leaving the harbor into production.\n#Solana #ArkanaTarot #Seeker #ClockIn",
  tw_card_40_a: "Chasing 10,000% APY while watching your principal evaporate is the oldest ritual in DeFi.\n\nArkana reality check: Impermanent Loss ({o}).\n\n\"{quote}\"\n\nDay {streak}. Balancing risk against yield illusions.\n#Solana #ArkanaTarot #Seeker #DeFi",
  tw_card_42_a: "A watchlist of 50 altcoins isn't diversification. It's disguised FOMO.\n\nArkana signal: Too Many Tokens ({o}).\n\n\"{quote}\"\n\nDay {streak} streak. Cutting the dead weight, concentrating conviction.\n#Solana #ArkanaTarot #Seeker",
  tw_card_70_a: "Trees don't grow faster by pulling on their roots.\n\nArkana consensus: Long-Term HODL ({o}).\n\n\"{quote}\"\n\nDay {streak} clock-in. Allowing the thesis to mature.\n#Solana #ArkanaTarot #Seeker #ClockIn",
  tw_card_29_a: "Speed is an edge, but velocity without alignment is just a fast liquidation.\n\nDrawn: Instant Finality ({o}).\n\n\"{quote}\"\n\nDay {streak} streak on @SolanaMobile Seeker. Sub-second consensus.\n#Solana #ArkanaTarot #Seeker",
  tw_card_11_a: "The ledger doesn't care about narratives. Only verified signatures.\n\nAltar sealed: The Consensus ({o}).\n\n\"{quote}\"\n\nDay {streak} streak. Validating conviction over noise.\n#Solana #ArkanaTarot #Seeker #DeFAI",
  tw_card_04_a: "Sovereignty is not given; it is computed.\n\nDrawn into daily consensus: The Bitcoin King ({o}).\n\n\"{quote}\"\n\nDay {streak} streak. Standing firm on unshakeable fundamentals.\n#Solana #ArkanaTarot #Seeker",
  tw_card_07_a: "Momentum will carry you far, but discipline decides if you keep the spoils.\n\nAltar revealed: The Bull Run ({o}).\n\n\"{quote}\"\n\nDay {streak} streak. Harnessing the surge with total focus.\n#Solana #ArkanaTarot #Seeker #ClockIn",
  tw_card_17_a: "Hope is not a trading strategy, but long-term vision is an anchor in market turbulence.\n\nArkana revealed: Bull Market ({o}).\n\n\"{quote}\"\n\nDay {streak} consensus. Aligning with the higher cycle.\n#Solana #ArkanaTarot #Seeker",
  tw_card_20_a: "When the block height is reached, your on-chain history speaks louder than words.\n\nAltar consensus: Snapshot ({o}).\n\n\"{quote}\"\n\nDay {streak} streak on @SolanaMobile. Accountable to the ledger.\n#Solana #ArkanaTarot #Seeker #ClockIn",
  tw_card_21_a: "The cycle completes. Decentralization is no longer an experiment: it is the planetary state machine.\n\nArkana consensus: Mass Adoption ({o}).\n\n\"{quote}\"\n\nDay {streak} streak. We are early no more; we are here.\n#Solana #ArkanaTarot #Seeker #DeFAI",
  tw_card_03_a: "The most critical 12 words of your life. Sovereign custody isn't a feature; it's the entire ethos.\n\nAltar revealed: The Seed Phrase ({o}).\n\n\"{quote}\"\n\nDay {streak} streak. Guarding sovereign capital with zero trust assumptions.\n#Solana #ArkanaTarot #Seeker #ClockIn",
  tw_card_05_a: "Whales don't announce their moves on Twitter. They leave footprints in the order books.\n\nArkana consensus: The Whale ({o}).\n\n\"{quote}\"\n\nDay {streak}. Tracking smart capital while the crowd chases noise.\n#Solana #ArkanaTarot #Seeker #DeFAI",
  tw_card_06_a: "In DeFi, alignment is everything. Two protocols sharing liquidity or two minds synchronizing a thesis.\n\nDrawn: The Strategic Partnership ({o}).\n\n\"{quote}\"\n\nDay {streak} clock-in. Synchronizing intent on-chain.\n#Solana #ArkanaTarot #Seeker",
  tw_card_09_a: "While CT was doom-scrolling, the solo validator was optimizing rust clients in the dark.\n\nArkana signal: The Solo Validator ({o}).\n\n\"{quote}\"\n\nDay {streak} streak. Silence, focus, and uptime.\n#Solana #ArkanaTarot #Seeker #ClockIn",
  tw_card_12_a: "Voluntarily locking capital to secure consensus. Staking requires patience, trading instant gratification for protocol yield.\n\nArchetype: The Staked Position ({o}).\n\n\"{quote}\"\n\nDay {streak}. Delayed gratification on @SolanaMobile.\n#Solana #ArkanaTarot #Seeker",
  tw_card_14_a: "Blending speed with formal verification. The best audit is relentless discipline before testing on production.\n\nConsensus anchor: Smart Contract Audit ({o}).\n\n\"{quote}\"\n\nDay {streak} streak. Math over emotion.\n#Solana #ArkanaTarot #Seeker #DeFAI",
  tw_card_22_a: "One single transaction sparked an entire universe. All sovereign movements begin with a spark.\n\nDrawn: Genesis Block ({o}).\n\n\"{quote}\"\n\nDay {streak} clock-in. Igniting the cycle.\n#Solana #ArkanaTarot #Seeker #ClockIn",
  tw_card_28_a: "Priority fees spiking, block space contested. Standing firm when the entire mempool contends for the same slot.\n\nArkana battle signal: Gas War ({o}).\n\n\"{quote}\"\n\nDay {streak}. High-conviction execution under pressure.\n#Solana #ArkanaTarot #Seeker",
  tw_card_35_a: "Mutual liquidity between protocol and user. When incentives align, yields flow naturally without predatory unlocks.\n\nToday's consensus: Yield Farming ({o}).\n\n\"{quote}\"\n\nDay {streak} streak on Seeker.\n#Solana #ArkanaTarot #DeFi",
  tw_card_59_a: "Market-buying green candles on 10x leverage because the timeline was euphoric. The oracle warns of velocity without direction.\n\nAltar warning: FOMO Chaser ({o}).\n\n\"{quote}\"\n\nDay {streak}. Slowing down execution to save capital.\n#Solana #ArkanaTarot #Seeker",
  tw_card_64_a: "The bedrock of personal sovereignty. If you don't control the elliptic curve signatures, you own nothing.\n\nArkana foundation: Private Key ({o}).\n\n\"{quote}\"\n\nDay {streak} streak. Sovereign custody confirmed.\n#Solana #ArkanaTarot #Seeker #ClockIn",
  tw_card_77_a: "Architecting generational capital. The sovereign treasury outlasts every four-year cycle by managing risk like a nation-state.\n\nArchetype: DAO Treasury ({o}).\n\n\"{quote}\"\n\nDay {streak} consensus. Long-horizon stewardship.\n#Solana #ArkanaTarot #Seeker #DeFAI",
  tw_rev_1: "Arkana flagged an anomaly in my execution bias before I signed the next tx.\n\nDrawn: {card} ({o}).\n\nShadow warning: \"{quote}\"\n\nDay {streak} streak. Honoring the signal, sidestepping the trap.\n#Solana #ArkanaTarot #Seeker #DeFAI",
  tw_rev_2: "The market loves punishing overconfidence. Arkana revealed {card} ({o}) for today's consensus.\n\n\"{quote}\"\n\nPivoting stance before the next block. Day {streak}.\n#Solana #ArkanaTarot #Seeker",
  tw_rev_3: "Caught slipping by the oracle before the mempool caught me. Archetype: {card} ({o}).\n\nShadow insight: \"{quote}\"\n\nDay {streak} streak. Hedging downside, staying humble.\n#Solana #ArkanaTarot #ClockIn",
  tw_genesis_1: "A Genesis archetype hit the altar: #{no} {card} ({o}).\n\nConsensus transmission: \"{quote}\"\n\nMacro frequency over micro noise. Day {streak} consensus sealed on @SolanaMobile.\n#Solana #ArkanaTarot #Seeker #ClockIn",
  tw_genesis_2: "The state machine speaks in archetypes. Drawn into today's consensus: {card} ({o}).\n\n\"{quote}\"\n\nDay {streak} on-chain ritual. Aligning intent with the ledger.\n#ArkanaTarot #Solana #DeFAI",
  tw_genesis_3: "Tectonic market energy anchored on Seeker Altar: {card} ({o}).\n\n\"{quote}\"\n\nDay {streak} streak. Big cycles require calm hands.\n#Solana #ArkanaTarot #Seeker",
  tw_liq_1: "Liquidity flows where discipline anchors. Today's market consensus: {card} ({o}).\n\n\"{quote}\"\n\nDay {streak} streak. Protecting capital, taking conviction bets.\n#Solana #ArkanaTarot #DeFAI",
  tw_liq_2: "Navigating liquidity depth on @SolanaMobile. Archetype #{no}: {card} ({o}).\n\nFocus: \"{quote}\"\n\nDay {streak} clock-in. Clarity over chaos.\n#Solana #ArkanaTarot #Seeker",
  tw_liq_3: "The tape never lies, but human emotions do. Consulted Arkana: {card} ({o}).\n\n\"{quote}\"\n\nDay {streak} streak. Riding the flow with zero FOMO.\n#Solana #ArkanaTarot #Seeker #DeFi",
  tw_proto_1: "Execution without conviction is just wasted gas. Calibrated my edge today with {card} ({o}).\n\n\"{quote}\"\n\nDay {streak} consecutive blocks confirmed. Pure signal.\n#Solana #ArkanaTarot #Seeker #DeFAI",
  tw_proto_2: "In a high-frequency market, the calmest validator wins. Drawn: {card} ({o}).\n\n\"{quote}\"\n\nRefining my on-chain signal with @ArkanaOracle. Day {streak}.\n#Solana #ArkanaTarot #Seeker",
  tw_proto_3: "Smart contracts enforce logic; discipline enforces survival. Today's protocol vector: {card} ({o}).\n\n\"{quote}\"\n\nDay {streak} streak on @SolanaMobile.\n#Solana #ArkanaTarot #Seeker",
  tw_assets_1: "Capital preservation precedes capital appreciation. Arkana's security signal: {card} ({o}).\n\n\"{quote}\"\n\nHedged, focused, validating block by block. Day {streak} streak.\n#Solana #ArkanaTarot #Crypto",
  tw_assets_2: "The best risk management is disciplined consensus. Drawn: {card} ({o}) on Seeker Altar.\n\n\"{quote}\"\n\nStaying hedged in the mempool. Day {streak} 🔥\n#Solana #ArkanaTarot #Seeker",
  tw_assets_3: "Wealth on-chain is built in cycles, not single trades. Drawn: {card} ({o}).\n\n\"{quote}\"\n\nDay {streak} clock-in. Guarding the treasury.\n#Solana #ArkanaTarot #ClockIn",
  tw_nodes_1: "Syncing personal intent with the Solana state machine. Drawn: {card} ({o}).\n\n\"{quote}\"\n\nDay {streak} streak clocking in on @SolanaMobile Seeker. The ledger doesn't lie.\n#ArkanaTarot #Solana #ClockIn",
  tw_nodes_2: "Block consensus confirmed on @SolanaMobile. Archetype #{no}: {card} ({o}).\n\nTransmission: \"{quote}\"\n\nConsensus streak: {streak} consecutive blocks.\n#ArkanaTarot #SolanaMobile #ClockIn",
  tw_nodes_3: "A network is only as strong as its validators' conviction. Altar revealed: {card} ({o}).\n\n\"{quote}\"\n\nDay {streak} streak. Staking intent into reality.\n#Solana #ArkanaTarot #Seeker",
  tw_general_1: "The ledger does not lie. Drawn into my daily consensus on @SolanaMobile Seeker: {card} ({o}).\n\n\"{quote}\"\n\nStreak: {streak} days 🔥\n#Solana #Seeker #ArkanaTarot #ClockIn",
  tw_general_2: "Validating my market mindset before executing the next block. Arkana revealed {card} ({o}) for today's consensus.\n\n\"{quote}\"\n\nDay {streak} streak. Validating conviction over noise.\n#Solana #ArkanaTarot #Seeker #DeFAI",
  tw_general_3: "\"Every block is irreversible.\" Consulted Arkana, The Solana Oracle: drawn {card} ({o}).\n\nOracle guidance: \"{quote}\"\n\nConsensus streak: {streak} days. Staying hedged.\n#Solana #DeFi #Seeker #ArkanaTarot",
  tw_general_4: "Clocking in on the Seeker Altar. Daily consensus unlocked: {card} ({o}).\n\n\"{quote}\"\n\nDay {streak} streak 🔥 Refining my on-chain signal with @ArkanaOracle.\n#Seeker #ClockIn #Solana #ArkanaTarot",
};

/** Builds a tweet template that renders in the user's language. */
function tw(key: string): (d: ShareOmenData) => string {
  return (d) =>
    translate(key, TWEET_FALLBACKS[key], {
      card: d.cardName,
      no: d.cardNo,
      o: d.orientation === 'reversed' ? translate('orient_reversed', 'reversed') : translate('orient_upright', 'upright'),
      quote: getQuote(d),
      streak: d.streak || 1,
    });
}

// 1. Bespoke Card-Specific Templates with Captivating CT Hooks
const SPECIFIC_CARD_TEMPLATES: Record<string, ((d: ShareOmenData) => string)[]> = {
  // 43: Exit Position (Eight of Cups)
  '43': [
    tw('tw_card_43_a'),
    tw('tw_card_43_b'),
  ],

  // 16: Liquidation (The Tower)
  '16': [
    tw('tw_card_16_a'),
    tw('tw_card_16_b'),
  ],

  // 15: The Rug Pull (The Devil)
  '15': [
    tw('tw_card_15_a'),
    tw('tw_card_15_b'),
  ],

  // 08: Diamond Hands (Strength)
  '08': [
    tw('tw_card_08_a'),
    tw('tw_card_08_b'),
  ],

  // 00: The New Wallet (The Fool)
  '00': [
    tw('tw_card_00_a'),
    tw('tw_card_00_b'),
  ],

  // 19: ATH (The Sun)
  '19': [
    tw('tw_card_19_a'),
    tw('tw_card_19_b'),
  ],

  // 18: FUD (The Moon)
  '18': [
    tw('tw_card_18_a'),
    tw('tw_card_18_b'),
  ],

  // 10: Market Cycle (Wheel of Fortune)
  '10': [
    tw('tw_card_10_a'),
    tw('tw_card_10_b'),
  ],

  // 53: Cold Storage (Four of Swords)
  '53': [
    tw('tw_card_53_a'),
    tw('tw_card_53_b'),
  ],

  // 68: Crypto Winter (Five of Pentacles)
  '68': [
    tw('tw_card_68_a'),
    tw('tw_card_68_b'),
  ],

  // 69: Airdrop (Six of Pentacles)
  '69': [
    tw('tw_card_69_a'),
    tw('tw_card_69_b'),
  ],

  // 13: The Hard Fork (Death)
  '13': [
    tw('tw_card_13_a'),
    tw('tw_card_13_b'),
  ],

  // 02: The Oracle (The High Priestess)
  '02': [
    tw('tw_card_02_a'),
  ],

  // 01: The Smart Contract Architect (The Magician)
  '01': [
    tw('tw_card_01_a'),
  ],

  // 24: Mainnet Launch (Three of Wands)
  '24': [
    tw('tw_card_24_a'),
  ],

  // 40: Impermanent Loss (Five of Cups)
  '40': [
    tw('tw_card_40_a'),
  ],

  // 42: Too Many Tokens (Seven of Cups)
  '42': [
    tw('tw_card_42_a'),
  ],

  // 70: Long-Term HODL (Seven of Pentacles)
  '70': [
    tw('tw_card_70_a'),
  ],

  // 29: Instant Finality (Eight of Wands)
  '29': [
    tw('tw_card_29_a'),
  ],

  // 11: The Consensus (Justice)
  '11': [
    tw('tw_card_11_a'),
  ],

  // 04: The Bitcoin King (The Emperor)
  '04': [
    tw('tw_card_04_a'),
  ],

  // 07: The Bull Run (The Chariot)
  '07': [
    tw('tw_card_07_a'),
  ],

  // 17: Bull Market (The Star)
  '17': [
    tw('tw_card_17_a'),
  ],

  // 20: Snapshot (Judgement)
  '20': [
    tw('tw_card_20_a'),
  ],

  // 21: Mass Adoption (The World)
  '21': [
    tw('tw_card_21_a'),
  ],

  // 03: The Seed Phrase (The Empress)
  '03': [
    tw('tw_card_03_a'),
  ],

  // 05: The Whale (The Hierophant)
  '05': [
    tw('tw_card_05_a'),
  ],

  // 06: The Strategic Partnership (The Lovers)
  '06': [
    tw('tw_card_06_a'),
  ],

  // 09: The Solo Validator (The Hermit)
  '09': [
    tw('tw_card_09_a'),
  ],

  // 12: The Staked Position (The Hanged Man)
  '12': [
    tw('tw_card_12_a'),
  ],

  // 14: Smart Contract Audit (Temperance)
  '14': [
    tw('tw_card_14_a'),
  ],

  // 22: Genesis Block (Ace of Wands)
  '22': [
    tw('tw_card_22_a'),
  ],

  // 28: Gas War (Seven of Wands)
  '28': [
    tw('tw_card_28_a'),
  ],

  // 35: Yield Farming (Two of Cups)
  '35': [
    tw('tw_card_35_a'),
  ],

  // 59: FOMO Chaser (Knight of Swords)
  '59': [
    tw('tw_card_59_a'),
  ],

  // 64: Private Key (Ace of Pentacles)
  '64': [
    tw('tw_card_64_a'),
  ],

  // 77: DAO Treasury (King of Pentacles)
  '77': [
    tw('tw_card_77_a'),
  ],
};

// 2. Templates for REVERSED Cards (Shadows, Warnings, Cognitive Bias)
const REVERSED_TEMPLATES: ((d: ShareOmenData) => string)[] = [
  tw('tw_rev_1'),
  tw('tw_rev_2'),
  tw('tw_rev_3'),
];

// 3. Templates for Genesis cards
const GENESIS_TEMPLATES: ((d: ShareOmenData) => string)[] = [
  tw('tw_genesis_1'),
  tw('tw_genesis_2'),
  tw('tw_genesis_3'),
];

// 4. Suit: Liquidity (Trading, Exits, Capital Flow)
const LIQUIDITY_TEMPLATES: ((d: ShareOmenData) => string)[] = [
  tw('tw_liq_1'),
  tw('tw_liq_2'),
  tw('tw_liq_3'),
];

// 5. Suit: Protocols (Computation, MEV, Logic, Code)
const PROTOCOLS_TEMPLATES: ((d: ShareOmenData) => string)[] = [
  tw('tw_proto_1'),
  tw('tw_proto_2'),
  tw('tw_proto_3'),
];

// 6. Suit: Assets (Pentacles, HODL, Storage, Treasury)
const ASSETS_TEMPLATES: ((d: ShareOmenData) => string)[] = [
  tw('tw_assets_1'),
  tw('tw_assets_2'),
  tw('tw_assets_3'),
];

// 7. Suit: Nodes (Wands, Builders, Validators)
const NODES_TEMPLATES: ((d: ShareOmenData) => string)[] = [
  tw('tw_nodes_1'),
  tw('tw_nodes_2'),
  tw('tw_nodes_3'),
];

// 8. General / Universal Arkana Philosophy
const GENERAL_TEMPLATES: ((d: ShareOmenData) => string)[] = [
  tw('tw_general_1'),
  tw('tw_general_2'),
  tw('tw_general_3'),
  tw('tw_general_4'),
];

/**
 * Intelligent context-aware tweet generator.
 * Blends card-specific hooks, suit themes, reversed shadow warnings,
 * and universal Arkana lore, so shared posts stay varied.
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

  if (data.arcana === 'major') {
    pool.push(...GENESIS_TEMPLATES);
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
    title: translate('share_title', 'Arkana Consensus: {card}', { card: data.cardName }),
  });
}
