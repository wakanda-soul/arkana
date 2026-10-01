/**
 * Daily SyncStake crank for the Arkana ORE vault.
 *
 * ORE Stake accrues yield on the vault's single stake account, but tranches only see it after the
 * vault program pulls it in (SyncStake, ix 5) and raises `rewards_factor`. Deposits and claims do
 * that as a side effect; without payments the yield stays invisible in the app. This keeper sends
 * one SyncStake a day, paid by the server key (about 0.00002 SOL).
 *
 * Off unless ARKANA_SYNC_KEEPER=on. Interval: ARKANA_SYNC_INTERVAL_HOURS (default 24).
 */
const fs = require("fs");
const os = require("os");
const path = require("path");
const {
  Connection,
  Keypair,
  PublicKey,
  SystemProgram,
  TransactionInstruction,
  TransactionMessage,
  VersionedTransaction,
  ComputeBudgetProgram,
} = require("@solana/web3.js");
const { getAssociatedTokenAddressSync, TOKEN_PROGRAM_ID, ASSOCIATED_TOKEN_PROGRAM_ID } = require("@solana/spl-token");

const RPC_URL = process.env.SOLANA_RPC_URL || "https://api.mainnet-beta.solana.com";
const KEYPAIR_PATH = process.env.ARKANA_ALT_KEYPAIR || path.join(os.homedir(), ".config", "solana", "id.json");
const VAULT_PROGRAM = new PublicKey("B49g3obWUCPQzP9kdcRiCPJDurufWhJhszpQsK5eeV8C");
const ORE_STAKE = new PublicKey("stakecNP3FpiExZPCgZfqRgumVzi6dNqnfrjwXyTgeH");
const ORE_MINT = new PublicKey("oreoU2P8bN6jkk3jbaiVxYnG1dCXcYxwhwyK9jSybcp");
const SYNC_STAKE_IX = 5;
const HOURS = Number(process.env.ARKANA_SYNC_INTERVAL_HOURS) || 24;

const pda = (seeds, program) => PublicKey.findProgramAddressSync(seeds, program)[0];

function syncStakeInstruction(payer) {
  const vaultAuthority = pda([Buffer.from("arkana_vault_auth")], VAULT_PROGRAM);
  const stake = pda([Buffer.from("stake"), vaultAuthority.toBuffer()], ORE_STAKE);
  const stakeTreasury = pda([Buffer.from("treasury")], ORE_STAKE);
  const ata = (owner) => getAssociatedTokenAddressSync(ORE_MINT, owner, true);
  const keys = [
    [payer, true, true],
    [pda([Buffer.from("arkana_config")], VAULT_PROGRAM), false, true],
    [vaultAuthority, false, true],
    [ata(vaultAuthority), false, true],
    [ORE_MINT, false, false],
    [SystemProgram.programId, false, false],
    [TOKEN_PROGRAM_ID, false, false],
    [ASSOCIATED_TOKEN_PROGRAM_ID, false, false],
    [stake, false, true],
    [ata(stake), false, true],
    [stakeTreasury, false, true],
    [ata(stakeTreasury), false, true],
    [pda([Buffer.from("vesting")], ORE_STAKE), false, true],
    [ORE_STAKE, false, false],
  ].map(([pubkey, isSigner, isWritable]) => ({ pubkey, isSigner, isWritable }));
  return new TransactionInstruction({ programId: VAULT_PROGRAM, data: Buffer.from([SYNC_STAKE_IX]), keys });
}

async function sendOnce(connection, payer) {
  const { blockhash, lastValidBlockHeight } = await connection.getLatestBlockhash();
  const message = new TransactionMessage({
    payerKey: payer.publicKey,
    recentBlockhash: blockhash,
    instructions: [
      ComputeBudgetProgram.setComputeUnitLimit({ units: 200000 }),
      ComputeBudgetProgram.setComputeUnitPrice({ microLamports: 100000 }),
      syncStakeInstruction(payer.publicKey),
    ],
  }).compileToV0Message();
  const tx = new VersionedTransaction(message);
  tx.sign([payer]);

  // Simulate first: a failing crank should cost nothing
  const sim = await connection.simulateTransaction(tx);
  if (sim.value.err) throw new Error(`simulation failed: ${JSON.stringify(sim.value.err)}`);

  const raw = tx.serialize();
  const signature = await connection.sendRawTransaction(raw, { skipPreflight: true, maxRetries: 0 });
  // Re-broadcast every 2 s until it lands or the blockhash expires
  const resend = setInterval(() => connection.sendRawTransaction(raw, { skipPreflight: true, maxRetries: 0 }).catch(() => {}), 2000);
  try {
    // Poll instead of confirmTransaction: the RPC has no signatureSubscribe websocket
    while ((await connection.getBlockHeight("confirmed")) <= lastValidBlockHeight) {
      const { value } = await connection.getSignatureStatuses([signature]);
      const status = value[0];
      if (status?.err) throw new Error(`transaction failed: ${JSON.stringify(status.err)}`);
      if (status?.confirmationStatus === "confirmed" || status?.confirmationStatus === "finalized") return signature;
      await new Promise((r) => setTimeout(r, 2000));
    }
    throw new Error(`transaction ${signature} expired before confirmation`);
  } finally {
    clearInterval(resend);
  }
}

async function runSyncStake() {
  const payer = Keypair.fromSecretKey(Uint8Array.from(JSON.parse(fs.readFileSync(KEYPAIR_PATH, "utf8"))));
  const connection = new Connection(RPC_URL, "confirmed");
  let lastErr;
  for (let attempt = 1; attempt <= 3; attempt++) {
    try {
      return await sendOnce(connection, payer);
    } catch (err) {
      lastErr = err;
      // A failed simulation will fail again; an expired blockhash is worth another try
      if (/simulation failed|transaction failed/.test(err.message)) break;
    }
  }
  throw lastErr;
}

// Last successful run, so a server restart does not send an extra SyncStake
const STATE_FILE = path.join(__dirname, "..", "..", "data", "sync_keeper.json");
const lastRunAt = () => {
  try {
    return Number(JSON.parse(fs.readFileSync(STATE_FILE, "utf8")).lastRunAt) || 0;
  } catch {
    return 0;
  }
};

function startSyncKeeper() {
  if (process.env.ARKANA_SYNC_KEEPER !== "on") return;
  const intervalMs = HOURS * 60 * 60 * 1000;
  const tick = async () => {
    if (Date.now() - lastRunAt() < intervalMs - 60 * 1000) return;
    try {
      console.log(`[sync-keeper] SyncStake sent: ${await runSyncStake()}`);
      fs.writeFileSync(STATE_FILE, JSON.stringify({ lastRunAt: Date.now() }));
    } catch (err) {
      console.warn("[sync-keeper] SyncStake failed:", err.message);
    }
  };
  setTimeout(tick, 60 * 1000);
  // Checked hourly; sends only when the interval since the last run has passed
  setInterval(tick, 60 * 60 * 1000);
}

module.exports = { startSyncKeeper, runSyncStake, syncStakeInstruction };
