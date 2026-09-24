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
  const toreMintStr = process.argv[2];
  if (!toreMintStr) {
    console.error("Usage: node init_vault.js <tORE_MINT_PUBKEY>");
    process.exit(1);
  }

  const toreMint = new PublicKey(toreMintStr);
  const keypairData = JSON.parse(fs.readFileSync('/root/.config/solana/id.json', 'utf8'));
  const payer = Keypair.fromSecretKey(Uint8Array.from(keypairData));

  const programKeypairData = JSON.parse(
    fs.readFileSync('/root/arkana/programs/arkana-ore-vault/target/deploy/arkana_ore_vault-keypair.json', 'utf8')
  );
  const programId = Keypair.fromSecretKey(Uint8Array.from(programKeypairData)).publicKey;

  console.log(`Initializing Arkana ORE Vault: ${programId.toBase58()} with tORE Mint: ${toreMint.toBase58()}`);

  const connection = new Connection("https://api.devnet.solana.com", "confirmed");

  // Derive PDAs
  const [configPda] = PublicKey.findProgramAddressSync(
    [Buffer.from("arkana_config", "utf8")],
    programId
  );
  const [vaultAuthorityPda] = PublicKey.findProgramAddressSync(
    [Buffer.from("arkana_vault_auth", "utf8")],
    programId
  );
  const vaultTokensAta = getAssociatedTokenAddressSync(
    toreMint,
    vaultAuthorityPda,
    true
  );

  console.log(`Config PDA: ${configPda.toBase58()}`);
  console.log(`Vault Authority PDA: ${vaultAuthorityPda.toBase58()}`);
  console.log(`Vault Tokens ATA: ${vaultTokensAta.toBase58()}`);

  // Check if config already initialized
  const configInfo = await connection.getAccountInfo(configPda);
  if (configInfo && configInfo.data.length > 0) {
    console.log("Vault Config already initialized on-chain!");
    return;
  }

  // Instruction: Initialize = 0
  const ix = new TransactionInstruction({
    programId,
    keys: [
      { pubkey: payer.publicKey, isSigner: true, isWritable: true },
      { pubkey: configPda, isSigner: false, isWritable: true },
      { pubkey: vaultAuthorityPda, isSigner: false, isWritable: true },
      { pubkey: vaultTokensAta, isSigner: false, isWritable: true },
      { pubkey: toreMint, isSigner: false, isWritable: false },
      { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
      { pubkey: TOKEN_PROGRAM_ID, isSigner: false, isWritable: false },
      { pubkey: ASSOCIATED_TOKEN_PROGRAM_ID, isSigner: false, isWritable: false },
    ],
    data: Buffer.from([0]), // Instruction discriminator 0 = Initialize
  });

  const tx = new Transaction().add(ix);
  const sig = await sendAndConfirmTransaction(connection, tx, [payer], {
    commitment: 'confirmed',
  });

  console.log(`Vault initialized successfully! Tx Signature: ${sig}`);
}

main().catch((err) => {
  console.error("Initialization failed:", err);
  process.exit(1);
});
