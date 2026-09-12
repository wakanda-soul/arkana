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
        { rotateZ: isReversed ? '180deg' : '0deg' },
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
    <View style={[styles.container, { width, height }]}>
      {positionName && (
        <View style={styles.positionBadge}>
          <Text style={styles.positionText}>{positionName.toUpperCase()}</Text>
        </View>
      )}

      <Pressable onPress={handlePress} style={styles.pressable}>
        {/* Card Front */}
        <Animated.View style={[styles.card, frontStyle, { width, height }]}>
          <Image source={imageSource} style={styles.image} contentFit="cover" transition={300} />
          {isReversed && (
            <View style={styles.reversedBadge}>
              <Text style={styles.reversedText}>REVERSED</Text>
            </View>
          )}
        </Animated.View>

        {/* Card Back */}
        <Animated.View style={[styles.card, styles.cardBack, backStyle, { width, height }]}>
          <View style={styles.sigilContainer}>
            <View style={styles.outerGlow} />
            <Text style={styles.sigilIcon}>⚡</Text>
            <Text style={styles.sigilTitle}>ARKANA</Text>
            <Text style={styles.sigilSubtitle}>TAP TO VERIFY</Text>
          </View>
        </Animated.View>
      </Pressable>

      {isRevealed && (
        <View style={styles.nameContainer}>
          <Text style={styles.cardName} numberOfLines={1}>
            {name}
          </Text>
          <Text style={styles.cardMeta}>
            {isReversed ? '▼ Reversed' : '▲ Upright'}
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
  reversedBadge: {
    position: 'absolute',
    top: 6,
    right: 6,
    backgroundColor: 'rgba(255, 68, 68, 0.85)',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  reversedText: {
    color: '#fff',
    fontSize: 8,
    fontWeight: 'bold',
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
  sigilSubtitle: {
    color: '#8B949E',
    fontSize: 9,
    marginTop: 4,
    letterSpacing: 1,
  },
  nameContainer: {
    marginTop: 6,
    alignItems: 'center',
  },
  cardName: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '600',
    textAlign: 'center',
  },
  cardMeta: {
    color: '#8B949E',
    fontSize: 10,
    marginTop: 2,
  },
});
