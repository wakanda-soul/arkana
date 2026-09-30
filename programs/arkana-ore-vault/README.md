# Arkana ORE vault

A Solana program written with [Steel](https://github.com/regolith-labs/steel). It receives the ORE part (34%) of every Arkana payment, keeps it in a daily tranche per user and stakes all of it in ORE Stake.

- Program id: `B49g3obWUCPQzP9kdcRiCPJDurufWhJhszpQsK5eeV8C` (mainnet)
- ORE Stake: `stakecNP3FpiExZPCgZfqRgumVzi6dNqnfrjwXyTgeH`
- ORE mint: `oreoU2P8bN6jkk3jbaiVxYnG1dCXcYxwhwyK9jSybcp`
- Treasury: `4v3d1itZVjLtDQEqGLFLtfr1riffAEcqnNtumEumJgny` (hardcoded in `api/src/consts.rs`)

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

`npm test` runs `vault.test.ts` in [LiteSVM](https://github.com/LiteSVM/litesvm) with the real ORE Stake binary and mainnet snapshots of the ORE mint, ORE Stake treasury and vesting, and the Arkana vault accounts. The test builds its instructions with the app's client code (`arkana-app/services/oreVaultService.ts`); the `test` script sets `NODE_PATH` so those imports resolve from `tests/node_modules`, and `arkana-app` does not need `npm ci`. It covers deposit, same-day top-up, yield sync and claim, early harvest, harvest by a stranger, claiming another user's tranche, harvest to a wrong treasury account, harvest after 366 days with exact rent refund, double harvest and solvency.

`scripts/devnet/` has older devnet helpers; see [scripts/devnet/README.md](scripts/devnet/README.md).
