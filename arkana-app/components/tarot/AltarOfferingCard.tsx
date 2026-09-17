import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, Pressable, ActivityIndicator, Modal } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import * as Haptics from 'expo-haptics';
import { PublicKey, Connection } from '@solana/web3.js';
import { ObsidianTokens } from '@/constants/theme';
import { useLanguage } from '@/services/i18n';
import { getVerifiedTreasury, executePaymentOrSwap, getLiveSolQuoteForSkr } from '@/services/treasuryService';
import { fetchRealSkrBalance } from '@/services/solanaService';
import { soundService } from '@/services/soundService';
import { submitAltarOfferingApi, API_BASE_URL } from '@/services/oracleApi';

interface AltarOfferingCardProps {
  walletAddress: string;
  connection: Connection;
  signAndSendTransactions?: (tx: any, minContextSlot: any) => Promise<any>;
  onOfferingSuccess?: (amountSkr: number, txSig: string) => void;
}

export function AltarOfferingCard({
  walletAddress,
  connection,
  signAndSendTransactions,
  onOfferingSuccess,
}: AltarOfferingCardProps) {
  const { t } = useLanguage();
  const [selectedAmount, setSelectedAmount] = useState<number>(5);
  const [solEstimate, setSolEstimate] = useState<string>('~0.001 SOL');
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [showBlessing, setShowBlessing] = useState<boolean>(false);
  const [confirmedTx, setConfirmedTx] = useState<string | null>(null);
  const [userSkrBalance, setUserSkrBalance] = useState<number | null>(null);
  const [forceSolMode, setForceSolMode] = useState<boolean>(false);
  const [wasSwapped, setWasSwapped] = useState<boolean>(false);

  useEffect(() => {
    let isMounted = true;
    if (walletAddress) {
      fetchRealSkrBalance(connection, new PublicKey(walletAddress))
        .then((bal) => {
          if (isMounted) setUserSkrBalance(bal);
        })
        .catch(() => {});
    }
    return () => {
      isMounted = false;
    };
  }, [walletAddress, connection, confirmedTx]);

  useEffect(() => {
    let isMounted = true;
    getLiveSolQuoteForSkr(selectedAmount).then((quote) => {
      if (isMounted) {
        setSolEstimate(`~${quote.solAmount} SOL`);
      }
    });
    return () => {
      isMounted = false;
    };
  }, [selectedAmount]);

  const handleSelectAmount = (amount: number) => {
    soundService.playTap();
    setSelectedAmount(amount);
  };

  const isSolMode = forceSolMode || (userSkrBalance !== null && userSkrBalance < selectedAmount);

  const handleSendOffering = async () => {
    if (!walletAddress || !signAndSendTransactions) {
      return;
    }
    setIsSubmitting(true);
    try {
      soundService.triggerHapticHeavy();
      const treasuryPubkey = await getVerifiedTreasury(API_BASE_URL);
      const userPubkey = new PublicKey(walletAddress);

      const result = await executePaymentOrSwap({
        connection,
        userPublicKey: userPubkey,
        treasuryPublicKey: treasuryPubkey,
        amountSkr: selectedAmount,
        actionLabel: 'ALTAR_OFFERING',
        forceSolSwap: isSolMode,
        signAndSendTransactions,
      });

      setWasSwapped(result.paidWith === 'sol_swap');

      // Report offering to backend
      await submitAltarOfferingApi({
        wallet: walletAddress,
        txSignature: result.signature,
        amountSkr: selectedAmount,
        message: `Offering of ${selectedAmount} SKR to Sacred Altar`,
      });

      setConfirmedTx(result.signature);
      setShowBlessing(true);
      soundService.playConsensusSeal();
      if (onOfferingSuccess) {
        onOfferingSuccess(selectedAmount, result.signature);
      }
    } catch (e: any) {
      console.warn('Altar offering error:', e);
      try {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      } catch {}
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <View style={styles.cardContainer}>
      <LinearGradient
        colors={['rgba(229, 169, 60, 0.08)', 'rgba(15, 13, 29, 0.95)']}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={styles.gradientCard}
      >
        <View style={styles.headerRow}>
          <Text style={styles.altarIcon}>{'\u2726'}</Text>
          <View style={styles.titleWrapper}>
            <Text style={styles.titleText}>
              {t('altar_offering_title', 'ДАР АЛТАРЮ · ALTAR OFFERING')}
            </Text>
            <Text style={styles.subtitleText}>
              {t(
                'altar_offering_sub',
                '50% сжигается · 50% в казну · Deflationary Burn'
              )}
            </Text>
          </View>
        </View>

        {/* Tier Selector: 1, 5, 15, 50 SKR */}
        <View style={styles.tierSelector}>
          {[1, 5, 15, 50].map((amount) => {
            const isSelected = selectedAmount === amount;
            return (
              <Pressable
                key={amount}
                onPress={() => handleSelectAmount(amount)}
                style={[styles.tierButton, isSelected && styles.tierButtonActive]}
              >
                <Text style={[styles.tierAmountText, isSelected && styles.tierAmountTextActive]}>
                  {amount} SKR
                </Text>
                <Text style={[styles.tierLabelText, isSelected && styles.tierLabelTextActive]}>
                  {amount === 1
                    ? t('tier_symbolic', 'Символ')
                    : amount === 5
                    ? t('tier_minor', 'Скромный')
                    : amount === 15
                    ? t('tier_sacred', 'Священный')
                    : t('tier_grand', 'Великий')}
                </Text>
              </Pressable>
            );
          })}
        </View>

        {/* Payment Source Selector (SKR vs SOL DEX Swap) */}
        <View style={styles.sourceSelector}>
          <Pressable
            style={[
              styles.sourceButton,
              !isSolMode && styles.sourceButtonActive,
            ]}
            onPress={() => {
              if (userSkrBalance !== null && userSkrBalance < selectedAmount) {
                return;
              }
              setForceSolMode(false);
            }}
          >
            <Text style={[styles.sourceButtonText, !isSolMode && styles.sourceButtonTextActive]}>
              SKR {userSkrBalance !== null ? `(${userSkrBalance.toFixed(1)})` : ''}
              {userSkrBalance !== null && userSkrBalance < selectedAmount ? ' [мало]' : ''}
            </Text>
          </Pressable>
          <Pressable
            style={[
              styles.sourceButton,
              isSolMode && styles.sourceButtonActive,
            ]}
            onPress={() => setForceSolMode(true)}
          >
            <Text style={[styles.sourceButtonText, isSolMode && styles.sourceButtonTextActive]}>
              ⚡ SOL (Jupiter Swap)
            </Text>
          </Pressable>
        </View>

        {/* Rate indication */}
        <View style={styles.rateRow}>
          <Text style={styles.rateText}>
            {isSolMode
              ? `${t('jupiter_auto_swap_active', 'Jupiter DEX ExactOut автосвап')} (${solEstimate}) \u2192 50% в казну + 50% сжигается`
              : `${t('direct_skr_payment_active', 'Прямой платёж SKR')} \u2192 50% в казну + 50% сжигается`}
          </Text>
        </View>

        {/* Action Button */}
        <Pressable
          style={[styles.submitButton, isSubmitting && styles.submitButtonDisabled]}
          onPress={handleSendOffering}
          disabled={isSubmitting}
        >
          {isSubmitting ? (
            <ActivityIndicator color="#000" size="small" />
          ) : (
            <Text style={styles.submitButtonText}>
              {isSolMode
                ? `${t('send_offering_sol_btn', 'СВАПНУТЬ SOL & СЖЕЧЬ 50%')} (${solEstimate})`
                : `${t('send_offering_btn', 'ПРИНЕСТИ ДАР')} (${selectedAmount} SKR)`}
            </Text>
          )}
        </Pressable>
      </LinearGradient>

      {/* Blessing Modal */}
      <Modal visible={showBlessing} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <Text style={styles.modalIcon}>{'\u2726'}</Text>
            <Text style={styles.modalTitle}>
              {t('offering_accepted_title', 'ДАР ПРИНЯТ АЛТАРЁМ')}
            </Text>
            <Text style={styles.modalDesc}>
              {wasSwapped
                ? t(
                    'offering_swap_accepted_desc',
                    'SOL успешно конвертирован в SKR через Jupiter DEX! 50% сожжено навсегда в блокчейне Solana, 50% поступило в казну.'
                  )
                : t(
                    'offering_accepted_desc',
                    'Ваш дар заверен в блокчейне Solana. 50% сожжено навсегда, 50% поступило в казну.'
                  )}
            </Text>
            {confirmedTx && (
              <Text style={styles.modalTx}>
                TX: {confirmedTx.slice(0, 10)}...{confirmedTx.slice(-8)}
              </Text>
            )}
            <Pressable style={styles.modalCloseButton} onPress={() => setShowBlessing(false)}>
              <Text style={styles.modalCloseButtonText}>
                {t('close_blessing_btn', 'ПРИНЯТЬ БЛАГОСЛОВЕНИЕ')}
              </Text>
            </Pressable>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  cardContainer: {
    marginVertical: 14,
    borderRadius: 16,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(229, 169, 60, 0.35)',
  },
  gradientCard: {
    padding: 16,
    borderRadius: 16,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  altarIcon: {
    fontSize: 22,
    color: ObsidianTokens.colors.gold.primary,
    marginRight: 10,
  },
  titleWrapper: {
    flex: 1,
  },
  titleText: {
    color: '#FFF',
    fontSize: 14,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  subtitleText: {
    color: ObsidianTokens.colors.gold.muted,
    fontSize: 11,
    marginTop: 2,
    lineHeight: 15,
  },
  tierSelector: {
    flexDirection: 'row',
    gap: 8,
    marginVertical: 10,
  },
  tierButton: {
    flex: 1,
    backgroundColor: 'rgba(255, 255, 255, 0.04)',
    borderRadius: 10,
    paddingVertical: 10,
    paddingHorizontal: 8,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
  },
  tierButtonActive: {
    backgroundColor: 'rgba(229, 169, 60, 0.16)',
    borderColor: ObsidianTokens.colors.gold.primary,
  },
  tierAmountText: {
    color: '#DDD',
    fontSize: 13,
    fontWeight: '700',
  },
  tierAmountTextActive: {
    color: ObsidianTokens.colors.gold.primary,
  },
  tierLabelText: {
    color: '#777',
    fontSize: 10,
    marginTop: 3,
  },
  tierLabelTextActive: {
    color: ObsidianTokens.colors.gold.muted,
  },
  sourceSelector: {
    flexDirection: 'row',
    backgroundColor: 'rgba(255, 255, 255, 0.04)',
    borderRadius: 8,
    padding: 3,
    marginVertical: 6,
  },
  sourceButton: {
    flex: 1,
    paddingVertical: 6,
    alignItems: 'center',
    borderRadius: 6,
  },
  sourceButtonActive: {
    backgroundColor: 'rgba(229, 169, 60, 0.2)',
    borderWidth: 1,
    borderColor: ObsidianTokens.colors.gold.primary,
  },
  sourceButtonText: {
    color: '#888',
    fontSize: 11,
    fontWeight: '600',
  },
  sourceButtonTextActive: {
    color: ObsidianTokens.colors.gold.primary,
    fontWeight: '800',
  },
  rateRow: {
    alignItems: 'center',
    marginVertical: 4,
  },
  rateText: {
    color: '#888',
    fontSize: 10.5,
  },
  submitButton: {
    backgroundColor: ObsidianTokens.colors.gold.primary,
    borderRadius: 12,
    paddingVertical: 12,
    alignItems: 'center',
    marginTop: 10,
  },
  submitButtonDisabled: {
    opacity: 0.6,
  },
  submitButtonText: {
    color: '#000',
    fontSize: 13,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.85)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  modalCard: {
    width: '100%',
    backgroundColor: '#131124',
    borderRadius: 20,
    padding: 24,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: ObsidianTokens.colors.gold.primary,
  },
  modalIcon: {
    fontSize: 36,
    color: ObsidianTokens.colors.gold.primary,
    marginBottom: 12,
  },
  modalTitle: {
    color: '#FFF',
    fontSize: 17,
    fontWeight: '800',
    textAlign: 'center',
    marginBottom: 8,
  },
  modalDesc: {
    color: '#BBB',
    fontSize: 13,
    lineHeight: 18,
    textAlign: 'center',
    marginBottom: 14,
  },
  modalTx: {
    color: ObsidianTokens.colors.gold.muted,
    fontSize: 11,
    marginBottom: 18,
  },
  modalCloseButton: {
    backgroundColor: ObsidianTokens.colors.gold.primary,
    borderRadius: 12,
    paddingVertical: 12,
    paddingHorizontal: 24,
    width: '100%',
    alignItems: 'center',
  },
  modalCloseButtonText: {
    color: '#000',
    fontWeight: '800',
    fontSize: 13,
  },
});
