# 🔮 Arkana — The Blockchain Oracle
### Built for *Clock In — A Solana Mobile Hackathon* (Radiants & Solana Mobile)

> **"The Chain remembers every block. The cards remember every pattern."**

Arkana is an AI-powered blockchain oracle and cyber-tarot application designed natively for **Solana Mobile** and the **Seeker** ecosystem. It merges handcrafted cryptographic archetypes, fair on-chain-grade RNG draws, a 500+ card interaction engine, and an AI narrative synthesizer into a daily ritual for crypto natives.

---

## 🌟 Core Pillars & Hackathon Alignment

1. **AI Oracle Agent (20% Scoring Weight):**
   - Deep 78-card blockchain oracle deck (22 Major Arcana + 56 Minor Arcana across Protocols, Liquidity, Nodes, and Assets).
   - 500+ curated archetype combinations and elemental balancing algorithms.
   - Structured **7-beat narrative generation**:
     1. *The Story (История)* — holistic synthesis of the spread.
     2. *Hidden Forces (Скрытые силы)* — undercurrents and mempool friction.
     3. *What Strengthens You (Что усиливает)* — validator consensus behind you.
     4. *What Weakens You (Что ослабляет)* — attack vectors and liquidity leaks.
     5. *Oracle Advice (Совет Оракула)* — stoic, pragmatic blockchain wisdom.
     6. *Warning (Предостережение)* — hard-fork risk if unhedged.
     7. *Final Omen (Финальное знамение)* — an immutable closing truth.

2. **SKR Token & Daily Clock-In (20% Scoring Weight):**
   - **Daily Clock-In Ritual:** Seeker users clock in every 24 hours to draw their *Daily Block* omen and earn SKR rewards.
   - **Streak Tracking:** Multi-day engagement multiplier rewarding consistent builders and traders.
   - **SKR Utility:** Micro-burn / payment of SKR for advanced 5-card spreads (*Validator Cross*, *Crypto Compass*) and deep AI clarification queries.

3. **Mobile-First UX/UI (30% Scoring Weight):**
   - Built on React Native & Expo with native Android compilation.
   - Powered by `@wallet-ui/react-native-web3js` and official **Solana Mobile Wallet Adapter (MWA)**.
   - Haptic feedback on Android devices (`expo-haptics`) simulating physical card shuffles and draws.
   - 60/120fps fluid card flip animations via `react-native-reanimated`.

4. **Innovation & Community Engagement (30% Scoring Weight):**
   - Bridges the rich subculture of crypto horoscopes and sentiment analysis with actual Solana network mechanics.

---

## 📁 Repository Structure

```
├── arkana-app/              # Native Solana Mobile Application (React Native / Expo / MWA)
│   ├── app/                 # Expo Router screens (Altar, Spreads, Chat, Codex, Wallet)
│   ├── android/             # Prebuilt native Android project with Gradle & MWA bindings
│   ├── assets/cards/        # 78 optimized WebP card artworks (00-77)
│   └── components/          # Reanimated card components, wallet adapters, haptic buttons
│
├── arkana-server/           # AI Oracle Engine & Backend API
│   ├── src/
│   │   ├── engine/          # 78 card passports, fair RNG draw core, combinations engine
│   │   ├── ai/              # 7-beat narrative synthesizer & LLM prompt handler
│   │   └── solana/          # SKR token tracker & Daily Clock-In persistence
│   └── public/cards/        # Card assets served via static CDN
│
└── README.md                # Project documentation
```

---

## 🚀 Quick Start

### 1. Backend Server
```bash
cd arkana-server
npm install
npm start
# Server listens on http://localhost:3001
```

### 2. Mobile Application
```bash
cd arkana-app
npm install
# Start development server:
npx expo start
# Or build Android APK locally:
npm run android:build
```

---

## 📜 License
MIT License. Built with passion for Solana Mobile & Seeker.
