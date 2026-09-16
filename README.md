# Arkana: The Solana Oracle

Crypto tarot and daily block consensus built for Solana Mobile and the Seeker ecosystem.

Arkana turns blockchain mechanics into a 78-card symbolic oracle. It connects to your hardware Seed Vault via Mobile Wallet Adapter (MWA), lets you cast spreads with fair local RNG, and synthesizes 7-beat narrative readings through a fast on-chain oracle engine.

[⚡ Download Android APK](http://184.174.39.62/arkana.apk) · [🎨 Design Kit (78 cards, 22 MB)](http://184.174.39.62/arkana-designs.zip) · [Releases](https://github.com/wakanda-soul/arkana/releases)

---

## What Arkana Does

Most tarot apps run generic fortune-cookie scripts in a webview. Arkana runs a native Kotlin and React Native engine with physical card physics, haptics, and a structured deck modeled on decentralized networks.

- 78-card blockchain deck: 22 Major Arcana (Genesis Block, Validator, Hard Fork, Liquidation, ATH) and 56 Minor Arcana across four suits: Nodes (execution), Liquidity (capital), Protocols (security), and Assets (value).
- 500+ card synergies: an interpretation engine checks card pairs, dominant suits, and arcana density before running narrative synthesis.
- Seven-beat readings: readings break down into seven concrete angles: The Story, Hidden Forces, What Strengthens You, What Weakens You, Oracle Advice, Warning, and Final Omen.
- Hardware wallet security: native MWA integration signs transactions directly inside Solana Mobile Seed Vault without exposing private keys.
- Daily Clock-In: draw one card each morning to test your market mindset, extend your streak, and refill your daily allowance.

---

## In-App Economy & SKR Tokenomics

Arkana incorporates the native Solana Mobile asset ($SKR) with a **strict 50/50 deflationary burn model**:

| Action | Cost | Quota / Benefit | Tokenomics Mechanism |
| :--- | :--- | :--- | :--- |
| **Daily Clock-In** | Free (0 SKR emission) | Refills daily free allowance | Streak building & daily consensus |
| **Free Spreads** | Free | 3/day (Seeker SBT) / 0/day (standard) | Built-in daily allowance |
| **Extra Spread** | 5 SKR | 1 additional oracle consultation | 50% to Treasury, **50% burned on-chain** |
| **Altar Offering (Tips)** | 5 / 15 / 50 SKR | Oracle devotion & custom blessing | 50% to Treasury, **50% burned on-chain** |
| **Seeker Oracle Pass** | 333 SKR / mo | **+5 spreads daily** (8/day for Seeker SBT) | 50% to Treasury, **50% burned on-chain** |
| **Codex & Card Inspection** | Free | Offline access to all 78 arcana | Always available locally |

### 50/50 Deflationary Burn
All SKR payments are atomic SPL token transactions:
- **50% SPL Transfer** to the Arkana Treasury.
- **50% SPL Token Burn** (`createBurnInstruction`) permanently destroyed from the circulating supply.

### Jupiter DEX Seamless Routing
Users who hold only SOL can interact with any paid tier seamlessly: the app queries the Jupiter DEX `ExactOut` routing API and swaps SOL to SKR at the live market rate directly within the transaction.

### Founder Master Key Treasury Attestation
To guarantee treasury integrity against server compromise or configuration tampering:
- The Arkana Treasury address is cryptographically attested with an Ed25519 signature generated offline by the Founder Master Keypair.
- Client and server verify this attestation (`verifyTreasuryAttestation`) before initiating any transactions. Tampered addresses are strictly rejected.

### B2B Ecosystem Decks (Roadmap)
Arkana is architected to support sponsored partner archetypes and custom decks for Solana ecosystem protocols (e.g. Pyth, Drift, Jito, Raydium) as an additional B2B monetization and co-marketing channel.

---

## Architecture

Arkana ships as two decoupled pieces:

```
├── arkana-app/              # Native Android/Expo app with Solana MWA
│   ├── app/                 # Expo Router tabs (Altar, Spreads, Oracle AI, Codex, Wallet)
│   ├── android/             # Standalone Gradle build with Hermes bytecode
│   ├── assets/cards/        # 78 WebP card illustrations (00 to 77)
│   ├── components/tarot/    # 3D card flips, Tarot Cross / Compass geometry, Zoom modal
│   └── services/            # Dual-mode API client with instant offline fallback
│
└── arkana-server/           # Node.js backend & AI proxy
    ├── src/engine/          # 78 card definitions, RNG shuffler, combination solver
    ├── src/ai/              # Gemini 3.8 Flash low-latency persona proxy
    ├── src/solana/          # SKR balance tracking and streak storage
    └── public/              # Static CDN for card assets and APK distribution
```

---

## Quick Start

### Running the Server

Requires Node.js 18+.

```bash
cd arkana-server
npm install
npm start
# Server listens on port 3001 (and port 80 for APK direct downloads)
```

### Running the Mobile App

Requires Node.js, Expo CLI, and an Android device or emulator with Solana Mobile Wallet Adapter.

```bash
cd arkana-app
npm install

# Start development server
npx expo start

# Run native Android build directly on a connected device
npx expo run:android
```

### Building the Standalone APK

The release workflow is automated via GitHub Actions:

1. Push commits to `main`.
2. The workflow builds release Hermes bytecode and signs an installable APK.
3. The server at `http://184.174.39.62/download` serves the latest binary for one-tap install on Seeker phones.

---

## License

MIT License. Authored by wakanda. Built for the Solana Mobile Hackathon 2026.
