// Offline Card Codex & Spreads Registry
export interface CardData {
  crypto_name: string;
  classic: string;
  suit: string;
  arcana: string;
  card_no: string;
  image: string;
  keywords: string[];
  energy: string | null;
  symbolism: string;
  advice: string;
  shadow: string;
  upright_full: string;
  reversed_full: string;
}

export const SPREADS = {
  "daily-block": {
    "name": "The Daily Block",
    "positions": [
      "Today's Consensus"
    ],
    "hints": {
      "Today's Consensus": "the prevailing energy validating your day and trading mindset"
    }
  },
  "network-scan": {
    "name": "The Network Scan",
    "positions": [
      "Past",
      "Present",
      "Next Block"
    ],
    "hints": {
      "Past": "the block that set the current chain in motion",
      "Present": "the current state of the Network - the trend or barrier you stand in",
      "Next Block": "the most probable next step if nothing changes (a direction, not a verdict)"
    }
  },
  "validator-cross": {
    "name": "The Validator Cross",
    "positions": [
      "Current State",
      "Main Opportunity",
      "Main Obstacle",
      "Hidden Influence",
      "Outcome if the current path continues"
    ],
    "hints": {
      "Current State": "where you stand; the core of the question",
      "Main Opportunity": "the strongest supportive force / the opening",
      "Main Obstacle": "the central challenge crossing the situation",
      "Hidden Influence": "the undercurrent you don't see (weight reversed cards heavily)",
      "Outcome if the current path continues": "the tendency if nothing changes (conditional)"
    }
  },
  "crypto-compass": {
    "name": "The Crypto Compass",
    "positions": [
      "You",
      "Market",
      "Project",
      "Opportunity",
      "Risk"
    ],
    "hints": {
      "You": "your real position, mindset, readiness",
      "Market": "the external conditions / macro sentiment",
      "Project": "the thing itself, on its own merits",
      "Opportunity": "the realistic upside / what can be gained",
      "Risk": "what can break it (the shadow to manage)"
    }
  }
};

export const ALL_CARDS: CardData[] = [
  {
    "crypto_name": "Genesis Treasury",
    "classic": "Ace of Pentacles",
    "suit": "Assets",
    "arcana": "minor",
    "card_no": "64",
    "image": "/cards/64.webp",
    "keywords": [
      "Treasury",
      "Investment",
      "Wealth",
      "Opportunity"
    ],
    "energy": null,
    "symbolism": "A hand of light presents a colossal golden Crypto Sigil engraved with the Genesis Block above a flourishing garden of Merkle trees and NFT blossoms, a path leading to a DAO palace. As the Ace of the earth suit, it is a tangible new seed of wealth - opportunity made solid, ready to be planted. The most grounded of beginnings.",
    "advice": "A real opportunity is on the table; ground it in a plan before you seize it.",
    "shadow": "A golden seed left in careless hands rots into a missed opportunity.",
    "upright_full": "This card is a concrete new opportunity: fresh capital, a real chance to earn, the seed of lasting wealth. Genesis Treasury rewards taking a solid, tangible opening and planting it well. The upside is real and material - ground it in a plan before you seize it.",
    "reversed_full": "Reversed, the seed is squandered: a missed opportunity, poor money management, a bad investment, potential that never takes root. The golden sigil slips through careless hands. The chance was real, but mishandled."
  },
  {
    "crypto_name": "Portfolio Balance",
    "classic": "Two of Pentacles",
    "suit": "Assets",
    "arcana": "minor",
    "card_no": "65",
    "image": "/cards/65.webp",
    "keywords": [
      "Portfolio",
      "Diversification",
      "Balance"
    ],
    "energy": null,
    "symbolism": "A young investor gracefully juggles two enormous Crypto Sigils bound by an infinite golden ribbon, standing before a turbulent ocean of bull and bear waves. The Two is dynamic balance - keeping multiple assets and priorities in motion at once, agility amid volatility. Equilibrium as an active skill.",
    "advice": "Keep both sides of the portfolio balanced; rebalance the moment one outweighs the other.",
    "shadow": "Juggling one asset too many is how the whole set hits the floor.",
    "upright_full": "This card is balance and adaptability: managing a diversified portfolio, juggling competing priorities, staying nimble as conditions shift. Portfolio Balance rewards flexibility and good allocation. Keep both balls in the air - but don't add a third you can't hold.",
    "reversed_full": "Reversed, the juggle collapses: an overloaded portfolio, poor allocation, dropping the ball, spread too thin to manage anything well. The ribbon tangles. Too many things demand attention at once."
  },
  {
    "crypto_name": "Builders DAO",
    "classic": "Three of Pentacles",
    "suit": "Assets",
    "arcana": "minor",
    "card_no": "66",
    "image": "/cards/66.webp",
    "keywords": [
      "DAO",
      "Builders",
      "Teamwork"
    ],
    "energy": null,
    "symbolism": "Three legendary builders raise a Blockchain Cathedral together - one drafting blueprints, one writing glowing smart contracts, one carving cryptographic symbols. The Three is collaborative craft - complementary skills combining into something greater than any could build alone. Structure through teamwork.",
    "advice": "Build with others whose skills complete yours; align the roles clearly.",
    "shadow": "Three builders with no shared blueprint raise three crooked walls.",
    "upright_full": "This card is teamwork and skilled collaboration: complementary talents building something solid together, the first real results of coordinated effort. Builders DAO rewards aligning roles and respecting each specialist's craft. Build with others whose skills complete yours.",
    "reversed_full": "Reversed, the collaboration falters: miscommunication, misaligned roles, weak leadership, a cathedral half-built and crooked. The builders work at cross-purposes. Coordination breaks down."
  },
  {
    "crypto_name": "Diamond Vault",
    "classic": "Four of Pentacles",
    "suit": "Assets",
    "arcana": "minor",
    "card_no": "67",
    "image": "/cards/67.webp",
    "keywords": [
      "HODL",
      "Vault",
      "Security"
    ],
    "energy": null,
    "symbolism": "A wealthy vault keeper clutches a massive Crypto Sigil to his chest, two more beneath his feet, one on his throne, a Vault Fortress rising behind. The Four is holding tight - security and accumulation that can tip into hoarding. Control through possession.",
    "advice": "Protect what you have - but a locked vault also stops the flow.",
    "shadow": "Gripping the sigil so tightly that nothing new can ever reach your hand.",
    "upright_full": "This card is disciplined holding: protecting capital, accumulating, securing what you've built, resisting the urge to spend or sell. Diamond Vault rewards prudent security and long-term conviction. Protect what you have - but remember a sealed vault also stops the flow.",
    "reversed_full": "Reversed, security becomes a cage: greed, fear of investing, capital stagnating, white-knuckle hoarding that blocks growth. The keeper grips so tightly nothing can circulate. Holding turns into clinging."
  },
  {
    "crypto_name": "Crypto Winter",
    "classic": "Five of Pentacles",
    "suit": "Assets",
    "arcana": "minor",
    "card_no": "68",
    "image": "/cards/68.webp",
    "keywords": [
      "Winter",
      "Bear Market",
      "Recovery"
    ],
    "energy": null,
    "symbolism": "Two exhausted travellers cross a frozen blockchain wasteland during crypto winter while a radiant Blockchain Cathedral glows warmly nearby, its shelter unnoticed. The Five is hardship - the bear market of the soul, scarcity and cold, with help closer than the cold lets you see. Trial with a door out.",
    "advice": "Winters end; the shelter is closer than the cold lets you see.",
    "shadow": "Trudging past the lit cathedral because pride won't let you ask for warmth.",
    "upright_full": "This card is hardship and scarcity: a bear market, financial trials, a cold stretch that tests endurance. Crypto Winter is real, but the warm cathedral stands just beside the travellers - help and shelter exist if you look up. Winters end.",
    "reversed_full": "Reversed, the thaw begins: recovery, the end of the crisis, community help arriving, warmth returning. The travellers reach the door at last. The worst of the cold is passing."
  },
  {
    "crypto_name": "Airdrop",
    "classic": "Six of Pentacles",
    "suit": "Assets",
    "arcana": "minor",
    "card_no": "69",
    "image": "/cards/69.webp",
    "keywords": [
      "Airdrop",
      "DAO",
      "Reward"
    ],
    "energy": null,
    "symbolism": "A noble benefactor distributes radiant Crypto Sigils to grateful network participants beneath a glowing DAO emblem. The Six is the flow of giving and receiving - reward fairly distributed, generosity in balance. The circulation of abundance.",
    "advice": "Give or receive freely, but watch for gifts with hidden strings.",
    "shadow": "An airdrop that always lands in the same hands is charity as control.",
    "upright_full": "This card is generosity and fair exchange: an airdrop, a reward distributed, giving and receiving in healthy balance. Airdrop rewards open-handedness and the grace to receive as well as give. Let value flow - freely and fairly.",
    "reversed_full": "Reversed, the flow distorts: unfair distribution, gifts with strings attached, dependency, a power imbalance between giver and taker. The airdrop favours insiders. Generosity becomes control, or charity becomes a leash."
  },
  {
    "crypto_name": "Long-Term HODL",
    "classic": "Seven of Pentacles",
    "suit": "Assets",
    "arcana": "minor",
    "card_no": "70",
    "image": "/cards/70.webp",
    "keywords": [
      "HODL",
      "Patience",
      "Investment"
    ],
    "energy": null,
    "symbolism": "A wise investor peacefully observes an ancient Merkle tree bearing golden Crypto Sigils instead of fruit, the harvest almost ripe under a radiant sky. The Seven is patient assessment - the long pause where you tend what you planted and wait for it to mature. Faith in slow growth.",
    "advice": "You've planted well; don't dig up the seeds to check on them.",
    "shadow": "Harvesting the tree the week before it ripens forfeits the whole crop.",
    "upright_full": "This card is patience and the long view: a long-term investment maturing, a moment to assess progress and let the harvest ripen. Long-Term HODL rewards those who resist the urge to pick early. You've planted well - don't dig up the seeds to check on them.",
    "reversed_full": "Reversed, patience snaps: impatience, selling too early, disappointment that the results aren't instant. The investor uproots the crop before it's ripe. Short-term frustration undoes long-term work."
  },
  {
    "crypto_name": "Master Builder",
    "classic": "Eight of Pentacles",
    "suit": "Assets",
    "arcana": "minor",
    "card_no": "71",
    "image": "/cards/71.webp",
    "keywords": [
      "Craftsmanship",
      "NFT",
      "Skill"
    ],
    "energy": null,
    "symbolism": "A master artisan hand-forges Crypto Sigils in a glowing workshop, each engraved with a unique cryptographic mark, NFT artifacts and tools scattered around. The Eight is devoted craft - mastery earned through diligent repetition. Skill compounding stroke by stroke.",
    "advice": "Perfect the craft; quality compounds like the best asset.",
    "shadow": "A master who stops refining watches his craft quietly decay to crude work.",
    "upright_full": "This card is dedicated craftsmanship: refining a skill, doing the diligent work, building mastery through repetition. Master Builder rewards patient, quality-focused effort. Perfect the craft - quality compounds like the best asset.",
    "reversed_full": "Reversed, the craft slips: sloppy work, loss of quality, cutting corners, no discipline, going through the motions. The engravings turn crude. Mastery decays without diligence."
  },
  {
    "crypto_name": "Whale Estate",
    "classic": "Nine of Pentacles",
    "suit": "Assets",
    "arcana": "minor",
    "card_no": "72",
    "image": "/cards/72.webp",
    "keywords": [
      "Luxury",
      "Wealth",
      "NFT",
      "Independence"
    ],
    "energy": null,
    "symbolism": "An elegant crypto noblewoman walks through a luxurious blockchain estate of NFT sculptures and golden gardens, a mechanical falcon on her arm. The Nine is self-made refinement - independent prosperity enjoyed alone, the fruit of one's own discipline. Earned luxury.",
    "advice": "Enjoy what you built alone; make sure the wealth didn't cost the connection.",
    "shadow": "An estate this beautiful, walked entirely alone, is a gilded kind of exile.",
    "upright_full": "This card is independent, self-made success: refined prosperity, the freedom that comes from having built your own wealth. Whale Estate rewards the discipline that earned the estate. Enjoy what you built alone - you deserve the garden.",
    "reversed_full": "Reversed, the estate isolates: loneliness behind the wealth, arrogance, material dependence, success that cost the connection. The falcon is the only company. Prosperity without belonging rings hollow."
  },
  {
    "crypto_name": "Legacy Chain",
    "classic": "Ten of Pentacles",
    "suit": "Assets",
    "arcana": "minor",
    "card_no": "73",
    "image": "/cards/73.webp",
    "keywords": [
      "Legacy",
      "Dynasty",
      "Family",
      "Wealth"
    ],
    "energy": null,
    "symbolism": "Three generations of a crypto dynasty stand before a Blockchain Palace beneath ten radiant Crypto Sigils forming a sacred circle around the Tree of Legacy, its roots in the Genesis Block. The Ten is completion and inheritance - wealth that outlasts one lifetime, built for those who come after. Enduring abundance.",
    "advice": "Build for the generation after you, not just the next candle.",
    "shadow": "A dynasty that fights over the fruit lets the whole tree rot at the root.",
    "upright_full": "This card is lasting legacy: generational wealth, deep stability, long-term success that endures beyond you. Legacy Chain rewards building for the generation after the next candle. This is the fulfilment of the earth suit - wealth rooted deep enough to last.",
    "reversed_full": "Reversed, the legacy fractures: family conflict, capital destroyed, an inheritance squandered, foundations that don't hold. The tree's roots rot or the heirs fight over the fruit. What was built to last comes undone."
  },
  {
    "crypto_name": "NFT Collector",
    "classic": "Page of Pentacles",
    "suit": "Assets",
    "arcana": "minor",
    "card_no": "74",
    "image": "/cards/74.webp",
    "keywords": [
      "NFT",
      "Collector",
      "Learning",
      "Investment"
    ],
    "energy": null,
    "symbolism": "A young collector studies a floating Crypto Sigil holding a legendary animated NFT, a grand blockchain gallery of digital masterpieces behind him. As the Page of earth, he is the diligent student of value - curious, careful, just beginning to accumulate. Grounded beginner ambition.",
    "advice": "Study before you collect; curiosity is capital when it's disciplined.",
    "shadow": "Collecting hype you never researched is how a jpeg becomes a lesson.",
    "upright_full": "This card is the curious student of value: a first investment, careful study, the early accumulation of assets and knowledge. NFT Collector rewards learning-before-buying and grounded curiosity. Study before you collect; curiosity is capital when it's disciplined.",
    "reversed_full": "Reversed, curiosity turns careless: impulsive buys, overvaluing hype, inexperience mistaking a jpeg for a fortune. The Page collects without understanding. Enthusiasm outruns due diligence."
  },
  {
    "crypto_name": "Long-Term Investor",
    "classic": "Knight of Pentacles",
    "suit": "Assets",
    "arcana": "minor",
    "card_no": "75",
    "image": "/cards/75.webp",
    "keywords": [
      "Investor",
      "HODL",
      "Discipline",
      "Patience"
    ],
    "energy": null,
    "symbolism": "A noble investor rides a mechanical bull slowly across golden blockchain valleys, a radiant Crypto Sigil in hand, embodying patience and discipline. As the Knight of earth, he is the steady, dependable accumulator - methodical, reliable, in no hurry. Slow, sure progress.",
    "advice": "Slow and methodical wins the long game; just don't stall entirely.",
    "shadow": "A bull ridden too cautiously never actually crosses the valley.",
    "upright_full": "This card is disciplined, methodical progress: reliable long-term accumulation, patience, dependability. Long-Term Investor rewards the steady hand that wins the marathon, not the sprint. Slow and methodical wins the long game.",
    "reversed_full": "Reversed, steadiness stalls: over-caution, excessive slowness, missed opportunities from moving too carefully, dependability tipping into inertia. The bull barely moves. Prudence becomes paralysis."
  },
  {
    "crypto_name": "Treasury Keeper",
    "classic": "Queen of Pentacles",
    "suit": "Assets",
    "arcana": "minor",
    "card_no": "76",
    "image": "/cards/76.webp",
    "keywords": [
      "Treasury",
      "Prosperity",
      "Stability",
      "Wealth"
    ],
    "energy": null,
    "symbolism": "A majestic keeper sits enthroned on ancient gold and Genesis Blocks, a huge Crypto Sigil in hand, golden Merkle trees bearing tokens and NFT relics around her in serene abundance. As the Queen of earth, she is nurturing prosperity - practical, generous stewardship of wealth. Abundance tended like a garden.",
    "advice": "Tend capital like a garden - steward it, don't just guard it.",
    "shadow": "Measuring your worth in sigils is how the treasury keeper starves the soul.",
    "upright_full": "This card is wise, nurturing stewardship of resources: financial wisdom, care for capital, practical prosperity, stability that provides for others. Treasury Keeper rewards tending wealth rather than merely guarding it. Steward capital like a garden.",
    "reversed_full": "Reversed, stewardship sours: greed, materialism, smothering, poor resource management, self-worth measured in coins. The garden is over-harvested or neglected. Nurture turns to hoarding or waste."
  },
  {
    "crypto_name": "Blockchain Tycoon",
    "classic": "King of Pentacles",
    "suit": "Assets",
    "arcana": "minor",
    "card_no": "77",
    "image": "/cards/77.webp",
    "keywords": [
      "Wealth",
      "Leadership",
      "Legacy",
      "Prosperity",
      "Authority"
    ],
    "energy": null,
    "symbolism": "The supreme magnate sits on a throne carved from gold and Genesis Blocks, a crown of rotating Crypto Sigils on his head, colossal mechanical bulls guarding the Blockchain Capital behind him. As the King of earth, he is mastery of the material world - abundance, authority, and responsibility fully realized. Prosperity commanded with a steady hand.",
    "advice": "Lead with the abundance you've mastered; guard against it mastering you.",
    "shadow": "A crown of sigils worn too long is how wealth quietly starts wearing the man.",
    "upright_full": "This card is mastery of wealth and worldly success: mature leadership, long-term prosperity, the security and generosity of one who has truly built. Blockchain Tycoon rewards leading with the abundance you've mastered. Provide, protect, and steward at scale.",
    "reversed_full": "Reversed, mastery corrupts: avarice, over-control, corruption, financial blindness, power hoarded rather than shared. The tycoon is owned by his own gold. Wealth becomes the master instead of the tool."
  },
  {
    "crypto_name": "Genesis Liquidity",
    "classic": "Ace of Cups",
    "suit": "Liquidity",
    "arcana": "minor",
    "card_no": "36",
    "image": "/cards/36.webp",
    "keywords": [
      "Liquidity",
      "Capital",
      "DeFi",
      "Opportunity"
    ],
    "energy": null,
    "symbolism": "A radiant hand rises from the mist holding a crystal chalice of living blue liquidity, four rivers pouring from its lip into newborn DeFi protocols. This is the Ace as first cause - the genesis block of feeling and capital, the moment a fountain switches on. It is pure potential before it has chosen a shape.",
    "advice": "Direct this new flow into a chosen channel before it drains away unused.",
    "shadow": "Letting the source overflow untended until it evaporates into missed potential.",
    "upright_full": "A fresh channel of flow is opening: new income, new capital, or a new emotional current that wants to be received rather than seized. The card marks a beginning that feels overflowing and generous, a source that has not yet been depleted. Its energy is soft but real, and it rewards those who cup their hands and let it fill.",
    "reversed_full": "The chalice tips and the rivers run dry - liquidity drought, blocked feeling, a stagnant pool that no longer circulates. Opportunity was present but went unnoticed or unwatered, and the flow retreats underground. It is less punishment than pause: the spring is still there, waiting to be unclogged."
  },
  {
    "crypto_name": "Liquidity Pair",
    "classic": "Two of Cups",
    "suit": "Liquidity",
    "arcana": "minor",
    "card_no": "37",
    "image": "/cards/37.webp",
    "keywords": [
      "LP",
      "Swap",
      "Partnership",
      "Pool"
    ],
    "energy": null,
    "symbolism": "Two alchemists face each other and exchange chalices, their streams intertwining midair into an infinity symbol - a living LP pair. The Two is the archetype of union: two distinct assets bonded into one pool, each backing the other's value. It is the sacred mathematics of reciprocity, where two become a market.",
    "advice": "Keep both sides of the pool equal, and rebalance the moment one begins to outweigh the other.",
    "shadow": "Pouring yourself into a union that quietly takes more than it returns.",
    "upright_full": "A balanced partnership forms, whether in love, business, or a liquidity pool, and its strength lies in genuine mutual benefit. Both sides bring equal weight; both sides are seen. The card blesses swaps of energy and trust where neither party is drained to fill the other.",
    "reversed_full": "The pair falls out of balance - one side heavier, one side taking more than it gives. Impermanent loss creeps in, a union quietly bleeds value, or a promising connection fails to bond. The imbalance is not always malice; often it is simple divergence in what each side is worth over time."
  },
  {
    "crypto_name": "Yield Festival",
    "classic": "Three of Cups",
    "suit": "Liquidity",
    "arcana": "minor",
    "card_no": "38",
    "image": "/cards/38.webp",
    "keywords": [
      "Yield",
      "Farming",
      "DAO",
      "Celebration"
    ],
    "energy": null,
    "symbolism": "Three guardians raise their chalices over a flourishing DeFi garden where golden tokens bloom like flowers. The Three is community made visible - the moment private gain becomes shared celebration. It is the harvest festival of a healthy DAO, where yield is not hoarded but toasted.",
    "advice": "Share the harvest openly, because a community that farms together sustains its yield longer.",
    "shadow": "Letting the celebration curdle into cliques, factionalism, or hollow revelry.",
    "upright_full": "Success multiplies when it is shared: a thriving community, a productive farm, a circle that celebrates each other's wins. The card radiates the warmth of collective momentum, where cooperation compounds returns. Belonging itself becomes a form of yield.",
    "reversed_full": "The festival sours into faction - DAO infighting, falling yields, collaborators who stop pulling together. The garden goes untended as the guardians squabble over the harvest. What was communal turns cliquish, or the shared abundance simply thins."
  },
  {
    "crypto_name": "Idle Capital",
    "classic": "Four of Cups",
    "suit": "Liquidity",
    "arcana": "minor",
    "card_no": "39",
    "image": "/cards/39.webp",
    "keywords": [
      "Opportunity",
      "Yield",
      "Passivity"
    ],
    "energy": null,
    "symbolism": "An investor rests under a Merkle tree, arms crossed, ignoring the chalice a celestial hand extends toward him. The Four is the archetype of apathy amid plenty - capital that sits unstaked, feeling that has gone numb. Three cups already stand at his feet, and still he sees only what bores him.",
    "advice": "Look up from your apathy and examine the offer you have been ignoring.",
    "shadow": "Mistaking comfortable stagnation for peace while opportunity quietly expires.",
    "upright_full": "Attention has gone flat: capital idles, offers are waved away, and a subtle discontent keeps you from seeing what is already on the table. This is not scarcity but satiety - too comfortable to reach, too jaded to notice. The fourth cup hovers, patiently unclaimed.",
    "reversed_full": "The fog of disinterest lifts and motivation returns; the extended chalice is finally seen and accepted. A new chance re-engages you, or you rediscover value in what you had dismissed. Openness comes back online, and idle capital finds a channel."
  },
  {
    "crypto_name": "Impermanent Loss",
    "classic": "Five of Cups",
    "suit": "Liquidity",
    "arcana": "minor",
    "card_no": "40",
    "image": "/cards/40.webp",
    "keywords": [
      "Impermanent Loss",
      "Recovery",
      "Emotion"
    ],
    "energy": null,
    "symbolism": "A lone investor mourns three spilled chalices while two full ones stand behind him, unnoticed. The Five is grief in the presence of remainder - the drawdown that consumes all attention, the impermanent loss felt as permanent. His cloak is heavy, his gaze fixed on what leaked away.",
    "advice": "Grieve the spill fully if you must, then deliberately turn to the two cups still standing.",
    "shadow": "Nursing the loss so long that you spill the cups you had left.",
    "upright_full": "Loss lands and demands to be felt: a capital drop, a regret, an emotional pressure that colors everything. The pain is real, yet the card gently insists it may be temporary and partial - two cups remain standing. For now, though, the spill has the mourner's full and narrowed focus.",
    "reversed_full": "The head turns, and the two full chalices come into view - recovery, acceptance, the first step forward. The loss is metabolized rather than denied, and new opportunity becomes visible again. What felt permanent reveals its impermanence, and the position begins to heal."
  },
  {
    "crypto_name": "Genesis Memories",
    "classic": "Six of Cups",
    "suit": "Liquidity",
    "arcana": "minor",
    "card_no": "41",
    "image": "/cards/41.webp",
    "keywords": [
      "Genesis",
      "Bitcoin",
      "Nostalgia",
      "Mentorship"
    ],
    "energy": null,
    "symbolism": "In the Genesis city, an elder hands a chalice to a younger builder among old ASIC miners and the first cold wallets. The Six is memory as gift - the transmission of origins from those who were early to those just arriving. It is nostalgia turned generative, the cypherpunk campfire where lore is passed forward.",
    "advice": "Honor the origins and mentor the newcomers, but refuse to build your home in the last cycle.",
    "shadow": "Worshipping the genesis so completely that you sleep through the present.",
    "upright_full": "The past becomes a resource: hard-won experience, respect for how things began, and the joy of mentoring newcomers. There is sweetness in returning to first principles and in giving away what you once learned the hard way. Origins nourish the present rather than trap it.",
    "reversed_full": "Nostalgia hardens into refusal - clinging to the last cycle, dismissing new tech, mistaking the map of the past for the territory ahead. The elder stops handing over the cup and simply guards it. Reverence for genesis curdles into stagnation."
  },
  {
    "crypto_name": "Too Many Tokens",
    "classic": "Seven of Cups",
    "suit": "Liquidity",
    "arcana": "minor",
    "card_no": "42",
    "image": "/cards/42.webp",
    "keywords": [
      "Tokens",
      "Choice",
      "FOMO",
      "Opportunity"
    ],
    "energy": null,
    "symbolism": "Seven chalices float in a haze, each a temptation - memecoin, NFT, AI-token, DeFi, GameFi, RWA - and one shadowed cup hiding a Rug Pull. The Seven is the archetype of dazzling overchoice, the mind's fog machine where every option glitters equally. Some cups hold treasure; at least one hides a demon.",
    "advice": "Analyze each glittering option on its merits before you choose, because some cups hide demons.",
    "shadow": "Reaching for the shiniest illusion instead of doing the unglamorous work of verification.",
    "upright_full": "A field of tempting possibilities spreads out, rich with prospects but heavy with the need to think clearly. The card asks for analysis over appetite, for grounding the imagination before it commits. Real opportunity is present, but so is the mirage.",
    "reversed_full": "The fog wins: illusions, FOMO, and wishful thinking pull you toward the shiniest cup, which too often conceals a scam. A choice made on hype rather than diligence goes wrong. The reversed card is the rug you didn't check for under the glitter."
  },
  {
    "crypto_name": "Exit Position",
    "classic": "Eight of Cups",
    "suit": "Liquidity",
    "arcana": "minor",
    "card_no": "43",
    "image": "/cards/43.webp",
    "keywords": [
      "Exit",
      "Profit",
      "Journey",
      "Transition"
    ],
    "energy": null,
    "symbolism": "A traveler leaves eight full chalices behind and walks toward the glowing mountains of a new cycle. The Eight is the archetype of the deliberate exit - turning from what is complete, even when it still looks full, toward what calls from beyond. It is the courage to unstake and journey on.",
    "advice": "Give yourself permission to exit a full position and walk toward the path that calls you.",
    "shadow": "Clutching stale cups out of fear while the meaningful journey waits at the threshold.",
    "upright_full": "Something has run its course, and the wise move is to leave it - take profit, close a chapter, seek a path with more meaning. The cups behind are not failures; they are simply finished. The card honors the quiet bravery of walking away while you still can.",
    "reversed_full": "The traveler hesitates at the threshold, gripped by fear of change, and stays clutching cups that have gone stale. Dead assets are held out of attachment or inertia rather than conviction. The journey that would renew you is deferred, and the position rots in place."
  },
  {
    "crypto_name": "Whale's Vault",
    "classic": "Nine of Cups",
    "suit": "Liquidity",
    "arcana": "minor",
    "card_no": "44",
    "image": "/cards/44.webp",
    "keywords": [
      "Whale",
      "Wealth",
      "Satisfaction",
      "Success"
    ],
    "energy": null,
    "symbolism": "A wealthy whale sits content before nine glowing chalices arranged inside an immense DeFi treasury. The Nine is the wish fulfilled - the archetype of earned satisfaction, the vault filled and the appetite met. It is comfort made visible, the smile of one whose bags are secure.",
    "advice": "Savor the satisfaction fully, while keeping the disciplines that filled the vault in the first place.",
    "shadow": "Letting contentment curdle into complacency, greed, or the illusion of permanent mastery.",
    "upright_full": "Well-being arrives: successful investments, financial stability, and the simple pleasure of enough. The card blesses contentment and the enjoyment of what you have built. This is the moment to savor, not to grasp.",
    "reversed_full": "Satisfaction slides into complacency, greed, or overconfidence - the whale who mistakes a good cycle for permanent mastery. Smugness invites carelessness, and the vault feels safer than it is. Enough is quietly redefined as never enough."
  },
  {
    "crypto_name": "Financial Freedom",
    "classic": "Ten of Cups",
    "suit": "Liquidity",
    "arcana": "minor",
    "card_no": "45",
    "image": "/cards/45.webp",
    "keywords": [
      "Family",
      "Wealth",
      "Freedom",
      "Legacy"
    ],
    "energy": null,
    "symbolism": "A crypto family stands before a future metropolis beneath a rainbow arch of ten chalices, DAO palaces gleaming beyond. The Ten is fulfillment made communal - the archetype of lasting harmony where wealth and belonging finally coincide. It is the sovereign fund of the heart, generational and shared.",
    "advice": "Protect the harmony and shared trust that made this freedom possible in the first place.",
    "shadow": "Chasing the postcard of fulfillment while the bonds beneath it quietly fracture.",
    "upright_full": "This is the fullest cup of the suit: financial freedom braided together with harmony, family, and long-term success. Prosperity here is not lonely - it is shared and it endures. The card marks a legacy taking shape, wealth that protects a way of life.",
    "reversed_full": "The rainbow fractures: loss of unity, financial conflict, or shattered expectations where the picture-perfect ending fails to hold. Money strains the bonds it was meant to serve, or harmony proves more image than substance. The dream and the reality drift apart."
  },
  {
    "crypto_name": "Yield Apprentice",
    "classic": "Page of Cups",
    "suit": "Liquidity",
    "arcana": "minor",
    "card_no": "46",
    "image": "/cards/46.webp",
    "keywords": [
      "Beginner",
      "Yield",
      "LP",
      "Curiosity"
    ],
    "energy": null,
    "symbolism": "A young apprentice studies a chalice from which a small glowing digital koi rises, LP tokens drifting like petals around them. The Page is the archetype of the beginner's open heart - curiosity unspoiled, the first tentative pour into DeFi. Wonder is their whole method, and it is both their gift and their exposure.",
    "advice": "Explore DeFi with open curiosity, and verify every contract and claim before you ape in.",
    "shadow": "Mistaking naive enthusiasm for understanding and drinking from the first shiny cup offered.",
    "upright_full": "A fresh learner arrives with genuine openness: first investments, new ideas, the willingness to be delighted and surprised. The card favors playful study and the courage to start before you know everything. Beginner's mind is an edge when it stays curious and humble.",
    "reversed_full": "Openness slips into naivety - aping in without checking, believing the pretty koi is the whole ocean, falling for the first scam dressed as opportunity. Inexperience becomes a liability when enthusiasm outruns diligence. The apprentice mistakes wonder for wisdom."
  },
  {
    "crypto_name": "Yield Farmer",
    "classic": "Knight of Cups",
    "suit": "Liquidity",
    "arcana": "minor",
    "card_no": "47",
    "image": "/cards/47.webp",
    "keywords": [
      "Yield",
      "APY",
      "Farming",
      "Action"
    ],
    "energy": null,
    "symbolism": "A knight rides a cyber-seahorse across a river of liquidity, new LP pools forming in the wake behind him. The Knight is the archetype of the yield quester - motion in pursuit of an ideal, romance aimed at returns. He is graceful and driven, always riding toward the next pool.",
    "advice": "Farm actively with a plan, because a blind chase for the highest APY usually ends in loss.",
    "shadow": "Confusing restless yield-chasing with progress until greed rides you off the cliff.",
    "upright_full": "This is active, questing energy: putting capital to work, chasing yield with skill, growing a position through movement rather than waiting. The Knight brings charm and momentum to the farm. At his best he is a disciplined seeker who lets returns compound behind him.",
    "reversed_full": "The quest degrades into greed - chasing the highest APY off a cliff, taking excessive risk, mistaking motion for progress. The Knight gallops into farms that are too good to be true. Yield-chasing without diligence typically ends where all mirages end."
  },
  {
    "crypto_name": "DeFi Matriarch",
    "classic": "Queen of Cups",
    "suit": "Liquidity",
    "arcana": "minor",
    "card_no": "48",
    "image": "/cards/48.webp",
    "keywords": [
      "DeFi",
      "Wisdom",
      "Prosperity",
      "Nurture"
    ],
    "energy": null,
    "symbolism": "A queen sits enthroned amid cascading liquidity waterfalls, holding a chalice from which newborn tokens rise. The Queen is the archetype of intuitive stewardship - the matriarch who feels the market's currents and tends capital like a garden. Her power is emotional intelligence made productive.",
    "advice": "Steward capital with intuition and wisdom while keeping emotion out of the driver's seat.",
    "shadow": "Letting feeling flood the banks until intuition becomes reactivity and control slips away.",
    "upright_full": "Intuition and financial wisdom combine into graceful stewardship: caring for capital, reading sentiment, nurturing prosperity without force. The Queen holds resources the way one holds water - firmly enough to keep it, gently enough not to spill. She turns feeling into insight.",
    "reversed_full": "The waters flood their banks: emotional decisions, reactivity, and a loss of financial control. Intuition untethered from discipline becomes moodiness driving the portfolio. The nurturing turns either into martyrdom or into being swept away by every sentiment."
  },
  {
    "crypto_name": "Liquidity Sovereign",
    "classic": "King of Cups",
    "suit": "Liquidity",
    "arcana": "minor",
    "card_no": "49",
    "image": "/cards/49.webp",
    "keywords": [
      "Liquidity",
      "DeFi",
      "Mastery",
      "Capital"
    ],
    "energy": null,
    "symbolism": "A ruler sits on a throne floating at the center of an infinite ocean of liquidity, colossal DeFi protocols orbiting like planets. The King is the archetype of masterful equanimity - the sovereign who commands vast flows while remaining perfectly still. He rules the water by not being ruled by it.",
    "advice": "Master the flow with a calm mind: command the ocean without ever stirring it for your own gain.",
    "shadow": "A composed exterior hiding either manipulation for profit or a storm you have lost control of.",
    "upright_full": "This is emotional and financial maturity in full: capital under calm control, long-term thinking, the composure of hard-won experience. The King neither suppresses feeling nor is governed by it - he holds the ocean steady. His mastery is measured, patient, and quietly immense.",
    "reversed_full": "The calm turns cold or corrupt: market manipulation, abuse of power, or the opposite - emotional instability behind a controlled mask. The sovereign either stirs the ocean for gain or loses his grip on the storm within. Power without integrity poisons the whole sea."
  },
  {
    "crypto_name": "The New Wallet",
    "classic": "The Fool",
    "suit": "Major Arcana",
    "arcana": "major",
    "card_no": "00",
    "image": "/cards/00.webp",
    "keywords": [
      "Wallet",
      "Seed Phrase",
      "DYOR",
      "Beginning",
      "Adventure"
    ],
    "energy": null,
    "symbolism": "A young explorer steps onto a bridge of glowing blocks, a hardware wallet in one hand and seed-phrase scrolls on his back, a rug-pull abyss opening below and a golden Bitcoin rising ahead. He is the zero - pure potential before the first transaction is signed. Everything is possible precisely because nothing has been committed yet.",
    "advice": "Begin the journey - but guard your seed phrase and do your own research before you leap.",
    "shadow": "One careless step - a lost key, a FOMO ape - turns the adventure into the abyss.",
    "upright_full": "This is the genesis of a journey: a first entry into a new world, taken on faith and curiosity rather than proof. The card carries the clean energy of a fresh wallet with no history - open, hopeful, willing to risk the unknown because the upside feels infinite. It blesses the leap, provided the traveller keeps one eye on the path.",
    "reversed_full": "Reversed, the innocence curdles into carelessness: a lost seed phrase, a signature given to a scammer, a FOMO leap off the bridge with no plan. The same openness that begins the journey now invites the predators who wait for the naive. The lesson is not to stop moving, but to stop moving blindly."
  },
  {
    "crypto_name": "The Smart Contract Architect",
    "classic": "The Magician",
    "suit": "Major Arcana",
    "arcana": "major",
    "card_no": "01",
    "image": "/cards/01.webp",
    "keywords": [
      "Solidity",
      "Builder",
      "Smart Contract",
      "Creation"
    ],
    "energy": null,
    "symbolism": "A legendary developer stands at an altar while Solidity contracts, an Ethereum crystal, an oracle sphere and a hardware wallet orbit him, an infinity symbol forged of blockchain links crowning his head. He is will made executable - the one who turns intention directly into deployed code. Every tool he needs is already in reach.",
    "advice": "You hold every tool to build it - write clean code and ship, instead of endlessly planning.",
    "shadow": "The same mastery, pointed at deception, is just a scam contract with good branding.",
    "upright_full": "This is the power to build: raw skill focused into something real, a project shipped, a tool deployed, a vision compiled into working code. The Architect has all four elements at hand and simply needs to act. When he appears, the resources are present and the only missing ingredient is the decision to begin.",
    "reversed_full": "Reversed, the same mastery turns toward deception or decay: exploitable code, vaporware, a slick pitch with nothing under the hood, a scam contract dressed as innovation. Talent is present but misdirected, or confidence outruns competence. The gift becomes a weapon or a mirage."
  },
  {
    "crypto_name": "The Oracle",
    "classic": "The High Priestess",
    "suit": "Major Arcana",
    "arcana": "major",
    "card_no": "02",
    "image": "/cards/02.webp",
    "keywords": [
      "Oracle",
      "Consensus",
      "Insight",
      "Validation"
    ],
    "energy": null,
    "symbolism": "A veiled priestess sits between two validator pillars, an endless blockchain network glowing under an Ethereum moon, the Consensus manuscript resting on her lap. She is the oracle in both senses - the keeper of hidden knowledge and the feed that reports the truth of the chain. What she knows is real but not yet spoken aloud.",
    "advice": "Read the on-chain signal beneath the noise and trust your intuition before you ask the crowd.",
    "shadow": "Not every signal is true - some are manipulation wearing the mask of data.",
    "upright_full": "This card points beneath the surface: the on-chain signal under the noise, the intuition that arrives before the evidence, the data that quietly tells the real story. The Oracle counsels listening rather than acting - the answer is already present, waiting to be read. Trust the pattern you sense even when the crowd hasn't noticed it.",
    "reversed_full": "Reversed, the feed is poisoned: false signals, manipulated data, fake news, and the roar of noise drowning the true reading. Intuition is ignored or, worse, mimicked by manipulation dressed as insight. The danger is mistaking loud information for accurate information."
  },
  {
    "crypto_name": "The Liquidity Queen",
    "classic": "The Empress",
    "suit": "Major Arcana",
    "arcana": "major",
    "card_no": "03",
    "image": "/cards/03.webp",
    "keywords": [
      "Liquidity",
      "Yield",
      "TVL",
      "Growth"
    ],
    "energy": null,
    "symbolism": "A queen reigns on a throne of tokens while rivers of liquidity flow around her and Merkle trees hang heavy with glowing digital fruit. She is fertility as capital - the force that makes value multiply, compound, and bloom. Her abundance is generous but demands tending, not just harvesting.",
    "advice": "Let capital compound in fertile ground; nurture the yield rather than stripping it bare.",
    "shadow": "Yield with no real liquidity behind it withers into stagnation.",
    "upright_full": "This is the season of growth: capital that compounds, yield that flows, a project or portfolio blossoming in fertile ground. The Liquidity Queen rewards nurturing over grabbing - plant well, tend patiently, and the garden returns far more than you sowed. Abundance is available and wants to be enjoyed.",
    "reversed_full": "Reversed, the rivers run thin: TVL drains, yield dries up, growth stalls into stagnation. Sometimes it signals over-extension - abundance stretched past what its liquidity can support. The soil is exhausted, or the fruit was never backed by anything real."
  },
  {
    "crypto_name": "The Bitcoin King",
    "classic": "The Emperor",
    "suit": "Major Arcana",
    "arcana": "major",
    "card_no": "04",
    "image": "/cards/04.webp",
    "keywords": [
      "Bitcoin",
      "Authority",
      "Stability",
      "Security"
    ],
    "energy": null,
    "symbolism": "A sovereign sits on a colossal throne carved from solid Bitcoin, mountains of blocks rising behind him, robes embroidered with cryptographic sigils. He is sound money made flesh - the immovable base layer, the rule that does not bend, the security that others build upon. His power is structure itself.",
    "advice": "Build on the solid base; discipline and structure are your real authority.",
    "shadow": "Authority that refuses to decentralize eventually becomes a cage of control.",
    "upright_full": "This card is the foundation: order, discipline, and hard rules that create stability. The Bitcoin King favours the long horizon, the sound base, the framework others can trust. When he appears, take command, set the structure, and let reliability be your authority.",
    "reversed_full": "Reversed, structure hardens into a cage: rigidity, dogma, centralization, a refusal to upgrade or share control. The protocol that once protected now imprisons. Authority becomes about domination rather than order, and the refusal to evolve becomes the weakness."
  },
  {
    "crypto_name": "The Validator",
    "classic": "The Hierophant",
    "suit": "Major Arcana",
    "arcana": "major",
    "card_no": "05",
    "image": "/cards/05.webp",
    "keywords": [
      "Validator",
      "Consensus",
      "Governance"
    ],
    "energy": null,
    "symbolism": "A wise validator blesses new participants before a giant Proof-of-Stake wheel glowing with sacred light inside a cryptographic cathedral. He is the keeper of consensus - the established rules, the proven protocol, the shared belief that binds a network. Legitimacy flows through him.",
    "advice": "Trust the proven protocol and the shared rules - at least until you understand why they exist.",
    "shadow": "The same consensus that secures a network can also quietly censor it.",
    "upright_full": "This card honours the tried and tested: proven protocols, shared standards, mentorship, and the security of doing things the established way. The Validator counsels learning the rules and trusting the consensus before improvising. Tradition here is not stagnation but a foundation others already vouch for.",
    "reversed_full": "Reversed, consensus curdles into control: censorship, gatekeeping, outdated rules that no longer serve, centralization masquerading as order. The same structure that secured the network now suppresses it. It may be time to question the doctrine - or to knowingly step outside it."
  },
  {
    "crypto_name": "The Merge",
    "classic": "The Lovers",
    "suit": "Major Arcana",
    "arcana": "major",
    "card_no": "06",
    "image": "/cards/06.webp",
    "keywords": [
      "Merge",
      "Partnership",
      "Harmony",
      "Integration"
    ],
    "energy": null,
    "symbolism": "Two radiant chains flow into one luminous stream while two travellers stand bound by a golden thread of consensus beneath a celestial blockchain sky. This is union as upgrade - the moment two things become one greater thing, or the crossroads where a values-defining choice is made. Alignment is everything.",
    "advice": "Choose the merge that aligns with your values; true synergy beats going it alone.",
    "shadow": "A union built on convenience forks apart under the first real incompatibility.",
    "upright_full": "This card blesses genuine partnership and successful integration: two forces merging into synergy, a bond or alliance where the sum exceeds the parts. It also marks a values-based choice - the decision that defines who you are, made from alignment rather than fear. Choose the merge that fits your deepest values.",
    "reversed_full": "Reversed, the merge fails: incompatibility, conflict, a hard fork where there should have been harmony, a collaboration that breaks under its first stress. Often the split was baked in from the start - two things that were never truly compatible forced together. Misalignment surfaces under pressure."
  },
  {
    "crypto_name": "The Bull Run",
    "classic": "The Chariot",
    "suit": "Major Arcana",
    "arcana": "major",
    "card_no": "07",
    "image": "/cards/07.webp",
    "keywords": [
      "Bull Market",
      "Momentum",
      "Victory"
    ],
    "energy": null,
    "symbolism": "A hero drives a magnificent chariot pulled by two colossal digital bulls, racing across glowing blocks toward an ascending chart on the horizon. This is momentum harnessed - raw market force steered by will toward victory. The two bulls are the opposing energies the driver must hold in a single direction.",
    "advice": "Ride the momentum with the reins firmly in hand; a bull run still needs steering.",
    "shadow": "An overheated run outruns its reins and snaps into a pullback.",
    "upright_full": "This card is surging momentum and hard-won victory: a breakout driven by discipline, a market or effort moving powerfully in your favour. The Bull Run rewards the one who keeps the reins - force plus direction, not force alone. Ride the wave decisively while it runs.",
    "reversed_full": "Reversed, the run overheats: loss of control, a parabolic move snapping into a sharp pullback, energy burned in every direction at once. The bulls pull the driver apart because no one is steering. Momentum without control becomes the crash."
  },
  {
    "crypto_name": "Diamond Hands",
    "classic": "Strength",
    "suit": "Major Arcana",
    "arcana": "major",
    "card_no": "08",
    "image": "/cards/08.webp",
    "keywords": [
      "Diamond Hands",
      "HODL",
      "Patience"
    ],
    "energy": null,
    "symbolism": "A fearless guardian with hands turned to brilliant diamond calmly tames a massive crypto bear without force, radiating unwavering confidence across a glowing landscape. This is strength as composure - the quiet conviction that outlasts volatility. The bear is not defeated by power but soothed by steadiness.",
    "advice": "Hold with calm conviction; strength here is composure, not force.",
    "shadow": "Fear turns diamond hands to paper at the exact bottom.",
    "upright_full": "This card is inner strength through patience: the discipline to hold conviction while the market shakes, the calm that tames fear instead of fighting it. Diamond Hands wins not by force but by refusing to panic. Steadiness, gentleness, and endurance carry the day.",
    "reversed_full": "Reversed, composure cracks: panic, capitulation, paper hands selling the exact bottom on emotion. The bear is no longer tamed but obeyed. The strength was there but abandoned at the moment it was most needed."
  },
  {
    "crypto_name": "The DYOR Sage",
    "classic": "The Hermit",
    "suit": "Major Arcana",
    "arcana": "major",
    "card_no": "09",
    "image": "/cards/09.webp",
    "keywords": [
      "DYOR",
      "Research",
      "Knowledge"
    ],
    "energy": null,
    "symbolism": "An ancient sage climbs frozen blockchain peaks carrying a lantern that holds a glowing Ethereum block, a night sky of validator stars above. He is the solitary researcher - the one who withdraws from the crowd to find the truth by his own light. Wisdom here is earned alone, in silence.",
    "advice": "Do your own research in the quiet, away from the crowd's noise.",
    "shadow": "Solitude sharpens research; an echo chamber just ignores the facts.",
    "upright_full": "This card counsels doing your own research: stepping back from the noise to study, analyse, and learn by your own lantern. The DYOR Sage values patience and depth over the crowd's certainty. The answer is found in solitude and diligence, not in the chat.",
    "reversed_full": "Reversed, solitude sours into isolation: an echo chamber, a self-reinforcing information bubble, a stubborn refusal to update on new facts. The lantern illuminates only what it already believes. Withdrawal stops clarifying and starts hiding."
  },
  {
    "crypto_name": "Market Cycle",
    "classic": "Wheel of Fortune",
    "suit": "Major Arcana",
    "arcana": "major",
    "card_no": "10",
    "image": "/cards/10.webp",
    "keywords": [
      "Cycle",
      "Halving",
      "Bull",
      "Bear",
      "Fortune"
    ],
    "energy": null,
    "symbolism": "A colossal celestial wheel of blocks turns through the cosmos, its rim engraved with Bull, Bear, Halving, Altseason, ATH and Correction, ringed by constellations of sacred geometry. This is the market cycle as cosmic law - the turning that no one stops, only rides. What rises will fall; what falls will rise.",
    "advice": "Align with the phase of the cycle instead of clutching the last one.",
    "shadow": "Every top feels eternal, and so does every bottom - the wheel turns anyway.",
    "upright_full": "This card marks a turning of the cycle: a new phase beginning, fortune shifting, momentum changing in your favour. Market Cycle reminds you that conditions are seasonal - align with the phase you're in rather than clutching the last one. Change is arriving, and it leans upward.",
    "reversed_full": "Reversed, the wheel turns down: a bear phase, a prolonged decline, bad timing, or stagnation while you wait for the turn. Resisting the change only prolongs the pain. The bottom feels permanent - but the wheel is still turning."
  },
  {
    "crypto_name": "The Consensus",
    "classic": "Justice",
    "suit": "Major Arcana",
    "arcana": "major",
    "card_no": "11",
    "image": "/cards/11.webp",
    "keywords": [
      "Consensus",
      "Validation",
      "Justice",
      "Governance"
    ],
    "energy": null,
    "symbolism": "A blockchain judge sits between validator pillars holding the glowing Scales of Consensus that weigh honesty against fraud, a blade of chain-links in the other hand, a block of thousands of confirmations turning behind. This is truth settled on-chain - fairness enforced by the whole network, not one authority. The ledger does not forget.",
    "advice": "Act transparently; consensus weighs honesty against deception - and it remembers.",
    "shadow": "Enough coordinated dishonesty can capture even a fair system - that is the 51% risk.",
    "upright_full": "This card is honesty and consequence: transparent dealing, a fair outcome that matches your actions, validation earned through integrity. The Consensus reminds you that the network records everything and settles the truth in time. Act as though every block is permanent, because it is.",
    "reversed_full": "Reversed, fairness is captured: manipulation, corruption, a 51% attack on the truth, censorship, an unjust outcome engineered by the powerful. The scales are rigged, or the record is cooked. Accountability is being dodged - for now."
  },
  {
    "crypto_name": "Locked Staking",
    "classic": "The Hanged Man",
    "suit": "Major Arcana",
    "arcana": "major",
    "card_no": "12",
    "image": "/cards/12.webp",
    "keywords": [
      "Staking",
      "Lockup",
      "Patience",
      "Validator"
    ],
    "energy": null,
    "symbolism": "A validator hangs serenely upside-down inside a glowing energy ring, his tokens sealed within a staking crystal, his face calm and enlightened. This is voluntary suspension - value locked away on purpose, a surrender that earns rather than loses. The reward belongs to the one who can wait.",
    "advice": "Lock in and trust the process; the reward needs the full lockup period.",
    "shadow": "Capital that can never unstake is just capital quietly lost to time.",
    "upright_full": "This card is productive patience: staking your position and trusting the process through the lockup period. Locked Staking counsels stillness and a shift in perspective - the reward comes to those who resist the urge to act prematurely. Surrender the need for instant liquidity and let time do its work.",
    "reversed_full": "Reversed, the lockup becomes a trap: capital frozen when you need it, an inability to exit a position, time bleeding away with nothing to show. Patience curdles into paralysis or regret. What was a willing pause becomes being genuinely stuck."
  },
  {
    "crypto_name": "The Hard Fork",
    "classic": "Death",
    "suit": "Major Arcana",
    "arcana": "major",
    "card_no": "13",
    "image": "/cards/13.webp",
    "keywords": [
      "Hard Fork",
      "Evolution",
      "Upgrade",
      "Renewal"
    ],
    "energy": null,
    "symbolism": "A dark rider in obsidian armour crosses a splitting blockchain, the old chain dissolving into glowing dust behind him as a magnificent new network is born ahead. This is transformation as upgrade - an ending that is really a version change. The old must be deprecated so the new can run.",
    "advice": "Let the old chain fork away; evolution is irreversible, and that's the point.",
    "shadow": "Refusing the fork leaves you running an obsolete, abandoned chain.",
    "upright_full": "This card is irreversible, necessary change: an ending that clears the ground for evolution, a hard fork away from what no longer serves. The old chapter closes not as loss but as renewal. Let the deprecated version die so the upgraded one can launch.",
    "reversed_full": "Reversed, change is refused: clinging to a dead project, bag-holding an obsolete chain, resisting the fork until stagnation sets in. The upgrade waits, but fear keeps running the legacy version. The refusal itself becomes the decay."
  },
  {
    "crypto_name": "Cross-Chain Bridge",
    "classic": "Temperance",
    "suit": "Major Arcana",
    "arcana": "major",
    "card_no": "14",
    "image": "/cards/14.webp",
    "keywords": [
      "Bridge",
      "Cross-chain",
      "Balance",
      "Liquidity"
    ],
    "energy": null,
    "symbolism": "An angelic guardian pours radiant liquidity between two floating blockchain worlds, the flow forming an endless luminous arc that connects two ecosystems. This is temperance as safe transfer - patient balance moving value across a divide without spilling a drop. Harmony is a careful, tested process.",
    "advice": "Bridge the two sides with patience; balance is a careful, tested transfer.",
    "shadow": "A careless bridge between incompatible chains loses everything mid-transfer.",
    "upright_full": "This card is balance and harmonious blending: a successful bridge between two worlds, diversification, the steady mixing that creates something greater than either side. Cross-Chain Bridge rewards moderation and patience - pour slowly and everything arrives safely. Find the middle path between extremes.",
    "reversed_full": "Reversed, the bridge fails: funds lost in transit, incompatible networks, imbalance and excess where there should be measure. The transfer was rushed or the two sides never truly fit. Overreach on one side breaks the whole flow."
  },
  {
    "crypto_name": "The Rug Pull",
    "classic": "The Devil",
    "suit": "Major Arcana",
    "arcana": "major",
    "card_no": "15",
    "image": "/cards/15.webp",
    "keywords": [
      "Rug Pull",
      "Scam",
      "Greed",
      "Manipulation"
    ],
    "energy": null,
    "symbolism": "A masked demon lounges on a throne of stolen liquidity while investors sit chained to worthless tokens they refuse to drop, a burning DEX glowing behind. This is bondage by greed - the trap that owns you while you believe you own it. The chains, notably, are loose enough to slip.",
    "advice": "Name what has you chained; the worthless bag only holds you while you keep holding it.",
    "shadow": "The chains of greed feel like ownership right up until the liquidity is gone.",
    "upright_full": "This card exposes the trap: greed, addiction, manipulation, a toxic project or dynamic that has its hooks in you. The Rug Pull shows where you are chained to something worthless out of fear or craving. Naming the chain is the first step, because it was never actually locked.",
    "reversed_full": "Reversed, the chains come off: you recognise the deception, cut the loss, and walk away from the trap. Liberation arrives the moment illusion breaks. What owned you loses its grip once you stop feeding it."
  },
  {
    "crypto_name": "Liquidation",
    "classic": "The Tower",
    "suit": "Major Arcana",
    "arcana": "major",
    "card_no": "16",
    "image": "/cards/16.webp",
    "keywords": [
      "Liquidation",
      "Crash",
      "Volatility",
      "Margin"
    ],
    "energy": null,
    "symbolism": "A monumental exchange tower is split by a lightning bolt shaped like a candlestick, traders and golden coins falling through the storm as a red 'Margin Call' blazes at the peak. This is sudden, violent correction - the false structure destroyed in an instant. What was built on leverage cannot survive the shock.",
    "advice": "Don't defend an over-leveraged structure; the liquidation is the market clearing.",
    "shadow": "Leverage feels like power right until the margin call takes it all at once.",
    "upright_full": "This card is sudden collapse: a liquidation, a crash, a black-swan event that clears away what was over-leveraged or built on illusion. Liquidation is brutal but cleansing - it destroys the fragile so something true can be rebuilt. Don't defend the falling tower; let it fall.",
    "reversed_full": "Reversed, catastrophe is narrowly avoided or partially survived: you de-risked in time, caught the danger late but not too late, or the collapse comes as a slow unravel rather than a bang. The lesson about risk arrives after the scare. Recovery begins from a lower, humbler base."
  },
  {
    "crypto_name": "Bull Market",
    "classic": "The Star",
    "suit": "Major Arcana",
    "arcana": "major",
    "card_no": "17",
    "image": "/cards/17.webp",
    "keywords": [
      "Hope",
      "Bull",
      "Recovery",
      "Growth"
    ],
    "energy": null,
    "symbolism": "A radiant maiden pours golden liquidity into a blockchain river beneath a great eight-pointed Bitcoin star, the whole landscape lush and alive with returning prosperity. This is hope after the winter - quiet renewal, faith restored, the first green of recovery. The star is distant but real.",
    "advice": "Act calmly on the returning hope; the recovery is real if you don't abandon it.",
    "shadow": "Hope that curdles into doubt sells the recovery right before it runs.",
    "upright_full": "This card is gentle hope and genuine recovery: the bull returning after the bear, good fundamentals, healing, and renewed faith. Bull Market counsels calm optimism - the current is turning in your favour, so act steadily rather than frantically. The worst has passed and the sky is clearing.",
    "reversed_full": "Reversed, hope fades: doubt, burnout, a recovery so slow you stop believing in it, dreams that drifted into the unrealistic. The star is still shining, but you've looked away. The danger is abandoning the recovery right before it confirms."
  },
  {
    "crypto_name": "FUD",
    "classic": "The Moon",
    "suit": "Major Arcana",
    "arcana": "major",
    "card_no": "18",
    "image": "/cards/18.webp",
    "keywords": [
      "FUD",
      "Emotion",
      "Illusion",
      "Fear"
    ],
    "energy": null,
    "symbolism": "A huge digital moon casts pale light over a fog-covered valley where phantom charts, fake-news scrolls and shadowy figures rise from the mist. This is fear, uncertainty and doubt made landscape - the murky night where nothing can be verified and imagination fills the gaps. Not everything in the fog is real.",
    "advice": "Don't make big moves in the fog; wait for the FUD to clear and the truth to surface.",
    "shadow": "Fear invents phantom charts the daylight rarely confirms.",
    "upright_full": "This card is the fog of fear: uncertainty, rumour, emotional markets, illusions that look like threats. FUD counsels against big moves in the dark - what you fear is often a phantom the daylight won't confirm. Trust intuition, but verify before you act on dread.",
    "reversed_full": "Reversed, the fog lifts: clarity returns, the FUD fades, objectivity replaces panic. The shadows resolve into ordinary shapes and the truth surfaces. Confusion gives way to a clear read."
  },
  {
    "crypto_name": "ATH",
    "classic": "The Sun",
    "suit": "Major Arcana",
    "arcana": "major",
    "card_no": "19",
    "image": "/cards/19.webp",
    "keywords": [
      "ATH",
      "Success",
      "Profit",
      "Bull"
    ],
    "energy": null,
    "symbolism": "A brilliant Bitcoin sun illuminates a flourishing world as a joyful trader rides a white digital bull into a radiant golden city. This is the euphoric all-time high - success made visible, warmth, clarity, and the peak of the cycle. Everything is lit, and everyone can see it.",
    "advice": "Celebrate the peak - and remember an ATH is still one point on a cycle.",
    "shadow": "At the top everyone forgets that the chart runs both directions.",
    "upright_full": "This card is success and joy at full brightness: an all-time high, profit realised, recognition, vitality, and honest happiness. ATH is the reward and the celebration. Enjoy the peak fully - while remembering, quietly, that a top is still a point on a cycle.",
    "reversed_full": "Reversed, the sun overheats: overconfidence, hollow hype, ego, a euphoric top just before the cool-down. The warmth becomes a burn, or the success is more surface than substance. Time to take some profit and stay humble."
  },
  {
    "crypto_name": "Snapshot",
    "classic": "Judgement",
    "suit": "Major Arcana",
    "arcana": "major",
    "card_no": "20",
    "image": "/cards/20.webp",
    "keywords": [
      "Snapshot",
      "DAO",
      "Airdrop",
      "Governance"
    ],
    "energy": null,
    "symbolism": "An angel sounds a cryptographic trumpet and thousands of wallet addresses awaken with golden light, rising to claim governance rights and airdrops. This is the reckoning that rewards - the on-chain snapshot that counts who showed up and who built. The record is taken; the worthy are called.",
    "advice": "Answer the call and be counted; the snapshot rewards those who showed up.",
    "shadow": "A missed snapshot is a chapter you don't get to claim later.",
    "upright_full": "This card is a reckoning and a reward: recognition for past positioning, an airdrop for those who were present, a call to rise into a new chapter. Snapshot honours who showed up and did the work. Answer the call, review the past honestly, and step into what you've earned.",
    "reversed_full": "Reversed, the moment is missed: a snapshot you weren't counted in, a lost opportunity, disqualification, or self-judgement and regret over the past. The trumpet sounded and you weren't holding. The chance to be counted has passed - learn it for the next cycle."
  },
  {
    "crypto_name": "Mass Adoption",
    "classic": "The World",
    "suit": "Major Arcana",
    "arcana": "major",
    "card_no": "21",
    "image": "/cards/21.webp",
    "keywords": [
      "Mass Adoption",
      "Unity",
      "Completion",
      "Global Network"
    ],
    "energy": null,
    "symbolism": "A triumphant figure floats within a wreath of interconnected chains as Earth is wrapped in a luminous decentralized network, four guardians - Bitcoin Bull, Ethereum Owl, Solana Phoenix, Chainlink Lion - anchoring the corners. This is completion and integration at global scale: the whole journey come full circle, the network reaching everyone.",
    "advice": "Honour the completion; the whole network arriving is the seed of the next cycle.",
    "shadow": "One fragmented corner keeps the global network from ever fully closing.",
    "upright_full": "This card is fulfilment and wholeness: a journey completed, a vision integrated, mass adoption achieved, the ecosystem matured into unity. Mass Adoption is the successful arrival - and, quietly, the seed of the next cycle. Honour the completion and let it become a new genesis block.",
    "reversed_full": "Reversed, completion is withheld: a loose end, delayed development, fragmentation, isolation, a potential left unrealised. One neglected corner keeps the circle from closing. The finish line is close but not yet crossed."
  },
  {
    "crypto_name": "Genesis Block",
    "classic": "Ace of Wands",
    "suit": "Nodes",
    "arcana": "minor",
    "card_no": "22",
    "image": "/cards/22.webp",
    "keywords": [
      "Genesis",
      "Launch",
      "Innovation",
      "Builder"
    ],
    "energy": null,
    "symbolism": "A hand of light emerges from the clouds holding a Validator Staff that contains the spinning Genesis Block, a whole new blockchain world forming beneath it. As the Ace of the fire suit, it is the first spark of creation - the very block on which everything else will be built. Pure ignition, before a single line of code has run.",
    "advice": "The genesis spark is here - launch while the inspiration still burns.",
    "shadow": "A spark left unfed burns out into another 'someday' idea.",
    "upright_full": "A new idea catches fire: the impulse to launch, build, or create something from nothing. This card carries raw creative energy and the confidence that the project is worth starting. It rewards striking while the inspiration is hot, before doubt or delay can smother the spark.",
    "reversed_full": "The spark sputters: motivation drains, a launch is cancelled, or technical problems stall the build before it begins. The vision is there but fails to ignite, or the timing is wrong. It is a false start, not a dead end."
  },
  {
    "crypto_name": "Roadmap",
    "classic": "Two of Wands",
    "suit": "Nodes",
    "arcana": "minor",
    "card_no": "23",
    "image": "/cards/23.webp",
    "keywords": [
      "Roadmap",
      "Vision",
      "Strategy"
    ],
    "energy": null,
    "symbolism": "An architect stands atop a DAO tower, two Validator Staffs in hand, studying a glowing roadmap of future ecosystems spread before him. The Two is the moment after ignition when the spark must choose a direction - vision surveyed from a height, the world weighed before the first real step beyond the comfort of what's built.",
    "advice": "Set the roadmap and pick the direction before you build.",
    "shadow": "Admiring the map forever is how the journey never starts.",
    "upright_full": "This card is planning and strategic vision: standing at a height, mapping the territory, and choosing which direction to scale. Roadmap rewards the leap beyond the familiar into a larger ambition. The idea exists; now it needs a plan and a decision.",
    "reversed_full": "Reversed, vision stalls into indecision: a weak plan, fear of leaving the comfort zone, a roadmap that never turns into progress. The map is admired but never walked. Analysis replaces development."
  },
  {
    "crypto_name": "Mainnet Launch",
    "classic": "Three of Wands",
    "suit": "Nodes",
    "arcana": "minor",
    "card_no": "24",
    "image": "/cards/24.webp",
    "keywords": [
      "Mainnet",
      "Launch",
      "Expansion"
    ],
    "energy": null,
    "symbolism": "Three Validator Staffs stand on a digital shore as blockchain ships arrive on the horizon, carrying the first waves of new users into the ecosystem. The Three is the first payoff of the plan - the mainnet is live and the world begins to respond. Foresight rewarded with early traction.",
    "advice": "The mainnet is live; scale your vision to the traction arriving.",
    "shadow": "Waiting on the shore for ships that were never given a reason to come.",
    "upright_full": "This card is expansion and the first fruits of effort: a launch that lands, an audience arriving, early results confirming the direction. Mainnet Launch rewards patience and foresight - the ships you sent out are coming back full. Widen your view to match the traction.",
    "reversed_full": "Reversed, the launch underdelivers: release delays, no users arriving, a horizon that stays empty. The ships were sent but none return, or the timing missed. Limited vision or unforeseen obstacles blunt the expansion."
  },
  {
    "crypto_name": "DAO Celebration",
    "classic": "Four of Wands",
    "suit": "Nodes",
    "arcana": "minor",
    "card_no": "25",
    "image": "/cards/25.webp",
    "keywords": [
      "DAO",
      "Community",
      "Success"
    ],
    "energy": null,
    "symbolism": "Four Validator Staffs form a ceremonial arch before a majestic DAO temple as builders and users celebrate a successful protocol launch. The Four is a stable milestone - the first solid foundation reached, worth pausing to honour. Community and structure joined in celebration.",
    "advice": "Celebrate the milestone; a strong community is the real foundation.",
    "shadow": "A foundation that skips the community cracks at the first stress.",
    "upright_full": "This card is a milestone worth celebrating: a project succeeding, a strong community forming, a stable foundation reached. DAO Celebration rewards taking a moment to honour the win and the people who built it. Stability and belonging are the achievement here.",
    "reversed_full": "Reversed, the celebration fractures: a community split, internal conflict, a shaky foundation, a launch that never quite consolidates. The arch cracks before the party. Belonging gives way to discord."
  },
  {
    "crypto_name": "Fork War",
    "classic": "Five of Wands",
    "suit": "Nodes",
    "arcana": "minor",
    "card_no": "26",
    "image": "/cards/26.webp",
    "keywords": [
      "Fork",
      "Competition",
      "Conflict"
    ],
    "energy": null,
    "symbolism": "Five architects battle with luminous Validator Staffs across a splitting blockchain, sparks of competing protocols forging two diverging chains. The Five is friction and rivalry - the scrappy clash where many builders fight for the same block space and mindshare. Conflict that can sharpen or splinter.",
    "advice": "Compete on ideas; let the conflict forge a better chain, not chaos.",
    "shadow": "A fork fought over ego, not merit, just splinters everyone's energy.",
    "upright_full": "This card is competition and creative conflict: a crowded arena of clashing ideas, rivalry that pushes everyone to build better. Fork War is messy but generative when the fight stays about the work. The tension is a sign the space is worth contesting.",
    "reversed_full": "Reversed, the clash turns toxic: pointless disputes, infighting, chaos with no progress, burnout from the noise. The fork becomes a flame war. Energy is spent on ego instead of the build."
  },
  {
    "crypto_name": "Verified",
    "classic": "Six of Wands",
    "suit": "Nodes",
    "arcana": "minor",
    "card_no": "27",
    "image": "/cards/27.webp",
    "keywords": [
      "Audit",
      "Verified",
      "Trust"
    ],
    "energy": null,
    "symbolism": "A victorious builder rides into the capital beneath a giant glowing verification checkmark as a crowd of validators cheers. The Six is public triumph - the audit passed, the reputation earned, the network's trust made visible. Recognition after the fight.",
    "advice": "Your work is verified - accept the recognition and keep earning the trust.",
    "shadow": "Recognition believed too deeply becomes the ego that loses it.",
    "upright_full": "This card is earned recognition: a successful audit, public trust, leading the pack after real work. Verified rewards visible achievement and the credibility that comes with it. Accept the applause - you earned the badge.",
    "reversed_full": "Reversed, the reputation slips: a rejected audit, public criticism, a fall from grace, effort that goes unrecognised. The checkmark is withheld or revoked. Ego, or bad luck, tarnishes the win."
  },
  {
    "crypto_name": "Network Defense",
    "classic": "Seven of Wands",
    "suit": "Nodes",
    "arcana": "minor",
    "card_no": "28",
    "image": "/cards/28.webp",
    "keywords": [
      "Defense",
      "Security",
      "Persistence"
    ],
    "energy": null,
    "symbolism": "A lone guardian holds the top of a blockchain fortress, fending off seven attacking staffs from below. The Seven is the defence of hard-won ground - the higher position that must now be protected against challengers and critics. Conviction under siege.",
    "advice": "Hold your ground; you earned the high position - defend it without exhausting yourself.",
    "shadow": "Defending every hill at once is how you lose the one that mattered.",
    "upright_full": "This card is standing your ground: defending your project, thesis, or position against pressure and criticism. Network Defense rewards resilience and the courage to hold the high ground you earned. You have the advantage of position - use it.",
    "reversed_full": "Reversed, the defence buckles: overwhelmed by attacks, losing control, exhausted by relentless pressure. The guardian is worn down or gives up ground. The fight becomes unsustainable."
  },
  {
    "crypto_name": "Instant Finality",
    "classic": "Eight of Wands",
    "suit": "Nodes",
    "arcana": "minor",
    "card_no": "29",
    "image": "/cards/29.webp",
    "keywords": [
      "Speed",
      "TPS",
      "Finality"
    ],
    "energy": null,
    "symbolism": "Eight Validator Staffs streak across the night sky like blockchain comets, connecting distant decentralized cities with streams of light. The Eight is acceleration - everything moving fast at once, transactions finalizing, momentum compressing time. Swift, decisive motion.",
    "advice": "Things finalize fast now; move decisively while the network is quick.",
    "shadow": "Speed with no aim just arrives at the wrong destination sooner.",
    "upright_full": "This card is speed and rapid progress: things accelerating, news arriving fast, transactions finalizing, a window opening quickly. Instant Finality rewards decisive action while the network is quick. Move now - the pace favours those who are ready.",
    "reversed_full": "Reversed, the flow jams: delays, congestion, high gas, missed timing, chaos where there should be flow. The comets stall midair. Speed becomes frustration."
  },
  {
    "crypto_name": "Battle Tested",
    "classic": "Nine of Wands",
    "suit": "Nodes",
    "arcana": "minor",
    "card_no": "30",
    "image": "/cards/30.webp",
    "keywords": [
      "Experience",
      "Security",
      "Endurance"
    ],
    "energy": null,
    "symbolism": "A wounded builder leans on a Validator Staff before a fortified wall, eight staffs standing behind him marking the trials he has already survived. The Nine is the last stand - battered but resilient, guarding what was built with one more push left. Scars as proof of strength.",
    "advice": "You're battle-tested; one more stand - don't fold near the finish.",
    "shadow": "Guarding your walls so warily that you never open the gate again.",
    "upright_full": "This card is hard-won resilience: experience earned through trials, the endurance to guard what you've built, one last push near the finish. Battle Tested rewards persistence when you're tired but not done. You've survived worse - hold on a little longer.",
    "reversed_full": "Reversed, resilience runs out: burnout, paranoia, defensiveness, quitting just before the finish. The scars become fear of new wounds. Exhaustion overrides the final push."
  },
  {
    "crypto_name": "Validator Overload",
    "classic": "Ten of Wands",
    "suit": "Nodes",
    "arcana": "minor",
    "card_no": "31",
    "image": "/cards/31.webp",
    "keywords": [
      "Responsibility",
      "Validator",
      "Infrastructure"
    ],
    "energy": null,
    "symbolism": "An exhausted operator carries ten massive Validator Staffs of network energy toward an immense datacenter, buckling under the weight. The Ten is the burden of success - too much responsibility carried by one, the cost of everything you took on. The load has become the problem.",
    "advice": "The load became too heavy - delegate before the infrastructure fails.",
    "shadow": "Carrying everything alone is how the whole network goes down at once.",
    "upright_full": "This card is overload: too many commitments, heavy responsibility, the crushing weight that comes with success. Validator Overload marks the completion of a hard stage carried on your own back. You can finish, but the load is unsustainable as-is.",
    "reversed_full": "Reversed, the weight breaks you: burnout, infrastructure failure, collapse under commitments - or the release that comes from finally delegating and putting some staffs down. Either way, the message is that you can't carry it all alone."
  },
  {
    "crypto_name": "Testnet Apprentice",
    "classic": "Page of Wands",
    "suit": "Nodes",
    "arcana": "minor",
    "card_no": "32",
    "image": "/cards/32.webp",
    "keywords": [
      "Testnet",
      "Learning",
      "Builder",
      "Beginner"
    ],
    "energy": null,
    "symbolism": "A young dev holds his first glowing Validator Staff at the gate of a Mainnet Citadel, transparent testnet blocks floating around him. As the Page of fire, he is the eager beginner - all enthusiasm and experimentation, standing at the threshold of a long path. Raw potential learning by doing.",
    "advice": "Experiment on the testnet; channel the enthusiasm into finishing something.",
    "shadow": "Endless new experiments are how nothing ever reaches mainnet.",
    "upright_full": "This card is the curious beginner: shipping first contracts on testnet, learning by experiment, full of untamed enthusiasm. Testnet Apprentice rewards playful exploration and the courage to try. Channel the excitement into actually finishing something.",
    "reversed_full": "Reversed, enthusiasm scatters: rookie mistakes, an abandoned project, hype with no follow-through, no discipline to finish. The Page flits between ideas without shipping. Excitement without structure fizzles."
  },
  {
    "crypto_name": "Protocol Runner",
    "classic": "Knight of Wands",
    "suit": "Nodes",
    "arcana": "minor",
    "card_no": "33",
    "image": "/cards/33.webp",
    "keywords": [
      "Upgrade",
      "Speed",
      "Protocol",
      "Action"
    ],
    "energy": null,
    "symbolism": "A knight races a mechanical cyber-horse down a glowing blockchain highway, a blazing Validator Staff in hand carrying a network upgrade, blocks trailing behind. As the Knight of fire, he is bold forward motion - ambition in full gallop, shipping fast and charging at the mission. Momentum personified.",
    "advice": "Ship boldly - but test before you deploy at full speed.",
    "shadow": "A charge with no aim is how you gallop confidently off a cliff.",
    "upright_full": "This card is decisive, ambitious action: fast development, shipping features, charging boldly at a goal. Protocol Runner rewards the courage to move and the charisma to rally others behind the push. Ship with drive - just aim before you charge.",
    "reversed_full": "Reversed, the gallop turns reckless: hasty releases, deploy errors, instability, all talk and over-promising. Speed without care breaks production. The charge outruns the plan."
  },
  {
    "crypto_name": "Network Guardian",
    "classic": "Queen of Wands",
    "suit": "Nodes",
    "arcana": "minor",
    "card_no": "34",
    "image": "/cards/34.webp",
    "keywords": [
      "Ecosystem",
      "Guardian",
      "Wisdom",
      "Community"
    ],
    "energy": null,
    "symbolism": "A wise queen sits on a throne of blocks, her Validator Staff blooming golden branches, tiny blockchain dragons circling in calm authority. As the Queen of fire, she is warmth turned to stewardship - the magnetic figure who nurtures a whole ecosystem rather than a single spark. Living, confident leadership.",
    "advice": "Nurture the ecosystem; guard it without smothering its growth.",
    "shadow": "Guarding growth too tightly is how you become its ceiling.",
    "upright_full": "This card is mature, warm leadership: caring for a community, nurturing an ecosystem, holding stability with confidence. Network Guardian rewards the magnetic steward who grows what surrounds her. Lead with warmth and let the ecosystem flourish under your care.",
    "reversed_full": "Reversed, the guardian tightens: control for control's sake, stagnation from over-caution, a grip that smothers the growth it meant to protect. Warmth turns to jealous management. Protection becomes a ceiling."
  },
  {
    "crypto_name": "Master Validator",
    "classic": "King of Wands",
    "suit": "Nodes",
    "arcana": "minor",
    "card_no": "35",
    "image": "/cards/35.webp",
    "keywords": [
      "Validator",
      "Leadership",
      "Infrastructure",
      "Consensus"
    ],
    "energy": null,
    "symbolism": "The supreme guardian sits on a Genesis Block throne beneath the colossal Tree of Consensus, his crown forged of rotating blocks. As the King of fire, he is vision matured into command - the founder who sees the whole map and makes builders believe. Authority earned by building the network itself.",
    "advice": "Lead the infrastructure with vision; centralize the power and you lose the network.",
    "shadow": "A visionary who rules instead of serving forks the very community he built.",
    "upright_full": "This card is visionary leadership at full maturity: commanding a large-scale project, controlling the infrastructure, inspiring an ecosystem to follow. Master Validator rewards the leader who points far and delivers enough to keep the faith. Lead the vision boldly.",
    "reversed_full": "Reversed, leadership curdles: authoritarianism, dangerous centralization, a founder who loses the community's trust by ruling instead of serving. The visionary becomes a despot. Control replaces consensus."
  },
  {
    "crypto_name": "Verified Contract",
    "classic": "Ace of Swords",
    "suit": "Protocols",
    "arcana": "minor",
    "card_no": "50",
    "image": "/cards/50.webp",
    "keywords": [
      "Audit",
      "Security",
      "Smart Contract"
    ],
    "energy": null,
    "symbolism": "A giant Protocol Blade of blockchain links descends from the clouds, Solidity runes orbiting, crowned with a radiant 'Audit Passed' seal. As the Ace of the air suit, it is pure mental clarity - the sword that cuts through confusion to a single, verified truth. A breakthrough insight, clean and decisive.",
    "advice": "The clarity is verified; cut cleanly and move to the next level.",
    "shadow": "A blade this sharp, aimed by faulty logic, cuts the wrong thing with total confidence.",
    "upright_full": "This card is clarity and truth: a breakthrough realization, a passed audit, a decisive cut through the noise to what is real. Verified Contract rewards sharp thinking and honest conclusions. You can see clearly now - cut cleanly and act.",
    "reversed_full": "Reversed, the blade misfires: bugs, exploits, false conclusions drawn from clouded logic, architecture built on a flawed premise. Clarity becomes confusion or misused intellect. The reasoning looks sound but is quietly broken."
  },
  {
    "crypto_name": "Governance Vote",
    "classic": "Two of Swords",
    "suit": "Protocols",
    "arcana": "minor",
    "card_no": "51",
    "image": "/cards/51.webp",
    "keywords": [
      "DAO",
      "Governance",
      "Voting"
    ],
    "energy": null,
    "symbolism": "A DAO guardian stands with two crossed Protocol Blades before an immense governance portal, thousands of glowing wallet addresses illuminating the chamber. The Two is a decision held in tense balance - two options weighed, a vote that must be cast. A crossroads of the mind.",
    "advice": "Cast the vote; a decision made beats an endless deadlock.",
    "shadow": "A blindfold kept on out of fear is how the deadlock decides for you.",
    "upright_full": "This card is a choice that must be made: a governance vote, a weighing of two paths, a compromise between factions. Governance Vote asks you to gather the information, drop the blindfold, and decide. Balance is fine, but stalemate is not a strategy.",
    "reversed_full": "Reversed, the choice jams: political deadlock, community conflict, an avoided decision festering, information withheld. The crossed blades lock rather than balance. Indecision becomes its own damage - or the deadlock finally breaks."
  },
  {
    "crypto_name": "Smart Contract Hack",
    "classic": "Three of Swords",
    "suit": "Protocols",
    "arcana": "minor",
    "card_no": "52",
    "image": "/cards/52.webp",
    "keywords": [
      "Hack",
      "Exploit",
      "Security"
    ],
    "energy": null,
    "symbolism": "A glowing blockchain heart is pierced by three Protocol Blades, liquidity leaking from the cracks into a stormy digital rain. The Three is painful truth - the exploit that lands where you trusted, the heartbreak of betrayed security. A wound that clarifies.",
    "advice": "The exploit hurts; let it teach you where the cracks really were.",
    "shadow": "A wound left un-audited just waits to be exploited the same way again.",
    "upright_full": "This card is painful loss and hard truth: a hack, a betrayal, a disappointment that pierces where you were most exposed. Smart Contract Hack doesn't soften the blow, but the pain reveals exactly where the vulnerability was. Grief is valid; so is the lesson underneath it.",
    "reversed_full": "Reversed, the wound begins to heal: recovery, compensation, forgiveness, security lessons integrated. The blades are drawn out. What broke is being repaired, and the pain turns into hardened defence."
  },
  {
    "crypto_name": "Cold Storage",
    "classic": "Four of Swords",
    "suit": "Protocols",
    "arcana": "minor",
    "card_no": "53",
    "image": "/cards/53.webp",
    "keywords": [
      "Ledger",
      "Cold Wallet",
      "Recovery"
    ],
    "energy": null,
    "symbolism": "A guardian rests in a cryptographic sanctuary, four Protocol Blades mounted on the wall beside an illuminated cold-wallet vault. The Four is deliberate stillness - assets moved to safety, the mind put to rest, a strategic pause before the next move. Security through withdrawal.",
    "advice": "Move to cold storage and rest; recover before the next move.",
    "shadow": "Rest that never ends is just avoidance in a vault.",
    "upright_full": "This card is rest and secure retreat: stepping back to recover, moving assets to safety, a deliberate pause to reset the mind. Cold Storage rewards the discipline to stop and recover before acting again. Stillness now is strength later.",
    "reversed_full": "Reversed, the pause overstays: procrastination, missed opportunities, over-caution, hiding in cold storage when it's time to move. Rest becomes avoidance. The blades stay on the wall too long."
  },
  {
    "crypto_name": "Hostile Takeover",
    "classic": "Five of Swords",
    "suit": "Protocols",
    "arcana": "minor",
    "card_no": "54",
    "image": "/cards/54.webp",
    "keywords": [
      "Attack",
      "DAO",
      "Conflict"
    ],
    "energy": null,
    "symbolism": "A victor gathers the blades of defeated rivals as ruined DAOs smoke behind him under a dark sky. The Five is a win that costs more than it gains - dominance achieved through a fight that scorches the ground. Hollow victory.",
    "advice": "Ask if this conquest is worth its cost; some wins burn the trust you need.",
    "shadow": "Winning every fight is how you end up ruling a scorched, empty network.",
    "upright_full": "This card is winning at a cost: an aggressive takeover, dominance seized, a conflict where even the winner loses something. Hostile Takeover asks whether the victory is worth the trust it burns. Sometimes the win is a loss that happened to score.",
    "reversed_full": "Reversed, the sword is sheathed: reconciliation, walking away from a fight not worth having, rebuilding trust after a scorched conflict. The victor chooses peace over another empty win. De-escalation as strength."
  },
  {
    "crypto_name": "Bridge Migration",
    "classic": "Six of Swords",
    "suit": "Protocols",
    "arcana": "minor",
    "card_no": "55",
    "image": "/cards/55.webp",
    "keywords": [
      "Migration",
      "Bridge",
      "Transition"
    ],
    "energy": null,
    "symbolism": "Travellers cross a magnificent cross-chain bridge escorted by floating Protocol Blades, leaving an aging blockchain behind for a brighter one. The Six is transition - a considered move away from trouble toward calmer water. Progress through migration.",
    "advice": "Migrate to the brighter chain; keep moving through the transition.",
    "shadow": "A migration abandoned midway strands you between two chains, safe on neither.",
    "upright_full": "This card is a transition toward better conditions: migrating away from turbulence, moving on, a gradual recovery into a new stage. Bridge Migration rewards leaving what no longer works and steadily crossing to the next chain. Keep moving; the water calms ahead.",
    "reversed_full": "Reversed, the crossing fails: a failed bridge, delays, funds lost mid-transfer, an inability to leave the old chain behind. You're stuck between worlds. The transition stalls halfway."
  },
  {
    "crypto_name": "White Hat",
    "classic": "Seven of Swords",
    "suit": "Protocols",
    "arcana": "minor",
    "card_no": "56",
    "image": "/cards/56.webp",
    "keywords": [
      "White Hat",
      "Audit",
      "Exploit"
    ],
    "energy": null,
    "symbolism": "An ethical hacker slips from a fortress carrying five Protocol Blades, leaving two behind, under a moonlit sky - saving the network rather than robbing it. The Seven is cunning strategy - stealth and lateral thinking used for a purpose. The clever move made quietly.",
    "advice": "Use the clever angle to protect the network, not to exploit it.",
    "shadow": "The same skill that patches a hole can quietly open one - watch which you're doing.",
    "upright_full": "This card is strategy and unconventional thinking: the white-hat move, spotting the vulnerability first, acting cleverly and quietly for a good end. White Hat rewards resourcefulness and thinking around the problem. Use the clever angle to protect, not to plunder.",
    "reversed_full": "Reversed, the stealth turns black-hat: a real exploit, deception, fraud, cutting corners, someone getting away with something. The same cunning aimed at harm. Watch for the quiet move made against you - or the temptation to make it yourself."
  },
  {
    "crypto_name": "Frozen Wallet",
    "classic": "Eight of Swords",
    "suit": "Protocols",
    "arcana": "minor",
    "card_no": "57",
    "image": "/cards/57.webp",
    "keywords": [
      "Frozen Wallet",
      "Restriction"
    ],
    "energy": null,
    "symbolism": "A figure stands surrounded by eight Protocol Blades, her wallet frozen inside a transparent cryptographic crystal, an exit visible but unseen. The Eight is self-made restriction - a trap that feels total but whose bars are mostly in the mind. Paralysis by fear.",
    "advice": "The barrier feels total, but the cage is thinner than the fear around it.",
    "shadow": "The tightest prison is the one whose door you refuse to test.",
    "upright_full": "This card is feeling trapped: frozen funds, restriction, a cage of fear that hides the open door. Frozen Wallet shows a limitation that is more perceived than absolute. The blades are real, but a path between them exists once you stop panicking and look.",
    "reversed_full": "Reversed, the wallet thaws: access regained, the barrier dissolved, a fresh perspective revealing the exit was always there. The fear releases its grip. You free yourself."
  },
  {
    "crypto_name": "Night Before Liquidation",
    "classic": "Nine of Swords",
    "suit": "Protocols",
    "arcana": "minor",
    "card_no": "58",
    "image": "/cards/58.webp",
    "keywords": [
      "Liquidation",
      "Fear",
      "Anxiety"
    ],
    "energy": null,
    "symbolism": "A trader wakes in panic at night, nine Protocol Blades hanging on the wall, a crashing red candlestick chart glowing crimson through the window. The Nine is the 4am mind - dread and worry magnified in the dark, fear louder than the actual danger. Mental anguish.",
    "advice": "The 4am dread exaggerates; breathe, then face the chart in daylight.",
    "shadow": "Rehearsing the catastrophe all night is how you lose the sleep the fight needs.",
    "upright_full": "This card is anxiety and dread: sleepless worry over losses, catastrophizing in the dark, the mind torturing itself past the facts. Night Before Liquidation names the fear so you can see it for what it is - usually larger than reality. The blades are on the wall, not in you.",
    "reversed_full": "Reversed, the dawn comes: the anxiety eases, acceptance settles in, help is sought, hope returns. The nightmare loosens its grip. You recover your footing and the fear shrinks to size."
  },
  {
    "crypto_name": "Protocol Collapse",
    "classic": "Ten of Swords",
    "suit": "Protocols",
    "arcana": "minor",
    "card_no": "59",
    "image": "/cards/59.webp",
    "keywords": [
      "Collapse",
      "Fork",
      "Rebirth"
    ],
    "energy": null,
    "symbolism": "A fallen blockchain titan lies pierced by ten Protocol Blades beneath a dark sky - yet a brilliant digital sunrise is already breaking on the horizon. The Ten is rock bottom: the definitive painful end, but also the point from which the only direction is up. Ruin that promises rebirth.",
    "advice": "This chapter has fully collapsed; the sunrise behind it is the next fork.",
    "shadow": "Staring only at the ten blades is how you miss the sunrise already breaking.",
    "upright_full": "This card is a painful, decisive ending: a total collapse, a cycle over, a project shut down, rock bottom reached. Protocol Collapse doesn't pretend it's fine - but it marks the true bottom, and the sunrise is already visible behind the blades. It cannot get more painful than this; the next move is up.",
    "reversed_full": "Reversed, recovery begins: surviving the worst, a new fork rising from the ruin, refusing to let the ending be the end. The titan stirs. The rebuild starts from the ashes."
  },
  {
    "crypto_name": "Security Researcher",
    "classic": "Page of Swords",
    "suit": "Protocols",
    "arcana": "minor",
    "card_no": "60",
    "image": "/cards/60.webp",
    "keywords": [
      "Audit",
      "Learning",
      "Curiosity",
      "Security",
      "Solidity"
    ],
    "energy": null,
    "symbolism": "A young researcher stands atop a datacenter tower with his first Protocol Blade, Solidity code and EVM diagrams floating around him, digital ravens circling to hunt vulnerabilities. As the Page of air, he is the sharp, curious mind - gathering intel, watchful, hungry to understand how things break. Vigilant beginner intellect.",
    "advice": "Investigate everything - then verify before you accuse.",
    "shadow": "A hunch mistaken for a finding is how the researcher becomes the FUD.",
    "upright_full": "This card is the curious, vigilant mind: researching, auditing, hunting for problems before they surface, hungry to learn how systems work. Security Researcher rewards sharp curiosity and careful observation. Gather the intel - then verify it before you repeat it.",
    "reversed_full": "Reversed, curiosity outruns competence: shallow audits, false conclusions, hasty accusations, gossip, misreading the architecture, all talk. The Page mistakes a hunch for a finding. Watchfulness tips into paranoia or spying."
  },
  {
    "crypto_name": "White Hat Hunter",
    "classic": "Knight of Swords",
    "suit": "Protocols",
    "arcana": "minor",
    "card_no": "61",
    "image": "/cards/61.webp",
    "keywords": [
      "White Hat",
      "Audit",
      "Security",
      "Hunt",
      "Speed",
      "Defense"
    ],
    "energy": null,
    "symbolism": "A legendary white hat charges a cyber-steed through a storm of malicious code, a blazing Protocol Blade slicing exploits into disintegrating particles, repaired blocks streaming overhead. As the Knight of air, he is thought weaponized into speed - decisive, aggressive, cutting straight to the fix. Fast, fearless defense.",
    "advice": "Hunt the bugs before the hackers do - but a rushed patch breeds new ones.",
    "shadow": "A blade swung faster than the mind can aim cuts the defender, not the exploit.",
    "upright_full": "This card is fast, decisive defense: reacting instantly, cutting through the threat, preventing the attack, an aggressive professional audit. White Hat Hunter rewards speed and courage in a crisis. Charge - but aim the blade before you swing.",
    "reversed_full": "Reversed, speed turns reckless: hasty patches that create new bugs, risky actions, aggression, charging in without thinking. The cure becomes another wound. Momentum outruns judgement."
  },
  {
    "crypto_name": "Consensus Keeper",
    "classic": "Queen of Swords",
    "suit": "Protocols",
    "arcana": "minor",
    "card_no": "62",
    "image": "/cards/62.webp",
    "keywords": [
      "Governance",
      "Consensus",
      "Wisdom",
      "Validation",
      "Integrity"
    ],
    "energy": null,
    "symbolism": "The keeper sits on a throne of perfectly aligned blocks, a Protocol Blade in one hand and the Consensus Rules scroll in the other, a halo of synchronized validators turning above her. As the Queen of air, she is clear, independent judgement - seeing through the noise, fair but unfooled. Principled clarity.",
    "advice": "Guard the consensus fairly; enforce the rules without sliding into censorship.",
    "shadow": "A blade that only ever cuts turns fair judgement into cold cruelty.",
    "upright_full": "This card is clear-eyed wisdom and fair judgement: independence, objectivity, upholding the rules, seeing through the pitch. Consensus Keeper rewards honest perception and principled boundaries. Judge with clarity - keep the edge sharp, not cruel.",
    "reversed_full": "Reversed, clarity turns cold: harsh criticism, bureaucracy, censorship, abuse of power, rigidity, cynicism. The blade cuts to wound rather than to clarify. Fairness hardens into control."
  },
  {
    "crypto_name": "Protocol Architect",
    "classic": "King of Swords",
    "suit": "Protocols",
    "arcana": "minor",
    "card_no": "63",
    "image": "/cards/63.webp",
    "keywords": [
      "Leadership",
      "Architecture",
      "Consensus",
      "Security",
      "Blockchain",
      "Mastery"
    ],
    "energy": null,
    "symbolism": "The supreme architect sits on a Genesis Block throne in a blockchain cathedral, a crown of rotating blocks on his head, the legendary Protocol Blade in one hand and the Blockchain Core sphere in the other, the Wheel of Consensus turning behind. As the King of air, he is intellect matured into ethical command - logic, structure and security wielded with responsibility.",
    "advice": "Architect the foundation with mastery; refuse to centralize or you become the risk.",
    "shadow": "Logic without ethics is how the architect becomes the exploit he was built to prevent.",
    "upright_full": "This card is intellectual authority and mastery: designing the system, leading with logic and ethics, taking responsibility for the whole ecosystem. Protocol Architect rewards principled, strategic command. Lead with clear, ethical logic - power over minds demands it.",
    "reversed_full": "Reversed, authority turns tyrannical: over-control, technical arrogance, refusing new ideas, dangerous centralization, logic used to dominate. The architect becomes a dictator of the protocol. Ethics fall away from the intellect."
  }
];
