import { clusterApiUrl } from '@solana/web3.js'
import { Cluster } from '@/components/cluster/cluster'
import { ClusterNetwork } from '@/components/cluster/cluster-network'

export const APP_IDENTITY = {
  name: 'Arkana: The Solana Oracle',
  uri: 'https://github.com/wakanda-soul/arkana',
  icon: 'https://raw.githubusercontent.com/wakanda-soul/arkana/main/arkana-app/assets/images/icon.png',
}

export class AppConfig {
  static name = 'Arkana'
  static uri = 'https://github.com/wakanda-soul/arkana'
  static identity = APP_IDENTITY
  static clusters: Cluster[] = [
    {
      id: 'solana:mainnet',
      name: 'Mainnet',
      endpoint: clusterApiUrl('mainnet-beta'),
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

