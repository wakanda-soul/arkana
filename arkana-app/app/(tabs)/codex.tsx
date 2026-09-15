import React, { useState, useEffect } from "react";
import {
  StyleSheet,
  View,
  Text,
  ScrollView,
  Pressable,
  FlatList,
  Modal,
  Dimensions,
  Platform,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { Image } from "expo-image";
import * as Haptics from "expo-haptics";
import { ALL_CARDS, CardData } from "@/data/cardsData";
import { CardImages, CARD_BACK } from "@/assets/cards";
import { getUnlockedCards, STARTER_UNLOCKED_CARDS } from "@/services/codexService";
import { CardZoomModal, ZoomCardData } from "@/components/tarot/CardZoomModal";
import { ObsidianTokens } from "@/constants/theme";
import { useLanguage } from "@/services/i18n";

export default function CodexScreen() {
  const router = useRouter();
  const { t } = useLanguage();
  const [selectedFilter, setSelectedFilter] = useState("all");
  const [selectedCard, setSelectedCard] = useState<CardData | null>(null);
  const [zoomedCard, setZoomedCard] = useState<ZoomCardData | null>(null);
  const [lockedPreviewCard, setLockedPreviewCard] = useState<CardData | null>(null);
  const [unlockedCardNos, setUnlockedCardNos] = useState<string[]>(STARTER_UNLOCKED_CARDS);

  useEffect(() => {
    getUnlockedCards().then(setUnlockedCardNos);
  }, []);

  const unlockedCount = unlockedCardNos.length;
  const progressPercent = Math.min(100, Math.round((unlockedCount / 78) * 100));

  const filteredCards = ALL_CARDS.filter(card => {
    if (selectedFilter === "all") return true;
    if (selectedFilter === "major") return card.arcana === "major" || card.suit === "Major Arcana";
    return card.suit === selectedFilter;
  });

  const handleCardPress = (card: CardData) => {
    const isUnlocked = unlockedCardNos.includes(card.card_no);
    try {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    } catch {}

    if (isUnlocked) {
      setSelectedCard(card);
    } else {
      setLockedPreviewCard(card);
    }
  };

  const getRoman = (numStr: string) => {
    const num = parseInt(numStr, 10);
    const roman = ["0", "I", "II", "III", "IV", "V", "VI", "VII", "VIII", "IX", "X", "XI", "XII", "XIII", "XIV", "XV", "XVI", "XVII", "XVIII", "XIX", "XX", "XXI"];
    return roman[num] || numStr;
  };

  const filterTabs = [
    { id: "all", label: t('filter_all', 'ALL (78)') },
    { id: "major", label: t('filter_major', 'MAJORS (22)') },
    { id: "Protocols", label: t('filter_protocols', 'PROTOCOLS (14)') },
    { id: "Liquidity", label: t('filter_liquidity', 'LIQUIDITY (14)') },
    { id: "Nodes", label: t('filter_nodes', 'NODES (14)') },
    { id: "Assets", label: t('filter_assets', 'ASSETS (14)') },
  ];

  return (
    <SafeAreaView style={styles.container} edges={["top", "left", "right"]}>
      {/* Obsidian Header */}
      <View style={styles.header}>
        <Text style={styles.headerKicker}>{t('tab_deck', 'DECK')} \u00B7 {t('cards_count', '78 CARDS', { n: 78 })}</Text>
        <Text style={styles.headerTitle}>{t('deck_progress', '{unlocked} of 78 known', { unlocked: unlockedCount })}</Text>
        <Text style={styles.headerSub}>{t('deck_record_sub', 'Cards unlock when you draw them: a record, not a catalogue.')}</Text>
      </View>

      {/* Collection Progress Card */}
      <View style={styles.progressCard}>
        <View style={styles.progressTopRow}>
          <Text style={styles.progressLabel}>{t('record_progress', 'RECORD PROGRESS')}</Text>
          <Text style={styles.progressFraction}>
            {unlockedCount} / 78 ({progressPercent}%)
          </Text>
        </View>
        <View style={styles.progressBarTrack}>
          <View style={[styles.progressBarFill, { width: `${progressPercent}%` }]} />
        </View>
        <Text style={styles.progressSub}>
          {unlockedCount >= 78
            ? t('full_arcana_mastered', 'Full Arcana Mastered: All 78 archetypes in consensus.')
            : t('clock_in_remaining_sub', `Clock in daily on the Altar to unveil the remaining ${78 - unlockedCount} cards.`, { rem: 78 - unlockedCount })}
        </Text>
      </View>

      {/* Filter Tabs */}
      <View style={styles.filtersWrapper}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filtersScroll}>
          {filterTabs.map(tab => (
            <Pressable
              key={tab.id}
              style={[
                styles.filterPill,
                selectedFilter === tab.id && styles.filterPillActive,
              ]}
              onPress={() => {
                try {
                  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                } catch {}
                setSelectedFilter(tab.id);
              }}
            >
              <Text
                style={[
                  styles.filterText,
                  selectedFilter === tab.id && styles.filterTextActive,
                ]}
              >
                {tab.label}
              </Text>
            </Pressable>
          ))}
        </ScrollView>
      </View>

      {/* Grid of Cards (3 Columns) */}
      <FlatList
        data={filteredCards}
        keyExtractor={item => item.card_no}
        numColumns={3}
        contentContainerStyle={styles.gridContent}
        columnWrapperStyle={styles.columnWrapper}
        showsVerticalScrollIndicator={false}
        renderItem={({ item }) => {
          const isUnlocked = unlockedCardNos.includes(item.card_no);
          return (
            <Pressable
              style={({ pressed }) => [
                styles.cardTile,
                !isUnlocked && styles.cardTileLocked,
                pressed && styles.cardTilePressed,
              ]}
              onPress={() => handleCardPress(item)}
            >
              <View style={styles.cardImageContainer}>
                {isUnlocked ? (
                  <Image
                    source={CardImages[item.card_no as keyof typeof CardImages]}
                    style={styles.cardImage}
                    contentFit="cover"
                    transition={200}
                  />
                ) : (
                  <View style={styles.lockedCardWrap}>
                    <Image
                      source={CARD_BACK}
                      style={styles.cardImage}
                      contentFit="cover"
                    />
                    <View style={styles.lockedCardOverlay}>
                      <View style={styles.lockedDiamond}>
                        <Text style={styles.lockGlyph}>{'\u2726'}</Text>
                      </View>
                      <Text style={styles.lockedCardNo}>{item.card_no}</Text>
                    </View>
                  </View>
                )}
              </View>

              <Text style={[styles.cardNumeral, !isUnlocked && styles.cardNumeralDim]}>
                {getRoman(item.card_no)}
              </Text>
              <Text
                style={[styles.cardName, !isUnlocked && styles.cardNameDim]}
                numberOfLines={1}
              >
                {isUnlocked ? item.crypto_name : t('locked_tag', 'Locked')}
              </Text>
            </Pressable>
          );
        }}
      />

      {/* Card Detail Modal for Unlocked Cards */}
      <Modal visible={!!selectedCard} animationType="slide" transparent={false}>
        <SafeAreaView style={styles.modalContainer}>
          {selectedCard && (
            <ScrollView contentContainerStyle={styles.modalScroll} showsVerticalScrollIndicator={false}>
              <View style={styles.modalHeader}>
                <Text style={styles.modalSuit}>
                  {selectedCard.arcana.toUpperCase()} ARCANA \u00B7 {selectedCard.suit.toUpperCase()}
                </Text>
                <Text style={styles.modalTitle}>{selectedCard.crypto_name}</Text>
              </View>

              <Pressable
                style={styles.modalImageWrap}
                onPress={() => {
                  setZoomedCard({
                    card_no: selectedCard.card_no,
                    crypto_name: selectedCard.crypto_name,
                    classic: selectedCard.classic,
                    keywords: selectedCard.keywords,
                    advice: selectedCard.advice,
                    symbolism: selectedCard.symbolism,
                  });
                }}
              >
                <Image
                  source={CardImages[selectedCard.card_no as keyof typeof CardImages]}
                  style={styles.modalImage}
                  contentFit="cover"
                />
                <View style={styles.zoomTapBadge}>
                  <Text style={styles.zoomTapText}>{t('tap_to_zoom', 'TAP TO ZOOM')}</Text>
                </View>
              </Pressable>

              <View style={styles.keywordsWrap}>
                {selectedCard.keywords.map((kw, i) => (
                  <View key={i} style={styles.keywordTag}>
                    <Text style={styles.keywordText}>{kw}</Text>
                  </View>
                ))}
              </View>

              <View style={styles.sectionBox}>
                <Text style={styles.sectionTitle}>{t('oracle_advice_title', 'ORACLE ADVICE')}</Text>
                <Text style={styles.sectionText}>{selectedCard.advice}</Text>
              </View>

              <View style={styles.sectionBox}>
                <Text style={styles.sectionTitle}>{t('upright_synthesis_title', 'UPRIGHT SYNTHESIS')}</Text>
                <Text style={styles.sectionText}>{selectedCard.upright_full}</Text>
              </View>

              <View style={styles.sectionBox}>
                <Text style={styles.sectionTitle}>{t('reversed_synthesis_title', 'REVERSED SYNTHESIS')}</Text>
                <Text style={styles.sectionText}>{selectedCard.reversed_full}</Text>
              </View>

              <Pressable
                style={styles.closeButton}
                onPress={() => setSelectedCard(null)}
              >
                <Text style={styles.closeButtonText}>{t('return_to_deck', 'RETURN TO DECK')}</Text>
              </Pressable>
            </ScrollView>
          )}
        </SafeAreaView>
      </Modal>

      {/* Mini Locked Preview Modal */}
      <Modal visible={!!lockedPreviewCard} animationType="fade" transparent={true}>
        <View style={styles.lockedModalOverlay}>
          {lockedPreviewCard && (
            <View style={styles.lockedModalCard}>
              <View style={styles.lockedIconBadge}>
                <Text style={styles.lockedIconText}>{'\u2726'}</Text>
              </View>

              <Text style={styles.lockedModalKicker}>{t('unrevealed_archetype_title', 'UNREVEALED ARCHETYPE')}</Text>
              <Text style={styles.lockedModalTitle}>{t('card_num_label', `Card #${lockedPreviewCard.card_no}`, { num: lockedPreviewCard.card_no })}</Text>
              <Text style={styles.lockedModalClassic}>{t('suit_label', `Suit: ${lockedPreviewCard.suit}`, { suit: lockedPreviewCard.suit })}</Text>

              <View style={styles.lockedSilhouetteBox}>
                <View style={styles.lockedSilhouetteShade}>
                  <Text style={styles.lockedSilhouetteNotice}>{t('sealed_on_chain', 'SEALED ON-CHAIN')}</Text>
                </View>
              </View>

              <Text style={styles.lockedModalDesc}>
                {t('unrevealed_desc', 'This archetype has not been unveiled yet. Draw your Daily Consensus Block or cast a spread on the Altar to awaken this archetype.')}
              </Text>

              <Pressable
                style={styles.lockedGoAltarBtn}
                onPress={() => {
                  setLockedPreviewCard(null);
                  router.push("/(tabs)");
                }}
              >
                <Text style={styles.lockedGoAltarText}>{t('consult_the_altar', 'CONSULT THE ALTAR')}</Text>
              </Pressable>

              <Pressable
                style={styles.lockedCloseBtn}
                onPress={() => setLockedPreviewCard(null)}
              >
                <Text style={styles.lockedCloseText}>{t('close', 'CLOSE')}</Text>
              </Pressable>
            </View>
          )}
        </View>
      </Modal>

      {/* Full Resolution Zoom Modal */}
      <CardZoomModal
        card={zoomedCard}
        onClose={() => setZoomedCard(null)}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: ObsidianTokens.colors.ink.void,
  },
  header: {
    paddingHorizontal: ObsidianTokens.spacing.screenGutter,
    paddingTop: 12,
    paddingBottom: 14,
  },
  headerKicker: {
    fontFamily: Platform.select({ ios: "SpaceMono", android: "SpaceMono", default: "monospace" }),
    color: ObsidianTokens.colors.gold.primary,
    fontSize: 9,
    letterSpacing: 2,
  },
  headerTitle: {
    fontFamily: Platform.select({ ios: "Georgia", android: "serif", default: "serif" }),
    color: ObsidianTokens.colors.ink.text,
    fontSize: 26,
    fontWeight: "300",
    letterSpacing: 1,
    marginTop: 2,
  },
  headerSub: {
    fontFamily: Platform.select({ ios: "Georgia", android: "serif", default: "serif" }),
    color: ObsidianTokens.colors.ink.text55,
    fontSize: 13,
    marginTop: 4,
  },
  progressCard: {
    marginHorizontal: ObsidianTokens.spacing.screenGutter,
    marginBottom: 16,
    padding: 16,
    borderRadius: ObsidianTokens.radii.panels,
    backgroundColor: ObsidianTokens.colors.ink.surface,
    borderColor: ObsidianTokens.colors.gold.subtle,
    borderWidth: 1,
  },
  progressTopRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 10,
  },
  progressLabel: {
    fontFamily: Platform.select({ ios: "SpaceMono", android: "SpaceMono", default: "monospace" }),
    color: ObsidianTokens.colors.gold.primary,
    fontSize: 9,
    letterSpacing: 1.5,
  },
  progressFraction: {
    fontFamily: Platform.select({ ios: "SpaceMono", android: "SpaceMono", default: "monospace" }),
    color: ObsidianTokens.colors.ink.text,
    fontSize: 11,
    fontWeight: "600",
  },
  progressBarTrack: {
    height: 5,
    backgroundColor: ObsidianTokens.colors.ink.fill,
    borderRadius: 3,
    overflow: "hidden",
    marginBottom: 8,
  },
  progressBarFill: {
    height: "100%",
    backgroundColor: ObsidianTokens.colors.gold.primary,
    borderRadius: 3,
  },
  progressSub: {
    fontFamily: Platform.select({ ios: "Georgia", android: "serif", default: "serif" }),
    color: ObsidianTokens.colors.ink.text42,
    fontSize: 12,
    lineHeight: 16,
  },
  filtersWrapper: {
    marginBottom: 12,
  },
  filtersScroll: {
    paddingHorizontal: ObsidianTokens.spacing.screenGutter,
    gap: 8,
  },
  filterPill: {
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: 999,
    backgroundColor: ObsidianTokens.colors.ink.surface,
    borderColor: ObsidianTokens.colors.ink.hairline,
    borderWidth: 1,
  },
  filterPillActive: {
    backgroundColor: ObsidianTokens.colors.gold.primary,
    borderColor: ObsidianTokens.colors.gold.primary,
  },
  filterText: {
    fontFamily: Platform.select({ ios: "SpaceMono", android: "SpaceMono", default: "monospace" }),
    color: ObsidianTokens.colors.ink.text55,
    fontSize: 9,
    letterSpacing: 1,
  },
  filterTextActive: {
    color: "#100C06",
    fontWeight: "600",
  },
  gridContent: {
    paddingHorizontal: ObsidianTokens.spacing.screenGutter,
    paddingBottom: 110,
  },
  columnWrapper: {
    justifyContent: "space-between",
    marginBottom: 12,
  },
  cardTile: {
    width: "31%",
    aspectRatio: ObsidianTokens.card.ratio,
    borderRadius: ObsidianTokens.radii.cards,
    backgroundColor: ObsidianTokens.colors.ink.surface,
    borderColor: ObsidianTokens.colors.gold.primary,
    borderWidth: 1,
    padding: 6,
    alignItems: "center",
    justifyContent: "space-between",
  },
  cardTileLocked: {
    borderColor: ObsidianTokens.colors.ink.hairline,
    borderStyle: "dashed",
    backgroundColor: ObsidianTokens.colors.ink.void,
  },
  cardTilePressed: {
    transform: [{ scale: ObsidianTokens.motion.pressScale }],
  },
  cardImageContainer: {
    width: "100%",
    flex: 1,
    borderRadius: 8,
    overflow: "hidden",
    marginBottom: 4,
  },
  cardImage: {
    width: "100%",
    height: "100%",
  },
  lockedCardWrap: {
    width: "100%",
    height: "100%",
    position: "relative",
    borderRadius: 8,
    overflow: "hidden",
  },
  lockedCardOverlay: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: "rgba(6, 7, 10, 0.72)",
    alignItems: "center",
    justifyContent: "center",
  },
  lockedCardPlaceholder: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: ObsidianTokens.colors.ink.fill,
    borderRadius: 8,
  },
  lockedDiamond: {
    width: 22,
    height: 22,
    borderWidth: 1,
    borderColor: ObsidianTokens.colors.gold.muted,
    transform: [{ rotate: "45deg" }],
    alignItems: "center",
    justifyContent: "center",
  },
  lockGlyph: {
    fontSize: 10,
    color: ObsidianTokens.colors.gold.primary,
  },
  lockedCardNo: {
    fontFamily: Platform.select({ ios: "SpaceMono", android: "SpaceMono", default: "monospace" }),
    color: ObsidianTokens.colors.ink.text42,
    fontSize: 8,
    marginTop: 6,
  },
  cardNumeral: {
    fontFamily: Platform.select({ ios: "SpaceMono", android: "SpaceMono", default: "monospace" }),
    color: ObsidianTokens.colors.gold.primary,
    fontSize: 8,
    letterSpacing: 1,
  },
  cardNumeralDim: {
    color: ObsidianTokens.colors.ink.text42,
  },
  cardName: {
    fontFamily: Platform.select({ ios: "Georgia", android: "serif", default: "serif" }),
    color: ObsidianTokens.colors.ink.text,
    fontSize: 10,
    textAlign: "center",
  },
  cardNameDim: {
    color: ObsidianTokens.colors.ink.text42,
  },
  modalContainer: {
    flex: 1,
    backgroundColor: ObsidianTokens.colors.ink.void,
  },
  modalScroll: {
    padding: ObsidianTokens.spacing.screenGutter,
    paddingBottom: 60,
  },
  modalHeader: {
    alignItems: "center",
    marginBottom: 16,
  },
  modalSuit: {
    fontFamily: Platform.select({ ios: "SpaceMono", android: "SpaceMono", default: "monospace" }),
    color: ObsidianTokens.colors.gold.primary,
    fontSize: 9,
    letterSpacing: 2,
  },
  modalTitle: {
    fontFamily: Platform.select({ ios: "Georgia", android: "serif", default: "serif" }),
    color: ObsidianTokens.colors.ink.text,
    fontSize: 24,
    fontWeight: "300",
    letterSpacing: 1,
    marginTop: 4,
    textAlign: "center",
  },
  modalClassic: {
    fontFamily: Platform.select({ ios: "Georgia", android: "serif", default: "serif" }),
    color: ObsidianTokens.colors.ink.text55,
    fontSize: 12,
    marginTop: 4,
    fontStyle: "italic",
  },
  modalImageWrap: {
    alignItems: "center",
    marginBottom: 16,
  },
  modalImage: {
    width: 220,
    height: 330,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: ObsidianTokens.colors.gold.primary,
  },
  zoomTapBadge: {
    marginTop: 10,
    backgroundColor: ObsidianTokens.colors.ink.surface,
    borderColor: ObsidianTokens.colors.gold.subtle,
    borderWidth: 1,
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 999,
  },
  zoomTapText: {
    fontFamily: Platform.select({ ios: "SpaceMono", android: "SpaceMono", default: "monospace" }),
    color: ObsidianTokens.colors.gold.primary,
    fontSize: 9,
    letterSpacing: 1.5,
  },
  keywordsWrap: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 6,
    justifyContent: "center",
    marginBottom: 16,
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
    fontFamily: Platform.select({ ios: "SpaceMono", android: "SpaceMono", default: "monospace" }),
    color: ObsidianTokens.colors.gold.primary,
    fontSize: 9,
  },
  sectionBox: {
    backgroundColor: ObsidianTokens.colors.ink.surface,
    borderColor: ObsidianTokens.colors.ink.hairline,
    borderWidth: 1,
    borderRadius: ObsidianTokens.radii.panels,
    padding: 16,
    marginBottom: 12,
  },
  sectionTitle: {
    fontFamily: Platform.select({ ios: "SpaceMono", android: "SpaceMono", default: "monospace" }),
    color: ObsidianTokens.colors.gold.primary,
    fontSize: 9,
    letterSpacing: 1.5,
    marginBottom: 6,
  },
  sectionText: {
    fontFamily: Platform.select({ ios: "Georgia", android: "serif", default: "serif" }),
    color: ObsidianTokens.colors.ink.text82,
    fontSize: 14,
    lineHeight: 20,
  },
  closeButton: {
    marginTop: 16,
    backgroundColor: ObsidianTokens.colors.gold.primary,
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: "center",
  },
  closeButtonText: {
    fontFamily: Platform.select({ ios: "SpaceMono", android: "SpaceMono", default: "monospace" }),
    color: "#100C06",
    fontSize: 11,
    letterSpacing: 1.5,
    fontWeight: "600",
  },
  lockedModalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.85)",
    justifyContent: "center",
    alignItems: "center",
    padding: 24,
  },
  lockedModalCard: {
    width: "100%",
    maxWidth: 340,
    backgroundColor: ObsidianTokens.colors.ink.void,
    borderColor: ObsidianTokens.colors.gold.subtle,
    borderWidth: 1,
    borderRadius: 24,
    padding: 22,
    alignItems: "center",
  },
  lockedIconBadge: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: ObsidianTokens.colors.ink.surface,
    borderColor: ObsidianTokens.colors.gold.primary,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 12,
  },
  lockedIconText: {
    fontSize: 18,
    color: ObsidianTokens.colors.gold.primary,
  },
  lockedModalKicker: {
    fontFamily: Platform.select({ ios: "SpaceMono", android: "SpaceMono", default: "monospace" }),
    color: ObsidianTokens.colors.gold.primary,
    fontSize: 9,
    letterSpacing: 2,
    marginBottom: 4,
  },
  lockedModalTitle: {
    fontFamily: Platform.select({ ios: "Georgia", android: "serif", default: "serif" }),
    color: ObsidianTokens.colors.ink.text,
    fontSize: 20,
    fontWeight: "300",
  },
  lockedModalClassic: {
    fontFamily: Platform.select({ ios: "Georgia", android: "serif", default: "serif" }),
    color: ObsidianTokens.colors.ink.text55,
    fontSize: 12,
    marginTop: 2,
    marginBottom: 16,
    fontStyle: "italic",
  },
  lockedSilhouetteBox: {
    width: 140,
    height: 210,
    borderRadius: 12,
    backgroundColor: ObsidianTokens.colors.ink.surface,
    borderColor: ObsidianTokens.colors.ink.hairline,
    borderWidth: 1,
    borderStyle: "dashed",
    marginBottom: 16,
    alignItems: "center",
    justifyContent: "center",
  },
  lockedSilhouetteShade: {
    alignItems: "center",
    justifyContent: "center",
  },
  lockedSilhouetteNotice: {
    fontFamily: Platform.select({ ios: "SpaceMono", android: "SpaceMono", default: "monospace" }),
    color: ObsidianTokens.colors.ink.text42,
    fontSize: 9,
    letterSpacing: 1.5,
  },
  lockedModalDesc: {
    fontFamily: Platform.select({ ios: "Georgia", android: "serif", default: "serif" }),
    color: ObsidianTokens.colors.ink.text55,
    fontSize: 13,
    lineHeight: 18,
    textAlign: "center",
    marginBottom: 20,
  },
  lockedGoAltarBtn: {
    width: "100%",
    backgroundColor: ObsidianTokens.colors.gold.primary,
    paddingVertical: 13,
    borderRadius: 12,
    alignItems: "center",
    marginBottom: 10,
  },
  lockedGoAltarText: {
    fontFamily: Platform.select({ ios: "SpaceMono", android: "SpaceMono", default: "monospace" }),
    color: "#100C06",
    fontSize: 11,
    letterSpacing: 1.5,
    fontWeight: "600",
  },
  lockedCloseBtn: {
    paddingVertical: 8,
    paddingHorizontal: 16,
  },
  lockedCloseText: {
    fontFamily: Platform.select({ ios: "SpaceMono", android: "SpaceMono", default: "monospace" }),
    color: ObsidianTokens.colors.ink.text42,
    fontSize: 10,
    letterSpacing: 1,
  },
});
