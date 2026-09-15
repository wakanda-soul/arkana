import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { MobileWalletProvider } from '@wallet-ui/react-native-web3js'
import { PropsWithChildren } from 'react'
import { AuthProvider } from '@/components/auth/auth-provider'
import { ClusterProvider, useCluster } from '@/components/cluster/cluster-provider'
import { AppTheme } from '@/components/app-theme'
import { LanguageProvider } from '@/services/i18n'
import { walletAuthorizationCache } from '@/services/walletCache'

const identity = {
  name: 'Arkana: The Solana Oracle',
  uri: 'https://arkana-oracle.com',
  icon: 'favicon.ico',
}
const queryClient = new QueryClient()
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
      cache={walletAuthorizationCache}
      chain={selectedCluster.id}
      endpoint={selectedCluster.endpoint}
      identity={identity}
    >
      {children}
    </MobileWalletProvider>
  )
}
