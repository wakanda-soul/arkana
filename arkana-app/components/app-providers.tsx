import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { MobileWalletProvider, WalletAuthorizationCache, WalletAuthorization } from '@wallet-ui/react-native-web3js'
import AsyncStorage from '@react-native-async-storage/async-storage'
import { PropsWithChildren } from 'react'
import { AuthProvider } from '@/components/auth/auth-provider'
import { ClusterProvider, useCluster } from '@/components/cluster/cluster-provider'
import { AppTheme } from '@/components/app-theme'
import { LanguageProvider } from '@/services/i18n'

import { APP_IDENTITY } from '@/constants/app-config'
import { PublicKey } from '@solana/web3.js'

const identity = APP_IDENTITY
const queryClient = new QueryClient()

function cacheReviver(key: string, value: any) {
  if (key === 'publicKey' || key === 'address') {
    try {
      return new PublicKey(value)
    } catch {
      return value
    }
  }
  return value
}

function createAsyncStorageCache(key: string): WalletAuthorizationCache {
  return {
    async clear(): Promise<void> {
      try {
        await AsyncStorage.removeItem(key)
      } catch {}
    },
    async get(): Promise<WalletAuthorization | undefined> {
      try {
        const item = await AsyncStorage.getItem(key)
        return item ? (JSON.parse(item, cacheReviver) as WalletAuthorization) : undefined
      } catch {
        return undefined
      }
    },
    async set(value: WalletAuthorization | undefined): Promise<void> {
      try {
        if (value) {
          await AsyncStorage.setItem(key, JSON.stringify(value))
        } else {
          await AsyncStorage.removeItem(key)
        }
      } catch {}
    },
  }
}

const walletCache = createAsyncStorageCache('arkana_wallet_authorization')

export function AppProviders({ children }: PropsWithChildren) {
  return (
    <AppTheme>
      <LanguageProvider>
        <QueryClientProvider client={queryClient}>
          <ClusterProvider>
            <SolanaProvider>
              <AuthProvider>{children}</AuthProvider>
            </SolanaProvider>
          </ClusterProvider>
        </QueryClientProvider>
      </LanguageProvider>
    </AppTheme>
  )
}

// We have this SolanaProvider because of the network switching logic.
// If you only connect to a single network, use MobileWalletProvider directly.
function SolanaProvider({ children }: PropsWithChildren) {
  const { selectedCluster } = useCluster()
  return (
    <MobileWalletProvider
      cache={walletCache}
      chain={selectedCluster.id}
      endpoint={selectedCluster.endpoint}
      identity={identity}
    >
      {children}
    </MobileWalletProvider>
  )
}
