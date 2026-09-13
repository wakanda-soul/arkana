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
import { useAuth } from '@/components/auth/auth-provider';
import { fetchReading, fetchClockInStatus, ClockInResult, ReadingResponse } from '@/services/oracleApi';
import { TarotCard } from '@/components/tarot/TarotCard';
import { SevenBeatsView } from '@/components/tarot/SevenBeatsView';
import { CardZoomModal, ZoomCardData } from '@/components/tarot/CardZoomModal';
import { SpreadTableView } from '@/components/tarot/SpreadTableView';
import { shareToTwitter, shareGeneral } from '@/utils/shareOmen';
import { unlockCards } from '@/services/codexService';

export default function SpreadScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const spreadKey = id || 'network-scan';

  const { account } = useAuth();
  const walletAddress = account?.publicKey?.toString() || 'SeekerDemoWallet1111111111111111111';

  const [question, setQuestion] = useState('');
  const [hasDrawn, setHasDrawn] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [reading, setReading] = useState<ReadingResponse | null>(null);
  const [revealedMap, setRevealedMap] = useState<Record<number, boolean>>({});
  const [zoomedCard, setZoomedCard] = useState<ZoomCardData | null>(null);
  const [quotaInfo, setQuotaInfo] = useState<ClockInResult | null>(null);
  const [quotaError, setQuotaError] = useState<string | null>(null);

  useEffect(() => {
    fetchClockInStatus(walletAddress).then(setQuotaInfo);
  }, [walletAddress]);

  const handleDraw = async () => {
    setQuotaError(null);
    try {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
    } catch {}

    setIsLoading(true);
    try {
      const res = await fetchReading(spreadKey, question, walletAddress);
      setReading(res);
      setHasDrawn(true);
      setRevealedMap({});
      if (res.cards && res.cards.length > 0) {
        unlockCards(res.cards.map(c => c.card_no));
      }
      if (res.quota) {
        setQuotaInfo(prev => prev ? {
          ...prev,
          freeSpreadsRemaining: res.quota!.remainingFree,
          skrBalance: res.quota!.balance,
        } : null);
      }
    } catch (e: any) {
      console.warn('Draw error:', e);
      setQuotaError(e.message || 'Failed to cast spread');
      try {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      } catch {}
    } finally {
      setIsLoading(false);
    }
  };

  const handleShareX = async () => {
    if (!reading || !reading.cards || reading.cards.length === 0) return;
    try {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    } catch {}
    const lead = reading.cards[0];
    await shareToTwitter({
      cardName: lead.crypto_name,
      cardNo: lead.card_no,
      orientation: lead.orientation,
      streak: quotaInfo?.streak || 1,
      proseOmen: reading.prose?.finalOmen || reading.prose?.oracleAdvice || lead.advice,
      spreadName: reading.spread_name
    });
  };

  const handleShareMore = async () => {
    if (!reading || !reading.cards || reading.cards.length === 0) return;
    try {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    } catch {}
    const lead = reading.cards[0];
    await shareGeneral({
      cardName: lead.crypto_name,
      cardNo: lead.card_no,
      orientation: lead.orientation,
      streak: quotaInfo?.streak || 1,
      proseOmen: reading.prose?.finalOmen || reading.prose?.oracleAdvice || lead.advice,
      spreadName: reading.spread_name
    });
  };

  const flipCard = (index: number) => {
    setRevealedMap(prev => ({ ...prev, [index]: true }));
  };

  const handleCardPress = (index: number) => {
    if (!reading) return;
    if (!revealedMap[index]) {
      flipCard(index);
    } else {
      try {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      } catch {}
      setZoomedCard(reading.cards[index]);
    }
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

            {/* Daily Spread Quota & Fee Verification */}
            {(() => {
              const freeRemaining = quotaInfo?.freeSpreadsRemaining ?? 3;
              const freeMax = quotaInfo?.freeSpreadsMax ?? 3;
              const isFree = freeRemaining > 0;
              const balance = quotaInfo?.skrBalance ?? 25;
              const canAfford = isFree || balance >= 5;

              return (
                <View style={styles.quotaBox}>
                  <View style={styles.quotaRow}>
                    <View style={styles.quotaBadge}>
                      <Text style={styles.quotaIcon}>{isFree ? '✨' : '⚡'}</Text>
                      <Text style={styles.quotaTitle}>
                        {isFree
                          ? `${freeRemaining}/${freeMax} FREE SPREADS TODAY`
                          : '5 SKR FEE PER SPREAD'}
                      </Text>
                    </View>
                    <Text style={styles.balanceText}>{balance} SKR</Text>
                  </View>

                  {!canAfford && (
                    <Text style={styles.warningText}>
                      ⚠️ Daily free allowance exhausted (0/{freeMax}) and insufficient balance (&lt;5 SKR). Clock in daily to earn SKR or refill allowance.
                    </Text>
                  )}

                  {quotaError && (
                    <View style={styles.errorBox}>
                      <Text style={styles.errorText}>⚠️ {quotaError}</Text>
                    </View>
                  )}

                  <Pressable
                    style={({ pressed }) => [
                      styles.drawButton,
                      !isFree && styles.paidDrawButton,
                      (!canAfford || isLoading) && styles.drawButtonDisabled,
                      pressed && canAfford && styles.buttonPressed,
                    ]}
                    onPress={handleDraw}
                    disabled={isLoading || !canAfford}
                  >
                    {isLoading ? (
                      <ActivityIndicator color="#0E101A" />
                    ) : (
                      <Text style={styles.drawButtonText}>
                        {!canAfford
                          ? 'INSUFFICIENT SKR (5 SKR REQUIRED)'
                          : isFree
                          ? '🔮 SHUFFLE & DRAW (FREE)'
                          : '⚡ APPROVE 5 SKR & DRAW'}
                      </Text>
                    )}
                  </Pressable>
                </View>
              );
            })()}
          </View>
        )}

        {/* Step 2: Drawn Cards Table */}
        {hasDrawn && reading && (
          <View style={styles.tableContainer}>
            <View style={styles.instructionBanner}>
              <Text style={styles.instructionText}>
                {isAllRevealed
                  ? '✓ ALL CARDS VERIFIED — TAP ANY CARD TO ZOOM & INSPECT'
                  : 'TAP TO FLIP & VALIDATE · TAP REVEALED TO ZOOM'}
              </Text>
              {!isAllRevealed && (
                <Pressable onPress={revealAll} style={styles.revealAllBtn}>
                  <Text style={styles.revealAllText}>REVEAL ALL</Text>
                </Pressable>
              )}
            </View>

            {/* Interactive Spread Table in Authentic Tarot Geometry */}
            <SpreadTableView
              spreadKey={spreadKey}
              cards={reading.cards}
              revealedMap={revealedMap}
              onCardPress={handleCardPress}
            />

            {/* Step 3: Synthesis View when all revealed */}
            {isAllRevealed && (
              <View style={styles.readingWrap}>
                <View style={styles.divider} />
                <SevenBeatsView beats={reading.prose} metrics={reading.engine_metrics} />

                {/* Transmit / Share Section */}
                <View style={styles.shareSection}>
                  <Text style={styles.shareSectionKicker}>TRANSMIT SPREAD OMEN</Text>
                  <View style={styles.shareButtonsRow}>
                    <Pressable
                      style={({ pressed }) => [styles.shareTwitterBtn, pressed && styles.buttonPressed]}
                      onPress={handleShareX}
                    >
                      <Text style={styles.shareTwitterIcon}>𝕏</Text>
                      <Text style={styles.shareTwitterText}>SHARE ON X</Text>
                    </Pressable>

                    <Pressable
                      style={({ pressed }) => [styles.shareGeneralBtn, pressed && styles.buttonPressed]}
                      onPress={handleShareMore}
                    >
                      <Text style={styles.shareGeneralIcon}>📤</Text>
                      <Text style={styles.shareGeneralText}>MORE</Text>
                    </Pressable>
                  </View>
                </View>

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

      {/* Zoom Modal for inspecting card up close */}
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
  quotaBox: {
    marginBottom: 8,
  },
  quotaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#0B0C12',
    borderColor: '#261F42',
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    marginBottom: 14,
  },
  quotaBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  quotaIcon: {
    fontSize: 12,
  },
  quotaTitle: {
    color: '#14F195',
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  balanceText: {
    color: '#F5D061',
    fontSize: 11,
    fontWeight: '800',
  },
  warningText: {
    color: '#FF7B72',
    fontSize: 12,
    lineHeight: 16,
    marginBottom: 14,
    backgroundColor: 'rgba(255, 123, 114, 0.12)',
    borderColor: 'rgba(255, 123, 114, 0.3)',
    borderWidth: 1,
    borderRadius: 8,
    padding: 10,
  },
  errorBox: {
    backgroundColor: 'rgba(255, 123, 114, 0.15)',
    borderColor: '#FF7B72',
    borderWidth: 1,
    borderRadius: 8,
    padding: 10,
    marginBottom: 14,
  },
  errorText: {
    color: '#FF7B72',
    fontSize: 12,
    fontWeight: '600',
  },
  drawButton: {
    backgroundColor: '#14F195',
    paddingVertical: 15,
    borderRadius: 12,
    alignItems: 'center',
  },
  paidDrawButton: {
    backgroundColor: '#9945FF',
  },
  drawButtonDisabled: {
    backgroundColor: '#232938',
    opacity: 0.6,
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
  shareSection: {
    marginTop: 20,
    backgroundColor: '#131526',
    borderColor: '#262D4A',
    borderWidth: 1,
    borderRadius: 14,
    padding: 14,
  },
  shareSectionKicker: {
    color: '#9945FF',
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 1.5,
    marginBottom: 10,
    textAlign: 'center',
  },
  shareButtonsRow: {
    flexDirection: 'row',
    gap: 10,
  },
  shareTwitterBtn: {
    flex: 2,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#000000',
    borderColor: '#38444D',
    borderWidth: 1,
    borderRadius: 10,
    paddingVertical: 12,
    gap: 8,
  },
  shareTwitterIcon: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '900',
  },
  shareTwitterText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '800',
    letterSpacing: 1,
  },
  shareGeneralBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#1A1E33',
    borderColor: '#2D3558',
    borderWidth: 1,
    borderRadius: 10,
    paddingVertical: 12,
    gap: 6,
  },
  shareGeneralIcon: {
    fontSize: 13,
  },
  shareGeneralText: {
    color: '#14F195',
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 1,
  },
});
