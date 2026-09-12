# Arkana Mobile Client

Native Android application for Arkana, built with React Native, Expo, and the Solana Mobile Wallet Adapter (MWA). Designed for the Solana Seeker phone and standard Android devices running Android 10+.

---

## App Screens & Structure

The client runs on Expo Router with tab navigation:

- `app/(tabs)/index.tsx`: The Altar. Features the Daily Block Clock-In, current streak counter, daily free spread allowance, and shortcuts to full spread layouts.
- `app/spread/[id].tsx`: Interactive spread altar. Lays out cards in authentic Tarot Cross and Compass geometries, manages 3D card flips, checks SKR quota, and displays the 7-beat reading.
- `app/(tabs)/oracle.tsx`: Live conversational terminal with Arkana Oracle, proxied through a low-latency Gemini Flash backend.
- `app/(tabs)/codex.tsx`: Complete index of all 78 Arcana cards. Tap any card to open the inspection modal with upright and reversed interpretations.
- `app/(tabs)/wallet.tsx`: Seeker identity hub. Connects to Phantom, Solflare, or Seed Vault, tracks SKR balances, and manages on-chain sessions.

---

## Key Dependencies

- `@solana-mobile/mobile-wallet-adapter-protocol`: Native MWA authorization and transaction signing on Android.
- `react-native-reanimated`: 60/120fps card flip physics and spring animations.
- `expo-haptics`: Tactile feedback for shuffling, reveals, and check-in confirmation.
- `react-native-safe-area-context`: Dynamic padding for Android 3-button and gesture navigation bars.

---

## Development Setup

### 1. Install Dependencies

```bash
npm install
```

### 2. Start Expo Dev Server

```bash
npx expo start
```

### 3. Run on Device

To test MWA and Seed Vault, connect a physical Android device or Seeker developer phone with USB debugging enabled:

```bash
npx expo run:android
```

### 4. TypeScript Validation

Verify types across the app:

```bash
npx tsc --noEmit
```

---

## Offline Support

If the backend server is unreachable, `services/oracleApi.ts` automatically switches to the client-side deterministic engine. All 78 card passports and combination rules run offline without crashing or stalling the user experience.
