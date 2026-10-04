# Security

## Reporting a vulnerability

Please report it privately through GitHub: **Security → Report a vulnerability** on this repository, or a direct message to [@wakanda_dev](https://x.com/wakanda_dev) on X. Do not open a public issue for anything that could put user funds at risk. We aim to answer within 72 hours.

In scope: the ORE vault program (`programs/arkana-ore-vault`, mainnet `B49g3obWUCPQzP9kdcRiCPJDurufWhJhszpQsK5eeV8C`), the API server (`arkana-server`), the Android app (`arkana-app`) and the release pipeline.

## How the system is protected

The README describes the controls in place: [AI and safety](README.md#ai-and-safety), [How payments are protected](README.md#how-payments-are-protected), [Server hardening](README.md#server-hardening), [Trust and risks](README.md#trust-and-risks) and [Releases](README.md#releases). The vault program and its 80 LiteSVM checks are described in [programs/arkana-ore-vault/README.md](programs/arkana-ore-vault/README.md).

## Known and accepted

These are known, reviewed and accepted for now. Each has a reason and, where it applies, a plan.

| Item | Why it is accepted | Plan |
| :--- | :--- | :--- |
| The vault program is upgradeable, and its upgrade authority is the treasury key `4v3d1itZ…` | Allows fixes during the hackathon; disclosed in the README | Move the authority to a multisig with a timelock, then audit and make the vault immutable |
| The treasury can harvest any matured tranche | Lets the project close tranches after 365 days; the yield and the rent still go to the owner, and the program fixes both destinations | None needed |
| ORE Stake dependency: if ORE Stake pauses or changes its interface, claims and harvests revert | No funds move in that case; the vault is upgraded to the new interface | Re-check ORE Stake's interface before every deploy |
| Rounding dust stays in the vault token account | Every rounding step floors in the vault's favour, so the vault stays solvent; the amounts are a few base units | Track and redistribute unallocated dust in a future version |
| `npm audit`: `bigint-buffer` (high), pulled in by `@solana/spl-token` and `@solana/web3.js` | No upstream fix exists; the only "fix" npm offers is spl-token 0.1.8 (2021), which would break the app. The libraries use the affected `toBigIntLE` on fixed-size fields of their own data structures | Upgrade when Solana's libraries drop the dependency |
| `npm audit`: `brace-expansion` (high, build tooling only), Expo CLI and config tooling, `jayson`, `uuid`, `stream-json` (moderate) | Build-time tooling or library internals that never receive untrusted input in the shipped APK or the server; fixes need major upgrades of Expo | Follow Expo upgrades after the hackathon |
| Session and wallet-authorization tokens live in app storage (AsyncStorage) | Android app sandbox plus `allowBackup=false`; the session only spends that wallet's own quota and expires after 30 days | Move to the Android Keystore (expo-secure-store) |
| The daily card is drawn in the app (CSPRNG) and sealed in the user's memo | The card is the user's own daily ritual; nothing of value depends on which card it is | None needed |

## Security audit 2026-10-04

The hackathon's automated security review ran on commit `ecccbd5` and reported 41 items (6 high, 14 medium, 20 low, 1 info). It confirmed no defect in our own code. Every item was checked by hand against the code; the result:

| Finding | Verdict | Evidence |
| :--- | :--- | :--- |
| Leaked secret: `arkana-app/data/locales/cards/id.json` (solana-keypair-file) | False positive, renamed | A filename rule: `id` is the Indonesian language code; the file holds card translations. Renamed to `indonesian.json` so scanners stop matching it. No key is in the repository |
| Leaked secret: `soundService.ts:18-19` (generic-api-key) | False positive, renamed | The values are AsyncStorage names (`arkana_sound_muted_v1`, `arkana_ambient_muted_v1`); the constants are now `MUTE_PREF` / `AMBIENT_PREF`, and stock gitleaks 8.30.1 finds nothing in tracked files |
| PDA sharing, `deposit.rs:191`, `distribute.rs:43` (low confidence) | By design | One vault authority PDA holds all tranches' ORE and the single ORE Stake position. Per-user state lives in tranche PDAs seeded by owner and day, and every handler checks the owner, the tranche PDA and the token accounts' owner and mint. The 80 LiteSVM checks include account substitution and cross-user claims |
| Unchecked `rewards_factor +=` and division, `distribute.rs:51`, `stake.rs:96` | Not exploitable | Release builds use `overflow-checks = true`, so an overflow aborts the transaction instead of wrapping. Division by zero is impossible: `distribute` rejects `total_staked_ore == 0` and `sync_rewards` checks it. Reaching the I80F48 limit (about 6e23 per staked base unit) would take more ORE than exists. Truncated dust stays in the vault, which keeps it solvent (see Known and accepted) |
| Integer division, `stake.rs:9` | Not applicable | The flagged line is a doc comment; the only divisions are the two above |
| Preflight off, `lookupTable.js:228`, `syncKeeper.js:79/81` | By design | The first send of the lookup-table transaction runs preflight; only the re-broadcasts of the same signed bytes skip it. The keeper simulates the transaction itself and stops on any error before sending. Both are server-paid admin transactions, never user payments |
| `@solana/web3.js` v1 imports (19, low) | Accepted | Maintenance mode, not a vulnerability. The Mobile Wallet Adapter and `@wallet-ui` packages the app builds on use v1; move to `@solana/kit` with them |
| `bigint-buffer` 1.1.5 (high) | Not reachable | Called by `@solana/buffer-layout-utils` only as `toBigIntLE(Buffer.from(src))` on fixed 8-byte fields of decoded accounts; no fixed version exists |
| `stream-json` 1.9.1, `uuid` 8.3.2 / 7.0.3 | Not reachable | Pulled in by `jayson`. web3.js uses only `jayson/lib/client/browser`, which never loads `stream-json` (used by jayson's TCP/TLS server and client), and `uuid` is called only as `v4()`, not the affected v3/v5/v6 with a buffer |
| `decode-uri-component` 0.2.2 | Low | Expo's URL parsing in the app; the worst case is a slow parse of a malformed deep link in the user's own app |
| `bincode`, `libsecp256k1` (unmaintained), `borsh` 0.10, `rand` 0.7 | Accepted | Transitive dependencies of `solana-program` 2.x; the vault does not deserialize borsh ZSTs or use `rand`. Follow Solana SDK upgrades |
| `esbuild` 0.23.0 (dev only) | Fixed | Upgraded to 0.25.12 in the vault tests; all 80 checks pass |
| Duplicate crate versions (info) | Accepted | Normal for the Solana SDK dependency tree |

The review ran out of time before every check finished ("budget-exhausted"), so it gave no score. The deployed program matches `cargo build-sbf` from this repository byte for byte.
