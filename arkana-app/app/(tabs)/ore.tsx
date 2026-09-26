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
  getConfigPda,
  getUserVaultPda,
  getTranchePda,
  createClaimTrancheYieldInstruction,
  fetchRealOreBalance,
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
      const [configPda] = getConfigPda();
      const [userVaultPda] = getUserVaultPda(userPubkey);

      const [configAccountInfo, vaultAccountInfo] = await Promise.all([
        connection.getAccountInfo(configPda, 'confirmed'),
        connection.getAccountInfo(userVaultPda, 'confirmed'),
      ]);

      if (!vaultAccountInfo || vaultAccountInfo.data.length < 56) {
        // Vault not yet initialized on-chain for this wallet
        setUserVault({
          owner: walletAddress,
          trancheCount: 0,
          lastDepositDay: 0,
          totalStakedOre: 0,
          totalClaimableOre: 0,
          totalYieldClaimed: 0,
        });
        setTranches([]);
        return;
      }

      // Read current global rewards_factor from VaultConfig (Numeric I80F48 at offset 80)
      let currentRewardsFactor = BigInt(0);
      if (configAccountInfo && configAccountInfo.data.length >= 96) {
        const factorLow = configAccountInfo.data.readBigUInt64LE(80);
        const factorHigh = configAccountInfo.data.readBigInt64LE(88);
        currentRewardsFactor = (factorHigh << BigInt(64)) | factorLow;
      }

      // Parse UserVault account data
      // Steel layout: [discriminator: 8 bytes][owner: 32 bytes][tranche_count: 4 bytes][last_deposit_day: 4 bytes][total_staked: 8 bytes][total_claimed: 8 bytes]
      const data = vaultAccountInfo.data;
      const trancheCount = data.readUInt32LE(40);
      const lastDepositDay = data.readUInt32LE(44);
      const totalStakedOre = Number(data.readBigUInt64LE(48));
      const totalYieldClaimed = Number(data.readBigUInt64LE(56));

      // Fetch individual tranches in parallel
      const now = Math.floor(Date.now() / 1000);
      const trancheIndices = Array.from({ length: trancheCount }, (_, idx) => idx + 1);
      const SCALE_48 = BigInt(1) << BigInt(48);

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
                const depositedBig = tData.readBigUInt64LE(48);
                const depositedAmount = Number(depositedBig);
                const depositedAt = Number(tData.readBigInt64LE(56));
                const expiresAt = Number(tData.readBigInt64LE(64));
                const lastFactorLow = tData.readBigUInt64LE(88);
                const lastFactorHigh = tData.readBigInt64LE(96);
                const lastRewardsFactor = (lastFactorHigh << BigInt(64)) | lastFactorLow;
                const claimedRewards = Number(tData.readBigUInt64LE(104));

                let claimableRewards = 0;
                if (!isMatured && currentRewardsFactor > lastRewardsFactor) {
                  const diff = currentRewardsFactor - lastRewardsFactor;
                  const claimableUnits = (diff * depositedBig) / SCALE_48;
                  claimableRewards = Number(claimableUnits);
                }

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
                  claimableRewards,
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

      const totalClaimableOre = loadedTranches.reduce(
        (sum, t) => sum + (t.claimableRewards || 0),
        0
      );

      setUserVault({
        owner: walletAddress,
        trancheCount,
        lastDepositDay,
        totalStakedOre,
        totalClaimableOre,
        totalYieldClaimed,
      });

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

  const totalClaimableOreUi = userVault
    ? (userVault.totalClaimableOre / 1e11).toFixed(4)
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
                {t('ore_stat_locked', 'LOCKED')}
              </Text>
              <Text style={styles.statValueGold} numberOfLines={1}>
                {totalOreStakedUi} <Text style={styles.statUnitGold}>ORE</Text>
              </Text>
            </View>

            <View style={styles.statDivider} />

            <View style={styles.statCol}>
              <Text style={styles.statLabelGreen}>
                {t('ore_stat_claimable', 'CLAIMABLE')}
              </Text>
              <Text style={styles.statValueGreen} numberOfLines={1}>
                {totalClaimableOreUi} <Text style={styles.statUnitGreen}>ORE</Text>
              </Text>
            </View>

            <View style={styles.statDivider} />

            <View style={styles.statCol}>
              <Text style={styles.statLabel}>
                {t('ore_stat_claimed', 'CLAIMED')}
              </Text>
              <Text style={styles.statValueSilver} numberOfLines={1}>
                {totalYieldClaimedUi} <Text style={styles.statUnitSilver}>ORE</Text>
              </Text>
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
                    {userVault && userVault.totalClaimableOre > 0 ? ` (${totalClaimableOreUi} ORE)` : ''}
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
                'You have no personal 365-day ORE staking tranches locked yet. 34% of what you spend in Arkana on readings and offerings is dedicated to the ORE Sacred Vault.'
              )}
            </Text>
          </View>
        ) : (
          tranches.map((tranche) => {
            const amountUi = (tranche.depositedAmount / 1e11).toFixed(4);
            const claimableUi = (tranche.claimableRewards / 1e11).toFixed(4);
            const claimedUi = (tranche.claimedRewards / 1e11).toFixed(4);
            const progressPct = Math.min(
              100,
              Math.max(0, ((365 - tranche.daysRemaining) / 365) * 100)
            );

            const isToday =
              Math.floor(tranche.depositedAt / 86400) ===
              Math.floor(Date.now() / 1000 / 86400);

            const formattedDate = new Date(tranche.depositedAt * 1000).toLocaleDateString(
              undefined,
              { month: 'short', day: 'numeric', year: 'numeric' }
            );

            return (
              <View key={tranche.trancheId} style={styles.trancheCard}>
                <View style={styles.trancheHeader}>
                  <View style={styles.trancheHeaderTitleGroup}>
                    <Text style={styles.trancheIdText}>
                      {isToday
                        ? `${t('ore_today_badge', 'TODAY')}, ${formattedDate}`
                        : formattedDate}
                    </Text>
                    <Text style={styles.trancheDaySub}>
                      ({t('ore_day_label', 'Day')} #{tranche.trancheId})
                    </Text>
                  </View>
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
                  <View style={styles.trancheStatCol}>
                    <Text style={styles.trancheInfoLabel}>
                      {t('ore_stat_locked', 'LOCKED')}
                    </Text>
                    <Text style={styles.trancheInfoValue} numberOfLines={1}>
                      {amountUi} <Text style={styles.trancheUnit}>ORE</Text>
                    </Text>
                  </View>

                  <View style={[styles.trancheStatCol, { alignItems: 'center' }]}>
                    <Text style={styles.trancheInfoLabelGreen}>
                      {t('ore_stat_claimable', 'CLAIMABLE')}
                    </Text>
                    <Text style={styles.trancheInfoValueGreen} numberOfLines={1}>
                      {claimableUi} <Text style={styles.trancheUnitGreen}>ORE</Text>
                    </Text>
                  </View>

                  <View style={[styles.trancheStatCol, { alignItems: 'flex-end' }]}>
                    <Text style={styles.trancheInfoLabel}>
                      {t('ore_stat_claimed', 'CLAIMED')}
                    </Text>
                    <Text style={styles.trancheInfoValueSilver} numberOfLines={1}>
                      {claimedUi} <Text style={styles.trancheUnitSilver}>ORE</Text>
                    </Text>
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
                        {tranche.claimableRewards > 0 ? ` (${claimableUi} ORE)` : ''}
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
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  statCol: {
    flex: 1,
    alignItems: 'center',
  },
  statLabel: {
    fontFamily: Platform.select({ ios: 'SpaceMono', android: 'SpaceMono', default: 'monospace' }),
    fontSize: 10,
    color: 'rgba(237, 231, 220, 0.6)',
    letterSpacing: 0.8,
    marginBottom: 4,
  },
  statLabelGreen: {
    fontFamily: Platform.select({ ios: 'SpaceMono', android: 'SpaceMono', default: 'monospace' }),
    fontSize: 10,
    color: '#4ADE80',
    letterSpacing: 0.8,
    marginBottom: 4,
  },
  statValueGold: {
    fontFamily: Platform.select({ ios: 'Cinzel', android: 'Cinzel', default: 'serif' }),
    fontSize: 15,
    fontWeight: 'bold',
    color: '#C8A24A',
  },
  statValueGreen: {
    fontFamily: Platform.select({ ios: 'Cinzel', android: 'Cinzel', default: 'serif' }),
    fontSize: 15,
    fontWeight: 'bold',
    color: '#4ADE80',
  },
  statValueSilver: {
    fontFamily: Platform.select({ ios: 'Cinzel', android: 'Cinzel', default: 'serif' }),
    fontSize: 15,
    fontWeight: 'bold',
    color: '#EDE7DC',
  },
  statUnitGold: {
    fontFamily: Platform.select({ ios: 'SpaceMono', android: 'SpaceMono', default: 'monospace' }),
    fontSize: 9,
    color: 'rgba(200, 162, 74, 0.7)',
  },
  statUnitGreen: {
    fontFamily: Platform.select({ ios: 'SpaceMono', android: 'SpaceMono', default: 'monospace' }),
    fontSize: 9,
    color: 'rgba(74, 222, 128, 0.8)',
  },
  statUnitSilver: {
    fontFamily: Platform.select({ ios: 'SpaceMono', android: 'SpaceMono', default: 'monospace' }),
    fontSize: 9,
    color: 'rgba(237, 231, 220, 0.5)',
  },
  statDivider: {
    width: 1,
    height: 32,
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
  trancheHeaderTitleGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    flexShrink: 1,
  },
  trancheIdText: {
    fontFamily: Platform.select({ ios: 'Cinzel', android: 'Cinzel', default: 'serif' }),
    fontSize: 13,
    fontWeight: 'bold',
    color: '#EDE7DC',
  },
  trancheDaySub: {
    fontFamily: Platform.select({ ios: 'SpaceMono', android: 'SpaceMono', default: 'monospace' }),
    fontSize: 10,
    color: '#C8A24A',
    opacity: 0.8,
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
    alignItems: 'center',
    marginBottom: 12,
  },
  trancheStatCol: {
    flex: 1,
  },
  trancheInfoLabel: {
    fontFamily: Platform.select({ ios: 'SpaceMono', android: 'SpaceMono', default: 'monospace' }),
    fontSize: 10,
    color: 'rgba(237, 231, 220, 0.5)',
    marginBottom: 4,
  },
  trancheInfoLabelGreen: {
    fontFamily: Platform.select({ ios: 'SpaceMono', android: 'SpaceMono', default: 'monospace' }),
    fontSize: 10,
    color: '#4ADE80',
    marginBottom: 4,
  },
  trancheInfoValue: {
    fontFamily: Platform.select({ ios: 'Cinzel', android: 'Cinzel', default: 'serif' }),
    fontSize: 14,
    fontWeight: 'bold',
    color: '#EDE7DC',
  },
  trancheInfoValueGreen: {
    fontFamily: Platform.select({ ios: 'Cinzel', android: 'Cinzel', default: 'serif' }),
    fontSize: 14,
    fontWeight: 'bold',
    color: '#4ADE80',
  },
  trancheInfoValueSilver: {
    fontFamily: Platform.select({ ios: 'Cinzel', android: 'Cinzel', default: 'serif' }),
    fontSize: 14,
    fontWeight: 'bold',
    color: '#C8A24A',
  },
  trancheUnit: {
    fontFamily: Platform.select({ ios: 'SpaceMono', android: 'SpaceMono', default: 'monospace' }),
    fontSize: 9,
    color: 'rgba(237, 231, 220, 0.6)',
  },
  trancheUnitGreen: {
    fontFamily: Platform.select({ ios: 'SpaceMono', android: 'SpaceMono', default: 'monospace' }),
    fontSize: 9,
    color: 'rgba(74, 222, 128, 0.8)',
  },
  trancheUnitSilver: {
    fontFamily: Platform.select({ ios: 'SpaceMono', android: 'SpaceMono', default: 'monospace' }),
    fontSize: 9,
    color: 'rgba(200, 162, 74, 0.7)',
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
  stakeCard: {
    borderRadius: 16,
    padding: 18,
    borderWidth: 1,
    borderColor: 'rgba(200, 162, 74, 0.4)',
    marginBottom: 20,
  },
  stakeHeaderRow: {
    marginBottom: 12,
  },
  stakeTitleGroup: {},
  stakeTitle: {
    fontFamily: Platform.select({ ios: 'Cinzel', android: 'Cinzel', default: 'serif' }),
    fontSize: 15,
    fontWeight: 'bold',
    color: '#EDE7DC',
    letterSpacing: 1,
    marginBottom: 4,
  },
  stakeSubtitle: {
    fontFamily: Platform.select({ ios: 'SpaceMono', android: 'SpaceMono', default: 'monospace' }),
    fontSize: 10.5,
    lineHeight: 15,
    color: 'rgba(237, 231, 220, 0.6)',
  },
  oreBalanceRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
    marginTop: 6,
  },
  oreBalanceLabel: {
    fontFamily: Platform.select({ ios: 'SpaceMono', android: 'SpaceMono', default: 'monospace' }),
    fontSize: 11,
    color: 'rgba(237, 231, 220, 0.65)',
  },
  oreBalanceValue: {
    fontFamily: Platform.select({ ios: 'SpaceMono', android: 'SpaceMono', default: 'monospace' }),
    fontSize: 11,
    color: '#C8A24A',
    fontWeight: '700',
  },
  maxText: {
    color: '#C8A24A',
    fontSize: 10,
    fontWeight: '800',
  },
  presetRow: {
    flexDirection: 'row',
    gap: 6,
    marginBottom: 12,
  },
  presetBtn: {
    flex: 1,
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    borderWidth: 1,
    borderColor: 'rgba(200, 162, 74, 0.25)',
    borderRadius: 8,
    paddingVertical: 7,
    alignItems: 'center',
  },
  presetBtnActive: {
    backgroundColor: 'rgba(200, 162, 74, 0.2)',
    borderColor: '#C8A24A',
  },
  presetBtnText: {
    fontFamily: Platform.select({ ios: 'SpaceMono', android: 'SpaceMono', default: 'monospace' }),
    fontSize: 11,
    color: '#DDD',
    fontWeight: '600',
  },
  presetBtnTextActive: {
    color: '#C8A24A',
    fontWeight: '700',
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(8, 7, 12, 0.8)',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: 'rgba(200, 162, 74, 0.35)',
    paddingHorizontal: 12,
    marginBottom: 14,
  },
  amountInput: {
    flex: 1,
    fontFamily: Platform.select({ ios: 'SpaceMono', android: 'SpaceMono', default: 'monospace' }),
    fontSize: 14,
    color: '#EDE7DC',
    paddingVertical: 10,
  },
  inputSuffixBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: 'rgba(200, 162, 74, 0.15)',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  inputSuffixText: {
    fontFamily: Platform.select({ ios: 'Cinzel', android: 'Cinzel', default: 'serif' }),
    fontSize: 11,
    fontWeight: 'bold',
    color: '#C8A24A',
  },
  depositButton: {
    backgroundColor: '#C8A24A',
    borderRadius: 10,
    paddingVertical: 13,
    alignItems: 'center',
    justifyContent: 'center',
  },
  depositButtonDisabled: {
    opacity: 0.45,
  },
  depositButtonText: {
    fontFamily: Platform.select({ ios: 'Cinzel', android: 'Cinzel', default: 'serif' }),
    fontSize: 13,
    fontWeight: 'bold',
    color: '#08070B',
    letterSpacing: 1,
  },
  depositSuccessBanner: {
    marginTop: 12,
    backgroundColor: 'rgba(105, 219, 124, 0.12)',
    borderWidth: 1,
    borderColor: '#69DB7C',
    borderRadius: 8,
    padding: 10,
    alignItems: 'center',
  },
  depositSuccessText: {
    color: '#69DB7C',
    fontSize: 12,
    fontWeight: '700',
    marginBottom: 2,
  },
  depositSuccessTx: {
    color: 'rgba(237, 231, 220, 0.7)',
    fontFamily: Platform.select({ ios: 'SpaceMono', android: 'SpaceMono', default: 'monospace' }),
    fontSize: 10,
  },
});
