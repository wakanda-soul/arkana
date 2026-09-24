#!/usr/bin/env bash
set -euo pipefail

DEVNET_URL="https://api.devnet.solana.com"
KEYPAIR="/root/.config/solana/id.json"
PROGRAM_KEYPAIR="/root/arkana/programs/arkana-ore-vault/target/deploy/arkana_ore_vault-keypair.json"
PROGRAM_SO="/root/arkana/programs/arkana-ore-vault/target/deploy/arkana_ore_vault.so"
NETWORK_CONFIG="/root/arkana/arkana-app/constants/networkConfig.ts"
export NODE_PATH="/root/arkana/arkana-app/node_modules"

echo "=== Arkana Devnet Deployment Script ==="

DEPLOYER_PUBKEY=$(solana-keygen pubkey "$KEYPAIR")
echo "Deployer Address: $DEPLOYER_PUBKEY"

# 1. Check Devnet SOL balance
BALANCE_OUTPUT=$(solana balance "$DEPLOYER_PUBKEY" --url "$DEVNET_URL")
echo "Current Balance: $BALANCE_OUTPUT"

BALANCE_SOL=$(echo "$BALANCE_OUTPUT" | awk '{print $1}')
if (( $(echo "$BALANCE_SOL < 1.0" | bc -l) )); then
    echo "ERROR: Insufficient Devnet SOL balance ($BALANCE_SOL SOL). Need at least 1.0 SOL to deploy."
    exit 1
fi

echo "Balance is sufficient ($BALANCE_SOL SOL). Proceeding..."

# 2. Create tSKR Token Mint (9 decimals)
echo "--- Creating tSKR Mint ---"
TSKR_OUTPUT=$(spl-token create-token --decimals 9 --url "$DEVNET_URL" --fee-payer "$KEYPAIR")
echo "$TSKR_OUTPUT"
TSKR_MINT=$(echo "$TSKR_OUTPUT" | grep -oE "Creating token [A-Za-z0-9]+" | awk '{print $3}')
echo "Created tSKR Mint: $TSKR_MINT"

echo "Creating deployer tSKR account..."
spl-token create-account "$TSKR_MINT" --url "$DEVNET_URL" --fee-payer "$KEYPAIR"
echo "Minting 1,000,000 tSKR supply..."
spl-token mint "$TSKR_MINT" 1000000 --url "$DEVNET_URL" --fee-payer "$KEYPAIR"

# 3. Create tORE Token Mint (11 decimals)
echo "--- Creating tORE Mint ---"
TORE_OUTPUT=$(spl-token create-token --decimals 11 --url "$DEVNET_URL" --fee-payer "$KEYPAIR")
echo "$TORE_OUTPUT"
TORE_MINT=$(echo "$TORE_OUTPUT" | grep -oE "Creating token [A-Za-z0-9]+" | awk '{print $3}')
echo "Created tORE Mint: $TORE_MINT"

echo "Creating deployer tORE account..."
spl-token create-account "$TORE_MINT" --url "$DEVNET_URL" --fee-payer "$KEYPAIR"
echo "Minting 10,000 tORE supply..."
spl-token mint "$TORE_MINT" 10000 --url "$DEVNET_URL" --fee-payer "$KEYPAIR"

# 4. Deploy Smart Contract
PROGRAM_ID=$(solana-keygen pubkey "$PROGRAM_KEYPAIR")
echo "--- Deploying Arkana ORE Vault ($PROGRAM_ID) ---"
solana program deploy "$PROGRAM_SO" \
    --program-id "$PROGRAM_KEYPAIR" \
    --keypair "$KEYPAIR" \
    --url "$DEVNET_URL"

echo "Smart Contract deployed successfully!"

# 5. Initialize Vault Config on-chain
echo "--- Initializing Arkana ORE Vault Config on Devnet ---"
node /root/arkana/init_vault.js "$TORE_MINT"

# 6. Update networkConfig.ts
echo "--- Updating networkConfig.ts ---"
node -e "
const fs = require('fs');
let content = fs.readFileSync('$NETWORK_CONFIG', 'utf8');
content = content.replace(/skrMint: new PublicKey\('[^']+'\)/, \"skrMint: new PublicKey('$TSKR_MINT')\");
content = content.replace(/oreMint: new PublicKey\('[^']+'\)/, \"oreMint: new PublicKey('$TORE_MINT')\");
content = content.replace(/arkanaVaultProgramId: new PublicKey\('[^']+'\)/, \"arkanaVaultProgramId: new PublicKey('$PROGRAM_ID')\");
fs.writeFileSync('$NETWORK_CONFIG', content);
"

echo "Verifying TypeScript compilation..."
(cd /root/arkana/arkana-app && npx tsc --noEmit)

echo "=== Devnet Deployment Complete ==="
echo "tSKR Mint: $TSKR_MINT"
echo "tORE Mint: $TORE_MINT"
echo "Arkana Vault Program ID: $PROGRAM_ID"
