import React, { useEffect, useRef } from 'react';
import {
  StyleSheet,
  View,
  Text,
  Animated,
  Platform,
  ViewStyle,
  StyleProp,
} from 'react-native';
import { Image } from 'expo-image';
import { ObsidianTokens } from '@/constants/theme';
import { CARD_BACK } from '@/assets/cards';

interface ShuffleCeremonyProps {
  compact?: boolean;
  title?: string;
  kicker?: string;
  subtitle?: string;
  containerStyle?: StyleProp<ViewStyle>;
}

export function ShuffleCeremony({
  compact = false,
  title = 'The network is shuffling',
  kicker,
  subtitle = 'SAMPLING VALIDATOR ENTROPY_',
  containerStyle,
}: ShuffleCeremonyProps) {
  const shuffleAnimA = useRef(new Animated.Value(0)).current;
  const shuffleAnimB = useRef(new Animated.Value(0)).current;
  const shuffleAnimC = useRef(new Animated.Value(0)).current;
  const pulseAnim = useRef(new Animated.Value(0.4)).current;

  useEffect(() => {
    const shuffleLoop = Animated.parallel([
      Animated.loop(
        Animated.sequence([
          Animated.timing(shuffleAnimA, { toValue: 1, duration: 420, useNativeDriver: true }),
          Animated.timing(shuffleAnimA, { toValue: 0, duration: 420, useNativeDriver: true }),
        ])
      ),
      Animated.loop(
        Animated.sequence([
          Animated.timing(shuffleAnimB, { toValue: 1, duration: 420, useNativeDriver: true }),
          Animated.timing(shuffleAnimB, { toValue: 0, duration: 420, useNativeDriver: true }),
        ])
      ),
      Animated.loop(
        Animated.sequence([
          Animated.timing(shuffleAnimC, { toValue: 1, duration: 420, useNativeDriver: true }),
          Animated.timing(shuffleAnimC, { toValue: 0, duration: 420, useNativeDriver: true }),
        ])
      ),
      Animated.loop(
        Animated.sequence([
          Animated.timing(pulseAnim, { toValue: 0.9, duration: 850, useNativeDriver: true }),
          Animated.timing(pulseAnim, { toValue: 0.4, duration: 850, useNativeDriver: true }),
        ])
      ),
    ]);

    shuffleLoop.start();

    return () => {
      shuffleLoop.stop();
    };
  }, [shuffleAnimA, shuffleAnimB, shuffleAnimC, pulseAnim]);

  const shuffleTransA = shuffleAnimA.interpolate({
    inputRange: [0, 0.5, 1],
    outputRange: ['-3deg', '-15deg', '4deg'],
  });

  const shuffleTransC = shuffleAnimC.interpolate({
    inputRange: [0, 0.5, 1],
    outputRange: ['3deg', '15deg', '-4deg'],
  });

  if (compact) {
    return (
      <View style={[styles.compactContainer, containerStyle]}>
        <View style={styles.compactStack}>
          <Animated.View
            style={[
              styles.compactCardBack,
              styles.cardLayerBottom,
              { transform: [{ rotate: shuffleTransA }] },
            ]}
          >
            <Image source={CARD_BACK} style={styles.cardImageFill} contentFit="cover" />
          </Animated.View>
          <Animated.View
            style={[
              styles.compactCardBack,
              styles.cardLayerMiddle,
              { transform: [{ rotate: shuffleTransC }] },
            ]}
          >
            <Image source={CARD_BACK} style={styles.cardImageFill} contentFit="cover" />
          </Animated.View>
          <Animated.View style={[styles.compactCardBack, styles.compactCardTop, styles.glowBorder]}>
            <Image source={CARD_BACK} style={styles.cardImageFill} contentFit="cover" />
          </Animated.View>
        </View>

        <View style={styles.compactInfo}>
          <Text style={styles.compactTitle}>{title}</Text>
          <Animated.View style={[styles.compactDotRow, { opacity: pulseAnim }]}>
            <View style={styles.compactGoldDot} />
            <Text style={styles.compactSub}>{subtitle}</Text>
          </Animated.View>
        </View>
      </View>
    );
  }

  return (
    <View style={[styles.fullContainer, containerStyle]}>
      {kicker ? <Text style={styles.kickerText}>{kicker}</Text> : null}
      <Text style={styles.fullTitle}>{title}</Text>

      <View style={styles.fullStackContainer}>
        <View style={styles.fullShuffleBox}>
          <Animated.View
            style={[
              styles.fullCardBack,
              styles.cardLayerBottom,
              { transform: [{ rotate: shuffleTransA }] },
            ]}
          >
            <Image source={CARD_BACK} style={styles.cardImageFill} contentFit="cover" />
          </Animated.View>
          <Animated.View
            style={[
              styles.fullCardBack,
              styles.cardLayerMiddle,
              { transform: [{ rotate: shuffleTransC }] },
            ]}
          >
            <Image source={CARD_BACK} style={styles.cardImageFill} contentFit="cover" />
          </Animated.View>
          <Animated.View style={[styles.fullCardBack, styles.fullCardTop, styles.glowBorder]}>
            <Image source={CARD_BACK} style={styles.cardImageFill} contentFit="cover" />
          </Animated.View>
        </View>
      </View>

      <Animated.View style={[styles.statusRow, { opacity: pulseAnim }]}>
        <View style={styles.statusDot} />
        <Text style={styles.statusMono}>{subtitle}</Text>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  fullContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 36,
    paddingHorizontal: 20,
    width: '100%',
  },
  kickerText: {
    fontFamily: Platform.select({ ios: 'SpaceMono', android: 'SpaceMono', default: 'monospace' }),
    fontSize: 9,
    letterSpacing: 2,
    color: ObsidianTokens.colors.gold.primary,
    marginBottom: 8,
  },
  fullTitle: {
    fontFamily: Platform.select({ ios: 'Georgia', android: 'serif', default: 'serif' }),
    fontSize: 24,
    fontWeight: '300',
    fontStyle: 'italic',
    color: ObsidianTokens.colors.ink.text82,
    textAlign: 'center',
    marginBottom: 20,
  },
  fullStackContainer: {
    marginVertical: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  fullShuffleBox: {
    width: 130,
    height: 198,
    position: 'relative',
  },
  fullCardBack: {
    position: 'absolute',
    top: 0,
    left: 0,
    width: '100%',
    height: '100%',
    borderRadius: 14,
    borderWidth: 1,
    overflow: 'hidden',
  },
  cardLayerBottom: {
    borderColor: 'rgba(200, 162, 74, 0.3)',
    backgroundColor: '#110D1A',
  },
  cardLayerMiddle: {
    borderColor: 'rgba(200, 162, 74, 0.45)',
    backgroundColor: '#141020',
  },
  fullCardTop: {
    borderColor: ObsidianTokens.colors.gold.primary,
    backgroundColor: '#0E0B16',
    shadowColor: ObsidianTokens.colors.violet.glow,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.4,
    shadowRadius: 18,
    elevation: 8,
  },
  glowBorder: {
    borderColor: ObsidianTokens.colors.gold.primary,
    borderWidth: 1.5,
  },
  cardImageFill: {
    width: '100%',
    height: '100%',
  },
  statusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 22,
  },
  statusDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: ObsidianTokens.colors.gold.primary,
  },
  statusMono: {
    fontFamily: Platform.select({ ios: 'SpaceMono', android: 'SpaceMono', default: 'monospace' }),
    fontSize: 10,
    letterSpacing: 2.2,
    color: ObsidianTokens.colors.gold.primary,
  },
  // Compact chat-friendly version
  compactContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
    paddingVertical: 10,
    paddingHorizontal: 12,
  },
  compactStack: {
    width: 58,
    height: 86,
    position: 'relative',
  },
  compactCardBack: {
    position: 'absolute',
    top: 0,
    left: 0,
    width: '100%',
    height: '100%',
    borderRadius: 8,
    borderWidth: 1,
    overflow: 'hidden',
  },
  compactCardTop: {
    borderColor: ObsidianTokens.colors.gold.primary,
    backgroundColor: '#0E0B16',
  },
  compactInfo: {
    flex: 1,
    justifyContent: 'center',
  },
  compactTitle: {
    fontFamily: Platform.select({ ios: 'Georgia', android: 'serif', default: 'serif' }),
    fontSize: 15,
    fontStyle: 'italic',
    color: ObsidianTokens.colors.ink.text82,
    marginBottom: 4,
  },
  compactDotRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  compactGoldDot: {
    width: 5,
    height: 5,
    borderRadius: 2.5,
    backgroundColor: ObsidianTokens.colors.gold.primary,
  },
  compactSub: {
    fontFamily: Platform.select({ ios: 'SpaceMono', android: 'SpaceMono', default: 'monospace' }),
    fontSize: 9,
    letterSpacing: 1.5,
    color: ObsidianTokens.colors.gold.primary,
  },
});
