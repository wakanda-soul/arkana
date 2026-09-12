# Arkana Backend Server

Node.js service powering the Arkana deck engine, AI oracle proxy, and SKR retention economics.

---

## Responsibilities

1. **Card Deck & Combinations Engine**: Houses definitions for all 78 cards and calculates synergies across major and minor arcana.
2. **AI Oracle Synthesizer**: Generates 7-beat narrative readings and live chat responses via a tuned Gemini 3.8 Flash low-effort agent proxy.
3. **In-App Quotas & SKR State**: Enforces the 3 free spreads per day allowance and handles the 5 SKR fee for additional queries.
4. **Static CDN & APK Server**: Serves card art assets and hosts the latest compiled Android APK for Seeker phone downloads on ports 3001 and 80.

---

## API Endpoints

| Method | Path | Purpose |
| :--- | :--- | :--- |
| `GET` | `/api/health` | Service status check |
| `GET` | `/api/deck` | Returns all 78 card passports with symbolic attributes |
| `GET` | `/api/spreads` | Returns available spread layouts (Network Scan, Validator Cross, Crypto Compass) |
| `GET` | `/api/clock-in/:wallet` | Checks daily clock-in status, streak count, and remaining free spreads |
| `POST` | `/api/clock-in` | Executes daily block draw, updates streak, and grants +0.1 SKR reward |
| `POST` | `/api/spread/consume` | Deducts from daily free allowance or charges 5 SKR fee |
| `POST` | `/api/reading` | Validates quota, draws cards, and generates 7-beat interpretation |
| `POST` | `/api/chat` | Interactive conversational query with Oracle AI |
| `GET` | `/download` | Web landing page for mobile APK download with QR code |

---

## Running Locally

```bash
npm install
npm start
```

The server binds to `0.0.0.0:3001` and opens a fallback listener on port 80 for frictionless phone installs.

---

## Offline & AI Fallback

If AI inference times out or fails, the server falls back to an instant deterministic synthesis engine (`src/engine/oracleEngine.js`). It resolves card positions, combinations, and core advice in under 5ms.\n