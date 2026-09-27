// End-to-end test of the Arkana ORE Vault + ORE Stake integration on LiteSVM,
// using the real mainnet ORE Stake binary and mainnet account snapshots.
import { LiteSVM, Clock } from 'litesvm';
import { Keypair, PublicKey, Transaction, TransactionInstruction, SystemProgram, ComputeBudgetProgram } from '@solana/web3.js';
import { AccountLayout, getAssociatedTokenAddressSync, TOKEN_PROGRAM_ID } from '@solana/spl-token';
import * as fs from 'fs';
import {
  ARKANA_VAULT_PROGRAM_ID, ORE_MINT_ADDRESS, ARKANA_TREASURY_ADDRESS,
  getConfigPda, getVaultAuthorityPda, getUserVaultPda, getTranchePda, getOreStakePda,
  getOreTreasuryPda, getOreVestingPda,
  createDepositTrancheInstruction, createClaimTrancheYieldInstruction,
  createHarvestMaturedTrancheInstruction, createSyncStakeInstruction,
} from '@/services/oreVaultService';

const PROGRAM_SO = __dirname + '/../target/deploy/arkana_ore_vault.so';
const STAKE_PROGRAM = new PublicKey('stakecNP3FpiExZPCgZfqRgumVzi6dNqnfrjwXyTgeH');
const DAY = 86400n;

const svm = new LiteSVM();
svm.addProgramFromFile(ARKANA_VAULT_PROGRAM_ID, PROGRAM_SO);
svm.addProgramFromFile(STAKE_PROGRAM, __dirname + '/fixtures/ore_stake.so');

for (const f of fs.readdirSync(__dirname + '/fixtures').filter(f => f.startsWith('acc_'))) {
  const j = JSON.parse(fs.readFileSync(__dirname + '/fixtures/' + f, 'utf8'));
  svm.setAccount(new PublicKey(j.pubkey), {
    lamports: j.account.lamports,
    data: Buffer.from(j.account.data[0], 'base64'),
    owner: new PublicKey(j.account.owner),
    executable: j.account.executable,
  });
}

let failures = 0;
function check(name: string, ok: boolean, detail = '') {
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? '  ' + detail : ''}`);
  if (!ok) failures++;
}

function setTokenAccount(address: PublicKey, owner: PublicKey, amount: bigint) {
  const data = Buffer.alloc(AccountLayout.span);
  AccountLayout.encode({
    mint: ORE_MINT_ADDRESS, owner, amount, delegateOption: 0, delegate: PublicKey.default,
    state: 1, isNativeOption: 0, isNative: 0n, delegatedAmount: 0n, closeAuthorityOption: 0, closeAuthority: PublicKey.default,
  }, data);
  svm.setAccount(address, { lamports: 2_039_280, data, owner: TOKEN_PROGRAM_ID, executable: false });
}
function tokenAmount(address: PublicKey): bigint {
  const a = svm.getAccount(address);
  return a ? AccountLayout.decode(Buffer.from(a.data)).amount : 0n;
}
function lamports(address: PublicKey): bigint {
  const a = svm.getAccount(address);
  return a ? BigInt(a.lamports) : 0n;
}
function setTime(ts: bigint) {
  const c = svm.getClock();
  svm.setClock(new Clock(c.slot + 1000n, c.epochStartTimestamp, c.epoch, c.leaderScheduleEpoch, ts));
  svm.expireBlockhash();
}
function send(ixs: TransactionInstruction[], signers: Keypair[]): { ok: boolean; logs: string[] } {
  const tx = new Transaction();
  tx.recentBlockhash = svm.latestBlockhash();
  tx.feePayer = signers[0].publicKey;
  tx.add(ComputeBudgetProgram.setComputeUnitLimit({ units: 1_000_000 }), ...ixs);
  tx.sign(...signers);
  const res: any = svm.sendTransaction(tx);
  const failed = typeof res.err === 'function';
  const logs: string[] = (failed ? res.meta().logs() : res.logs()) || [];
  if (failed) console.log('   tx error:', res.err().toString(), '\n   ' + logs.slice(-6).join('\n   '));
  else console.log(`   CU used: ${res.computeUnitsConsumed()}`);
  svm.expireBlockhash();
  return { ok: !failed, logs };
}

// --- Accounts ---
const [configPda] = getConfigPda();
const [vaultAuth] = getVaultAuthorityPda();
const vaultAta = getAssociatedTokenAddressSync(ORE_MINT_ADDRESS, vaultAuth, true);
const [stakePda] = getOreStakePda(vaultAuth);
const stakeTokens = getAssociatedTokenAddressSync(ORE_MINT_ADDRESS, stakePda, true);
const [oreTreasury] = getOreTreasuryPda();
const oreTreasuryTokens = getAssociatedTokenAddressSync(ORE_MINT_ADDRESS, oreTreasury, true);
const [vestingPda] = getOreVestingPda();
const treasuryOreAta = getAssociatedTokenAddressSync(ORE_MINT_ADDRESS, ARKANA_TREASURY_ADDRESS, true);

const cfg = () => {
  const d = Buffer.from(svm.getAccount(configPda)!.data);
  // disc 8 | treasury 32 | mint 32 | bump 1 | init 1 | pad 6 | factor 16 | staked u64 | yield u64 | matured u64 | count u64
  return { staked: d.readBigUInt64LE(96), yieldPaid: d.readBigUInt64LE(104), matured: d.readBigUInt64LE(112) };
};
const stakeBalance = () => {
  const a = svm.getAccount(stakePda);
  return a ? Buffer.from(a.data).readBigUInt64LE(8 + 32) : 0n; // disc | authority | balance
};

const T0 = 1_790_500_000n;
setTime(T0);

// Fresh ORE Stake vesting schedule so yield accrues deterministically: 5 ORE over 1 hour
{
  const v = svm.getAccount(vestingPda)!;
  const d = Buffer.from(v.data);
  d.writeBigUInt64LE(500_000_000_000n, 8);  // initial_amount
  d.writeBigUInt64LE(0n, 16);               // vested_amount
  d.writeBigInt64LE(T0, 24);                // start_time
  svm.setAccount(vestingPda, { ...v, data: d });
  const tt = tokenAmount(oreTreasuryTokens);
  setTokenAccount(oreTreasuryTokens, oreTreasury, tt + 1_000_000_000_000n);
}

const legacyPrincipal = cfg().staked;
console.log(`legacy principal in vault (pre ORE Stake): ${legacyPrincipal}, vault ATA ${tokenAmount(vaultAta)}`);

// --- User with ORE ---
const user = Keypair.generate();
svm.airdrop(user.publicKey, 2_000_000_000n);
const userAta = getAssociatedTokenAddressSync(ORE_MINT_ADDRESS, user.publicKey);
setTokenAccount(userAta, user.publicKey, 10_000_000_000n); // 0.1 ORE

(async () => {
  // 0. Migration: SyncStake stakes legacy principal that sat idle in the vault
  let r0 = send([createSyncStakeInstruction(user.publicKey)], [user]);
  check('SyncStake migrates legacy principal into ORE Stake', r0.ok && stakeBalance() === legacyPrincipal, `stake=${stakeBalance()}`);

  // 1. First deposit of the day: new tranche, staked in ORE Stake together with legacy principal
  let r = send([await createDepositTrancheInstruction(user.publicKey, 1, 1_000_000_000n)], [user]);
  check('deposit #1 succeeds', r.ok);
  check('tranche #1 created', !!svm.getAccount(getTranchePda(user.publicKey, 1)[0]));
  check('principal staked in ORE Stake (incl. legacy)', stakeBalance() === 1_000_000_000n + legacyPrincipal, `stake=${stakeBalance()}`);
  check('config.total_staked_ore', cfg().staked === legacyPrincipal + 1_000_000_000n);

  // 2. Same-day top-up: same tranche, no new account
  setTime(T0 + 60n);
  r = send([await createDepositTrancheInstruction(user.publicKey, 1, 500_000_000n)], [user]);
  check('same-day top-up succeeds', r.ok);
  check('no tranche #2 created', !svm.getAccount(getTranchePda(user.publicKey, 2)[0]));
  check('stake grows by top-up', stakeBalance() === 1_500_000_000n + legacyPrincipal);

  // 3. Wrong tranche id is rejected (next id on same day)
  r = send([await createDepositTrancheInstruction(user.publicKey, 2, 1n)], [user]);
  check('same-day deposit into tranche #2 rejected', !r.ok);

  // 4. ORE Stake yield accrues; SyncStake claims it into the vault
  setTime(T0 + 3600n);
  const vaultBefore = tokenAmount(vaultAta);
  r = send([createSyncStakeInstruction(user.publicKey)], [user]);
  check('SyncStake with nothing idle keeps stake', stakeBalance() === 1_500_000_000n + legacyPrincipal);
  check('SyncStake succeeds', r.ok);
  const synced = tokenAmount(vaultAta) - vaultBefore;
  check('ORE Stake yield claimed into vault', synced > 0n, `+${synced}`);

  // 5. Claim tranche yield
  const userBefore = tokenAmount(userAta);
  r = send([await createClaimTrancheYieldInstruction(user.publicKey, 1)], [user]);
  check('claim yield succeeds', r.ok);
  const claimed = tokenAmount(userAta) - userBefore;
  const expectedShare = (synced * 1_500_000_000n) / (1_500_000_000n + legacyPrincipal);
  check('user got pro-rata yield', claimed > 0n && claimed <= expectedShare + 1n && claimed >= expectedShare - 2n, `claimed=${claimed} expected~${expectedShare}`);

  // 6. Next day: new tranche #2
  setTime(T0 + DAY + 10n);
  r = send([await createDepositTrancheInstruction(user.publicKey, 2, 300_000_000n)], [user]);
  check('next-day deposit creates tranche #2', r.ok && !!svm.getAccount(getTranchePda(user.publicKey, 2)[0]));

  // 7. Harvest before maturity is rejected
  r = send([await createHarvestMaturedTrancheInstruction(user.publicKey, user.publicKey, 1)], [user]);
  check('early harvest rejected', !r.ok);

  // 8. More yield, then 366 days later harvest tranche #1
  const vest = svm.getAccount(vestingPda)!;
  const vd = Buffer.from(vest.data);
  vd.writeBigUInt64LE(1_000_000_000_000n, 8); vd.writeBigUInt64LE(0n, 16); vd.writeBigInt64LE(T0 + 366n * DAY, 24);
  svm.setAccount(vestingPda, { ...vest, data: vd });
  setTime(T0 + 366n * DAY + 3600n);

  const tranche1 = getTranchePda(user.publicKey, 1)[0];
  const trancheRent = lamports(tranche1);
  const userLamportsBefore = lamports(user.publicKey);
  const userOreBefore = tokenAmount(userAta);
  const treasuryBefore = tokenAmount(treasuryOreAta);
  const stakeBefore = stakeBalance();

  // Called by a third party that is neither owner nor treasury: rejected
  const stranger = Keypair.generate();
  svm.airdrop(stranger.publicKey, 1_000_000_000n);
  r = send([await createHarvestMaturedTrancheInstruction(stranger.publicKey, user.publicKey, 1)], [stranger]);
  check('stranger cannot harvest', !r.ok);

  r = send([await createHarvestMaturedTrancheInstruction(user.publicKey, user.publicKey, 1)], [user]);
  check('harvest succeeds after 365 days', r.ok);
  check('principal 1.5e9 went to Arkana Treasury', tokenAmount(treasuryOreAta) - treasuryBefore === 1_500_000_000n, `treasury +${tokenAmount(treasuryOreAta) - treasuryBefore}`);
  const yieldToUser = tokenAmount(userAta) - userOreBefore;
  check('unclaimed yield went to owner', yieldToUser > 0n, `+${yieldToUser}`);
  check('tranche account closed', !svm.getAccount(tranche1) || svm.getAccount(tranche1)!.lamports === 0);
  const rentBack = lamports(user.publicKey) - userLamportsBefore;
  check('tranche rent refunded to owner (minus fees/ATA rent)', rentBack > trancheRent - 3_000_000n, `rent=${trancheRent} delta=${rentBack}`);
  check('principal unstaked from ORE Stake', stakeBefore - stakeBalance() === 1_500_000_000n, `stake ${stakeBefore} -> ${stakeBalance()}`);
  check('config totals', cfg().staked === legacyPrincipal + 300_000_000n && cfg().matured >= 1_500_000_000n, JSON.stringify(cfg(), (_, v) => typeof v === 'bigint' ? v.toString() : v));

  // 9. Harvest twice is impossible
  r = send([await createHarvestMaturedTrancheInstruction(user.publicKey, user.publicKey, 1)], [user]);
  check('double harvest rejected', !r.ok);

  // 10. Vault stays solvent: staked principal covers every open tranche
  check('stake balance == open principal', stakeBalance() + (tokenAmount(vaultAta) >= 0n ? 0n : 0n) === cfg().staked, `stake=${stakeBalance()} principal=${cfg().staked}`);

  console.log(failures === 0 ? '\nALL PASSED' : `\n${failures} FAILED`);
  process.exit(failures ? 1 : 0);
})();
