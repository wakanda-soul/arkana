import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, Pressable, ActivityIndicator, Modal } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import * as Haptics from 'expo-haptics';
import { PublicKey, Connection } from '@solana/web3.js';
import { ObsidianTokens } from '@/constants/theme';
import { useLanguage } from '@/services/i18n';
import { getVerifiedTreasury, executePaymentOrSwap, getLiveSolQuoteForSkr } from '@/services/treasuryService';
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
  const [selectedAmount, setSelectedAmount] = useState<number>(15);
  const [solEstimate, setSolEstimate] = useState<string>('~0.003 SOL');
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [showBlessing, setShowBlessing] = useState<boolean>(false);
  const [confirmedTx, setConfirmedTx] = useState<string | null>(null);

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
    try {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    } catch {}
    setSelectedAmount(amount);
  };

  const handleSendOffering = async () => {
    if (!walletAddress || !signAndSendTransactions) {
      return;
    }
    setIsSubmitting(true);
    try {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
      const treasuryPubkey = await getVerifiedTreasury(API_BASE_URL);
      const userPubkey = new PublicKey(walletAddress);

      const result = await executePaymentOrSwap({
        connection,
        userPublicKey: userPubkey,
        treasuryPublicKey: treasuryPubkey,
        amountSkr: selectedAmount,
        actionLabel: 'ALTAR_OFFERING',
        signAndSendTransactions,
      });

      // Report offering to backend
      await submitAltarOfferingApi({
        wallet: walletAddress,
        txSignature: result.signature,
        amountSkr: selectedAmount,
        message: `Offering of ${selectedAmount} SKR to Sacred Altar`,
      });

      setConfirmedTx(result.signature);
      setShowBlessing(true);
      if (onOfferingSuccess) {
        onOfferingSuccess(selectedAmount, result.signature);
      }
      try {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      } catch {}
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
              {t('altar_offering_title', '\u0414\u0410\u0420 \u0410\u041B\u0422\u0410\u0420\u042E \u00B7 ALTAR OFFERING')}
            </Text>
            <Text style={styles.subtitleText}>
              {t(
                'altar_offering_sub',
                '50% \u0441\u0436\u0438\u0433\u0430\u0435\u0442\u0441\u044F \u00B7 50% \u0432 \u043A\u0430\u0437\u043D\u0443 \u00B7 Buyback & Burn'
              )}
            </Text>
          </View>
        </View>

        {/* Tier Selector: 5, 15, 50 SKR */}
        <View style={styles.tierSelector}>
          {[5, 15, 50].map((amount) => {
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
                  {amount === 5
                    ? t('tier_minor', '\u0421\u043A\u0440\u043E\u043C\u043D\u044B\u0439')
                    : amount === 15
                    ? t('tier_sacred', '\u0421\u0432\u044F\u0449\u0435\u043D\u043D\u044B\u0439')
                    : t('tier_grand', '\u0412\u0435\u043B\u0438\u043A\u0438\u0439')}
                </Text>
              </Pressable>
            );
          })}
        </View>

        {/* Rate indication */}
        <View style={styles.rateRow}>
          <Text style={styles.rateText}>
            {t(
              'jupiter_rate_note',
              '\u041D\u0435\u0442 SKR? \u0410\u0432\u0442\u043E\u0441\u0432\u0430\u043F \u0447\u0435\u0440\u0435\u0437 Jupiter DEX'
            )}{' '}
            ({solEstimate})
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
              {t('send_offering_btn', '\u041F\u0420\u0418\u041D\u0415\u0421\u0422\u0418 \u0414\u0410\u0420')} ({selectedAmount} SKR)
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
              {t('offering_accepted_title', '\u0414\u0410\u0420 \u041F\u0420\u0418\u041D\u042F\u0422 \u0410\u041B\u0422\u0410\u0420\u0401\u041C')}
            </Text>
            <Text style={styles.modalDesc}>
              {t(
                'offering_accepted_desc',
                '\u0412\u0430\u0448 \u0434\u0430\u0440 \u0437\u0430\u0432\u0435\u0440\u0435\u043D \u0432 \u0431\u043B\u043E\u043A\u0447\u0435\u0439\u043D\u0435 Solana. 50% \u0441\u043E\u0436\u0436\u0435\u043D\u043E \u043D\u0430\u0432\u0441\u0435\u0433\u0434\u0430, 50% \u043F\u043E\u0441\u0442\u0443\u043F\u0438\u043B\u043E \u0432 \u043A\u0430\u0437\u043D\u0443.'
              )}
            </Text>
            {confirmedTx && (
              <Text style={styles.modalTx}>
                TX: {confirmedTx.slice(0, 10)}...{confirmedTx.slice(-8)}
              </Text>
            )}
            <Pressable style={styles.modalCloseButton} onPress={() => setShowBlessing(false)}>
              <Text style={styles.modalCloseButtonText}>
                {t('close_blessing_btn', '\u041F\u0420\u0418\u041D\u042F\u0422\u042C \u0411\u041B\u0410\u0413\u041E\u0421\u041B\u041E\u0412\u0415\u041D\u0418\u0415')}
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
