import React, { useState, useEffect } from 'react';
import {
  StyleSheet,
  View,
  Text,
  ScrollView,
  Pressable,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Clipboard from '@react-native-clipboard/clipboard';
import * as Haptics from 'expo-haptics';
import { useAuth } from '@/components/auth/auth-provider';
import { fetchClockInStatus, ClockInResult } from '@/services/oracleApi';
import { ellipsify } from '@/utils/ellipsify';

export default function WalletScreen() {
  const { account, signOut } = useAuth();
  const address = account?.publicKey?.toString() || 'Seeker1111111111111111111111111111111111111';

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
    fetchClockInStatus(address).then(setClockInState);
  }, [address]);

  const copyAddress = () => {
    Clipboard.setString(address);
    setCopied(true);
    try {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } catch {}
    setTimeout(() => setCopied(false), 2000);
  };

  const handleDisconnect = async () => {
    try {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      await signOut();
    } catch (e) {
      console.warn('Sign out error:', e);
    }
  };

  return (
    <SafeAreaView style={styles.container} edges={['top', 'left', 'right']}>
      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.headerKicker}>SOLANA MOBILE STACK</Text>
          <Text style={styles.headerTitle}>Seeker & SKR</Text>
        </View>

        {/* Account Identity Card */}
        <View style={styles.walletCard}>
          <View style={styles.walletCardHeader}>
            <View style={styles.seekerBadge}>
              <Text style={styles.seekerBadgeText}>SEEKER GENESIS HOLDER</Text>
            </View>
            <View style={styles.statusDotRow}>
              <View style={styles.liveDot} />
              <Text style={styles.statusText}>Devnet</Text>
            </View>
          </View>

          <Text style={styles.addressLabel}>CONNECTED PUBLIC KEY</Text>
          <Pressable style={styles.addressBox} onPress={copyAddress}>
            <Text style={styles.addressText}>{ellipsify(address, 8)}</Text>
            <Text style={styles.copyText}>{copied ? 'COPIED!' : 'COPY'}</Text>
          </Pressable>

          {/* Seed Vault Notice */}
          <View style={styles.seedVaultBox}>
            <Text style={styles.seedVaultIcon}>🛡️</Text>
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
            <Text style={[styles.assetValue, { color: '#F5D061' }]}>
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
              <Text style={styles.statValue}>🔥 {clockInState.streak}</Text>
              <Text style={styles.statLabel}>Day Streak</Text>
            </View>
            <View style={styles.statDivider} />
            <View style={styles.statItem}>
              <Text style={styles.statValue}>📜 {clockInState.totalReadings}</Text>
              <Text style={styles.statLabel}>Blocks Verified</Text>
            </View>
            <View style={styles.statDivider} />
            <View style={styles.statItem}>
              <Text style={styles.statValue}>⚡ 100%</Text>
              <Text style={styles.statLabel}>Consensus Rate</Text>
            </View>
          </View>
        </View>

        {/* Action Buttons */}
        <Pressable
          style={({ pressed }) => [styles.disconnectBtn, pressed && styles.btnPressed]}
          onPress={handleDisconnect}
        >
          <Text style={styles.disconnectText}>DISCONNECT WALLET</Text>
        </Pressable>
      </ScrollView>
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
    paddingBottom: 40,
  },
  header: {
    marginBottom: 20,
  },
  headerKicker: {
    color: '#9945FF',
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 2,
  },
  headerTitle: {
    color: '#FFFFFF',
    fontSize: 24,
    fontWeight: '900',
    letterSpacing: 1,
  },
  walletCard: {
    backgroundColor: '#121422',
    borderColor: '#9945FF',
    borderWidth: 1.5,
    borderRadius: 18,
    padding: 18,
    marginBottom: 16,
  },
  walletCardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  seekerBadge: {
    backgroundColor: '#281747',
    borderColor: '#9945FF',
    borderWidth: 1,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  seekerBadgeText: {
    color: '#14F195',
    fontSize: 9,
    fontWeight: '800',
    letterSpacing: 1,
  },
  statusDotRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  liveDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#14F195',
  },
  statusText: {
    color: '#8B949E',
    fontSize: 11,
    fontWeight: '700',
  },
  addressLabel: {
    color: '#8B949E',
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 1,
    marginBottom: 6,
  },
  addressBox: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#0B0C12',
    borderColor: '#2D325A',
    borderWidth: 1,
    borderRadius: 10,
    padding: 12,
    marginBottom: 14,
  },
  addressText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '700',
  },
  copyText: {
    color: '#14F195',
    fontSize: 11,
    fontWeight: '800',
  },
  seedVaultBox: {
    flexDirection: 'row',
    gap: 10,
    backgroundColor: '#0D1B1E',
    borderColor: '#14F19544',
    borderWidth: 1,
    borderRadius: 10,
    padding: 12,
    alignItems: 'center',
  },
  seedVaultIcon: {
    fontSize: 18,
  },
  seedVaultText: {
    color: '#A7F3D0',
    fontSize: 11,
    lineHeight: 16,
    flex: 1,
  },
  row: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 16,
  },
  assetCard: {
    flex: 1,
    backgroundColor: '#131525',
    borderColor: '#222842',
    borderWidth: 1,
    borderRadius: 14,
    padding: 14,
  },
  skrCard: {
    borderColor: '#4A3414',
    backgroundColor: '#1C160E',
  },
  assetLabel: {
    color: '#8B949E',
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 0.5,
    marginBottom: 6,
  },
  assetValue: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: '900',
  },
  assetSub: {
    color: '#6B7280',
    fontSize: 10,
    marginTop: 4,
  },
  statsCard: {
    backgroundColor: '#131525',
    borderColor: '#222842',
    borderWidth: 1,
    borderRadius: 16,
    padding: 16,
    marginBottom: 24,
  },
  statsTitle: {
    color: '#8B949E',
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 1,
    marginBottom: 14,
  },
  statsRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    alignItems: 'center',
  },
  statItem: {
    alignItems: 'center',
  },
  statValue: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '800',
  },
  statLabel: {
    color: '#6B7280',
    fontSize: 11,
    marginTop: 4,
  },
  statDivider: {
    width: 1,
    height: 30,
    backgroundColor: '#222842',
  },
  disconnectBtn: {
    backgroundColor: '#1A1118',
    borderColor: '#FF446655',
    borderWidth: 1,
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
  },
  btnPressed: {
    opacity: 0.8,
  },
  disconnectText: {
    color: '#FF4466',
    fontSize: 12,
    fontWeight: '800',
    letterSpacing: 1,
  },
});
