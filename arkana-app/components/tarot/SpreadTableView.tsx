import React from 'react';
import { StyleSheet, View, Text, Dimensions } from 'react-native';
import { TarotCard } from './TarotCard';
import { useLanguage } from '@/services/i18n';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

// Responsive sizing: ensure 3 columns fit within any mobile screen width
const CARD_WIDTH = Math.min(Math.floor((SCREEN_WIDTH - 32) / 3), 112);
const CARD_HEIGHT = Math.round(CARD_WIDTH * 1.5);

export interface SpreadCardItem {
  position: string;
  position_hint?: string;
  card_no: string;
  crypto_name: string;
  orientation: 'upright' | 'reversed';
}

interface SpreadTableViewProps {
  spreadKey: string;
  cards: SpreadCardItem[];
  revealedMap: Record<number, boolean>;
  onCardPress: (index: number) => void;
}

export function SpreadTableView({
  spreadKey,
  cards,
  revealedMap,
  onCardPress,
}: SpreadTableViewProps) {
  const { t } = useLanguage();
  if (!cards || cards.length === 0) return null;

  // 1. THE VALIDATOR CROSS (5 Cards: 3x3 Cross Layout)
  if (spreadKey === 'validator-cross' && cards.length >= 5) {
    // Card mapping per spreads.md:
    // Slot 0: Current State (Middle Left)
    // Slot 1: Main Opportunity (Top Center)
    // Slot 2: Main Obstacle (Center)
    // Slot 3: Hidden Influence (Bottom Center)
    // Slot 4: Outcome (Middle Right)
    return (
      <View style={styles.spreadContainer}>
        {/* Subtle Ethereal Altar Lines */}
        <View style={styles.crossVerticalAxis} />
        <View style={styles.crossHorizontalAxis} />

        {/* Row 0: Top Opportunity */}
        <View style={styles.gridRow}>
          <View style={{ width: CARD_WIDTH, marginHorizontal: 2 }} />
          <TarotCard
            cardNo={cards[1].card_no}
            name={cards[1].crypto_name}
            isReversed={cards[1].orientation === 'reversed'}
            isRevealed={!!revealedMap[1]}
            positionName={cards[1].position}
            onPress={() => onCardPress(1)}
            width={CARD_WIDTH}
            height={CARD_HEIGHT}
            compact
          />
          <View style={{ width: CARD_WIDTH, marginHorizontal: 2 }} />
        </View>

        {/* Row 1: Horizontal Bar (Left -> Center -> Right) */}
        <View style={styles.gridRow}>
          <TarotCard
            cardNo={cards[0].card_no}
            name={cards[0].crypto_name}
            isReversed={cards[0].orientation === 'reversed'}
            isRevealed={!!revealedMap[0]}
            positionName={cards[0].position}
            onPress={() => onCardPress(0)}
            width={CARD_WIDTH}
            height={CARD_HEIGHT}
            compact
          />
          <TarotCard
            cardNo={cards[2].card_no}
            name={cards[2].crypto_name}
            isReversed={cards[2].orientation === 'reversed'}
            isRevealed={!!revealedMap[2]}
            positionName={cards[2].position}
            onPress={() => onCardPress(2)}
            width={CARD_WIDTH}
            height={CARD_HEIGHT}
            compact
          />
          <TarotCard
            cardNo={cards[4].card_no}
            name={cards[4].crypto_name}
            isReversed={cards[4].orientation === 'reversed'}
            isRevealed={!!revealedMap[4]}
            positionName={cards[4].position}
            onPress={() => onCardPress(4)}
            width={CARD_WIDTH}
            height={CARD_HEIGHT}
            compact
          />
        </View>

        {/* Row 2: Bottom Hidden Influence */}
        <View style={styles.gridRow}>
          <View style={{ width: CARD_WIDTH, marginHorizontal: 2 }} />
          <TarotCard
            cardNo={cards[3].card_no}
            name={cards[3].crypto_name}
            isReversed={cards[3].orientation === 'reversed'}
            isRevealed={!!revealedMap[3]}
            positionName={cards[3].position}
            onPress={() => onCardPress(3)}
            width={CARD_WIDTH}
            height={CARD_HEIGHT}
            compact
          />
          <View style={{ width: CARD_WIDTH, marginHorizontal: 2 }} />
        </View>
      </View>
    );
  }

  // 2. THE CRYPTO COMPASS (5 Cards: 3x3 Compass Layout)
  if (spreadKey === 'crypto-compass' && cards.length >= 5) {
    // Card mapping per spreads.md:
    // Slot 0: You (Center)
    // Slot 1: Market (North / Top Center)
    // Slot 2: Project (West / Left Center)
    // Slot 3: Opportunity (East / Right Center)
    // Slot 4: Risk (South / Bottom Center)
    return (
      <View style={styles.spreadContainer}>
        {/* Subtle Compass Altar Circle & Axes */}
        <View style={styles.compassCircle} />
        <View style={styles.crossVerticalAxis} />
        <View style={styles.crossHorizontalAxis} />

        {/* Compass Row 0: North Market */}
        <View style={styles.gridRow}>
          <View style={{ width: CARD_WIDTH, marginHorizontal: 2 }} />
          <View style={styles.cardWithCompassBadge}>
            <View style={styles.compassMarkerNorth}>
              <Text style={styles.compassMarkerText}>&#9650; {t('compass_north', 'NORTH')}</Text>
            </View>
            <TarotCard
              cardNo={cards[1].card_no}
              name={cards[1].crypto_name}
              isReversed={cards[1].orientation === 'reversed'}
              isRevealed={!!revealedMap[1]}
              positionName={cards[1].position}
              onPress={() => onCardPress(1)}
              width={CARD_WIDTH}
              height={CARD_HEIGHT}
              compact
            />
          </View>
          <View style={{ width: CARD_WIDTH, marginHorizontal: 2 }} />
        </View>

        {/* Compass Row 1: West Project | Center You | East Opportunity */}
        <View style={styles.gridRow}>
          <View style={styles.cardWithCompassBadge}>
            <View style={styles.compassMarkerWest}>
              <Text style={styles.compassMarkerText}>&#9668; {t('compass_west', 'WEST')}</Text>
            </View>
            <TarotCard
              cardNo={cards[2].card_no}
              name={cards[2].crypto_name}
              isReversed={cards[2].orientation === 'reversed'}
              isRevealed={!!revealedMap[2]}
              positionName={cards[2].position}
              onPress={() => onCardPress(2)}
              width={CARD_WIDTH}
              height={CARD_HEIGHT}
              compact
            />
          </View>

          <View style={styles.cardWithCompassBadge}>
            <View style={styles.compassMarkerCenter}>
              <Text style={styles.compassMarkerText}>&#9679; {t('compass_core', 'CORE')}</Text>
            </View>
            <TarotCard
              cardNo={cards[0].card_no}
              name={cards[0].crypto_name}
              isReversed={cards[0].orientation === 'reversed'}
              isRevealed={!!revealedMap[0]}
              positionName={cards[0].position}
              onPress={() => onCardPress(0)}
              width={CARD_WIDTH}
              height={CARD_HEIGHT}
              compact
            />
          </View>

          <View style={styles.cardWithCompassBadge}>
            <View style={styles.compassMarkerEast}>
              <Text style={styles.compassMarkerText}>{t('compass_east', 'EAST')} &#9658;</Text>
            </View>
            <TarotCard
              cardNo={cards[3].card_no}
              name={cards[3].crypto_name}
              isReversed={cards[3].orientation === 'reversed'}
              isRevealed={!!revealedMap[3]}
              positionName={cards[3].position}
              onPress={() => onCardPress(3)}
              width={CARD_WIDTH}
              height={CARD_HEIGHT}
              compact
            />
          </View>
        </View>

        {/* Compass Row 2: South Risk */}
        <View style={styles.gridRow}>
          <View style={{ width: CARD_WIDTH, marginHorizontal: 2 }} />
          <View style={styles.cardWithCompassBadge}>
            <View style={styles.compassMarkerSouth}>
              <Text style={styles.compassMarkerText}>&#9660; {t('compass_south', 'SOUTH')}</Text>
            </View>
            <TarotCard
              cardNo={cards[4].card_no}
              name={cards[4].crypto_name}
              isReversed={cards[4].orientation === 'reversed'}
              isRevealed={!!revealedMap[4]}
              positionName={cards[4].position}
              onPress={() => onCardPress(4)}
              width={CARD_WIDTH}
              height={CARD_HEIGHT}
              compact
            />
          </View>
          <View style={{ width: CARD_WIDTH, marginHorizontal: 2 }} />
        </View>
      </View>
    );
  }

  // 3. THE NETWORK SCAN (3 Cards: Single Row, Fully fitting on screen)
  if (cards.length === 3) {
    return (
      <View style={styles.spreadContainer}>
        <View style={styles.scanRow}>
          {cards.map((card, idx) => (
            <TarotCard
              key={idx}
              cardNo={card.card_no}
              name={card.crypto_name}
              isReversed={card.orientation === 'reversed'}
              isRevealed={!!revealedMap[idx]}
              positionName={card.position}
              onPress={() => onCardPress(idx)}
              width={CARD_WIDTH}
              height={CARD_HEIGHT}
              compact
            />
          ))}
        </View>
      </View>
    );
  }

  // 4. Fallback for other card counts (Clean responsive flex wrap)
  return (
    <View style={styles.spreadContainer}>
      <View style={styles.fallbackWrap}>
        {cards.map((card, idx) => (
          <TarotCard
            key={idx}
            cardNo={card.card_no}
            name={card.crypto_name}
            isReversed={card.orientation === 'reversed'}
            isRevealed={!!revealedMap[idx]}
            positionName={card.position}
            onPress={() => onCardPress(idx)}
            width={CARD_WIDTH}
            height={CARD_HEIGHT}
            compact
          />
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  spreadContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
    marginVertical: 12,
    width: '100%',
  },
  gridRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'center',
    marginVertical: 8,
    gap: 4,
  },
  scanRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-evenly',
    width: '100%',
  },
  fallbackWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    alignItems: 'center',
  },
  crossVerticalAxis: {
    position: 'absolute',
    width: 2,
    top: 20,
    bottom: 20,
    backgroundColor: 'rgba(153, 69, 255, 0.25)',
    zIndex: 0,
  },
  crossHorizontalAxis: {
    position: 'absolute',
    height: 2,
    left: 20,
    right: 20,
    backgroundColor: 'rgba(153, 69, 255, 0.25)',
    zIndex: 0,
  },
  compassCircle: {
    position: 'absolute',
    width: CARD_WIDTH * 2.2,
    height: CARD_WIDTH * 2.2,
    borderRadius: (CARD_WIDTH * 2.2) / 2,
    borderWidth: 1.5,
    borderColor: 'rgba(200, 162, 74, 0.25)',
    zIndex: 0,
  },
  cardWithCompassBadge: {
    alignItems: 'center',
  },
  compassMarkerNorth: {
    marginBottom: 4,
    backgroundColor: '#121A15',
    borderColor: 'rgba(46, 213, 115, 0.7)',
    borderWidth: 1,
    paddingHorizontal: 5,
    borderRadius: 4,
  },
  compassMarkerSouth: {
    marginBottom: 4,
    backgroundColor: '#1F1012',
    borderColor: '#D45240',
    borderWidth: 1,
    paddingHorizontal: 5,
    borderRadius: 4,
  },
  compassMarkerWest: {
    marginBottom: 4,
    backgroundColor: '#120E1A',
    borderColor: '#C8A24A',
    borderWidth: 1,
    paddingHorizontal: 5,
    borderRadius: 4,
  },
  compassMarkerEast: {
    marginBottom: 4,
    backgroundColor: '#120E1A',
    borderColor: '#C8A24A',
    borderWidth: 1,
    paddingHorizontal: 5,
    borderRadius: 4,
  },
  compassMarkerCenter: {
    marginBottom: 4,
    backgroundColor: '#1C1608',
    borderColor: '#E8C872',
    borderWidth: 1,
    paddingHorizontal: 5,
    borderRadius: 4,
  },
  compassMarkerText: {
    color: '#EDE7DC',
    fontSize: 7,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
});
