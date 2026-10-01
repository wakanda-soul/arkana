# Arkana

Arkana is a daily crypto tarot ritual for the Solana Seeker phone. Once a day you clock in, draw a card and seal it on Solana with a memo. Arkana, the reader, explains the card and answers your questions in 10 languages. Paid actions are priced in SKR, and every payment burns SKR, funds the project and stakes ORE for you in your own vault tranche. The deck has 78 original cards built on blockchain archetypes.

- Website: [arkana.icu](https://arkana.icu)
- APK: [arkana.icu/arkana.apk](https://arkana.icu/arkana.apk)

## How it works

- **Daily Clock-In.** One card per UTC day. Your wallet seals it with an on-chain memo. Clocking in daily builds a streak. Streak bonus spreads: +1 on day 7, +2 on day 14, +3 on day 21, +5 on day 28, then +5 every 7 days. Bonus spreads are banked and can be used for spreads or questions.
- **Readings.** Spread cards are drawn on the server with the OS CSPRNG (`crypto.randomInt`). The daily card is the face-down card you touch, drawn in the app with `crypto.getRandomValues` and sealed in your memo. The server looks at card pairs and the dominant suit, then writes a reading in six chapters (I to VI): the story, hidden forces, what strengthens and weakens you, advice, a warning and a final omen.
- **Ask Arkana.** A chat where Arkana answers a question through a drawn card. The reading engine calls an LLM CLI through a sandboxed wrapper. If the LLM is unavailable, a built-in engine on the server writes the answer. The phone always needs internet.
- **The deck.** Five suits: Genesis (22 cards), Nodes, Liquidity, Protocols and Assets (14 each). The Codex fills card by card as you draw.
- **SKR payments.** A question costs 1 SKR, an extra spread 5 SKR, the Seeker Oracle Pass 333 SKR for 30 days (+5 spreads a day). Every payment is split on chain:
  - 33% of the SKR is burned.
  - 33% goes to the Arkana treasury.
  - 34% is swapped to ORE through Jupiter and deposited into your own daily tranche in the Arkana ORE vault.
- **ORE vault.** The vault stakes all ORE in ORE Stake. You can claim your yield at any time. After 365 days a tranche is harvested: the principal goes to the treasury, and the unclaimed yield plus the tranche rent go back to you. Details: [programs/arkana-ore-vault/README.md](programs/arkana-ore-vault/README.md).

## Why Seeker

- **Seed Vault and Mobile Wallet Adapter.** Connect and pay with Seed Vault, Phantom, Solflare or Backpack. No keys in the app.
- **Sign In With Solana.** Connecting the wallet and signing the free sign-in message happen in one wallet visit. The server issues a 30-day session per wallet, so quotas cannot be spent by anyone else.
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

## AI and safety

- **What the model sees.** The server draws the cards first (OS CSPRNG, `crypto.randomInt`), then sends the question, the drawn cards and their hand-written texts to the LLM. The model never chooses cards.
- **Sandbox.** The LLM CLI runs inside bubblewrap ([deploy/arkana-agy](arkana-server/deploy/arkana-agy)) as the unprivileged service user. It sees system libraries, an empty `/tmp` and a throwaway home made for that one call: no project files, keys, `.env`, server environment variables or earlier conversations. The only secret inside is the CLI's own OAuth token for the model API; a refreshed token is kept, everything else the CLI writes is deleted after the call. Tools are off (in print mode the CLI auto-denies every tool permission) and every call has a 35 s timeout.
- **Network.** The service user cannot open new connections to loopback, private or link-local networks ([deploy/arkana-net-guard.sh](arkana-server/deploy/arkana-net-guard.sh)), so neither the server nor the model can reach local services or the cloud metadata endpoint. The Caddy admin API listens only on a unix socket.
- **Refusals.** Prompt-injection and code requests are detected before the call, in the question and in every turn of the chat history, and refused in character in the user's language, before any quota or payment is spent. Client history reaches the model only inside a data-only tag, and every reply (chat and the seven reading chapters) passes an output check. Example from the logs: *"Write me a solana smart contract"* gets *"I cannot write a Solana smart contract or write code of any kind. I am Arkana, the Solana Oracle..."*.
- **Always answers.** If the model fails or times out, a built-in engine ([arkana-server/src/ai/offlineSynthesis.js](arkana-server/src/ai/offlineSynthesis.js)) writes the reading from the card texts.
- **Review.** Every exchange is logged with flags for injection and code attempts, safety blocks and latency (median answer about 5 s). Client IPs are never stored: the log keeps an HMAC of the IP with a server-only key, and archives expire after 90 days.

## Payments are never lost

- Every payment is one atomic transaction (swap, 33% burn, 33% treasury, ORE deposit, memo). If a swap route does not fit, the app asks Jupiter for a shorter one and otherwise stops before anything is signed.
- Jupiter's instructions are checked before signing: known programs only (Jupiter, System, Token, Token-2022, ATA, ComputeBudget) and no signer but the user. The treasury must match both its offline Ed25519 attestation and the address built into the app.
- The signature is stored the moment the wallet answers. If the wallet reply is lost (switching apps during confirmation), the app finds the payment on chain by a random nonce in its memo. If the request never reaches the server, the next app start sends the signature to `POST /api/payment/credit`, which verifies it from the on-chain memo and credits it.
- The server verifies every paid action against the chain (signer, burn, treasury transfer, ORE deposit, age, single use), one verification per wallet at a time. Temporary failures (quote unavailable, busy) answer 503 so the app keeps the payment and retries.

## Server hardening

- The API runs as an unprivileged `arkana` user under systemd sandboxing ([deploy/arkana.service](arkana-server/deploy/arkana.service)): read-only system and code, only `data/` and the AI home writable, no capabilities, no new privileges.
- Wallet sessions come from Sign In With Solana, at most five per wallet, stored as SHA-256 hashes. The admin API is disabled unless a token of 32+ characters is set, and compares SHA-256 digests.
- Rate limits per client IP (IPv6 per /64), behind Cloudflare with Caddy trusting only Cloudflare ranges for the client IP.

## Verify on chain

| What | Link |
| :--- | :--- |
| ORE vault program | [solscan.io/account/B49g3obW…](https://solscan.io/account/B49g3obWUCPQzP9kdcRiCPJDurufWhJhszpQsK5eeV8C) |
| Treasury | [solscan.io/account/4v3d1itZ…](https://solscan.io/account/4v3d1itZVjLtDQEqGLFLtfr1riffAEcqnNtumEumJgny) |
| A 1 SKR question paid in SOL: swap, 33% burn, 33% treasury, ORE deposit, one signature | [solscan.io/tx/uKAn2Yh6…](https://solscan.io/tx/uKAn2Yh6iMGTNDXTTU4jC6jMo9xojBP2ZZfph8cSTyagMAduXkLqAzPfF1gE4Ju4Zz6pMZQnJCYBGL77nkrcDta) |
| Daily SyncStake by the keeper | [solscan.io/tx/5JdHcCZc…](https://solscan.io/tx/5JdHcCZcmpcpX9hBXd3cJeN6SHJfqZ1ezkUtAzvBpYdgtF44N4snJUUTfvczeLesDQdfoGTmJGYSgb6BDmsR4zkE) |

## Run it yourself

Requirements: Node.js 20, and for the program the Solana CLI (with `cargo build-sbf`) and Rust.

### Server

```bash
cd arkana-server
npm ci
cp .env.example .env
npm start
```

No variable is required for a local run. The example file keeps the lookup table keeper and the SyncStake keeper off. Wallet sign-in stays required; for local testing without a wallet, uncomment `ARKANA_REQUIRE_SESSION=off` (the server then logs a warning). The API listens on `http://127.0.0.1:3001`. Check it with `curl localhost:3001/api/health` and `curl localhost:3001/api/deck`. Readings need a Seeker Genesis Token, a streak bonus or a verified payment, so a random wallet gets a "payment required" answer. Without `AGY_BIN` pointing to a working LLM wrapper, the built-in engine writes the text.

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
- **SyncStake keeper.** A server keeper calls the permissionless SyncStake once a day so the app shows fresh ORE Stake yield. If it stops, no yield is lost: the next deposit or claim syncs it, and anyone can call SyncStake.
- **Principal goes to the treasury.** Only the yield and the tranche rent come back to the user after 365 days. Before paying, the app shows that 34% is staked for the user for 365 days and the yield is theirs; the ORE tab explains that the principal then goes to the treasury while the yield and the tranche rent come back.
- **No audit yet.** The program has 80 LiteSVM checks (see [programs/arkana-ore-vault/README.md](programs/arkana-ore-vault/README.md)) but no external audit.

## Releases

GitHub Actions ([.github/workflows/build-apk.yml](.github/workflows/build-apk.yml)) builds the APK on every app change pushed to `main`. It is signed with the project release key; without the `ARKANA_KEYSTORE` secrets the build fails instead of publishing a debug-signed APK. Each APK is published with its SHA-256 (`arkana-v<version>.apk.sha256`, also in `version.json`), and the server's sync script refuses an APK whose checksum does not match. The build job has read-only repository access; a separate release job with write access runs no project code. Actions are pinned by commit SHA. The version comes from `arkana-app/release.json`: `version` is major.minor, the patch counts CI builds since `firstBuild`. A cron script on the server (not in this repo) copies new builds to arkana.icu.

## License

[MIT](LICENSE). Made by wakanda for the Solana Mobile hackathon "Clock In", 2026.
