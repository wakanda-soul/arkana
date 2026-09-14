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

function useConnectMutation() {
  const { connect, signIn } = useMobileWallet()

  return useMutation({
    mutationFn: async () => {
      try {
        return await connect()
      } catch (err: any) {
        console.warn('[Auth] Standard connect failed, attempting signIn fallback:', err)
        try {
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
  const { accounts, disconnect } = useMobileWallet()
  const connectMutation = useConnectMutation()

  const value: AuthState = useMemo(
    () => ({
      signIn: async () => await connectMutation.mutateAsync(),
      signOut: async () => await disconnect(),
      isAuthenticated: (accounts?.length ?? 0) > 0,
      account: accounts?.[0] ?? null,
      isLoading: connectMutation.isPending,
    }),
    [accounts, disconnect, connectMutation],
  )

  return <Context value={value}>{children}</Context>
}
