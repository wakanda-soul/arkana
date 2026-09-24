import { Connection, PublicKey, Transaction, TransactionInstruction, SystemProgram, AddressLookupTableAccount } from '@solana/web3.js';
import {
  createTransferInstruction,
  createBurnInstruction,
  getAssociatedTokenAddressSync,
  createAssociatedTokenAccountIdempotentInstruction,
  TOKEN_PROGRAM_ID,
  ASSOCIATED_TOKEN_PROGRAM_ID
} from '@solana/spl-token';
import { ed25519 } from '@noble/curves/ed25519';
// @ts-ignore
import bs58 from 'bs58';
import { Buffer } from 'buffer';
import { SKR_MINT, SOLANA_MEMO_PROGRAM_ID, fetchRealSkrBalance, executeSolanaTransaction } from './solanaService';
import { isDevnet } from '@/constants/networkConfig';
import {
  createSwapAndDepositTrancheInstruction,
  createSwapAndDepositSolTrancheInstruction,
  getUserVaultPda
} from './oreVaultService';

/**
 * Arkana Founder Offline Master Public Key
 * Cryptographic anchor of trust verified by offline Ed25519 signature.
 */
export const FOUNDER_MASTER_PUBLIC_KEY = '4R6FtpbHdv8WhXy7gHQCaXQbEqTgetqaBcJJSLs8kjW1';

export const ATTESTATION_PREFIX = 'ARKANA::TREASURY::ATTESTATION::v1::';

export interface TreasuryAttestationResponse {
  success: boolean;
  treasury: {
    address: string;
    attestationSignature: string;
    masterPublicKey: string;
    version: number;
    signedAt?: string;
  } | null;
}

/**
 * Verify cryptographic attestation of a candidate treasury address
 */
export function verifyTreasuryAttestation(
  treasuryAddress: string,
  signatureB58: string,
  expectedMasterPubB58: string = FOUNDER_MASTER_PUBLIC_KEY
): boolean {
  try {
    if (!treasuryAddress || !signatureB58) return false;
    const pubBytes = new Uint8Array(bs58.decode(expectedMasterPubB58));
    const sigBytes = new Uint8Array(bs58.decode(signatureB58));
    const msg = new Uint8Array(Buffer.from(`${ATTESTATION_PREFIX}${treasuryAddress}`, 'utf-8'));
    return ed25519.verify(sigBytes, msg, pubBytes);
  } catch (err) {
    console.warn('Treasury attestation verification error:', err);
    return false;
  }
}

/**
 * Fetch and cryptographically authenticate the Treasury from the backend
 */
export async function getVerifiedTreasury(apiBaseUrl: string): Promise<PublicKey> {
  const res = await fetch(`${apiBaseUrl}/api/treasury`);
  if (!res.ok) {
    throw new Error('Failed to retrieve Treasury configuration from server.');
  }

  const data: TreasuryAttestationResponse = await res.json();
  if (!data.success || !data.treasury || !data.treasury.address || !data.treasury.attestationSignature) {
    throw new Error('Treasury is not properly configured on server.');
  }

  const { address, attestationSignature } = data.treasury;
  const isAuthentic = verifyTreasuryAttestation(address, attestationSignature);

  if (!isAuthentic) {
    console.error('CRITICAL SECURITY ERROR: Treasury attestation signature mismatch!');
    throw new Error(
      'SECURITY ALERT: Treasury address verification failed. Possible server compromise or invalid configuration.'
    );
  }

  return new PublicKey(address);
}

/**
 * Query live Jupiter DEX rate for converting SOL to exact SKR
 */
export async function getLiveSolQuoteForSkr(
  amountSkr: number
): Promise<{ solAmount: number; lamports: number; quoteResponse?: any }> {
  const rawSkrNeeded = Math.round(amountSkr * 1_000_000);
  try {
    const res = await fetch(
      `https://api.jup.ag/swap/v1/quote?inputMint=So11111111111111111111111111111111111111112&outputMint=${SKR_MINT.toBase58()}&amount=${rawSkrNeeded}&swapMode=ExactOut&slippageBps=100`
    );
    if (res.ok) {
      const quote = await res.json();
      if (quote && quote.inAmount) {
        const lamports = Number(quote.inAmount);
        const solAmount = Number((lamports / 1e9).toFixed(6));
        return { solAmount, lamports, quoteResponse: quote };
      }
    }
  } catch (e) {
    console.warn('Failed to fetch live Jupiter quote, using fallback rate:', e);
  }

  // Canonical fallback rate: 1 SKR = 0.0002 SOL (1 SOL = 5,000 SKR)
  const rate = 0.0002;
  const fallbackSol = Number((amountSkr * rate).toFixed(5));
  return {
    solAmount: fallbackSol,
    lamports: Math.round(fallbackSol * 1e9),
  };
}

/**
 * Deserialize a Jupiter DEX instruction into a Solana Web3 TransactionInstruction
 */
function deserializeJupiterInstruction(instruction: any): TransactionInstruction {
  return new TransactionInstruction({
    programId: new PublicKey(instruction.programId),
    keys: instruction.accounts.map((key: any) => ({
      pubkey: new PublicKey(key.pubkey),
      isSigner: key.isSigner,
      isWritable: key.isWritable,
    })),
    data: Buffer.from(instruction.data, 'base64'),
  });
}

/**
 * Build SPL Token instructions for direct SKR payments:
 * - 33% transferred to Arkana Treasury
 * - 33% burned permanently on-chain (createBurnInstruction)
 * - 34% swapped via vault pool and locked into 365-day ORE Sacred Vault tranche
 */
export async function buildSkrPaymentInstructions({
  connection,
  userPublicKey,
  treasuryPublicKey,
  amountSkr,
  actionLabel = 'PAYMENT',
}: {
  connection: Connection;
  userPublicKey: PublicKey;
  treasuryPublicKey: PublicKey;
  amountSkr: number;
  actionLabel?: string;
}): Promise<TransactionInstruction[]> {
  const payer = new PublicKey(userPublicKey.toString());
  const treasury = new PublicKey(treasuryPublicKey.toString());
  const userAta = getAssociatedTokenAddressSync(SKR_MINT, payer, true);
  const treasuryAta = getAssociatedTokenAddressSync(SKR_MINT, treasury, true);

  const instructions: TransactionInstruction[] = [];

  // 1. Ensure Treasury ATA exists idempotently
  instructions.push(
    createAssociatedTokenAccountIdempotentInstruction(
      payer,
      treasuryAta,
      treasury,
      SKR_MINT,
      TOKEN_PROGRAM_ID,
      ASSOCIATED_TOKEN_PROGRAM_ID
    )
  );

  // Protocol Split: 33% Burn + 33% Treasury + 34% ORE 365-Day Staking Yield
  const decimalsMultiplier = isDevnet() ? 1_000_000_000 : 1_000_000;
  const totalRaw = BigInt(Math.round(amountSkr * decimalsMultiplier));
  const burnRaw = (totalRaw * 33n) / 100n;
  const treasuryRaw = (totalRaw * 33n) / 100n;
  const oreShareRaw = totalRaw - burnRaw - treasuryRaw; // Exactly 34% for ORE Staking Yield

  // 2. Transfer Treasury SKR share (33%)
  instructions.push(
    createTransferInstruction(
      userAta,
      treasuryAta,
      payer,
      treasuryRaw,
      [],
      TOKEN_PROGRAM_ID
    )
  );

  // 3. Permanently Burn 33% of the SKR on-chain
  instructions.push(
    createBurnInstruction(
      userAta,
      SKR_MINT,
      payer,
      burnRaw,
      [],
      TOKEN_PROGRAM_ID
    )
  );

  // 4. On-chain Atomic Swap & Deposit into ORE Sacred Vault (365-Day Time-Lock)
  try {
    const [userVaultPda] = getUserVaultPda(payer);
    const uVaultAcc = await connection.getAccountInfo(userVaultPda, 'confirmed');
    let nextTrancheId = 1;
    if (uVaultAcc && uVaultAcc.data.length >= 64) {
      nextTrancheId = uVaultAcc.data.readUInt32LE(40) + 1;
    }

    const swapAndDepositIx = await createSwapAndDepositTrancheInstruction(
      payer,
      nextTrancheId,
      oreShareRaw
    );
    instructions.push(swapAndDepositIx);
  } catch (vaultErr) {
    console.warn('Failed to build on-chain SwapAndDeposit instruction, routing to treasury as fallback:', vaultErr);
    instructions.push(
      createTransferInstruction(
        userAta,
        treasuryAta,
        payer,
        oreShareRaw,
        [],
        TOKEN_PROGRAM_ID
      )
    );
  }

  // 5. Proof Memo documenting 33% Burn + 33% Treasury + 34% ORE Staking Yield
  const memoText = `ARKANA::${actionLabel}::TOTAL=${amountSkr}_SKR::SPLIT(BURN=33%_TREASURY=33%_ORE_YIELD=34%)::TS=${Date.now()}`;
  instructions.push(
    new TransactionInstruction({
      programId: SOLANA_MEMO_PROGRAM_ID,
      keys: [{ pubkey: payer, isSigner: true, isWritable: false }],
      data: Buffer.from(memoText, 'utf-8'),
    })
  );

  return instructions;
}

/**
 * Build SOL instructions for payments when paying in SOL (or on Devnet without Jupiter):
 * - 33% transferred to Arkana Treasury
 * - 33% transferred to Solana Incinerator (permanently burned on-chain)
 * - 34% transferred to Vault Authority + SwapAndDepositSolTranche into 365-day ORE tranche!
 * - Proof Memo documenting the 33/33/34 split
 */
export async function buildSolPaymentInstructions({
  connection,
  userPublicKey,
  treasuryPublicKey,
  amountSkr,
  actionLabel = 'PAYMENT',
}: {
  connection: Connection;
  userPublicKey: PublicKey;
  treasuryPublicKey: PublicKey;
  amountSkr: number;
  actionLabel?: string;
}): Promise<TransactionInstruction[]> {
  const payer = new PublicKey(userPublicKey.toString());
  const treasury = new PublicKey(treasuryPublicKey.toString());
  let { lamports } = await getLiveSolQuoteForSkr(amountSkr);

  // Guard rent exemption if treasury is new
  try {
    const treasuryBalance = await connection.getBalance(treasury, 'confirmed');
    if (treasuryBalance === 0 && lamports < 650240) {
      lamports = 650240;
    }
  } catch {}

  const totalLamports = BigInt(lamports);
  const treasuryLamports = (totalLamports * 33n) / 100n;
  const burnLamports = (totalLamports * 33n) / 100n;
  const vaultLamports = totalLamports - treasuryLamports - burnLamports; // Exactly 34%

  const instructions: TransactionInstruction[] = [];

  // 1. 33% SOL to Treasury
  instructions.push(
    SystemProgram.transfer({
      fromPubkey: payer,
      toPubkey: treasury,
      lamports: treasuryLamports,
    })
  );

  // 2. 33% SOL to Burn (Solana Incinerator)
  const INCINERATOR_ADDRESS = new PublicKey('1nc1nerator11111111111111111111111111111111');
  instructions.push(
    SystemProgram.transfer({
      fromPubkey: payer,
      toPubkey: INCINERATOR_ADDRESS,
      lamports: burnLamports,
    })
  );

  // 3. 34% SOL to ORE Sacred Vault -> creates 365-day ORE tranche for user!
  const decimalsMultiplier = isDevnet() ? 1_000_000_000 : 1_000_000;
  const totalSkrRaw = BigInt(Math.round(amountSkr * decimalsMultiplier));
  const oreShareRaw = (totalSkrRaw * 34n) / 100n;

  try {
    const [userVaultPda] = getUserVaultPda(payer);
    const uVaultAcc = await connection.getAccountInfo(userVaultPda, 'confirmed');
    let nextTrancheId = 1;
    if (uVaultAcc && uVaultAcc.data.length >= 64) {
      nextTrancheId = uVaultAcc.data.readUInt32LE(40) + 1;
    }

    const swapAndDepositSolIx = await createSwapAndDepositSolTrancheInstruction(
      payer,
      nextTrancheId,
      oreShareRaw,
      vaultLamports
    );
    instructions.push(swapAndDepositSolIx);
  } catch (vaultErr) {
    console.warn('Failed to build on-chain SwapAndDepositSol instruction, routing to treasury as fallback:', vaultErr);
    instructions.push(
      SystemProgram.transfer({
        fromPubkey: payer,
        toPubkey: treasury,
        lamports: vaultLamports,
      })
    );
  }

  // 4. Proof Memo documenting 33% Burn + 33% Treasury + 34% ORE Staking Yield
  const memoText = `ARKANA::${actionLabel}::SOL_PAYMENT::SKR_EQUIV=${amountSkr}::LAMPORTS=${lamports}::SPLIT(BURN=33%_TREASURY=33%_ORE_YIELD=34%)::TS=${Date.now()}`;
  instructions.push(
    new TransactionInstruction({
      programId: SOLANA_MEMO_PROGRAM_ID,
      keys: [{ pubkey: payer, isSigner: true, isWritable: false }],
      data: Buffer.from(memoText, 'utf-8'),
    })
  );

  return instructions;
}

export interface ExecutePaymentOrSwapParams {
  connection: Connection;
  userPublicKey: PublicKey;
  treasuryPublicKey: PublicKey;
  amountSkr: number;
  actionLabel: string;
  forceSolSwap?: boolean;
  signAndSendTransactions?: (tx: any, minContextSlot: any) => Promise<any>;
}

/**
 * Universal payment or swap executor adhering to Solana Mobile Hackathon standard:
 * - If user has sufficient SKR (and !forceSolSwap) -> 50% Treasury + 50% Burn via VersionedTransaction.
 * - If user has insufficient SKR (or forceSolSwap) -> Atomic Jupiter DEX Swap (SOL -> exact SKR) + 50% Treasury + 50% Deflationary Burn in a single atomic transaction.
 * - Fallback: If Jupiter route is temporarily unavailable, gracefully executes direct SOL Buyback transfer into Treasury.
 */
export async function executePaymentOrSwap({
  connection,
  userPublicKey,
  treasuryPublicKey,
  amountSkr,
  actionLabel,
  forceSolSwap = false,
  signAndSendTransactions,
}: ExecutePaymentOrSwapParams): Promise<{ signature: string; paidWith: 'skr' | 'sol_swap'; costSkr: number }> {
  const payer = new PublicKey(userPublicKey.toString());
  const treasury = new PublicKey(treasuryPublicKey.toString());

  const currentSkr = await fetchRealSkrBalance(connection, payer);

  if (!forceSolSwap && currentSkr >= amountSkr) {
    // Direct on-chain SKR transaction: 33% Treasury + 33% Burn + 34% ORE Swap & Staking Tranche
    const instructions = await buildSkrPaymentInstructions({
      connection,
      userPublicKey: payer,
      treasuryPublicKey: treasury,
      amountSkr,
      actionLabel,
    });

    const { signature } = await executeSolanaTransaction({
      connection,
      payerKey: payer,
      instructions,
      signAndSendTransactions,
    });

    return { signature, paidWith: 'skr', costSkr: amountSkr };
  }

  // On Devnet, custom tokens do not exist on Jupiter DEX.
  // Execute atomic on-chain SOL payment: 33% Treasury + 33% Burn + 34% ORE Sacred Vault Tranche in 1 single transaction!
  if (isDevnet()) {
    const instructions = await buildSolPaymentInstructions({
      connection,
      userPublicKey: payer,
      treasuryPublicKey: treasury,
      amountSkr,
      actionLabel,
    });

    const { signature } = await executeSolanaTransaction({
      connection,
      payerKey: payer,
      instructions,
      signAndSendTransactions,
    });

    return { signature, paidWith: 'sol_swap', costSkr: amountSkr };
  }

  // Atomic Jupiter DEX Swap (SOL -> exact SKR) + 50% Treasury + 50% Deflationary Burn
  const rawSkrNeeded = Math.round(amountSkr * 1_000_000);
  try {
    const quoteUrl = `https://api.jup.ag/swap/v1/quote?inputMint=So11111111111111111111111111111111111111112&outputMint=${SKR_MINT.toBase58()}&amount=${rawSkrNeeded}&swapMode=ExactOut&slippageBps=100`;
    const quoteRes = await fetch(quoteUrl);
    if (!quoteRes.ok) {
      throw new Error(`Jupiter quote error: ${quoteRes.status} ${quoteRes.statusText}`);
    }
    const quoteData = await quoteRes.json();
    if (!quoteData || !quoteData.inAmount) {
      throw new Error('Invalid quote returned from Jupiter DEX API');
    }

    const insRes = await fetch('https://api.jup.ag/swap/v1/swap-instructions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        userPublicKey: payer.toBase58(),
        quoteResponse: quoteData,
        wrapAndUnwrapSol: true,
        useSharedAccounts: true,
      }),
    });

    if (!insRes.ok) {
      throw new Error(`Jupiter swap-instructions error: ${insRes.status} ${insRes.statusText}`);
    }

    const insData = await insRes.json();

    const swapInstructions: TransactionInstruction[] = [];

    // 1. Compute budget instructions from Jupiter
    if (insData.computeBudgetInstructions && Array.isArray(insData.computeBudgetInstructions)) {
      swapInstructions.push(...insData.computeBudgetInstructions.map(deserializeJupiterInstruction));
    }

    // 2. Setup instructions (WSOL ATA creation / sync / output ATA creation)
    if (insData.setupInstructions && Array.isArray(insData.setupInstructions)) {
      swapInstructions.push(...insData.setupInstructions.map(deserializeJupiterInstruction));
    }

    // 3. Swap instruction (Raydium CLMM via Jupiter)
    if (insData.swapInstruction) {
      swapInstructions.push(deserializeJupiterInstruction(insData.swapInstruction));
    }

    // 4. Cleanup instruction (unwrap WSOL)
    if (insData.cleanupInstruction) {
      swapInstructions.push(deserializeJupiterInstruction(insData.cleanupInstruction));
    }

    // 5. Ensure Treasury ATA exists idempotently
    const userAta = getAssociatedTokenAddressSync(SKR_MINT, payer, true);
    const treasuryAta = getAssociatedTokenAddressSync(SKR_MINT, treasury, true);

    swapInstructions.push(
      createAssociatedTokenAccountIdempotentInstruction(
        payer,
        treasuryAta,
        treasury,
        SKR_MINT,
        TOKEN_PROGRAM_ID,
        ASSOCIATED_TOKEN_PROGRAM_ID
      )
    );

    // 6. Protocol Split: 33% Burn + 33% Treasury + 34% ORE 365-Day Staking Yield
    const totalRaw = BigInt(rawSkrNeeded);
    const burnRaw = (totalRaw * 33n) / 100n;
    const treasuryRaw = (totalRaw * 33n) / 100n;
    const oreShareRaw = totalRaw - burnRaw - treasuryRaw; // Exactly 34% for ORE Staking Yield

    // 6. Transfer Treasury SKR share (33%)
    swapInstructions.push(
      createTransferInstruction(
        userAta,
        treasuryAta,
        payer,
        treasuryRaw,
        [],
        TOKEN_PROGRAM_ID
      )
    );

    // 7. Permanently Burn 33% of the SKR on-chain
    swapInstructions.push(
      createBurnInstruction(
        userAta,
        SKR_MINT,
        payer,
        burnRaw,
        [],
        TOKEN_PROGRAM_ID
      )
    );

    // 8. Swap & Deposit 34% into ORE Sacred Vault
    try {
      const [userVaultPda] = getUserVaultPda(payer);
      const uVaultAcc = await connection.getAccountInfo(userVaultPda, 'confirmed');
      let nextTrancheId = 1;
      if (uVaultAcc && uVaultAcc.data.length >= 64) {
        nextTrancheId = uVaultAcc.data.readUInt32LE(40) + 1;
      }
      const swapAndDepositIx = await createSwapAndDepositTrancheInstruction(
        payer,
        nextTrancheId,
        oreShareRaw
      );
      swapInstructions.push(swapAndDepositIx);
    } catch (vaultErr) {
      console.warn('Vault instruction skipped in Jupiter swap, sending to treasury:', vaultErr);
      swapInstructions.push(
        createTransferInstruction(
          userAta,
          treasuryAta,
          payer,
          oreShareRaw,
          [],
          TOKEN_PROGRAM_ID
        )
      );
    }

    // 9. SPL Memo documenting 33% Burn + 33% Treasury + 34% ORE Staking Yield
    const memoText = `ARKANA::${actionLabel}::SWAP_SOL_TO_SKR=${amountSkr}::SPLIT(BURN=33%_TREASURY=33%_ORE_YIELD=34%)::TS=${Date.now()}`;
    swapInstructions.push(
      new TransactionInstruction({
        programId: SOLANA_MEMO_PROGRAM_ID,
        keys: [{ pubkey: payer, isSigner: true, isWritable: false }],
        data: Buffer.from(memoText, 'utf-8'),
      })
    );

    // Fetch Address Lookup Tables
    const addressLookupTableAccounts: AddressLookupTableAccount[] = [];
    if (insData.addressLookupTableAddresses && Array.isArray(insData.addressLookupTableAddresses)) {
      const altResults = await Promise.all(
        insData.addressLookupTableAddresses.map((addr: string) =>
          connection.getAddressLookupTable(new PublicKey(addr)).catch(() => ({ value: null }))
        )
      );
      for (const res of altResults) {
        if (res && res.value) {
          addressLookupTableAccounts.push(res.value);
        }
      }
    }

    const { signature } = await executeSolanaTransaction({
      connection,
      payerKey: payer,
      instructions: swapInstructions,
      addressLookupTableAccounts,
      signAndSendTransactions,
    });

    return { signature, paidWith: 'sol_swap', costSkr: amountSkr };
  } catch (swapErr: any) {
    // If user explicitly rejected or cancelled in Phantom, do NOT fallback!
    const isUserCancellation =
      swapErr?.code === -32003 ||
      swapErr?.code === 4001 ||
      /reject|denied|declined|cancel|cancelled|canceled|closed|dismissed|abort/i.test(
        String(swapErr?.message || '')
      );

    if (isUserCancellation) {
      throw swapErr;
    }

    console.warn('Jupiter atomic swap failed or unavailable, executing on-chain SOL 33/33/34 flow:', swapErr);

    const fallbackInstructions = await buildSolPaymentInstructions({
      connection,
      userPublicKey: payer,
      treasuryPublicKey: treasury,
      amountSkr,
      actionLabel,
    });

    const { signature } = await executeSolanaTransaction({
      connection,
      payerKey: payer,
      instructions: fallbackInstructions,
      signAndSendTransactions,
    });

    return { signature, paidWith: 'sol_swap', costSkr: amountSkr };
  }
}
