import React, { useState, useEffect } from 'react';
import {
  StyleSheet,
  View,
  Text,
  ScrollView,
  Pressable,
  TextInput,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';
import * as Haptics from 'expo-haptics';
import { fetchReading, ReadingResponse } from '@/services/oracleApi';
import { TarotCard } from '@/components/tarot/TarotCard';
import { SevenBeatsView } from '@/components/tarot/SevenBeatsView';

export default function SpreadScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const spreadKey = id || 'network-scan';

  const [question, setQuestion] = useState('');
  const [hasDrawn, setHasDrawn] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [reading, setReading] = useState<ReadingResponse | null>(null);
  const [revealedMap, setRevealedMap] = useState<Record<number, boolean>>({});

  const handleDraw = async () => {
    try {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
    } catch {}

    setIsLoading(true);
    try {
      const res = await fetchReading(spreadKey, question);
      setReading(res);
      setHasDrawn(true);
      setRevealedMap({});
    } catch (e) {
      console.warn('Draw error:', e);
    } finally {
      setIsLoading(false);
    }
  };

  const flipCard = (index: number) => {
    setRevealedMap(prev => ({ ...prev, [index]: true }));
  };

  const revealAll = () => {
    if (!reading) return;
    try {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } catch {}
    const all: Record<number, boolean> = {};
    reading.cards.forEach((_, idx) => {
      all[idx] = true;
    });
    setRevealedMap(all);
  };

  const isAllRevealed = reading && reading.cards.every((_, idx) => revealedMap[idx]);

  return (
    <SafeAreaView style={styles.container}>
      {/* Navbar */}
      <View style={styles.navBar}>
        <Pressable onPress={() => router.back()} style={styles.backButton}>
          <Text style={styles.backText}>‹ BACK</Text>
        </Pressable>
        <Text style={styles.navTitle}>{reading?.spread_name || 'Cast Spread'}</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        {/* Step 1: Input Question */}
        {!hasDrawn && (
          <View style={styles.inputCard}>
            <Text style={styles.inputKicker}>INSCRIBE INTENT IN THE MEMPOOL</Text>
            <Text style={styles.inputTitle}>What is your question?</Text>
            <TextInput
              style={styles.textInput}
              placeholder="e.g. Should I enter this new project? How is my liquidity flowing?"
              placeholderTextColor="#5E6573"
              value={question}
              onChangeText={setQuestion}
              multiline
              numberOfLines={3}
            />

            <Pressable
              style={({ pressed }) => [styles.drawButton, pressed && styles.buttonPressed]}
              onPress={handleDraw}
              disabled={isLoading}
            >
              {isLoading ? (
                <ActivityIndicator color="#0E101A" />
              ) : (
                <Text style={styles.drawButtonText}>🔮 SHUFFLE & DRAW CARDS</Text>
              )}
            </Pressable>
          </View>
        )}

        {/* Step 2: Drawn Cards Table */}
        {hasDrawn && reading && (
          <View style={styles.tableContainer}>
            <View style={styles.instructionBanner}>
              <Text style={styles.instructionText}>
                {isAllRevealed
                  ? '✓ ALL CARDS VERIFIED — READ THE ORACLE SYNTHESIS BELOW'
                  : 'TAP CARDS TO FLIP & VALIDATE CONSENSUS'}
              </Text>
              {!isAllRevealed && (
                <Pressable onPress={revealAll} style={styles.revealAllBtn}>
                  <Text style={styles.revealAllText}>REVEAL ALL</Text>
                </Pressable>
              )}
            </View>

            {/* Cards Display */}
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.cardsScroll}
            >
              {reading.cards.map((card, idx) => (
                <TarotCard
                  key={idx}
                  cardNo={card.card_no}
                  name={card.crypto_name}
                  isReversed={card.orientation === 'reversed'}
                  isRevealed={!!revealedMap[idx]}
                  positionName={card.position}
                  onPress={() => flipCard(idx)}
                  width={150}
                  height={250}
                />
              ))}
            </ScrollView>

            {/* Step 3: Synthesis View when all revealed */}
            {isAllRevealed && (
              <View style={styles.readingWrap}>
                <View style={styles.divider} />
                <SevenBeatsView beats={reading.prose} metrics={reading.engine_metrics} />

                {/* Reset Button */}
                <Pressable
                  style={styles.resetButton}
                  onPress={() => {
                    setHasDrawn(false);
                    setReading(null);
                  }}
                >
                  <Text style={styles.resetButtonText}>CAST ANOTHER SPREAD</Text>
                </Pressable>
              </View>
            )}
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0B0C12',
  },
  navBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomColor: '#1A1E2F',
    borderBottomWidth: 1,
  },
  backButton: {
    padding: 6,
  },
  backText: {
    color: '#14F195',
    fontWeight: '800',
    fontSize: 14,
  },
  navTitle: {
    color: '#FFFFFF',
    fontWeight: '800',
    fontSize: 16,
    letterSpacing: 0.5,
  },
  scrollContent: {
    padding: 16,
    paddingBottom: 60,
  },
  inputCard: {
    backgroundColor: '#121422',
    borderColor: '#9945FF',
    borderWidth: 1.5,
    borderRadius: 18,
    padding: 18,
    marginVertical: 20,
  },
  inputKicker: {
    color: '#9945FF',
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 1.5,
    marginBottom: 6,
  },
  inputTitle: {
    color: '#FFFFFF',
    fontSize: 20,
    fontWeight: '900',
    marginBottom: 12,
  },
  textInput: {
    backgroundColor: '#0B0C12',
    borderColor: '#2D325A',
    borderWidth: 1,
    borderRadius: 12,
    padding: 14,
    color: '#FFFFFF',
    fontSize: 14,
    minHeight: 90,
    textAlignVertical: 'top',
    marginBottom: 16,
  },
  drawButton: {
    backgroundColor: '#14F195',
    paddingVertical: 15,
    borderRadius: 12,
    alignItems: 'center',
  },
  buttonPressed: {
    opacity: 0.85,
    transform: [{ scale: 0.98 }],
  },
  drawButtonText: {
    color: '#0B0C12',
    fontSize: 14,
    fontWeight: '900',
    letterSpacing: 1,
  },
  tableContainer: {
    marginTop: 8,
  },
  instructionBanner: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#17142A',
    borderColor: '#2F2654',
    borderWidth: 1,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    marginBottom: 16,
  },
  instructionText: {
    color: '#14F195',
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 0.5,
    flex: 1,
  },
  revealAllBtn: {
    backgroundColor: '#281747',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 4,
    marginLeft: 8,
  },
  revealAllText: {
    color: '#F5D061',
    fontSize: 9,
    fontWeight: '800',
  },
  cardsScroll: {
    paddingVertical: 8,
    gap: 4,
  },
  readingWrap: {
    marginTop: 16,
  },
  divider: {
    height: 1,
    backgroundColor: '#1E2338',
    marginVertical: 16,
  },
  resetButton: {
    marginTop: 16,
    backgroundColor: '#191530',
    borderColor: '#9945FF',
    borderWidth: 1.5,
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: 'center',
  },
  resetButtonText: {
    color: '#F5D061',
    fontWeight: '800',
    fontSize: 12,
    letterSpacing: 1.5,
  },
});
