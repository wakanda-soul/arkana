import {
  Connection,
  PublicKey,
  TransactionInstruction,
  TransactionMessage,
  VersionedTransaction,
  AddressLookupTableAccount,
} from '@solana/web3.js';
import { transact, Web3MobileWallet } from '@solana-mobile/mobile-wallet-adapter-protocol-web3js';
import { APP_IDENTITY } from '@/constants/app-config';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Buffer } from 'buffer';

export const SOLANA_MEMO_PROGRAM_ID = new PublicKey('MemoSq4gqABAXKb96qnH8TysNcWxMyWCqXgDLGmfcHr');

export interface ConsensusProofPayload {
  cardNo: string;
  orientation: 'UPRIGHT' | 'REVERSED';
  dateStr: string;
  timestamp: number;
}

export function buildConsensusMemoData(payload: ConsensusProofPayload): Buffer {
  const memoString = `ARKANA::CONSENSUS::v1::CARD=${payload.cardNo}::ORIENTATION=${payload.orientation}::DATE=${payload.dateStr}::TS=${payload.timestamp}`;
  return Buffer.from(memoString, 'utf-8');
}

export function createConsensusMemoInstruction(
  walletPublicKey: PublicKey,
  payload: ConsensusProofPayload
): TransactionInstruction {
  return new TransactionInstruction({
    programId: SOLANA_MEMO_PROGRAM_ID,
    keys: [{ pubkey: walletPublicKey, isSigner: true, isWritable: false }],
    data: buildConsensusMemoData(payload),
  });
}

export interface ExecuteTransactionParams {
  connection: Connection;
  payerKey: PublicKey;
  instructions: TransactionInstruction[];
  addressLookupTableAccounts?: AddressLookupTableAccount[];
  signAndSendTransactions?: (transaction: any, minContextSlot: any) => Promise<any>;
}

/**
 * Universal Solana Mobile transaction executor adhering strictly to
 * official Solana Mobile Hackathon / MWA 2.0 standards:
 * 1. Fetches blockhash & slot with getLatestBlockhashAndContext.
 * 2. Compiles modern VersionedTransaction (compileToV0Message).
 * 3. Signs & sends via signAndSendTransactions or direct MWA transact fallback.
 */
export async function executeSolanaTransaction({
  connection,
  payerKey,
  instructions,
  addressLookupTableAccounts,
  signAndSendTransactions,
}: ExecuteTransactionParams): Promise<{ signature: string; slot?: number }> {
  let blockhash: string;
  let minContextSlot: number;
  try {
    const res = await connection.getLatestBlockhashAndContext('confirmed');
    blockhash = res.value.blockhash;
    minContextSlot = res.context.slot;
  } catch {
    const bh = await connection.getLatestBlockhash('confirmed');
    blockhash = bh.blockhash;
    try {
      minContextSlot = await connection.getSlot('confirmed');
    } catch {
      minContextSlot = await connection.getSlot();
    }
  }

  const message = new TransactionMessage({
    payerKey,
    recentBlockhash: blockhash,
    instructions,
  }).compileToV0Message(addressLookupTableAccounts);

  const versionedTx = new VersionedTransaction(message);

  let signature: string | undefined;

  if (signAndSendTransactions) {
    try {
      const result = await signAndSendTransactions(versionedTx, minContextSlot);
      signature = Array.isArray(result) ? result[0] : (typeof result === 'string' ? result : String(result));
    } catch (err: any) {
      const isUserCancellation =
        err?.code === -32003 ||
        /reject|denied|declined/i.test(String(err?.message || '')) ||
        (err?.code === -1 && /reject|denied|cancel/i.test(String(err?.message || '')));
      if (isUserCancellation) {
        throw err;
      }

      // Only attempt re-authorization fallback if strictly an auth/session token invalidation
      const isAuthError =
        err?.code === -32000 ||
        /auth|session|unauthorized|token/i.test(String(err?.message || ''));
      if (isAuthError) {
        try {
          await AsyncStorage.removeItem('arkana_wallet_authorization');
        } catch {}

        signature = await transact(async (wallet: Web3MobileWallet) => {
          await wallet.authorize({
            chain: 'solana:mainnet',
            identity: APP_IDENTITY,
          });
          const sigs = await wallet.signAndSendTransactions({
            transactions: [versionedTx],
            minContextSlot,
          });
          return sigs[0];
        });
      } else {
        throw err;
      }
    }
  } else {
    signature = await transact(async (wallet: Web3MobileWallet) => {
      await wallet.authorize({
        chain: 'solana:mainnet',
        identity: APP_IDENTITY,
      });
      const sigs = await wallet.signAndSendTransactions({
        transactions: [versionedTx],
        minContextSlot,
      });
      return sigs[0];
    });
  }

  let slot: number | undefined = minContextSlot;
  try {
    slot = await connection.getSlot('confirmed');
  } catch {}

  return { signature: signature!, slot };
}

export interface SubmitProofParams {
  connection: Connection;
  walletPublicKey: PublicKey;
  signAndSendTransactions?: (transaction: any, minContextSlot: any) => Promise<any>;
  cardNo: string;
  orientation: 'UPRIGHT' | 'REVERSED';
}

export async function submitConsensusProofOnChain({
  connection,
  walletPublicKey,
  signAndSendTransactions,
  cardNo,
  orientation,
}: SubmitProofParams): Promise<{ signature: string; slot?: number }> {
  const todayDate = new Date().toISOString().split('T')[0];
  const payload: ConsensusProofPayload = {
    cardNo,
    orientation,
    dateStr: todayDate,
    timestamp: Date.now(),
  };

  const instruction = createConsensusMemoInstruction(walletPublicKey, payload);

  return await executeSolanaTransaction({
    connection,
    payerKey: walletPublicKey,
    instructions: [instruction],
    signAndSendTransactions,
  });
}

export const SKR_MINT = new PublicKey('SKRbvo6Gf7GondiT3BbTfuRDPqLWei4j2Qy2NPGZhW3');

export async function fetchRealSkrBalance(
  connection: Connection,
  walletPublicKey: PublicKey
): Promise<number> {
  try {
    const tokenAccounts = await connection.getParsedTokenAccountsByOwner(walletPublicKey, {
      mint: SKR_MINT,
    });
    if (!tokenAccounts.value || tokenAccounts.value.length === 0) {
      return 0;
    }
    let total = 0;
    for (const item of tokenAccounts.value) {
      const amount = item.account.data.parsed?.info?.tokenAmount?.uiAmount;
      if (typeof amount === 'number') {
        total += amount;
      }
    }
    return total;
  } catch (err) {
    console.warn('Error fetching SKR balance:', err);
    return 0;
  }
}

export async function fetchRealSolBalance(
  connection: Connection,
  walletPublicKey: PublicKey
): Promise<number> {
  try {
    const lamports = await connection.getBalance(walletPublicKey, 'confirmed');
    return lamports / 1e9;
  } catch (err) {
    console.warn('Error fetching SOL balance:', err);
    return 0;
  }
}

export const SGT_MINT_AUTHORITY = 'GT2zuHVaZQYZSyQMgJPLzvkmyztfyXg2NJunqFp4p3A4';
export const SGT_GROUP_ADDRESS = 'GT22s89nU4iWFkNXj1Bw6uYhJJWDRPpShHt4Bk8f99Te';
export const TOKEN_2022_PROGRAM_ID = new PublicKey('TokenzQdBNbLqP5VEhdkAS6EPFLC1PHnBqCXEpPxuEb');

export async function checkSeekerGenesisHolderOnChain(
  connection: Connection,
  walletPublicKey: PublicKey
): Promise<boolean> {
  try {
    const tokenAccounts = await connection.getParsedTokenAccountsByOwner(walletPublicKey, {
      programId: TOKEN_2022_PROGRAM_ID,
    });
    if (!tokenAccounts.value || tokenAccounts.value.length === 0) {
      return false;
    }
    for (const item of tokenAccounts.value) {
      const parsed = item.account.data.parsed?.info;
      if (!parsed) continue;
      const amount = parsed.tokenAmount?.uiAmount;
      const mint = parsed.mint;
      if (amount && amount > 0 && mint) {
        try {
          const mintInfo = await connection.getParsedAccountInfo(new PublicKey(mint));
          const mintParsed = (mintInfo.value?.data as any)?.parsed?.info;
          if (mintParsed?.mintAuthority === SGT_MINT_AUTHORITY) {
            return true;
          }
        } catch {}
      }
    }
    return false;
  } catch (err) {
    console.warn('Failed to verify Seeker Genesis SBT on-chain:', err);
    return false;
  }
}
