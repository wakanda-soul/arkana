/**
 * Arkana Obsidian Ritual Design System Tokens
 * Extracted and authoritative from Arkana Design System specification.
 */

export const ObsidianTokens = {
  colors: {
    // 01 COLOUR
    ink: {
      void: '#08070B', // App ground
      surface: '#120E1A', // Cards, elevated surfaces
      text: '#EDE7DC', // Primary text
      text82: 'rgba(237, 231, 220, 0.82)', // Body copy
      text55: 'rgba(237, 231, 220, 0.55)', // Secondary
      text42: 'rgba(237, 231, 220, 0.42)', // Mono labels
      hairline: 'rgba(237, 231, 220, 0.12)', // Subtle borders
      fill: 'rgba(237, 231, 220, 0.06)', // Fills
      quietPanel: 'rgba(237, 231, 220, 0.10)',
    },
    gold: {
      primary: '#C8A24A', // Action, active hairline
      muted: 'rgba(200, 162, 74, 0.40)',
      subtle: 'rgba(200, 162, 74, 0.25)',
      glow: 'rgba(200, 162, 74, 0.14)',
      surface: 'rgba(200, 162, 74, 0.08)',
    },
    violet: {
      glow: '#7C4DFF', // Aura, insight
      ink: '#A78BFA', // Pattern labels
      wash: 'rgba(124, 77, 255, 0.12)',
      aura: 'rgba(124, 77, 255, 0.32)',
      radial: 'rgba(124, 77, 255, 0.36)',
    },
    state: {
      gain: '#7FB27A', // Positive data
      loss: '#C9736A', // Failure, drawdown (muted clay, never pure red)
    },
  },
  spacing: {
    screenGutter: 24,
    sectionGap: 22,
    listGap: 12,
    statusBar: 44,
    navZone: 60,
    safeBottom: 26,
  },
  radii: {
    buttons: 12,
    panels: 14,
    cards: 12,
    chips: 999,
  },
  touch: {
    minTarget: 48,
    chipHeight: 36,
  },
  card: {
    ratio: 0.66, // Width to height
  },
  motion: {
    pressDurationIn: 90,
    pressDurationOut: 140,
    pressScale: 0.94,
    revealDuration: 550,
    shuffleLoop: 900,
    auraPeriod: 7000,
  },
} as const;

export default ObsidianTokens;
