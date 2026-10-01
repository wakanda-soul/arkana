import { createContext, type PropsWithChildren, use, useEffect, useMemo } from 'react'
import { useMobileWallet } from '@wallet-ui/react-native-web3js'
import { AppConfig } from '@/constants/app-config'
import { useMutation } from '@tanstack/react-query'
import AsyncStorage from '@react-native-async-storage/async-storage'
import { soundService } from '@/services/soundService'
import { clearWalletSession, completeSiwsSignIn, fetchSiwsPayload, hasValidSession, setSessionSigner } from '@/services/sessionService'
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

/** Set while a connect is in flight, so the launch check does not mistake it for a lost session. */
let connectInFlight: Promise<unknown> | null = null

/**
 * Connect and sign in with one wallet visit (Sign In With Solana): the wallet shows the connection
 * and the free sign-in message together, and the session it yields lasts 30 days per wallet.
 */
function useConnectMutation() {
  const { signIn, disconnect } = useMobileWallet()

  return useMutation({
    mutationFn: async () => {
      const run = (async () => {
        // Fetched while the app is in the foreground: the network is blocked once the wallet opens
        const payload = await fetchSiwsPayload()
        await AsyncStorage.removeItem('arkana_wallet_authorization')
        const result = await signIn({ ...payload, uri: AppConfig.uri })
        const wallet = result.account.publicKey.toBase58()
        try {
          await completeSiwsSignIn(wallet, result.signedMessage, result.signature)
        } catch (err) {
          await disconnect().catch(() => {})
          throw err
        }
        return result.account
      })()
      connectInFlight = run
      try {
        return await run
      } finally {
        connectInFlight = null
      }
    },
  })
}

export function AuthProvider({ children }: PropsWithChildren) {
  const { accounts, disconnect, signMessage } = useMobileWallet()
  const connectMutation = useConnectMutation()
  const walletAddress = accounts?.[0]?.publicKey?.toBase58?.() ?? null

  useEffect(() => {
    // Lets API calls renew a session the server no longer knows, after a user action
    setSessionSigner(walletAddress, (message) => signMessage(message))
    if (!walletAddress) return
    let cancelled = false
    ;(async () => {
      await connectInFlight?.catch(() => {})
      if (cancelled) return
      if (await hasValidSession(walletAddress)) {
        // Passes and offerings paid while the server was unreachable are sent again
        resubmitPendingPayments(walletAddress).catch(() => {})
      } else {
        // The 30-day session ran out: show the wallet as disconnected instead of popping up a
        // signature request nobody asked for. CONNECT signs in again in one wallet visit.
        disconnect().catch(() => {})
      }
    })()
    return () => {
      cancelled = true
    }
  }, [walletAddress, signMessage, disconnect])

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
