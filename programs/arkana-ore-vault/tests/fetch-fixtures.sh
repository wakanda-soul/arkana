#!/usr/bin/env bash
# Snapshots of mainnet state the vault test runs against: the real ORE Stake program,
# the ORE mint, ORE Stake treasury/vesting, and the Arkana vault config and token account.
set -euo pipefail
DIR="$(cd "$(dirname "$0")" && pwd)/fixtures"
mkdir -p "$DIR"
cd "$DIR"
command -v solana >/dev/null || { echo "error: solana CLI not found in PATH" >&2; exit 1; }
RPC="${SOLANA_RPC_URL:-https://api.mainnet-beta.solana.com}"
solana program dump stakecNP3FpiExZPCgZfqRgumVzi6dNqnfrjwXyTgeH ore_stake.so -u "$RPC"
for a in \
  oreoU2P8bN6jkk3jbaiVxYnG1dCXcYxwhwyK9jSybcp \
  F3ajpARUkbMnYsrbAmgnsjyp991DVbGYRzfaVXy1Dfvu \
  BHnZihpszx6e9rmN2ZQkABBUhwQ1AFYUUpjY6yrVzz3h \
  8dPF5obsJxPsZeecAFqJbSWPEw9FkR1XGyRSJbry8B21 \
  62gWMANZwExNiwaji3CLsfcBPTdqqhhLWv4z7B4Ny8sn \
  5P6jLrvDCg13JteMkVoDu1zPFq4sMjiQrL3GjZ23guRP \
  HMrbKWFfoeEcAh52je5WqzctmGGMQYoPki7WPrKLWHJ3 \
  2QPeGNvkQsianv7XJc2CESJS9gF8jKYB3KSLDHLT76m8; do
  solana account "$a" -u "$RPC" --output json-compact -o "acc_$a.json" >/dev/null
done
echo "fixtures ready"
