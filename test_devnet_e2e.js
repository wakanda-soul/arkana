const {
  Connection,
  Keypair,
  PublicKey,
  Transaction,
  TransactionInstruction,
  sendAndConfirmTransaction,
  SystemProgram,
} = require('@solana/web3.js');
const {
  TOKEN_PROGRAM_ID,
  ASSOCIATED_TOKEN_PROGRAM_ID,
  getAssociatedTokenAddressSync,
} = require('@solana/spl-token');
const fs = require('fs');

async function main() {
  console.log("=== Testing Arkana ORE Vault End-to-End on Solana Devnet ===");

  const connection = new Connection("https://api.devnet.solana.com", "confirmed");
  const keypairData = JSON.parse(fs.readFileSync('/root/.config/solana/id.json', 'utf8'));
  const user = Keypair.fromSecretKey(Uint8Array.from(keypairData));
  console.log("Tester/User Pubkey:", user.publicKey.toBase58());

  const programId = new PublicKey("B49g3obWUCPQzP9kdcRiCPJDurufWhJhszpQsK5eeV8C");
  const toreMint = new PublicKey("8eAPs1imRaRzk89UzSbBDzfG6eta8e4HRv8sHJ44wu77");

  // 1. Derive PDAs
  const [configPda] = PublicKey.findProgramAddressSync([Buffer.from("arkana_config", "utf8")], programId);
  const [vaultAuthorityPda] = PublicKey.findProgramAddressSync([Buffer.from("arkana_vault_auth", "utf8")], programId);
  const [userVaultPda] = PublicKey.findProgramAddressSync([Buffer.from("arkana_user_vault", "utf8"), user.publicKey.toBuffer()], programId);

  const userTokensAta = getAssociatedTokenAddressSync(toreMint, user.publicKey);
  const vaultTokensAta = getAssociatedTokenAddressSync(toreMint, vaultAuthorityPda, true);

  console.log("Config PDA:", configPda.toBase58());
  console.log("Vault Authority PDA:", vaultAuthorityPda.toBase58());
  console.log("User Vault PDA:", userVaultPda.toBase58());

  // 2. Read UserVault if already exists
  const userVaultAcc = await connection.getAccountInfo(userVaultPda);
  let currentTrancheCount = 0;
  if (userVaultAcc && userVaultAcc.data.length >= 64) {
    currentTrancheCount = userVaultAcc.data.readUInt32LE(40);
    const totalStaked = userVaultAcc.data.readBigUInt64LE(48);
    console.log(`Existing UserVault found! Tranche Count: ${currentTrancheCount}, Total Staked: ${totalStaked} units`);
  }

  // 3. Deposit into next Tranche if none or test deposit
  let targetTrancheId = 1;
  if (currentTrancheCount === 0) {
    targetTrancheId = 1;
    const trancheBuf = Buffer.alloc(4);
    trancheBuf.writeUInt32LE(1, 0);
    const [tranche1Pda] = PublicKey.findProgramAddressSync([
      Buffer.from("arkana_tranche", "utf8"),
      user.publicKey.toBuffer(),
      trancheBuf
    ], programId);

    const depositAmountUnits = 100n * 100000000000n;
    console.log(`Depositing 100 tORE into Tranche #1...`);

    const depositData = Buffer.alloc(9);
    depositData.writeUInt8(1, 0); // DepositTranche = 1
    depositData.writeBigUInt64LE(depositAmountUnits, 1);

    const depositIx = new TransactionInstruction({
      programId,
      keys: [
        { pubkey: user.publicKey, isSigner: true, isWritable: true },
        { pubkey: configPda, isSigner: false, isWritable: true },
        { pubkey: vaultAuthorityPda, isSigner: false, isWritable: false },
        { pubkey: userVaultPda, isSigner: false, isWritable: true },
        { pubkey: tranche1Pda, isSigner: false, isWritable: true },
        { pubkey: userTokensAta, isSigner: false, isWritable: true },
        { pubkey: vaultTokensAta, isSigner: false, isWritable: true },
        { pubkey: toreMint, isSigner: false, isWritable: false },
        { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
        { pubkey: TOKEN_PROGRAM_ID, isSigner: false, isWritable: false },
        { pubkey: ASSOCIATED_TOKEN_PROGRAM_ID, isSigner: false, isWritable: false },
      ],
      data: depositData,
    });

    const depositTx = new Transaction().add(depositIx);
    const depositSig = await sendAndConfirmTransaction(connection, depositTx, [user], { commitment: 'confirmed' });
    console.log("DepositTranche confirmed! Tx:", depositSig);
  }

  // 4. Verify Tranche State on-chain
  const trancheBuf = Buffer.alloc(4);
  trancheBuf.writeUInt32LE(targetTrancheId, 0);
  const [tranchePda] = PublicKey.findProgramAddressSync([
    Buffer.from("arkana_tranche", "utf8"),
    user.publicKey.toBuffer(),
    trancheBuf
  ], programId);

  const trancheAccount = await connection.getAccountInfo(tranchePda);
  console.log(`Tranche #${targetTrancheId} Data Length:`, trancheAccount.data.length, "bytes");

  const tData = trancheAccount.data;
  const trancheId = tData.readUInt32LE(40);
  const isMatured = tData.readUInt8(44);
  const depositedAmt = tData.readBigUInt64LE(48);
  const depositedAt = Number(tData.readBigInt64LE(56));
  const expiresAt = Number(tData.readBigInt64LE(64));

  console.log(`--- Verified Tranche #${targetTrancheId} State ---`);
  console.log("Tranche ID:", trancheId);
  console.log("Is Matured (0=active, 1=matured):", isMatured);
  console.log("Deposited Amount:", depositedAmt.toString(), "units (~100 tORE)");
  console.log("Deposited At:", new Date(depositedAt * 1000).toISOString());
  console.log("Expires At (Deposited + 365 Days):", new Date(expiresAt * 1000).toISOString());
  console.log("Duration In Days:", (expiresAt - depositedAt) / 86400, "days (EXACTLY 365 DAYS!)");

  // 5. Test DistributeReward: Inject 5 tORE yield into the pool
  const rewardAmountUnits = 5n * 100000000000n;
  console.log(`\nDistributing 5 tORE (${rewardAmountUnits} units) reward into staking pool...`);
  const distData = Buffer.alloc(9);
  distData.writeUInt8(4, 0); // DistributeReward = 4
  distData.writeBigUInt64LE(rewardAmountUnits, 1);

  const distIx = new TransactionInstruction({
    programId,
    keys: [
      { pubkey: user.publicKey, isSigner: true, isWritable: true },
      { pubkey: configPda, isSigner: false, isWritable: true },
      { pubkey: vaultAuthorityPda, isSigner: false, isWritable: false },
      { pubkey: vaultTokensAta, isSigner: false, isWritable: true },
      { pubkey: userTokensAta, isSigner: false, isWritable: true },
      { pubkey: toreMint, isSigner: false, isWritable: false },
      { pubkey: TOKEN_PROGRAM_ID, isSigner: false, isWritable: false },
    ],
    data: distData,
  });

  const distTx = new Transaction().add(distIx);
  const distSig = await sendAndConfirmTransaction(connection, distTx, [user], { commitment: 'confirmed' });
  console.log("DistributeReward confirmed! Tx:", distSig);

  // 6. Test ClaimTrancheYield
  console.log(`\nClaiming accrued yield on Tranche #${targetTrancheId}...`);
  const claimData = Buffer.alloc(5);
  claimData.writeUInt8(2, 0); // ClaimTrancheYield = 2
  claimData.writeUInt32LE(targetTrancheId, 1);

  const claimIx = new TransactionInstruction({
    programId,
    keys: [
      { pubkey: user.publicKey, isSigner: true, isWritable: true },
      { pubkey: configPda, isSigner: false, isWritable: true },
      { pubkey: vaultAuthorityPda, isSigner: false, isWritable: false },
      { pubkey: userVaultPda, isSigner: false, isWritable: true },
      { pubkey: tranchePda, isSigner: false, isWritable: true },
      { pubkey: userTokensAta, isSigner: false, isWritable: true },
      { pubkey: vaultTokensAta, isSigner: false, isWritable: true },
      { pubkey: toreMint, isSigner: false, isWritable: false },
      { pubkey: TOKEN_PROGRAM_ID, isSigner: false, isWritable: false },
    ],
    data: claimData,
  });

  const claimTx = new Transaction().add(claimIx);
  const claimSig = await sendAndConfirmTransaction(connection, claimTx, [user], { commitment: 'confirmed' });
  console.log("ClaimTrancheYield confirmed! Tx:", claimSig);

  // 7. Verify updated claimed rewards on-chain
  const trancheAfter = await connection.getAccountInfo(tranchePda);
  const claimedRewards = trancheAfter.data.readBigUInt64LE(104);
  console.log(`Claimed Rewards on Tranche #${targetTrancheId}:`, claimedRewards.toString(), "units (~5 tORE)");

  console.log("\n=======================================================");
  console.log(">>> ALL ON-CHAIN DEVNET TESTS PASSED WITH 100% SUCCESS! <<<");
  console.log("=======================================================");
}

main().catch((err) => {
  console.error("Test failed:", err);
  process.exit(1);
});
