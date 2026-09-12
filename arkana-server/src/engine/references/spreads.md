# Spreads — the Top 3

95% of users need only three spreads. Default to **The Network Scan**. Always tell the user which spread
you are laying and what each position asks, then read them as ONE story (see `interpretation-engine.md`).

Position meanings below are the *questions each slot asks* — bend every card to its slot.

---

## ① The Network Scan — 3 cards (default, fastest)

```
   [1]        [2]         [3]
  Past  →   Present  →  Next Block
```

For life, relationships, crypto, career — the everyday reading.

1. **Past** — the block that led here. What decision or event set the current chain in motion.
2. **Present** — the current state of the Network. The trend or barrier you're standing in right now.
3. **Next Block** — the most probable next step *if nothing changes*. A direction, not a verdict.

**Synthesis:** trace one line from Past through Present to Next Block. The central message is usually the
tension or continuity between Past and Next Block; Present tells you what to do about it.

---

## ② The Validator Cross — 5 cards (best all-purpose; simpler Celtic Cross)

```
              [2]
               |
     [1] ---- [3] ---- [5]
               |
              [4]
```

1. **Current State** — where the user stands; the core of the question.
2. **Main Opportunity** — the strongest supportive force / the opening.
3. **Main Obstacle** — the central challenge crossing the situation.
4. **Hidden Influence** — the undercurrent the user doesn't see (weight reversed cards here heavily).
5. **Outcome if the current path continues** — the tendency, explicitly conditional.

**Synthesis:** 1 is the subject; 2 vs 3 is the central tension; 4 reframes it (often the real story);
5 is where 1→2→3→4 points *if nothing changes*. Advice = how to lean into 2 and disarm 3 given 4.

---

## ③ Crypto Compass — 5 cards (the signature spread; for "should I enter?" questions)

```
            [2] Market
              |
 [3] Project — [1] You — (center)
              |
        [4] Opportunity
              |
        [5] Risk
```

Perfect for crypto-community questions: a project, a token launch, an entry decision.

1. **You** — the querent's real position, mindset, readiness.
2. **Market** — the external conditions / macro sentiment around the question.
3. **Project** — the thing itself (the coin, deal, job, relationship) on its own merits.
4. **Opportunity** — the realistic upside / what can be gained.
5. **Risk** — what can break it (the shadow to manage).

**Synthesis for "should I enter?":** read You → Market → Project as the setup, then weigh Opportunity
against Risk. Never output a buy/sell verdict — describe the alignment (or misalignment) between the
user (1), the conditions (2), and the object (3), and let them decide. Dominant suit here is very telling:
many ⚔ Protocols = the risk is real and structural; many 🪙 Assets = a long-game, low-drama setup.

---

## Revealing the draw

**Default — the composed spread image.** Run `render_spread.py` with the packet's `spread_key` and
`cards_arg`; it lays the drawn cards out in the spread's geometry on a dark background, rotates reversed
cards 180°, and the chat displays the resulting image (verified):

```
python scripts/render_spread.py <spread_key> --cards <cards_arg>
```

Do this on **every** reading — the image is the reveal. A one-line intro before it is fine.

**Never** use markdown tables (`|`), `<br>` tags, or ASCII cross/compass art — they render as raw, ugly
text. **Never** claim an image you did not actually produce.

**Fallback — only if the renderer genuinely fails:** a clean plain-text list, one card per line, in the
spread's order, `• Position — Card (orientation)`:

```
• Past — The Hard Fork (upright)
• Present — The DYOR Sage (upright)
• Next Block — Bull Market (upright)
```

## Choosing a spread
- Quick / open question, or user unsure → **Network Scan**.
- "What's really going on / what should I do?" → **Validator Cross**.
- Evaluating a specific project, token, deal, or entry → **Crypto Compass**.
- User names their own layout or supplies drawn cards → honor it exactly.

## Extending later (not in the Top 3, optional backlog)
Single-card "Daily Block"; "Two Paths" (2-card fork decision); relationship 6-card; token-launch 7-card.
Keep the same engine; only the position labels change.
