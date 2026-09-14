import React, { useState, useEffect } from "react";
import {
  StyleSheet,
  View,
  Text,
  ScrollView,
  Pressable,
  ActivityIndicator,
  Platform,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import Clipboard from "@react-native-clipboard/clipboard";
import * as Haptics from "expo-haptics";
import { useAuth } from "@/components/auth/auth-provider";
import { fetchClockInStatus, ClockInResult } from "@/services/oracleApi";
import { ellipsify } from "@/utils/ellipsify";
import { showError } from "@/utils/show-error";
import { ObsidianTokens } from "@/constants/theme";
import { SystemStateModal, SystemStateType } from "@/components/ui/SystemStateModal";

export default function WalletScreen() {
  const { account, isAuthenticated, signIn, signOut } = useAuth();
  const address = account?.publicKey?.toString() || "";
  const [isConnecting, setIsConnecting] = useState(false);
  const [systemState, setSystemState] = useState<SystemStateType>(null);

  const [clockInState, setClockInState] = useState<ClockInResult>({
    canClockIn: true,
    streak: 1,
    lastClockIn: null,
    totalReadings: 1,
    skrBalance: 100,
    isSeekerHolder: true,
  });

  const [copied, setCopied] = useState(false);

  useEffect(() => {
    const targetAddress = address || "SeekerDemoWallet1111111111111111111";
    fetchClockInStatus(targetAddress).then(setClockInState);
  }, [address]);

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
    } catch (e) {
      console.warn("Sign out error:", e);
    }
  };

  return (
    <SafeAreaView style={styles.container} edges={["top", "left", "right"]}>
      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        {/* Obsidian Header */}
        <View style={styles.header}>
          <Text style={styles.headerKicker}>ME · IDENTITY & RECORD</Text>
          <Text style={styles.headerTitle}>seeker.sol</Text>
          <Text style={styles.headerSub}>
            On-chain proof of your rites, seed vault status, and oracle fuel.
          </Text>
        </View>

        {isAuthenticated ? (
          <>
            {/* Account Identity Card */}
            <View style={styles.walletCard}>
              <View style={styles.walletCardHeader}>
                <View style={styles.seekerBadge}>
                  <Text style={styles.seekerBadgeText}>SEEKER GENESIS HOLDER</Text>
                </View>
                <View style={styles.statusDotRow}>
                  <View style={styles.liveDot} />
                  <Text style={styles.statusText}>Connected</Text>
                </View>
              </View>

              <Text style={styles.addressLabel}>CONNECTED PUBLIC KEY</Text>
              <Pressable style={styles.addressBox} onPress={copyAddress}>
                <Text style={styles.addressText}>{ellipsify(address, 8)}</Text>
                <Text style={styles.copyText}>{copied ? "COPIED" : "COPY"}</Text>
              </Pressable>

              {/* Seed Vault Notice */}
              <View style={styles.seedVaultBox}>
                <Text style={styles.seedVaultIcon}>🛡</Text>
                <Text style={styles.seedVaultText}>
                  Protected by Solana Mobile Seed Vault. Your private keys never leave the hardware enclave.
                </Text>
              </View>
            </View>

            {/* Assets Row */}
            <View style={styles.row}>
              {/* SOL Card */}
              <View style={styles.assetCard}>
                <Text style={styles.assetLabel}>SOL BALANCE</Text>
                <Text style={styles.assetValue}>1.45 SOL</Text>
                <Text style={styles.assetSub}>Gas & Minting</Text>
              </View>

              {/* SKR Card */}
              <View style={[styles.assetCard, styles.skrCard]}>
                <Text style={styles.assetLabel}>SKR BALANCE</Text>
                <Text style={[styles.assetValue, { color: ObsidianTokens.colors.gold.primary }]}>
                  {clockInState.skrBalance} SKR
                </Text>
                <Text style={styles.assetSub}>Seeker Oracle Fuel</Text>
              </View>
            </View>

            {/* Clock In Stats */}
            <View style={styles.statsCard}>
              <Text style={styles.statsTitle}>CLOCK-IN REPUTATION</Text>

              <View style={styles.statsRow}>
                <View style={styles.statItem}>
                  <Text style={styles.statValue}>✦ {clockInState.streak}</Text>
                  <Text style={styles.statLabel}>Day Streak</Text>
                </View>
                <View style={styles.statDivider} />
                <View style={styles.statItem}>
                  <Text style={styles.statValue}>◈ {clockInState.totalReadings}</Text>
                  <Text style={styles.statLabel}>Rites Sealed</Text>
                </View>
                <View style={styles.statDivider} />
                <View style={styles.statItem}>
                  <Text style={styles.statValue}>100%</Text>
                  <Text style={styles.statLabel}>Consensus Rate</Text>
                </View>
              </View>
            </View>

            {/* Membership / Order Box */}
            <View style={styles.membershipCard}>
              <View>
                <Text style={styles.membershipTitle}>Join the Order</Text>
                <Text style={styles.membershipSub}>Unlimited asks · Unbroken record · 0.045 SOL/mo or 15 SKR</Text>
              </View>
              <Text style={styles.membershipArrow}>→</Text>
            </View>

            {/* Action Buttons */}
            <Pressable
              style={({ pressed }) => [styles.disconnectBtn, pressed && styles.btnPressed]}
              onPress={handleDisconnect}
            >
              <Text style={styles.disconnectText}>DISCONNECT WALLET</Text>
            </Pressable>
          </>
        ) : (
          <>
            {/* Disconnected Hero Card */}
            <View style={styles.disconnectedCard}>
              <View style={styles.disconnectedBadgeRow}>
                <View style={styles.disconnectedBadge}>
                  <Text style={styles.disconnectedBadgeText}>SOLANA MOBILE ADAPTER</Text>
                </View>
                <View style={styles.statusDotRow}>
                  <View style={[styles.liveDot, { backgroundColor: ObsidianTokens.colors.ink.text42 }]} />
                  <Text style={styles.statusText}>Not Connected</Text>
                </View>
              </View>

              <Text style={styles.disconnectedTitle}>Connect Your Wallet</Text>
              <Text style={styles.disconnectedDesc}>
                Connect with Seeker Seed Vault or any Solana Mobile wallet to persist your oracle streaks, verify on-chain readings, and manage your SKR balance.
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
                  <Text style={styles.connectMainBtnText}>CONNECT WALLET (MWA)</Text>
                )}
              </Pressable>
            </View>

            {/* Feature & Security Cards */}
            <View style={styles.featureBox}>
              <Text style={styles.featureIcon}>🛡</Text>
              <View style={styles.featureContent}>
                <Text style={styles.featureTitle}>Seed Vault Enclave</Text>
                <Text style={styles.featureDesc}>
                  Hardware-isolated security for Solana Mobile Seeker. Seed phrases never touch Android memory.
                </Text>
              </View>
            </View>

            <View style={styles.featureBox}>
              <Text style={styles.featureIcon}>✦</Text>
              <View style={styles.featureContent}>
                <Text style={styles.featureTitle}>Daily Block Consensus</Text>
                <Text style={styles.featureDesc}>
                  Validate daily block consensus on the Altar to refill your daily readings allowance without spending SKR.
                </Text>
              </View>
            </View>

            <View style={styles.featureBox}>
              <Text style={styles.featureIcon}>◈</Text>
              <View style={styles.featureContent}>
                <Text style={styles.featureTitle}>78 Solana Archetypes</Text>
                <Text style={styles.featureDesc}>
                  Full collection of 78 crypto-tarot arcana reflecting decentralized market cycles.
                </Text>
              </View>
            </View>
          </>
        )}
      </ScrollView>

      <SystemStateModal
        type={systemState}
        visible={!!systemState}
        onClose={() => setSystemState(null)}
        onActionPrimary={handleConnect}
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
  seekerBadgeText: {
    fontFamily: Platform.select({ ios: "SpaceMono", android: "SpaceMono", default: "monospace" }),
    color: ObsidianTokens.colors.gold.primary,
    fontSize: 8,
    letterSpacing: 1.5,
    fontWeight: "600",
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
  },
  statDivider: {
    width: 1,
    height: 32,
    backgroundColor: ObsidianTokens.colors.ink.hairline,
  },
  membershipCard: {
    backgroundColor: ObsidianTokens.colors.gold.surface,
    borderColor: ObsidianTokens.colors.gold.muted,
    borderWidth: 1,
    borderRadius: ObsidianTokens.radii.panels,
    padding: 16,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 16,
  },
  membershipTitle: {
    fontFamily: Platform.select({ ios: "Georgia", android: "serif", default: "serif" }),
    color: ObsidianTokens.colors.ink.text,
    fontSize: 17,
  },
  membershipSub: {
    fontFamily: Platform.select({ ios: "SpaceMono", android: "SpaceMono", default: "monospace" }),
    color: ObsidianTokens.colors.gold.primary,
    fontSize: 9,
    marginTop: 4,
  },
  membershipArrow: {
    color: ObsidianTokens.colors.gold.primary,
    fontSize: 20,
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
});
