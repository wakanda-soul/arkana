# Arkana server

Node.js API behind the Arkana app: card draws, readings, the LLM proxy for Ask Arkana, daily quotas and streaks, on-chain payment checks, and the arkana.icu website.

## What it does

- **Deck and readings.** Definitions of all 78 cards in five suits (Genesis, Nodes, Liquidity, Protocols, Assets). Cards are drawn on the server with a secure RNG; card lists or seeds sent by the client are ignored. Rules look at card pairs and the dominant suit. A reading has six chapters (I to VI).
- **Ask Arkana.** `src/ai/oracleService.js` calls an LLM CLI through a sandboxed wrapper (`AGY_BIN`). Input is checked for prompt injection and requests for code before it reaches the model, and the answer is checked again on the way out. If `AGY_BIN` is not set up, or the model fails or times out, the built-in engine answers from the drawn card in the user's language (10 languages). This engine runs on the server; the app still needs internet.
- **Dialogue log.** Every conversation is written to `data/*.jsonl` for review of injection attempts and errors. Logs never go to git.
- **Quotas and streaks.** 3 free spreads or questions per UTC day for Seeker Genesis Token holders (one shared quota, checked on chain), the Seeker Oracle Pass (333 SKR for 30 days, +5 spreads a day), streak bonuses (+1/+2/+3/+5 on days 7/14/21/28, then +5 every 7 days, banked for spreads and questions) and streak repair.
- **Payment checks.** Every paid action is verified on chain before it counts: signer, SKR burn (33%), treasury transfer (33%), ORE deposit into the vault (34%), and that the signature is used once.
- **Treasury attestation.** `GET /api/treasury` returns the treasury address with its offline Ed25519 signature. The app verifies it before paying.
- **Lookup table keeper.** `src/solana/lookupTable.js` keeps the Arkana Address Lookup Table filled with the vault, ORE Stake and pool accounts of current payment routes, so a payment fits into one transaction. It refreshes every 30 minutes.
- **Website.** Serves the arkana.icu landing and install pages.

## API

| Method | Path | Purpose |
| :--- | :--- | :--- |
| `GET` | `/api/health`, `/api/version` | Status and current app build |
| `GET` | `/api/deck` | All 78 cards |
| `GET` | `/api/spreads` | Spread layouts |
| `GET` | `/api/clock-in/:wallet` | Clock-In status, streak, remaining free spreads |
| `POST` | `/api/clock-in` | Daily draw, streak update, quota refill |
| `POST` | `/api/spread/consume` | Use a free spread or record a paid one |
| `POST` | `/api/reading` | Draw cards and write the reading |
| `POST` | `/api/chat` | Ask Arkana |
| `GET` | `/api/treasury` | Treasury address and attestation |
| `GET` | `/api/lookup-table` | Arkana lookup table address |
| `POST` | `/api/offering`, `/api/subscription/activate`, `/api/streak/repair` | Record paid actions |
| `POST` | `/api/seeker/status` | Seeker Genesis holder status |
| `POST` | `/api/solana-rpc` | Read-only RPC proxy (a few methods) for the vault admin pages |
| `POST` | `/api/auth/nonce`, `/api/auth/verify` | Wallet sign-in: sign a message, get a 30-day session |
| `GET` | `/api/admin/ore-stats` | ORE usage report: tranches, staked ORE, claimed yield, payments. Requires `ARKANA_ADMIN_TOKEN` |
| `*` | `/api/admin/*` | Economy config and dialogue logs, requires `ARKANA_ADMIN_TOKEN` |

## Configuration

Copy [.env.example](.env.example) to `.env` (never committed). All variables are optional.

| Variable | Default | Meaning |
| :--- | :--- | :--- |
| `PORT` | `3001` | API port |
| `HOST` | `127.0.0.1` | Listen address. Use `0.0.0.0` without a reverse proxy |
| `ARKANA_BIND_80` | on | `off` skips the extra HTTP listener on port 80 (set it off locally and behind Caddy) |
| `SOLANA_RPC_URL` | public RPC | RPC for payment checks, Seeker Genesis checks, Clock-In recovery, the lookup table keeper and the RPC proxy |
| `SOLANA_STATUS_RPC_URL` | public mainnet RPC | Second RPC for transaction status checks |
| `STATS_RPC_URL` | public mainnet RPC | RPC for `/api/admin/ore-stats` (uses `getProgramAccounts`) |
| `ARKANA_ADMIN_TOKEN` | unset | Token for `/api/admin/*` (header `x-admin-token` or `Authorization: Bearer`). Admin endpoints return 404 without it |
| `ARKANA_ALT_KEEPER` | on | `off` disables the lookup table keeper |
| `ARKANA_ALT_KEYPAIR` | `~/.config/solana/id.json` | Keypair that pays rent for the lookup table. The keeper stays off if the file is missing |
| `AGY_BIN` | `/usr/local/bin/arkana-agy` | Sandboxed LLM wrapper. Without it the built-in engine answers |
| `ARKANA_REQUIRE_SESSION` | on | `off` accepts requests without a signed wallet session (local testing only) |

## AI sandbox

User text reaches the AI model, so the model must not be able to read anything on the server. The model CLI runs through `deploy/arkana-agy` (installed as `/usr/local/bin/arkana-agy`), a bubblewrap sandbox that sees only system libraries, an empty `/tmp` and its own home `/var/lib/arkana-ai/home` holding just the CLI auth token. Setup: `apt install bubblewrap`, copy the script, create that home with the auth token.

## Running

```bash
npm ci
cp .env.example .env
npm start
curl localhost:3001/api/health
```

In production it runs as the systemd unit `arkana.service` behind Caddy ([deploy/Caddyfile](deploy/Caddyfile)). New APK builds are copied to the server by a cron script that is not part of this repo.
