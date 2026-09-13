/**
 * Arkana Obsidian Ritual Theme Colors
 * Direct mapping from design tokens.
 */

import { ObsidianTokens } from './theme';

const goldPrimary = ObsidianTokens.colors.gold.primary;
const inkVoid = ObsidianTokens.colors.ink.void;
const inkText = ObsidianTokens.colors.ink.text;
const inkSurface = ObsidianTokens.colors.ink.surface;

export const Colors = {
  light: {
    background: inkVoid,
    border: ObsidianTokens.colors.ink.hairline,
    icon: ObsidianTokens.colors.ink.text42,
    tabIconDefault: ObsidianTokens.colors.ink.text42,
    tabIconSelected: goldPrimary,
    text: inkText,
    tint: goldPrimary,
  },
  dark: {
    background: inkVoid,
    border: ObsidianTokens.colors.ink.hairline,
    icon: ObsidianTokens.colors.ink.text42,
    tabIconDefault: ObsidianTokens.colors.ink.text42,
    tabIconSelected: goldPrimary,
    text: inkText,
    tint: goldPrimary,
  },
};
