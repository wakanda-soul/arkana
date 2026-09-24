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
  TextInput,
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
import {
  ARKANA_VAULT_PROGRAM_ID,
  ORE_MINT_ADDRESS,
  ARKANA_TREASURY_ADDRESS,
  getUserVaultPda,
  getTranchePda,
  createClaimTrancheYieldInstruction,
  createDepositTrancheInstruction,
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
  const [userOreBalance, setUserOreBalance] = useState<number | null>(null);
  const [depositAmount, setDepositAmount] = useState<string>('50');
  const [isDepositing, setIsDepositing] = useState(false);
  const [depositSuccessTx, setDepositSuccessTx] = useState<string | null>(null);

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

      // Fetch user real ORE balance
      try {
        const oreBal = await fetchRealOreBalance(connection, userPubkey);
        setUserOreBalance(oreBal);
      } catch (err) {
        console.warn('Failed to fetch ORE balance:', err);
      }

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

      // Fetch individual tranches
      const loadedTranches: TrancheData[] = [];
      const now = Math.floor(Date.now() / 1000);

      for (let i = 1; i <= trancheCount; i++) {
        const [tranchePda] = getTranchePda(userPubkey, i);
        const trancheAccount = await connection.getAccountInfo(tranchePda, 'confirmed');
        if (trancheAccount && trancheAccount.data.length >= 112) {
          const tData = trancheAccount.data;
          // [discriminator: 8][owner: 32][tranche_id: 4][is_matured: 1][padding: 3][deposited_amount: 8][deposited_at: 8][expires_at: 8]...[claimed_rewards: 8]
          const trancheId = tData.readUInt32LE(40);
          const isMatured = tData.readUInt8(44) === 1;
          const depositedAmount = Number(tData.readBigUInt64LE(48));
          const depositedAt = Number(tData.readBigInt64LE(56));
          const expiresAt = Number(tData.readBigInt64LE(64));
          const claimedRewards = Number(tData.readBigUInt64LE(104));

          const secondsLeft = Math.max(0, expiresAt - now);
          const daysRemaining = Math.ceil(secondsLeft / 86400);

          loadedTranches.push({
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
          });
        }
      }

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
    } finally {
      setIsClaiming(false);
    }
  };

  // Handle depositing ORE into a new 365-day tranche
  const handleDepositTranche = async () => {
    const amountNum = parseFloat(depositAmount);
    if (isNaN(amountNum) || amountNum <= 0) return;
    if (userOreBalance !== null && amountNum > userOreBalance) return;
    if (!walletAddress || !signAndSendTransactions) return;

    try {
      setIsDepositing(true);
      soundService.triggerHapticHeavy();
      const userPubkey = new PublicKey(walletAddress);
      const amountUnits = BigInt(Math.round(amountNum * 1e11)); // ORE 11 decimals
      const nextTrancheId = (userVault?.trancheCount || 0) + 1;

      const depositIx = await createDepositTrancheInstruction(
        userPubkey,
        nextTrancheId,
        amountUnits
      );

      const { signature } = await executeSolanaTransaction({
        connection,
        payerKey: userPubkey,
        instructions: [depositIx],
        signAndSendTransactions,
      });

      soundService.playMajorArcanaReveal();
      setDepositSuccessTx(signature);
      await loadVaultData();
    } catch (e: any) {
      console.warn('Error depositing ORE tranche:', e);
      soundService.playTxError();
    } finally {
      setIsDepositing(false);
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

          <View style={styles.vaultAddressRow}>
            <Text style={styles.vaultAddressLabel}>
              {t('ore_program_label', 'PROGRAM:')}
            </Text>
            <Text style={styles.vaultAddressValue} numberOfLines={1}>
              {ARKANA_VAULT_PROGRAM_ID.toBase58()}
            </Text>
          </View>
        </LinearGradient>

        {/* The Sacred 67/33 Economic Loop Explained */}
        <View style={styles.ruleCard}>
          <Text style={styles.ruleTitle}>
            {t('ore_loop_title', 'THE SACRED ECONOMIC RITUAL')}
          </Text>
          <Text style={styles.ruleDesc}>
            {t(
              'ore_loop_desc',
              'On every payment in Arkana, 67% is swapped to $SKR (50% burned forever + 50% to treasury), while 33% is swapped to $ORE and locked in this vault for 365 days. You claim 100% of the staking yield during the year, after which the principal transitions permanently into the Arkana Treasury.'
            )}
          </Text>

          <View style={styles.ruleBreakdown}>
            <View style={styles.ruleItem}>
              <Text style={styles.rulePctGold}>67% SKR</Text>
              <Text style={styles.ruleItemSub}>
                {t('ore_skr_desc', '50% Burned + 50% Treasury')}
              </Text>
            </View>

            <View style={styles.ruleItem}>
              <Text style={styles.rulePctGold}>33% ORE</Text>
              <Text style={styles.ruleItemSub}>
                {t('ore_ore_desc', '365d Vault + 100% Yield')}
              </Text>
            </View>
          </View>
        </View>

        {/* Stake ORE Card */}
        <LinearGradient
          colors={['#241C16', '#140F11', '#08070B']}
          style={styles.stakeCard}
        >
          <View style={styles.stakeHeaderRow}>
            <View style={styles.stakeTitleGroup}>
              <Text style={styles.stakeTitle}>
                {t('ore_stake_card_title', 'STAKE ORE (365-DAY TIME-LOCK)')}
              </Text>
              <Text style={styles.stakeSubtitle}>
                {t(
                  'ore_stake_card_desc',
                  'Lock $ORE directly into the Sacred Vault. Earn continuous staking yield for 365 days. Principal transitions to Treasury at maturity.'
                )}
              </Text>
            </View>
          </View>

          {/* User ORE Balance Indicator */}
          <View style={styles.oreBalanceRow}>
            <Text style={styles.oreBalanceLabel}>
              {t('ore_wallet_balance', 'Available in Wallet:')}
            </Text>
            <Pressable
              onPress={() => {
                if (userOreBalance !== null) {
                  setDepositAmount(userOreBalance.toString());
                }
              }}
            >
              <Text style={styles.oreBalanceValue}>
                {userOreBalance !== null ? `${userOreBalance.toLocaleString()} ORE` : '...'}
                <Text style={styles.maxText}> (MAX)</Text>
              </Text>
            </Pressable>
          </View>

          {/* Quick Preset Buttons */}
          <View style={styles.presetRow}>
            {[25, 50, 100, 250].map((amt) => {
              const isSelected = depositAmount === amt.toString();
              return (
                <Pressable
                  key={amt}
                  style={[styles.presetBtn, isSelected && styles.presetBtnActive]}
                  onPress={() => {
                    soundService.playTap();
                    setDepositAmount(amt.toString());
                  }}
                >
                  <Text style={[styles.presetBtnText, isSelected && styles.presetBtnTextActive]}>
                    {amt}
                  </Text>
                </Pressable>
              );
            })}
            <Pressable
              style={[
                styles.presetBtn,
                userOreBalance !== null &&
                  depositAmount === userOreBalance.toString() &&
                  styles.presetBtnActive,
              ]}
              onPress={() => {
                soundService.playTap();
                if (userOreBalance !== null) {
                  setDepositAmount(userOreBalance.toString());
                }
              }}
            >
              <Text
                style={[
                  styles.presetBtnText,
                  userOreBalance !== null &&
                    depositAmount === userOreBalance.toString() &&
                    styles.presetBtnTextActive,
                ]}
              >
                MAX
              </Text>
            </Pressable>
          </View>

          {/* Custom Input */}
          <View style={styles.inputContainer}>
            <TextInput
              style={styles.amountInput}
              value={depositAmount}
              onChangeText={setDepositAmount}
              placeholder="0.0"
              placeholderTextColor="#666"
              keyboardType="decimal-pad"
            />
            <View style={styles.inputSuffixBadge}>
              <OreLogo size={14} color="#C8A24A" />
              <Text style={styles.inputSuffixText}>ORE</Text>
            </View>
          </View>

          {/* Open Tranche Button */}
          <Pressable
            style={[
              styles.depositButton,
              (isDepositing ||
                !depositAmount ||
                parseFloat(depositAmount) <= 0 ||
                (userOreBalance !== null && parseFloat(depositAmount) > userOreBalance)) &&
                styles.depositButtonDisabled,
            ]}
            onPress={handleDepositTranche}
            disabled={
              isDepositing ||
              !depositAmount ||
              parseFloat(depositAmount) <= 0 ||
              (userOreBalance !== null && parseFloat(depositAmount) > userOreBalance)
            }
          >
            {isDepositing ? (
              <ActivityIndicator size="small" color="#08070B" />
            ) : (
              <Text style={styles.depositButtonText}>
                {userOreBalance !== null && parseFloat(depositAmount) > userOreBalance
                  ? t('ore_insufficient_balance', 'Insufficient ORE Balance')
                  : `${t('ore_open_tranche_btn', 'OPEN 365-DAY TRANCHE')} (${depositAmount || 0} ORE)`}
              </Text>
            )}
          </Pressable>

          {depositSuccessTx && (
            <View style={styles.depositSuccessBanner}>
              <Text style={styles.depositSuccessText}>
                {t('ore_tranche_created_success', 'Tranche created successfully on Solana!')}
              </Text>
              <Text style={styles.depositSuccessTx} numberOfLines={1}>
                TX: {depositSuccessTx.slice(0, 12)}...{depositSuccessTx.slice(-8)}
              </Text>
            </View>
          )}
        </LinearGradient>

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
                'Stake your ORE tokens above to open 365-day tranches and start earning yield, or make an offering at the Sacred Altar (33% feeds the ORE staking pool).'
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
