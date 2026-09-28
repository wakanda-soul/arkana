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
import { getNetworkConfig, isDevnet } from '@/constants/networkConfig';
import { API_BASE_URL } from '@/services/oracleApi';
import { getAssociatedTokenAddressSync } from '@solana/spl-token';
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
  instructions?: TransactionInstruction[];
  addressLookupTableAccounts?: AddressLookupTableAccount[];
  /** Builds several transactions from the fresh blockhash; all are approved in ONE wallet prompt. */
  buildTransactions?: (blockhash: string) => VersionedTransaction[];
  signAndSendTransactions?: (transaction: any, minContextSlot: any) => Promise<any>;
  /** Memo prefix of the payment. If the wallet sends the transactions but its reply never reaches
   *  the app (MWA session dropped while switching apps), the signatures are recovered from chain. */
  recoverMemo?: string;
}

const RECOVERY_START_MS = 15_000;
const RECOVERY_POLL_MS = 4_000;
const RECOVERY_TIMEOUT_MS = 180_000;

async function fetchRecentSignatures(wallet: string, limit: number): Promise<any[]> {
  // Through the Arkana RPC proxy: public RPCs often refuse getSignaturesForAddress
  const res = await fetch(`${API_BASE_URL}/api/solana-rpc`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'getSignaturesForAddress', params: [wallet, { limit, commitment: 'confirmed' }] }),
  });
  const data = await res.json();
  return Array.isArray(data?.result) ? data.result : [];
}

/** Waits for the payment to show up on chain; resolves with its signatures, memo transaction first. */
function watchForLandedPayment(
  wallet: string,
  memo: string,
  count: number,
  sinceSec: number,
  isDone: () => boolean
): Promise<string[]> {
  return new Promise((resolve) => {
    const deadline = Date.now() + RECOVERY_TIMEOUT_MS;
    const tick = async () => {
      if (isDone() || Date.now() > deadline) return;
      try {
        const fresh = (await fetchRecentSignatures(wallet, count + 4)).filter(
          (s) => !s.err && (s.blockTime ?? 0) >= sinceSec
        );
        const memoTx = fresh.find((s) => typeof s.memo === 'string' && s.memo.includes(memo));
        if (memoTx && !isDone()) {
          const others = fresh.filter((s) => s.signature !== memoTx.signature).slice(0, count - 1);
          return resolve([memoTx.signature, ...others.map((s) => s.signature)]);
        }
      } catch {}
      setTimeout(tick, RECOVERY_POLL_MS);
    };
    setTimeout(tick, RECOVERY_START_MS);
  });
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
  buildTransactions,
  signAndSendTransactions,
  recoverMemo,
}: ExecuteTransactionParams): Promise<{ signature: string; signatures: string[]; slot?: number }> {
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

  const transactions: VersionedTransaction[] = buildTransactions
    ? buildTransactions(blockhash)
    : [
        new VersionedTransaction(
          new TransactionMessage({
            payerKey,
            recentBlockhash: blockhash,
            instructions: instructions || [],
          }).compileToV0Message(addressLookupTableAccounts)
        ),
      ];

  let signatures: string[] = [];
  const toSignatureList = (result: any): string[] =>
    (Array.isArray(result) ? result : [result]).map((r: any) => (typeof r === 'string' ? r : String(r)));

  if (signAndSendTransactions) {
    try {
      const signing = signAndSendTransactions(transactions, minContextSlot);
      if (recoverMemo) {
        let settled = false;
        signing.then(() => (settled = true), () => (settled = true));
        const recovered = watchForLandedPayment(
          payerKey.toBase58(),
          recoverMemo,
          transactions.length,
          Math.floor(Date.now() / 1000) - 10,
          () => settled
        );
        signatures = toSignatureList(await Promise.race([signing, recovered]));
        settled = true;
      } else {
        signatures = toSignatureList(await signing);
      }
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

        signatures = await transact(async (wallet: Web3MobileWallet) => {
          await wallet.authorize({
            chain: getNetworkConfig().clusterId,
            identity: APP_IDENTITY,
          });
          return await wallet.signAndSendTransactions({
            transactions,
            minContextSlot,
          });
        });
        signatures = toSignatureList(signatures);
      } else {
        throw err;
      }
    }
  } else {
    signatures = toSignatureList(
      await transact(async (wallet: Web3MobileWallet) => {
        await wallet.authorize({
          chain: getNetworkConfig().clusterId,
          identity: APP_IDENTITY,
        });
        return await wallet.signAndSendTransactions({
          transactions,
          minContextSlot,
        });
      })
    );
  }

  let slot: number | undefined = minContextSlot;
  try {
    slot = await connection.getSlot('confirmed');
  } catch {}

  // The last transaction carries the proof memo
  return { signature: signatures[signatures.length - 1], signatures, slot };
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
    recoverMemo: `ARKANA::CONSENSUS::v1::CARD=${cardNo}::`,
  });
}

export const SKR_MINT = getNetworkConfig().skrMint;

export async function fetchRealSkrBalance(
  connection: Connection,
  walletPublicKey: PublicKey
): Promise<number> {
  const decimals = isDevnet() ? 9 : 6;
  try {
    const userAta = getAssociatedTokenAddressSync(SKR_MINT, walletPublicKey, true);
    const info = await connection.getAccountInfo(userAta, 'confirmed');
    if (info && info.data && info.data.length >= 72) {
      const amount = info.data.readBigUInt64LE(64);
      return Number(amount) / Math.pow(10, decimals);
    }
  } catch (ataErr) {
    console.warn('Direct ATA fetch error:', ataErr);
  }

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
