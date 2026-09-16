import { Connection, PublicKey, Transaction, TransactionInstruction } from '@solana/web3.js';
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

export interface SubmitProofParams {
  connection: Connection;
  walletPublicKey: PublicKey;
  signAndSendTransactions: (transaction: any, minContextSlot: any) => Promise<any>;
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

  const { blockhash, lastValidBlockHeight } = await connection.getLatestBlockhash('confirmed');

  const transaction = new Transaction({
    feePayer: walletPublicKey,
    recentBlockhash: blockhash,
  });

  transaction.add(createConsensusMemoInstruction(walletPublicKey, payload));

  const result = await signAndSendTransactions(transaction, undefined as any);
  const signature: string = Array.isArray(result) ? result[0] : (typeof result === 'string' ? result : String(result));

  let slot: number | undefined;
  try {
    slot = await connection.getSlot('confirmed');
  } catch {
    try {
      slot = await connection.getSlot();
    } catch {}
  }

  return { signature, slot };
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
