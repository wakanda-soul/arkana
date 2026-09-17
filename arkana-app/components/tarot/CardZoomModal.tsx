import React, { useState, useMemo } from 'react';
import {
  StyleSheet,
  View,
  Text,
  Modal,
  Pressable,
  ScrollView,
  Dimensions,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Image } from 'expo-image';
import * as Haptics from 'expo-haptics';
import { soundService } from '@/services/soundService';
import { CardImages } from '@/assets/cards';
import { ObsidianTokens } from '@/constants/theme';
import { useLanguage, localizePosition, localizePositionHint } from '@/services/i18n';
import { localizeZoomCard } from '@/services/cardLocalization';

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
  const { t, language } = useLanguage();
  const [flippedUpright, setFlippedUpright] = useState(false);

  const displayCard = useMemo(() => {
    return card ? localizeZoomCard(card, language) : null;
  }, [card, language]);

  if (!card || !displayCard) return null;

  const isDrawnReversed = card.orientation === 'reversed';
  const effectiveReversed = isDrawnReversed && !flippedUpright;
  const imageSource = CardImages[card.card_no] || CardImages['00'];

  const handleClose = () => {
    soundService.playTap();
    setFlippedUpright(false);
    onClose();
  };

  const handleToggleOrientation = () => {
    soundService.playCardFlip();
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
              <View style={styles.positionBadge}>
                <Text style={styles.positionBadgeText}>
                  {card.position ? localizePosition(card.position, t).toUpperCase() : t('inspect_artifact', 'INSPECT ARTIFACT')}
                </Text>
              </View>
            </View>

            <Pressable
              style={({ pressed }) => [styles.closeButton, pressed && styles.closeButtonPressed]}
              onPress={handleClose}
              hitSlop={14}
            >
              <Text style={styles.closeIcon}>{'\u2715'}</Text>
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
                  <Text
                    style={[
                      styles.orientationPillText,
                      isDrawnReversed ? styles.orientationTextReversed : styles.orientationTextUpright,
                    ]}
                  >
                    {isDrawnReversed ? t('drawn_reversed', '\u25BC DRAWN REVERSED') : t('drawn_upright', '\u25B2 DRAWN UPRIGHT')}
                  </Text>
                </View>

                {isDrawnReversed && (
                  <Pressable
                    style={({ pressed }) => [styles.flipBtn, pressed && styles.flipBtnPressed]}
                    onPress={handleToggleOrientation}
                  >
                    <Text style={styles.flipBtnText}>
                      {flippedUpright ? `\u27F3 ${t('view_reversed', 'VIEW REVERSED')}` : `\u27F3 ${t('view_upright', 'VIEW UPRIGHT')}`}
                    </Text>
                  </Pressable>
                )}
              </View>
            </View>

            {/* In-depth Archetype Info */}
            <View style={styles.detailsCard}>
              <Text style={styles.cardNoLabel}>{t('archetype_num_label', `ARCHETYPE #${displayCard.card_no}`, { num: displayCard.card_no })}</Text>
              <Text style={styles.cardTitle}>{displayCard.crypto_name}</Text>

              {displayCard.position_hint && (
                <View style={styles.positionHintBox}>
                  <Text style={styles.positionHintTitle}>{t('spread_context', 'SPREAD CONTEXT')}</Text>
                  <Text style={styles.positionHintText}>{localizePositionHint(displayCard.position_hint, t)}</Text>
                </View>
              )}

              {displayCard.oriented_meaning && (
                <View style={styles.sectionBox}>
                  <Text style={styles.sectionHeader}>{t('consensus_interpretation', 'CONSENSUS INTERPRETATION')}</Text>
                  <Text style={styles.bodyText}>{displayCard.oriented_meaning}</Text>
                </View>
              )}

              {displayCard.keywords && displayCard.keywords.length > 0 && (
                <View style={styles.keywordsWrap}>
                  {displayCard.keywords.map((kw, i) => (
                    <View key={i} style={styles.keywordTag}>
                      <Text style={styles.keywordText}>{kw}</Text>
                    </View>
                  ))}
                </View>
              )}

              {displayCard.advice && (
                <View style={styles.sectionBox}>
                  <Text style={styles.sectionHeader}>{t('oracle_advice_title', 'ORACLE ADVICE')}</Text>
                  <Text style={styles.bodyText}>{displayCard.advice}</Text>
                </View>
              )}

              {displayCard.shadow && (
                <View style={[styles.sectionBox, styles.shadowSectionBox]}>
                  <Text style={styles.shadowHeader}>{t('shadow_warning', 'SHADOW WARNING')}</Text>
                  <Text style={styles.bodyText}>{displayCard.shadow}</Text>
                </View>
              )}

              {/* Dismiss Button */}
              <Pressable
                style={({ pressed }) => [styles.doneButton, pressed && styles.doneButtonPressed]}
                onPress={handleClose}
              >
                <Text style={styles.doneButtonText}>{t('return_to_deck', 'RETURN TO DECK')}</Text>
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
    backgroundColor: 'rgba(8, 7, 11, 0.98)',
  },
  safeArea: {
    flex: 1,
  },
  topBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: ObsidianTokens.spacing.screenGutter,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: ObsidianTokens.colors.gold.subtle,
  },
  headerInfo: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  positionBadge: {
    backgroundColor: ObsidianTokens.colors.ink.surface,
    borderColor: ObsidianTokens.colors.gold.primary,
    borderWidth: 1,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
  },
  positionBadgeText: {
    fontFamily: Platform.select({ ios: 'SpaceMono', android: 'SpaceMono', default: 'monospace' }),
    color: ObsidianTokens.colors.gold.primary,
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 2,
  },
  closeButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: ObsidianTokens.colors.ink.surface,
    borderColor: ObsidianTokens.colors.gold.subtle,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  closeButtonPressed: {
    backgroundColor: ObsidianTokens.colors.ink.fill,
  },
  closeIcon: {
    color: ObsidianTokens.colors.gold.primary,
    fontSize: 15,
    fontWeight: '700',
  },
  scrollContent: {
    alignItems: 'center',
    paddingVertical: 20,
    paddingHorizontal: ObsidianTokens.spacing.screenGutter,
  },
  cardWrapper: {
    alignItems: 'center',
    marginBottom: 22,
  },
  cardOuter: {
    borderRadius: 20,
    overflow: 'hidden',
    borderColor: ObsidianTokens.colors.gold.primary,
    borderWidth: 1.5,
    backgroundColor: ObsidianTokens.colors.ink.void,
    shadowColor: ObsidianTokens.colors.gold.primary,
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.35,
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
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 999,
    borderWidth: 1,
  },
  orientationUpright: {
    backgroundColor: ObsidianTokens.colors.gold.surface,
    borderColor: ObsidianTokens.colors.gold.primary,
  },
  orientationReversed: {
    backgroundColor: 'rgba(212, 82, 64, 0.15)',
    borderColor: '#D45240',
  },
  orientationPillText: {
    fontFamily: Platform.select({ ios: 'SpaceMono', android: 'SpaceMono', default: 'monospace' }),
    fontSize: 10,
    letterSpacing: 1.5,
    fontWeight: '700',
  },
  orientationTextUpright: {
    color: ObsidianTokens.colors.gold.primary,
  },
  orientationTextReversed: {
    color: '#FFA595',
  },
  flipBtn: {
    backgroundColor: ObsidianTokens.colors.ink.surface,
    borderColor: ObsidianTokens.colors.gold.subtle,
    borderWidth: 1,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 999,
  },
  flipBtnPressed: {
    backgroundColor: ObsidianTokens.colors.ink.fill,
  },
  flipBtnText: {
    fontFamily: Platform.select({ ios: 'SpaceMono', android: 'SpaceMono', default: 'monospace' }),
    color: ObsidianTokens.colors.gold.primary,
    fontSize: 10,
    letterSpacing: 1,
  },
  detailsCard: {
    width: '100%',
    backgroundColor: ObsidianTokens.colors.ink.surface,
    borderColor: ObsidianTokens.colors.ink.hairline,
    borderWidth: 1,
    borderRadius: ObsidianTokens.radii.panels,
    padding: 20,
  },
  cardNoLabel: {
    fontFamily: Platform.select({ ios: 'SpaceMono', android: 'SpaceMono', default: 'monospace' }),
    color: ObsidianTokens.colors.gold.primary,
    fontSize: 10,
    letterSpacing: 2,
    marginBottom: 4,
  },
  cardTitle: {
    fontFamily: Platform.select({ ios: 'Georgia', android: 'serif', default: 'serif' }),
    color: ObsidianTokens.colors.ink.text,
    fontSize: 26,
    fontWeight: '300',
    letterSpacing: 1,
    marginBottom: 4,
  },
  classicSubtitle: {
    fontFamily: Platform.select({ ios: 'Georgia', android: 'serif', default: 'serif' }),
    color: ObsidianTokens.colors.ink.text55,
    fontSize: 13,
    fontStyle: 'italic',
    marginBottom: 16,
  },
  classicAccent: {
    color: ObsidianTokens.colors.ink.text82,
    fontWeight: '600',
  },
  positionHintBox: {
    backgroundColor: ObsidianTokens.colors.ink.fill,
    borderColor: ObsidianTokens.colors.ink.hairline,
    borderWidth: 1,
    borderRadius: 12,
    padding: 14,
    marginBottom: 14,
  },
  positionHintTitle: {
    fontFamily: Platform.select({ ios: 'SpaceMono', android: 'SpaceMono', default: 'monospace' }),
    color: ObsidianTokens.colors.gold.primary,
    fontSize: 9,
    letterSpacing: 1.5,
    marginBottom: 4,
  },
  positionHintText: {
    fontFamily: Platform.select({ ios: 'Georgia', android: 'serif', default: 'serif' }),
    color: ObsidianTokens.colors.ink.text82,
    fontSize: 13,
    lineHeight: 19,
  },
  sectionBox: {
    backgroundColor: ObsidianTokens.colors.ink.fill,
    borderColor: ObsidianTokens.colors.ink.hairline,
    borderWidth: 1,
    borderRadius: 12,
    padding: 14,
    marginBottom: 12,
  },
  shadowSectionBox: {
    borderColor: 'rgba(212, 82, 64, 0.25)',
  },
  sectionHeader: {
    fontFamily: Platform.select({ ios: 'SpaceMono', android: 'SpaceMono', default: 'monospace' }),
    color: ObsidianTokens.colors.gold.primary,
    fontSize: 9,
    letterSpacing: 1.5,
    marginBottom: 6,
  },
  shadowHeader: {
    fontFamily: Platform.select({ ios: 'SpaceMono', android: 'SpaceMono', default: 'monospace' }),
    color: '#D45240',
    fontSize: 9,
    letterSpacing: 1.5,
    marginBottom: 6,
  },
  bodyText: {
    fontFamily: Platform.select({ ios: 'Georgia', android: 'serif', default: 'serif' }),
    color: ObsidianTokens.colors.ink.text82,
    fontSize: 14,
    lineHeight: 21,
  },
  keywordsWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 14,
  },
  keywordTag: {
    backgroundColor: ObsidianTokens.colors.ink.surface,
    borderColor: ObsidianTokens.colors.gold.subtle,
    borderWidth: 1,
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: 999,
  },
  keywordText: {
    fontFamily: Platform.select({ ios: 'SpaceMono', android: 'SpaceMono', default: 'monospace' }),
    color: ObsidianTokens.colors.gold.primary,
    fontSize: 9,
    letterSpacing: 0.5,
  },
  doneButton: {
    backgroundColor: ObsidianTokens.colors.gold.primary,
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
    marginTop: 10,
  },
  doneButtonPressed: {
    opacity: 0.85,
    transform: [{ scale: ObsidianTokens.motion.pressScale }],
  },
  doneButtonText: {
    fontFamily: Platform.select({ ios: 'SpaceMono', android: 'SpaceMono', default: 'monospace' }),
    color: '#100C06',
    fontSize: 11,
    letterSpacing: 1.5,
    fontWeight: '700',
  },
});
