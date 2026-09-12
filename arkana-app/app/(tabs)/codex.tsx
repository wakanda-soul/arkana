import React, { useState } from 'react';
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
import { Image } from 'expo-image';
import * as Haptics from 'expo-haptics';
import { ALL_CARDS, CardData } from '@/data/cardsData';
import { CardImages } from '@/assets/cards';

const FILTER_TABS = [
  { id: 'all', label: 'ALL (78)' },
  { id: 'major', label: 'MAJORS (22)' },
  { id: 'Protocols', label: 'PROTOCOLS (14)' },
  { id: 'Liquidity', label: 'LIQUIDITY (14)' },
  { id: 'Nodes', label: 'NODES (14)' },
  { id: 'Assets', label: 'ASSETS (14)' },
];

const { width } = Dimensions.get('window');
const CARD_WIDTH = (width - 48) / 2;

export default function CodexScreen() {
  const [selectedFilter, setSelectedFilter] = useState('all');
  const [selectedCard, setSelectedCard] = useState<CardData | null>(null);

  const filteredCards = ALL_CARDS.filter(card => {
    if (selectedFilter === 'all') return true;
    if (selectedFilter === 'major') return card.arcana === 'major' || card.suit === 'Major Arcana';
    return card.suit === selectedFilter;
  });

  const openCardDetail = (card: CardData) => {
    try {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    } catch {}
    setSelectedCard(card);
  };

  return (
    <SafeAreaView style={styles.container} edges={['top', 'left', 'right']}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.headerKicker}>78 IMMUTABLE ARCHETYPES</Text>
        <Text style={styles.headerTitle}>Card Codex</Text>
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
          const img = CardImages[item.card_no] || CardImages['00'];
          return (
            <Pressable
              style={({ pressed }) => [styles.gridCard, pressed && styles.cardPressed]}
              onPress={() => openCardDetail(item)}
            >
              <Image source={img} style={styles.cardCover} contentFit="cover" transition={200} />
              <View style={styles.cardDetails}>
                <Text style={styles.cardName} numberOfLines={1}>
                  {item.crypto_name}
                </Text>
                <Text style={styles.cardClassic} numberOfLines={1}>
                  {item.classic}
                </Text>
              </View>
            </Pressable>
          );
        }}
      />

      {/* Card Details Modal */}
      <Modal visible={!!selectedCard} animationType="slide" transparent={false}>
        <SafeAreaView style={styles.modalContainer}>
          {selectedCard && (
            <ScrollView contentContainerStyle={styles.modalScroll}>
              <View style={styles.modalHeader}>
                <Text style={styles.modalSuit}>{selectedCard.suit.toUpperCase()}</Text>
                <Text style={styles.modalTitle}>{selectedCard.crypto_name}</Text>
                <Text style={styles.modalClassic}>Classic Counterpart: {selectedCard.classic}</Text>
              </View>

              <View style={styles.modalImageWrap}>
                <Image
                  source={CardImages[selectedCard.card_no] || CardImages['00']}
                  style={styles.modalImage}
                  contentFit="cover"
                />
              </View>

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
    paddingVertical: 12,
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
  filtersWrapper: {
    marginVertical: 8,
  },
  filtersScroll: {
    paddingHorizontal: 16,
    gap: 8,
  },
  filterPill: {
    backgroundColor: '#121422',
    borderColor: '#20263D',
    borderWidth: 1,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
  },
  filterPillActive: {
    backgroundColor: '#281747',
    borderColor: '#9945FF',
  },
  filterText: {
    color: '#8B949E',
    fontSize: 11,
    fontWeight: '700',
  },
  filterTextActive: {
    color: '#14F195',
  },
  gridContent: {
    padding: 16,
    paddingBottom: 110,
  },
  gridRow: {
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  gridCard: {
    width: CARD_WIDTH,
    backgroundColor: '#131525',
    borderColor: '#222842',
    borderWidth: 1,
    borderRadius: 12,
    overflow: 'hidden',
  },
  cardPressed: {
    borderColor: '#9945FF',
    transform: [{ scale: 0.98 }],
  },
  cardCover: {
    width: '100%',
    height: CARD_WIDTH * 1.5,
  },
  cardDetails: {
    padding: 8,
  },
  cardName: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '700',
  },
  cardClassic: {
    color: '#8B949E',
    fontSize: 10,
    marginTop: 2,
  },
  modalContainer: {
    flex: 1,
    backgroundColor: '#0B0C12',
  },
  modalScroll: {
    padding: 16,
    paddingBottom: 40,
    alignItems: 'center',
  },
  modalHeader: {
    alignItems: 'center',
    marginBottom: 16,
  },
  modalSuit: {
    color: '#9945FF',
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 2,
  },
  modalTitle: {
    color: '#FFFFFF',
    fontSize: 22,
    fontWeight: '900',
    marginTop: 2,
    textAlign: 'center',
  },
  modalClassic: {
    color: '#8B949E',
    fontSize: 12,
    marginTop: 4,
  },
  modalImageWrap: {
    width: 200,
    height: 320,
    borderRadius: 16,
    overflow: 'hidden',
    borderColor: '#9945FF',
    borderWidth: 2,
    marginBottom: 16,
  },
  modalImage: {
    width: '100%',
    height: '100%',
  },
  keywordsWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    justifyContent: 'center',
    marginBottom: 16,
  },
  keywordTag: {
    backgroundColor: '#1E1638',
    borderColor: '#382866',
    borderWidth: 1,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  keywordText: {
    color: '#14F195',
    fontSize: 10,
    fontWeight: '700',
  },
  sectionBox: {
    width: '100%',
    backgroundColor: '#131525',
    borderColor: '#242A45',
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
    lineHeight: 20,
  },
  row: {
    flexDirection: 'row',
    gap: 10,
    width: '100%',
  },
  halfBox: {
    flex: 1,
  },
  sectionTextSmall: {
    color: '#D1D5DB',
    fontSize: 12,
    lineHeight: 18,
  },
  closeButton: {
    marginTop: 16,
    backgroundColor: '#191530',
    borderColor: '#9945FF',
    borderWidth: 1.5,
    paddingVertical: 14,
    paddingHorizontal: 32,
    borderRadius: 12,
    width: '100%',
    alignItems: 'center',
  },
  closeButtonText: {
    color: '#F5D061',
    fontWeight: '800',
    fontSize: 13,
    letterSpacing: 1.5,
  },
});
