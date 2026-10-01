# Arkana ORE vault

A Solana program written with [Steel](https://github.com/regolith-labs/steel). It receives the ORE part (34%) of every Arkana payment, keeps it in a daily tranche per user and stakes all of it in ORE Stake.

- Program id: `B49g3obWUCPQzP9kdcRiCPJDurufWhJhszpQsK5eeV8C` (mainnet)
- ORE Stake: `stakecNP3FpiExZPCgZfqRgumVzi6dNqnfrjwXyTgeH`
- ORE mint: `oreoU2P8bN6jkk3jbaiVxYnG1dCXcYxwhwyK9jSybcp`
- Treasury: `4v3d1itZVjLtDQEqGLFLtfr1riffAEcqnNtumEumJgny` (hardcoded in `api/src/consts.rs`; changeable only by a program upgrade, see Trust notes)

## What it does

1. The first deposit of a UTC day opens a new tranche for the user and pays its rent. Later deposits that day top up the same tranche at no extra rent.
2. All deposited ORE is staked in ORE Stake by the vault authority PDA.
3. ORE Stake yield is pulled into the vault and shared between open tranches in proportion to their size (a global rewards factor). A top-up settles yield on the old balance first, so new ORE never earns yield for time it was not in the vault.
4. The owner can claim yield from a tranche at any time.
5. **365-day rule.** A tranche expires 365 days (31,536,000 seconds) after it was opened. Harvest is rejected before that. At harvest the principal is unstaked and sent to the treasury, the unclaimed yield goes to the owner, and the tranche account is closed with its rent refunded to the owner.

## Instructions

| # | Instruction | Who can call | What it does |
| :--- | :--- | :--- | :--- |
| 0 | `Initialize` | Treasury key only, once | Creates the config and the vault token account |
| 1 | `DepositTranche` | Any user, for their own tranche | Moves ORE from the user into today's tranche and stakes it |
| 2 | `ClaimTrancheYield` | Tranche owner only | Pulls ORE Stake yield, pays the owner's share |
| 3 | `HarvestMaturedTranche` | Tranche owner or treasury, after 365 days | Principal to the treasury ATA, yield and rent to the owner |
| 4 | `DistributeReward` | Anyone | Adds ORE to the reward pool (a donation to open tranches) |
| 5 | `SyncStake` | Anyone (crank) | Claims ORE Stake yield into the vault and stakes idle principal |

## Accounts

| Account | Seeds | Holds |
| :--- | :--- | :--- |
| `VaultConfig` | `["arkana_config"]` | Treasury, ORE mint, rewards factor, totals |
| Vault authority | `["arkana_vault_auth"]` | Owns the vault ORE token account and the ORE Stake position |
| `UserVault` | `["arkana_user_vault", owner]` | Tranche count, last deposit day, user totals |
| `Tranche` | `["arkana_tranche", owner, tranche_id (u32 LE)]` | Principal, deposit and expiry time, rewards checkpoint |

Code: `api/` (state, instructions, constants, PDA helpers) and `program/` (one file per instruction, `stake.rs` for the ORE Stake CPIs).

## Trust notes

- **Upgrade authority.** The program is upgradeable and its authority is currently the treasury key `4v3d1itZVjLtDQEqGLFLtfr1riffAEcqnNtumEumJgny`. Plan: move it to a multisig with a timelock, or make the program immutable after an audit.
- **ORE Stake dependency.** Deposit, claim and harvest call ORE Stake. If ORE Stake pauses or changes its accounts, these instructions revert until the vault is upgraded.
- **DistributeReward is permissionless.** It can only add ORE, never take it out.
- **Harvest destinations are fixed.** Principal can only go to the treasury's ORE ATA. Yield and rent always go to the tranche owner, never to the caller.
- **The treasury can force-harvest.** Once a tranche is 365 days old, the treasury key can harvest it without the owner's signature. The principal goes to the treasury ATA; the unclaimed yield and the tranche rent still go to the owner.
- **Keeper costs.** When the treasury runs harvest as keeper it pays the transaction fee and the rent of any missing ATA (the owner's ORE ATA if it was closed, and the treasury ATA on first use). The owner pays nothing and receives the full tranche rent.
- **No external audit yet.**

## Build and test

Requires Rust, the Solana CLI (for `cargo build-sbf` and `solana`) and Node.js 20.

```bash
cargo build-sbf          # target/deploy/arkana_ore_vault.so
cargo test               # unit tests (PDA isolation and more)
cd tests
npm ci
npm run fixtures         # mainnet snapshots into tests/fixtures (uses SOLANA_RPC_URL or the public RPC)
npm test
```

`npm test` runs `vault.test.ts` in [LiteSVM](https://github.com/LiteSVM/litesvm) with the real ORE Stake binary and mainnet snapshots of the ORE mint, ORE Stake treasury and vesting, and the Arkana vault accounts. The test builds its instructions with the app's client code (`arkana-app/services/oreVaultService.ts`); the `test` script sets `NODE_PATH` so those imports resolve from `tests/node_modules`, and `arkana-app` does not need `npm ci`. Treasury-signed transactions (Initialize, keeper harvest) are sent with signature verification switched off for that transaction only, since the treasury key is not available to the test. The suite runs 80 checks and ends with `ALL PASSED`. It covers:

- **Deposit and stake:** SyncStake migration of legacy principal into ORE Stake; first deposit opens a tranche and stakes it; same-day top-up reuses the tranche; a same-day deposit into the next tranche id is rejected.
- **Yield:** SyncStake claims ORE Stake yield into the vault; claim pays the pro-rata share; a same-day top-up after yield pays exactly floor((factor - checkpoint) * old balance) before the balance changes and re-checkpoints the tranche; two users share yield pro rata (4:1 by principal over the common period) and the late depositor gets nothing from before its deposit.
- **DistributeReward:** moves ORE from the donor into the vault and raises the rewards factor by exactly amount / total staked; swapped source and destination, the vault ATA as source and a zero amount are all rejected and take nothing out.
- **Initialize:** a non-treasury signer is rejected (on the live config and on an empty one); re-initialization by the treasury is rejected with `AlreadyInitialized`; the treasury can initialize an empty config (positive control).
- **Account substitution:** deposit with a fake ORE Stake program id, stake account, stake token account, vesting, ORE Stake treasury, ORE Stake treasury token account or ORE mint is rejected with no balance change; SyncStake and claim with a fake ORE Stake program id are rejected; harvest with a fake Arkana treasury, a wrong treasury ATA or a fake stake account is rejected.
- **Harvest:** early harvest, harvest by a stranger, claiming another user's tranche and double harvest are rejected; harvest by the owner after 366 days sends the principal to the treasury ATA, unclaimed yield to the owner, refunds the tranche rent in full and unstakes the principal; harvest by the treasury as keeper of a tranche owned by another wallet whose ORE ATA was closed creates that ATA, pays the yield and the full rent to the owner, sends the principal to the treasury ATA, and charges the treasury exactly the fee plus the ATA rent.
- **Solvency invariant**, checked after every yield-changing step (sync, claim, top-up, DistributeReward, deposits, harvests): the vault ORE ATA covers the sum over open tranches of floor((rewards_factor - last_rewards_factor) * deposited), computed in the program's I80F48 fixed point, and the ORE Stake balance covers open principal. Mainnet tranches opened before the snapshot are not in the fixtures: their principal is counted as one tranche checkpointed at the snapshot factor, and the yield already in the vault ATA at the snapshot is set aside for whatever they were owed before it, which the test cannot see.

`scripts/devnet/` has older devnet helpers; see [scripts/devnet/README.md](scripts/devnet/README.md).
