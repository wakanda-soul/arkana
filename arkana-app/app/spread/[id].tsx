import React, { useState, useEffect } from "react";
import {
  StyleSheet,
  View,
  Text,
  ScrollView,
  Pressable,
  TextInput,
  ActivityIndicator,
  Platform,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useLocalSearchParams, useRouter } from "expo-router";
import * as Haptics from "expo-haptics";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useAuth } from "@/components/auth/auth-provider";
import { fetchReading, fetchClockInStatus, setRemoteSeekerStatus, ClockInResult, ReadingResponse, API_BASE_URL } from "@/services/oracleApi";
import { TarotCard } from "@/components/tarot/TarotCard";
import { SevenBeatsView } from "@/components/tarot/SevenBeatsView";
import { CardZoomModal, ZoomCardData } from "@/components/tarot/CardZoomModal";
import { SpreadTableView } from "@/components/tarot/SpreadTableView";
import { ShuffleCeremony } from "@/components/tarot/ShuffleCeremony";
import { SystemStateModal, SystemStateType } from "@/components/ui/SystemStateModal";
import { ObsidianTokens } from "@/constants/theme";
import { shareToTwitter, shareGeneral } from "@/utils/shareOmen";
import { unlockCards } from "@/services/codexService";
import { useLanguage } from "@/services/i18n";
import { useMobileWallet } from "@wallet-ui/react-native-web3js";
import { fetchRealSkrBalance, checkSeekerGenesisHolderOnChain } from "@/services/solanaService";
import { AltarOfferingCard } from "@/components/tarot/AltarOfferingCard";
import { getVerifiedTreasury, executePaymentOrSwap } from "@/services/treasuryService";
import { soundService } from "@/services/soundService";

export default function SpreadScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const spreadKey = id || "network-scan";

  const { account, signIn } = useAuth();
  const { language, t } = useLanguage();
  const walletAddress = account?.publicKey?.toString() || "";

  const [question, setQuestion] = useState("");
  const [hasDrawn, setHasDrawn] = useState(false);
  const [isShuffling, setIsShuffling] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [reading, setReading] = useState<ReadingResponse | null>(null);
  const [revealedMap, setRevealedMap] = useState<Record<number, boolean>>({});
  const [zoomedCard, setZoomedCard] = useState<ZoomCardData | null>(null);
  const [quotaInfo, setQuotaInfo] = useState<ClockInResult | null>(null);
  const [quotaError, setQuotaError] = useState<string | null>(null);
  const [systemState, setSystemState] = useState<SystemStateType>(null);
  const [onChainSkr, setOnChainSkr] = useState<number | null>(null);
  const { connection, signAndSendTransactions } = useMobileWallet();

  useEffect(() => {
    soundService.playPortalEnter();
  }, []);

  useEffect(() => {
    if (!walletAddress) return;
    const syncStatus = async () => {
      let isHolder = false;
      if (account?.publicKey) {
        try {
          isHolder = await checkSeekerGenesisHolderOnChain(connection, account.publicKey);
          await setRemoteSeekerStatus(walletAddress, isHolder);
        } catch {}
      }
      try {
        const info = await fetchClockInStatus(walletAddress, account?.publicKey ? isHolder : undefined);
        setQuotaInfo(info);
      } catch {}
    };
    syncStatus();
  }, [walletAddress, account?.publicKey, connection]);

  useEffect(() => {
    if (account?.publicKey) {
      fetchRealSkrBalance(connection, account.publicKey).then(val => {
        setOnChainSkr(val);
      });
    }
  }, [walletAddress, account?.publicKey, connection]);

  const handleDraw = async () => {
    setQuotaError(null);
    try {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
    } catch {}

    if (!account?.publicKey || !walletAddress) {
      try {
        setIsLoading(true);
        await signIn();
      } catch (e: any) {
        console.warn("Wallet connect in spread:", e);
      } finally {
        setIsLoading(false);
      }
      return;
    }

    const isSeeker = Boolean(quotaInfo?.isSeekerHolder);
    const dailyFree = quotaInfo?.freeSpreadsRemaining ?? 0;
    const streakBonus = quotaInfo?.streakBonusSpreads ?? 0;
    const hasFree = (dailyFree + streakBonus) > 0;
    const balance = onChainSkr !== null ? onChainSkr : 0;
    const extraCost = quotaInfo?.extraSpreadCostSkr || 5;
    const payWithSol = !hasFree && balance < extraCost;

    let txSignature: string | null = null;
    if (!hasFree) {
      if (!signAndSendTransactions) {
        setQuotaError("Wallet signing is unavailable. Please reconnect wallet.");
        return;
      }
      try {
        const treasuryPubkey = await getVerifiedTreasury(API_BASE_URL);
        const paymentResult = await executePaymentOrSwap({
          connection,
          userPublicKey: account.publicKey,
          treasuryPublicKey: treasuryPubkey,
          amountSkr: extraCost,
          actionLabel: "EXTRA_SPREAD",
          signAndSendTransactions,
        });
        txSignature = paymentResult.signature;
      } catch (payErr: any) {
        console.warn("Payment error:", payErr);
        soundService.playTxError();
        setQuotaError(payErr?.message || "Payment cancelled or dropped.");
        return;
      }
    }

    setIsShuffling(true);
    setIsLoading(true);
    soundService.playCardShuffle();
    try {
      const readingPromise = fetchReading(spreadKey, question, walletAddress, payWithSol, language, isSeeker, txSignature);
      const minShuffleWait = new Promise((resolve) => setTimeout(resolve, 1800));

      const [res] = await Promise.all([readingPromise, minShuffleWait]);

      setReading(res);
      setHasDrawn(true);
      setRevealedMap({});
      if (res.cards && res.cards.length > 0) {
        unlockCards(res.cards.map((c) => c.card_no));
      }
      if (res.quota) {
        setQuotaInfo((prev) =>
          prev
            ? {
                ...prev,
                freeSpreadsRemaining: res.quota!.remainingFree,
                streakBonusSpreads: res.quota!.streakBonusSpreads !== undefined ? res.quota!.streakBonusSpreads : prev.streakBonusSpreads,
                skrBalance: res.quota!.balance,
              }
            : null
        );
        if (walletAddress) {
          try {
            await AsyncStorage.setItem(
              `arkana_quota_${walletAddress}`,
              JSON.stringify({
                remainingFree: res.quota.remainingFree,
                streakBonusSpreads: res.quota.streakBonusSpreads,
                updatedAt: Date.now(),
              })
            );
          } catch {}
        }
      }
      soundService.playConsensusSeal();
    } catch (e: any) {
      console.warn("Draw error:", e);
      if (e.message && e.message.includes("5 SKR")) {
        setSystemState("limit_reached");
      } else {
        setQuotaError(e.message || "Failed to cast spread");
      }
      try {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      } catch {}
    } finally {
      setIsShuffling(false);
      setIsLoading(false);
    }
  };

  const handleShareX = async () => {
    if (!reading || !reading.cards || reading.cards.length === 0) return;
    try {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    } catch {}

    const firstCard = reading.cards[0];
    await shareToTwitter({
      cardName: firstCard.crypto_name,
      cardNo: firstCard.card_no,
      orientation: firstCard.orientation,
      streak: quotaInfo?.streak || 1,
      advice: firstCard.advice,
      shadow: firstCard.shadow,
      suit: firstCard.suit,
      arcana: firstCard.arcana,
      keywords: firstCard.keywords,
      classic: firstCard.classic,
      proseOmen: reading.prose?.finalOmen || firstCard.advice,
      spreadName: reading.spread_name || "Sacred Spread",
    });
  };

  const handleShareMore = async () => {
    if (!reading || !reading.cards || reading.cards.length === 0) return;
    try {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    } catch {}

    const firstCard = reading.cards[0];
    await shareGeneral({
      cardName: firstCard.crypto_name,
      cardNo: firstCard.card_no,
      orientation: firstCard.orientation,
      streak: quotaInfo?.streak || 1,
      advice: firstCard.advice,
      shadow: firstCard.shadow,
      suit: firstCard.suit,
      arcana: firstCard.arcana,
      keywords: firstCard.keywords,
      classic: firstCard.classic,
      proseOmen: reading.prose?.finalOmen || firstCard.advice,
      spreadName: reading.spread_name || "Sacred Spread",
    });
  };

  const totalCards = reading?.cards?.length || 3;
  const revealedCount = Object.values(revealedMap).filter(Boolean).length;
  const isAllRevealed = hasDrawn && revealedCount >= totalCards;

  const revealAll = () => {
    soundService.playConsensusSeal();
    const fullMap: Record<number, boolean> = {};
    for (let i = 0; i < totalCards; i++) {
      fullMap[i] = true;
    }
    setRevealedMap(fullMap);
  };

  const getSpreadTitle = () => {
    switch (spreadKey) {
      case "network-scan":
        return t("spread_network_scan", "The Network Scan");
      case "validator-cross":
        return t("spread_validator_cross", "The Validator Cross");
      case "crypto-compass":
        return t("spread_crypto_compass", "The Crypto Compass");
      default:
        return t("oracle_spread_generic", "Oracle Spread");
    }
  };

  const dailyFree = quotaInfo?.freeSpreadsRemaining ?? 0;
  const streakBonus = quotaInfo?.streakBonusSpreads ?? 0;
  const hasFreeRemaining = (dailyFree + streakBonus) > 0;
  const extraCost = quotaInfo?.extraSpreadCostSkr || 5;
  const extraCostSol = quotaInfo?.extraSpreadCostSol || 0.001;
  const balance = onChainSkr !== null ? onChainSkr : 0;
  const canAfford = true;

  return (
    <SafeAreaView style={styles.container} edges={["top", "left", "right"]}>
      {/* Obsidian Nav Bar */}
      <View style={styles.navBar}>
        <Pressable style={styles.backButton} onPress={() => router.back()}>
          <Text style={styles.backText}>{t("nav_altar", "\u2190 ALTAR")}</Text>
        </Pressable>
        <Text style={styles.navTitle}>{getSpreadTitle()}</Text>
        <View style={{ width: 60 }} />
      </View>

      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="on-drag"
      >
        {isShuffling ? (
          <View style={styles.shuffleWrapper}>
            <ShuffleCeremony
              title={t("network_is_shuffling", "The network is shuffling")}
              kicker={t("consensus_ritual", "CONSENSUS RITUAL")}
              subtitle={t("sampling_entropy", "SAMPLING VALIDATOR ENTROPY_")}
            />
          </View>
        ) : !hasDrawn ? (
          <View style={styles.inputCard}>
            <Text style={styles.inputKicker}>{t("formulate_intent_kicker", "FORMULATE YOUR INTENT")}</Text>
            <Text style={styles.inputTitle}>{t("present_question_title", "What question do you present to the ledger?")}</Text>

            <TextInput
              style={styles.textInput}
              placeholder={t("intent_placeholder", "Inscribe a question about capital allocation, execution, or conviction...")}
              placeholderTextColor={ObsidianTokens.colors.ink.text42}
              value={question}
              onChangeText={setQuestion}
              multiline
            />

            {/* Quota & Allowance Status */}
            <View style={styles.quotaBox}>
              <View style={styles.quotaRow}>
                <View style={styles.quotaBadge}>
                  <Text style={styles.quotaIcon}>{'\u2726'}</Text>
                  <Text style={styles.quotaTitle}>
                    {!walletAddress
                      ? t('connect_wallet_hint', 'Connect wallet to cast spread and seal consensus')
                      : dailyFree > 0
                      ? (streakBonus > 0
                          ? t('free_and_streak_spreads_avail', '{n} Free Spreads (+{bonus} Streak Bonus)', { n: dailyFree, bonus: streakBonus })
                          : t('free_spreads_avail', '{n} Free Spreads Available', { n: dailyFree }))
                      : streakBonus > 0
                      ? t('streak_reward_spreads_avail', '{n} Streak Reward Spreads Available', { n: streakBonus })
                      : balance >= extraCost
                      ? t('daily_allowance_reached_skr', 'Daily free allowance reached ({cost} SKR / spread)', { cost: extraCost })
                      : t('daily_allowance_reached_sol', 'Daily free allowance reached ({cost} SOL / spread)', { cost: extraCostSol })}
                  </Text>
                </View>
                {walletAddress ? (
                  <Text style={styles.balanceText}>{balance} SKR</Text>
                ) : null}
              </View>

              {walletAddress && !hasFreeRemaining && (
                <Text style={styles.warningText}>
                  {balance >= extraCost
                    ? t('exhausted_skr_desc', 'Your daily free allowance is exhausted. This casting will deduct {cost} SKR from your balance.', { cost: extraCost })
                    : t('exhausted_sol_desc', 'Your daily free allowance is exhausted and SKR balance is 0. Paying {cost} SOL.', { cost: extraCostSol })}
                </Text>
              )}
            </View>

            {quotaError && (
              <View style={styles.errorBox}>
                <Text style={styles.errorText}>{quotaError}</Text>
              </View>
            )}

            <Pressable
              style={({ pressed }) => [
                styles.drawButton,
                pressed && styles.cardPressed,
              ]}
              onPress={handleDraw}
              disabled={isLoading}
            >
              {isLoading ? (
                <ActivityIndicator color="#100C06" />
              ) : (
                <Text style={styles.drawButtonText}>
                  {!walletAddress
                    ? t('connect_wallet', 'CONNECT WALLET')
                    : hasFreeRemaining
                    ? t('cast_the_spread', 'CAST THE SPREAD')
                    : balance >= extraCost
                    ? t('cast_for_skr', 'CAST FOR {cost} SKR', { cost: extraCost })
                    : t('cast_for_sol', 'CAST FOR {cost} SOL', { cost: extraCostSol })}
                </Text>
              )}
            </Pressable>
          </View>
        ) : (
          <View style={styles.tableContainer}>
            {/* Instruction Banner */}
            {!isAllRevealed && (
              <View style={styles.instructionBanner}>
                <Text style={styles.instructionText}>
                  {t("tap_to_unveil_count", "Tap each card to unveil the archetype ({current}/{total})", { current: revealedCount, total: totalCards })}
                </Text>
                <Pressable style={styles.revealAllBtn} onPress={revealAll}>
                  <Text style={styles.revealAllText}>{t("reveal_all", "REVEAL ALL")}</Text>
                </Pressable>
              </View>
            )}

            {/* Spread Table Component */}
            {reading && reading.cards && (
              <SpreadTableView
                spreadKey={spreadKey}
                cards={reading.cards}
                revealedMap={revealedMap}
                onCardPress={(index: number) => {
                  if (!revealedMap[index]) {
                    const card = reading.cards[index];
                    const isMajor = card?.arcana === 'major' || card?.suit === 'Major Arcana';
                    if (isMajor) {
                      soundService.playMajorArcanaReveal();
                    } else {
                      soundService.playCardDeal();
                    }
                    setRevealedMap(prev => ({ ...prev, [index]: true }));
                  } else {
                    soundService.playCardFocus();
                    setZoomedCard(reading.cards[index]);
                  }
                }}
              />
            )}

            {/* Synthesis View when all cards are revealed */}
            {isAllRevealed && reading && (
              <View style={styles.readingWrap}>
                <View style={styles.divider} />
                <SevenBeatsView
                  beats={reading.prose}
                  metrics={reading.engine_metrics}
                  question={reading.question || question}
                />

                {/* Altar Offering Card: 50% Burn + 50% Treasury */}
                <AltarOfferingCard
                  walletAddress={walletAddress}
                  connection={connection}
                  signAndSendTransactions={signAndSendTransactions}
                />

                {/* Transmit / Share Section */}
                <View style={styles.shareSection}>
                  <Text style={styles.shareSectionKicker}>{t("transmit_consensus", "TRANSMIT CONSENSUS")}</Text>
                  <View style={styles.shareButtonsRow}>
                    <Pressable
                      style={({ pressed }) => [styles.shareTwitterBtn, pressed && styles.cardPressed]}
                      onPress={handleShareX}
                    >
                      <Text style={styles.shareTwitterIcon}>X</Text>
                      <Text style={styles.shareTwitterText}>{t("share_on_x", "SHARE ON X")}</Text>
                    </Pressable>

                    <Pressable
                      style={({ pressed }) => [styles.shareGeneralBtn, pressed && styles.cardPressed]}
                      onPress={handleShareMore}
                    >
                      <Text style={styles.shareGeneralIcon}>{'\u2197'}</Text>
                      <Text style={styles.shareGeneralText}>{t("share_more", "MORE")}</Text>
                    </Pressable>
                  </View>
                </View>

                {/* Reset Button */}
                <Pressable
                  style={({ pressed }) => [styles.resetButton, pressed && styles.cardPressed]}
                  onPress={() => {
                    setHasDrawn(false);
                    setIsShuffling(false);
                    setReading(null);
                  }}
                >
                  <Text style={styles.resetButtonText}>{t("cast_another_spread", "CAST ANOTHER SPREAD")}</Text>
                </Pressable>
              </View>
            )}
          </View>
        )}
      </ScrollView>

      {/* Zoom Modal */}
      <CardZoomModal
        card={zoomedCard}
        onClose={() => setZoomedCard(null)}
      />

      {/* System State Modal */}
      <SystemStateModal
        type={systemState}
        visible={!!systemState}
        onClose={() => setSystemState(null)}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: ObsidianTokens.colors.ink.void,
  },
  navBar: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: ObsidianTokens.spacing.screenGutter,
    paddingVertical: 14,
    borderBottomColor: ObsidianTokens.colors.gold.subtle,
    borderBottomWidth: 1,
  },
  backButton: {
    paddingVertical: 6,
    paddingHorizontal: 8,
  },
  backText: {
    fontFamily: Platform.select({ ios: "SpaceMono", android: "SpaceMono", default: "monospace" }),
    color: ObsidianTokens.colors.gold.primary,
    fontWeight: "600",
    fontSize: 11,
    letterSpacing: 1.2,
  },
  navTitle: {
    fontFamily: Platform.select({ ios: "Georgia", android: "serif", default: "serif" }),
    color: ObsidianTokens.colors.ink.text,
    fontWeight: "300",
    fontSize: 20,
    letterSpacing: 0.5,
  },
  scrollContent: {
    paddingHorizontal: ObsidianTokens.spacing.screenGutter,
    paddingVertical: 16,
    paddingBottom: 70,
  },
  shuffleWrapper: {
    minHeight: 400,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: ObsidianTokens.colors.ink.surface,
    borderColor: ObsidianTokens.colors.gold.subtle,
    borderWidth: 1,
    borderRadius: ObsidianTokens.radii.panels,
    padding: 20,
    marginVertical: 10,
  },
  inputCard: {
    backgroundColor: ObsidianTokens.colors.ink.surface,
    borderColor: ObsidianTokens.colors.gold.subtle,
    borderWidth: 1,
    borderRadius: ObsidianTokens.radii.panels,
    padding: 20,
    marginVertical: 10,
  },
  inputKicker: {
    fontFamily: Platform.select({ ios: "SpaceMono", android: "SpaceMono", default: "monospace" }),
    color: ObsidianTokens.colors.gold.primary,
    fontSize: 9,
    letterSpacing: 2,
    marginBottom: 6,
  },
  inputTitle: {
    fontFamily: Platform.select({ ios: "Georgia", android: "serif", default: "serif" }),
    color: ObsidianTokens.colors.ink.text,
    fontSize: 22,
    fontWeight: "300",
    lineHeight: 28,
    marginBottom: 14,
  },
  textInput: {
    backgroundColor: ObsidianTokens.colors.ink.void,
    borderColor: ObsidianTokens.colors.ink.hairline,
    borderWidth: 1,
    borderRadius: 12,
    padding: 14,
    color: ObsidianTokens.colors.ink.text,
    fontSize: 14,
    minHeight: 90,
    textAlignVertical: "top",
    marginBottom: 16,
    fontFamily: Platform.select({ ios: "Georgia", android: "serif", default: "serif" }),
  },
  quotaBox: {
    marginBottom: 12,
  },
  quotaRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: ObsidianTokens.colors.ink.fill,
    borderColor: ObsidianTokens.colors.ink.hairline,
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    marginBottom: 10,
  },
  quotaBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    flex: 1,
    marginRight: 8,
  },
  quotaIcon: {
    fontSize: 12,
    color: ObsidianTokens.colors.gold.primary,
  },
  quotaTitle: {
    fontFamily: Platform.select({ ios: "SpaceMono", android: "SpaceMono", default: "monospace" }),
    color: ObsidianTokens.colors.ink.text82,
    fontSize: 10,
    letterSpacing: 0.5,
    flexShrink: 1,
  },
  balanceText: {
    fontFamily: Platform.select({ ios: "SpaceMono", android: "SpaceMono", default: "monospace" }),
    color: ObsidianTokens.colors.gold.primary,
    fontSize: 10,
    fontWeight: "600",
    flexShrink: 0,
  },
  warningText: {
    fontFamily: Platform.select({ ios: "Georgia", android: "serif", default: "serif" }),
    color: ObsidianTokens.colors.state.loss,
    fontSize: 12,
    lineHeight: 16,
    marginBottom: 10,
  },
  errorBox: {
    backgroundColor: "rgba(201, 115, 106, 0.12)",
    borderColor: ObsidianTokens.colors.state.loss,
    borderWidth: 1,
    borderRadius: 10,
    padding: 12,
    marginBottom: 14,
  },
  errorText: {
    fontFamily: Platform.select({ ios: "SpaceMono", android: "SpaceMono", default: "monospace" }),
    color: ObsidianTokens.colors.state.loss,
    fontSize: 11,
  },
  drawButton: {
    backgroundColor: ObsidianTokens.colors.gold.primary,
    paddingVertical: 15,
    borderRadius: 12,
    alignItems: "center",
  },
  drawButtonDisabled: {
    opacity: 0.4,
  },
  drawButtonText: {
    fontFamily: Platform.select({ ios: "SpaceMono", android: "SpaceMono", default: "monospace" }),
    color: "#100C06",
    fontSize: 12,
    letterSpacing: 1.5,
    fontWeight: "600",
  },
  tableContainer: {
    marginTop: 8,
  },
  instructionBanner: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    backgroundColor: ObsidianTokens.colors.ink.surface,
    borderColor: ObsidianTokens.colors.gold.subtle,
    borderWidth: 1,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 12,
    marginBottom: 16,
  },
  instructionText: {
    fontFamily: Platform.select({ ios: "Georgia", android: "serif", default: "serif" }),
    color: ObsidianTokens.colors.ink.text82,
    fontSize: 13,
    flex: 1,
  },
  revealAllBtn: {
    backgroundColor: ObsidianTokens.colors.gold.surface,
    borderColor: ObsidianTokens.colors.gold.muted,
    borderWidth: 1,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 6,
    marginLeft: 8,
  },
  revealAllText: {
    fontFamily: Platform.select({ ios: "SpaceMono", android: "SpaceMono", default: "monospace" }),
    color: ObsidianTokens.colors.gold.primary,
    fontSize: 9,
    letterSpacing: 1,
    fontWeight: "600",
  },
  readingWrap: {
    marginTop: 16,
  },
  divider: {
    height: 1,
    backgroundColor: ObsidianTokens.colors.ink.hairline,
    marginVertical: 18,
  },
  resetButton: {
    marginTop: 16,
    backgroundColor: ObsidianTokens.colors.gold.primary,
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: "center",
  },
  resetButtonText: {
    fontFamily: Platform.select({ ios: "SpaceMono", android: "SpaceMono", default: "monospace" }),
    color: "#100C06",
    fontWeight: "600",
    fontSize: 11,
    letterSpacing: 1.5,
  },
  shareSection: {
    marginTop: 20,
    backgroundColor: ObsidianTokens.colors.ink.surface,
    borderColor: ObsidianTokens.colors.ink.hairline,
    borderWidth: 1,
    borderRadius: ObsidianTokens.radii.panels,
    padding: 16,
  },
  shareSectionKicker: {
    fontFamily: Platform.select({ ios: "SpaceMono", android: "SpaceMono", default: "monospace" }),
    color: ObsidianTokens.colors.gold.primary,
    fontSize: 9,
    letterSpacing: 2,
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
  cardPressed: {
    transform: [{ scale: ObsidianTokens.motion.pressScale }],
  },
});
