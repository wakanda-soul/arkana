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
import { fetchClockInStatus, executeClockIn, repairStreak, ClockInResult, ReadingResponse } from '@/services/oracleApi';
import { TarotCard } from '@/components/tarot/TarotCard';
import { SevenBeatsView } from '@/components/tarot/SevenBeatsView';
import { CardZoomModal, ZoomCardData } from '@/components/tarot/CardZoomModal';
import { ellipsify } from '@/utils/ellipsify';
import { showError } from '@/utils/show-error';
import { shareToTwitter, shareGeneral } from '@/utils/shareOmen';
import { unlockCards } from '@/services/codexService';

export default function AltarScreen() {
  const router = useRouter();
  const { account, isAuthenticated, signIn } = useAuth();
  const walletAddress = account?.publicKey?.toString() || 'SeekerDemoWallet1111111111111111111';

  const [isConnecting, setIsConnecting] = useState(false);
  const [isRepairing, setIsRepairing] = useState(false);

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
      if (res.reading?.cards && res.reading.cards.length > 0) {
        unlockCards([res.reading.cards[0].card_no]);
      }
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

  const handleRepairStreak = async () => {
    if (isRepairing) return;
    const cost = clockInState.streakRepairCostSkr || 1;
    if ((clockInState.skrBalance || 0) < cost) {
      showError('Insufficient SKR', `You need ${cost} SKR to repair your streak.`);
      return;
    }
    setIsRepairing(true);
    try {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
      const res = await repairStreak(walletAddress);
      if (res.success) {
        setClockInState(prev => ({
          ...prev,
          streak: res.streak,
          skrBalance: res.skrBalance,
          canRepairStreak: false,
        }));
        try {
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        } catch {}
      } else {
        showError('Streak Repair', res.error || 'Failed to repair streak.');
      }
    } catch (e) {
      showError('Streak Repair', e);
    } finally {
      setIsRepairing(false);
    }
  };

  const handleShareX = async () => {
    if (!dailyReading || !dailyReading.cards || dailyReading.cards.length === 0) return;
    try {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    } catch {}
    const card = dailyReading.cards[0];
    await shareToTwitter({
      cardName: card.crypto_name,
      cardNo: card.card_no,
      orientation: card.orientation,
      streak: clockInState.streak,
      proseOmen: dailyReading.prose?.finalOmen || card.advice,
      spreadName: 'Daily Consensus Block'
    });
  };

  const handleShareMore = async () => {
    if (!dailyReading || !dailyReading.cards || dailyReading.cards.length === 0) return;
    try {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    } catch {}
    const card = dailyReading.cards[0];
    await shareGeneral({
      cardName: card.crypto_name,
      cardNo: card.card_no,
      orientation: card.orientation,
      streak: clockInState.streak,
      proseOmen: dailyReading.prose?.finalOmen || card.advice,
      spreadName: 'Daily Consensus Block'
    });
  };

  const handleConnect = async () => {
    if (isConnecting) return;
    setIsConnecting(true);
    try {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      await signIn();
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } catch (e) {
      showError('Could not connect wallet', e);
    } finally {
      setIsConnecting(false);
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
          {isAuthenticated ? (
            <View style={styles.headerRight}>
              <View style={styles.skrBadge}>
                <Text style={styles.skrFire}>🔥</Text>
                <Text style={styles.skrText}>{clockInState.skrBalance} SKR</Text>
              </View>
              <View style={styles.addressChip}>
                <Text style={styles.addressChipText}>{ellipsify(walletAddress, 4)}</Text>
              </View>
            </View>
          ) : (
            <Pressable
              style={({ pressed }) => [styles.connectHeaderBtn, pressed && styles.buttonPressed]}
              onPress={handleConnect}
              disabled={isConnecting}
            >
              {isConnecting ? (
                <ActivityIndicator size="small" color="#14F195" />
              ) : (
                <>
                  <Text style={styles.connectHeaderIcon}>⚡</Text>
                  <Text style={styles.connectHeaderBtnText}>CONNECT</Text>
                </>
              )}
            </Pressable>
          )}
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

          {/* Streak Repair Box if broken or repairable */}
          {(clockInState.canRepairStreak || clockInState.streak === 0) && (
            <View style={styles.repairBox}>
              <View style={styles.repairInfo}>
                <Text style={styles.repairTitle}>
                  🛡️ STREAK FROZEN ({clockInState.repairStreakTarget || 1} DAYS)
                </Text>
                <Text style={styles.repairSub}>
                  Restore your streak & tier multiplier for {clockInState.streakRepairCostSkr || 1} SKR
                </Text>
              </View>
              <Pressable
                style={({ pressed }) => [
                  styles.repairBtn,
                  pressed && styles.buttonPressed,
                  isRepairing && styles.buttonDisabled,
                ]}
                onPress={handleRepairStreak}
                disabled={isRepairing}
              >
                {isRepairing ? (
                  <ActivityIndicator size="small" color="#0E101A" />
                ) : (
                  <Text style={styles.repairBtnText}>REPAIR ({clockInState.streakRepairCostSkr || 1} SKR)</Text>
                )}
              </Pressable>
            </View>
          )}
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

            {/* Transmit / Share Section */}
            <View style={styles.shareSection}>
              <Text style={styles.shareSectionKicker}>TRANSMIT CONSENSUS</Text>
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
  headerRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  addressChip: {
    backgroundColor: '#16192B',
    borderColor: '#2D325A',
    borderWidth: 1,
    paddingHorizontal: 8,
    paddingVertical: 6,
    borderRadius: 12,
  },
  addressChipText: {
    color: '#8B949E',
    fontSize: 11,
    fontWeight: '700',
  },
  connectHeaderBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#18122B',
    borderColor: '#9945FF',
    borderWidth: 1.5,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 14,
    gap: 6,
  },
  connectHeaderIcon: {
    fontSize: 13,
  },
  connectHeaderBtnText: {
    color: '#14F195',
    fontSize: 11,
    fontWeight: '900',
    letterSpacing: 1,
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
    marginTop: 14,
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
  repairBox: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#1C1226',
    borderColor: '#FF446666',
    borderWidth: 1,
    borderRadius: 12,
    padding: 12,
    marginTop: 12,
    gap: 10,
  },
  repairInfo: {
    flex: 1,
  },
  repairTitle: {
    color: '#FF6B8B',
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  repairSub: {
    color: '#8B949E',
    fontSize: 10,
    marginTop: 2,
    lineHeight: 14,
  },
  repairBtn: {
    backgroundColor: '#FF4466',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
  },
  repairBtnText: {
    color: '#FFFFFF',
    fontSize: 10,
    fontWeight: '900',
    letterSpacing: 0.5,
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
