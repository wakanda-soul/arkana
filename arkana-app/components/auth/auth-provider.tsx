import { createContext, type PropsWithChildren, use, useEffect, useMemo } from 'react'
import { useMobileWallet } from '@wallet-ui/react-native-web3js'
import { AppConfig } from '@/constants/app-config'
import { useMutation } from '@tanstack/react-query'
import AsyncStorage from '@react-native-async-storage/async-storage'
import { soundService } from '@/services/soundService'
import { ensureWalletSession, clearWalletSession } from '@/services/sessionService'
import { resubmitPendingPayments } from '@/services/oracleApi'

export interface AuthState {
  isAuthenticated: boolean
  signIn: () => Promise<any>
  signOut: () => Promise<void>
  account: any
  isLoading: boolean
}

const Context = createContext<AuthState>({} as AuthState)

export function useAuth() {
  const value = use(Context)
  if (!value) {
    throw new Error('useAuth must be wrapped in a <AuthProvider />')
  }

  return value
}

function useConnectMutation() {
  const { connect, signIn } = useMobileWallet()

  return useMutation({
    mutationFn: async () => {
      try {
        // Clear any stale cached authorization token first to guarantee a fresh MWA handshake
        await AsyncStorage.removeItem('arkana_wallet_authorization')
        return await connect()
      } catch (err: any) {
        console.warn('[Auth] Standard connect failed, evaluating fallback:', err)
        const isCancellation =
          err?.code === -32003 ||
          /reject|denied|declined/i.test(String(err?.message || ''))
        if (isCancellation) {
          throw err
        }
        try {
          await AsyncStorage.removeItem('arkana_wallet_authorization')
          return await signIn({
            uri: AppConfig.uri,
          })
        } catch (signInErr: any) {
          console.error('[Auth] Both connect and signIn failed:', signInErr)
          throw err || signInErr
        }
      }
    },
  })
}

export function AuthProvider({ children }: PropsWithChildren) {
  const { accounts, disconnect, signMessage } = useMobileWallet()
  const connectMutation = useConnectMutation()
  const walletAddress = accounts?.[0]?.publicKey?.toBase58?.() ?? null

  // One free message signature per wallet (renewed every ~30 days) proves to the server
  // that requests spending this wallet's quota come from its owner.
  useEffect(() => {
    if (!walletAddress) return
    ensureWalletSession(walletAddress, (message) => signMessage(message))
      // Passes and offerings paid while the server was unreachable are sent again once signed in
      .then(() => resubmitPendingPayments(walletAddress))
      .catch((err) => console.warn('[Auth] Wallet session sign-in skipped:', err?.message || err))
  }, [walletAddress, signMessage])

  const value: AuthState = useMemo(
    () => ({
      signIn: async () => {
        try {
          await AsyncStorage.removeItem('arkana_wallet_authorization')
          const result = await connectMutation.mutateAsync()
          soundService.playWalletConnected()
          return result
        } catch (err) {
          soundService.playTxError()
          throw err
        }
      },
      signOut: async () => {
        try {
          await AsyncStorage.removeItem('arkana_wallet_authorization')
        } catch {}
        await clearWalletSession()
        soundService.playWalletDisconnect()
        await disconnect()
      },
      isAuthenticated: (accounts?.length ?? 0) > 0,
      account: accounts?.[0] ?? null,
      isLoading: connectMutation.isPending,
    }),
    [accounts, disconnect, connectMutation],
  )

  return <Context value={value}>{children}</Context>
}
