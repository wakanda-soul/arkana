# Arkana server

Node.js API behind the Arkana app: card draws, readings, the LLM proxy for Ask Arkana, daily quotas and streaks, on-chain payment checks, and the arkana.icu website.

## What it does

- **Deck and readings.** Definitions of all 78 cards in five suits (Genesis, Nodes, Liquidity, Protocols, Assets). Cards are drawn on the server with a secure RNG; card lists or seeds sent by the client are ignored. The engine reads authored card pairs, the dominant suit and each card's energy, and computes the tone of the spread (favourable, mixed, challenging, warning) that the model must follow. A reading has six chapters (I to VI).
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
| `POST` | `/api/reading` | Draw cards and write the reading |
| `POST` | `/api/chat` | Ask Arkana |
| `GET` | `/api/treasury` | Treasury address and attestation |
| `GET` | `/api/lookup-table` | Arkana lookup table address |
| `GET`, `POST` | `/api/jup/quote`, `/api/jup/swap-instructions` | Jupiter proxy with the server's API key; SOL, SKR and ORE swaps only |
| `GET` | `/api/prices` | Live SKR→SOL and ORE→SOL rates for display prices |
| `POST` | `/api/offering`, `/api/subscription/activate`, `/api/streak/repair` | Record paid actions |
| `POST` | `/api/payment/credit` | Credit a signed payment whose request never arrived (action read from the on-chain memo) |
| `POST` | `/api/seeker/status` | Seeker Genesis holder status |
| `POST` | `/api/solana-rpc` | Read-only RPC proxy (a few methods) for the vault admin pages |
| `POST` | `/api/auth/nonce`, `/api/auth/verify` | Wallet sign-in (Sign In With Solana, in the same wallet visit as connecting): 30-day session, at most 5 per wallet |
| `GET` | `/api/admin/ore-stats` | ORE usage report: tranches, staked ORE, claimed yield, payments. Requires `ARKANA_ADMIN_TOKEN` |
| `*` | `/api/admin/*` | Economy config and dialogue logs, requires `ARKANA_ADMIN_TOKEN` |

## Configuration

Copy [.env.example](.env.example) to `.env` (never committed). All variables are optional.

| Variable | Default | Meaning |
| :--- | :--- | :--- |
| `PORT` | `3001` | API port |
| `HOST` | `127.0.0.1` | Listen address. Use `0.0.0.0` without a reverse proxy |
| `ARKANA_BIND_80` | off | `on` also serves plain HTTP on port 80 (only without a reverse proxy) |
| `JUPITER_API_KEY` | unset | Jupiter API key (portal.jup.ag). Added to every Jupiter call, including the app's through `/api/jup/*`; without it the free tier's per-IP limit applies |
| `SOLANA_RPC_URL` | public RPC | RPC for payment checks, Seeker Genesis checks, Clock-In recovery, the lookup table keeper and the RPC proxy |
| `SOLANA_STATUS_RPC_URL` | public mainnet RPC | Second RPC for transaction status checks |
| `STATS_RPC_URL` | public mainnet RPC | RPC for `/api/admin/ore-stats` (uses `getProgramAccounts`) |
| `ARKANA_ADMIN_TOKEN` | unset | Token for `/api/admin/*` (header `x-admin-token` or `Authorization: Bearer`), at least 32 characters. Admin endpoints return 404 without it |
| `ARKANA_ALT_KEEPER` | on | `off` disables the lookup table keeper |
| `ARKANA_SYNC_KEEPER` | off | `on` sends a SyncStake every `ARKANA_SYNC_INTERVAL_HOURS` (default 24) so ORE Stake yield reaches the tranches; paid by the ALT keypair |
| `ARKANA_ALT_KEYPAIR` | `~/.config/solana/id.json` | Keypair that pays rent for the lookup table. The keeper stays off if the file is missing |
| `AGY_BIN` | `/usr/local/bin/arkana-agy` | Sandboxed LLM wrapper. Without it the built-in engine answers |
| `ARKANA_REQUIRE_SESSION` | on | `off` accepts requests without a signed wallet session (local testing only; the server logs a warning) |

## AI sandbox

User text reaches the AI model, so the model must not be able to read anything on the server. The model CLI runs through [deploy/arkana-agy](deploy/arkana-agy) (installed as `/usr/local/bin/arkana-agy`, CLI binary at `/opt/agy/agy`): a bubblewrap sandbox that sees only system libraries, an empty `/tmp` and a throwaway home copied for each call from `/var/lib/arkana-ai/home` (CLI config and OAuth token only). A refreshed token is copied back; conversation summaries and logs the CLI writes are deleted. Tools stay off: in print mode the CLI auto-denies every tool permission. Setup: `apt install bubblewrap`, install the script, create that home with the auth token, owned by the service user.

## Running

```bash
npm ci
cp .env.example .env
npm start
curl localhost:3001/api/health
```

In production it runs as the unprivileged `arkana` user from `/srv/arkana`, with the systemd unit [deploy/arkana.service](deploy/arkana.service) (read-only system and code, writable `data/` and AI home only, no capabilities) behind Caddy ([deploy/Caddyfile](deploy/Caddyfile), admin API on a unix socket). Before start, [deploy/arkana-net-guard.sh](deploy/arkana-net-guard.sh) blocks new connections from that user to loopback, private and link-local networks. New APK builds are copied to the server by a cron script that is not part of this repo; it checks each APK's SHA-256 from CI before installing it.
