# Arkana app

Android app for Arkana, built with Expo, React Native and Solana Mobile Wallet Adapter. Made for the Seeker, runs on any Android 10+ phone.

## Screens

Expo Router, five tabs:

- `app/(tabs)/index.tsx`, **Today.** Daily Clock-In, streak, free spreads left, entry to spreads.
- `app/spread/[id].tsx`, **spreads.** Card layouts, 3D flips, the seven-part reading.
- `app/(tabs)/oracle.tsx`, **Ask.** Chat with Arkana. When the free quota is used up, a question costs 1 SKR.
- `app/(tabs)/codex.tsx`, **Deck.** All 78 cards with upright and reversed meanings, offline.
- `app/(tabs)/ore.tsx`, **ORE.** The user's daily tranches in the ORE Vault, staked ORE, yield and days left until each tranche matures.
- `app/(tabs)/wallet.tsx`, **Me.** Wallet, SKR / SOL / ORE balances, offerings, the Seeker Oracle Pass, language.

On first launch the user picks one of 10 languages. English is the default.

## Payments

`services/treasuryService.ts` builds every payment. The result is always 33% SKR burned, 33% SKR to the treasury and 34% swapped to ORE into the user's daily tranche.

- With enough SKR: the split is paid from SKR, and the 34% share is swapped SKR to ORE through Jupiter.
- Otherwise SOL is swapped to exactly 66% of the price in SKR (burn and treasury) and SOL worth 34% of the price goes to ORE.
- The tranche deposit uses the swap's guaranteed minimum output, so slippage can never make the transaction fail or take ORE the user already had.
- The payment is sent as one transaction. The Arkana lookup table keeps it under Solana's 1232-byte limit. If a route is too large anyway, it is split in two and the user still approves once.

Before any payment the app checks the treasury address against the founder's offline Ed25519 signature (`verifyTreasuryAttestation`).

`services/oreVaultService.ts` builds the ORE Vault instructions: deposit, claim yield, harvest and the `SyncStake` crank.

## Development

```bash
npm install
npx expo start          # dev server
npx expo run:android    # build and run on a connected phone
npx tsc --noEmit        # type check
```

Wallet features need a real Android phone with Phantom, Solflare or Seed Vault. The network (mainnet or devnet) is set in `constants/networkConfig.ts`.

## Offline

If the server is unreachable, `services/oracleApi.ts` switches to the on-device engine. Cards, combinations and readings keep working without the network.

## Versions

`release.json` holds major.minor. CI adds the patch number and the build number, see the root README.
