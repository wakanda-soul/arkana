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
