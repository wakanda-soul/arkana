import React, { useState, useEffect } from 'react';
import {
  StyleSheet,
  View,
  Text,
  ScrollView,
  Pressable,
  Modal,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import * as Haptics from 'expo-haptics';
import { useAuth } from '@/components/auth/auth-provider';
import { fetchClockInStatus, executeClockIn, ClockInResult, ReadingResponse } from '@/services/oracleApi';
import { TarotCard } from '@/components/tarot/TarotCard';
import { SevenBeatsView } from '@/components/tarot/SevenBeatsView';
import { CardZoomModal, ZoomCardData } from '@/components/tarot/CardZoomModal';

export default function AltarScreen() {
  const router = useRouter();
  const { account } = useAuth();
  const walletAddress = account?.publicKey?.toString() || 'SeekerDemoWallet1111111111111111111';

  const [clockInState, setClockInState] = useState<ClockInResult>({
    canClockIn: true,
    streak: 1,
    lastClockIn: null,
    totalReadings: 1,
    skrBalance: 25,
    freeSpreadsRemaining: 3,
    freeSpreadsMax: 3,
    extraSpreadCostSkr: 5,
    isSeekerHolder: true,
  });

  const [isClockingIn, setIsClockingIn] = useState(false);
  const [dailyReading, setDailyReading] = useState<ReadingResponse | null>(null);
  const [isModalVisible, setIsModalVisible] = useState(false);
  const [zoomedCard, setZoomedCard] = useState<ZoomCardData | null>(null);

  useEffect(() => {
    fetchClockInStatus(walletAddress).then(setClockInState);
  }, [walletAddress]);

  const handleClockIn = async () => {
    try {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
    } catch {}

    setIsClockingIn(true);
    try {
      const res = await executeClockIn(walletAddress);
      setDailyReading(res.reading);
      setClockInState(prev => ({
        ...prev,
        canClockIn: false,
        streak: res.streak,
        freeSpreadsRemaining: prev.freeSpreadsMax ?? 3,
      }));
      setIsModalVisible(true);
      try {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      } catch {}
    } catch (e) {
      console.warn('Clock in error:', e);
    } finally {
      setIsClockingIn(false);
    }
  };

  const openSpread = (spreadId: string) => {
    try {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    } catch {}
    router.push({
      pathname: '/spread/[id]',
      params: { id: spreadId },
    });
  };

  return (
    <SafeAreaView style={styles.container} edges={['top', 'left', 'right']}>
      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        {/* Header */}
        <View style={styles.header}>
          <View>
            <Text style={styles.headerKicker}>SOLANA MOBILE ORACLE</Text>
            <Text style={styles.headerTitle}>ARKANA</Text>
          </View>
          <View style={styles.skrBadge}>
            <Text style={styles.skrFire}>🔥</Text>
            <Text style={styles.skrText}>{clockInState.skrBalance} SKR</Text>
          </View>
        </View>

        {/* Daily Clock-In Banner */}
        <View style={styles.clockInBanner}>
          <View style={styles.bannerGlow} />
          <View style={styles.bannerHeader}>
            <View style={styles.streakTag}>
              <Text style={styles.streakText}>STREAK: {clockInState.streak} DAYS</Text>
            </View>
            <Text style={styles.rewardText}>
              {clockInState.streak >= 7 ? 'TIER III (5 SPREADS/DAY)' : clockInState.streak >= 3 ? 'TIER II (4 SPREADS/DAY)' : 'TIER I (3 SPREADS/DAY)'}
            </Text>
          </View>

          <Text style={styles.bannerTitle}>Daily Block Consensus</Text>
          <Text style={styles.bannerSubtitle}>
            Clock in daily to validate your mindset, refill your daily free spread allowance, and build your on-chain streak.
          </Text>

          {/* Daily Quota Indicator */}
          <View style={styles.quotaRow}>
            <View style={styles.quotaPill}>
              <Text style={styles.quotaIcon}>✨</Text>
              <Text style={styles.quotaText}>
                {clockInState.freeSpreadsRemaining ?? 3}/{clockInState.freeSpreadsMax ?? 3} FREE SPREADS TODAY
              </Text>
            </View>
            <Text style={styles.quotaSub}>Extra spreads: 5 SKR</Text>
          </View>

          <Pressable
            style={({ pressed }) => [
              styles.clockInButton,
              pressed && styles.buttonPressed,
              !clockInState.canClockIn && styles.buttonDisabled,
            ]}
            onPress={clockInState.canClockIn ? handleClockIn : () => setIsModalVisible(true)}
            disabled={isClockingIn}
          >
            {isClockingIn ? (
              <ActivityIndicator color="#0E101A" />
            ) : (
              <Text style={styles.clockInButtonText}>
                {clockInState.canClockIn ? '⚡ CLOCK IN: DRAW DAILY BLOCK' : '✓ CLOCKED IN (VIEW OMEN)'}
              </Text>
            )}
          </Pressable>
        </View>

        {/* Spreads Section */}
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>ORACLE SPREADS</Text>
          <Text style={styles.sectionSubtitle}>Select a layout to cast the cards</Text>
        </View>

        {/* Spread 1: Network Scan */}
        <Pressable
          style={({ pressed }) => [styles.spreadCard, pressed && styles.cardPressed]}
          onPress={() => openSpread('network-scan')}
        >
          <View style={styles.spreadIconBox}>
            <Text style={styles.spreadIcon}>🔮</Text>
          </View>
          <View style={styles.spreadInfo}>
            <View style={styles.spreadTitleRow}>
              <Text style={styles.spreadName}>The Network Scan</Text>
              <Text style={styles.cardCount}>3 CARDS</Text>
            </View>
            <Text style={styles.spreadDesc}>
              Past · Present · Next Block. Quick situational audit of ongoing market and personal momentum.
            </Text>
          </View>
        </Pressable>

        {/* Spread 2: Validator Cross */}
        <Pressable
          style={({ pressed }) => [styles.spreadCard, pressed && styles.cardPressed]}
          onPress={() => openSpread('validator-cross')}
        >
          <View style={[styles.spreadIconBox, { backgroundColor: '#261C3D' }]}>
            <Text style={styles.spreadIcon}>⚖️</Text>
          </View>
          <View style={styles.spreadInfo}>
            <View style={styles.spreadTitleRow}>
              <Text style={styles.spreadName}>The Validator Cross</Text>
              <Text style={styles.cardCount}>5 CARDS</Text>
            </View>
            <Text style={styles.spreadDesc}>
              Core State · Opportunity · Obstacle · Hidden Influence · Final Outcome. Deep architectural guidance.
            </Text>
          </View>
        </Pressable>

        {/* Spread 3: Crypto Compass */}
        <Pressable
          style={({ pressed }) => [styles.spreadCard, pressed && styles.cardPressed]}
          onPress={() => openSpread('crypto-compass')}
        >
          <View style={[styles.spreadIconBox, { backgroundColor: '#1C2C28' }]}>
            <Text style={styles.spreadIcon}>🧭</Text>
          </View>
          <View style={styles.spreadInfo}>
            <View style={styles.spreadTitleRow}>
              <Text style={styles.spreadName}>The Crypto Compass</Text>
              <Text style={styles.cardCount}>5 CARDS</Text>
            </View>
            <Text style={styles.spreadDesc}>
              You · Market · Project · Opportunity · Risk. Clear analysis on whether to enter a new trade or venture.
            </Text>
          </View>
        </Pressable>
      </ScrollView>

      {/* Daily Omen Modal */}
      <Modal visible={isModalVisible} animationType="slide" transparent={false}>
        <SafeAreaView style={styles.modalContainer}>
          <ScrollView contentContainerStyle={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalKicker}>CONSENSUS CONFIRMED</Text>
              <Text style={styles.modalTitle}>Today's Block Omen</Text>
            </View>

            {dailyReading && dailyReading.cards.length > 0 && (
              <View style={styles.modalCardWrap}>
                <TarotCard
                  cardNo={dailyReading.cards[0].card_no}
                  name={dailyReading.cards[0].crypto_name}
                  isReversed={dailyReading.cards[0].orientation === 'reversed'}
                  isRevealed={true}
                  positionName="TODAY'S CONSENSUS"
                  onPress={() => setZoomedCard(dailyReading.cards[0])}
                  width={200}
                  height={320}
                />
              </View>
            )}

            {dailyReading && (
              <SevenBeatsView
                beats={dailyReading.prose}
                metrics={dailyReading.engine_metrics}
              />
            )}

            <Pressable
              style={styles.modalCloseButton}
              onPress={() => setIsModalVisible(false)}
            >
              <Text style={styles.modalCloseText}>CLOSE ALTAR</Text>
            </Pressable>
          </ScrollView>
        </SafeAreaView>
      </Modal>

      {/* Card Zoom Modal */}
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
  scrollContent: {
    padding: 16,
    paddingBottom: 110,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
  },
  headerKicker: {
    color: '#9945FF',
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 2,
  },
  headerTitle: {
    color: '#FFFFFF',
    fontSize: 26,
    fontWeight: '900',
    letterSpacing: 1.5,
  },
  skrBadge: {
    backgroundColor: '#1E1435',
    borderColor: '#9945FF',
    borderWidth: 1,
    borderRadius: 20,
    paddingHorizontal: 12,
    paddingVertical: 6,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  skrFire: {
    fontSize: 14,
  },
  skrText: {
    color: '#F5D061',
    fontWeight: '800',
    fontSize: 12,
  },
  clockInBanner: {
    backgroundColor: '#131126',
    borderColor: '#9945FF',
    borderWidth: 1.5,
    borderRadius: 18,
    padding: 18,
    marginBottom: 24,
    overflow: 'hidden',
    position: 'relative',
  },
  bannerGlow: {
    position: 'absolute',
    top: -40,
    right: -40,
    width: 140,
    height: 140,
    borderRadius: 70,
    backgroundColor: 'rgba(153, 69, 255, 0.18)',
  },
  bannerHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  streakTag: {
    backgroundColor: '#281747',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 6,
    borderColor: '#9945FF',
    borderWidth: 1,
  },
  streakText: {
    color: '#14F195',
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 1,
  },
  rewardText: {
    color: '#F5D061',
    fontSize: 11,
    fontWeight: '700',
  },
  bannerTitle: {
    color: '#FFFFFF',
    fontSize: 20,
    fontWeight: '800',
    marginBottom: 6,
  },
  bannerSubtitle: {
    color: '#9CA3AF',
    fontSize: 13,
    lineHeight: 19,
    marginBottom: 14,
  },
  quotaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#0C0D17',
    borderColor: '#261F42',
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 8,
    marginBottom: 14,
  },
  quotaPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  quotaIcon: {
    fontSize: 12,
  },
  quotaText: {
    color: '#14F195',
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  quotaSub: {
    color: '#8F8BA8',
    fontSize: 11,
    fontWeight: '600',
  },
  clockInButton: {
    backgroundColor: '#14F195',
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  buttonPressed: {
    opacity: 0.85,
    transform: [{ scale: 0.98 }],
  },
  buttonDisabled: {
    backgroundColor: '#232938',
  },
  clockInButtonText: {
    color: '#0B0C12',
    fontSize: 13,
    fontWeight: '900',
    letterSpacing: 1,
  },
  sectionHeader: {
    marginBottom: 12,
  },
  sectionTitle: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '800',
    letterSpacing: 1.5,
  },
  sectionSubtitle: {
    color: '#6B7280',
    fontSize: 12,
    marginTop: 2,
  },
  spreadCard: {
    backgroundColor: '#121422',
    borderColor: '#20243B',
    borderWidth: 1,
    borderRadius: 14,
    padding: 14,
    marginBottom: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
  },
  cardPressed: {
    borderColor: '#9945FF',
    backgroundColor: '#17152B',
  },
  spreadIconBox: {
    width: 48,
    height: 48,
    borderRadius: 12,
    backgroundColor: '#1B1530',
    alignItems: 'center',
    justifyContent: 'center',
  },
  spreadIcon: {
    fontSize: 24,
  },
  spreadInfo: {
    flex: 1,
  },
  spreadTitleRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  spreadName: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '700',
  },
  cardCount: {
    color: '#14F195',
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  spreadDesc: {
    color: '#8B949E',
    fontSize: 12,
    lineHeight: 17,
  },
  modalContainer: {
    flex: 1,
    backgroundColor: '#0B0C12',
  },
  modalContent: {
    padding: 16,
    paddingBottom: 40,
    alignItems: 'center',
  },
  modalHeader: {
    alignItems: 'center',
    marginVertical: 12,
  },
  modalKicker: {
    color: '#14F195',
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 2,
  },
  modalTitle: {
    color: '#FFFFFF',
    fontSize: 22,
    fontWeight: '900',
    marginTop: 4,
  },
  modalCardWrap: {
    marginVertical: 14,
  },
  modalCloseButton: {
    marginTop: 20,
    backgroundColor: '#1E1838',
    borderColor: '#9945FF',
    borderWidth: 1.5,
    paddingVertical: 14,
    paddingHorizontal: 32,
    borderRadius: 12,
    width: '100%',
    alignItems: 'center',
  },
  modalCloseText: {
    color: '#F5D061',
    fontWeight: '800',
    fontSize: 13,
    letterSpacing: 1.5,
  },
});
