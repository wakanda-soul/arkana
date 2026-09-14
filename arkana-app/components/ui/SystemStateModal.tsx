import React, { useEffect, useRef } from 'react';
import {
  Modal,
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Animated,
  Easing,
  Platform,
  Linking,
} from 'react-native';
import { ObsidianTokens } from '@/constants/theme';
import { Image } from 'expo-image';
import { CARD_BACK } from '@/assets/cards';
import { useLanguage } from '@/services/i18n';

export type SystemStateType =
  | 'ai_generating'
  | 'tx_failed'
  | 'wallet_declined'
  | 'wallet_not_found'
  | 'limit_reached'
  | 'offline'
  | null;

interface SystemStateModalProps {
  type: SystemStateType;
  visible: boolean;
  onClose: () => void;
  onActionPrimary?: () => void;
  onActionSecondary?: () => void;
  customError?: string;
}

export function SystemStateModal({
  type,
  visible,
  onClose,
  onActionPrimary,
  onActionSecondary,
  customError,
}: SystemStateModalProps) {
  const { t } = useLanguage();
  const pulseAnim = useRef(new Animated.Value(0.35)).current;
  const spinAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (!visible) return;

    // Pulsing aura animation
    const pulseLoop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, {
          toValue: 0.85,
          duration: 3500,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
        Animated.timing(pulseAnim, {
          toValue: 0.35,
          duration: 3500,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
      ])
    );
    pulseLoop.start();

    // Subtle spin animation for loaders
    const spinLoop = Animated.loop(
      Animated.timing(spinAnim, {
        toValue: 1,
        duration: 4000,
        easing: Easing.linear,
        useNativeDriver: true,
      })
    );
    spinLoop.start();

    return () => {
      pulseLoop.stop();
      spinLoop.stop();
    };
  }, [visible, pulseAnim, spinAnim]);

  if (!visible || !type) return null;

  const spin = spinAnim.interpolate({
    inputRange: [0, 1],
    outputRange: ['0deg', '360deg'],
  });

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.backdrop}>
        <View style={styles.cardContainer}>
          {/* Top ambient aura bloom */}
          <Animated.View style={[styles.auraBloom, { opacity: pulseAnim }]} />

          {/* Status bar mock */}
          <View style={styles.statusRow}>
            <Text style={styles.monoDim}>SEEKER · 5G</Text>
            <TouchableOpacity onPress={onClose} hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}>
              <Text style={styles.closeGlyph}>✕</Text>
            </TouchableOpacity>
          </View>

          {/* AI Generating State */}
          {type === 'ai_generating' && (
            <View style={styles.contentBox}>
              <Animated.View style={[styles.spinRing, { transform: [{ rotate: spin }] }]} />
              <Text style={styles.titleSerif}>Reading your record</Text>
              <Text style={styles.bodySerif}>
                Six past pulls, thirty days of mood, one open position.
              </Text>
              <View style={styles.timeBadge}>
                <Text style={styles.timeBadgeText}>~4 SECONDS</Text>
              </View>

              <View style={styles.actionFooter}>
                <TouchableOpacity
                  style={styles.ghostButton}
                  onPress={onActionSecondary || onClose}
                >
                  <Text style={styles.ghostButtonText}>CANCEL</Text>
                </TouchableOpacity>
              </View>
            </View>
          )}

          {/* Transaction Failed State */}
          {type === 'tx_failed' && (
            <View style={styles.contentBox}>
              <View style={[styles.symbolRing, styles.lossBorder]}>
                <Text style={styles.lossSymbol}>✕</Text>
              </View>
              <Text style={styles.titleSerif}>The seal didn't take</Text>
              <Text style={styles.bodySerif}>
                Transaction dropped before confirmation. Your reading is saved locally - nothing was charged.
              </Text>
              <View style={styles.codePanel}>
                <Text style={styles.codeText}>
                  {customError || 'ERR: BLOCKHASH_EXPIRED · SLOT 289,441,209'}
                </Text>
              </View>

              <View style={styles.actionFooterColumn}>
                <TouchableOpacity
                  style={styles.primaryGoldButton}
                  onPress={onActionPrimary || onClose}
                >
                  <Text style={styles.primaryButtonText}>TRY THE SEAL AGAIN</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.ghostButton}
                  onPress={onActionSecondary || onClose}
                >
                  <Text style={styles.ghostButtonText}>KEEP IT LOCAL FOR NOW</Text>
                </TouchableOpacity>
              </View>
            </View>
          )}

          {/* Wallet Connection States (Declined or Not Found) */}
          {(type === 'wallet_declined' || type === 'wallet_not_found') && (
            <View style={styles.contentBox}>
              <View style={styles.symbolRing}>
                <Text style={styles.dimSymbol}>{'\u2726'}</Text>
              </View>
              <Text style={styles.titleSerif}>
                {type === 'wallet_not_found'
                  ? t('wallet_not_found_title', 'No Solana wallet detected')
                  : t('wallet_declined_title', 'Wallet connection needed')}
              </Text>
              <Text style={styles.bodySerif}>
                {type === 'wallet_not_found'
                  ? t('wallet_not_found_desc', 'On Android, Arkana connects via Mobile Wallet Adapter. Install a verified Solana wallet or explore in Seeker Demo mode.')
                  : t('wallet_declined_desc', 'Connection did not complete. If you do not have a wallet installed yet, get one from official verified sources below:')}
              </Text>

              {/* Official Wallets Section */}
              <View style={styles.walletSourcesContainer}>
                <Text style={styles.walletSourcesHeader}>{t('official_verified_wallets', 'OFFICIAL VERIFIED WALLETS')}</Text>

                {/* Phantom */}
                <View style={styles.walletSourceCard}>
                  <View style={styles.walletSourceInfo}>
                    <Text style={styles.walletSourceName}>Phantom</Text>
                    <Text style={styles.walletSourceType}>Solana Mobile standard</Text>
                  </View>
                  <View style={styles.walletSourceButtons}>
                    <TouchableOpacity
                      style={styles.walletPillBtn}
                      onPress={() => Linking.openURL('https://play.google.com/store/apps/details?id=app.phantom').catch(() => {})}
                    >
                      <Text style={styles.walletPillBtnText}>{t('play_store', 'PLAY STORE')}</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={styles.walletPillGhostBtn}
                      onPress={() => Linking.openURL('https://phantom.com/download').catch(() => {})}
                    >
                      <Text style={styles.walletPillGhostText}>{t('website', 'WEBSITE')}</Text>
                    </TouchableOpacity>
                  </View>
                </View>

                {/* Solflare */}
                <View style={styles.walletSourceCard}>
                  <View style={styles.walletSourceInfo}>
                    <Text style={styles.walletSourceName}>Solflare</Text>
                    <Text style={styles.walletSourceType}>Native MWA & Ledger</Text>
                  </View>
                  <View style={styles.walletSourceButtons}>
                    <TouchableOpacity
                      style={styles.walletPillBtn}
                      onPress={() => Linking.openURL('https://play.google.com/store/apps/details?id=com.solflare.mobile').catch(() => {})}
                    >
                      <Text style={styles.walletPillBtnText}>{t('play_store', 'PLAY STORE')}</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={styles.walletPillGhostBtn}
                      onPress={() => Linking.openURL('https://solflare.com').catch(() => {})}
                    >
                      <Text style={styles.walletPillGhostText}>{t('website', 'WEBSITE')}</Text>
                    </TouchableOpacity>
                  </View>
                </View>

                {/* Backpack */}
                <View style={styles.walletSourceCard}>
                  <View style={styles.walletSourceInfo}>
                    <Text style={styles.walletSourceName}>Backpack</Text>
                    <Text style={styles.walletSourceType}>xNFT & Seeker ready</Text>
                  </View>
                  <View style={styles.walletSourceButtons}>
                    <TouchableOpacity
                      style={styles.walletPillBtn}
                      onPress={() => Linking.openURL('https://play.google.com/store/apps/details?id=com.backpack.wallet').catch(() => {})}
                    >
                      <Text style={styles.walletPillBtnText}>{t('play_store', 'PLAY STORE')}</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={styles.walletPillGhostBtn}
                      onPress={() => Linking.openURL('https://backpack.app').catch(() => {})}
                    >
                      <Text style={styles.walletPillGhostText}>{t('website', 'WEBSITE')}</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              </View>

              <View style={styles.actionFooterColumn}>
                <TouchableOpacity
                  style={styles.primaryGoldButton}
                  onPress={onActionPrimary || onClose}
                >
                  <Text style={styles.primaryButtonText}>{t('try_connecting_again', 'TRY CONNECTING AGAIN')}</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.ghostButton}
                  onPress={onActionSecondary || onClose}
                >
                  <Text style={styles.ghostButtonText}>{t('continue_seeker_demo', 'CONTINUE IN SEEKER DEMO MODE')}</Text>
                </TouchableOpacity>
              </View>
            </View>
          )}

          {/* Limit Reached (Paywall / SKR) State */}
          {type === 'limit_reached' && (
            <View style={styles.contentBox}>
              <View style={styles.miniCardsRow}>
                <View style={styles.miniCardBack}>
                  <Image source={CARD_BACK} style={styles.miniCardImage} contentFit="cover" />
                </View>
                <View style={styles.miniCardBack}>
                  <Image source={CARD_BACK} style={styles.miniCardImage} contentFit="cover" />
                </View>
                <View style={[styles.miniCardBack, styles.miniCardDashed]}>
                  <Image source={CARD_BACK} style={[styles.miniCardImage, { opacity: 0.28 }]} contentFit="cover" />
                  <View style={styles.miniCardOverlay}>
                    <Text style={styles.miniLockText}>LOCK</Text>
                  </View>
                </View>
              </View>
              <Text style={styles.titleSerif}>
                Three questions, <Text style={styles.goldItalic}>this month</Text>
              </Text>
              <Text style={styles.bodySerif}>
                Free members ask three times. Your daily card is untouched and always will be.
              </Text>
              <View style={styles.orderPanel}>
                <View>
                  <Text style={styles.orderTitle}>Unlimited asks</Text>
                  <Text style={styles.orderSub}>ORDER · 0.045 SOL OR 15 SKR</Text>
                </View>
                <Text style={styles.orderArrow}>→</Text>
              </View>

              <View style={styles.actionFooterColumn}>
                <TouchableOpacity
                  style={styles.primaryGoldButton}
                  onPress={onActionPrimary || onClose}
                >
                  <Text style={styles.primaryButtonText}>JOIN THE ORDER</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.ghostButton}
                  onPress={onActionSecondary || onClose}
                >
                  <Text style={styles.ghostButtonText}>CONTINUE WITH DAILY CARDS</Text>
                </TouchableOpacity>
              </View>
            </View>
          )}

          {/* Offline State */}
          {type === 'offline' && (
            <View style={styles.contentBox}>
              <View style={styles.statusPill}>
                <Text style={styles.statusPillText}>OFFLINE · SHOWING YOUR RECORD</Text>
              </View>
              <View style={[styles.symbolRing, styles.dashedRing]}>
                <View style={styles.diamondSquare} />
              </View>
              <Text style={styles.titleSerif}>No chain, no chart</Text>
              <Text style={styles.bodySerif}>
                You can still read the cards you have drawn and write in your journal. Draws resume when you are back.
              </Text>
              <View style={styles.statsRow}>
                <View style={styles.statBox}>
                  <Text style={styles.statLabel}>CACHED</Text>
                  <Text style={styles.statVal}>78 cards</Text>
                </View>
                <View style={styles.statBox}>
                  <Text style={styles.statLabel}>QUEUED</Text>
                  <Text style={styles.statVal}>1 seal</Text>
                </View>
              </View>

              <View style={styles.actionFooter}>
                <TouchableOpacity
                  style={styles.primaryGoldBorderButton}
                  onPress={onClose}
                >
                  <Text style={styles.primaryGoldBorderText}>OPEN MY JOURNAL</Text>
                </TouchableOpacity>
              </View>
            </View>
          )}
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.78)',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 20,
  },
  cardContainer: {
    width: '100%',
    maxWidth: 360,
    backgroundColor: ObsidianTokens.colors.ink.void,
    borderRadius: 32,
    borderWidth: 1,
    borderColor: ObsidianTokens.colors.gold.subtle,
    overflow: 'hidden',
    paddingBottom: 26,
    paddingTop: 18,
    paddingHorizontal: 22,
  },
  auraBloom: {
    position: 'absolute',
    top: -100,
    left: '50%',
    marginLeft: -150,
    width: 300,
    height: 300,
    borderRadius: 150,
    backgroundColor: 'rgba(124, 77, 255, 0.28)',
  },
  statusRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
  },
  monoDim: {
    fontFamily: Platform.select({ ios: 'SpaceMono', android: 'SpaceMono', default: 'monospace' }),
    fontSize: 10,
    color: ObsidianTokens.colors.ink.text42,
    letterSpacing: 1.5,
  },
  closeGlyph: {
    fontSize: 16,
    color: ObsidianTokens.colors.ink.text55,
  },
  contentBox: {
    alignItems: 'center',
  },
  titleSerif: {
    fontFamily: Platform.select({ ios: 'Georgia', android: 'serif', default: 'serif' }),
    fontSize: 26,
    fontWeight: '300',
    color: ObsidianTokens.colors.ink.text,
    textAlign: 'center',
    marginTop: 18,
    lineHeight: 32,
  },
  goldItalic: {
    fontStyle: 'italic',
    color: ObsidianTokens.colors.gold.primary,
  },
  bodySerif: {
    fontFamily: Platform.select({ ios: 'Georgia', android: 'serif', default: 'serif' }),
    fontSize: 15,
    lineHeight: 22,
    color: ObsidianTokens.colors.ink.text55,
    textAlign: 'center',
    marginTop: 10,
    paddingHorizontal: 10,
  },
  symbolRing: {
    width: 80,
    height: 80,
    borderRadius: 40,
    borderWidth: 1,
    borderColor: ObsidianTokens.colors.ink.hairline,
    alignItems: 'center',
    justifyContent: 'center',
    marginVertical: 10,
  },
  lossBorder: {
    borderColor: ObsidianTokens.colors.state.loss,
    backgroundColor: 'rgba(201, 115, 106, 0.08)',
  },
  dashedRing: {
    borderStyle: 'dashed',
    borderColor: ObsidianTokens.colors.gold.muted,
  },
  diamondSquare: {
    width: 24,
    height: 24,
    borderWidth: 1,
    borderColor: ObsidianTokens.colors.gold.primary,
    transform: [{ rotate: '45deg' }],
  },
  dimSymbol: {
    fontSize: 26,
    color: ObsidianTokens.colors.ink.text55,
  },
  lossSymbol: {
    fontSize: 24,
    color: ObsidianTokens.colors.state.loss,
  },
  spinRing: {
    width: 68,
    height: 68,
    borderRadius: 34,
    borderWidth: 2,
    borderColor: ObsidianTokens.colors.gold.subtle,
    borderTopColor: ObsidianTokens.colors.gold.primary,
    marginVertical: 12,
  },
  timeBadge: {
    marginTop: 18,
    paddingVertical: 6,
    paddingHorizontal: 14,
    borderRadius: 999,
    backgroundColor: ObsidianTokens.colors.ink.fill,
    borderWidth: 1,
    borderColor: ObsidianTokens.colors.ink.hairline,
  },
  timeBadgeText: {
    fontFamily: Platform.select({ ios: 'SpaceMono', android: 'SpaceMono', default: 'monospace' }),
    fontSize: 10,
    color: ObsidianTokens.colors.gold.primary,
    letterSpacing: 2,
  },
  codePanel: {
    marginTop: 16,
    padding: 12,
    borderRadius: 10,
    backgroundColor: ObsidianTokens.colors.ink.fill,
    borderWidth: 1,
    borderColor: ObsidianTokens.colors.ink.hairline,
    width: '100%',
  },
  codeText: {
    fontFamily: Platform.select({ ios: 'SpaceMono', android: 'SpaceMono', default: 'monospace' }),
    fontSize: 10,
    color: ObsidianTokens.colors.state.loss,
    textAlign: 'center',
  },
  italicPanel: {
    marginTop: 16,
    padding: 14,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: ObsidianTokens.colors.ink.hairline,
    width: '100%',
  },
  italicText: {
    fontFamily: Platform.select({ ios: 'Georgia', android: 'serif', default: 'serif' }),
    fontSize: 14,
    fontStyle: 'italic',
    lineHeight: 20,
    color: ObsidianTokens.colors.ink.text42,
    textAlign: 'center',
  },
  miniCardsRow: {
    flexDirection: 'row',
    gap: 8,
    marginVertical: 10,
  },
  miniCardBack: {
    width: 48,
    height: 72,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: ObsidianTokens.colors.gold.muted,
    backgroundColor: ObsidianTokens.colors.ink.surface,
    overflow: 'hidden',
  },
  miniCardImage: {
    width: '100%',
    height: '100%',
  },
  miniCardOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(6, 7, 10, 0.65)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  miniCardDashed: {
    borderStyle: 'dashed',
    borderColor: ObsidianTokens.colors.ink.hairline,
  },
  miniLockText: {
    fontFamily: Platform.select({ ios: 'SpaceMono', android: 'SpaceMono', default: 'monospace' }),
    fontSize: 8,
    color: ObsidianTokens.colors.ink.text42,
  },
  orderPanel: {
    marginTop: 20,
    padding: 16,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: ObsidianTokens.colors.gold.muted,
    backgroundColor: ObsidianTokens.colors.gold.surface,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    width: '100%',
  },
  orderTitle: {
    fontFamily: Platform.select({ ios: 'Georgia', android: 'serif', default: 'serif' }),
    fontSize: 17,
    color: ObsidianTokens.colors.ink.text,
  },
  orderSub: {
    fontFamily: Platform.select({ ios: 'SpaceMono', android: 'SpaceMono', default: 'monospace' }),
    fontSize: 9,
    color: ObsidianTokens.colors.gold.primary,
    marginTop: 4,
    letterSpacing: 1,
  },
  orderArrow: {
    fontSize: 20,
    color: ObsidianTokens.colors.gold.primary,
  },
  statusPill: {
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 10,
    backgroundColor: ObsidianTokens.colors.ink.fill,
    borderWidth: 1,
    borderColor: ObsidianTokens.colors.ink.hairline,
    marginBottom: 16,
  },
  statusPillText: {
    fontFamily: Platform.select({ ios: 'SpaceMono', android: 'SpaceMono', default: 'monospace' }),
    fontSize: 9,
    color: ObsidianTokens.colors.ink.text55,
    letterSpacing: 1.2,
  },
  statsRow: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 22,
    width: '100%',
  },
  statBox: {
    flex: 1,
    paddingVertical: 12,
    paddingHorizontal: 8,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: ObsidianTokens.colors.ink.hairline,
    alignItems: 'center',
  },
  statLabel: {
    fontFamily: Platform.select({ ios: 'SpaceMono', android: 'SpaceMono', default: 'monospace' }),
    fontSize: 9,
    color: ObsidianTokens.colors.ink.text42,
    letterSpacing: 1,
  },
  statVal: {
    fontFamily: Platform.select({ ios: 'Georgia', android: 'serif', default: 'serif' }),
    fontSize: 16,
    color: ObsidianTokens.colors.ink.text,
    marginTop: 4,
  },
  actionFooter: {
    marginTop: 24,
    width: '100%',
  },
  actionFooterColumn: {
    marginTop: 22,
    width: '100%',
    gap: 10,
  },
  primaryGoldButton: {
    backgroundColor: ObsidianTokens.colors.gold.primary,
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  primaryButtonText: {
    fontFamily: Platform.select({ ios: 'SpaceMono', android: 'SpaceMono', default: 'monospace' }),
    fontSize: 11,
    letterSpacing: 1.5,
    fontWeight: '600',
    color: '#100C06',
  },
  primaryGoldBorderButton: {
    borderWidth: 1,
    borderColor: ObsidianTokens.colors.gold.primary,
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  primaryGoldBorderText: {
    fontFamily: Platform.select({ ios: 'SpaceMono', android: 'SpaceMono', default: 'monospace' }),
    fontSize: 11,
    letterSpacing: 1.5,
    color: ObsidianTokens.colors.gold.primary,
  },
  ghostButton: {
    borderRadius: 12,
    paddingVertical: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  ghostButtonText: {
    fontFamily: Platform.select({ ios: 'SpaceMono', android: 'SpaceMono', default: 'monospace' }),
    fontSize: 10,
    letterSpacing: 1.2,
    color: ObsidianTokens.colors.ink.text42,
  },
  walletSourcesContainer: {
    width: '100%',
    marginTop: 14,
    gap: 8,
  },
  walletSourcesHeader: {
    fontFamily: Platform.select({ ios: 'SpaceMono', android: 'SpaceMono', default: 'monospace' }),
    color: ObsidianTokens.colors.gold.primary,
    fontSize: 8,
    letterSpacing: 1.5,
    marginBottom: 2,
    textAlign: 'center',
  },
  walletSourceCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: ObsidianTokens.colors.ink.fill,
    borderColor: ObsidianTokens.colors.ink.hairline,
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  walletSourceInfo: {
    flex: 1,
  },
  walletSourceName: {
    fontFamily: Platform.select({ ios: 'SpaceMono', android: 'SpaceMono', default: 'monospace' }),
    color: ObsidianTokens.colors.ink.text,
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
  walletSourceType: {
    fontFamily: Platform.select({ ios: 'Georgia', android: 'serif', default: 'serif' }),
    color: ObsidianTokens.colors.ink.text42,
    fontSize: 10,
    fontStyle: 'italic',
    marginTop: 1,
  },
  walletSourceButtons: {
    flexDirection: 'row',
    gap: 6,
    alignItems: 'center',
  },
  walletPillBtn: {
    backgroundColor: 'rgba(200, 162, 74, 0.15)',
    borderColor: ObsidianTokens.colors.gold.primary,
    borderWidth: 1,
    borderRadius: 999,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  walletPillBtnText: {
    fontFamily: Platform.select({ ios: 'SpaceMono', android: 'SpaceMono', default: 'monospace' }),
    color: ObsidianTokens.colors.gold.primary,
    fontSize: 8,
    letterSpacing: 0.8,
    fontWeight: '600',
  },
  walletPillGhostBtn: {
    borderColor: ObsidianTokens.colors.ink.hairline,
    borderWidth: 1,
    borderRadius: 999,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  walletPillGhostText: {
    fontFamily: Platform.select({ ios: 'SpaceMono', android: 'SpaceMono', default: 'monospace' }),
    color: ObsidianTokens.colors.ink.text55,
    fontSize: 8,
    letterSpacing: 0.8,
  },
});

export default SystemStateModal;
