import React, { useState, useEffect, useCallback } from "react";
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
import { useRouter, useFocusEffect } from "expo-router";
import * as Haptics from "expo-haptics";
import { useAuth } from "@/components/auth/auth-provider";
import { fetchClockInStatus, executeClockIn, repairStreak, setRemoteSeekerStatus, ClockInResult, ReadingResponse } from "@/services/oracleApi";
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
import { useMobileWallet } from "@wallet-ui/react-native-web3js";
import { submitConsensusProofOnChain, fetchRealSkrBalance, checkSeekerGenesisHolderOnChain } from "@/services/solanaService";
import { PublicKey } from "@solana/web3.js";

export default function AltarScreen() {
  const router = useRouter();
  const { account, isAuthenticated, signIn } = useAuth();
  const { connection, signAndSendTransactions } = useMobileWallet();
  const { t, language } = useLanguage();
  const walletAddress = account?.publicKey?.toString() || "";

  const [isConnecting, setIsConnecting] = useState(false);
  const [isRepairing, setIsRepairing] = useState(false);
  const [customError, setCustomError] = useState<string | undefined>(undefined);
  const [onChainSkr, setOnChainSkr] = useState<number | null>(null);

  const [clockInState, setClockInState] = useState<ClockInResult>({
    canClockIn: true,
    streak: 1,
    lastClockIn: null,
    totalReadings: 1,
    skrBalance: 0,
    freeSpreadsRemaining: 0,
    freeSpreadsMax: 0,
    extraSpreadCostSkr: 5,
    isSeekerHolder: false,
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
    if (!walletAddress) {
      return;
    }
    const syncStatus = async () => {
      let isHolder = false;
      if (account?.publicKey) {
        try {
          isHolder = await checkSeekerGenesisHolderOnChain(connection, account.publicKey);
          await setRemoteSeekerStatus(walletAddress, isHolder);
        } catch (err) {
          console.warn('[Seeker SBT] check failed in Altar:', err);
        }
      }
      try {
        const status = await fetchClockInStatus(walletAddress, account?.publicKey ? isHolder : undefined);
        setClockInState(status);
        if (!status.canClockIn && status.todayCard) {
          const card = ALL_CARDS.find(c => c.card_no === status.todayCard?.card_no || c.crypto_name === status.todayCard?.card) || ALL_CARDS[0];
          setSavedSealedCard(card);
          setSavedOrientation(status.todayCard.orientation?.toUpperCase() === 'REVERSED' ? 'REVERSED' : 'UPRIGHT');
        }
      } catch (err) {
        console.warn('Failed to fetch clock-in status in Altar:', err);
      }
    };

    syncStatus();

    if (account?.publicKey || walletAddress) {
      try {
        const pubkeyStr = walletAddress || account.publicKey.toString();
        const userPub = new PublicKey(pubkeyStr);
        fetchRealSkrBalance(connection, userPub).then(val => {
          setOnChainSkr(val);
        }).catch(() => {});
      } catch {}
    }
  }, [walletAddress, account?.publicKey, connection]);

  // Immediately refresh on-chain SKR balance and holder verification whenever user navigates to Altar tab
  useFocusEffect(
    useCallback(() => {
      if (!walletAddress && !account?.publicKey) return;
      let isMounted = true;
      try {
        const pubkeyStr = walletAddress || account.publicKey.toString();
        const userPub = new PublicKey(pubkeyStr);
        fetchRealSkrBalance(connection, userPub)
          .then(val => {
            if (isMounted) setOnChainSkr(val);
          })
          .catch(() => {});
      } catch {}

      return () => {
        isMounted = false;
      };
    }, [walletAddress, account?.publicKey, connection])
  );

  const displaySkr = onChainSkr !== null ? onChainSkr : (clockInState.skrBalance ?? 0);

  const handleSignRitualOnChain = async (card: CardData, orientation: 'UPRIGHT' | 'REVERSED') => {
    try {
      if (!isAuthenticated || !account?.publicKey || !walletAddress) {
        return {
          success: false,
          error: "Wallet connection required to seal ritual on-chain",
        };
      }

      let signature: string | undefined;
      let slot: number | undefined;

      // Real on-chain Solana SPL Memo transaction
      try {
        const onChainRes = await submitConsensusProofOnChain({
          connection,
          walletPublicKey: account.publicKey,
          signAndSendTransactions,
          cardNo: card.card_no,
          orientation,
        });
        signature = onChainRes.signature;
        slot = onChainRes.slot;
      } catch (txErr: any) {
        console.warn('[Solana] On-chain signing rejected or failed:', txErr);
        const errStr = String(txErr?.message || txErr || '');
        if (errStr.includes('authorization request failed') || errStr.includes('-1')) {
          try {
            await AsyncStorage.removeItem('arkana_wallet_authorization');
          } catch {}
        }
        return {
          success: false,
          error: txErr?.message || "Transaction was canceled in wallet",
        };
      }

      const res = await executeClockIn(
        walletAddress,
        card.card_no,
        orientation.toLowerCase(),
        language,
        signature,
        slot
      );

      setDailyReading(res.reading);
      if (res.reading?.cards && res.reading.cards.length > 0) {
        unlockCards([res.reading.cards[0].card_no]);
      }
      setClockInState(prev => ({
        ...prev,
        canClockIn: false,
        streak: res.streak,
        freeSpreadsRemaining: prev.isSeekerHolder ? (prev.freeSpreadsMax ?? 3) : 0,
      }));

      const finalSignature = signature || res.txSignature;
      const finalSlot = slot || res.slot;

      // Persist to local storage for today
      try {
        const todayDate = new Date().toISOString().split('T')[0];
        await AsyncStorage.setItem('arkana_daily_seal_info', JSON.stringify({
          dateStr: todayDate,
          cardNo: card.card_no,
          orientation,
          txHash: finalSignature,
          slot: finalSlot,
        }));
      } catch {}

      setSavedSealedCard(card);
      setSavedOrientation(orientation);
      setSavedTxSig(finalSignature);
      setSavedSlot(finalSlot);

      return {
        success: true,
        signature: finalSignature,
        slot: finalSlot,
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
    const currentSkr = displaySkr;
    if (currentSkr < cost) {
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
          skrBalance: currentSkr,
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
                <Text style={styles.headerKicker}>SOLANA MOBILE · SEEKER</Text>
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
                <Text style={styles.skrText}>{displaySkr} SKR</Text>
              </View>
            </View>
          )}
        </View>

        {/* Core Interactive Daily Ritual Loop */}
        <DailyRitualView
          streak={clockInState.streak}
          skrBalance={displaySkr}
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
          onStateTrigger={(stateType, err) => {
            setCustomError(err);
            setSystemState(stateType);
          }}
        />

        {/* Free Spreads Allowance Bar */}
        <View style={styles.quotaRow}>
          <View style={[styles.quotaPill, !clockInState.isSeekerHolder && styles.quotaPillLocked]}>
            <Text style={[styles.quotaText, !clockInState.isSeekerHolder && styles.quotaTextLocked]}>
              {clockInState.isSeekerHolder
                ? t('free_spreads_today', '{rem}/{max} FREE SPREADS TODAY', {
                    rem: clockInState.freeSpreadsRemaining ?? 3,
                    max: clockInState.freeSpreadsMax ?? 3,
                  })
                : t('seeker_exclusive_spreads', 'SEEKER GENESIS EXCLUSIVE \u00B7 0 FREE')}
            </Text>
          </View>
          <Text style={styles.quotaSub}>
            {clockInState.isSeekerHolder
              ? t('extra_spreads_skr', 'Extra spreads: 5 SKR')
              : t('spreads_fee_note', 'Offer 5 SKR or 0.001 SOL per reading')}
          </Text>
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
                  <Text style={styles.shareTwitterIcon}>X</Text>
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
        customError={customError}
        onClose={() => {
          setSystemState(null);
          setCustomError(undefined);
        }}
        onActionPrimary={() => {
          setSystemState(null);
          setCustomError(undefined);
          if (systemState === "wallet_declined") {
            handleConnect();
          }
        }}
        onActionSecondary={() => {
          setSystemState(null);
          setCustomError(undefined);
        }}
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
    gap: 8,
  },
  brandLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    flexShrink: 1,
  },
  headerLogo: {
    width: 38,
    height: 38,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: ObsidianTokens.colors.gold.subtle,
  },
  headerKicker: {
    fontFamily: Platform.select({ ios: "SpaceMono", android: "SpaceMono", default: "monospace" }),
    color: ObsidianTokens.colors.gold.primary,
    fontSize: 9.5,
    letterSpacing: 1.5,
  },
  headerTitle: {
    fontFamily: Platform.select({ ios: "Georgia", android: "serif", default: "serif" }),
    color: ObsidianTokens.colors.ink.text,
    fontSize: 26,
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
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 12,
    flexShrink: 0,
  },
  connectHeaderBtnText: {
    fontFamily: Platform.select({ ios: "SpaceMono", android: "SpaceMono", default: "monospace" }),
    color: ObsidianTokens.colors.gold.primary,
    fontSize: 9.5,
    letterSpacing: 0.8,
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
    flexWrap: "wrap",
    gap: 8,
    marginBottom: 26,
    paddingHorizontal: 4,
  },
  quotaPill: {
    paddingVertical: 5,
    paddingHorizontal: 10,
    borderRadius: 999,
    backgroundColor: ObsidianTokens.colors.ink.fill,
    borderWidth: 1,
    borderColor: ObsidianTokens.colors.ink.hairline,
  },
  quotaText: {
    fontFamily: Platform.select({ ios: "SpaceMono", android: "SpaceMono", default: "monospace" }),
    color: ObsidianTokens.colors.ink.text55,
    fontSize: 8.5,
    letterSpacing: 0.8,
  },
  quotaPillLocked: {
    borderColor: ObsidianTokens.colors.gold.subtle,
    backgroundColor: ObsidianTokens.colors.ink.surface,
  },
  quotaTextLocked: {
    color: ObsidianTokens.colors.gold.primary,
  },
  quotaSub: {
    fontFamily: Platform.select({ ios: "SpaceMono", android: "SpaceMono", default: "monospace" }),
    color: ObsidianTokens.colors.ink.text42,
    fontSize: 9.5,
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
