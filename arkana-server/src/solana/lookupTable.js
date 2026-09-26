/**
 * Arkana Address Lookup Table keeper.
 *
 * A Solana transaction is limited to 1232 bytes. A payment carries two Jupiter swaps,
 * the vault deposit and the ORE Stake accounts, which only fits when most accounts are
 * referenced through a lookup table (1 byte instead of 32).
 *
 * This keeper owns one lookup table and keeps it filled with:
 * - fixed Arkana / ORE Stake / mint accounts
 * - pool accounts Jupiter currently routes Arkana payments through (refreshed periodically)
 *
 * The authority keypair only pays rent for the table and can extend or close it.
 * It never touches user funds.
 */
const fs = require("fs");
const os = require("os");
const path = require("path");
const {
  AddressLookupTableProgram,
  ComputeBudgetProgram,
  Connection,
  Keypair,
  PublicKey,
  SystemProgram,
  TransactionMessage,
  VersionedTransaction,
} = require("@solana/web3.js");
const { getAssociatedTokenAddressSync } = require("@solana/spl-token");

const RPC_URL = process.env.SOLANA_RPC_URL || "https://solana-rpc.publicnode.com";
/** Second RPC for status checks: public RPC load balancers often lag on signature statuses. */
const STATUS_RPC_URL = process.env.SOLANA_STATUS_RPC_URL || "https://api.mainnet-beta.solana.com";
const JUPITER_API = "https://api.jup.ag/swap/v1";
const STATE_FILE = path.join(__dirname, "..", "..", "data", "lookup_table.json");
const KEYPAIR_PATH = process.env.ARKANA_ALT_KEYPAIR || path.join(os.homedir(), ".config", "solana", "id.json");
const REFRESH_INTERVAL_MS = 30 * 60 * 1000;
const MAX_TABLE_SIZE = 256;
const EXTEND_BATCH = 20;

const WSOL_MINT = new PublicKey("So11111111111111111111111111111111111111112");
const SKR_MINT = new PublicKey("SKRbvo6Gf7GondiT3BbTfuRDPqLWei4j2Qy2NPGZhW3");
const ORE_MINT = new PublicKey("oreoU2P8bN6jkk3jbaiVxYnG1dCXcYxwhwyK9jSybcp");
const ARKANA_VAULT_PROGRAM = new PublicKey("B49g3obWUCPQzP9kdcRiCPJDurufWhJhszpQsK5eeV8C");
const ORE_STAKE_PROGRAM = new PublicKey("stakecNP3FpiExZPCgZfqRgumVzi6dNqnfrjwXyTgeH");
const ARKANA_TREASURY = new PublicKey("4v3d1itZVjLtDQEqGLFLtfr1riffAEcqnNtumEumJgny");
const SOL_PER_SKR_FALLBACK = 0.0002;

/** Prices users actually pay (SKR): asks, spreads, offerings, subscription. */
const PAYMENT_AMOUNTS_SKR = [1, 5, 15, 50, 333];

const pda = (seeds, program) => PublicKey.findProgramAddressSync(seeds, program)[0];
const ata = (mint, owner) => getAssociatedTokenAddressSync(mint, owner, true);

function fixedAccounts() {
  const vaultAuthority = pda([Buffer.from("arkana_vault_auth")], ARKANA_VAULT_PROGRAM);
  const stake = pda([Buffer.from("stake"), vaultAuthority.toBuffer()], ORE_STAKE_PROGRAM);
  const stakeTreasury = pda([Buffer.from("treasury")], ORE_STAKE_PROGRAM);
  return [
    pda([Buffer.from("arkana_config")], ARKANA_VAULT_PROGRAM),
    vaultAuthority,
    ata(ORE_MINT, vaultAuthority),
    stake,
    ata(ORE_MINT, stake),
    stakeTreasury,
    ata(ORE_MINT, stakeTreasury),
    pda([Buffer.from("vesting")], ORE_STAKE_PROGRAM),
    ORE_STAKE_PROGRAM,
    ORE_MINT,
    SKR_MINT,
    WSOL_MINT,
    ARKANA_TREASURY,
    ata(SKR_MINT, ARKANA_TREASURY),
    ata(ORE_MINT, ARKANA_TREASURY),
    SystemProgram.programId,
    new PublicKey("TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA"),
    new PublicKey("ATokenGPvbdGVxr1b2hvZbsiqW5xWH25efTNsLJA8knL"),
  ];
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function jupiterGet(url) {
  for (let attempt = 0; attempt < 3; attempt++) {
    const res = await fetch(url);
    if (res.ok) return res.json();
    if (res.status !== 429) throw new Error(`Jupiter ${res.status} for ${url}`);
    await sleep(3000 * (attempt + 1));
  }
  throw new Error(`Jupiter rate limited: ${url}`);
}

/** Accounts of one Jupiter swap for a given user, as the app requests it. */
async function swapAccounts({ inputMint, outputMint, amount, swapMode, user }) {
  const isSolLeg = inputMint.equals(WSOL_MINT) || outputMint.equals(WSOL_MINT);
  const extra = isSolLeg ? "&onlyDirectRoutes=true" : "&maxAccounts=24";
  const quote = await jupiterGet(
    `${JUPITER_API}/quote?inputMint=${inputMint.toBase58()}&outputMint=${outputMint.toBase58()}&amount=${amount}&swapMode=${swapMode}&slippageBps=300${extra}`
  );
  let res;
  for (let attempt = 0; attempt < 4; attempt++) {
    await sleep(1500);
    res = await fetch(`${JUPITER_API}/swap-instructions`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        quoteResponse: quote,
        userPublicKey: user.toBase58(),
        wrapAndUnwrapSol: true,
        useSharedAccounts: true,
      }),
    });
    if (res.status !== 429) break;
    await sleep(4000 * (attempt + 1));
  }
  if (!res.ok) throw new Error(`Jupiter swap-instructions ${res.status}`);
  const data = await res.json();
  const ixs = [...(data.setupInstructions || []), data.swapInstruction, data.cleanupInstruction].filter(Boolean);
  const keys = new Set();
  for (const ix of ixs) for (const acc of ix.accounts) keys.add(acc.pubkey);
  return { keys, jupiterTables: data.addressLookupTableAddresses || [] };
}

/**
 * Pool accounts used by Arkana payment routes. Two throwaway users are compared so that
 * user-specific accounts (wallet, token accounts) are never put into the shared table.
 */
async function currentRouteAccounts(connection) {
  const users = [Keypair.generate().publicKey, Keypair.generate().publicKey];
  const collected = new Set();
  const jupiterTableKeys = new Set();

  for (const amountSkr of PAYMENT_AMOUNTS_SKR) {
    const totalRaw = BigInt(Math.round(amountSkr * 1_000_000));
    const skrShare = (totalRaw * 66n) / 100n;
    const oreShare = totalRaw - skrShare;
    let priceLamports = BigInt(Math.round(amountSkr * SOL_PER_SKR_FALLBACK * 1e9));
    try {
      const priceQuote = await jupiterGet(
        `${JUPITER_API}/quote?inputMint=${WSOL_MINT.toBase58()}&outputMint=${SKR_MINT.toBase58()}&amount=${totalRaw}&swapMode=ExactOut&slippageBps=100&onlyDirectRoutes=true`
      );
      priceLamports = BigInt(priceQuote.inAmount);
    } catch {}
    const oreShareLamports = (priceLamports * oreShare) / totalRaw;
    const legs = [
      { inputMint: WSOL_MINT, outputMint: SKR_MINT, amount: skrShare, swapMode: "ExactOut" },
      { inputMint: WSOL_MINT, outputMint: ORE_MINT, amount: oreShareLamports, swapMode: "ExactIn" },
      { inputMint: SKR_MINT, outputMint: ORE_MINT, amount: oreShare, swapMode: "ExactIn" },
    ];
    for (const leg of legs) {
      try {
        const first = await swapAccounts({ ...leg, user: users[0] });
        await sleep(2500);
        const second = await swapAccounts({ ...leg, user: users[1] });
        await sleep(2500);
        for (const k of first.keys) if (second.keys.has(k)) collected.add(k);
        for (const t of first.jupiterTables) jupiterTableKeys.add(t);
      } catch (err) {
        console.warn(`[lookup-table] route scan failed (${amountSkr} SKR ${leg.inputMint.toBase58().slice(0, 4)}->${leg.outputMint.toBase58().slice(0, 4)}):`, err.message);
      }
    }
  }

  // Skip accounts Jupiter already serves through its own lookup tables
  for (const address of jupiterTableKeys) {
    try {
      const table = (await connection.getAddressLookupTable(new PublicKey(address))).value;
      if (table) for (const k of table.state.addresses) collected.delete(k.toBase58());
    } catch {}
  }
  return [...collected].map((k) => new PublicKey(k));
}

function loadKeypair() {
  const secret = JSON.parse(fs.readFileSync(KEYPAIR_PATH, "utf8"));
  return Keypair.fromSecretKey(Uint8Array.from(secret));
}

function loadState() {
  try {
    return JSON.parse(fs.readFileSync(STATE_FILE, "utf8"));
  } catch {
    return {};
  }
}

function saveState(state) {
  fs.writeFileSync(STATE_FILE, JSON.stringify(state, null, 2));
}

async function sendInstructions(connection, authority, instructions) {
  const { blockhash, lastValidBlockHeight } = await connection.getLatestBlockhash("confirmed");
  const message = new TransactionMessage({
    payerKey: authority.publicKey,
    recentBlockhash: blockhash,
    instructions: [
      ComputeBudgetProgram.setComputeUnitLimit({ units: 50_000 }),
      ComputeBudgetProgram.setComputeUnitPrice({ microLamports: 200_000 }),
      ...instructions,
    ],
  }).compileToV0Message();
  const tx = new VersionedTransaction(message);
  tx.sign([authority]);
  const raw = tx.serialize();

  // Public RPCs drop transactions under load: rebroadcast until confirmed or expired
  const statusConnections = [connection, new Connection(STATUS_RPC_URL, "confirmed")];
  const landed = async () => {
    for (const c of statusConnections) {
      try {
        const status = (await c.getSignatureStatuses([signature], { searchTransactionHistory: true })).value[0];
        if (status?.err) throw new Error(`transaction ${signature} failed: ${JSON.stringify(status.err)}`);
        if (status && status.confirmationStatus !== "processed") return true;
      } catch (err) {
        if (String(err.message).includes("failed:")) throw err;
      }
    }
    return false;
  };

  const signature = await connection.sendRawTransaction(raw, { skipPreflight: false, maxRetries: 0 });
  while ((await connection.getBlockHeight("confirmed")) <= lastValidBlockHeight) {
    if (await landed()) return signature;
    await connection.sendRawTransaction(raw, { skipPreflight: true, maxRetries: 0 }).catch(() => {});
    await sleep(2000);
  }
  await sleep(5000);
  if (await landed()) return signature;
  throw new Error(`transaction ${signature} expired`);
}

async function ensureTable(connection, authority) {
  const state = loadState();
  if (state.address) return new PublicKey(state.address);

  const slot = await connection.getSlot("finalized");
  const [createIx, address] = AddressLookupTableProgram.createLookupTable({
    authority: authority.publicKey,
    payer: authority.publicKey,
    recentSlot: slot,
  });
  const signature = await sendInstructions(connection, authority, [createIx]);
  saveState({ address: address.toBase58(), createdAt: new Date().toISOString(), createSignature: signature });
  console.log(`[lookup-table] created ${address.toBase58()} (${signature})`);
  return address;
}

async function extendTable(connection, authority, address, candidates) {
  const table = (await connection.getAddressLookupTable(address)).value;
  if (!table) throw new Error(`lookup table ${address.toBase58()} not found`);

  const present = new Set(table.state.addresses.map((k) => k.toBase58()));
  const seen = new Set();
  const missing = candidates.filter((k) => {
    const s = k.toBase58();
    if (present.has(s) || seen.has(s)) return false;
    seen.add(s);
    return true;
  });
  const room = MAX_TABLE_SIZE - table.state.addresses.length;
  if (missing.length > room) {
    console.warn(`[lookup-table] table is almost full: ${missing.length} new accounts, room for ${room}`);
  }

  const toAdd = missing.slice(0, Math.max(0, room));
  for (let i = 0; i < toAdd.length; i += EXTEND_BATCH) {
    const batch = toAdd.slice(i, i + EXTEND_BATCH);
    const ix = AddressLookupTableProgram.extendLookupTable({
      lookupTable: address,
      authority: authority.publicKey,
      payer: authority.publicKey,
      addresses: batch,
    });
    const signature = await sendInstructions(connection, authority, [ix]);
    console.log(`[lookup-table] +${batch.length} accounts (${signature})`);
  }
  return { added: toAdd.length, total: table.state.addresses.length + toAdd.length };
}

let refreshing = false;

async function refreshLookupTable() {
  if (refreshing) return null;
  refreshing = true;
  try {
    const connection = new Connection(RPC_URL, "confirmed");
    const authority = loadKeypair();
    const address = await ensureTable(connection, authority);
    const routeAccounts = await currentRouteAccounts(connection);
    const result = await extendTable(connection, authority, address, [...fixedAccounts(), ...routeAccounts]);
    console.log(`[lookup-table] ${address.toBase58()}: ${result.total} accounts (+${result.added})`);
    return { address: address.toBase58(), ...result };
  } catch (err) {
    console.error("[lookup-table] refresh failed:", err.message);
    return null;
  } finally {
    refreshing = false;
  }
}

function getLookupTableAddress() {
  return loadState().address || null;
}

function startLookupTableKeeper() {
  if (process.env.ARKANA_ALT_KEEPER === "off") return;
  if (!fs.existsSync(KEYPAIR_PATH)) {
    console.warn(`[lookup-table] keeper disabled: no authority keypair at ${KEYPAIR_PATH}`);
    return;
  }
  setTimeout(refreshLookupTable, 10_000);
  setInterval(refreshLookupTable, REFRESH_INTERVAL_MS);
}

module.exports = { refreshLookupTable, getLookupTableAddress, startLookupTableKeeper };

if (require.main === module) {
  refreshLookupTable().then((r) => {
    console.log(JSON.stringify(r));
    process.exit(r ? 0 : 1);
  });
}
