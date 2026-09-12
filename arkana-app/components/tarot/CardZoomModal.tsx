import React, { useState } from 'react';
import {
  StyleSheet,
  View,
  Text,
  Modal,
  Pressable,
  ScrollView,
  Dimensions,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Image } from 'expo-image';
import * as Haptics from 'expo-haptics';
import { CardImages } from '@/assets/cards';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const CARD_ZOOM_WIDTH = Math.min(SCREEN_WIDTH - 48, 320);
const CARD_ZOOM_HEIGHT = Math.round(CARD_ZOOM_WIDTH * 1.53);

export interface ZoomCardData {
  card_no: string;
  crypto_name: string;
  classic?: string;
  position?: string;
  position_hint?: string;
  orientation?: 'upright' | 'reversed';
  keywords?: string[];
  oriented_meaning?: string;
  symbolism?: string;
  advice?: string;
  shadow?: string;
  suit?: string;
  arcana?: string;
}

interface CardZoomModalProps {
  card: ZoomCardData | null;
  onClose: () => void;
}

export function CardZoomModal({ card, onClose }: CardZoomModalProps) {
  const [flippedUpright, setFlippedUpright] = useState(false);

  if (!card) return null;

  const isDrawnReversed = card.orientation === 'reversed';
  const effectiveReversed = isDrawnReversed && !flippedUpright;
  const imageSource = CardImages[card.card_no] || CardImages['00'];

  const handleClose = () => {
    try {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    } catch {}
    setFlippedUpright(false);
    onClose();
  };

  const handleToggleOrientation = () => {
    try {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    } catch {}
    setFlippedUpright(prev => !prev);
  };

  return (
    <Modal
      visible={!!card}
      animationType="fade"
      transparent={true}
      onRequestClose={handleClose}
    >
      <View style={styles.backdrop}>
        <SafeAreaView style={styles.safeArea}>
          {/* Top Bar Navigation */}
          <View style={styles.topBar}>
            <View style={styles.headerInfo}>
              {card.position ? (
                <View style={styles.positionBadge}>
                  <Text style={styles.positionBadgeText}>
                    {card.position.toUpperCase()}
                  </Text>
                </View>
              ) : (
                <View style={styles.positionBadge}>
                  <Text style={styles.positionBadgeText}>INSPECT ARTIFACT</Text>
                </View>
              )}
            </View>

            <Pressable
              style={({ pressed }) => [styles.closeButton, pressed && styles.closeButtonPressed]}
              onPress={handleClose}
              hitSlop={14}
            >
              <Text style={styles.closeIcon}>✕</Text>
            </Pressable>
          </View>

          <ScrollView
            contentContainerStyle={styles.scrollContent}
            showsVerticalScrollIndicator={false}
          >
            {/* Enlarged Card Art Container */}
            <View style={styles.cardWrapper}>
              <View
                style={[
                  styles.cardOuter,
                  {
                    width: CARD_ZOOM_WIDTH,
                    height: CARD_ZOOM_HEIGHT,
                    transform: [{ rotateZ: effectiveReversed ? '180deg' : '0deg' }],
                  },
                ]}
              >
                <Image
                  source={imageSource}
                  style={styles.cardImage}
                  contentFit="cover"
                  transition={250}
                />
              </View>

              {/* Status badges below the artwork */}
              <View style={styles.artBadgesRow}>
                <View
                  style={[
                    styles.orientationPill,
                    isDrawnReversed ? styles.orientationReversed : styles.orientationUpright,
                  ]}
                >
                  <Text style={styles.orientationPillText}>
                    {isDrawnReversed ? '▼ DRAWN REVERSED' : '▲ DRAWN UPRIGHT'}
                  </Text>
                </View>

                {isDrawnReversed && (
                  <Pressable
                    style={({ pressed }) => [styles.flipBtn, pressed && styles.flipBtnPressed]}
                    onPress={handleToggleOrientation}
                  >
                    <Text style={styles.flipBtnText}>
                      {flippedUpright ? '🔄 VIEW REVERSED' : '🔄 VIEW UPRIGHT'}
                    </Text>
                  </Pressable>
                )}
              </View>
            </View>

            {/* In-depth Archetype Info */}
            <View style={styles.detailsCard}>
              <Text style={styles.cardNoLabel}>CARD #{card.card_no}</Text>
              <Text style={styles.cardTitle}>{card.crypto_name}</Text>
              {card.classic && (
                <Text style={styles.classicSubtitle}>
                  Classic Archetype: <Text style={styles.classicAccent}>{card.classic}</Text>
                </Text>
              )}

              {card.position_hint && (
                <View style={styles.positionHintBox}>
                  <Text style={styles.positionHintTitle}>SPREAD CONTEXT</Text>
                  <Text style={styles.positionHintText}>{card.position_hint}</Text>
                </View>
              )}

              {card.oriented_meaning && (
                <View style={styles.sectionBox}>
                  <Text style={styles.sectionHeader}>CONSENSUS INTERPRETATION</Text>
                  <Text style={styles.bodyText}>{card.oriented_meaning}</Text>
                </View>
              )}

              {card.keywords && card.keywords.length > 0 && (
                <View style={styles.keywordsWrap}>
                  {card.keywords.map((kw, i) => (
                    <View key={i} style={styles.keywordTag}>
                      <Text style={styles.keywordText}>{kw}</Text>
                    </View>
                  ))}
                </View>
              )}

              {card.advice && (
                <View style={styles.sectionBox}>
                  <Text style={[styles.sectionHeader, { color: '#14F195' }]}>ORACLE ADVICE</Text>
                  <Text style={styles.bodyText}>{card.advice}</Text>
                </View>
              )}

              {card.shadow && (
                <View style={styles.sectionBox}>
                  <Text style={[styles.sectionHeader, { color: '#FF4466' }]}>SHADOW WARNING</Text>
                  <Text style={styles.bodyText}>{card.shadow}</Text>
                </View>
              )}

              {/* Dismiss Button */}
              <Pressable
                style={({ pressed }) => [styles.doneButton, pressed && styles.doneButtonPressed]}
                onPress={handleClose}
              >
                <Text style={styles.doneButtonText}>RETURN TO SPREAD</Text>
              </Pressable>
            </View>
          </ScrollView>
        </SafeAreaView>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(5, 7, 14, 0.96)',
  },
  safeArea: {
    flex: 1,
  },
  topBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 18,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#1B1E32',
  },
  headerInfo: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  positionBadge: {
    backgroundColor: '#1E1435',
    borderColor: '#9945FF',
    borderWidth: 1,
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: 8,
  },
  positionBadgeText: {
    color: '#14F195',
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 1.5,
  },
  closeButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#181A2A',
    borderColor: '#363C60',
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  closeButtonPressed: {
    backgroundColor: '#262A45',
  },
  closeIcon: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '700',
  },
  scrollContent: {
    alignItems: 'center',
    paddingVertical: 20,
    paddingHorizontal: 16,
  },
  cardWrapper: {
    alignItems: 'center',
    marginBottom: 22,
  },
  cardOuter: {
    borderRadius: 20,
    overflow: 'hidden',
    borderColor: '#9945FF',
    borderWidth: 2,
    backgroundColor: '#0E101D',
    shadowColor: '#9945FF',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.5,
    shadowRadius: 18,
    elevation: 12,
  },
  cardImage: {
    width: '100%',
    height: '100%',
  },
  artBadgesRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginTop: 14,
  },
  orientationPill: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    borderWidth: 1,
  },
  orientationUpright: {
    backgroundColor: '#0F261C',
    borderColor: '#14F195',
  },
  orientationReversed: {
    backgroundColor: '#2D141F',
    borderColor: '#FF4466',
  },
  orientationPillText: {
    color: '#FFFFFF',
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 1,
  },
  flipBtn: {
    backgroundColor: '#1C1F36',
    borderColor: '#3D4472',
    borderWidth: 1,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
  },
  flipBtnPressed: {
    backgroundColor: '#2B3054',
  },
  flipBtnText: {
    color: '#00F0FF',
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.8,
  },
  detailsCard: {
    width: '100%',
    backgroundColor: '#101322',
    borderColor: '#232845',
    borderWidth: 1,
    borderRadius: 18,
    padding: 20,
  },
  cardNoLabel: {
    color: '#9945FF',
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 2,
    marginBottom: 4,
  },
  cardTitle: {
    color: '#FFFFFF',
    fontSize: 24,
    fontWeight: '900',
    letterSpacing: 1,
    marginBottom: 6,
  },
  classicSubtitle: {
    color: '#8A91A8',
    fontSize: 13,
    marginBottom: 16,
  },
  classicAccent: {
    color: '#E0E3EB',
    fontWeight: '700',
  },
  positionHintBox: {
    backgroundColor: '#181C30',
    borderColor: '#2A3154',
    borderWidth: 1,
    borderRadius: 10,
    padding: 12,
    marginBottom: 16,
  },
  positionHintTitle: {
    color: '#14F195',
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 1.5,
    marginBottom: 4,
  },
  positionHintText: {
    color: '#C7CBD6',
    fontSize: 13,
    lineHeight: 18,
  },
  sectionBox: {
    marginBottom: 16,
  },
  sectionHeader: {
    color: '#9945FF',
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 1.5,
    marginBottom: 6,
  },
  bodyText: {
    color: '#D1D5E0',
    fontSize: 14,
    lineHeight: 21,
  },
  keywordsWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 16,
  },
  keywordTag: {
    backgroundColor: '#1E233E',
    borderColor: '#373E6D',
    borderWidth: 1,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 8,
  },
  keywordText: {
    color: '#00F0FF',
    fontSize: 11,
    fontWeight: '700',
  },
  doneButton: {
    backgroundColor: '#1A1D2E',
    borderColor: '#333A5C',
    borderWidth: 1,
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
    marginTop: 10,
  },
  doneButtonPressed: {
    backgroundColor: '#262B45',
  },
  doneButtonText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '800',
    letterSpacing: 1.5,
  },
});
