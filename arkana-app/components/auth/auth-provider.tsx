import { createContext, type PropsWithChildren, use, useMemo } from 'react'
import { useMobileWallet } from '@wallet-ui/react-native-web3js'
import { AppConfig } from '@/constants/app-config'
import { useMutation } from '@tanstack/react-query'

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

import AsyncStorage from '@react-native-async-storage/async-storage'

function useConnectMutation() {
  const { connect } = useMobileWallet()

  return useMutation({
    mutationFn: async () => {
      try {
        // Clear any stale cached authorization token first to guarantee a fresh MWA handshake
        await AsyncStorage.removeItem('arkana_wallet_authorization')
        return await connect()
      } catch (err: any) {
        console.warn('[Auth] Connect failed or cancelled:', err)
        try {
          await AsyncStorage.removeItem('arkana_wallet_authorization')
        } catch {}
        throw err
      }
    },
  })
}

export function AuthProvider({ children }: PropsWithChildren) {
  const { accounts, disconnect } = useMobileWallet()
  const connectMutation = useConnectMutation()

  const value: AuthState = useMemo(
    () => ({
      signIn: async () => {
        try {
          await AsyncStorage.removeItem('arkana_wallet_authorization')
        } catch {}
        return await connectMutation.mutateAsync()
      },
      signOut: async () => {
        try {
          await AsyncStorage.removeItem('arkana_wallet_authorization')
        } catch {}
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
