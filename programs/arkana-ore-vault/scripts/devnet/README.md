# Devnet helpers

Scripts used while developing the vault on devnet. They are not part of the mainnet setup or the tests, and they need changes before they work for you.

| Script | What it does |
| :--- | :--- |
| `deploy_devnet.sh` | Creates test SKR and ORE mints, deploys the program, runs `init_vault.js` and writes the mints into `arkana-app/constants/networkConfig.ts` |
| `init_vault.js` | Sends `Initialize` for a given test ORE mint: `node init_vault.js <tORE_MINT>` |
| `test_devnet_e2e.js` | Deposits into a tranche on devnet and prints the accounts |

Settings come from environment variables:

| Variable | Default |
| :--- | :--- |
| `DEVNET_URL` | `https://api.devnet.solana.com` |
| `KEYPAIR` | `~/.config/solana/id.json` |
| `PROGRAM_KEYPAIR` | `../../target/deploy/arkana_ore_vault-keypair.json` |
| `PROGRAM_SO` | `../../target/deploy/arkana_ore_vault.so` (shell script only) |
| `NETWORK_CONFIG` | `arkana-app/constants/networkConfig.ts` (shell script only) |
| `PROGRAM_ID`, `TORE_MINT` | Program and test ORE mint for `test_devnet_e2e.js` |
| `NODE_PATH` | `arkana-app/node_modules` (the scripts need `@solana/web3.js` and `@solana/spl-token`) |

What to adapt:

- The program hardcodes the treasury key and the mainnet ORE mint in `api/src/consts.rs`, and `Initialize` accepts only that signer and mint. For devnet, change those constants to your own key and test mint and rebuild.
- `deploy_devnet.sh` edits `networkConfig.ts` in place. Do not commit that change.
