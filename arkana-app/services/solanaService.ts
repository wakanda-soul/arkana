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
    keys: [{ pubkey: walletPublicKey, isSigner: true, isWritable: true }],
    data: buildConsensusMemoData(payload),
  });
}

export interface SubmitProofParams {
  connection: Connection;
  walletPublicKey: PublicKey;
  signAndSendTransactions: (transaction: any, minContextSlot: number) => Promise<any>;
  cardNo: string;
  orientation: 'UPRIGHT' | 'REVERSED';
}

export async function submitConsensusProofOnChain({
  connection,
  walletPublicKey,
  signAndSendTransactions,
  cardNo,
  orientation,
}: SubmitProofParams): Promise<{ signature: string; slot: number }> {
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

  const result = await signAndSendTransactions(transaction, 0);
  const signature: string = Array.isArray(result) ? result[0] : (typeof result === 'string' ? result : String(result));

  let slot = 289441200;
  try {
    slot = await connection.getSlot('confirmed');
  } catch {
    // fallback if slot query times out
  }

  return { signature, slot };
}
