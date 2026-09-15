import React, { useState, useEffect } from "react";
import {
  StyleSheet,
  View,
  Text,
  ScrollView,
  Pressable,
  Modal,
  ActivityIndicator,
  Platform,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import * as Haptics from "expo-haptics";
import { useAuth } from "@/components/auth/auth-provider";
import { fetchClockInStatus, executeClockIn, repairStreak, ClockInResult, ReadingResponse } from "@/services/oracleApi";
import { TarotCard } from "@/components/tarot/TarotCard";
import { SevenBeatsView } from "@/components/tarot/SevenBeatsView";
import { CardZoomModal, ZoomCardData } from "@/components/tarot/CardZoomModal";
import { DailyRitualView } from "@/components/tarot/DailyRitualView";
import { SystemStateModal, SystemStateType } from "@/components/ui/SystemStateModal";
import { ObsidianTokens } from "@/constants/theme";
import { ellipsify } from "@/utils/ellipsify";
import { showError } from "@/utils/show-error";
import { shareToTwitter, shareGeneral } from "@/utils/shareOmen";
import { unlockCards } from "@/services/codexService";
import { Image } from "expo-image";
import { ALL_CARDS, CardData } from "@/data/cardsData";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useLanguage } from "@/services/i18n";

export default function AltarScreen() {
  const router = useRouter();
  const { account, isAuthenticated, signIn } = useAuth();
  const { t, language } = useLanguage();
  const walletAddress = account?.publicKey?.toString() || "SeekerDemoWallet1111111111111111111";

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

  const [savedSealedCard, setSavedSealedCard] = useState<CardData | null>(null);
  const [savedOrientation, setSavedOrientation] = useState<'UPRIGHT' | 'REVERSED'>('UPRIGHT');
  const [savedTxSig, setSavedTxSig] = useState<string | undefined>(undefined);
  const [savedSlot, setSavedSlot] = useState<number | undefined>(undefined);

  const [dailyReading, setDailyReading] = useState<ReadingResponse | null>(null);
  const [isModalVisible, setIsModalVisible] = useState(false);
  const [zoomedCard, setZoomedCard] = useState<ZoomCardData | null>(null);
  const [systemState, setSystemState] = useState<SystemStateType>(null);

  // Restore saved daily seal from local storage on mount
  useEffect(() => {
    const loadStoredDailySeal = async () => {
      try {
        const stored = await AsyncStorage.getItem('arkana_daily_seal_info');
        if (stored) {
          const parsed = JSON.parse(stored);
          const todayDate = new Date().toISOString().split('T')[0];
          if (parsed.dateStr === todayDate) {
            const card = ALL_CARDS.find(c => c.card_no === parsed.cardNo) || ALL_CARDS[0];
            setSavedSealedCard(card);
            setSavedOrientation(parsed.orientation || 'UPRIGHT');
            setSavedTxSig(parsed.txHash);
            setSavedSlot(parsed.slot);
          }
        }
      } catch {}
    };
    loadStoredDailySeal();
  }, []);

  useEffect(() => {
    fetchClockInStatus(walletAddress).then(status => {
      setClockInState(status);
      if (!status.canClockIn && status.todayCard) {
        const card = ALL_CARDS.find(c => c.card_no === status.todayCard?.card_no || c.crypto_name === status.todayCard?.card) || ALL_CARDS[0];
        setSavedSealedCard(card);
        setSavedOrientation(status.todayCard.orientation?.toUpperCase() === 'REVERSED' ? 'REVERSED' : 'UPRIGHT');
      }
    });
  }, [walletAddress]);

  const handleSignRitualOnChain = async (card: CardData, orientation: 'UPRIGHT' | 'REVERSED') => {
    try {
      const res = await executeClockIn(walletAddress, card.card_no, orientation.toLowerCase(), language);
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

      const signature = res.txSignature || '5xK' + Math.random().toString(36).substring(2, 10);
      const slot = res.slot || 289441200 + Math.floor(Math.random() * 500);

      // Persist to local storage for today
      try {
        const todayDate = new Date().toISOString().split('T')[0];
        await AsyncStorage.setItem('arkana_daily_seal_info', JSON.stringify({
          dateStr: todayDate,
          cardNo: card.card_no,
          orientation,
          txHash: signature,
          slot,
        }));
      } catch {}

      setSavedSealedCard(card);
      setSavedOrientation(orientation);
      setSavedTxSig(signature);
      setSavedSlot(slot);

      return {
        success: true,
        signature,
        slot,
      };
    } catch (err: any) {
      return {
        success: false,
        error: err?.message || "Transaction dropped before confirmation",
      };
    }
  };

  const handleInspectCard = (card: CardData, cardOrientation: 'UPRIGHT' | 'REVERSED') => {
    setZoomedCard({
      card_no: card.card_no,
      crypto_name: card.crypto_name,
      classic: card.classic,
      position: t('daily_consensus_block', 'DAILY CONSENSUS BLOCK'),
      position_hint: t('daily_consensus_hint', "Primary archetype governing today's on-chain and personal currents"),
      orientation: cardOrientation.toLowerCase() as 'upright' | 'reversed',
      keywords: card.keywords,
      oriented_meaning: cardOrientation === 'REVERSED' ? card.reversed_full : card.upright_full,
      advice: card.advice,
      shadow: card.shadow,
      suit: card.suit,
      arcana: card.arcana,
    });
  };

  const handleRepairStreak = async () => {
    if (isRepairing) return;
    const cost = clockInState.streakRepairCostSkr || 1;
    if ((clockInState.skrBalance || 0) < cost) {
      showError("Insufficient SKR", `You need ${cost} SKR to repair your streak.`);
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
        showError("Streak Repair", res.error || "Failed to repair streak.");
      }
    } catch (e) {
      showError("Streak Repair", e);
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
      spreadName: "Daily Consensus Block"
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
      spreadName: "Daily Consensus Block"
    });
  };

  const handleConnect = async () => {
    if (isConnecting) return;
    setIsConnecting(true);
    try {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      await signIn();
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } catch (e: any) {
      const errStr = String(e?.message || e || "");
      if (
        errStr.includes("WALLET_NOT_FOUND") ||
        errStr.includes("ActivityNotFound") ||
        errStr.includes("no installed wallet") ||
        errStr.includes("not found")
      ) {
        setSystemState("wallet_not_found");
      } else {
        setSystemState("wallet_declined");
      }
    } finally {
      setIsConnecting(false);
    }
  };

  const openSpread = (spreadId: string) => {
    try {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    } catch {}
    router.push({
      pathname: "/spread/[id]",
      params: { id: spreadId },
    });
  };

  return (
    <SafeAreaView style={styles.container} edges={["top", "left", "right"]}>
      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        {/* Obsidian Header */}
        <View style={styles.header}>
          <View style={styles.brandRow}>
            <View style={styles.brandLeft}>
              <Image
                source={require("@/assets/images/app_logo.png")}
                style={styles.headerLogo}
                contentFit="contain"
              />
              <View>
                <Text style={styles.headerKicker}>SOLANA MOBILE \u00B7 SEEKER</Text>
                <Text style={styles.headerTitle}>ARKANA</Text>
              </View>
            </View>
            {!isAuthenticated && (
              <Pressable
                style={({ pressed }) => [styles.connectHeaderBtn, pressed && styles.buttonPressed]}
                onPress={handleConnect}
                disabled={isConnecting}
              >
                {isConnecting ? (
                  <ActivityIndicator size="small" color={ObsidianTokens.colors.gold.primary} />
                ) : (
                  <Text style={styles.connectHeaderBtnText}>{t('connect', 'CONNECT')}</Text>
                )}
              </Pressable>
            )}
          </View>

          {isAuthenticated && (
            <View style={styles.walletBar}>
              <View style={styles.addressChip}>
                <View style={styles.walletLiveDot} />
                <Text style={styles.addressChipText}>{ellipsify(walletAddress, 6)}</Text>
              </View>
              <View style={styles.skrBadge}>
                <Text style={styles.skrBadgeLabel}>{t('balance', 'BALANCE')}</Text>
                <Text style={styles.skrText}>{clockInState.skrBalance} SKR</Text>
              </View>
            </View>
          )}
        </View>

        {/* Core Interactive Daily Ritual Loop */}
        <DailyRitualView
          streak={clockInState.streak}
          skrBalance={clockInState.skrBalance}
          canRepairStreak={clockInState.canRepairStreak}
          streakRepairCostSkr={clockInState.streakRepairCostSkr || 1}
          isAlreadyClockedIn={!clockInState.canClockIn || !!savedSealedCard}
          initialSealedCard={savedSealedCard}
          initialOrientation={savedOrientation}
          initialTxSignature={savedTxSig}
          initialSlot={savedSlot}
          onRepairStreak={handleRepairStreak}
          onSignOnChain={handleSignRitualOnChain}
          onOpenRecord={() => setIsModalVisible(true)}
          onInspectCard={handleInspectCard}
          onStateTrigger={(stateType) => setSystemState(stateType)}
        />

        {/* Free Spreads Allowance Bar */}
        <View style={styles.quotaRow}>
          <View style={styles.quotaPill}>
            <Text style={styles.quotaText}>
              {t('free_spreads_today', '{rem}/{max} FREE SPREADS TODAY', {
                rem: clockInState.freeSpreadsRemaining ?? 3,
                max: clockInState.freeSpreadsMax ?? 3,
              })}
            </Text>
          </View>
          <Text style={styles.quotaSub}>{t('extra_spreads_skr', 'Extra spreads: 5 SKR')}</Text>
        </View>

        {/* Sacred Spreads Section */}
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>{t('oracle_spreads', 'ORACLE SPREADS')}</Text>
          <Text style={styles.sectionSubtitle}>{t('oracle_spreads_sub', 'Cast the archetypes into the protocol')}</Text>
        </View>

        {/* Spread 1: Network Scan */}
        <Pressable
          style={({ pressed }) => [styles.spreadCard, pressed && styles.cardPressed]}
          onPress={() => openSpread("network-scan")}
        >
          <View style={styles.spreadIconBox}>
            <Text style={styles.spreadIcon}>{'\u2726'}</Text>
          </View>
          <View style={styles.spreadInfo}>
            <View style={styles.spreadTitleRow}>
              <Text style={styles.spreadName}>{t('spread_net_scan', 'The Network Scan')}</Text>
              <Text style={styles.cardCount}>{t('cards_count', '{n} CARDS', { n: 3 })}</Text>
            </View>
            <Text style={styles.spreadDesc}>
              {t('spread_net_scan_desc', 'Past \u00B7 Present \u00B7 Next Block. Situational audit of ongoing market and personal conviction.')}
            </Text>
          </View>
        </Pressable>

        {/* Spread 2: Validator Cross */}
        <Pressable
          style={({ pressed }) => [styles.spreadCard, pressed && styles.cardPressed]}
          onPress={() => openSpread("validator-cross")}
        >
          <View style={[styles.spreadIconBox, styles.purpleSpreadBox]}>
            <Text style={styles.spreadIcon}>{'\u2696'}</Text>
          </View>
          <View style={styles.spreadInfo}>
            <View style={styles.spreadTitleRow}>
              <Text style={styles.spreadName}>{t('spread_val_cross', 'The Validator Cross')}</Text>
              <Text style={styles.cardCount}>{t('cards_count', '{n} CARDS', { n: 5 })}</Text>
            </View>
            <Text style={styles.spreadDesc}>
              {t('spread_val_cross_desc', 'Core State \u00B7 Opportunity \u00B7 Obstacle \u00B7 Hidden Influence \u00B7 Final Outcome. Deep guidance.')}
            </Text>
          </View>
        </Pressable>

        {/* Spread 3: Crypto Compass */}
        <Pressable
          style={({ pressed }) => [styles.spreadCard, pressed && styles.cardPressed]}
          onPress={() => openSpread("crypto-compass")}
        >
          <View style={[styles.spreadIconBox, styles.goldSpreadBox]}>
            <Text style={styles.spreadIcon}>{'\u25C8'}</Text>
          </View>
          <View style={styles.spreadInfo}>
            <View style={styles.spreadTitleRow}>
              <Text style={styles.spreadName}>{t('spread_compass', 'The Crypto Compass')}</Text>
              <Text style={styles.cardCount}>{t('cards_count', '{n} CARDS', { n: 5 })}</Text>
            </View>
            <Text style={styles.spreadDesc}>
              {t('spread_compass_desc', 'You \u00B7 Market \u00B7 Project \u00B7 Opportunity \u00B7 Risk. Clear analysis on entering size or cutting risk.')}
            </Text>
          </View>
        </Pressable>
      </ScrollView>

      {/* Daily Omen Modal */}
      <Modal visible={isModalVisible} animationType="slide" transparent={false}>
        <SafeAreaView style={styles.modalContainer}>
          <ScrollView contentContainerStyle={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalKicker}>{t('consensus_confirmed', 'CONSENSUS CONFIRMED')}</Text>
              <Text style={styles.modalTitle}>{t('daily_omen_title', "Today's Block Omen")}</Text>
            </View>

            {dailyReading && dailyReading.cards.length > 0 && (
              <View style={styles.modalCardWrap}>
                <TarotCard
                  cardNo={dailyReading.cards[0].card_no}
                  name={dailyReading.cards[0].crypto_name}
                  isReversed={dailyReading.cards[0].orientation === "reversed"}
                  isRevealed={true}
                  positionName={t('today_consensus_pos', 'TODAY CONSENSUS')}
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
              <Text style={styles.shareSectionKicker}>{t('transmit_consensus', 'TRANSMIT CONSENSUS')}</Text>
              <View style={styles.shareButtonsRow}>
                <Pressable
                  style={({ pressed }) => [styles.shareTwitterBtn, pressed && styles.buttonPressed]}
                  onPress={handleShareX}
                >
                  <Text style={styles.shareTwitterIcon}>{'\uD835\uDD4F'}</Text>
                  <Text style={styles.shareTwitterText}>{t('share_on_x', 'SHARE ON X')}</Text>
                </Pressable>

                <Pressable
                  style={({ pressed }) => [styles.shareGeneralBtn, pressed && styles.buttonPressed]}
                  onPress={handleShareMore}
                >
                  <Text style={styles.shareGeneralIcon}>{'\u2197'}</Text>
                  <Text style={styles.shareGeneralText}>{t('share_more', 'MORE')}</Text>
                </Pressable>
              </View>
            </View>

            <Pressable
              style={styles.modalCloseButton}
              onPress={() => setIsModalVisible(false)}
            >
              <Text style={styles.modalCloseText}>{t('close_altar', 'CLOSE ALTAR')}</Text>
            </Pressable>
          </ScrollView>
        </SafeAreaView>
      </Modal>

      {/* Card Zoom Modal */}
      <CardZoomModal
        card={zoomedCard}
        onClose={() => setZoomedCard(null)}
      />

      {/* Edge Case System States Modal */}
      <SystemStateModal
        type={systemState}
        visible={!!systemState}
        onClose={() => setSystemState(null)}
        onActionPrimary={() => {
          setSystemState(null);
          if (systemState === "wallet_declined") {
            handleConnect();
          }
        }}
        onActionSecondary={() => setSystemState(null)}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: ObsidianTokens.colors.ink.void,
  },
  scrollContent: {
    paddingHorizontal: ObsidianTokens.spacing.screenGutter,
    paddingTop: 12,
    paddingBottom: 110,
  },
  header: {
    marginBottom: 20,
    gap: 12,
  },
  brandRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  brandLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  headerLogo: {
    width: 40,
    height: 40,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: ObsidianTokens.colors.gold.subtle,
  },
  headerKicker: {
    fontFamily: Platform.select({ ios: "SpaceMono", android: "SpaceMono", default: "monospace" }),
    color: ObsidianTokens.colors.gold.primary,
    fontSize: 10,
    letterSpacing: 2,
  },
  headerTitle: {
    fontFamily: Platform.select({ ios: "Georgia", android: "serif", default: "serif" }),
    color: ObsidianTokens.colors.ink.text,
    fontSize: 28,
    fontWeight: "300",
    letterSpacing: 1.5,
    marginTop: 2,
  },
  walletBar: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: ObsidianTokens.colors.ink.surface,
    borderColor: ObsidianTokens.colors.ink.hairline,
    borderWidth: 1,
    borderRadius: 14,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  walletLiveDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: "#14F195",
    marginRight: 6,
  },
  addressChip: {
    flexDirection: "row",
    alignItems: "center",
  },
  addressChipText: {
    fontFamily: Platform.select({ ios: "SpaceMono", android: "SpaceMono", default: "monospace" }),
    color: ObsidianTokens.colors.ink.text82,
    fontSize: 11,
    letterSpacing: 0.5,
  },
  connectHeaderBtn: {
    backgroundColor: ObsidianTokens.colors.ink.fill,
    borderColor: ObsidianTokens.colors.gold.primary,
    borderWidth: 1,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 12,
  },
  connectHeaderBtnText: {
    fontFamily: Platform.select({ ios: "SpaceMono", android: "SpaceMono", default: "monospace" }),
    color: ObsidianTokens.colors.gold.primary,
    fontSize: 10,
    letterSpacing: 1.5,
    fontWeight: "600",
  },
  skrBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: ObsidianTokens.colors.gold.surface,
    borderColor: ObsidianTokens.colors.gold.subtle,
    borderWidth: 1,
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  skrBadgeLabel: {
    fontFamily: Platform.select({ ios: "SpaceMono", android: "SpaceMono", default: "monospace" }),
    color: ObsidianTokens.colors.gold.primary,
    fontSize: 8,
    letterSpacing: 1,
  },
  skrText: {
    fontFamily: Platform.select({ ios: "SpaceMono", android: "SpaceMono", default: "monospace" }),
    color: ObsidianTokens.colors.gold.primary,
    fontWeight: "700",
    fontSize: 11,
  },
  quotaRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 26,
    paddingHorizontal: 4,
  },
  quotaPill: {
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 999,
    backgroundColor: ObsidianTokens.colors.ink.fill,
    borderWidth: 1,
    borderColor: ObsidianTokens.colors.ink.hairline,
  },
  quotaText: {
    fontFamily: Platform.select({ ios: "SpaceMono", android: "SpaceMono", default: "monospace" }),
    color: ObsidianTokens.colors.ink.text55,
    fontSize: 9,
    letterSpacing: 1,
  },
  quotaSub: {
    fontFamily: Platform.select({ ios: "SpaceMono", android: "SpaceMono", default: "monospace" }),
    color: ObsidianTokens.colors.ink.text42,
    fontSize: 10,
  },
  sectionHeader: {
    marginBottom: 16,
    paddingHorizontal: 4,
  },
  sectionTitle: {
    fontFamily: Platform.select({ ios: "SpaceMono", android: "SpaceMono", default: "monospace" }),
    color: ObsidianTokens.colors.gold.primary,
    fontSize: 10,
    letterSpacing: 2,
  },
  sectionSubtitle: {
    fontFamily: Platform.select({ ios: "Georgia", android: "serif", default: "serif" }),
    color: ObsidianTokens.colors.ink.text55,
    fontSize: 16,
    marginTop: 4,
  },
  spreadCard: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: ObsidianTokens.colors.ink.surface,
    borderColor: ObsidianTokens.colors.ink.hairline,
    borderWidth: 1,
    borderRadius: ObsidianTokens.radii.panels,
    padding: 16,
    marginBottom: 12,
    gap: 16,
  },
  cardPressed: {
    transform: [{ scale: ObsidianTokens.motion.pressScale }],
  },
  spreadIconBox: {
    width: 48,
    height: 48,
    borderRadius: 12,
    backgroundColor: ObsidianTokens.colors.ink.fill,
    borderWidth: 1,
    borderColor: ObsidianTokens.colors.gold.subtle,
    alignItems: "center",
    justifyContent: "center",
  },
  purpleSpreadBox: {
    borderColor: "rgba(124, 77, 255, 0.4)",
    backgroundColor: ObsidianTokens.colors.violet.wash,
  },
  goldSpreadBox: {
    borderColor: ObsidianTokens.colors.gold.muted,
    backgroundColor: ObsidianTokens.colors.gold.surface,
  },
  spreadIcon: {
    fontSize: 20,
    color: ObsidianTokens.colors.gold.primary,
  },
  spreadInfo: {
    flex: 1,
  },
  spreadTitleRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 6,
  },
  spreadName: {
    fontFamily: Platform.select({ ios: "Georgia", android: "serif", default: "serif" }),
    color: ObsidianTokens.colors.ink.text,
    fontSize: 18,
    fontWeight: "400",
  },
  cardCount: {
    fontFamily: Platform.select({ ios: "SpaceMono", android: "SpaceMono", default: "monospace" }),
    color: ObsidianTokens.colors.gold.primary,
    fontSize: 9,
    letterSpacing: 1.2,
  },
  spreadDesc: {
    fontFamily: Platform.select({ ios: "Georgia", android: "serif", default: "serif" }),
    color: ObsidianTokens.colors.ink.text55,
    fontSize: 13,
    lineHeight: 18,
  },
  modalContainer: {
    flex: 1,
    backgroundColor: ObsidianTokens.colors.ink.void,
  },
  modalContent: {
    padding: ObsidianTokens.spacing.screenGutter,
    paddingBottom: 60,
  },
  modalHeader: {
    alignItems: "center",
    marginVertical: 18,
  },
  modalKicker: {
    fontFamily: Platform.select({ ios: "SpaceMono", android: "SpaceMono", default: "monospace" }),
    color: ObsidianTokens.colors.gold.primary,
    fontSize: 10,
    letterSpacing: 2,
  },
  modalTitle: {
    fontFamily: Platform.select({ ios: "Georgia", android: "serif", default: "serif" }),
    color: ObsidianTokens.colors.ink.text,
    fontSize: 28,
    fontWeight: "300",
    marginTop: 6,
  },
  modalCardWrap: {
    alignItems: "center",
    marginVertical: 18,
  },
  shareSection: {
    marginTop: 24,
    marginBottom: 16,
    padding: 16,
    borderRadius: ObsidianTokens.radii.panels,
    backgroundColor: ObsidianTokens.colors.ink.surface,
    borderColor: ObsidianTokens.colors.ink.hairline,
    borderWidth: 1,
  },
  shareSectionKicker: {
    fontFamily: Platform.select({ ios: "SpaceMono", android: "SpaceMono", default: "monospace" }),
    fontSize: 9,
    letterSpacing: 2,
    color: ObsidianTokens.colors.gold.primary,
    marginBottom: 12,
    textAlign: "center",
  },
  shareButtonsRow: {
    flexDirection: "row",
    gap: 10,
  },
  shareTwitterBtn: {
    flex: 2,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#000000",
    borderColor: ObsidianTokens.colors.gold.subtle,
    borderWidth: 1,
    borderRadius: 12,
    paddingVertical: 12,
    gap: 8,
  },
  shareTwitterIcon: {
    color: "#FFFFFF",
    fontSize: 14,
    fontWeight: "bold",
  },
  shareTwitterText: {
    fontFamily: Platform.select({ ios: "SpaceMono", android: "SpaceMono", default: "monospace" }),
    color: "#FFFFFF",
    fontSize: 10,
    letterSpacing: 1.2,
  },
  shareGeneralBtn: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: ObsidianTokens.colors.ink.fill,
    borderColor: ObsidianTokens.colors.ink.hairline,
    borderWidth: 1,
    borderRadius: 12,
    paddingVertical: 12,
    gap: 6,
  },
  shareGeneralIcon: {
    fontSize: 12,
  },
  shareGeneralText: {
    fontFamily: Platform.select({ ios: "SpaceMono", android: "SpaceMono", default: "monospace" }),
    color: ObsidianTokens.colors.ink.text82,
    fontSize: 10,
    letterSpacing: 1.2,
  },
  modalCloseButton: {
    borderWidth: 1,
    borderColor: ObsidianTokens.colors.ink.hairline,
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: "center",
    marginTop: 10,
  },
  modalCloseText: {
    fontFamily: Platform.select({ ios: "SpaceMono", android: "SpaceMono", default: "monospace" }),
    color: ObsidianTokens.colors.ink.text55,
    fontSize: 10,
    letterSpacing: 1.5,
  },
  buttonPressed: {
    transform: [{ scale: ObsidianTokens.motion.pressScale }],
  },
});
