# 🔮 Arkana — The Blockchain Oracle
### Mobile-native crypto tarot & AI oracle for Solana Mobile & Seeker

> *"The Chain remembers every block. The cards remember every pattern."*

Arkana is an AI-powered blockchain oracle and cyber-tarot application built natively for **Solana Mobile** and the **Seeker** ecosystem. It merges a handcrafted 78-card blockchain deck, fair RNG draws, a 500+ card interaction engine, and an AI narrative synthesizer into a daily ritual for crypto natives, builders, and traders.

---

## ⚡ Key Features

### 🎴 Handcrafted 78-Card Blockchain Deck
* **22 Major Arcana:** Foundational crypto archetypes (*The Genesis Block*, *The Smart Contract Architect*, *The Validator*, *The Hard Fork*, *The Rug Pull*, *Liquidation*, *ATH*).
* **56 Minor Arcana:** Four elemental suits mapping to blockchain reality:
  * ⚡ **Nodes (Fire):** Building, execution, startups, dev energy.
  * 💧 **Liquidity (Water):** Sentiment, community, capital flow, trust.
  * ⚔️ **Protocols (Air):** Logic, smart contracts, security, exploits.
  * 🪙 **Assets (Earth):** Value, long-term holdings, staking, treasury.
* **500+ Curated Combinations:** Unique multi-card synergy engine resolving macro forces and elemental balance.

### 🧠 Seven-Beat Narrative Synthesis
Every reading delivers a structured story in the language of the chain:
1. **The Story (История):** Holistic synthesis of all drawn cards into one cohesive narrative.
2. **Hidden Forces (Скрытые силы):** Sub-surface mempool currents and reversed card dynamics.
3. **What Strengthens You (Что усиливает):** Supportive validator consensus and momentum.
4. **What Weakens You (Что ослабляет):** Protocol vulnerabilities, liquidity leaks, and shadows to manage.
5. **Oracle Advice (Совет Оракула):** Pragmatic, stoic blockchain guidance.
6. **Warning (Предостережение):** Hard-fork risk if navigating unhedged.
7. **Final Omen (Финальное знамение):** An immutable cryptographic aphorism.

### 📱 Built for Solana Mobile & Seeker
* **Mobile Wallet Adapter (MWA):** Native connection to Seeker hardware **Seed Vault**, Phantom, or Solflare.
* **Tactile Haptic Feedback:** Physical card shuffling and draw sensations via `expo-haptics`.
* **Fluid 3D Animations:** 60/120fps card flip and reveal physics powered by `react-native-reanimated`.
* **Daily Clock-In Ritual:** Daily 1-card draw (*The Daily Block*) with multi-day streak tracking and SKR reward rewards.
* **SKR Ecosystem Utility:** Micro-burn and staking perks for unlocking deep 5-card spreads (*The Validator Cross*, *The Crypto Compass*) and interactive Oracle AI chats.

---

## 📁 Repository Structure

```
├── arkana-app/              # Native Solana Mobile Application (React Native / Expo / MWA)
│   ├── app/                 # Expo Router screens (Altar, Spreads, Oracle AI, Codex, Seeker Wallet)
│   ├── android/             # Prebuilt native Android project with Gradle & MWA bindings
│   ├── assets/cards/        # 78 optimized WebP card artworks (00-77)
│   ├── components/tarot/    # 3D Reanimated Tarot Cards & SevenBeatsView components
│   └── services/            # Dual-mode Oracle API & offline fallback engine
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

# Run development server:
npx expo start

# Run on connected Android / Seeker device:
npx expo run:android
```

---

## 📜 License
MIT License. Built for the Solana Mobile & Seeker ecosystem.
