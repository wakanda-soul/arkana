import React, { useState, useEffect, useCallback } from 'react';
import {
  StyleSheet,
  View,
  Text,
  ScrollView,
  Pressable,
  ActivityIndicator,
  Platform,
  RefreshControl,
  Linking,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { PublicKey } from '@solana/web3.js';
import { useMobileWallet } from '@wallet-ui/react-native-web3js';
import { useAuth } from '@/components/auth/auth-provider';
import { useLanguage } from '@/services/i18n';
import { soundService } from '@/services/soundService';
import { UiIconSymbol } from '@/components/ui/ui-icon-symbol';
import { OreLogo } from '@/components/ui/OreLogo';
import { getNetworkConfig } from '@/constants/networkConfig';
import {
  ARKANA_VAULT_PROGRAM_ID,
  ORE_MINT_ADDRESS,
  ARKANA_TREASURY_ADDRESS,
  getUserVaultPda,
  getTranchePda,
  createClaimTrancheYieldInstruction,
  TrancheData,
  UserVaultData,
} from '@/services/oreVaultService';
import { executeSolanaTransaction } from '@/services/solanaService';

export default function OreVaultScreen() {
  const { account, isAuthenticated } = useAuth();
  const { t } = useLanguage();
  const { connection, signAndSendTransactions } = useMobileWallet();
  const walletAddress = account?.publicKey?.toString() || '';

  const [isLoading, setIsLoading] = useState(false);
  const [isClaiming, setIsClaiming] = useState(false);
  const [claimSuccess, setClaimSuccess] = useState<string | null>(null);
  const [tranches, setTranches] = useState<TrancheData[]>([]);
  const [userVault, setUserVault] = useState<UserVaultData | null>(null);

  // Load User Vault and Tranches
  const loadVaultData = useCallback(async () => {
    if (!walletAddress) {
      setTranches([]);
      setUserVault(null);
      return;
    }

    try {
      setIsLoading(true);
      const userPubkey = new PublicKey(walletAddress);
      const [userVaultPda] = getUserVaultPda(userPubkey);

      const vaultAccountInfo = await connection.getAccountInfo(userVaultPda, 'confirmed');

      if (!vaultAccountInfo || vaultAccountInfo.data.length < 56) {
        // Vault not yet initialized on-chain for this wallet
        setUserVault({
          owner: walletAddress,
          trancheCount: 0,
          totalStakedOre: 0,
          totalYieldClaimed: 0,
        });
        setTranches([]);
        return;
      }

      // Parse UserVault account data
      // Steel layout: [discriminator: 8 bytes][owner: 32 bytes][tranche_count: 4 bytes][padding: 4 bytes][total_staked: 8 bytes][total_claimed: 8 bytes]
      const data = vaultAccountInfo.data;
      const trancheCount = data.readUInt32LE(40);
      const totalStakedOre = Number(data.readBigUInt64LE(48));
      const totalYieldClaimed = Number(data.readBigUInt64LE(56));

      setUserVault({
        owner: walletAddress,
        trancheCount,
        totalStakedOre,
        totalYieldClaimed,
      });

      // Fetch individual tranches in parallel
      const now = Math.floor(Date.now() / 1000);
      const trancheIndices = Array.from({ length: trancheCount }, (_, idx) => idx + 1);

      const loadedTranches = (
        await Promise.all(
          trancheIndices.map(async (i) => {
            try {
              const [tranchePda] = getTranchePda(userPubkey, i);
              const [trancheAccount, sigs] = await Promise.all([
                connection.getAccountInfo(tranchePda, 'confirmed'),
                connection.getSignaturesForAddress(tranchePda, { limit: 1 }).catch(() => []),
              ]);

              if (trancheAccount && trancheAccount.data.length >= 112) {
                const tData = trancheAccount.data;
                const trancheId = tData.readUInt32LE(40);
                const isMatured = tData.readUInt8(44) === 1;
                const depositedAmount = Number(tData.readBigUInt64LE(48));
                const depositedAt = Number(tData.readBigInt64LE(56));
                const expiresAt = Number(tData.readBigInt64LE(64));
                const claimedRewards = Number(tData.readBigUInt64LE(104));

                const secondsLeft = Math.max(0, expiresAt - now);
                const daysRemaining = Math.ceil(secondsLeft / 86400);

                return {
                  owner: walletAddress,
                  trancheId,
                  isMatured,
                  depositedAmount,
                  depositedAt,
                  expiresAt,
                  claimedRewards,
                  daysRemaining,
                  isExpired: now >= expiresAt,
                  canHarvest: now >= expiresAt && !isMatured,
                  txSignature: sigs && sigs.length > 0 ? sigs[0].signature : undefined,
                } as TrancheData;
              }
            } catch (err) {
              console.warn(`Error loading tranche #${i}:`, err);
            }
            return null;
          })
        )
      ).filter((t): t is TrancheData => t !== null);

      setTranches(loadedTranches);
    } catch (e) {
      console.warn('Error loading ORE vault data:', e);
    } finally {
      setIsLoading(false);
    }
  }, [walletAddress, connection]);

  useEffect(() => {
    loadVaultData();
  }, [loadVaultData]);

  // Handle claiming rewards for a tranche
  const handleClaimTranche = async (trancheId: number) => {
    if (!walletAddress || !signAndSendTransactions) return;
    try {
      setIsClaiming(true);
      soundService.triggerHapticHeavy();
      const userPubkey = new PublicKey(walletAddress);
      const claimIx = await createClaimTrancheYieldInstruction(userPubkey, trancheId);

      const { signature } = await executeSolanaTransaction({
        connection,
        payerKey: userPubkey,
        instructions: [claimIx],
        signAndSendTransactions,
      });

      soundService.playMajorArcanaReveal();
      setClaimSuccess(signature);
      await loadVaultData();
    } catch (e: any) {
      console.warn('Error claiming ORE yield:', e);
      soundService.playTxError();
      const msg = e?.message || String(e);
      if (msg.includes('6003') || msg.includes('NoRewardsAvailable') || msg.includes('0x1773')) {
        Alert.alert(
          t('ore_no_yield_title', 'Доходность накапливается'),
          t('ore_no_yield_msg', 'На данный момент нет невостребованной доходности. Награды начисляются по мере распределений протокола ORE.')
        );
      }
    } finally {
      setIsClaiming(false);
    }
  };

  // Handle claiming rewards for ALL tranches in a single transaction
  const handleClaimAllTranches = async () => {
    if (!walletAddress || !signAndSendTransactions || tranches.length === 0) return;
    try {
      setIsClaiming(true);
      soundService.triggerHapticHeavy();
      const userPubkey = new PublicKey(walletAddress);

      // Collect eligible (unmatured) tranches
      const activeTranches = tranches.filter((t) => !t.isMatured);
      if (activeTranches.length === 0) {
        return;
      }

      // Build claim instructions for all active tranches into 1 transaction
      const claimIxs = await Promise.all(
        activeTranches.map((t) => createClaimTrancheYieldInstruction(userPubkey, t.trancheId))
      );

      const { signature } = await executeSolanaTransaction({
        connection,
        payerKey: userPubkey,
        instructions: claimIxs,
        signAndSendTransactions,
      });

      soundService.playMajorArcanaReveal();
      setClaimSuccess(signature);
      await loadVaultData();
    } catch (e: any) {
      console.warn('Error claiming all ORE yield:', e);
      soundService.playTxError();
      const msg = e?.message || String(e);
      if (msg.includes('6003') || msg.includes('NoRewardsAvailable') || msg.includes('0x1773')) {
        Alert.alert(
          t('ore_no_yield_title', 'Доходность накапливается'),
          t('ore_no_yield_msg', 'На данный момент нет невостребованной доходности. Награды начисляются по мере распределений протокола ORE.')
        );
      }
    } finally {
      setIsClaiming(false);
    }
  };

  const totalOreStakedUi = userVault
    ? (userVault.totalStakedOre / 1e11).toFixed(4)
    : '0.0000';

  const totalYieldClaimedUi = userVault
    ? (userVault.totalYieldClaimed / 1e11).toFixed(4)
    : '0.0000';

  return (
    <SafeAreaView style={styles.safeArea} edges={['top']}>
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        refreshControl={
          <RefreshControl
            refreshing={isLoading}
            onRefresh={loadVaultData}
            tintColor="#C8A24A"
          />
        }
      >
        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.headerSubtitle}>
            {t('ore_header_subtitle', 'DEFLATIONARY STAKING ORACLE')}
          </Text>
          <Text style={styles.headerTitle}>
            {t('ore_header_title', 'ORE SACRED VAULT')}
          </Text>
          <View style={styles.divider} />
        </View>

        {/* Global Vault Card */}
        <LinearGradient
          colors={['#1F1A24', '#0E0C12']}
          style={styles.statsCard}
        >
          <View style={styles.statsHeader}>
            <OreLogo size={26} color="#C8A24A" />
            <Text style={styles.statsBadge}>
              {t('ore_badge_365', '365-DAY TIME-LOCK')}
            </Text>
          </View>

          <View style={styles.statsRow}>
            <View style={styles.statCol}>
              <Text style={styles.statLabel}>
                {t('ore_stat_staked', 'STAKED ORE')}
              </Text>
              <Text style={styles.statValueGold}>{totalOreStakedUi} ORE</Text>
            </View>

            <View style={styles.statDivider} />

            <View style={styles.statCol}>
              <Text style={styles.statLabel}>
                {t('ore_stat_claimed', 'CLAIMED YIELD')}
              </Text>
              <Text style={styles.statValueSilver}>{totalYieldClaimedUi} ORE</Text>
            </View>
          </View>

          {/* Claim All Tranches Yield Button */}
          {tranches.length > 0 && (
            <Pressable
              style={[
                styles.claimAllButton,
                isClaiming && styles.claimButtonDisabled,
              ]}
              onPress={handleClaimAllTranches}
              disabled={isClaiming}
            >
              {isClaiming ? (
                <ActivityIndicator size="small" color="#08070B" />
              ) : (
                <View style={styles.claimAllContent}>
                  <UiIconSymbol name="sparkles" size={14} color="#08070B" />
                  <Text style={styles.claimAllButtonText}>
                    {t('ore_claim_all_yield_btn', 'CLAIM ALL YIELD')}
                  </Text>
                </View>
              )}
            </Pressable>
          )}

          <View style={styles.vaultAddressRow}>
            <Text style={styles.vaultAddressLabel}>
              {t('ore_program_label', 'PROGRAM:')}
            </Text>
            <Text style={styles.vaultAddressValue} numberOfLines={1}>
              {ARKANA_VAULT_PROGRAM_ID.toBase58()}
            </Text>
          </View>
        </LinearGradient>

        {/* The Sacred 33/33/34 Economic Loop Explained */}
        <View style={styles.ruleCard}>
          <Text style={styles.ruleTitle}>
            {t('ore_loop_title', 'THE SACRED ECONOMIC RITUAL')}
          </Text>
          <Text style={styles.ruleDesc}>
            {t(
              'ore_loop_desc',
              'On every transaction in Arkana, 33% of $SKR is burned forever, 33% is allocated to the Arkana Treasury, and 34% is directed into the $ORE Sacred Vault 365-day staking yield stream.'
            )}
          </Text>

          <View style={styles.ruleBreakdown}>
            <View style={styles.ruleItem}>
              <Text style={styles.rulePctGold}>33%</Text>
              <Text style={styles.ruleItemSub}>
                {t('ore_burn_desc', 'Burned Forever')}
              </Text>
            </View>

            <View style={styles.ruleItem}>
              <Text style={styles.rulePctGold}>33%</Text>
              <Text style={styles.ruleItemSub}>
                {t('ore_treasury_desc', 'Arkana Treasury')}
              </Text>
            </View>

            <View style={styles.ruleItem}>
              <Text style={styles.rulePctGold}>34%</Text>
              <Text style={styles.ruleItemSub}>
                {t('ore_yield_desc', 'ORE Staking Yield')}
              </Text>
            </View>
          </View>
        </View>

        {/* Tranches Section */}
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>
            {t('ore_tranches_title', 'YOUR 365-DAY TRANCHES')}
          </Text>
          <Text style={styles.sectionCount}>
            {tranches.length} {t('ore_active_label', 'active')}
          </Text>
        </View>

        {tranches.length === 0 ? (
          <View style={styles.emptyState}>
            <UiIconSymbol name="sparkles" size={36} color="rgba(200, 162, 74, 0.4)" />
            <Text style={styles.emptyStateTitle}>
              {t('ore_empty_title', 'No Active ORE Tranches')}
            </Text>
            <Text style={styles.emptyStateDesc}>
              {t(
                'ore_empty_desc',
                'Make an offering at the Sacred Altar or purchase a reading. 34% of every transaction is automatically converted to ORE and locked into 365-day staking tranches, earning you 100% continuous yield!'
              )}
            </Text>
          </View>
        ) : (
          tranches.map((tranche) => {
            const amountUi = (tranche.depositedAmount / 1e11).toFixed(4);
            const claimedUi = (tranche.claimedRewards / 1e11).toFixed(4);
            const progressPct = Math.min(
              100,
              Math.max(0, ((365 - tranche.daysRemaining) / 365) * 100)
            );

            return (
              <View key={tranche.trancheId} style={styles.trancheCard}>
                <View style={styles.trancheHeader}>
                  <Text style={styles.trancheIdText}>
                    {t('ore_tranche_prefix', 'TRANCHE')} #{tranche.trancheId}
                  </Text>
                  <View
                    style={[
                      styles.trancheStatusBadge,
                      tranche.isMatured && styles.trancheMaturedBadge,
                    ]}
                  >
                    <Text style={styles.trancheStatusText}>
                      {tranche.isMatured
                        ? t('ore_status_matured', 'MATURED TO TREASURY')
                        : `${tranche.daysRemaining} ${t('ore_days_left', 'DAYS LEFT')}`}
                    </Text>
                  </View>
                </View>

                {/* Progress bar */}
                <View style={styles.progressBarBg}>
                  <View
                    style={[
                      styles.progressBarFill,
                      { width: `${progressPct}%` },
                      tranche.isMatured && styles.progressBarMatured,
                    ]}
                  />
                </View>

                <View style={styles.trancheInfoRow}>
                  <View>
                    <Text style={styles.trancheInfoLabel}>
                      {t('ore_staked_label', 'LOCKED PRINCIPAL')}
                    </Text>
                    <Text style={styles.trancheInfoValue}>{amountUi} ORE</Text>
                  </View>

                  <View style={{ alignItems: 'flex-end' }}>
                    <Text style={styles.trancheInfoLabel}>
                      {t('ore_claimed_label', 'YIELD CLAIMED')}
                    </Text>
                    <Text style={styles.trancheInfoValueGold}>{claimedUi} ORE</Text>
                  </View>
                </View>

                {!tranche.isMatured && (
                  <Pressable
                    style={[styles.claimButton, isClaiming && styles.claimButtonDisabled]}
                    onPress={() => handleClaimTranche(tranche.trancheId)}
                    disabled={isClaiming}
                  >
                    {isClaiming ? (
                      <ActivityIndicator size="small" color="#08070B" />
                    ) : (
                      <Text style={styles.claimButtonText}>
                        {t('ore_claim_yield_btn', 'CLAIM ORE YIELD')}
                      </Text>
                    )}
                  </Pressable>
                )}

                {/* Solana Explorer Link */}
                <Pressable
                  style={styles.explorerLinkBtn}
                  onPress={() => {
                    const userPubkey = new PublicKey(walletAddress);
                    const explorerUrl = tranche.txSignature
                      ? `https://explorer.solana.com/tx/${tranche.txSignature}${getNetworkConfig().explorerSuffix}`
                      : `https://explorer.solana.com/address/${getTranchePda(userPubkey, tranche.trancheId)[0].toBase58()}${getNetworkConfig().explorerSuffix}`;
                    Linking.openURL(explorerUrl);
                  }}
                  hitSlop={8}
                >
                  <UiIconSymbol name="arrow.up.right" size={12} color="#C8A24A" />
                  <Text style={styles.explorerLinkText}>
                    {t('ore_view_on_explorer', 'View on Solana Explorer')}
                  </Text>
                </Pressable>
              </View>
            );
          })
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#08070B',
  },
  scrollContent: {
    paddingHorizontal: 16,
    paddingBottom: 40,
  },
  header: {
    alignItems: 'center',
    marginTop: 12,
    marginBottom: 20,
  },
  headerSubtitle: {
    fontFamily: Platform.select({ ios: 'SpaceMono', android: 'SpaceMono', default: 'monospace' }),
    fontSize: 11,
    letterSpacing: 2,
    color: 'rgba(200, 162, 74, 0.7)',
    marginBottom: 4,
  },
  headerTitle: {
    fontFamily: Platform.select({ ios: 'Cinzel', android: 'Cinzel', default: 'serif' }),
    fontSize: 24,
    fontWeight: 'bold',
    color: '#EDE7DC',
    letterSpacing: 1.5,
  },
  divider: {
    width: 60,
    height: 2,
    backgroundColor: '#C8A24A',
    marginTop: 8,
    opacity: 0.6,
  },
  statsCard: {
    borderRadius: 16,
    padding: 20,
    borderWidth: 1,
    borderColor: 'rgba(200, 162, 74, 0.35)',
    marginBottom: 20,
  },
  statsHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  statsBadge: {
    fontFamily: Platform.select({ ios: 'SpaceMono', android: 'SpaceMono', default: 'monospace' }),
    fontSize: 10,
    color: '#C8A24A',
    backgroundColor: 'rgba(200, 162, 74, 0.12)',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: 'rgba(200, 162, 74, 0.3)',
    letterSpacing: 1,
  },
  statsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-around',
    marginBottom: 16,
  },
  statCol: {
    alignItems: 'center',
  },
  statLabel: {
    fontFamily: Platform.select({ ios: 'SpaceMono', android: 'SpaceMono', default: 'monospace' }),
    fontSize: 11,
    color: 'rgba(237, 231, 220, 0.6)',
    letterSpacing: 1,
    marginBottom: 6,
  },
  statValueGold: {
    fontFamily: Platform.select({ ios: 'Cinzel', android: 'Cinzel', default: 'serif' }),
    fontSize: 22,
    fontWeight: 'bold',
    color: '#C8A24A',
  },
  statValueSilver: {
    fontFamily: Platform.select({ ios: 'Cinzel', android: 'Cinzel', default: 'serif' }),
    fontSize: 22,
    fontWeight: 'bold',
    color: '#EDE7DC',
  },
  statDivider: {
    width: 1,
    height: 40,
    backgroundColor: 'rgba(200, 162, 74, 0.2)',
  },
  vaultAddressRow: {
    flexDirection: 'row',
    alignItems: 'center',
    borderTopWidth: 1,
    borderTopColor: 'rgba(200, 162, 74, 0.15)',
    paddingTop: 12,
  },
  vaultAddressLabel: {
    fontFamily: Platform.select({ ios: 'SpaceMono', android: 'SpaceMono', default: 'monospace' }),
    fontSize: 10,
    color: 'rgba(200, 162, 74, 0.6)',
    marginRight: 8,
  },
  vaultAddressValue: {
    fontFamily: Platform.select({ ios: 'SpaceMono', android: 'SpaceMono', default: 'monospace' }),
    fontSize: 10,
    color: 'rgba(237, 231, 220, 0.5)',
    flex: 1,
  },
  ruleCard: {
    backgroundColor: 'rgba(20, 18, 26, 0.85)',
    borderRadius: 14,
    padding: 18,
    borderWidth: 1,
    borderColor: 'rgba(200, 162, 74, 0.2)',
    marginBottom: 24,
  },
  ruleTitle: {
    fontFamily: Platform.select({ ios: 'Cinzel', android: 'Cinzel', default: 'serif' }),
    fontSize: 14,
    fontWeight: 'bold',
    color: '#C8A24A',
    letterSpacing: 1.2,
    marginBottom: 8,
  },
  ruleDesc: {
    fontFamily: Platform.select({ ios: 'SpaceMono', android: 'SpaceMono', default: 'monospace' }),
    fontSize: 12,
    lineHeight: 18,
    color: 'rgba(237, 231, 220, 0.75)',
    marginBottom: 16,
  },
  ruleBreakdown: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    backgroundColor: 'rgba(8, 7, 11, 0.6)',
    borderRadius: 10,
    padding: 12,
  },
  ruleItem: {
    flex: 1,
    alignItems: 'center',
  },
  rulePctGold: {
    fontFamily: Platform.select({ ios: 'Cinzel', android: 'Cinzel', default: 'serif' }),
    fontSize: 16,
    fontWeight: 'bold',
    color: '#C8A24A',
    marginBottom: 4,
  },
  ruleItemSub: {
    fontFamily: Platform.select({ ios: 'SpaceMono', android: 'SpaceMono', default: 'monospace' }),
    fontSize: 10,
    color: 'rgba(237, 231, 220, 0.5)',
    textAlign: 'center',
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 14,
  },
  sectionTitle: {
    fontFamily: Platform.select({ ios: 'Cinzel', android: 'Cinzel', default: 'serif' }),
    fontSize: 16,
    fontWeight: 'bold',
    color: '#EDE7DC',
    letterSpacing: 1,
  },
  sectionCount: {
    fontFamily: Platform.select({ ios: 'SpaceMono', android: 'SpaceMono', default: 'monospace' }),
    fontSize: 11,
    color: 'rgba(200, 162, 74, 0.8)',
  },
  emptyState: {
    backgroundColor: 'rgba(16, 14, 22, 0.7)',
    borderRadius: 14,
    padding: 30,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(200, 162, 74, 0.15)',
    borderStyle: 'dashed',
  },
  emptyStateTitle: {
    fontFamily: Platform.select({ ios: 'Cinzel', android: 'Cinzel', default: 'serif' }),
    fontSize: 16,
    fontWeight: 'bold',
    color: '#EDE7DC',
    marginTop: 14,
    marginBottom: 8,
  },
  emptyStateDesc: {
    fontFamily: Platform.select({ ios: 'SpaceMono', android: 'SpaceMono', default: 'monospace' }),
    fontSize: 12,
    lineHeight: 18,
    color: 'rgba(237, 231, 220, 0.55)',
    textAlign: 'center',
  },
  trancheCard: {
    backgroundColor: 'rgba(18, 16, 24, 0.95)',
    borderRadius: 14,
    padding: 16,
    borderWidth: 1,
    borderColor: 'rgba(200, 162, 74, 0.25)',
    marginBottom: 14,
  },
  trancheHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  trancheIdText: {
    fontFamily: Platform.select({ ios: 'Cinzel', android: 'Cinzel', default: 'serif' }),
    fontSize: 14,
    fontWeight: 'bold',
    color: '#EDE7DC',
  },
  trancheStatusBadge: {
    backgroundColor: 'rgba(200, 162, 74, 0.15)',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: 'rgba(200, 162, 74, 0.3)',
  },
  trancheMaturedBadge: {
    backgroundColor: 'rgba(120, 120, 120, 0.2)',
    borderColor: 'rgba(180, 180, 180, 0.3)',
  },
  trancheStatusText: {
    fontFamily: Platform.select({ ios: 'SpaceMono', android: 'SpaceMono', default: 'monospace' }),
    fontSize: 10,
    color: '#C8A24A',
    fontWeight: '500',
  },
  progressBarBg: {
    height: 5,
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
    borderRadius: 3,
    overflow: 'hidden',
    marginBottom: 12,
  },
  progressBarFill: {
    height: '100%',
    backgroundColor: '#C8A24A',
    borderRadius: 3,
  },
  progressBarMatured: {
    backgroundColor: '#9E9E9E',
  },
  trancheInfoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  trancheInfoLabel: {
    fontFamily: Platform.select({ ios: 'SpaceMono', android: 'SpaceMono', default: 'monospace' }),
    fontSize: 10,
    color: 'rgba(237, 231, 220, 0.5)',
    marginBottom: 4,
  },
  trancheInfoValue: {
    fontFamily: Platform.select({ ios: 'Cinzel', android: 'Cinzel', default: 'serif' }),
    fontSize: 15,
    fontWeight: 'bold',
    color: '#EDE7DC',
  },
  trancheInfoValueGold: {
    fontFamily: Platform.select({ ios: 'Cinzel', android: 'Cinzel', default: 'serif' }),
    fontSize: 15,
    fontWeight: 'bold',
    color: '#C8A24A',
  },
  claimButton: {
    backgroundColor: '#C8A24A',
    borderRadius: 8,
    paddingVertical: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  claimButtonDisabled: {
    opacity: 0.6,
  },
  claimButtonText: {
    fontFamily: Platform.select({ ios: 'Cinzel', android: 'Cinzel', default: 'serif' }),
    fontSize: 12,
    fontWeight: 'bold',
    color: '#08070B',
    letterSpacing: 1,
  },
  claimAllButton: {
    backgroundColor: '#C8A24A',
    borderRadius: 8,
    paddingVertical: 11,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 14,
  },
  claimAllContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },
  claimAllButtonText: {
    fontFamily: Platform.select({ ios: 'Cinzel', android: 'Cinzel', default: 'serif' }),
    fontSize: 12,
    fontWeight: 'bold',
    color: '#08070B',
    letterSpacing: 1.2,
  },
  explorerLinkBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingTop: 10,
    marginTop: 6,
    borderTopWidth: 1,
    borderTopColor: 'rgba(200, 162, 74, 0.12)',
  },
  explorerLinkText: {
    fontFamily: Platform.select({ ios: 'SpaceMono', android: 'SpaceMono', default: 'monospace' }),
    fontSize: 11,
    color: '#C8A24A',
    letterSpacing: 0.5,
  },
});
