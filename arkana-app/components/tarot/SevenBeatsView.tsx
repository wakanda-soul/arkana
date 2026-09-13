import React from 'react';
import { StyleSheet, View, Text, Platform } from 'react-native';
import { ObsidianTokens } from '@/constants/theme';

interface SevenBeatsProps {
  beats: {
    story?: string;
    hiddenForces?: string;
    strengthens?: string;
    weakens?: string;
    oracleAdvice?: string;
    warning?: string;
    finalOmen?: string;
  };
  metrics?: {
    majors_count?: number;
    dominant_suit?: string | null;
    dominant_energy?: string | null;
    arcana_note?: string;
  };
}

export function SevenBeatsView({ beats, metrics }: SevenBeatsProps) {
  if (!beats) return null;

  return (
    <View style={styles.container}>
      {/* Metrics Banner */}
      {metrics && (
        <View style={styles.metricsContainer}>
          <View style={styles.metricPill}>
            <Text style={styles.metricLabel}>MAJORS</Text>
            <Text style={styles.metricValue}>{metrics.majors_count ?? 0}</Text>
          </View>
          {metrics.dominant_suit && (
            <View style={styles.metricPill}>
              <Text style={styles.metricLabel}>DOMINANT SUIT</Text>
              <Text style={styles.metricValue}>{metrics.dominant_suit.toUpperCase()}</Text>
            </View>
          )}
          {metrics.dominant_energy && (
            <View style={styles.metricPill}>
              <Text style={styles.metricLabel}>ENERGY</Text>
              <Text style={styles.metricValue}>{metrics.dominant_energy.toUpperCase()}</Text>
            </View>
          )}
        </View>
      )}

      {/* Beat 1: The Story */}
      {beats.story && (
        <View style={[styles.beatCard, styles.storyBorder]}>
          <View style={styles.beatHeader}>
            <Text style={styles.beatIcon}>✦</Text>
            <Text style={styles.beatTitle}>THE NARRATIVE SYNTHESIS</Text>
          </View>
          <Text style={styles.beatContent}>{beats.story}</Text>
        </View>
      )}

      {/* Beat 2: Hidden Forces */}
      {beats.hiddenForces && (
        <View style={styles.beatCard}>
          <View style={styles.beatHeader}>
            <Text style={styles.beatIcon}>👁</Text>
            <Text style={styles.beatTitle}>HIDDEN MEMPOOL FORCES</Text>
          </View>
          <Text style={styles.beatContent}>{beats.hiddenForces}</Text>
        </View>
      )}

      {/* Grid: Strengthens vs Weakens */}
      <View style={styles.row}>
        {beats.strengthens && (
          <View style={[styles.beatCard, styles.halfCard, styles.successBorder]}>
            <View style={styles.beatHeader}>
              <Text style={styles.beatIcon}>⚡</Text>
              <Text style={styles.beatTitleSmall}>CONSENSUS TAILWINDS</Text>
            </View>
            <Text style={styles.beatContentSmall}>{beats.strengthens}</Text>
          </View>
        )}
        {beats.weakens && (
          <View style={[styles.beatCard, styles.halfCard, styles.dangerBorder]}>
            <View style={styles.beatHeader}>
              <Text style={styles.beatIcon}>🛡</Text>
              <Text style={styles.beatTitleSmall}>LIQUIDITY FRICTION</Text>
            </View>
            <Text style={styles.beatContentSmall}>{beats.weakens}</Text>
          </View>
        )}
      </View>

      {/* Beat 5: Oracle Advice */}
      {beats.oracleAdvice && (
        <View style={[styles.beatCard, styles.adviceBorder]}>
          <View style={styles.beatHeader}>
            <Text style={styles.beatIcon}>🔮</Text>
            <Text style={[styles.beatTitle, { color: ObsidianTokens.colors.gold.primary }]}>ORACLE DIRECTIVE</Text>
          </View>
          <Text style={styles.beatContent}>{beats.oracleAdvice}</Text>
        </View>
      )}

      {/* Beat 6: Warning */}
      {beats.warning && (
        <View style={[styles.beatCard, styles.warningBorder]}>
          <View style={styles.beatHeader}>
            <Text style={styles.beatIcon}>⚠️</Text>
            <Text style={[styles.beatTitle, { color: '#FFA595' }]}>WARNING (HARD-FORK RISK)</Text>
          </View>
          <Text style={styles.beatContent}>{beats.warning}</Text>
        </View>
      )}

      {/* Beat 7: Final Omen */}
      {beats.finalOmen && (
        <View style={[styles.beatCard, styles.omenCard]}>
          <Text style={styles.omenBadge}>FINAL IMMUTABLE OMEN</Text>
          <Text style={styles.omenQuote}>"{beats.finalOmen}"</Text>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    paddingVertical: 12,
    gap: 12,
  },
  metricsContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 4,
  },
  metricPill: {
    backgroundColor: ObsidianTokens.colors.ink.surface,
    borderColor: ObsidianTokens.colors.ink.hairline,
    borderWidth: 1,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  metricLabel: {
    fontFamily: Platform.select({ ios: 'SpaceMono', android: 'SpaceMono', default: 'monospace' }),
    color: ObsidianTokens.colors.ink.text55,
    fontSize: 9,
    letterSpacing: 1,
  },
  metricValue: {
    fontFamily: Platform.select({ ios: 'SpaceMono', android: 'SpaceMono', default: 'monospace' }),
    color: ObsidianTokens.colors.gold.primary,
    fontSize: 10,
    fontWeight: '700',
  },
  beatCard: {
    backgroundColor: ObsidianTokens.colors.ink.surface,
    borderColor: ObsidianTokens.colors.ink.hairline,
    borderWidth: 1,
    borderRadius: ObsidianTokens.radii.panels,
    padding: 16,
  },
  storyBorder: {
    borderColor: ObsidianTokens.colors.gold.subtle,
    backgroundColor: ObsidianTokens.colors.ink.fill,
  },
  successBorder: {
    borderColor: 'rgba(200, 162, 74, 0.25)',
    backgroundColor: ObsidianTokens.colors.gold.surface,
  },
  dangerBorder: {
    borderColor: 'rgba(212, 82, 64, 0.25)',
    backgroundColor: 'rgba(212, 82, 64, 0.08)',
  },
  adviceBorder: {
    borderColor: ObsidianTokens.colors.gold.primary,
    backgroundColor: ObsidianTokens.colors.ink.surface,
  },
  warningBorder: {
    borderColor: 'rgba(212, 82, 64, 0.35)',
    backgroundColor: 'rgba(212, 82, 64, 0.1)',
  },
  row: {
    flexDirection: 'row',
    gap: 10,
  },
  halfCard: {
    flex: 1,
  },
  beatHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 8,
  },
  beatIcon: {
    fontSize: 14,
    color: ObsidianTokens.colors.gold.primary,
  },
  beatTitle: {
    fontFamily: Platform.select({ ios: 'SpaceMono', android: 'SpaceMono', default: 'monospace' }),
    color: ObsidianTokens.colors.gold.primary,
    fontSize: 10,
    letterSpacing: 1.5,
    fontWeight: '700',
  },
  beatTitleSmall: {
    fontFamily: Platform.select({ ios: 'SpaceMono', android: 'SpaceMono', default: 'monospace' }),
    color: ObsidianTokens.colors.gold.primary,
    fontSize: 9,
    letterSpacing: 1,
    fontWeight: '700',
  },
  beatContent: {
    fontFamily: Platform.select({ ios: 'Georgia', android: 'serif', default: 'serif' }),
    color: ObsidianTokens.colors.ink.text82,
    fontSize: 14,
    lineHeight: 22,
  },
  beatContentSmall: {
    fontFamily: Platform.select({ ios: 'Georgia', android: 'serif', default: 'serif' }),
    color: ObsidianTokens.colors.ink.text82,
    fontSize: 12,
    lineHeight: 18,
  },
  omenCard: {
    backgroundColor: ObsidianTokens.colors.ink.surface,
    borderColor: ObsidianTokens.colors.gold.primary,
    borderWidth: 1.5,
    alignItems: 'center',
    padding: 20,
  },
  omenBadge: {
    fontFamily: Platform.select({ ios: 'SpaceMono', android: 'SpaceMono', default: 'monospace' }),
    color: ObsidianTokens.colors.gold.primary,
    fontSize: 9,
    letterSpacing: 2,
    marginBottom: 8,
  },
  omenQuote: {
    fontFamily: Platform.select({ ios: 'Georgia', android: 'serif', default: 'serif' }),
    color: ObsidianTokens.colors.ink.text,
    fontSize: 16,
    fontStyle: 'italic',
    textAlign: 'center',
    lineHeight: 24,
  },
});
