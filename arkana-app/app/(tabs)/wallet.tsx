import React, { useState, useEffect, useCallback } from "react";
import { useFocusEffect } from "expo-router";
import {
  StyleSheet,
  View,
  Text,
  ScrollView,
  Pressable,
  ActivityIndicator,
  Platform,
  Linking,
  Modal,
  Alert,
} from "react-native";
import { PublicKey } from "@solana/web3.js";
import { SafeAreaView } from "react-native-safe-area-context";
import AsyncStorage from "@react-native-async-storage/async-storage";
import Clipboard from "@react-native-clipboard/clipboard";
import * as Haptics from "expo-haptics";
import { useAuth } from "@/components/auth/auth-provider";
import { fetchClockInStatus, setRemoteSeekerStatus, ClockInResult } from "@/services/oracleApi";
import { ellipsify } from "@/utils/ellipsify";
import { ObsidianTokens } from "@/constants/theme";
import { SystemStateModal, SystemStateType } from "@/components/ui/SystemStateModal";
import { useLanguage } from "@/services/i18n";
import { soundService } from "@/services/soundService";
import { useMobileWallet } from "@wallet-ui/react-native-web3js";
import { fetchRealSkrBalance, fetchRealSolBalance, checkSeekerGenesisHolderOnChain } from "@/services/solanaService";
import { LinearGradient } from "expo-linear-gradient";
import { getVerifiedTreasury, executePaymentOrSwap, getLiveSolQuoteForSkr } from "@/services/treasuryService";
import { activateSubscriptionApi, API_BASE_URL } from "@/services/oracleApi";
import { BUILD_LABEL, APP_VERSION, BUILD_NUMBER, COMMIT_SHA } from "@/constants/build-info";

export default function WalletScreen() {
  const { account, isAuthenticated, signIn, signOut } = useAuth();
  const { openLanguageModal, currentOption, t } = useLanguage();
  const address = account?.publicKey?.toString() || "";
  const [isConnecting, setIsConnecting] = useState(false);
  const [systemState, setSystemState] = useState<SystemStateType>(null);
  const [isSoundMuted, setIsSoundMuted] = useState(false);
  const [realSolBalance, setRealSolBalance] = useState<number | null>(null);
  const [realSkrBalance, setRealSkrBalance] = useState<number | null>(null);
  const { connection, signAndSendTransactions } = useMobileWallet();
  const [isSubscribing, setIsSubscribing] = useState(false);
  const [subSuccessModal, setSubSuccessModal] = useState(false);
  const [subSolEstimate, setSubSolEstimate] = useState("~0.066 SOL");

  const [clockInState, setClockInState] = useState<ClockInResult>({
    canClockIn: true,
    streak: 1,
    lastClockIn: null,
    totalReadings: 1,
    skrBalance: 0,
    isSeekerHolder: false,
  });

  const [copied, setCopied] = useState(false);

  useEffect(() => {
    soundService.init().then((unmuted) => {
      setIsSoundMuted(!unmuted);
    });
  }, []);

  const handleToggleSound = async () => {
    try {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    } catch {}
    const muted = await soundService.toggleMute();
    setIsSoundMuted(muted);
  };

  useEffect(() => {
    if (account?.publicKey && address) {
      checkSeekerGenesisHolderOnChain(connection, account.publicKey)
        .then(async (isHolder) => {
          await setRemoteSeekerStatus(account.publicKey.toBase58(), isHolder);
          const status = await fetchClockInStatus(account.publicKey.toBase58(), isHolder);
          setClockInState(status);
        })
        .catch(() => {
          fetchClockInStatus(address).then(setClockInState);
        });

      Promise.all([
        fetchRealSolBalance(connection, account.publicKey),
        fetchRealSkrBalance(connection, account.publicKey),
      ]).then(([sol, skr]) => {
        setRealSolBalance(sol);
        setRealSkrBalance(skr);
      }).catch(err => {
        console.warn("Failed to fetch on-chain balances in wallet tab:", err);
      });
    } else {
      setRealSolBalance(null);
      setRealSkrBalance(null);
    }
  }, [address, account?.publicKey, connection]);

  // Refresh on-chain SOL, SKR and clock-in state whenever user navigates to Wallet tab
  useFocusEffect(
    useCallback(() => {
      if (!account?.publicKey || !address) return;
      let isMounted = true;
      try {
        const pubkeyStr = address || (account?.publicKey ? account.publicKey.toString() : "");
        const userPub = new PublicKey(pubkeyStr);
        Promise.all([
          fetchRealSolBalance(connection, userPub),
          fetchRealSkrBalance(connection, userPub),
          fetchClockInStatus(address),
        ]).then(([sol, skr, status]) => {
          if (isMounted) {
            setRealSolBalance(sol);
            setRealSkrBalance(skr);
            if (status) setClockInState(status);
          }
        }).catch(err => {
          console.warn("Failed to refresh on-chain balances on focus in wallet tab:", err);
        });
      } catch {}

      return () => {
        isMounted = false;
      };
    }, [address, account?.publicKey, connection])
  );

  const displaySkr = realSkrBalance !== null ? realSkrBalance : (clockInState.skrBalance ?? 0);

  const copyAddress = () => {
    if (!address) return;
    Clipboard.setString(address);
    setCopied(true);
    try {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } catch {}
    setTimeout(() => setCopied(false), 2000);
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

  const handleDisconnect = async () => {
    try {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      await signOut();
      try {
        await AsyncStorage.removeItem('arkana_wallet_authorization');
      } catch {}
    } catch (e) {
      console.warn("Sign out error:", e);
    }
  };

  useEffect(() => {
    getLiveSolQuoteForSkr(333).then(q => {
      setSubSolEstimate(`~${q.solAmount} SOL`);
    }).catch(() => {});
  }, []);

  const handlePurchaseSubscription = async () => {
    const userPubkeyStr = address || (account?.publicKey ? account.publicKey.toString() : "");
    const userPubkey = userPubkeyStr ? new PublicKey(userPubkeyStr) : null;

    if (!userPubkey || !signAndSendTransactions) {
      Alert.alert(
        t('wallet_required', 'Wallet Required'),
        t('connect_wallet_first', 'Please connect your Solana wallet first.')
      );
      return;
    }

    setIsSubscribing(true);
    try {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
      const treasuryPubkey = await getVerifiedTreasury(API_BASE_URL);
      const paymentResult = await executePaymentOrSwap({
        connection,
        userPublicKey: userPubkey,
        treasuryPublicKey: treasuryPubkey,
        amountSkr: 333,
        actionLabel: 'SUBSCRIPTION_PASS',
        signAndSendTransactions,
      });

      const res = await activateSubscriptionApi({
        wallet: address,
        txSignature: paymentResult.signature,
        durationDays: 30,
      });

      if (res.success) {
        setClockInState(prev => ({
          ...prev,
          isSubscribed: true,
          subscription: res.subscription,
          freeSpreadsMax: (prev.isSeekerHolder ? 3 : 0) + 5,
          freeSpreadsRemaining: (prev.freeSpreadsRemaining || 0) + 5,
        }));
        setSubSuccessModal(true);
        try {
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        } catch {}
      } else {
        throw new Error(res.error || 'Failed to activate pass on server.');
      }
    } catch (e: any) {
      console.warn('Subscription purchase error:', e);
      Alert.alert(
        t('subscription_failed_title', 'Pass Activation Incomplete'),
        e?.message || t('subscription_failed_desc', 'Transaction could not be confirmed. No funds were debited.')
      );
      try {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      } catch {}
    } finally {
      setIsSubscribing(false);
    }
  };

  return (
    <SafeAreaView style={styles.container} edges={["top", "left", "right"]}>
      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        {/* Obsidian Header */}
        <View style={styles.header}>
          <Text style={styles.headerKicker}>{t('tab_me', 'ME')} {'\u00B7'} {t('identity_and_record', 'IDENTITY & RECORD')}</Text>
          <Text style={styles.headerTitle}>seeker.sol</Text>
          <Text style={styles.headerSub}>
            {t('wallet_sub', 'On-chain proof of your rites, seed vault status, and oracle fuel.')}
          </Text>
        </View>

        {isAuthenticated ? (
          <>
            {/* Account Identity Card */}
            <View style={styles.walletCard}>
              <View style={styles.walletCardHeader}>
                <View style={[styles.seekerBadge, !clockInState.isSeekerHolder && styles.seekerBadgeStandard]}>
                  <Text style={[styles.seekerBadgeText, !clockInState.isSeekerHolder && styles.seekerBadgeTextStandard]}>
                    {clockInState.isSeekerHolder ? t('seeker_genesis_holder', 'SEEKER GENESIS HOLDER') : t('standard_wallet', 'SOLANA WALLET')}
                  </Text>
                </View>
                <View style={styles.statusDotRow}>
                  <View style={styles.liveDot} />
                  <Text style={styles.statusText}>{t('connected', 'Connected')}</Text>
                </View>
              </View>

              <Text style={styles.addressLabel}>{t('connected_pubkey', 'CONNECTED PUBLIC KEY')}</Text>
              <Pressable style={styles.addressBox} onPress={copyAddress}>
                <Text style={styles.addressText}>{ellipsify(address, 8)}</Text>
                <Text style={styles.copyText}>{copied ? t('copied', 'COPIED') : t('copy', 'COPY')}</Text>
              </Pressable>

              {/* Seed Vault Notice */}
              <View style={styles.seedVaultBox}>
                <Text style={styles.seedVaultIcon}>{'\u2756'}</Text>
                <Text style={styles.seedVaultText}>
                  {t('seed_vault_notice', 'Protected by Solana Mobile Seed Vault. Your private keys never leave the hardware enclave.')}
                </Text>
              </View>
            </View>

            {/* Assets Row */}
            <View style={styles.row}>
              {/* SOL Card */}
              <View style={styles.assetCard}>
                <Text style={styles.assetLabel}>{t('sol_balance', 'SOL BALANCE')}</Text>
                <Text style={styles.assetValue}>
                  {realSolBalance !== null ? (realSolBalance === 0 ? '0 SOL' : `${Number(realSolBalance.toFixed(4))} SOL`) : '0 SOL'}
                </Text>
                <Text style={styles.assetSub}>{t('gas_and_minting', 'Gas & Minting')}</Text>
              </View>

              {/* SKR Card */}
              <View style={[styles.assetCard, styles.skrCard]}>
                <Text style={styles.assetLabel}>{t('skr_balance', 'SKR BALANCE')}</Text>
                <Text style={[styles.assetValue, { color: ObsidianTokens.colors.gold.primary }]}>
                  {displaySkr} SKR
                </Text>
                <Text style={styles.assetSub}>{t('seeker_oracle_fuel', 'Seeker Oracle Fuel')}</Text>
              </View>
            </View>

            {/* Clock In Stats */}
            <View style={styles.statsCard}>
              <Text style={styles.statsTitle}>{t('clockin_reputation', 'CLOCK-IN REPUTATION')}</Text>

              <View style={styles.statsRow}>
                <View style={styles.statItem}>
                  <Text style={styles.statValue}>{'\u2726'} {clockInState.streak}</Text>
                  <Text style={styles.statLabel}>{t('day_streak_label', 'Day Streak')}</Text>
                </View>
                <View style={styles.statDivider} />
                <View style={styles.statItem}>
                  <Text style={styles.statValue}>{'\u25C8'} {clockInState.totalReadings}</Text>
                  <Text style={styles.statLabel}>{t('rites_sealed', 'Rites Sealed')}</Text>
                </View>
                <View style={styles.statDivider} />
                <View style={styles.statItem}>
                  <Text style={styles.statValue}>100%</Text>
                  <Text style={styles.statLabel}>{t('consensus_rate_label', 'Consensus Rate')}</Text>
                </View>
              </View>

              <Text style={styles.statsNote}>
                {t('consensus_rate', '1 SKR per extra inquiry \u00B7 Sealed on Solana')}
              </Text>
            </View>

            {/* Streak Milestone Rewards Card */}
            <View style={styles.statsCard}>
              <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
                <Text style={styles.statsTitle}>{t('streak_rewards_title', 'STREAK MILESTONE REWARDS')}</Text>
                <View style={styles.streakBalanceBadge}>
                  <Text style={styles.streakBalanceBadgeText}>
                    {clockInState.streakBonusSpreads ?? 0} {t('free_spreads_badge', 'Spreads')}
                  </Text>
                </View>
              </View>

              <Text style={{ fontFamily: Platform.select({ ios: "SpaceMono", android: "SpaceMono", default: "monospace" }), fontSize: 10, color: ObsidianTokens.colors.ink.text55, marginBottom: 12, lineHeight: 15 }}>
                {t('streak_rewards_explanation', 'Bonus spreads are permanently credited to your account for daily ritual milestones. They never expire and are used whenever your daily free allowance is exhausted.')}
              </Text>

              <View style={styles.milestoneGrid}>
                <View style={[styles.milestoneItem, (clockInState.streak >= 7) && styles.milestoneItemActive]}>
                  <Text style={[styles.milestoneDays, (clockInState.streak >= 7) && styles.milestoneTextActive]}>7 {t('days_abbr', 'DAYS')}</Text>
                  <Text style={[styles.milestoneBonus, (clockInState.streak >= 7) && styles.milestoneTextActive]}>+1 {t('spread_singular', 'SPREAD')}</Text>
                </View>
                <View style={[styles.milestoneItem, (clockInState.streak >= 14) && styles.milestoneItemActive]}>
                  <Text style={[styles.milestoneDays, (clockInState.streak >= 14) && styles.milestoneTextActive]}>14 {t('days_abbr', 'DAYS')}</Text>
                  <Text style={[styles.milestoneBonus, (clockInState.streak >= 14) && styles.milestoneTextActive]}>+2 {t('spread_plural', 'SPREADS')}</Text>
                </View>
                <View style={[styles.milestoneItem, (clockInState.streak >= 21) && styles.milestoneItemActive]}>
                  <Text style={[styles.milestoneDays, (clockInState.streak >= 21) && styles.milestoneTextActive]}>21 {t('days_abbr', 'DAYS')}</Text>
                  <Text style={[styles.milestoneBonus, (clockInState.streak >= 21) && styles.milestoneTextActive]}>+3 {t('spread_plural', 'SPREADS')}</Text>
                </View>
                <View style={[styles.milestoneItem, (clockInState.streak >= 28) && styles.milestoneItemActive]}>
                  <Text style={[styles.milestoneDays, (clockInState.streak >= 28) && styles.milestoneTextActive]}>28+ {t('days_abbr', 'DAYS')}</Text>
                  <Text style={[styles.milestoneBonus, (clockInState.streak >= 28) && styles.milestoneTextActive]}>+5 {t('spread_plural', 'SPREADS')}</Text>
                </View>
              </View>
            </View>

            {/* Language Selection Card (Accessible when authenticated) */}
            <Pressable
              style={({ pressed }) => [styles.featureBox, styles.langBox, pressed && styles.cardPressed]}
              onPress={() => {
                try {
                  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                } catch {}
                openLanguageModal();
              }}
            >
              <Text style={styles.featureIcon}>{'\u2726'}</Text>
              <View style={styles.featureContent}>
                <Text style={styles.featureTitle}>{t('dialect_card_title', 'Sacred Dialect / Language')}</Text>
                <Text style={styles.featureDesc}>
                  {t('dialect_card_desc', 'Active: {name} \u00B7 Tap to change', { name: `${currentOption.nativeName} (${currentOption.name})` })}
                </Text>
              </View>
              <View style={styles.langPillBadge}>
                <Text style={styles.langPillText}>{currentOption.tag} {'\u2197'}</Text>
              </View>
            </Pressable>

            {/* Sound FX Toggle Card */}
            <Pressable
              style={({ pressed }) => [styles.featureBox, pressed && styles.cardPressed]}
              onPress={handleToggleSound}
            >
              <Text style={styles.featureIcon}>{isSoundMuted ? '\u25C8' : '\u2726'}</Text>
              <View style={styles.featureContent}>
                <Text style={styles.featureTitle}>{t('sound_effects_title', 'Acoustic Resonance / SFX')}</Text>
                <Text style={styles.featureDesc}>
                  {isSoundMuted
                    ? t('sound_effects_muted_desc', 'Muted - silent contemplation mode')
                    : t('sound_effects_active_desc', 'Card flips, sacred shuffles, and consensus chime active')}
                </Text>
              </View>
              <View style={[styles.soundPillBadge, isSoundMuted && styles.soundPillBadgeMuted]}>
                <Text style={[styles.soundPillText, isSoundMuted && styles.soundPillTextMuted]}>
                  {isSoundMuted ? t('sound_off', 'MUTED') : t('sound_on', 'SOUND ON')}
                </Text>
              </View>
            </Pressable>

            {/* Seeker Oracle Pass (Subscription) Card */}
            <View style={styles.subCardContainer}>
              <LinearGradient
                colors={['rgba(212, 175, 55, 0.12)', 'rgba(17, 13, 7, 0.95)']}
                style={styles.subCardGradient}
              >
                <View style={styles.subCardHeader}>
                  <View style={styles.subCardTitleCol}>
                    <View style={styles.subCardBadgeRow}>
                      <Text style={styles.subCardKicker}>SACRED COVENANT</Text>
                      <View style={[styles.subStatusBadge, clockInState.isSubscribed && styles.subStatusBadgeActive]}>
                        <Text style={[styles.subStatusText, clockInState.isSubscribed && styles.subStatusTextActive]}>
                          {clockInState.isSubscribed ? t('oracle_pass_active', 'ACTIVE PASS') : '333 SKR / MO'}
                        </Text>
                      </View>
                    </View>
                    <Text style={styles.subCardTitle}>{t('seeker_oracle_pass', 'SEEKER ORACLE PASS')}</Text>
                  </View>
                </View>

                <Text style={styles.subCardDesc}>
                  {t('oracle_pass_sub', '+5 spreads daily (8 total with Seeker SBT) \u00B7 33% Burn + 33% Treasury + 34% ORE Yield')}
                </Text>

                <View style={styles.subCardFooter}>
                  <View style={styles.subTokenomicsInfo}>
                    <Text style={styles.subTokenomicsText}>
                      {t('sub_tokenomics_split', '◈ 33% Burn · 33% Treasury · 34% ORE Yield')}
                    </Text>
                    {subSolEstimate && !clockInState.isSubscribed ? (
                      <Text style={styles.subSolEstimateText}>
                        Auto-swap: {subSolEstimate} via Jupiter DEX
                      </Text>
                    ) : null}
                  </View>

                  <Pressable
                    style={({ pressed }) => [
                      styles.subButton,
                      clockInState.isSubscribed && styles.subButtonActive,
                      pressed && !clockInState.isSubscribed && styles.btnPressed,
                      isSubscribing && styles.btnDisabled,
                    ]}
                    onPress={handlePurchaseSubscription}
                    disabled={isSubscribing || !!clockInState.isSubscribed}
                  >
                    {isSubscribing ? (
                      <ActivityIndicator color="#100C06" />
                    ) : (
                      <Text style={[styles.subButtonText, clockInState.isSubscribed && styles.subButtonTextActive]}>
                        {clockInState.isSubscribed
                          ? t('pass_active_btn', 'PASS ACTIVE \u2713')
                          : t('activate_pass_btn', 'ACTIVATE PASS (333 SKR)')}
                      </Text>
                    )}
                  </Pressable>
                </View>
              </LinearGradient>
            </View>

            {/* Action Buttons */}
            <Pressable
              style={({ pressed }) => [styles.disconnectBtn, pressed && styles.btnPressed]}
              onPress={handleDisconnect}
            >
              <Text style={styles.disconnectText}>{t('disconnect_wallet', 'DISCONNECT WALLET')}</Text>
            </Pressable>
          </>
        ) : (
          <>
            {/* Disconnected Hero Card */}
            <View style={styles.disconnectedCard}>
              <View style={styles.disconnectedBadgeRow}>
                <View style={styles.disconnectedBadge}>
                  <Text style={styles.disconnectedBadgeText}>{t('standard_wallet', 'SOLANA WALLET')}</Text>
                </View>
                <View style={styles.statusDotRow}>
                  <View style={[styles.liveDot, { backgroundColor: ObsidianTokens.colors.ink.text42 }]} />
                  <Text style={styles.statusText}>{t('not_connected', 'Not Connected')}</Text>
                </View>
              </View>

              <Text style={styles.disconnectedTitle}>{t('connect_wallet_title', 'Connect Your Wallet')}</Text>
              <Text style={styles.disconnectedDesc}>
                {t('connect_wallet_desc', 'Connect with Seeker Seed Vault or any Solana Mobile wallet to persist your oracle streaks, verify on-chain readings, and manage your SKR balance.')}
              </Text>

              <Pressable
                style={({ pressed }) => [
                  styles.connectMainBtn,
                  pressed && styles.btnPressed,
                  isConnecting && styles.btnDisabled,
                ]}
                onPress={handleConnect}
                disabled={isConnecting}
              >
                {isConnecting ? (
                  <ActivityIndicator color="#100C06" />
                ) : (
                  <Text style={styles.connectMainBtnText}>{t('connect_wallet', 'CONNECT WALLET')}</Text>
                )}
              </Pressable>

              {/* Official Wallets Quick Links */}
              <View style={styles.walletsQuickSection}>
                <Text style={styles.walletsQuickKicker}>{t('official_compatible_wallets', 'OFFICIAL COMPATIBLE WALLETS')}</Text>
                <View style={styles.walletsQuickRow}>
                  <Pressable
                    style={styles.walletQuickBadge}
                    onPress={() => Linking.openURL('https://play.google.com/store/apps/details?id=app.phantom').catch(() => {})}
                  >
                    <Text style={styles.walletQuickName}>PHANTOM</Text>
                    <Text style={styles.walletQuickStore}>{t('play_store', 'PLAY STORE')} {'\u2197'}</Text>
                  </Pressable>

                  <Pressable
                    style={styles.walletQuickBadge}
                    onPress={() => Linking.openURL('https://play.google.com/store/apps/details?id=com.solflare.mobile').catch(() => {})}
                  >
                    <Text style={styles.walletQuickName}>SOLFLARE</Text>
                    <Text style={styles.walletQuickStore}>{t('play_store', 'PLAY STORE')} {'\u2197'}</Text>
                  </Pressable>

                  <Pressable
                    style={styles.walletQuickBadge}
                    onPress={() => Linking.openURL('https://play.google.com/store/apps/details?id=com.backpack.wallet').catch(() => {})}
                  >
                    <Text style={styles.walletQuickName}>BACKPACK</Text>
                    <Text style={styles.walletQuickStore}>{t('play_store', 'PLAY STORE')} {'\u2197'}</Text>
                  </Pressable>
                </View>
              </View>
            </View>

            {/* Language Selection Card */}
            <Pressable
              style={({ pressed }) => [styles.featureBox, styles.langBox, pressed && styles.cardPressed]}
              onPress={() => {
                try {
                  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                } catch {}
                openLanguageModal();
              }}
            >
              <Text style={styles.featureIcon}>{'\u2726'}</Text>
              <View style={styles.featureContent}>
                <Text style={styles.featureTitle}>{t('dialect_card_title', 'Sacred Dialect / Language')}</Text>
                <Text style={styles.featureDesc}>
                  {t('dialect_card_desc', 'Active: {name} \u00B7 Tap to change', { name: `${currentOption.nativeName} (${currentOption.name})` })}
                </Text>
              </View>
              <View style={styles.langPillBadge}>
                <Text style={styles.langPillText}>{currentOption.tag} {'\u2197'}</Text>
              </View>
            </Pressable>

            {/* Sound FX Toggle Card */}
            <Pressable
              style={({ pressed }) => [styles.featureBox, pressed && styles.cardPressed]}
              onPress={handleToggleSound}
            >
              <Text style={styles.featureIcon}>{isSoundMuted ? '\u25C8' : '\u2726'}</Text>
              <View style={styles.featureContent}>
                <Text style={styles.featureTitle}>{t('sound_effects_title', 'Acoustic Resonance / SFX')}</Text>
                <Text style={styles.featureDesc}>
                  {isSoundMuted
                    ? t('sound_effects_muted_desc', 'Muted - silent contemplation mode')
                    : t('sound_effects_active_desc', 'Card flips, sacred shuffles, and consensus chime active')}
                </Text>
              </View>
              <View style={[styles.soundPillBadge, isSoundMuted && styles.soundPillBadgeMuted]}>
                <Text style={[styles.soundPillText, isSoundMuted && styles.soundPillTextMuted]}>
                  {isSoundMuted ? t('sound_off', 'MUTED') : t('sound_on', 'SOUND ON')}
                </Text>
              </View>
            </Pressable>

            {/* Feature & Security Cards */}
            <View style={styles.featureBox}>
              <Text style={styles.featureIcon}>&#x2756;</Text>
              <View style={styles.featureContent}>
                <Text style={styles.featureTitle}>{t('seed_vault_enclave', 'Seed Vault Enclave')}</Text>
                <Text style={styles.featureDesc}>
                  {t('seed_vault_enclave_desc', 'Hardware-isolated security for Solana Mobile Seeker. Seed phrases never touch Android memory.')}
                </Text>
              </View>
            </View>

            <View style={styles.featureBox}>
              <Text style={styles.featureIcon}>{'\u2726'}</Text>
              <View style={styles.featureContent}>
                <Text style={styles.featureTitle}>{t('daily_consensus_block_title', 'Daily Block Consensus')}</Text>
                <Text style={styles.featureDesc}>
                  {t('daily_consensus_block_desc', 'Validate daily block consensus on the Altar to refill your daily readings allowance without spending SKR.')}
                </Text>
              </View>
            </View>

            <View style={styles.featureBox}>
              <Text style={styles.featureIcon}>{'\u25C8'}</Text>
              <View style={styles.featureContent}>
                <Text style={styles.featureTitle}>{t('archetypes_title', '78 Solana Archetypes')}</Text>
                <Text style={styles.featureDesc}>
                  {t('archetypes_desc', 'Full collection of 78 crypto-tarot arcana reflecting decentralized market cycles.')}
                </Text>
              </View>
            </View>
          </>
        )}

        {/* Sacred Build Telemetry Stamp */}
        <Pressable
          style={({ pressed }) => [styles.buildStampCard, pressed && styles.cardPressed]}
          onPress={() => {
            Clipboard.setString(`Arkana ${BUILD_LABEL}`);
            try {
              Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
            } catch {}
            Alert.alert(
              "Arkana Telemetry",
              `Version: ${APP_VERSION}\nBuild Number: #${BUILD_NUMBER}\nCommit: ${COMMIT_SHA}\nEnvironment: Solana Mobile & Seeker (Mainnet)\n\nCopied to clipboard!`
            );
          }}
        >
          <View style={styles.buildStampBadge}>
            <Text style={styles.buildStampBadgeDot}>{'\u25C8'}</Text>
            <Text style={styles.buildStampBadgeText}>SOLANA MOBILE BUILD</Text>
          </View>
          <Text style={styles.buildStampTitle}>
            ARKANA {BUILD_LABEL}
          </Text>
          <Text style={styles.buildStampSubtitle}>
            Tap to view telemetry & copy build hash
          </Text>
        </Pressable>
      </ScrollView>

      <SystemStateModal
        type={systemState}
        visible={!!systemState}
        onClose={() => setSystemState(null)}
        onActionPrimary={handleConnect}
        onActionSecondary={() => setSystemState(null)}
      />

      {/* Subscription Success Modal */}
      <Modal
        visible={subSuccessModal}
        transparent
        animationType="fade"
        onRequestClose={() => setSubSuccessModal(false)}
      >
        <View style={styles.modalBackdrop}>
          <View style={styles.subSuccessCard}>
            <View style={styles.subSuccessGlow}>
              <Text style={styles.subSuccessGlowIcon}>{'\u2726'}</Text>
            </View>
            <Text style={styles.subSuccessTitle}>{t('pass_consecrated_title', 'ORACLE PASS CONSECRATED')}</Text>
            <Text style={styles.subSuccessDesc}>
              {t('pass_consecrated_desc', 'Your covenant is sealed on Solana. 333 SKR accepted (50% burned, 50% to Treasury). You now have +5 sacred spreads every day.')}
            </Text>
            <View style={styles.subSuccessPill}>
              <Text style={styles.subSuccessPillText}>{'\u2713'} 30 DAYS ACTIVE</Text>
            </View>
            <Pressable
              style={({ pressed }) => [styles.subSuccessCloseBtn, pressed && styles.btnPressed]}
              onPress={() => {
                try {
                  Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
                } catch {}
                setSubSuccessModal(false);
              }}
            >
              <Text style={styles.subSuccessCloseBtnText}>{t('continue_ritual', 'CONTINUE RITUAL')}</Text>
            </Pressable>
          </View>
        </View>
      </Modal>
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
    paddingTop: Platform.select({ ios: 12, android: 18, default: 12 }),
    paddingBottom: 110,
  },
  header: {
    marginBottom: 20,
    marginTop: Platform.select({ android: 4, default: 0 }),
  },
  headerKicker: {
    fontFamily: Platform.select({ ios: "SpaceMono", android: "SpaceMono", default: "monospace" }),
    color: ObsidianTokens.colors.gold.primary,
    fontSize: 9,
    letterSpacing: 2,
  },
  headerTitle: {
    fontFamily: Platform.select({ ios: "Georgia", android: "serif", default: "serif" }),
    color: ObsidianTokens.colors.ink.text,
    fontSize: 26,
    fontWeight: "300",
    letterSpacing: 1,
    marginTop: 2,
  },
  headerSub: {
    fontFamily: Platform.select({ ios: "Georgia", android: "serif", default: "serif" }),
    color: ObsidianTokens.colors.ink.text55,
    fontSize: 13,
    marginTop: 4,
  },
  walletCard: {
    backgroundColor: ObsidianTokens.colors.ink.surface,
    borderColor: ObsidianTokens.colors.gold.subtle,
    borderWidth: 1,
    borderRadius: ObsidianTokens.radii.panels,
    padding: 18,
    marginBottom: 16,
  },
  walletCardHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 16,
  },
  seekerBadge: {
    backgroundColor: ObsidianTokens.colors.gold.surface,
    borderColor: ObsidianTokens.colors.gold.muted,
    borderWidth: 1,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 999,
  },
  seekerBadgeStandard: {
    backgroundColor: "rgba(255, 255, 255, 0.05)",
    borderColor: "rgba(255, 255, 255, 0.15)",
  },
  seekerBadgeText: {
    fontFamily: Platform.select({ ios: "SpaceMono", android: "SpaceMono", default: "monospace" }),
    color: ObsidianTokens.colors.gold.primary,
    fontSize: 8,
    letterSpacing: 1.5,
    fontWeight: "600",
  },
  seekerBadgeTextStandard: {
    color: ObsidianTokens.colors.ink.text55,
  },
  statusDotRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  liveDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: ObsidianTokens.colors.state.gain,
  },
  statusText: {
    fontFamily: Platform.select({ ios: "SpaceMono", android: "SpaceMono", default: "monospace" }),
    color: ObsidianTokens.colors.ink.text55,
    fontSize: 9,
  },
  addressLabel: {
    fontFamily: Platform.select({ ios: "SpaceMono", android: "SpaceMono", default: "monospace" }),
    color: ObsidianTokens.colors.ink.text42,
    fontSize: 9,
    letterSpacing: 1.2,
    marginBottom: 8,
  },
  addressBox: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    backgroundColor: ObsidianTokens.colors.ink.fill,
    borderColor: ObsidianTokens.colors.ink.hairline,
    borderWidth: 1,
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderRadius: 12,
    marginBottom: 14,
  },
  addressText: {
    fontFamily: Platform.select({ ios: "SpaceMono", android: "SpaceMono", default: "monospace" }),
    color: ObsidianTokens.colors.ink.text,
    fontSize: 12,
  },
  copyText: {
    fontFamily: Platform.select({ ios: "SpaceMono", android: "SpaceMono", default: "monospace" }),
    color: ObsidianTokens.colors.gold.primary,
    fontSize: 10,
    letterSpacing: 1.2,
    fontWeight: "600",
  },
  seedVaultBox: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    backgroundColor: ObsidianTokens.colors.ink.fill,
    borderColor: ObsidianTokens.colors.ink.hairline,
    borderWidth: 1,
    padding: 12,
    borderRadius: 12,
  },
  seedVaultIcon: {
    fontSize: 14,
  },
  seedVaultText: {
    flex: 1,
    fontFamily: Platform.select({ ios: "Georgia", android: "serif", default: "serif" }),
    color: ObsidianTokens.colors.ink.text55,
    fontSize: 12,
    lineHeight: 16,
  },
  row: {
    flexDirection: "row",
    gap: 12,
    marginBottom: 16,
  },
  assetCard: {
    flex: 1,
    backgroundColor: ObsidianTokens.colors.ink.surface,
    borderColor: ObsidianTokens.colors.ink.hairline,
    borderWidth: 1,
    borderRadius: ObsidianTokens.radii.panels,
    padding: 16,
  },
  skrCard: {
    borderColor: ObsidianTokens.colors.gold.subtle,
  },
  assetLabel: {
    fontFamily: Platform.select({ ios: "SpaceMono", android: "SpaceMono", default: "monospace" }),
    color: ObsidianTokens.colors.gold.primary,
    fontSize: 9,
    letterSpacing: 1.2,
    marginBottom: 6,
  },
  assetValue: {
    fontFamily: Platform.select({ ios: "SpaceMono", android: "SpaceMono", default: "monospace" }),
    color: ObsidianTokens.colors.ink.text,
    fontSize: 18,
    fontWeight: "600",
  },
  assetSub: {
    fontFamily: Platform.select({ ios: "Georgia", android: "serif", default: "serif" }),
    color: ObsidianTokens.colors.ink.text42,
    fontSize: 11,
    marginTop: 4,
  },
  statsCard: {
    backgroundColor: ObsidianTokens.colors.ink.surface,
    borderColor: ObsidianTokens.colors.ink.hairline,
    borderWidth: 1,
    borderRadius: ObsidianTokens.radii.panels,
    padding: 18,
    marginBottom: 16,
  },
  statsTitle: {
    fontFamily: Platform.select({ ios: "SpaceMono", android: "SpaceMono", default: "monospace" }),
    color: ObsidianTokens.colors.gold.primary,
    fontSize: 9,
    letterSpacing: 1.5,
    marginBottom: 14,
  },
  statsRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  statItem: {
    flex: 1,
    alignItems: "center",
  },
  statValue: {
    fontFamily: Platform.select({ ios: "SpaceMono", android: "SpaceMono", default: "monospace" }),
    color: ObsidianTokens.colors.ink.text,
    fontSize: 14,
    fontWeight: "600",
    marginBottom: 4,
  },
  statLabel: {
    fontFamily: Platform.select({ ios: "Georgia", android: "serif", default: "serif" }),
    color: ObsidianTokens.colors.ink.text42,
    fontSize: 11,
    textAlign: "center",
  },
  statsNote: {
    fontFamily: Platform.select({ ios: "SpaceMono", android: "SpaceMono", default: "monospace" }),
    color: ObsidianTokens.colors.ink.text42,
    fontSize: 9.5,
    lineHeight: 14,
    letterSpacing: 0.5,
    marginTop: 14,
    textAlign: "center",
  },
  streakBalanceBadge: {
    paddingVertical: 3,
    paddingHorizontal: 8,
    borderRadius: 999,
    backgroundColor: "rgba(212, 163, 89, 0.15)",
    borderWidth: 1,
    borderColor: ObsidianTokens.colors.gold.primary,
  },
  streakBalanceBadgeText: {
    fontFamily: Platform.select({ ios: "SpaceMono", android: "SpaceMono", default: "monospace" }),
    color: ObsidianTokens.colors.gold.primary,
    fontSize: 9,
    fontWeight: "700",
  },
  milestoneGrid: {
    flexDirection: "row",
    justifyContent: "space-between",
    gap: 6,
  },
  milestoneItem: {
    flex: 1,
    alignItems: "center",
    paddingVertical: 8,
    paddingHorizontal: 4,
    borderRadius: 8,
    backgroundColor: ObsidianTokens.colors.ink.fill,
    borderWidth: 1,
    borderColor: ObsidianTokens.colors.ink.hairline,
  },
  milestoneItemActive: {
    borderColor: ObsidianTokens.colors.gold.primary,
    backgroundColor: "rgba(212, 163, 89, 0.08)",
  },
  milestoneDays: {
    fontFamily: Platform.select({ ios: "SpaceMono", android: "SpaceMono", default: "monospace" }),
    fontSize: 8.5,
    color: ObsidianTokens.colors.ink.text42,
    marginBottom: 2,
  },
  milestoneBonus: {
    fontFamily: Platform.select({ ios: "SpaceMono", android: "SpaceMono", default: "monospace" }),
    fontSize: 9,
    fontWeight: "700",
    color: ObsidianTokens.colors.ink.text55,
  },
  milestoneTextActive: {
    color: ObsidianTokens.colors.gold.primary,
  },
  statDivider: {
    width: 1,
    height: 32,
    backgroundColor: ObsidianTokens.colors.ink.hairline,
  },
  subCardContainer: {
    marginBottom: 16,
    borderRadius: ObsidianTokens.radii.panels,
    borderWidth: 1,
    borderColor: ObsidianTokens.colors.gold.subtle,
    overflow: "hidden",
  },
  subCardGradient: {
    padding: 18,
  },
  subCardHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    marginBottom: 8,
  },
  subCardTitleCol: {
    flex: 1,
  },
  subCardBadgeRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 6,
  },
  subCardKicker: {
    fontFamily: Platform.select({ ios: "SpaceMono", android: "SpaceMono", default: "monospace" }),
    color: ObsidianTokens.colors.gold.primary,
    fontSize: 9,
    letterSpacing: 2,
    fontWeight: "600",
  },
  subStatusBadge: {
    backgroundColor: ObsidianTokens.colors.ink.fill,
    borderColor: ObsidianTokens.colors.gold.subtle,
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  subStatusBadgeActive: {
    backgroundColor: ObsidianTokens.colors.gold.surface,
    borderColor: ObsidianTokens.colors.gold.primary,
  },
  subStatusText: {
    fontFamily: Platform.select({ ios: "SpaceMono", android: "SpaceMono", default: "monospace" }),
    color: ObsidianTokens.colors.gold.primary,
    fontSize: 9,
    fontWeight: "700",
    letterSpacing: 1,
  },
  subStatusTextActive: {
    color: ObsidianTokens.colors.gold.primary,
  },
  subCardTitle: {
    fontFamily: Platform.select({ ios: "Georgia", android: "serif", default: "serif" }),
    color: ObsidianTokens.colors.ink.text,
    fontSize: 20,
    letterSpacing: 0.5,
  },
  subCardDesc: {
    fontFamily: Platform.select({ ios: "Georgia", android: "serif", default: "serif" }),
    color: ObsidianTokens.colors.ink.text55,
    fontSize: 13,
    lineHeight: 18,
    marginBottom: 16,
  },
  subCardFooter: {
    gap: 12,
  },
  subTokenomicsInfo: {
    backgroundColor: "rgba(0, 0, 0, 0.3)",
    borderRadius: 8,
    padding: 10,
    borderWidth: 1,
    borderColor: "rgba(212, 175, 55, 0.15)",
  },
  subTokenomicsText: {
    fontFamily: Platform.select({ ios: "SpaceMono", android: "SpaceMono", default: "monospace" }),
    color: ObsidianTokens.colors.gold.primary,
    fontSize: 9,
    letterSpacing: 0.5,
  },
  subSolEstimateText: {
    fontFamily: Platform.select({ ios: "SpaceMono", android: "SpaceMono", default: "monospace" }),
    color: ObsidianTokens.colors.ink.text42,
    fontSize: 8,
    marginTop: 4,
    letterSpacing: 0.5,
  },
  subButton: {
    backgroundColor: ObsidianTokens.colors.gold.primary,
    borderRadius: 10,
    paddingVertical: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  subButtonActive: {
    backgroundColor: ObsidianTokens.colors.ink.fill,
    borderWidth: 1,
    borderColor: ObsidianTokens.colors.gold.subtle,
  },
  subButtonText: {
    fontFamily: Platform.select({ ios: "SpaceMono", android: "SpaceMono", default: "monospace" }),
    color: "#100C06",
    fontSize: 10,
    fontWeight: "700",
    letterSpacing: 1.5,
  },
  subButtonTextActive: {
    color: ObsidianTokens.colors.gold.primary,
  },
  modalBackdrop: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.85)",
    justifyContent: "center",
    alignItems: "center",
    padding: 24,
  },
  subSuccessCard: {
    width: "100%",
    backgroundColor: ObsidianTokens.colors.ink.surface,
    borderColor: ObsidianTokens.colors.gold.primary,
    borderWidth: 1,
    borderRadius: ObsidianTokens.radii.panels,
    padding: 24,
    alignItems: "center",
  },
  subSuccessGlow: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: ObsidianTokens.colors.gold.surface,
    borderColor: ObsidianTokens.colors.gold.primary,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 16,
  },
  subSuccessGlowIcon: {
    color: ObsidianTokens.colors.gold.primary,
    fontSize: 24,
  },
  subSuccessTitle: {
    fontFamily: Platform.select({ ios: "Georgia", android: "serif", default: "serif" }),
    color: ObsidianTokens.colors.ink.text,
    fontSize: 20,
    textAlign: "center",
    marginBottom: 8,
  },
  subSuccessDesc: {
    fontFamily: Platform.select({ ios: "Georgia", android: "serif", default: "serif" }),
    color: ObsidianTokens.colors.ink.text55,
    fontSize: 13,
    lineHeight: 18,
    textAlign: "center",
    marginBottom: 16,
  },
  subSuccessPill: {
    backgroundColor: ObsidianTokens.colors.gold.surface,
    borderColor: ObsidianTokens.colors.gold.muted,
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 6,
    marginBottom: 20,
  },
  subSuccessPillText: {
    fontFamily: Platform.select({ ios: "SpaceMono", android: "SpaceMono", default: "monospace" }),
    color: ObsidianTokens.colors.gold.primary,
    fontSize: 10,
    fontWeight: "700",
    letterSpacing: 1,
  },
  subSuccessCloseBtn: {
    width: "100%",
    backgroundColor: ObsidianTokens.colors.gold.primary,
    borderRadius: 10,
    paddingVertical: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  subSuccessCloseBtnText: {
    fontFamily: Platform.select({ ios: "SpaceMono", android: "SpaceMono", default: "monospace" }),
    color: "#100C06",
    fontSize: 11,
    fontWeight: "700",
    letterSpacing: 1.5,
  },
  disconnectBtn: {
    borderWidth: 1,
    borderColor: ObsidianTokens.colors.ink.hairline,
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: "center",
  },
  disconnectText: {
    fontFamily: Platform.select({ ios: "SpaceMono", android: "SpaceMono", default: "monospace" }),
    color: ObsidianTokens.colors.ink.text42,
    fontSize: 10,
    letterSpacing: 1.5,
  },
  disconnectedCard: {
    backgroundColor: ObsidianTokens.colors.ink.surface,
    borderColor: ObsidianTokens.colors.gold.subtle,
    borderWidth: 1,
    borderRadius: ObsidianTokens.radii.panels,
    padding: 22,
    marginBottom: 16,
  },
  disconnectedBadgeRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 16,
  },
  disconnectedBadge: {
    backgroundColor: ObsidianTokens.colors.ink.fill,
    borderColor: ObsidianTokens.colors.ink.hairline,
    borderWidth: 1,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 999,
  },
  disconnectedBadgeText: {
    fontFamily: Platform.select({ ios: "SpaceMono", android: "SpaceMono", default: "monospace" }),
    color: ObsidianTokens.colors.gold.primary,
    fontSize: 8,
    letterSpacing: 1.5,
  },
  disconnectedTitle: {
    fontFamily: Platform.select({ ios: "Georgia", android: "serif", default: "serif" }),
    color: ObsidianTokens.colors.ink.text,
    fontSize: 24,
    fontWeight: "300",
    marginBottom: 8,
  },
  disconnectedDesc: {
    fontFamily: Platform.select({ ios: "Georgia", android: "serif", default: "serif" }),
    color: ObsidianTokens.colors.ink.text55,
    fontSize: 13,
    lineHeight: 18,
    marginBottom: 20,
  },
  connectMainBtn: {
    backgroundColor: ObsidianTokens.colors.gold.primary,
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: "center",
    justifyContent: "center",
  },
  connectMainBtnText: {
    fontFamily: Platform.select({ ios: "SpaceMono", android: "SpaceMono", default: "monospace" }),
    color: "#100C06",
    fontSize: 11,
    letterSpacing: 1.5,
    fontWeight: "600",
  },
  featureBox: {
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
    backgroundColor: ObsidianTokens.colors.ink.surface,
    borderColor: ObsidianTokens.colors.ink.hairline,
    borderWidth: 1,
    borderRadius: 14,
    padding: 16,
    marginBottom: 12,
  },
  featureIcon: {
    fontSize: 20,
    color: ObsidianTokens.colors.gold.primary,
  },
  featureContent: {
    flex: 1,
  },
  featureTitle: {
    fontFamily: Platform.select({ ios: "Georgia", android: "serif", default: "serif" }),
    color: ObsidianTokens.colors.ink.text,
    fontSize: 16,
    marginBottom: 4,
  },
  featureDesc: {
    fontFamily: Platform.select({ ios: "Georgia", android: "serif", default: "serif" }),
    color: ObsidianTokens.colors.ink.text55,
    fontSize: 12,
    lineHeight: 16,
  },
  btnPressed: {
    transform: [{ scale: ObsidianTokens.motion.pressScale }],
  },
  btnDisabled: {
    opacity: 0.6,
  },
  walletsQuickSection: {
    marginTop: 18,
    paddingTop: 14,
    borderTopWidth: 1,
    borderTopColor: ObsidianTokens.colors.ink.hairline,
  },
  walletsQuickKicker: {
    fontFamily: Platform.select({ ios: "SpaceMono", android: "SpaceMono", default: "monospace" }),
    color: ObsidianTokens.colors.gold.primary,
    fontSize: 8,
    letterSpacing: 1.5,
    marginBottom: 8,
    textAlign: "center",
  },
  walletsQuickRow: {
    flexDirection: "row",
    gap: 8,
  },
  walletQuickBadge: {
    flex: 1,
    backgroundColor: ObsidianTokens.colors.ink.fill,
    borderColor: ObsidianTokens.colors.gold.subtle,
    borderWidth: 1,
    borderRadius: 10,
    paddingVertical: 10,
    paddingHorizontal: 6,
    alignItems: "center",
  },
  walletQuickName: {
    fontFamily: Platform.select({ ios: "SpaceMono", android: "SpaceMono", default: "monospace" }),
    color: ObsidianTokens.colors.ink.text,
    fontSize: 9,
    fontWeight: "700",
    letterSpacing: 0.8,
  },
  walletQuickStore: {
    fontFamily: Platform.select({ ios: "SpaceMono", android: "SpaceMono", default: "monospace" }),
    color: ObsidianTokens.colors.gold.primary,
    fontSize: 8,
    marginTop: 4,
    letterSpacing: 0.5,
  },
  langBox: {
    borderColor: ObsidianTokens.colors.gold.primary,
    backgroundColor: ObsidianTokens.colors.ink.surface,
  },
  langPillBadge: {
    backgroundColor: ObsidianTokens.colors.gold.surface,
    borderColor: ObsidianTokens.colors.gold.primary,
    borderWidth: 1,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    marginLeft: 8,
  },
  langPillText: {
    fontFamily: Platform.select({ ios: "SpaceMono", android: "SpaceMono", default: "monospace" }),
    color: ObsidianTokens.colors.gold.primary,
    fontSize: 9,
    fontWeight: "700",
    letterSpacing: 1,
  },
  soundPillBadge: {
    backgroundColor: ObsidianTokens.colors.gold.surface,
    borderColor: ObsidianTokens.colors.gold.primary,
    borderWidth: 1,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    marginLeft: 8,
  },
  soundPillBadgeMuted: {
    backgroundColor: ObsidianTokens.colors.ink.fill,
    borderColor: ObsidianTokens.colors.ink.hairline,
  },
  soundPillText: {
    fontFamily: Platform.select({ ios: "SpaceMono", android: "SpaceMono", default: "monospace" }),
    color: ObsidianTokens.colors.gold.primary,
    fontSize: 9,
    fontWeight: "700",
    letterSpacing: 1,
  },
  soundPillTextMuted: {
    color: ObsidianTokens.colors.ink.text42,
  },
  cardPressed: {
    transform: [{ scale: ObsidianTokens.motion.pressScale }],
  },
  buildStampCard: {
    marginTop: 24,
    marginBottom: 20,
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: ObsidianTokens.colors.gold.subtle,
    backgroundColor: ObsidianTokens.colors.ink.surface,
    alignItems: "center",
  },
  buildStampBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginBottom: 6,
  },
  buildStampBadgeDot: {
    color: ObsidianTokens.colors.gold.primary,
    fontSize: 9,
  },
  buildStampBadgeText: {
    fontFamily: Platform.select({ ios: "SpaceMono", android: "SpaceMono", default: "monospace" }),
    color: ObsidianTokens.colors.gold.primary,
    fontSize: 9,
    letterSpacing: 1.5,
    fontWeight: "700",
  },
  buildStampTitle: {
    fontFamily: Platform.select({ ios: "SpaceMono", android: "SpaceMono", default: "monospace" }),
    color: ObsidianTokens.colors.ink.text,
    fontSize: 11,
    letterSpacing: 1,
    fontWeight: "600",
  },
  buildStampSubtitle: {
    fontFamily: Platform.select({ ios: "Georgia", android: "serif", default: "serif" }),
    color: ObsidianTokens.colors.ink.text42,
    fontSize: 11,
    marginTop: 4,
  },
});
