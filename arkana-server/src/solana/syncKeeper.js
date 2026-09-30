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

async function runSyncStake() {
  const payer = Keypair.fromSecretKey(Uint8Array.from(JSON.parse(fs.readFileSync(KEYPAIR_PATH, "utf8"))));
  const connection = new Connection(RPC_URL, "confirmed");
  const { blockhash, lastValidBlockHeight } = await connection.getLatestBlockhash();
  const message = new TransactionMessage({
    payerKey: payer.publicKey,
    recentBlockhash: blockhash,
    instructions: [
      ComputeBudgetProgram.setComputeUnitLimit({ units: 200000 }),
      ComputeBudgetProgram.setComputeUnitPrice({ microLamports: 50000 }),
      syncStakeInstruction(payer.publicKey),
    ],
  }).compileToV0Message();
  const tx = new VersionedTransaction(message);
  tx.sign([payer]);

  // Simulate first: a failing crank should cost nothing
  const sim = await connection.simulateTransaction(tx);
  if (sim.value.err) throw new Error(`simulation failed: ${JSON.stringify(sim.value.err)}`);
  const signature = await connection.sendRawTransaction(tx.serialize());
  await connection.confirmTransaction({ signature, blockhash, lastValidBlockHeight }, "confirmed");
  return signature;
}

function startSyncKeeper() {
  if (process.env.ARKANA_SYNC_KEEPER !== "on") return;
  const tick = async () => {
    try {
      console.log(`[sync-keeper] SyncStake sent: ${await runSyncStake()}`);
    } catch (err) {
      console.warn("[sync-keeper] SyncStake failed:", err.message);
    }
  };
  setTimeout(tick, 60 * 1000);
  setInterval(tick, HOURS * 60 * 60 * 1000);
}

module.exports = { startSyncKeeper, runSyncStake, syncStakeInstruction };
