// End-to-end test of the Arkana ORE Vault + ORE Stake integration on LiteSVM,
// using the real mainnet ORE Stake binary and mainnet account snapshots.
import { LiteSVM, Clock } from 'litesvm';
import { Keypair, PublicKey, Transaction, TransactionInstruction, SystemProgram, ComputeBudgetProgram } from '@solana/web3.js';
import { AccountLayout, getAssociatedTokenAddressSync, TOKEN_PROGRAM_ID, ASSOCIATED_TOKEN_PROGRAM_ID } from '@solana/spl-token';
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
const TX_FEE = 5000n; // one signature, no priority fee

for (const [what, path, hint] of [
  ['vault program', PROGRAM_SO, 'run `npm run build-program` (cargo build-sbf)'],
  ['ORE Stake fixture', __dirname + '/fixtures/ore_stake.so', 'run `npm run fixtures`'],
]) {
  if (!fs.existsSync(path)) {
    console.error(`missing ${what}: ${path}\n${hint} first`);
    process.exit(1);
  }
}

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

function setTokenAccount(address: PublicKey, owner: PublicKey, amount: bigint, mint: PublicKey = ORE_MINT_ADDRESS) {
  const data = Buffer.alloc(AccountLayout.span);
  AccountLayout.encode({
    mint, owner, amount, delegateOption: 0, delegate: PublicKey.default,
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

// Sends a transaction signed by the hardcoded Arkana Treasury. Its private key is not
// available here, so signature verification is switched off for this one transaction only.
function sendAsTreasury(ixs: TransactionInstruction[]): { ok: boolean; logs: string[] } {
  const tx = new Transaction();
  tx.recentBlockhash = svm.latestBlockhash();
  tx.feePayer = ARKANA_TREASURY_ADDRESS;
  tx.add(ComputeBudgetProgram.setComputeUnitLimit({ units: 1_000_000 }), ...ixs);
  tx.setSigners(ARKANA_TREASURY_ADDRESS);
  tx.addSignature(ARKANA_TREASURY_ADDRESS, Buffer.alloc(64, 7));
  svm.withSigverify(false);
  const res: any = svm.sendTransaction(tx);
  svm.withSigverify(true);
  const failed = typeof res.err === 'function';
  const logs: string[] = (failed ? res.meta().logs() : res.logs()) || [];
  if (failed) console.log('   tx error:', res.err().toString(), '\n   ' + logs.slice(-6).join('\n   '));
  else console.log(`   CU used: ${res.computeUnitsConsumed()}`);
  svm.expireBlockhash();
  return { ok: !failed, logs };
}
function removeAccount(address: PublicKey) {
  svm.setAccount(address, { lamports: 0, data: Buffer.alloc(0), owner: SystemProgram.programId, executable: false });
}
function cloneAccount(from: PublicKey): PublicKey {
  const a = svm.getAccount(from)!;
  const to = Keypair.generate().publicKey;
  svm.setAccount(to, { lamports: a.lamports, data: Buffer.from(a.data), owner: a.owner, executable: a.executable });
  return to;
}
function swapKey(ix: TransactionInstruction, from: PublicKey, to: PublicKey): TransactionInstruction {
  let n = 0;
  for (const k of ix.keys) if (k.pubkey.equals(from)) { k.pubkey = to; n++; }
  if (n === 0) throw new Error(`swapKey: ${from.toBase58()} not in instruction`);
  return ix;
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
// Fixed-point values (steel Numeric = I80F48) as raw i128 bits: value = bits / 2^48
const readI128 = (d: Buffer, off: number) => BigInt.asIntN(128, d.readBigUInt64LE(off) + (d.readBigUInt64LE(off + 8) << 64n));
const factor = () => readI128(Buffer.from(svm.getAccount(configPda)!.data), 80);
// Tranche: disc 8 | owner 32 | id u32 | matured u8 | pad 3 | deposited u64 @48 | at i64 | expires i64 | factor_at_deposit 16 @72 | last_factor 16 @88 | claimed u64 @104
const tranche = (owner: PublicKey, id: number) => {
  const a = svm.getAccount(getTranchePda(owner, id)[0]);
  if (!a || a.data.length === 0) return null;
  const d = Buffer.from(a.data);
  return { deposited: d.readBigUInt64LE(48), atDeposit: readI128(d, 72), last: readI128(d, 88), claimed: d.readBigUInt64LE(104) };
};
// Same math as Tranche::calculate_pending_yield: floor((factor - last) * deposited)
const pendingYield = (f: bigint, last: bigint, deposited: bigint) => (f > last ? ((f - last) * deposited) >> 48n : 0n);
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

// --- Attacker with its own ORE account ---
const attacker = Keypair.generate();
svm.airdrop(attacker.publicKey, 1_000_000_000n);
const attackerAta = getAssociatedTokenAddressSync(ORE_MINT_ADDRESS, attacker.publicKey);
setTokenAccount(attackerAta, attacker.publicKey, 0n);

// --- Solvency invariant ---
// Yield owed to a tranche is floor((rewards_factor - last_rewards_factor) * deposited). Mainnet
// tranches opened before the snapshot are not in the fixtures; their principal is counted as one
// virtual tranche checkpointed at the snapshot factor, and the yield the vault ATA held at the
// snapshot (balance minus any principal not yet staked) is set aside as their reserve for yield
// owed before the snapshot.
const factorAtSnapshot = factor();
const legacyReserve = tokenAmount(vaultAta) - (legacyPrincipal - stakeBalance());
const openTranches: Array<[PublicKey, number]> = [];
function checkSolvent(label: string) {
  const f = factor();
  let owed = pendingYield(f, factorAtSnapshot, legacyPrincipal);
  for (const [owner, id] of openTranches) {
    const t = tranche(owner, id)!;
    owed += pendingYield(f, t.last, t.deposited);
  }
  const free = tokenAmount(vaultAta) - legacyReserve;
  check(`solvency after ${label}: vault ATA covers all pending yield, stake covers principal`,
    free >= owed && stakeBalance() >= cfg().staked, `free=${free} owed=${owed} stake=${stakeBalance()} principal=${cfg().staked}`);
}

(async () => {
  // 0. Migration: SyncStake stakes legacy principal that sat idle in the vault
  let r0 = send([createSyncStakeInstruction(user.publicKey)], [user]);
  check('SyncStake migrates legacy principal into ORE Stake', r0.ok && stakeBalance() === legacyPrincipal, `stake=${stakeBalance()}`);

  // 1. First deposit of the day: new tranche, staked in ORE Stake together with legacy principal
  let r = send([await createDepositTrancheInstruction(user.publicKey, 1, 1_000_000_000n)], [user]);
  check('deposit #1 succeeds', r.ok);
  check('tranche #1 created', !!svm.getAccount(getTranchePda(user.publicKey, 1)[0]));
  openTranches.push([user.publicKey, 1]);
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
  checkSolvent('SyncStake');

  // 5. Claim tranche yield
  const userBefore = tokenAmount(userAta);
  r = send([await createClaimTrancheYieldInstruction(user.publicKey, 1)], [user]);
  check('claim yield succeeds', r.ok);
  const claimed = tokenAmount(userAta) - userBefore;
  const expectedShare = (synced * 1_500_000_000n) / (1_500_000_000n + legacyPrincipal);
  check('user got pro-rata yield', claimed > 0n && claimed <= expectedShare + 1n && claimed >= expectedShare - 2n, `claimed=${claimed} expected~${expectedShare}`);
  checkSolvent('claim');

  // 5b. Another wallet cannot claim the user's tranche by pointing at the user's tranche id / PDAs
  setTime(T0 + 7200n);
  {
    const ix = await createClaimTrancheYieldInstruction(attacker.publicKey, 1);
    ix.keys[3].pubkey = getUserVaultPda(user.publicKey)[0];
    ix.keys[4].pubkey = getTranchePda(user.publicKey, 1)[0];
    r = send([ix], [attacker]);
    check("claim of another user's tranche rejected", !r.ok && tokenAmount(attackerAta) === 0n);
  }

  // 6. Next day: new tranche #2
  setTime(T0 + DAY + 10n);
  r = send([await createDepositTrancheInstruction(user.publicKey, 2, 300_000_000n)], [user]);
  check('next-day deposit creates tranche #2', r.ok && !!svm.getAccount(getTranchePda(user.publicKey, 2)[0]));
  openTranches.push([user.publicKey, 2]);

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
  const userOreBefore = tokenAmount(userAta);
  const treasuryBefore = tokenAmount(treasuryOreAta);
  const stakeBefore = stakeBalance();

  // Called by a third party that is neither owner nor treasury: rejected
  const stranger = Keypair.generate();
  svm.airdrop(stranger.publicKey, 1_000_000_000n);
  r = send([await createHarvestMaturedTrancheInstruction(stranger.publicKey, user.publicKey, 1)], [stranger]);
  check('stranger cannot harvest', !r.ok);

  // Harvest that sends the principal to a token account other than the treasury ATA: rejected
  {
    const ix = await createHarvestMaturedTrancheInstruction(user.publicKey, user.publicKey, 1);
    ix.keys[8].pubkey = attackerAta;
    r = send([ix], [user]);
    check('harvest with wrong treasury ATA rejected', !r.ok && tokenAmount(attackerAta) === 0n);
  }
  const treasuryAtaExisted = !!svm.getAccount(treasuryOreAta);
  const userLamportsBeforeHarvest = lamports(user.publicKey);

  r = send([await createHarvestMaturedTrancheInstruction(user.publicKey, user.publicKey, 1)], [user]);
  check('harvest succeeds after 365 days', r.ok);
  check('principal 1.5e9 went to Arkana Treasury', tokenAmount(treasuryOreAta) - treasuryBefore === 1_500_000_000n, `treasury +${tokenAmount(treasuryOreAta) - treasuryBefore}`);
  const yieldToUser = tokenAmount(userAta) - userOreBefore;
  check('unclaimed yield went to owner', yieldToUser > 0n, `+${yieldToUser}`);
  check('tranche account closed', !svm.getAccount(tranche1) || svm.getAccount(tranche1)!.lamports === 0);
  openTranches.splice(openTranches.findIndex(([o, id]) => o.equals(user.publicKey) && id === 1), 1);
  checkSolvent('harvest');
  // Owner paid the tx fee (and the treasury ATA rent if harvest had to create it); everything else is the refunded rent
  const ataRentPaid = treasuryAtaExisted ? 0n : lamports(treasuryOreAta);
  const rentBack = lamports(user.publicKey) - userLamportsBeforeHarvest + TX_FEE + ataRentPaid;
  check('tranche rent refunded to owner in full', trancheRent > 0n && rentBack === trancheRent, `rent=${trancheRent} refunded=${rentBack}`);
  check('principal unstaked from ORE Stake', stakeBefore - stakeBalance() === 1_500_000_000n, `stake ${stakeBefore} -> ${stakeBalance()}`);
  check('config totals', cfg().staked === legacyPrincipal + 300_000_000n && cfg().matured >= 1_500_000_000n, JSON.stringify(cfg(), (_, v) => typeof v === 'bigint' ? v.toString() : v));

  // 9. Harvest twice is impossible
  r = send([await createHarvestMaturedTrancheInstruction(user.publicKey, user.publicKey, 1)], [user]);
  check('double harvest rejected', !r.ok);

  // 10. Vault stays solvent: staked principal covers every open tranche
  check('stake balance == open principal', stakeBalance() === cfg().staked, `stake=${stakeBalance()} principal=${cfg().staked}`);

  checkSolvent('double harvest attempt');

  // Helpers for the remaining cases
  const setVesting = (start: bigint, amount: bigint) => {
    const v = svm.getAccount(vestingPda)!;
    const d = Buffer.from(v.data);
    d.writeBigUInt64LE(amount, 8); d.writeBigUInt64LE(0n, 16); d.writeBigInt64LE(start, 24);
    svm.setAccount(vestingPda, { ...v, data: d });
  };
  const newWallet = (ore: bigint) => {
    const kp = Keypair.generate();
    svm.airdrop(kp.publicKey, 2_000_000_000n);
    const ata = getAssociatedTokenAddressSync(ORE_MINT_ADDRESS, kp.publicKey);
    setTokenAccount(ata, kp.publicKey, ore);
    return { kp, ata };
  };
  const initializeIx = (signer: PublicKey) => new TransactionInstruction({
    programId: ARKANA_VAULT_PROGRAM_ID,
    keys: [
      { pubkey: signer, isSigner: true, isWritable: true },
      { pubkey: configPda, isSigner: false, isWritable: true },
      { pubkey: vaultAuth, isSigner: false, isWritable: true },
      { pubkey: vaultAta, isSigner: false, isWritable: true },
      { pubkey: ORE_MINT_ADDRESS, isSigner: false, isWritable: false },
      { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
      { pubkey: TOKEN_PROGRAM_ID, isSigner: false, isWritable: false },
      { pubkey: ASSOCIATED_TOKEN_PROGRAM_ID, isSigner: false, isWritable: false },
    ],
    data: Buffer.from([0]), // Instruction::Initialize
  });
  const distributeIx = (signer: PublicKey, from: PublicKey, to: PublicKey, amount: bigint) => {
    const data = Buffer.alloc(9);
    data.writeUInt8(4, 0); // Instruction::DistributeReward
    data.writeBigUInt64LE(amount, 1);
    return new TransactionInstruction({
      programId: ARKANA_VAULT_PROGRAM_ID,
      keys: [
        { pubkey: signer, isSigner: true, isWritable: true },
        { pubkey: configPda, isSigner: false, isWritable: true },
        { pubkey: vaultAuth, isSigner: false, isWritable: true },
        { pubkey: to, isSigner: false, isWritable: true },
        { pubkey: from, isSigner: false, isWritable: true },
        { pubkey: ORE_MINT_ADDRESS, isSigner: false, isWritable: false },
        { pubkey: TOKEN_PROGRAM_ID, isSigner: false, isWritable: false },
      ],
      data,
    });
  };

  const TN = T0 + 367n * DAY;
  setTime(TN);

  // 11. Initialize: only the treasury, only once
  {
    const configBefore = Buffer.from(svm.getAccount(configPda)!.data);
    r = send([initializeIx(attacker.publicKey)], [attacker]);
    check('Initialize by a non-treasury signer rejected', !r.ok && Buffer.from(svm.getAccount(configPda)!.data).equals(configBefore));
    svm.airdrop(ARKANA_TREASURY_ADDRESS, 5_000_000_000n);
    r = sendAsTreasury([initializeIx(ARKANA_TREASURY_ADDRESS)]);
    check('re-Initialize by the treasury rejected (AlreadyInitialized)',
      !r.ok && r.logs.some(l => l.includes('custom program error: 0x0')) && Buffer.from(svm.getAccount(configPda)!.data).equals(configBefore));

    // On a fresh (empty) config the signer check is what stops a stranger; the treasury can initialize
    const saved = svm.getAccount(configPda)!;
    removeAccount(configPda);
    r = send([initializeIx(attacker.publicKey)], [attacker]);
    check('Initialize of an empty config by a non-treasury signer rejected', !r.ok && lamports(configPda) === 0n);
    r = sendAsTreasury([initializeIx(ARKANA_TREASURY_ADDRESS)]);
    check('Initialize of an empty config by the treasury succeeds (positive control)', r.ok && lamports(configPda) > 0n);
    svm.setAccount(configPda, { lamports: saved.lamports, data: Buffer.from(saved.data), owner: saved.owner, executable: false });
  }

  // 12. Account substitution on deposit: fake ORE Stake program, stake, vesting, ORE Stake treasury, mint
  {
    const fakeStakeProgram = Keypair.generate().publicKey;
    svm.addProgramFromFile(fakeStakeProgram, __dirname + '/fixtures/ore_stake.so');
    const fakeMint = cloneAccount(ORE_MINT_ADDRESS);
    const fakeMintAta = getAssociatedTokenAddressSync(fakeMint, user.publicKey);
    setTokenAccount(fakeMintAta, user.publicKey, 10_000_000_000n, fakeMint);
    const cases: Array<[string, PublicKey, PublicKey, PublicKey?, PublicKey?]> = [
      ['fake ORE Stake program id', STAKE_PROGRAM, fakeStakeProgram],
      ['fake ORE Stake stake account', stakePda, cloneAccount(stakePda)],
      ['fake ORE Stake stake token account', stakeTokens, cloneAccount(stakeTokens)],
      ['fake ORE Stake vesting account', vestingPda, cloneAccount(vestingPda)],
      ['fake ORE Stake treasury account', oreTreasury, cloneAccount(oreTreasury)],
      ['fake ORE Stake treasury token account', oreTreasuryTokens, cloneAccount(oreTreasuryTokens)],
      ['fake ORE mint', ORE_MINT_ADDRESS, fakeMint, userAta, fakeMintAta],
    ];
    for (const [what, from, to, from2, to2] of cases) {
      const before = [tokenAmount(userAta), tokenAmount(fakeMintAta), tokenAmount(vaultAta), stakeBalance(), cfg().staked];
      const ix = swapKey(await createDepositTrancheInstruction(user.publicKey, 3, 100_000_000n), from, to);
      if (from2 && to2) swapKey(ix, from2, to2);
      r = send([ix], [user]);
      const after = [tokenAmount(userAta), tokenAmount(fakeMintAta), tokenAmount(vaultAta), stakeBalance(), cfg().staked];
      check(`deposit with ${what} rejected`, !r.ok && after.every((v, i) => v === before[i]) && !tranche(user.publicKey, 3));
    }
    // SyncStake and claim with a fake ORE Stake program id
    r = send([swapKey(createSyncStakeInstruction(user.publicKey), STAKE_PROGRAM, fakeStakeProgram)], [user]);
    check('SyncStake with fake ORE Stake program id rejected', !r.ok);
    r = send([swapKey(await createClaimTrancheYieldInstruction(user.publicKey, 2), STAKE_PROGRAM, fakeStakeProgram)], [user]);
    check('claim with fake ORE Stake program id rejected', !r.ok);
    // Harvest of the matured tranche #2 with a fake Arkana treasury (attacker wallet + attacker ATA)
    {
      const ix = await createHarvestMaturedTrancheInstruction(user.publicKey, user.publicKey, 2);
      swapKey(ix, ARKANA_TREASURY_ADDRESS, attacker.publicKey);
      swapKey(ix, treasuryOreAta, attackerAta);
      r = send([ix], [user]);
      check('harvest with fake Arkana treasury rejected', !r.ok && tokenAmount(attackerAta) === 0n && !!tranche(user.publicKey, 2));
    }
    // Harvest with fake ORE Stake stake account
    r = send([swapKey(await createHarvestMaturedTrancheInstruction(user.publicKey, user.publicKey, 2), stakePda, cloneAccount(stakePda))], [user]);
    check('harvest with fake ORE Stake stake account rejected', !r.ok && !!tranche(user.publicKey, 2));
  }

  // 13. Keeper tranche: opened now by another wallet, harvested by the treasury a year later (step 17)
  const keeperOwner = newWallet(3_000_000_000n);
  r = send([await createDepositTrancheInstruction(keeperOwner.kp.publicKey, 1, 3_000_000_000n)], [keeperOwner.kp]);
  check('keeper-case owner deposit succeeds', r.ok);
  openTranches.push([keeperOwner.kp.publicKey, 1]);
  removeAccount(keeperOwner.ata); // owner closes its ORE account (it is empty) before maturity

  // 14. DistributeReward: adds ORE to the pool and raises the factor; never pays out
  {
    const donor = newWallet(5_000_000_000n);
    const amount = 1_000_000_000n;
    const f0 = factor(), staked = cfg().staked, vault0 = tokenAmount(vaultAta);
    r = send([distributeIx(donor.kp.publicKey, donor.ata, vaultAta, amount)], [donor.kp]);
    check('DistributeReward succeeds', r.ok);
    check('DistributeReward moves ORE from donor into the vault', tokenAmount(vaultAta) - vault0 === amount && tokenAmount(donor.ata) === 4_000_000_000n);
    const expectedDelta = (amount << 48n) / staked; // Numeric(amount) / Numeric(total_staked_ore), truncated
    check('DistributeReward raises rewards_factor by amount / total_staked', factor() - f0 === expectedDelta, `delta=${factor() - f0} expected=${expectedDelta}`);
    checkSolvent('DistributeReward');

    const vault1 = tokenAmount(vaultAta), f1 = factor();
    r = send([distributeIx(attacker.publicKey, vaultAta, attackerAta, 1_000_000n)], [attacker]);
    check('DistributeReward with source/destination swapped rejected', !r.ok);
    r = send([distributeIx(attacker.publicKey, vaultAta, vaultAta, 1_000_000n)], [attacker]);
    check('DistributeReward from the vault ATA rejected', !r.ok);
    r = send([distributeIx(attacker.publicKey, attackerAta, vaultAta, 0n)], [attacker]);
    check('DistributeReward of 0 rejected', !r.ok);
    check('DistributeReward attempts took nothing out', tokenAmount(vaultAta) === vault1 && tokenAmount(attackerAta) === 0n && factor() === f1);
  }

  // 15. Same-day top-up after yield: pending yield on the old balance is paid before the balance changes
  {
    const u = newWallet(5_000_000_000n);
    setTime(TN + 100n);
    r = send([await createDepositTrancheInstruction(u.kp.publicKey, 1, 2_000_000_000n)], [u.kp]);
    check('top-up case: first deposit succeeds', r.ok);
    openTranches.push([u.kp.publicKey, 1]);
    setVesting(TN + 200n, 500_000_000_000n);
    setTime(TN + 2000n);
    r = send([createSyncStakeInstruction(attacker.publicKey)], [attacker]);
    const t0 = tranche(u.kp.publicKey, 1)!;
    check('top-up case: yield accrued on the tranche', r.ok && factor() > t0.last);
    const ore0 = tokenAmount(u.ata);
    setTime(TN + 2100n);
    r = send([await createDepositTrancheInstruction(u.kp.publicKey, 1, 1_000_000_000n)], [u.kp]);
    const f = factor(); // includes the yield synced by the top-up itself
    const t1 = tranche(u.kp.publicKey, 1)!;
    const expected = pendingYield(f, t0.last, 2_000_000_000n);
    const paid = tokenAmount(u.ata) - (ore0 - 1_000_000_000n);
    check('same-day top-up succeeds into the same tranche', r.ok && !tranche(u.kp.publicKey, 2) && t1.deposited === 3_000_000_000n);
    check('top-up paid pending yield on the old balance only', expected > 0n && paid === expected && t1.claimed === expected, `paid=${paid} expected=${expected}`);
    check('top-up checkpoints the tranche at the current factor', t1.last === f);
    checkSolvent('same-day top-up');
  }

  // 16. Two users share yield pro rata; the late depositor gets nothing from before its deposit
  {
    const a = newWallet(4_000_000_000n), b = newWallet(1_000_000_000n);
    const X = 4_000_000_000n, Y = 1_000_000_000n;
    setVesting(TN + DAY, 500_000_000_000n);
    setTime(TN + DAY + 10n);
    r = send([await createDepositTrancheInstruction(a.kp.publicKey, 1, X)], [a.kp]);
    const fa = tranche(a.kp.publicKey, 1)!.last;
    openTranches.push([a.kp.publicKey, 1]);
    setTime(TN + DAY + 1800n);
    const rb = send([await createDepositTrancheInstruction(b.kp.publicKey, 1, Y)], [b.kp]);
    const fb = tranche(b.kp.publicKey, 1)!.last;
    openTranches.push([b.kp.publicKey, 1]);
    check('pro-rata case: both deposits succeed, yield accrued between them', r.ok && rb.ok && fb > fa, `fa=${fa} fb=${fb}`);
    checkSolvent('second depositor');
    setTime(TN + DAY + 3000n);
    r = send([createSyncStakeInstruction(attacker.publicKey)], [attacker]);
    const f2 = factor();
    check('pro-rata case: more yield after both deposits', r.ok && f2 > fb);
    r = send([await createClaimTrancheYieldInstruction(a.kp.publicKey, 1)], [a.kp]);
    const claimA = tokenAmount(a.ata);
    const rb2 = send([await createClaimTrancheYieldInstruction(b.kp.publicKey, 1)], [b.kp]);
    const claimB = tokenAmount(b.ata);
    // Each claim runs its own sync first: use the factor each tranche was checkpointed at
    const fA = tranche(a.kp.publicKey, 1)!.last, fB = tranche(b.kp.publicKey, 1)!.last;
    check('pro-rata case: both claims succeed', r.ok && rb2.ok);
    check('early depositor gets floor((F - F_deposit) * X)', claimA === pendingYield(fA, fa, X), `claimA=${claimA}`);
    check('late depositor gets only yield since its deposit', claimB === pendingYield(fB, fb, Y) && claimB < pendingYield(fB, fa, Y), `claimB=${claimB} withEarlier=${pendingYield(fB, fa, Y)}`);
    // Over the common period [fb, fA] they earn in proportion to principal (4:1)
    const commonA = pendingYield(fA, fb, X), commonB = pendingYield(fA, fb, Y);
    check('shared period split 4:1 by principal', commonB > 0n && (commonA - 4n * commonB) >= 0n && (commonA - 4n * commonB) < 4n, `A=${commonA} B=${commonB}`);
    checkSolvent('pro-rata claims');
  }

  // 17. Treasury as keeper force-harvests a matured tranche owned by another wallet whose ORE ATA is gone
  {
    const owner = keeperOwner.kp.publicKey;
    setVesting(TN + 366n * DAY, 500_000_000_000n);
    setTime(TN + 366n * DAY + 1800n);
    const t = tranche(owner, 1)!;
    const trancheAcc = getTranchePda(owner, 1)[0];
    const rent = lamports(trancheAcc);
    const ownerLamports0 = lamports(owner), treasuryLamports0 = lamports(ARKANA_TREASURY_ADDRESS);
    const treasuryOre0 = tokenAmount(treasuryOreAta), stake0 = stakeBalance();
    const treasuryAtaExisted = !!svm.getAccount(treasuryOreAta);
    check('keeper case: owner ORE ATA is missing before harvest', !svm.getAccount(keeperOwner.ata) || lamports(keeperOwner.ata) === 0n);
    r = sendAsTreasury([await createHarvestMaturedTrancheInstruction(ARKANA_TREASURY_ADDRESS, owner, 1)]);
    check('treasury can harvest a matured tranche owned by another wallet', r.ok);
    openTranches.splice(openTranches.findIndex(([o, id]) => o.equals(owner) && id === 1), 1);
    const expectedYield = pendingYield(factor(), t.last, t.deposited);
    check('keeper harvest: principal went to the treasury ATA', tokenAmount(treasuryOreAta) - treasuryOre0 === 3_000_000_000n);
    check('keeper harvest: principal unstaked', stake0 - stakeBalance() === 3_000_000_000n);
    check('keeper harvest: owner ATA created, yield paid to owner', expectedYield > 0n && tokenAmount(keeperOwner.ata) === expectedYield, `yield=${tokenAmount(keeperOwner.ata)} expected=${expectedYield}`);
    check('keeper harvest: tranche rent refunded to owner, owner paid nothing', rent > 0n && lamports(owner) - ownerLamports0 === rent, `rent=${rent} owner +${lamports(owner) - ownerLamports0}`);
    const ataRent = lamports(keeperOwner.ata) + (treasuryAtaExisted ? 0n : lamports(treasuryOreAta));
    check('keeper harvest: treasury paid the tx fee and the missing ATA rent', treasuryLamports0 - lamports(ARKANA_TREASURY_ADDRESS) === TX_FEE + ataRent, `treasury -${treasuryLamports0 - lamports(ARKANA_TREASURY_ADDRESS)} fee+rent=${TX_FEE + ataRent}`);
    check('keeper harvest: tranche closed', !tranche(owner, 1));
    checkSolvent('keeper harvest');
  }

  // Prefunding attack: lamports sent to a user's not-yet-created UserVault and Tranche PDAs must not
  // block the first deposit (steel tops the rent up and allocates instead of create_account)
  {
    const victim = newWallet(2_000_000_000n);
    const vPda = getUserVaultPda(victim.kp.publicKey)[0];
    const tPda = getTranchePda(victim.kp.publicKey, 1)[0];
    r = send([
      SystemProgram.transfer({ fromPubkey: attacker.publicKey, toPubkey: vPda, lamports: 1_000_000 }),
      SystemProgram.transfer({ fromPubkey: attacker.publicKey, toPubkey: tPda, lamports: 1_000_000 }),
    ], [attacker]);
    check('prefund: attacker funded both PDAs before the first deposit', r.ok && lamports(vPda) === 1_000_000n && lamports(tPda) === 1_000_000n);
    const stake0 = stakeBalance();
    r = send([await createDepositTrancheInstruction(victim.kp.publicKey, 1, 1_000_000_000n)], [victim.kp]);
    check('prefund: first deposit still succeeds', r.ok, r.ok ? '' : r.logs.slice(-3).join(' | '));
    const t = tranche(victim.kp.publicKey, 1);
    check('prefund: tranche owned by the vault program with the right principal',
      !!t && svm.getAccount(tPda)!.owner.equals(ARKANA_VAULT_PROGRAM_ID) && t.deposited === 1_000_000_000n && stakeBalance() - stake0 === 1_000_000_000n);
    if (r.ok) openTranches.push([victim.kp.publicKey, 1]);
    checkSolvent('prefunded first deposit');
  }

  check('final: stake balance == open principal', stakeBalance() === cfg().staked, `stake=${stakeBalance()} principal=${cfg().staked}`);


  console.log(failures === 0 ? '\nALL PASSED' : `\n${failures} FAILED`);
  process.exit(failures ? 1 : 0);
})();
