import { clusterApiUrl, PublicKey } from '@solana/web3.js';
import { ClusterNetwork } from '@/components/cluster/cluster-network';

export type SupportedNetwork = 'mainnet' | 'devnet';

/**
 * ACTIVE SOLANA NETWORK TOGGLE
 * Set to 'devnet' to test all vaults, tranches, tokens (tSKR, tORE), and yields on Devnet.
 * Set to 'mainnet' to immediately restore full production mainnet configuration.
 */
export const ACTIVE_NETWORK: SupportedNetwork = 'mainnet';

export type SolanaChainId = 'solana:mainnet' | 'solana:devnet' | 'solana:testnet';

export interface NetworkConfig {
  network: SupportedNetwork;
  clusterId: SolanaChainId;
  clusterName: string;
  clusterNetwork: ClusterNetwork;
  endpoint: string;
  skrMint: PublicKey;
  oreMint: PublicKey;
  oreStakeProgramId: PublicKey;
  treasuryAddress: PublicKey;
  arkanaVaultProgramId: PublicKey;
  explorerSuffix: string;
}

export const MAINNET_CONFIG: NetworkConfig = {
  network: 'mainnet',
  clusterId: 'solana:mainnet',
  clusterName: 'Mainnet',
  clusterNetwork: ClusterNetwork.Mainnet,
  endpoint: 'https://solana-rpc.publicnode.com',
  skrMint: new PublicKey('SKRbvo6Gf7GondiT3BbTfuRDPqLWei4j2Qy2NPGZhW3'),
  oreMint: new PublicKey('oreoU2P8bN6jkk3jbaiVxYnG1dCXcYxwhwyK9jSybcp'),
  oreStakeProgramId: new PublicKey('stakecNP3FpiExZPCgZfqRgumVzi6dNqnfrjwXyTgeH'),
  treasuryAddress: new PublicKey('4v3d1itZVjLtDQEqGLFLtfr1riffAEcqnNtumEumJgny'),
  arkanaVaultProgramId: new PublicKey('B49g3obWUCPQzP9kdcRiCPJDurufWhJhszpQsK5eeV8C'),
  explorerSuffix: '',
};

export const DEVNET_CONFIG: NetworkConfig = {
  network: 'devnet',
  clusterId: 'solana:devnet',
  clusterName: 'Devnet',
  clusterNetwork: ClusterNetwork.Devnet,
  endpoint: clusterApiUrl('devnet'),
  skrMint: new PublicKey('5on8PXvXKH3sKzWe9xJVyBR4dgg421Bt22CXKCSL6A5X'), // Devnet tSKR
  oreMint: new PublicKey('8eAPs1imRaRzk89UzSbBDzfG6eta8e4HRv8sHJ44wu77'), // Devnet tORE
  oreStakeProgramId: new PublicKey('stakecNP3FpiExZPCgZfqRgumVzi6dNqnfrjwXyTgeH'),
  treasuryAddress: new PublicKey('4v3d1itZVjLtDQEqGLFLtfr1riffAEcqnNtumEumJgny'),
  arkanaVaultProgramId: new PublicKey('B49g3obWUCPQzP9kdcRiCPJDurufWhJhszpQsK5eeV8C'),
  explorerSuffix: '?cluster=devnet',
};

export function getNetworkConfig(): NetworkConfig {
  return ACTIVE_NETWORK === 'devnet' ? DEVNET_CONFIG : MAINNET_CONFIG;
}

export function isDevnet(): boolean {
  return ACTIVE_NETWORK === 'devnet';
}
