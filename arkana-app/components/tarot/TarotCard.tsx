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
import { useLanguage, localizePosition } from '@/services/i18n';
import { soundService } from '@/services/soundService';

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
  const { t } = useLanguage();
  const flipAnim = useSharedValue(isRevealed ? 1 : 0);

  useEffect(() => {
    flipAnim.value = withSpring(isRevealed ? 1 : 0, {
      damping: 14,
      stiffness: 90,
    });
  }, [isRevealed]);

  const handlePress = () => {
    soundService.playCardFlip();
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
    <View style={[styles.container, compact && styles.containerCompact, { width }]}>
      {positionName && (
        <View style={[styles.positionBadge, compact && styles.positionBadgeCompact]}>
          <Text style={[styles.positionText, compact && styles.positionTextCompact]} numberOfLines={1}>
            {localizePosition(positionName, t).toUpperCase()}
          </Text>
        </View>
      )}

      <Pressable onPress={handlePress} style={[styles.pressable, { width, height }]}>
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
                {'\u25BC'} {t('reversed_short', 'REVERSED')}
              </Text>
            </View>
          )}
          <View style={[styles.zoomAffordance, compact && styles.zoomAffordanceCompact]}>
            <Text style={[styles.zoomAffordanceText, compact && styles.zoomAffordanceTextCompact]}>
              &#x2922;
            </Text>
          </View>
        </Animated.View>

        {/* Card Back */}
        <Animated.View style={[styles.card, styles.cardBack, backStyle, { width, height }]}>
          <Image
            source={CARD_BACK}
            style={styles.image}
            contentFit="cover"
          />
        </Animated.View>
      </Pressable>

      {isRevealed && !hideName && (
        <View style={styles.nameContainer}>
          <Text style={[styles.cardName, compact && styles.cardNameCompact]} numberOfLines={1}>
            {name}
          </Text>
          <Text style={[styles.cardMeta, compact && styles.cardMetaCompact]}>
            {isReversed ? '\u25BC Rev' : '\u25B2 Up'} {'\u00B7'} &#x2922; Zoom
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
    backgroundColor: 'rgba(200, 162, 74, 0.12)',
    borderColor: 'rgba(200, 162, 74, 0.45)',
    borderWidth: 1,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
    marginBottom: 6,
  },
  positionText: {
    color: '#C8A24A',
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 1,
  },
  pressable: {
    position: 'relative',
  },
  card: {
    position: 'absolute',
    borderRadius: 14,
    overflow: 'hidden',
    borderColor: 'rgba(200, 162, 74, 0.35)',
    borderWidth: 1.5,
    backgroundColor: '#08070B',
    shadowColor: '#C8A24A',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 8,
    elevation: 6,
  },
  cardBack: {
    borderColor: '#C8A24A',
    backgroundColor: '#0E0B16',
    overflow: 'hidden',
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
    backgroundColor: '#D45240',
    borderColor: 'rgba(212, 82, 64, 0.8)',
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
    color: '#EDE7DC',
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
    backgroundColor: 'rgba(200, 162, 74, 0.15)',
  },
  sigilIcon: {
    fontSize: 32,
    marginBottom: 8,
  },
  sigilTitle: {
    color: '#C8A24A',
    fontWeight: '800',
    fontSize: 13,
    letterSpacing: 2,
  },
  sigilTitleCompact: {
    fontSize: 10,
    letterSpacing: 1,
  },
  sigilSubtitle: {
    color: '#8A8275',
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
    color: '#EDE7DC',
    fontSize: 12,
    fontWeight: '600',
    textAlign: 'center',
  },
  cardNameCompact: {
    fontSize: 10,
  },
  cardMeta: {
    color: '#8A8275',
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
    backgroundColor: 'rgba(8, 7, 11, 0.85)',
    borderColor: 'rgba(200, 162, 74, 0.5)',
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
