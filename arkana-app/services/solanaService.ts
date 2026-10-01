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
import { netFetch } from '@/services/netFetch';
import { API_BASE_URL, refreshSeekerStatus } from '@/services/oracleApi';
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
  /** Called as soon as the wallet returned the signatures, before waiting for confirmation, so a
   *  payment is stored even if the app is killed during the wait. */
  onSigned?: (signatures: string[]) => Promise<void>;
}

const RECOVERY_START_MS = 15_000;
const RECOVERY_POLL_MS = 4_000;
const RECOVERY_TIMEOUT_MS = 180_000;

async function fetchRecentSignatures(wallet: string, limit: number): Promise<any[]> {
  // Through the Arkana RPC proxy: public RPCs often refuse getSignaturesForAddress
  const res = await netFetch(`${API_BASE_URL}/api/solana-rpc`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'getSignaturesForAddress', params: [wallet, { limit, commitment: 'confirmed' }] }),
  });
  const data = await res.json();
  return Array.isArray(data?.result) ? data.result : [];
}

/** Error text when the wallet never answered and the payment was not found on chain either. */
export const WALLET_NO_RESPONSE_ERROR =
  'Wallet did not respond and no transaction was found on chain. Check your wallet activity before trying again.';

/**
 * Looks for the payment on chain for up to `waitMs`: used when the wallet reports an error, because
 * it may have sent the transaction before the app lost the reply (for example when the user switches
 * apps while it confirms). Returns the signatures, memo transaction first, or null.
 */
async function findLandedPayment(
  wallet: string,
  memo: string,
  count: number,
  sinceSec: number,
  waitMs: number
): Promise<string[] | null> {
  const deadline = Date.now() + waitMs;
  while (true) {
    try {
      const fresh = (await fetchRecentSignatures(wallet, count + 4)).filter(
        (s) => !s.err && (s.blockTime ?? 0) >= sinceSec
      );
      const memoTx = fresh.find((s) => typeof s.memo === 'string' && s.memo.includes(memo));
      if (memoTx) {
        const others = fresh.filter((s) => s.signature !== memoTx.signature).slice(0, count - 1);
        return [memoTx.signature, ...others.map((s) => s.signature)];
      }
    } catch {}
    if (Date.now() >= deadline) return null;
    await new Promise((r) => setTimeout(r, 3000));
  }
}

/**
 * Waits for the payment to show up on chain; resolves with its signatures, memo transaction first.
 * Rejects when the deadline passes, so the caller stops waiting.
 */
function watchForLandedPayment(
  wallet: string,
  memo: string,
  count: number,
  sinceSec: number,
  isDone: () => boolean
): Promise<string[]> {
  return new Promise((resolve, reject) => {
    const deadline = Date.now() + RECOVERY_TIMEOUT_MS;
    const tick = async () => {
      if (isDone()) return;
      if (Date.now() > deadline) {
        reject(new Error(WALLET_NO_RESPONSE_ERROR));
        return;
      }
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

const CONFIRM_TIMEOUT_MS = 20_000;
const CONFIRM_POLL_MS = 1_500;

/**
 * Polls the cluster until every signature is confirmed (or finalized), for at most ~20 s.
 * Returns confirmed: false when the network has not confirmed them in time; throws when one failed.
 */
async function waitForConfirmation(
  connection: Connection,
  signatures: string[]
): Promise<{ confirmed: boolean; slot?: number }> {
  const deadline = Date.now() + CONFIRM_TIMEOUT_MS;
  while (Date.now() < deadline) {
    try {
      const { value } = await connection.getSignatureStatuses(signatures);
      if (value.some((st) => st?.err)) {
        throw new Error('Transaction failed on-chain.');
      }
      const done = value.every(
        (st) => st?.confirmationStatus === 'confirmed' || st?.confirmationStatus === 'finalized'
      );
      if (done) {
        const slot = value.reduce((max, st) => Math.max(max, st?.slot ?? 0), 0);
        return { confirmed: true, slot: slot || undefined };
      }
    } catch (err: any) {
      if (/failed on-chain/.test(String(err?.message))) throw err;
    }
    await new Promise((r) => setTimeout(r, CONFIRM_POLL_MS));
  }
  return { confirmed: false };
}

/**
 * Signs and sends through Mobile Wallet Adapter:
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
  onSigned,
}: ExecuteTransactionParams): Promise<{ signature: string; signatures: string[]; slot?: number; confirmed: boolean }> {
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
    const signingStartedSec = Math.floor(Date.now() / 1000) - 10;
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
      // The wallet may have sent the payment and lost only its reply: never report a cancel or sign
      // a second time before checking the chain
      const landed = recoverMemo
        ? await findLandedPayment(payerKey.toBase58(), recoverMemo, transactions.length, signingStartedSec, 20_000)
        : null;
      if (landed) {
        signatures = landed;
      } else {
        const isUserCancellation =
          err?.code === -32003 ||
          /reject|denied|declined/i.test(String(err?.message || '')) ||
          (err?.code === -1 && /reject|denied|cancel/i.test(String(err?.message || '')));
        if (isUserCancellation) {
          throw err;
        }

        // Only attempt re-authorization when the wallet reported an authorization failure
        const isAuthError =
          err?.code === -32000 ||
          err?.code === -1 ||
          /authoriz|session.*(expired|invalid)|unauthorized/i.test(String(err?.message || ''));
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

  if (signatures.length === 0 || signatures.some((s) => !s)) {
    throw new Error(WALLET_NO_RESPONSE_ERROR);
  }

  if (onSigned) await onSigned(signatures).catch(() => {});

  // Only claim "confirmed" once the network says so; otherwise the caller shows "submitted"
  const status = await waitForConfirmation(connection, signatures);
  const slot: number | undefined = status.slot ?? minContextSlot;

  // The last transaction carries the proof memo
  return { signature: signatures[signatures.length - 1], signatures, slot, confirmed: status.confirmed };
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
}: SubmitProofParams): Promise<{ signature: string; slot?: number; confirmed: boolean }> {
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
    // The millisecond timestamp makes this seal's memo unique to this attempt
    recoverMemo: `ARKANA::CONSENSUS::v1::CARD=${cardNo}::ORIENTATION=${orientation}::DATE=${todayDate}::TS=${payload.timestamp}`,
  });
}

export const SKR_MINT = getNetworkConfig().skrMint;

/** SKR balance of the wallet, or null when the RPC could not be read (unknown, not zero). */
export async function fetchRealSkrBalance(
  connection: Connection,
  walletPublicKey: PublicKey
): Promise<number | null> {
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
    return null;
  }
}

/** SOL balance of the wallet, or null when the RPC could not be read (unknown, not zero). */
export async function fetchRealSolBalance(
  connection: Connection,
  walletPublicKey: PublicKey
): Promise<number | null> {
  try {
    const lamports = await connection.getBalance(walletPublicKey, 'confirmed');
    return lamports / 1e9;
  } catch (err) {
    console.warn('Error fetching SOL balance:', err);
    return null;
  }
}


/**
 * Seeker Genesis status. The server verifies the token on chain and caches the answer; the public
 * RPC used by the app refuses the indexed query anyway. The connection argument is kept for callers.
 */
export async function checkSeekerGenesisHolderOnChain(
  _connection: Connection,
  walletPublicKey: PublicKey
): Promise<boolean> {
  return refreshSeekerStatus(walletPublicKey.toBase58());
}
