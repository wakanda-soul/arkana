import { clusterApiUrl } from '@solana/web3.js'
import { Cluster } from '@/components/cluster/cluster'
import { ClusterNetwork } from '@/components/cluster/cluster-network'

export const APP_IDENTITY = {
  name: 'Arkana',
  uri: 'https://arkana.icu',
  // Resolved against uri by the wallet: https://arkana.icu/images/logo-512.png
  icon: 'images/logo-512.png',
}

export class AppConfig {
  static name = 'Arkana'
  static uri = 'https://arkana.icu'
  static identity = APP_IDENTITY
  static clusters: Cluster[] = [
    {
      id: 'solana:mainnet',
      name: 'Mainnet',
      endpoint: 'https://solana-rpc.publicnode.com',
      network: ClusterNetwork.Mainnet,
    },
    {
      id: 'solana:devnet',
      name: 'Devnet',
      endpoint: clusterApiUrl('devnet'),
      network: ClusterNetwork.Devnet,
    },
    {
      id: 'solana:testnet',
      name: 'Testnet',
      endpoint: clusterApiUrl('testnet'),
      network: ClusterNetwork.Testnet,
    },
  ]
}

