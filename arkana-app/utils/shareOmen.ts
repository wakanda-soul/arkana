import { Linking, Share } from 'react-native';

export interface ShareOmenData {
  cardName: string;
  cardNo: string;
  orientation: 'upright' | 'reversed';
  streak?: number;
  proseOmen?: string;
  spreadName?: string;
}

const TWEET_TEMPLATES = [
  (d: ShareOmenData) =>
    `The ledger does not lie. Drawn into my daily consensus on @SolanaMobile Seeker: ${d.cardName} (${d.orientation}).\n\n"${d.proseOmen || 'Consensus confirms the path forward.'}"\n\nStreak: ${d.streak || 1} days 🔥\n#Solana #Seeker #Arkana #ClockIn`,

  (d: ShareOmenData) =>
    `Validating my market mindset before executing the next block. Arkana revealed ${d.cardName} (${d.orientation}) for today's consensus.\n\n"${d.proseOmen || 'Act with the composure of a validator.'}"\n\nDay ${d.streak || 1} streak. Validating conviction over noise.\n#Solana #CryptoTarot #Seeker #DeFAI`,

  (d: ShareOmenData) =>
    `Block consensus confirmed on @SolanaMobile. Archetype #${d.cardNo}: ${d.cardName} has anchored my daily reading.\n\nTransmission: "${d.proseOmen || 'Every block is irreversible.'}"\n\nConsensus streak: ${d.streak || 1} consecutive blocks.\n#Arkana #SolanaMobile #ClockIn`,

  (d: ShareOmenData) =>
    `"Every block is irreversible." Consulted Arkana, The Solana Oracle: drawn ${d.cardName} (${d.orientation}).\n\nOracle guidance: "${d.proseOmen || 'Stay disciplined in the mempool.'}"\n\nConsensus streak: ${d.streak || 1} days. Staying hedged.\n#Solana #DeFi #Seeker`,

  (d: ShareOmenData) =>
    `Clocking in on the Seeker Altar. Daily consensus unlocked: ${d.cardName} (${d.orientation}).\n\n"${d.proseOmen || 'Aligning intent with the ledger.'}"\n\nDay ${d.streak || 1} streak 🔥 Refining my on-chain signal with @ArkanaOracle.\n#Seeker #ClockIn #Solana`
];

/**
 * Open Twitter / X intent with a randomized template to prevent bot detection
 */
export async function shareToTwitter(data: ShareOmenData) {
  const randomIndex = Math.floor(Math.random() * TWEET_TEMPLATES.length);
  const text = TWEET_TEMPLATES[randomIndex](data);
  const mediaUrl = `http://184.174.39.62/cards/${data.cardNo}.webp`;
  const tweetUrl = `https://twitter.com/intent/tweet?text=${encodeURIComponent(text)}&url=${encodeURIComponent(mediaUrl)}`;

  try {
    await Linking.openURL(tweetUrl);
  } catch {
    await Linking.openURL(`https://x.com/intent/tweet?text=${encodeURIComponent(text)}&url=${encodeURIComponent(mediaUrl)}`);
  }
}

/**
 * Native Android system share sheet for sharing to Telegram, Discord, etc.
 */
export async function shareGeneral(data: ShareOmenData) {
  const randomIndex = Math.floor(Math.random() * TWEET_TEMPLATES.length);
  const text = TWEET_TEMPLATES[randomIndex](data);
  const mediaUrl = `http://184.174.39.62/cards/${data.cardNo}.webp`;

  await Share.share({
    message: `${text}\n\n${mediaUrl}`,
    title: `Arkana Consensus: ${data.cardName}`,
  });
}
