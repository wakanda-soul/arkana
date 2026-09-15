import AsyncStorage from '@react-native-async-storage/async-storage';
import { PublicKey } from '@solana/web3.js';
import type { WalletAuthorization, WalletAuthorizationCache } from '@wallet-ui/react-native-web3js';

const STORAGE_KEY = 'arkana_wallet_authorization_session_v1';

function cacheReviver(key: string, value: any) {
  if (key === 'publicKey' && typeof value === 'string') {
    try {
      return new PublicKey(value);
    } catch {
      return value;
    }
  }
  return value;
}

export class PersistentWalletAuthCache implements WalletAuthorizationCache {
  private readonly storageKey: string;

  constructor(storageKey: string = STORAGE_KEY) {
    this.storageKey = storageKey;
  }

  async clear(): Promise<void> {
    try {
      await AsyncStorage.removeItem(this.storageKey);
    } catch (err) {
      console.warn('[WalletCache] Failed to clear wallet authorization cache:', err);
    }
  }

  async get(): Promise<WalletAuthorization | undefined> {
    try {
      const raw = await AsyncStorage.getItem(this.storageKey);
      if (!raw) return undefined;
      const parsed = JSON.parse(raw, cacheReviver);
      if (parsed?.selectedAccount?.address && typeof parsed.selectedAccount.address === 'string') {
        parsed.selectedAccount.address = new PublicKey(parsed.selectedAccount.address);
      }
      if (Array.isArray(parsed?.accounts)) {
        parsed.accounts = parsed.accounts.map((acc: any) => ({
          ...acc,
          address: typeof acc.address === 'string' ? new PublicKey(acc.address) : acc.address,
        }));
      }
      return parsed as WalletAuthorization;
    } catch (err) {
      console.warn('[WalletCache] Failed to read cached wallet authorization:', err);
      return undefined;
    }
  }

  async set(value: WalletAuthorization | undefined): Promise<void> {
    try {
      if (!value) {
        await this.clear();
        return;
      }
      await AsyncStorage.setItem(this.storageKey, JSON.stringify(value));
    } catch (err) {
      console.warn('[WalletCache] Failed to persist wallet authorization:', err);
    }
  }
}

export const walletAuthorizationCache = new PersistentWalletAuthCache();
