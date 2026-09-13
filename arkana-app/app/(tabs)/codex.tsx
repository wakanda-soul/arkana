import React, { useState, useEffect } from 'react';
import {
  StyleSheet,
  View,
  Text,
  ScrollView,
  Pressable,
  FlatList,
  Modal,
  Dimensions,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Image } from 'expo-image';
import * as Haptics from 'expo-haptics';
import { ALL_CARDS, CardData } from '@/data/cardsData';
import { CardImages } from '@/assets/cards';
import { getUnlockedCards, STARTER_UNLOCKED_CARDS } from '@/services/codexService';
import { CardZoomModal, ZoomCardData } from '@/components/tarot/CardZoomModal';

const FILTER_TABS = [
  { id: 'all', label: 'ALL (78)' },
  { id: 'major', label: 'MAJORS (22)' },
  { id: 'Protocols', label: 'PROTOCOLS (14)' },
  { id: 'Liquidity', label: 'LIQUIDITY (14)' },
  { id: 'Nodes', label: 'NODES (14)' },
  { id: 'Assets', label: 'ASSETS (14)' },
];

export default function CodexScreen() {
  const router = useRouter();
  const [selectedFilter, setSelectedFilter] = useState('all');
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
    if (selectedFilter === 'all') return true;
    if (selectedFilter === 'major') return card.arcana === 'major' || card.suit === 'Major Arcana';
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

  return (
    <SafeAreaView style={styles.container} edges={['top', 'left', 'right']}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.headerKicker}>78 IMMUTABLE ARCHETYPES</Text>
        <Text style={styles.headerTitle}>Card Codex</Text>
      </View>

      {/* Collection Progress Card */}
      <View style={styles.progressCard}>
        <View style={styles.progressTopRow}>
          <Text style={styles.progressLabel}>COLLECTION PROGRESS</Text>
          <Text style={styles.progressFraction}>
            {unlockedCount} / 78 ({progressPercent}%)
          </Text>
        </View>
        <View style={styles.progressBarTrack}>
          <View style={[styles.progressBarFill, { width: `${progressPercent}%` }]} />
        </View>
        <Text style={styles.progressSub}>
          {unlockedCount >= 78
            ? 'Full Arcana Mastered: All 78 archetypes in consensus!'
            : `Clock in daily and cast spreads to reveal the remaining ${78 - unlockedCount} archetypes.`}
        </Text>
      </View>

      {/* Filter Tabs */}
      <View style={styles.filtersWrapper}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filtersScroll}>
          {FILTER_TABS.map(tab => (
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

      {/* Grid of Cards */}
      <FlatList
        data={filteredCards}
        keyExtractor={item => item.card_no}
        numColumns={2}
        contentContainerStyle={styles.gridContent}
        columnWrapperStyle={styles.gridRow}
        renderItem={({ item }) => {
          const isUnlocked = unlockedCardNos.includes(item.card_no);
          const img = CardImages[item.card_no] || CardImages['00'];
          return (
            <Pressable
              style={({ pressed }) => [
                styles.gridCard,
                pressed && styles.cardPressed,
                !isUnlocked && styles.gridCardLocked,
              ]}
              onPress={() => handleCardPress(item)}
            >
              <View style={styles.imageContainer}>
                <Image
                  source={img}
                  style={[styles.cardCover, !isUnlocked && styles.cardCoverLocked]}
                  contentFit="cover"
                  transition={200}
                />
                {!isUnlocked && (
                  <View style={styles.lockedOverlay}>
                    <View style={styles.lockPill}>
                      <Text style={styles.lockPillIcon}>🔒</Text>
                      <Text style={styles.lockPillText}>LOCKED</Text>
                    </View>
                  </View>
                )}
              </View>

              <View style={styles.cardDetails}>
                <Text style={[styles.cardName, !isUnlocked && styles.cardNameLocked]} numberOfLines={1}>
                  {isUnlocked ? item.crypto_name : `Archetype #${item.card_no}`}
                </Text>
                <Text style={styles.cardClassic} numberOfLines={1}>
                  {item.classic}
                </Text>
              </View>
            </Pressable>
          );
        }}
      />

      {/* Unlocked Card Details Modal */}
      <Modal visible={!!selectedCard} animationType="slide" transparent={false}>
        <SafeAreaView style={styles.modalContainer}>
          {selectedCard && (
            <ScrollView contentContainerStyle={styles.modalScroll}>
              <View style={styles.modalHeader}>
                <Text style={styles.modalSuit}>{selectedCard.suit.toUpperCase()}</Text>
                <Text style={styles.modalTitle}>{selectedCard.crypto_name}</Text>
                <Text style={styles.modalClassic}>Classic Counterpart: {selectedCard.classic}</Text>
              </View>

              <Pressable
                style={({ pressed }) => [styles.modalImageWrap, pressed && styles.buttonPressed]}
                onPress={() => {
                  try {
                    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
                  } catch {}
                  setZoomedCard({
                    card_no: selectedCard.card_no,
                    crypto_name: selectedCard.crypto_name,
                    classic: selectedCard.classic,
                    suit: selectedCard.suit,
                    arcana: selectedCard.arcana,
                    keywords: selectedCard.keywords,
                    oriented_meaning: selectedCard.upright_full,
                    symbolism: selectedCard.symbolism,
                    advice: selectedCard.advice,
                    shadow: selectedCard.shadow,
                  });
                }}
              >
                <Image
                  source={CardImages[selectedCard.card_no] || CardImages['00']}
                  style={styles.modalImage}
                  contentFit="cover"
                />
                <View style={styles.zoomTapBadge}>
                  <Text style={styles.zoomTapText}>🔍 TAP TO ZOOM FULLSCREEN</Text>
                </View>
              </Pressable>

              {/* Keywords */}
              {selectedCard.keywords && selectedCard.keywords.length > 0 && (
                <View style={styles.keywordsWrap}>
                  {selectedCard.keywords.map((kw, i) => (
                    <View key={i} style={styles.keywordTag}>
                      <Text style={styles.keywordText}>{kw}</Text>
                    </View>
                  ))}
                </View>
              )}

              {/* Upright Meaning */}
              <View style={styles.sectionBox}>
                <Text style={[styles.sectionTitle, { color: '#14F195' }]}>▲ UPRIGHT CONSENSUS</Text>
                <Text style={styles.sectionText}>{selectedCard.upright_full}</Text>
              </View>

              {/* Reversed Meaning */}
              <View style={styles.sectionBox}>
                <Text style={[styles.sectionTitle, { color: '#FF4466' }]}>▼ REVERSED FORK</Text>
                <Text style={styles.sectionText}>{selectedCard.reversed_full}</Text>
              </View>

              {/* Symbolism */}
              <View style={styles.sectionBox}>
                <Text style={[styles.sectionTitle, { color: '#F5D061' }]}>🔮 SYMBOLISM</Text>
                <Text style={styles.sectionText}>{selectedCard.symbolism}</Text>
              </View>

              {/* Advice & Shadow */}
              <View style={styles.row}>
                {selectedCard.advice && (
                  <View style={[styles.sectionBox, styles.halfBox, { borderColor: '#14F19555' }]}>
                    <Text style={[styles.sectionTitle, { color: '#14F195' }]}>⚡ ADVICE</Text>
                    <Text style={styles.sectionTextSmall}>{selectedCard.advice}</Text>
                  </View>
                )}
                {selectedCard.shadow && (
                  <View style={[styles.sectionBox, styles.halfBox, { borderColor: '#FF446655' }]}>
                    <Text style={[styles.sectionTitle, { color: '#FF4466' }]}>🛡️ SHADOW</Text>
                    <Text style={styles.sectionTextSmall}>{selectedCard.shadow}</Text>
                  </View>
                )}
              </View>

              <Pressable
                style={styles.closeButton}
                onPress={() => setSelectedCard(null)}
              >
                <Text style={styles.closeButtonText}>CLOSE CODEX</Text>
              </Pressable>
            </ScrollView>
          )}
        </SafeAreaView>
      </Modal>

      {/* Locked Archetype Mini Preview Modal */}
      <Modal visible={!!lockedPreviewCard} animationType="fade" transparent={true}>
        <View style={styles.lockedModalOverlay}>
          <View style={styles.lockedModalCard}>
            <View style={styles.lockedIconBadge}>
              <Text style={styles.lockedIconText}>🔒</Text>
            </View>

            <Text style={styles.lockedModalKicker}>MEMPOOL ENCRYPTED</Text>
            <Text style={styles.lockedModalTitle}>Archetype #{lockedPreviewCard?.card_no}</Text>
            <Text style={styles.lockedModalClassic}>Tarot Key: {lockedPreviewCard?.classic}</Text>

            <View style={styles.lockedSilhouetteBox}>
              {lockedPreviewCard && (
                <Image
                  source={CardImages[lockedPreviewCard.card_no] || CardImages['00']}
                  style={styles.lockedSilhouetteImage}
                  contentFit="cover"
                />
              )}
              <View style={styles.lockedSilhouetteShade}>
                <Text style={styles.lockedSilhouetteNotice}>AWAITING CONSENSUS</Text>
              </View>
            </View>

            <Text style={styles.lockedModalDesc}>
              This sacred archetype has not yet entered your consensus history. Clock in daily on the Altar or draw spreads to reveal its sacred artwork and prophecy.
            </Text>

            <Pressable
              style={({ pressed }) => [styles.lockedGoAltarBtn, pressed && styles.buttonPressed]}
              onPress={() => {
                setLockedPreviewCard(null);
                router.push('/');
              }}
            >
              <Text style={styles.lockedGoAltarText}>⚡ GO TO ALTAR TO DRAW</Text>
            </Pressable>

            <Pressable
              style={styles.lockedCloseBtn}
              onPress={() => setLockedPreviewCard(null)}
            >
              <Text style={styles.lockedCloseText}>CLOSE</Text>
            </Pressable>
          </View>
        </View>
      </Modal>

      {/* Card Zoom Fullscreen Modal */}
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
    backgroundColor: '#0B0C12',
  },
  header: {
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 8,
  },
  headerKicker: {
    color: '#9945FF',
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 2,
  },
  headerTitle: {
    color: '#FFFFFF',
    fontSize: 24,
    fontWeight: '900',
    letterSpacing: 1,
  },
  progressCard: {
    marginHorizontal: 16,
    marginBottom: 12,
    backgroundColor: '#131526',
    borderColor: '#242A45',
    borderWidth: 1,
    borderRadius: 14,
    padding: 12,
  },
  progressTopRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  progressLabel: {
    color: '#9945FF',
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 1,
  },
  progressFraction: {
    color: '#14F195',
    fontSize: 12,
    fontWeight: '800',
  },
  progressBarTrack: {
    height: 6,
    backgroundColor: '#1D2136',
    borderRadius: 3,
    overflow: 'hidden',
    marginBottom: 6,
  },
  progressBarFill: {
    height: '100%',
    backgroundColor: '#14F195',
    borderRadius: 3,
  },
  progressSub: {
    color: '#8B949E',
    fontSize: 10,
    lineHeight: 14,
  },
  filtersWrapper: {
    marginBottom: 8,
  },
  filtersScroll: {
    paddingHorizontal: 16,
    gap: 8,
  },
  filterPill: {
    backgroundColor: '#141724',
    borderColor: '#22283D',
    borderWidth: 1,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
  },
  filterPillActive: {
    backgroundColor: '#26193E',
    borderColor: '#9945FF',
  },
  filterText: {
    color: '#8B949E',
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
  filterTextActive: {
    color: '#14F195',
    fontWeight: '800',
  },
  gridContent: {
    padding: 12,
    paddingBottom: 100,
  },
  gridRow: {
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  gridCard: {
    width: '48%',
    backgroundColor: '#121422',
    borderColor: '#20243B',
    borderWidth: 1,
    borderRadius: 14,
    overflow: 'hidden',
  },
  gridCardLocked: {
    borderColor: '#191C2A',
    backgroundColor: '#0F101A',
  },
  cardPressed: {
    opacity: 0.85,
    transform: [{ scale: 0.98 }],
  },
  imageContainer: {
    width: '100%',
    height: 190,
    position: 'relative',
    backgroundColor: '#080910',
  },
  cardCover: {
    width: '100%',
    height: '100%',
  },
  cardCoverLocked: {
    opacity: 0.25,
  },
  lockedOverlay: {
    ...StyleSheet.absoluteFill,
    alignItems: 'center',
    justifyContent: 'center',
  },
  lockPill: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#0E101AEE',
    borderColor: '#9945FF77',
    borderWidth: 1,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 12,
    gap: 6,
  },
  lockPillIcon: {
    fontSize: 11,
  },
  lockPillText: {
    color: '#9945FF',
    fontSize: 9,
    fontWeight: '900',
    letterSpacing: 1,
  },
  cardDetails: {
    padding: 10,
    backgroundColor: '#121422',
  },
  cardName: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '800',
    letterSpacing: 0.5,
    marginBottom: 2,
  },
  cardNameLocked: {
    color: '#6E7681',
  },
  cardClassic: {
    color: '#8B949E',
    fontSize: 10,
  },
  modalContainer: {
    flex: 1,
    backgroundColor: '#0B0C12',
  },
  modalScroll: {
    padding: 20,
    paddingBottom: 60,
  },
  modalHeader: {
    alignItems: 'center',
    marginBottom: 16,
  },
  modalSuit: {
    color: '#9945FF',
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 2,
  },
  modalTitle: {
    color: '#FFFFFF',
    fontSize: 22,
    fontWeight: '900',
    letterSpacing: 1,
    marginTop: 4,
    textAlign: 'center',
  },
  modalClassic: {
    color: '#8B949E',
    fontSize: 12,
    marginTop: 4,
  },
  modalImageWrap: {
    alignItems: 'center',
    marginBottom: 16,
    position: 'relative',
  },
  modalImage: {
    width: 220,
    height: 330,
    borderRadius: 16,
    borderWidth: 1.5,
    borderColor: '#9945FF',
  },
  zoomTapBadge: {
    marginTop: 8,
    backgroundColor: '#1D1735',
    borderColor: '#9945FF',
    borderWidth: 1,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 12,
  },
  zoomTapText: {
    color: '#14F195',
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  keywordsWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    justifyContent: 'center',
    marginBottom: 16,
  },
  keywordTag: {
    backgroundColor: '#1E1B2E',
    borderColor: '#9945FF',
    borderWidth: 1,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  keywordText: {
    color: '#14F195',
    fontSize: 10,
    fontWeight: '700',
  },
  sectionBox: {
    backgroundColor: '#121422',
    borderColor: '#20243B',
    borderWidth: 1,
    borderRadius: 12,
    padding: 14,
    marginBottom: 12,
  },
  sectionTitle: {
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 1,
    marginBottom: 6,
  },
  sectionText: {
    color: '#D1D5DB',
    fontSize: 13,
    lineHeight: 19,
  },
  sectionTextSmall: {
    color: '#D1D5DB',
    fontSize: 11,
    lineHeight: 16,
  },
  row: {
    flexDirection: 'row',
    gap: 10,
  },
  halfBox: {
    flex: 1,
  },
  closeButton: {
    marginTop: 16,
    backgroundColor: '#191530',
    borderColor: '#9945FF',
    borderWidth: 1.5,
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: 'center',
  },
  closeButtonText: {
    color: '#F5D061',
    fontWeight: '800',
    fontSize: 12,
    letterSpacing: 1.5,
  },
  buttonPressed: {
    opacity: 0.85,
    transform: [{ scale: 0.98 }],
  },
  lockedModalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(5, 6, 12, 0.88)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  lockedModalCard: {
    width: '100%',
    maxWidth: 340,
    backgroundColor: '#121422',
    borderColor: '#9945FF',
    borderWidth: 1.5,
    borderRadius: 20,
    padding: 20,
    alignItems: 'center',
  },
  lockedIconBadge: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#20163A',
    borderColor: '#9945FF',
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
  },
  lockedIconText: {
    fontSize: 18,
  },
  lockedModalKicker: {
    color: '#9945FF',
    fontSize: 9,
    fontWeight: '800',
    letterSpacing: 1.5,
    marginBottom: 4,
  },
  lockedModalTitle: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: '900',
    letterSpacing: 0.5,
  },
  lockedModalClassic: {
    color: '#8B949E',
    fontSize: 11,
    marginTop: 2,
    marginBottom: 16,
  },
  lockedSilhouetteBox: {
    width: 140,
    height: 210,
    borderRadius: 12,
    overflow: 'hidden',
    position: 'relative',
    backgroundColor: '#0A0C14',
    borderColor: '#242944',
    borderWidth: 1,
    marginBottom: 16,
  },
  lockedSilhouetteImage: {
    width: '100%',
    height: '100%',
    opacity: 0.15,
  },
  lockedSilhouetteShade: {
    ...StyleSheet.absoluteFill,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(10, 12, 20, 0.75)',
  },
  lockedSilhouetteNotice: {
    color: '#6E7681',
    fontSize: 9,
    fontWeight: '800',
    letterSpacing: 1,
  },
  lockedModalDesc: {
    color: '#8B949E',
    fontSize: 12,
    lineHeight: 17,
    textAlign: 'center',
    marginBottom: 20,
  },
  lockedGoAltarBtn: {
    width: '100%',
    backgroundColor: '#14F195',
    paddingVertical: 13,
    borderRadius: 10,
    alignItems: 'center',
    marginBottom: 10,
  },
  lockedGoAltarText: {
    color: '#0B0C12',
    fontSize: 12,
    fontWeight: '900',
    letterSpacing: 0.5,
  },
  lockedCloseBtn: {
    paddingVertical: 8,
    paddingHorizontal: 16,
  },
  lockedCloseText: {
    color: '#6E7681',
    fontSize: 11,
    fontWeight: '700',
  },
});
