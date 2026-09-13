import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  Animated,
  Easing,
  Platform,
  Dimensions,
} from 'react-native';
import { Image } from 'expo-image';
import * as Haptics from 'expo-haptics';
import { ALL_CARDS, CardData } from '@/data/cardsData';
import { CardImages } from '@/assets/cards';
import { ObsidianTokens } from '@/constants/theme';
import { shareToTwitter } from '@/utils/shareOmen';
import { unlockCards } from '@/services/codexService';

export type RitualStage = 'idle' | 'shuffle' | 'pick' | 'read' | 'sign' | 'sealed';

interface DailyRitualViewProps {
  streak: number;
  skrBalance: number;
  canRepairStreak?: boolean;
  streakRepairCostSkr?: number;
  isAlreadyClockedIn?: boolean;
  initialSealedCard?: CardData | null;
  initialOrientation?: 'UPRIGHT' | 'REVERSED';
  initialTxSignature?: string;
  initialSlot?: number;
  onRepairStreak?: () => void;
  onSignOnChain: (card: CardData, orientation: 'UPRIGHT' | 'REVERSED') => Promise<{
    success: boolean;
    signature?: string;
    slot?: number;
    error?: string;
  }>;
  onOpenRecord?: () => void;
  onInspectCard?: (card: CardData, orientation: 'UPRIGHT' | 'REVERSED') => void;
  onStateTrigger?: (type: 'wallet_declined' | 'tx_failed' | 'offline' | 'limit_reached') => void;
}

export function DailyRitualView({
  streak,
  skrBalance,
  canRepairStreak,
  streakRepairCostSkr = 1,
  isAlreadyClockedIn = false,
  initialSealedCard = null,
  initialOrientation = 'UPRIGHT',
  initialTxSignature,
  initialSlot,
  onRepairStreak,
  onSignOnChain,
  onOpenRecord,
  onInspectCard,
  onStateTrigger,
}: DailyRitualViewProps) {
  const [stage, setStage] = useState<RitualStage>(
    isAlreadyClockedIn ? 'sealed' : 'idle'
  );
  const [selectedCard, setSelectedCard] = useState<CardData>(
    initialSealedCard || ALL_CARDS[0]
  );
  const [orientation, setOrientation] = useState<'UPRIGHT' | 'REVERSED'>(
    initialOrientation
  );
  const [txHash, setTxHash] = useState(
    initialTxSignature || '5xKz8Wk2...4Kd9'
  );
  const [slotNumber, setSlotNumber] = useState(
    initialSlot || 289441204
  );
  const [countdownText, setCountdownText] = useState('24h 00m');

  // Animations
  const floatAnim = useRef(new Animated.Value(0)).current;
  const auraAnim = useRef(new Animated.Value(0.35)).current;
  const rotAnim = useRef(new Animated.Value(0)).current;
  const shuffleAnimA = useRef(new Animated.Value(0)).current;
  const shuffleAnimB = useRef(new Animated.Value(0)).current;
  const shuffleAnimC = useRef(new Animated.Value(0)).current;
  const flipAnim = useRef(new Animated.Value(isAlreadyClockedIn ? 1 : 0)).current;
  const spinAnim = useRef(new Animated.Value(0)).current;
  const sealScaleAnim = useRef(new Animated.Value(1)).current;

  // Day name
  const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
  const todayName = dayNames[new Date().getDay()];

  // Sync if isAlreadyClockedIn changes externally
  useEffect(() => {
    if (isAlreadyClockedIn && stage !== 'sealed') {
      setStage('sealed');
      if (initialSealedCard) {
        setSelectedCard(initialSealedCard);
      }
      if (initialOrientation) {
        setOrientation(initialOrientation);
      }
      if (initialTxSignature) {
        setTxHash(initialTxSignature);
      }
      if (initialSlot) {
        setSlotNumber(initialSlot);
      }
    }
  }, [isAlreadyClockedIn, initialSealedCard, initialOrientation, initialTxSignature, initialSlot]);

  // Live countdown to next UTC midnight
  useEffect(() => {
    const updateCountdown = () => {
      const now = new Date();
      const nextUtc = new Date(Date.UTC(
        now.getUTCFullYear(),
        now.getUTCMonth(),
        now.getUTCDate() + 1,
        0, 0, 0
      ));
      const diffMs = Math.max(0, nextUtc.getTime() - now.getTime());
      const hours = Math.floor(diffMs / (1000 * 60 * 60));
      const mins = Math.floor((diffMs % (1000 * 60 * 60)) / (1000 * 60));
      setCountdownText(`${hours}h ${mins}m`);
    };

    updateCountdown();
    const interval = setInterval(updateCountdown, 60000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    // Ambient floating
    const floatLoop = Animated.loop(
      Animated.sequence([
        Animated.timing(floatAnim, {
          toValue: -7,
          duration: 2700,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
        Animated.timing(floatAnim, {
          toValue: 0,
          duration: 2700,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
      ])
    );
    floatLoop.start();

    // Aura pulse
    const auraLoop = Animated.loop(
      Animated.sequence([
        Animated.timing(auraAnim, {
          toValue: 0.85,
          duration: 3500,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
        Animated.timing(auraAnim, {
          toValue: 0.35,
          duration: 3500,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
      ])
    );
    auraLoop.start();

    // Sacred ring slow rotation
    const rotLoop = Animated.loop(
      Animated.timing(rotAnim, {
        toValue: 1,
        duration: 90000,
        easing: Easing.linear,
        useNativeDriver: true,
      })
    );
    rotLoop.start();

    return () => {
      floatLoop.stop();
      auraLoop.stop();
      rotLoop.stop();
    };
  }, [floatAnim, auraAnim, rotAnim]);

  // Handle stage transitions
  const startShuffle = () => {
    try {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    } catch {}
    setStage('shuffle');

    // Shuffle loop
    Animated.parallel([
      Animated.loop(
        Animated.sequence([
          Animated.timing(shuffleAnimA, { toValue: 1, duration: 450, useNativeDriver: true }),
          Animated.timing(shuffleAnimA, { toValue: 0, duration: 450, useNativeDriver: true }),
        ])
      ),
      Animated.loop(
        Animated.sequence([
          Animated.timing(shuffleAnimB, { toValue: 1, duration: 450, useNativeDriver: true }),
          Animated.timing(shuffleAnimB, { toValue: 0, duration: 450, useNativeDriver: true }),
        ])
      ),
      Animated.loop(
        Animated.sequence([
          Animated.timing(shuffleAnimC, { toValue: 1, duration: 450, useNativeDriver: true }),
          Animated.timing(shuffleAnimC, { toValue: 0, duration: 450, useNativeDriver: true }),
        ])
      ),
    ]).start();

    setTimeout(() => {
      setStage('pick');
      try {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      } catch {}
    }, 1400);
  };

  const handlePickCard = (indexOffset: number) => {
    try {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
    } catch {}

    // Pick a card pseudo-randomly
    const randomCard = ALL_CARDS[Math.floor(Math.random() * ALL_CARDS.length)];
    const isReversed = Math.random() > 0.8;
    const chosenOrientation = isReversed ? 'REVERSED' : 'UPRIGHT';

    setSelectedCard(randomCard);
    setOrientation(chosenOrientation);

    // Auto unlock in codex
    unlockCards([randomCard.card_no]);

    // Flip animation
    flipAnim.setValue(0);
    setStage('read');
    Animated.timing(flipAnim, {
      toValue: 1,
      duration: ObsidianTokens.motion.revealDuration,
      easing: Easing.bezier(0.2, 0.7, 0.3, 1),
      useNativeDriver: true,
    }).start();
  };

  const handleSign = async () => {
    try {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
    } catch {}
    setStage('sign');

    // Spinner
    const spinLoop = Animated.loop(
      Animated.timing(spinAnim, {
        toValue: 1,
        duration: 1100,
        easing: Easing.linear,
        useNativeDriver: true,
      })
    );
    spinLoop.start();

    try {
      const res = await onSignOnChain(selectedCard, orientation);
      spinLoop.stop();
      if (res.success) {
        if (res.signature) setTxHash(res.signature);
        if (res.slot) setSlotNumber(res.slot);
        setStage('sealed');
        try {
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        } catch {}

        sealScaleAnim.setValue(0.7);
        Animated.spring(sealScaleAnim, {
          toValue: 1,
          friction: 5,
          tension: 40,
          useNativeDriver: true,
        }).start();
      } else {
        setStage('read');
        if (onStateTrigger) {
          onStateTrigger('tx_failed');
        }
      }
    } catch (err) {
      spinLoop.stop();
      setStage('read');
      if (onStateTrigger) {
        onStateTrigger('tx_failed');
      }
    }
  };

  const handleShareX = async () => {
    try {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    } catch {}
    await shareToTwitter({
      cardName: selectedCard.crypto_name,
      cardNo: selectedCard.card_no,
      orientation: orientation.toLowerCase() as 'upright' | 'reversed',
      streak: streak,
      proseOmen: selectedCard.advice,
      spreadName: 'Daily Consensus Block',
    });
  };

  const getRomanNumeral = (cardNo: string) => {
    const num = parseInt(cardNo, 10);
    const roman = ['0', 'I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII', 'IX', 'X', 'XI', 'XII', 'XIII', 'XIV', 'XV', 'XVI', 'XVII', 'XVIII', 'XIX', 'XX', 'XXI'];
    return roman[num] || cardNo;
  };

  const rotInterpolate = rotAnim.interpolate({
    inputRange: [0, 1],
    outputRange: ['0deg', '360deg'],
  });

  const spinInterpolate = spinAnim.interpolate({
    inputRange: [0, 1],
    outputRange: ['0deg', '360deg'],
  });

  const flipInterpolate = flipAnim.interpolate({
    inputRange: [0, 1],
    outputRange: ['90deg', '0deg'],
  });

  const shuffleTransA = shuffleAnimA.interpolate({
    inputRange: [0, 0.5, 1],
    outputRange: ['-3deg', '-16deg', '4deg'],
  });
  const shuffleTransC = shuffleAnimC.interpolate({
    inputRange: [0, 0.5, 1],
    outputRange: ['3deg', '16deg', '-4deg'],
  });

  const cardImageSource = CardImages[selectedCard.card_no] || CardImages['00'];

  return (
    <View style={styles.container}>
      {/* Background ambient glow */}
      <Animated.View style={[styles.auraGlow, { opacity: auraAnim }]} />
      {/* Rotating sacred gold boundary ring */}
      <Animated.View style={[styles.sacredRing, { transform: [{ rotate: rotInterpolate }] }]} />

      {/* Stage Tracker Header */}
      <View style={styles.topStageRow}>
        <Text style={styles.brandTitle}>DAILY CONSENSUS BLOCK</Text>
        <Text style={styles.stageIndicator}>
          {stage === 'idle' && 'UNREAD'}
          {stage === 'shuffle' && 'SHUFFLING'}
          {stage === 'pick' && 'CHOOSE'}
          {stage === 'read' && 'REVEALED'}
          {stage === 'sign' && 'SIGNING'}
          {stage === 'sealed' && 'SEALED ON-CHAIN'}
        </Text>
      </View>

      {/* 1. IDLE STAGE */}
      {stage === 'idle' && (
        <View style={styles.stageContent}>
          <View style={styles.headerBlock}>
            <Text style={styles.heroTitle}>
              {todayName} Rite{'\n'}
              <Text style={styles.goldItalic}>draw consensus</Text>
            </Text>
            <Text style={styles.heroSub}>
              One card per block. Touch the deck to cast your intent into the protocol.
            </Text>
          </View>

          {/* Stacked Deck with Float */}
          <Pressable onPress={startShuffle} style={styles.deckStackContainer}>
            <Animated.View style={[styles.deckStack, { transform: [{ translateY: floatAnim }] }]}>
              <View style={[styles.cardBackLayer, styles.cardLayerBottom]} />
              <View style={[styles.cardBackLayer, styles.cardLayerMiddle]} />
              <View style={[styles.cardBackLayer, styles.cardLayerTop]}>
                <View style={styles.diamondEmblem}>
                  <View style={styles.innerDiamond} />
                </View>
                <Text style={styles.arcanaLabel}>78 ARCANA</Text>
              </View>
            </Animated.View>
          </Pressable>

          <View style={styles.bottomActions}>
            <Pressable
              style={({ pressed }) => [styles.touchDeckBtn, pressed && styles.btnPressed]}
              onPress={startShuffle}
            >
              <Text style={styles.touchDeckText}>TOUCH THE DECK</Text>
            </Pressable>

            <View style={styles.streakIndicatorRow}>
              <Text style={styles.streakLabel}>DAY {streak} UNBROKEN</Text>
              {canRepairStreak && (
                <Pressable onPress={onRepairStreak} style={styles.repairTag}>
                  <Text style={styles.repairTagText}>Repair ({streakRepairCostSkr} SKR)</Text>
                </Pressable>
              )}
            </View>
          </View>
        </View>
      )}

      {/* 2. SHUFFLE STAGE */}
      {stage === 'shuffle' && (
        <View style={styles.stageContent}>
          <View style={styles.headerBlock}>
            <Text style={styles.shufflingTitle}>The network is shuffling</Text>
          </View>

          <View style={styles.deckStackContainer}>
            <View style={styles.shuffleBox}>
              <Animated.View style={[styles.cardBackLayer, styles.cardLayerBottom, { transform: [{ rotate: shuffleTransA }] }]} />
              <Animated.View style={[styles.cardBackLayer, styles.cardLayerMiddle, { transform: [{ rotate: shuffleTransC }] }]} />
              <Animated.View style={[styles.cardBackLayer, styles.cardLayerTop, styles.glowBorder]} />
            </View>
          </View>

          <View style={styles.bottomActions}>
            <Text style={styles.shufflingMono}>SAMPLING VALIDATOR ENTROPY_</Text>
          </View>
        </View>
      )}

      {/* 3. PICK STAGE */}
      {stage === 'pick' && (
        <View style={styles.stageContent}>
          <View style={styles.headerBlock}>
            <Text style={styles.heroTitle}>
              Select your{'\n'}
              <Text style={styles.goldItalic}>consensus card</Text>
            </Text>
            <Text style={styles.heroSub}>Choose one of the three archetypes drawn from the slot.</Text>
          </View>

          {/* Fan of 3 interactive cards */}
          <View style={styles.fanContainer}>
            <Pressable
              style={({ pressed }) => [styles.fanCard, styles.fanCardLeft, pressed && styles.btnPressed]}
              onPress={() => handlePickCard(-1)}
            >
              <Animated.View style={styles.fanInnerWrapper}>
                <View style={styles.fanDiamond} />
                <Text style={styles.fanCardLabel}>SLOT A</Text>
              </Animated.View>
            </Pressable>

            <Pressable
              style={({ pressed }) => [styles.fanCard, styles.fanCardCenter, pressed && styles.btnPressed]}
              onPress={() => handlePickCard(0)}
            >
              <Animated.View style={styles.fanInnerWrapper}>
                <View style={styles.fanDiamond} />
                <Text style={styles.fanCardLabel}>SLOT B</Text>
              </Animated.View>
            </Pressable>

            <Pressable
              style={({ pressed }) => [styles.fanCard, styles.fanCardRight, pressed && styles.btnPressed]}
              onPress={() => handlePickCard(1)}
            >
              <Animated.View style={styles.fanInnerWrapper}>
                <View style={styles.fanDiamond} />
                <Text style={styles.fanCardLabel}>SLOT C</Text>
              </Animated.View>
            </Pressable>
          </View>

          <View style={styles.bottomActions}>
            <Text style={styles.tapCardLabel}>TAP TO REVEAL</Text>
          </View>
        </View>
      )}

      {/* 4. READ STAGE */}
      {stage === 'read' && (
        <View style={styles.stageContent}>
          {/* Card Reveal with Real Art & 3D Flip */}
          <Pressable
            style={styles.revealedCardPressable}
            onPress={() => onInspectCard && onInspectCard(selectedCard, orientation)}
          >
            <Animated.View style={[styles.revealedCardBox, { transform: [{ rotateY: flipInterpolate }] }]}>
              <Image
                source={cardImageSource}
                style={[
                  styles.revealedCardImage,
                  orientation === 'REVERSED' && styles.cardImageReversed,
                ]}
                contentFit="cover"
                transition={200}
              />
              <View style={styles.zoomAffordanceBadge}>
                <Text style={styles.zoomAffordanceText}>TAP TO ZOOM</Text>
              </View>
              {orientation === 'REVERSED' && (
                <View style={styles.reversedBadge}>
                  <Text style={styles.reversedBadgeText}>▼ REVERSED</Text>
                </View>
              )}
            </Animated.View>
          </Pressable>

          <View style={styles.cardInfoBox}>
            <Text style={styles.cardNumeralLabel}>
              {getRomanNumeral(selectedCard.card_no)} · {selectedCard.suit.toUpperCase()}
            </Text>
            <Text style={styles.cardTitleSerif}>{selectedCard.crypto_name}</Text>
            {selectedCard.classic && (
              <Text style={styles.classicSubtitle}>Classic: {selectedCard.classic}</Text>
            )}
            <View
              style={[
                styles.orientationPill,
                orientation === 'REVERSED' ? styles.orientationPillRev : styles.orientationPillUp,
              ]}
            >
              <Text
                style={[
                  styles.orientationText,
                  orientation === 'REVERSED' ? styles.orientationTextRev : styles.orientationTextUp,
                ]}
              >
                {orientation === 'REVERSED' ? '▼ DRAWN REVERSED' : '▲ DRAWN UPRIGHT'}
              </Text>
            </View>

            <Text style={styles.cardBodySerif}>
              {orientation === 'REVERSED' && selectedCard.reversed_full
                ? selectedCard.reversed_full
                : selectedCard.upright_full || selectedCard.advice}
            </Text>
          </View>

          {/* The One Action Box */}
          <View style={styles.actionPanel}>
            <Text style={styles.actionPanelLabel}>ORACLE DIRECTIVE</Text>
            <Text style={styles.actionPanelText}>{selectedCard.advice}</Text>
          </View>

          <View style={styles.readActionsRow}>
            <Pressable
              style={({ pressed }) => [styles.secondaryBtn, pressed && styles.btnPressed]}
              onPress={() => onInspectCard && onInspectCard(selectedCard, orientation)}
            >
              <Text style={styles.secondaryBtnText}>INSPECT</Text>
            </Pressable>
            <Pressable
              style={({ pressed }) => [styles.primaryGoldBtn, pressed && styles.btnPressed]}
              onPress={handleSign}
            >
              <Text style={styles.primaryGoldBtnText}>SIGN ON-CHAIN</Text>
            </Pressable>
          </View>
        </View>
      )}

      {/* 5. SIGN STAGE */}
      {stage === 'sign' && (
        <View style={styles.stageContent}>
          <View style={styles.signingCenter}>
            <Animated.View style={[styles.spinRingBig, { transform: [{ rotate: spinInterpolate }] }]} />
            <Text style={styles.signingTitle}>Sealing the block</Text>
            <Text style={styles.signingSub}>Broadcasting consensus to Solana ledger. Gas fee 0.00021 SOL.</Text>
            <Text style={styles.awaitingMono}>AWAITING SIGNATURE_</Text>
          </View>

          <View style={styles.bottomActions}>
            <Pressable
              style={({ pressed }) => [styles.ghostCancelBtn, pressed && styles.btnPressed]}
              onPress={() => setStage('read')}
            >
              <Text style={styles.ghostCancelText}>CANCEL</Text>
            </Pressable>
          </View>
        </View>
      )}

      {/* 6. SEALED STAGE: PROUDLY RENDER SEALED DAILY CARD */}
      {stage === 'sealed' && (
        <View style={styles.stageContent}>
          {/* Header Status */}
          <View style={styles.sealedHeaderRow}>
            <View style={styles.sealedLiveDot} />
            <Text style={styles.sealedHeaderStatus}>SEALED ON SOLANA</Text>
            <Text style={styles.sealedSlotTag}>SLOT #{slotNumber}</Text>
          </View>

          {/* Prominently Displayed Sealed Card */}
          <Pressable
            style={styles.sealedCardPressable}
            onPress={() => onInspectCard && onInspectCard(selectedCard, orientation)}
          >
            <Animated.View style={[styles.sealedCardOuter, { transform: [{ scale: sealScaleAnim }] }]}>
              <Image
                source={cardImageSource}
                style={[
                  styles.sealedCardImage,
                  orientation === 'REVERSED' && styles.cardImageReversed,
                ]}
                contentFit="cover"
              />
              <View style={styles.sealedStampBadge}>
                <Text style={styles.sealedStampText}>FINALIZED</Text>
              </View>
            </Animated.View>
          </Pressable>

          <Text style={styles.sealedCardName}>{selectedCard.crypto_name}</Text>
          <Text style={styles.sealedCardMeta}>
            {getRomanNumeral(selectedCard.card_no)} · {orientation === 'REVERSED' ? '▼ Reversed' : '▲ Upright'}
          </Text>

          {/* Streak & Proof Card */}
          <View style={styles.sealedRecordCard}>
            <View style={styles.recordRow}>
              <Text style={styles.recordKey}>CURRENT STREAK</Text>
              <Text style={styles.recordValGold}>🔥 Day {streak} Unbroken</Text>
            </View>
            <View style={styles.recordDivider} />
            <View style={styles.recordRow}>
              <Text style={styles.recordKey}>TX SIGNATURE</Text>
              <Text style={styles.recordValMono} numberOfLines={1}>
                {txHash.substring(0, 12)}...{txHash.substring(txHash.length - 6)}
              </Text>
            </View>
            <View style={styles.recordDivider} />
            <View style={styles.recordRow}>
              <Text style={styles.recordKey}>ORACLE FUEL</Text>
              <Text style={styles.recordValGold}>+25 SKR Claimed</Text>
            </View>
          </View>

          {/* Daily Guidance Quote */}
          <View style={styles.adviceQuoteBox}>
            <Text style={styles.adviceQuoteLabel}>TODAY'S ORACLE GUIDANCE</Text>
            <Text style={styles.adviceQuoteText}>"{selectedCard.advice}"</Text>
          </View>

          {/* Countdown Pill */}
          <View style={styles.countdownRow}>
            <Text style={styles.countdownText}>
              NEXT RITE UNLOCKS IN {countdownText}
            </Text>
          </View>

          {/* Action Buttons: Inspect & Transmit (NO reset loop!) */}
          <View style={styles.sealedActionsRow}>
            <Pressable
              style={({ pressed }) => [styles.secondaryBtn, pressed && styles.btnPressed]}
              onPress={() => onInspectCard && onInspectCard(selectedCard, orientation)}
            >
              <Text style={styles.secondaryBtnText}>INSPECT CODEX</Text>
            </Pressable>
            <Pressable
              style={({ pressed }) => [styles.primaryGoldBtn, pressed && styles.btnPressed]}
              onPress={handleShareX}
            >
              <Text style={styles.primaryGoldBtnText}>TRANSMIT OMEN</Text>
            </Pressable>
          </View>

          {/* Contextual Note */}
          <Text style={styles.sealedNoteText}>
            Today's block is permanently recorded in consensus. To consult the oracle further, cast a Spread below.
          </Text>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: ObsidianTokens.colors.ink.void,
    borderRadius: 36,
    borderWidth: 1,
    borderColor: ObsidianTokens.colors.gold.subtle,
    paddingTop: 18,
    paddingBottom: 24,
    paddingHorizontal: 18,
    marginVertical: 14,
    overflow: 'hidden',
    position: 'relative',
    minHeight: 460,
  },
  auraGlow: {
    position: 'absolute',
    top: -120,
    left: '50%',
    marginLeft: -200,
    width: 400,
    height: 400,
    borderRadius: 200,
    backgroundColor: ObsidianTokens.colors.violet.aura,
  },
  sacredRing: {
    position: 'absolute',
    top: -90,
    left: '50%',
    marginLeft: -210,
    width: 420,
    height: 420,
    borderRadius: 210,
    borderWidth: 1,
    borderColor: 'rgba(200, 162, 74, 0.12)',
  },
  topStageRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  brandTitle: {
    fontFamily: Platform.select({ ios: 'SpaceMono', android: 'SpaceMono', default: 'monospace' }),
    fontSize: 9,
    letterSpacing: 2,
    color: ObsidianTokens.colors.gold.primary,
  },
  stageIndicator: {
    fontFamily: Platform.select({ ios: 'SpaceMono', android: 'SpaceMono', default: 'monospace' }),
    fontSize: 9,
    letterSpacing: 1.5,
    color: ObsidianTokens.colors.ink.text42,
  },
  stageContent: {
    alignItems: 'center',
    width: '100%',
  },
  headerBlock: {
    alignItems: 'center',
    marginBottom: 12,
  },
  heroTitle: {
    fontFamily: Platform.select({ ios: 'Georgia', android: 'serif', default: 'serif' }),
    fontSize: 30,
    fontWeight: '300',
    color: ObsidianTokens.colors.ink.text,
    textAlign: 'center',
    lineHeight: 36,
  },
  goldItalic: {
    color: ObsidianTokens.colors.gold.primary,
    fontStyle: 'italic',
  },
  heroSub: {
    fontFamily: Platform.select({ ios: 'Georgia', android: 'serif', default: 'serif' }),
    fontSize: 13,
    lineHeight: 18,
    color: ObsidianTokens.colors.ink.text55,
    textAlign: 'center',
    marginTop: 6,
    paddingHorizontal: 12,
  },
  deckStackContainer: {
    marginVertical: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  deckStack: {
    width: 140,
    height: 215,
    position: 'relative',
  },
  cardBackLayer: {
    position: 'absolute',
    top: 0,
    left: 0,
    width: '100%',
    height: '100%',
    borderRadius: 14,
    borderWidth: 1,
  },
  cardLayerBottom: {
    borderColor: 'rgba(200, 162, 74, 0.3)',
    backgroundColor: '#110D1A',
    transform: [{ rotate: '-4deg' }, { translateY: 6 }],
  },
  cardLayerMiddle: {
    borderColor: 'rgba(200, 162, 74, 0.4)',
    backgroundColor: '#141020',
    transform: [{ rotate: '3deg' }, { translateY: 3 }],
  },
  cardLayerTop: {
    borderColor: ObsidianTokens.colors.gold.primary,
    backgroundColor: '#0E0B16',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 16,
    shadowColor: ObsidianTokens.colors.violet.glow,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.35,
    shadowRadius: 20,
    elevation: 8,
  },
  glowBorder: {
    borderColor: ObsidianTokens.colors.gold.primary,
    borderWidth: 1.5,
  },
  diamondEmblem: {
    width: 44,
    height: 44,
    borderWidth: 1,
    borderColor: ObsidianTokens.colors.gold.primary,
    transform: [{ rotate: '45deg' }],
    alignItems: 'center',
    justifyContent: 'center',
  },
  innerDiamond: {
    width: 20,
    height: 20,
    borderWidth: 1,
    borderColor: ObsidianTokens.colors.gold.muted,
  },
  arcanaLabel: {
    fontFamily: Platform.select({ ios: 'SpaceMono', android: 'SpaceMono', default: 'monospace' }),
    fontSize: 9,
    letterSpacing: 2,
    color: ObsidianTokens.colors.gold.primary,
  },
  bottomActions: {
    width: '100%',
    alignItems: 'center',
    marginTop: 6,
  },
  touchDeckBtn: {
    width: '100%',
    backgroundColor: ObsidianTokens.colors.gold.primary,
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  touchDeckText: {
    fontFamily: Platform.select({ ios: 'SpaceMono', android: 'SpaceMono', default: 'monospace' }),
    fontSize: 11,
    letterSpacing: 1.8,
    fontWeight: '600',
    color: '#100C06',
  },
  streakIndicatorRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginTop: 12,
  },
  streakLabel: {
    fontFamily: Platform.select({ ios: 'SpaceMono', android: 'SpaceMono', default: 'monospace' }),
    fontSize: 10,
    color: ObsidianTokens.colors.ink.text42,
    letterSpacing: 1.2,
  },
  repairTag: {
    paddingVertical: 3,
    paddingHorizontal: 8,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: ObsidianTokens.colors.gold.primary,
    backgroundColor: ObsidianTokens.colors.gold.surface,
  },
  repairTagText: {
    fontFamily: Platform.select({ ios: 'SpaceMono', android: 'SpaceMono', default: 'monospace' }),
    fontSize: 9,
    color: ObsidianTokens.colors.gold.primary,
  },
  shufflingTitle: {
    fontFamily: Platform.select({ ios: 'Georgia', android: 'serif', default: 'serif' }),
    fontSize: 26,
    fontWeight: '300',
    fontStyle: 'italic',
    color: ObsidianTokens.colors.ink.text82,
    marginTop: 10,
  },
  shufflingMono: {
    fontFamily: Platform.select({ ios: 'SpaceMono', android: 'SpaceMono', default: 'monospace' }),
    fontSize: 10,
    letterSpacing: 2.2,
    color: ObsidianTokens.colors.gold.primary,
    marginTop: 14,
  },
  shuffleBox: {
    width: 140,
    height: 215,
    position: 'relative',
  },
  fanContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 10,
    marginVertical: 24,
  },
  fanCard: {
    width: 98,
    height: 152,
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: 'rgba(200, 162, 74, 0.45)',
    backgroundColor: ObsidianTokens.colors.ink.surface,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: ObsidianTokens.colors.gold.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 4,
  },
  fanCardLeft: {
    transform: [{ rotate: '-8deg' }],
  },
  fanCardCenter: {
    transform: [{ rotate: '0deg' }, { translateY: -6 }],
  },
  fanCardRight: {
    transform: [{ rotate: '8deg' }],
  },
  fanInnerWrapper: {
    alignItems: 'center',
    gap: 14,
  },
  fanDiamond: {
    width: 26,
    height: 26,
    borderWidth: 1,
    borderColor: ObsidianTokens.colors.gold.primary,
    transform: [{ rotate: '45deg' }],
  },
  fanCardLabel: {
    fontFamily: Platform.select({ ios: 'SpaceMono', android: 'SpaceMono', default: 'monospace' }),
    fontSize: 8,
    letterSpacing: 1.5,
    color: ObsidianTokens.colors.gold.primary,
  },
  tapCardLabel: {
    fontFamily: Platform.select({ ios: 'SpaceMono', android: 'SpaceMono', default: 'monospace' }),
    fontSize: 10,
    letterSpacing: 2,
    color: ObsidianTokens.colors.ink.text42,
  },
  revealedCardPressable: {
    alignItems: 'center',
    marginVertical: 10,
  },
  revealedCardBox: {
    width: 160,
    height: 248,
    borderRadius: 14,
    borderWidth: 1.5,
    borderColor: ObsidianTokens.colors.gold.primary,
    backgroundColor: '#08070B',
    overflow: 'hidden',
    position: 'relative',
    shadowColor: ObsidianTokens.colors.gold.primary,
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.35,
    shadowRadius: 16,
    elevation: 10,
  },
  revealedCardImage: {
    width: '100%',
    height: '100%',
  },
  cardImageReversed: {
    transform: [{ rotateZ: '180deg' }],
  },
  zoomAffordanceBadge: {
    position: 'absolute',
    bottom: 8,
    alignSelf: 'center',
    backgroundColor: 'rgba(8, 7, 11, 0.88)',
    borderColor: ObsidianTokens.colors.gold.subtle,
    borderWidth: 1,
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  zoomAffordanceText: {
    fontFamily: Platform.select({ ios: 'SpaceMono', android: 'SpaceMono', default: 'monospace' }),
    fontSize: 8,
    color: ObsidianTokens.colors.gold.primary,
    letterSpacing: 1,
  },
  reversedBadge: {
    position: 'absolute',
    top: 8,
    left: 8,
    backgroundColor: '#D45240',
    borderColor: 'rgba(212, 82, 64, 0.8)',
    borderWidth: 1,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 5,
  },
  reversedBadgeText: {
    fontFamily: Platform.select({ ios: 'SpaceMono', android: 'SpaceMono', default: 'monospace' }),
    color: '#EDE7DC',
    fontSize: 8,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
  cardInfoBox: {
    alignItems: 'center',
    paddingHorizontal: 8,
    marginTop: 6,
  },
  cardNumeralLabel: {
    fontFamily: Platform.select({ ios: 'SpaceMono', android: 'SpaceMono', default: 'monospace' }),
    fontSize: 9,
    letterSpacing: 2,
    color: ObsidianTokens.colors.gold.primary,
  },
  cardTitleSerif: {
    fontFamily: Platform.select({ ios: 'Georgia', android: 'serif', default: 'serif' }),
    fontSize: 26,
    fontWeight: '300',
    color: ObsidianTokens.colors.ink.text,
    textAlign: 'center',
    marginTop: 4,
  },
  classicSubtitle: {
    fontFamily: Platform.select({ ios: 'Georgia', android: 'serif', default: 'serif' }),
    fontSize: 12,
    fontStyle: 'italic',
    color: ObsidianTokens.colors.ink.text55,
    marginTop: 2,
  },
  orientationPill: {
    paddingHorizontal: 10,
    paddingVertical: 3,
    borderRadius: 999,
    borderWidth: 1,
    marginTop: 8,
    marginBottom: 8,
  },
  orientationPillUp: {
    backgroundColor: ObsidianTokens.colors.gold.surface,
    borderColor: ObsidianTokens.colors.gold.subtle,
  },
  orientationPillRev: {
    backgroundColor: 'rgba(212, 82, 64, 0.15)',
    borderColor: '#D45240',
  },
  orientationText: {
    fontFamily: Platform.select({ ios: 'SpaceMono', android: 'SpaceMono', default: 'monospace' }),
    fontSize: 8,
    fontWeight: '700',
    letterSpacing: 1,
  },
  orientationTextUp: {
    color: ObsidianTokens.colors.gold.primary,
  },
  orientationTextRev: {
    color: '#FFA595',
  },
  cardBodySerif: {
    fontFamily: Platform.select({ ios: 'Georgia', android: 'serif', default: 'serif' }),
    fontSize: 13,
    lineHeight: 19,
    color: ObsidianTokens.colors.ink.text82,
    textAlign: 'center',
    paddingHorizontal: 8,
    marginTop: 4,
  },
  actionPanel: {
    backgroundColor: ObsidianTokens.colors.ink.fill,
    borderColor: ObsidianTokens.colors.gold.subtle,
    borderWidth: 1,
    borderRadius: 12,
    padding: 14,
    width: '100%',
    marginVertical: 12,
  },
  actionPanelLabel: {
    fontFamily: Platform.select({ ios: 'SpaceMono', android: 'SpaceMono', default: 'monospace' }),
    fontSize: 9,
    letterSpacing: 1.5,
    color: ObsidianTokens.colors.gold.primary,
    marginBottom: 4,
  },
  actionPanelText: {
    fontFamily: Platform.select({ ios: 'Georgia', android: 'serif', default: 'serif' }),
    fontSize: 13,
    lineHeight: 18,
    color: ObsidianTokens.colors.ink.text,
  },
  readActionsRow: {
    flexDirection: 'row',
    gap: 10,
    width: '100%',
    marginTop: 4,
  },
  secondaryBtn: {
    flex: 1,
    borderWidth: 1,
    borderColor: ObsidianTokens.colors.ink.hairline,
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: ObsidianTokens.colors.ink.surface,
  },
  secondaryBtnText: {
    fontFamily: Platform.select({ ios: 'SpaceMono', android: 'SpaceMono', default: 'monospace' }),
    fontSize: 10,
    letterSpacing: 1.4,
    color: ObsidianTokens.colors.ink.text82,
    fontWeight: '600',
  },
  primaryGoldBtn: {
    flex: 1.5,
    backgroundColor: ObsidianTokens.colors.gold.primary,
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  primaryGoldBtnText: {
    fontFamily: Platform.select({ ios: 'SpaceMono', android: 'SpaceMono', default: 'monospace' }),
    fontSize: 11,
    letterSpacing: 1.4,
    fontWeight: '700',
    color: '#100C06',
  },
  signingCenter: {
    alignItems: 'center',
    paddingVertical: 36,
  },
  spinRingBig: {
    width: 68,
    height: 68,
    borderRadius: 34,
    borderWidth: 2,
    borderColor: ObsidianTokens.colors.gold.subtle,
    borderTopColor: ObsidianTokens.colors.gold.primary,
    marginBottom: 24,
  },
  signingTitle: {
    fontFamily: Platform.select({ ios: 'Georgia', android: 'serif', default: 'serif' }),
    fontSize: 24,
    fontWeight: '300',
    color: ObsidianTokens.colors.ink.text,
  },
  signingSub: {
    fontFamily: Platform.select({ ios: 'Georgia', android: 'serif', default: 'serif' }),
    fontSize: 13,
    color: ObsidianTokens.colors.ink.text55,
    marginTop: 6,
    textAlign: 'center',
    paddingHorizontal: 16,
  },
  awaitingMono: {
    fontFamily: Platform.select({ ios: 'SpaceMono', android: 'SpaceMono', default: 'monospace' }),
    fontSize: 10,
    letterSpacing: 2,
    color: ObsidianTokens.colors.gold.primary,
    marginTop: 18,
  },
  ghostCancelBtn: {
    borderWidth: 1,
    borderColor: ObsidianTokens.colors.ink.hairline,
    borderRadius: 12,
    paddingVertical: 12,
    width: '100%',
    alignItems: 'center',
  },
  ghostCancelText: {
    fontFamily: Platform.select({ ios: 'SpaceMono', android: 'SpaceMono', default: 'monospace' }),
    fontSize: 10,
    letterSpacing: 1.4,
    color: ObsidianTokens.colors.ink.text55,
  },
  sealedHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 14,
  },
  sealedLiveDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#14F195',
  },
  sealedHeaderStatus: {
    fontFamily: Platform.select({ ios: 'SpaceMono', android: 'SpaceMono', default: 'monospace' }),
    fontSize: 9,
    letterSpacing: 1.5,
    color: '#14F195',
    fontWeight: '700',
  },
  sealedSlotTag: {
    fontFamily: Platform.select({ ios: 'SpaceMono', android: 'SpaceMono', default: 'monospace' }),
    fontSize: 9,
    letterSpacing: 1,
    color: ObsidianTokens.colors.ink.text42,
  },
  sealedCardPressable: {
    alignItems: 'center',
    marginVertical: 8,
  },
  sealedCardOuter: {
    width: 154,
    height: 238,
    borderRadius: 16,
    borderWidth: 2,
    borderColor: ObsidianTokens.colors.gold.primary,
    backgroundColor: '#08070B',
    overflow: 'hidden',
    position: 'relative',
    shadowColor: ObsidianTokens.colors.gold.primary,
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.35,
    shadowRadius: 18,
    elevation: 12,
  },
  sealedCardImage: {
    width: '100%',
    height: '100%',
  },
  sealedStampBadge: {
    position: 'absolute',
    bottom: 8,
    alignSelf: 'center',
    backgroundColor: 'rgba(200, 162, 74, 0.92)',
    paddingHorizontal: 12,
    paddingVertical: 3,
    borderRadius: 999,
  },
  sealedStampText: {
    fontFamily: Platform.select({ ios: 'SpaceMono', android: 'SpaceMono', default: 'monospace' }),
    fontSize: 8,
    fontWeight: '800',
    letterSpacing: 1.2,
    color: '#08070B',
  },
  sealedCardName: {
    fontFamily: Platform.select({ ios: 'Georgia', android: 'serif', default: 'serif' }),
    fontSize: 24,
    fontWeight: '300',
    color: ObsidianTokens.colors.ink.text,
    textAlign: 'center',
    marginTop: 8,
  },
  sealedCardMeta: {
    fontFamily: Platform.select({ ios: 'SpaceMono', android: 'SpaceMono', default: 'monospace' }),
    fontSize: 10,
    letterSpacing: 1.5,
    color: ObsidianTokens.colors.gold.primary,
    marginTop: 2,
  },
  sealedRecordCard: {
    width: '100%',
    backgroundColor: ObsidianTokens.colors.ink.surface,
    borderColor: ObsidianTokens.colors.ink.hairline,
    borderWidth: 1,
    borderRadius: 14,
    padding: 14,
    marginVertical: 12,
  },
  recordRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 4,
  },
  recordKey: {
    fontFamily: Platform.select({ ios: 'SpaceMono', android: 'SpaceMono', default: 'monospace' }),
    fontSize: 9,
    letterSpacing: 1,
    color: ObsidianTokens.colors.ink.text42,
  },
  recordValGold: {
    fontFamily: Platform.select({ ios: 'SpaceMono', android: 'SpaceMono', default: 'monospace' }),
    fontSize: 10,
    fontWeight: '700',
    color: ObsidianTokens.colors.gold.primary,
  },
  recordValMono: {
    fontFamily: Platform.select({ ios: 'SpaceMono', android: 'SpaceMono', default: 'monospace' }),
    fontSize: 9,
    color: ObsidianTokens.colors.ink.text82,
  },
  recordDivider: {
    height: 1,
    backgroundColor: ObsidianTokens.colors.ink.hairline,
    marginVertical: 4,
  },
  adviceQuoteBox: {
    backgroundColor: ObsidianTokens.colors.ink.fill,
    borderColor: ObsidianTokens.colors.gold.subtle,
    borderWidth: 1,
    borderRadius: 12,
    padding: 14,
    width: '100%',
    marginBottom: 10,
  },
  adviceQuoteLabel: {
    fontFamily: Platform.select({ ios: 'SpaceMono', android: 'SpaceMono', default: 'monospace' }),
    fontSize: 8,
    letterSpacing: 1.5,
    color: ObsidianTokens.colors.gold.primary,
    marginBottom: 4,
  },
  adviceQuoteText: {
    fontFamily: Platform.select({ ios: 'Georgia', android: 'serif', default: 'serif' }),
    fontSize: 13,
    lineHeight: 18,
    fontStyle: 'italic',
    color: ObsidianTokens.colors.ink.text82,
  },
  countdownRow: {
    paddingVertical: 6,
    paddingHorizontal: 14,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: ObsidianTokens.colors.ink.hairline,
    backgroundColor: ObsidianTokens.colors.ink.surface,
    marginBottom: 12,
  },
  countdownText: {
    fontFamily: Platform.select({ ios: 'SpaceMono', android: 'SpaceMono', default: 'monospace' }),
    fontSize: 9,
    letterSpacing: 1.5,
    color: ObsidianTokens.colors.gold.primary,
    fontWeight: '600',
  },
  sealedActionsRow: {
    flexDirection: 'row',
    gap: 10,
    width: '100%',
    marginTop: 4,
  },
  sealedNoteText: {
    fontFamily: Platform.select({ ios: 'Georgia', android: 'serif', default: 'serif' }),
    fontSize: 11,
    lineHeight: 15,
    color: ObsidianTokens.colors.ink.text42,
    textAlign: 'center',
    marginTop: 12,
    paddingHorizontal: 8,
  },
  btnPressed: {
    transform: [{ scale: ObsidianTokens.motion.pressScale }],
  },
});

export default DailyRitualView;
