import React, { useEffect } from 'react';
import { StyleSheet, View, Text, Pressable, Dimensions } from 'react-native';
import { Image } from 'expo-image';
import * as Haptics from 'expo-haptics';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  interpolate,
} from 'react-native-reanimated';
import { CardImages, CARD_BACK } from '@/assets/cards';

interface TarotCardProps {
  cardNo: string;
  name: string;
  isReversed?: boolean;
  isRevealed?: boolean;
  positionName?: string;
  onPress?: () => void;
  width?: number;
  height?: number;
  compact?: boolean;
  hideName?: boolean;
}

export function TarotCard({
  cardNo,
  name,
  isReversed = false,
  isRevealed = false,
  positionName,
  onPress,
  width = 140,
  height = 240,
  compact = false,
  hideName = false,
}: TarotCardProps) {
  const flipAnim = useSharedValue(isRevealed ? 1 : 0);

  useEffect(() => {
    flipAnim.value = withSpring(isRevealed ? 1 : 0, {
      damping: 14,
      stiffness: 90,
    });
  }, [isRevealed]);

  const handlePress = () => {
    try {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    } catch {}
    if (onPress) onPress();
  };

  const frontStyle = useAnimatedStyle(() => {
    const rotateValue = interpolate(flipAnim.value, [0, 1], [180, 0]);
    return {
      transform: [
        { perspective: 1000 },
        { rotateY: `${rotateValue}deg` },
      ],
      backfaceVisibility: 'hidden',
    };
  });

  const backStyle = useAnimatedStyle(() => {
    const rotateValue = interpolate(flipAnim.value, [0, 1], [0, 180]);
    return {
      transform: [{ perspective: 1000 }, { rotateY: `${rotateValue}deg` }],
      backfaceVisibility: 'hidden',
    };
  });

  const imageSource = CardImages[cardNo] || CardImages['00'];

  return (
    <View style={[styles.container, compact && styles.containerCompact, { width, height }]}>
      {positionName && (
        <View style={[styles.positionBadge, compact && styles.positionBadgeCompact]}>
          <Text style={[styles.positionText, compact && styles.positionTextCompact]} numberOfLines={1}>
            {positionName.toUpperCase()}
          </Text>
        </View>
      )}

      <Pressable onPress={handlePress} style={styles.pressable}>
        {/* Card Front - container remains upright, image rotates if reversed */}
        <Animated.View style={[styles.card, frontStyle, { width, height }]}>
          <Image
            source={imageSource}
            style={[styles.image, isReversed && styles.reversedImage]}
            contentFit="cover"
            transition={300}
          />
          {isReversed && (
            <View style={[styles.reversedBadge, compact && styles.reversedBadgeCompact]}>
              <Text style={[styles.reversedText, compact && styles.reversedTextCompact]}>
                ▼ REVERSED
              </Text>
            </View>
          )}
          <View style={[styles.zoomAffordance, compact && styles.zoomAffordanceCompact]}>
            <Text style={[styles.zoomAffordanceText, compact && styles.zoomAffordanceTextCompact]}>
              🔍
            </Text>
          </View>
        </Animated.View>

        {/* Card Back */}
        <Animated.View style={[styles.card, styles.cardBack, backStyle, { width, height }]}>
          <View style={styles.sigilContainer}>
            <View style={styles.outerGlow} />
            <Text style={styles.sigilIcon}>⚡</Text>
            <Text style={[styles.sigilTitle, compact && styles.sigilTitleCompact]}>ARKANA</Text>
            <Text style={[styles.sigilSubtitle, compact && styles.sigilSubtitleCompact]}>
              TAP TO VERIFY
            </Text>
          </View>
        </Animated.View>
      </Pressable>

      {isRevealed && !hideName && (
        <View style={styles.nameContainer}>
          <Text style={[styles.cardName, compact && styles.cardNameCompact]} numberOfLines={1}>
            {name}
          </Text>
          <Text style={[styles.cardMeta, compact && styles.cardMetaCompact]}>
            {isReversed ? '▼ Rev' : '▲ Up'} · 🔍 Zoom
          </Text>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    margin: 8,
  },
  positionBadge: {
    backgroundColor: '#1E1435',
    borderColor: '#9945FF',
    borderWidth: 1,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
    marginBottom: 6,
  },
  positionText: {
    color: '#14F195',
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 1,
  },
  pressable: {
    position: 'relative',
    width: '100%',
    height: '100%',
  },
  card: {
    position: 'absolute',
    borderRadius: 14,
    overflow: 'hidden',
    borderColor: '#2D325A',
    borderWidth: 1.5,
    backgroundColor: '#0F111E',
    shadowColor: '#9945FF',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.35,
    shadowRadius: 8,
    elevation: 6,
  },
  cardBack: {
    borderColor: '#9945FF',
    backgroundColor: '#130E26',
    justifyContent: 'center',
    alignItems: 'center',
  },
  image: {
    width: '100%',
    height: '100%',
  },
  reversedImage: {
    transform: [{ rotateZ: '180deg' }],
  },
  reversedBadge: {
    position: 'absolute',
    top: 6,
    left: 6,
    backgroundColor: 'rgba(235, 45, 75, 0.94)',
    borderColor: '#FFA5B5',
    borderWidth: 1,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 5,
    zIndex: 10,
  },
  reversedBadgeCompact: {
    top: 4,
    left: 4,
    paddingHorizontal: 4,
    paddingVertical: 1,
    borderRadius: 4,
  },
  reversedText: {
    color: '#FFFFFF',
    fontSize: 8,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  reversedTextCompact: {
    fontSize: 7,
  },
  sigilContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    padding: 12,
  },
  outerGlow: {
    position: 'absolute',
    width: 90,
    height: 90,
    borderRadius: 45,
    backgroundColor: 'rgba(153, 69, 255, 0.15)',
  },
  sigilIcon: {
    fontSize: 32,
    marginBottom: 8,
  },
  sigilTitle: {
    color: '#F5D061',
    fontWeight: '800',
    fontSize: 13,
    letterSpacing: 2,
  },
  sigilTitleCompact: {
    fontSize: 10,
    letterSpacing: 1,
  },
  sigilSubtitle: {
    color: '#8B949E',
    fontSize: 9,
    marginTop: 4,
    letterSpacing: 1,
  },
  sigilSubtitleCompact: {
    fontSize: 7,
    marginTop: 2,
  },
  nameContainer: {
    marginTop: 4,
    alignItems: 'center',
  },
  cardName: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '600',
    textAlign: 'center',
  },
  cardNameCompact: {
    fontSize: 10,
  },
  cardMeta: {
    color: '#8B949E',
    fontSize: 10,
    marginTop: 2,
  },
  cardMetaCompact: {
    fontSize: 8,
    marginTop: 1,
  },
  zoomAffordance: {
    position: 'absolute',
    bottom: 8,
    right: 8,
    backgroundColor: 'rgba(14, 16, 29, 0.85)',
    borderColor: '#9945FF',
    borderWidth: 1,
    borderRadius: 12,
    width: 24,
    height: 24,
    alignItems: 'center',
    justifyContent: 'center',
  },
  zoomAffordanceCompact: {
    bottom: 4,
    right: 4,
    width: 18,
    height: 18,
    borderRadius: 9,
  },
  zoomAffordanceText: {
    fontSize: 11,
  },
  zoomAffordanceTextCompact: {
    fontSize: 9,
  },
  containerCompact: {
    margin: 2,
  },
  positionBadgeCompact: {
    paddingHorizontal: 4,
    paddingVertical: 1,
    marginBottom: 3,
  },
  positionTextCompact: {
    fontSize: 8,
    letterSpacing: 0.5,
  },
});
