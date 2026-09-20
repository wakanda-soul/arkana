import { router } from 'expo-router'
import { useAuth } from '@/components/auth/auth-provider'
import { SafeAreaView } from 'react-native-safe-area-context'
import { View, Text, Pressable, StyleSheet, Platform } from 'react-native'
import { Image } from 'expo-image'
import { useState } from 'react'
import * as Haptics from 'expo-haptics'
import { showError } from '@/utils/show-error'
import { ObsidianTokens } from '@/constants/theme'
import { SystemStateModal, SystemStateType } from '@/components/ui/SystemStateModal'

export default function SignIn() {
  const { signIn } = useAuth()
  const [isSigningIn, setIsSigningIn] = useState(false)
  const [systemState, setSystemState] = useState<SystemStateType>(null)

  // Sign-in goes through the wallet, which can decline or fail the request.
  async function handleSignIn() {
    if (isSigningIn) {
      return
    }
    setIsSigningIn(true)
    try {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium)
      await signIn()
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success)
      // We only get here when sign-in succeeded, so it is safe to navigate.
      router.replace('/')
    } catch (error: any) {
      const errStr = String(error?.message || error || '')
      if (
        errStr.includes('WALLET_NOT_FOUND') ||
        errStr.includes('ActivityNotFound') ||
        errStr.includes('no installed wallet') ||
        errStr.includes('not found')
      ) {
        setSystemState('wallet_not_found')
      } else {
        setSystemState('wallet_declined')
      }
    } finally {
      setIsSigningIn(false)
    }
  }

  return (
    <View style={styles.container}>
      <SafeAreaView style={styles.safeArea}>
        {/* Dummy spacer */}
        <View />

        {/* Center branding */}
        <View style={styles.brandContainer}>
          <View style={styles.iconHalo}>
            <Image
              source={require('../assets/images/icon.png')}
              style={styles.logoImage}
              contentFit="contain"
            />
          </View>
          <Text style={styles.kicker}>SOLANA MOBILE · SEED VAULT</Text>
          <Text style={styles.title}>ARKANA</Text>
          <Text style={styles.subtitle}>
            Algorithmic oracle and decentralized tarot on Solana. Connect your Seeker wallet to consult the cards and seal your rites.
          </Text>
        </View>

        {/* Action Button */}
        <View style={styles.buttonWrapper}>
          <Pressable
            style={({ pressed }) => [
              styles.connectBtn,
              pressed && styles.connectBtnPressed,
              isSigningIn && styles.connectBtnDisabled,
            ]}
            disabled={isSigningIn}
            onPress={() => void handleSignIn()}
          >
            <Text style={styles.connectBtnText}>
              {isSigningIn ? 'CONNECTING WALLET...' : 'CONNECT WALLET'}
            </Text>
          </Pressable>

          <Text style={styles.securityNote}>
            Secured by Solana Seed Vault & Hardware Keystore
          </Text>
        </View>
      </SafeAreaView>

      <SystemStateModal
        type={systemState}
        visible={!!systemState}
        onClose={() => setSystemState(null)}
        onActionPrimary={() => void handleSignIn()}
        onActionSecondary={() => setSystemState(null)}
      />
    </View>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: ObsidianTokens.colors.ink.void,
  },
  safeArea: {
    flex: 1,
    justifyContent: 'space-between',
    paddingHorizontal: ObsidianTokens.spacing.screenGutter,
  },
  brandContainer: {
    alignItems: 'center',
  },
  iconHalo: {
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: 'rgba(200, 162, 74, 0.08)',
    borderColor: 'rgba(200, 162, 74, 0.3)',
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 24,
    shadowColor: ObsidianTokens.colors.gold.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 16,
    elevation: 8,
  },
  logoImage: {
    width: 80,
    height: 80,
    borderRadius: 40,
  },
  kicker: {
    fontFamily: Platform.select({ ios: 'SpaceMono', android: 'SpaceMono', default: 'monospace' }),
    color: ObsidianTokens.colors.gold.primary,
    fontSize: 9,
    letterSpacing: 2.2,
    marginBottom: 8,
  },
  title: {
    fontFamily: Platform.select({ ios: 'Georgia', android: 'serif', default: 'serif' }),
    color: ObsidianTokens.colors.ink.text,
    fontSize: 34,
    fontWeight: '300',
    letterSpacing: 4,
    marginBottom: 12,
  },
  subtitle: {
    fontFamily: Platform.select({ ios: 'Georgia', android: 'serif', default: 'serif' }),
    color: ObsidianTokens.colors.ink.text55,
    fontSize: 13,
    lineHeight: 20,
    textAlign: 'center',
    maxWidth: 290,
  },
  buttonWrapper: {
    marginBottom: 24,
    alignItems: 'center',
  },
  connectBtn: {
    width: '100%',
    backgroundColor: ObsidianTokens.colors.gold.primary,
    borderRadius: 14,
    paddingVertical: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  connectBtnPressed: {
    transform: [{ scale: 0.98 }],
    opacity: 0.9,
  },
  connectBtnDisabled: {
    opacity: 0.5,
  },
  connectBtnText: {
    fontFamily: Platform.select({ ios: 'SpaceMono', android: 'SpaceMono', default: 'monospace' }),
    color: '#0D0904',
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 1.8,
  },
  securityNote: {
    fontFamily: Platform.select({ ios: 'SpaceMono', android: 'SpaceMono', default: 'monospace' }),
    color: ObsidianTokens.colors.ink.text42,
    fontSize: 9,
    letterSpacing: 0.5,
    marginTop: 12,
  },
})
