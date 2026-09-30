# Arkana

Arkana is a daily crypto tarot ritual for the Solana Seeker phone. Once a day you clock in, draw a card and seal it on Solana with a memo. Arkana, the reader, explains the card and answers your questions in 10 languages. Paid actions are priced in SKR, and every payment burns SKR, funds the project and stakes ORE for you in your own vault tranche. The deck has 78 original cards built on blockchain archetypes.

- Website: [arkana.icu](https://arkana.icu)
- APK: [arkana.icu/arkana.apk](https://arkana.icu/arkana.apk)

## How it works

- **Daily Clock-In.** One card per UTC day. Your wallet seals it with an on-chain memo. Clocking in daily builds a streak. Streak bonus spreads: +1 on day 7, +2 on day 14, +3 on day 21, +5 on day 28, then +5 every 7 days. Bonus spreads are banked and can be used for spreads or questions.
- **Readings.** Cards are drawn on the server with a secure RNG. The server looks at card pairs and the dominant suit, then writes a reading in six chapters (I to VI): the story, hidden forces, what strengthens and weakens you, advice, a warning and a final omen.
- **Ask Arkana.** A chat where Arkana answers a question through a drawn card. The reading engine calls an LLM CLI through a sandboxed wrapper. If the LLM is unavailable, a built-in engine on the server writes the answer. The phone always needs internet.
- **The deck.** Five suits: Genesis (22 cards), Nodes, Liquidity, Protocols and Assets (14 each). The Codex fills card by card as you draw.
- **SKR payments.** A question costs 1 SKR, an extra spread 5 SKR, the Seeker Oracle Pass 333 SKR for 30 days (+5 spreads a day). Every payment is split on chain:
  - 33% of the SKR is burned.
  - 33% goes to the Arkana treasury.
  - 34% is swapped to ORE through Jupiter and deposited into your own daily tranche in the Arkana ORE vault.
- **ORE vault.** The vault stakes all ORE in ORE Stake. You can claim your yield at any time. After 365 days a tranche is harvested: the principal goes to the treasury, and the unclaimed yield plus the tranche rent go back to you. Details: [programs/arkana-ore-vault/README.md](programs/arkana-ore-vault/README.md).

## Why Seeker

- **Seed Vault and Mobile Wallet Adapter.** Sign in and pay with Seed Vault, Phantom, Solflare or Backpack. No keys in the app.
- **Seeker Genesis perk.** Holders of the Seeker Genesis Token get 3 free spreads or questions per UTC day (one shared quota). The server verifies the token on chain.
- **One approval per payment.** Burn, treasury transfer, ORE swap and vault deposit happen in one wallet approval. Paying in SOL works the same way: 66% is swapped to SKR and 34% to ORE in the same approval.

## Architecture

```
arkana-app/         Expo / React Native app for Android (Mobile Wallet Adapter)
arkana-server/      Node.js API: draws, readings, LLM proxy, quotas, streaks, payment checks, website
programs/
  arkana-ore-vault/ Solana program (Steel): daily ORE tranches staked in ORE Stake
```

- The **app** builds payment transactions, signs through the wallet and talks to the server.
- The **server** draws cards, writes readings, verifies every payment on chain (signer, burn, treasury transfer, ORE deposit, single use) and keeps quotas and streaks. See [arkana-server/README.md](arkana-server/README.md).
- The **program** holds the ORE, stakes it in ORE Stake and pays out yield.

Mainnet addresses:

| What | Address |
| :--- | :--- |
| ORE vault program | `B49g3obWUCPQzP9kdcRiCPJDurufWhJhszpQsK5eeV8C` |
| Arkana treasury | `4v3d1itZVjLtDQEqGLFLtfr1riffAEcqnNtumEumJgny` |
| Arkana lookup table | `EbVx4VK1faruN2oPfwSA5B5B934VUtSRfVsXy1KzVg4v` |
| SKR mint | `SKRbvo6Gf7GondiT3BbTfuRDPqLWei4j2Qy2NPGZhW3` |
| ORE mint | `oreoU2P8bN6jkk3jbaiVxYnG1dCXcYxwhwyK9jSybcp` |
| ORE Stake program | `stakecNP3FpiExZPCgZfqRgumVzi6dNqnfrjwXyTgeH` |

The treasury address is signed offline with an Ed25519 key. The app checks that signature before every payment.

## Run it yourself

Requirements: Node.js 20, and for the program the Solana CLI (with `cargo build-sbf`) and Rust.

### Server

```bash
cd arkana-server
npm ci
cp .env.example .env
npm start
```

No variable is required for a local run. The example file already sets `ARKANA_BIND_80=off` (no port 80), `ARKANA_ALT_KEEPER=off` (no lookup table keeper) and `ARKANA_REQUIRE_SESSION=off` (no wallet sign-in). The API listens on `http://127.0.0.1:3001`. Check it with `curl localhost:3001/api/health` and `curl localhost:3001/api/deck`. Readings need a Seeker Genesis Token, a streak bonus or a verified payment, so a random wallet gets a "payment required" answer. Without `AGY_BIN` pointing to a working LLM wrapper, the built-in engine writes the text.

### App

```bash
cd arkana-app
npm ci
npx tsc --noEmit
npx expo run:android   # needs the Android SDK and a device with USB debugging
```

The app talks to `https://arkana.icu`. To use a local server, change `API_BASE_URL` in [arkana-app/services/oracleApi.ts](arkana-app/services/oracleApi.ts). Mobile Wallet Adapter needs a real Android device with a wallet app. An emulator shows the UI only.

### Program and tests

```bash
cd programs/arkana-ore-vault
cargo build-sbf          # builds target/deploy/arkana_ore_vault.so
cargo test               # unit tests of the api crate
cd tests
npm ci
npm run fixtures         # dumps ORE Stake and vault accounts from mainnet (needs the Solana CLI)
npm test                 # LiteSVM end-to-end test
```

The LiteSVM test runs the vault against the real ORE Stake binary and mainnet account snapshots. It deposits, tops up a tranche, pulls yield, claims, moves the clock 366 days, harvests and checks every balance. It also checks that another wallet cannot claim your tranche and that harvest cannot send the principal anywhere but the treasury.

## Trust and risks

- **Upgrade authority.** The vault program is upgradeable. Its upgrade authority is currently the treasury key `4v3d1itZVjLtDQEqGLFLtfr1riffAEcqnNtumEumJgny`. The plan is to move it to a multisig with a timelock, or to make the program immutable after an audit.
- **ORE Stake dependency.** All vault ORE is staked in ORE Stake. If ORE Stake pauses or changes its interface, deposits, claims and harvests revert until the vault is upgraded.
- **DistributeReward is permissionless.** Anyone can add ORE to the reward pool. It is a donation to current tranche holders and cannot take funds out.
- **No audit yet.** The program has tests but no external audit.

## Releases

GitHub Actions ([.github/workflows/build-apk.yml](.github/workflows/build-apk.yml)) builds the APK on every app change pushed to `main`. It is signed with the project release key when the `ARKANA_KEYSTORE` secrets are set, otherwise debug-signed. The version comes from `arkana-app/release.json`: `version` is major.minor, the patch counts CI builds since `firstBuild`. A cron script on the server (not in this repo) copies new builds to arkana.icu.

## License

[MIT](LICENSE). Made by wakanda for the Solana Mobile hackathon "Clock In", 2026.
