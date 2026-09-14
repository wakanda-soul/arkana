import React from 'react';
import { StyleSheet, View, Text, Platform } from 'react-native';
import { ObsidianTokens } from '@/constants/theme';

interface SevenBeatsProps {
  beats?: {
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
  question?: string;
}

export function SevenBeatsView({ beats, metrics, question }: SevenBeatsProps) {
  if (!beats) return null;

  const hasIntent = question && question.trim().length > 0;

  return (
    <View style={styles.container}>
      {/* 1. Inscribed Intent Card */}
      {hasIntent && (
        <View style={styles.intentPanel}>
          <View style={styles.intentHeaderRow}>
            <Text style={styles.intentGlyph}>&#9672;</Text>
            <Text style={styles.intentLabel}>INSCRIBED INTENT</Text>
            <View style={styles.intentHairline} />
          </View>
          <Text style={styles.intentQuestion}>"{question!.trim()}"</Text>
        </View>
      )}

      {/* 2. Protocol Metrics Strip */}
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
              <Text style={styles.metricLabel}>CONSENSUS</Text>
              <Text style={styles.metricValue}>{metrics.dominant_energy.toUpperCase()}</Text>
            </View>
          )}
        </View>
      )}

      {/* 3. The Continuous Obsidian Consensus Scroll */}
      <View style={styles.scrollContainer}>
        {/* Scroll Header Seal */}
        <View style={styles.scrollHeader}>
          <Text style={styles.sealGlyphs}>&#10022; &#10070; &#10022;</Text>
          <Text style={styles.sealTitle}>CONSENSUS SYNTHESIS</Text>
          <View style={styles.sealDivider} />
        </View>

        {/* Chapter I: The Narrative Synthesis */}
        {beats.story && (
          <View style={styles.chapterSection}>
            <View style={styles.chapterHeader}>
              <Text style={styles.chapterNumeral}>I</Text>
              <Text style={styles.chapterTitle}>THE CONSENSUS NARRATIVE</Text>
            </View>
            <Text style={styles.serifBody}>{beats.story}</Text>
          </View>
        )}

        {/* Chapter II: Hidden Mempool Dynamics */}
        {beats.hiddenForces && (
          <View style={styles.chapterSection}>
            <View style={styles.dividerBox}>
              <View style={styles.dividerLine} />
              <Text style={styles.dividerSymbol}>&#9671;</Text>
              <View style={styles.dividerLine} />
            </View>
            <View style={styles.chapterHeader}>
              <Text style={styles.chapterNumeral}>II</Text>
              <Text style={styles.chapterTitle}>HIDDEN MEMPOOL DYNAMICS</Text>
            </View>
            <Text style={styles.serifBody}>{beats.hiddenForces}</Text>
          </View>
        )}

        {/* Chapter III: Vectors of Influence */}
        {(beats.strengthens || beats.weakens) && (
          <View style={styles.chapterSection}>
            <View style={styles.dividerBox}>
              <View style={styles.dividerLine} />
              <Text style={styles.dividerSymbol}>&#9671;</Text>
              <View style={styles.dividerLine} />
            </View>
            <View style={styles.chapterHeader}>
              <Text style={styles.chapterNumeral}>III</Text>
              <Text style={styles.chapterTitle}>CONVERGENCE & FRICTION</Text>
            </View>

            {beats.strengthens && (
              <View style={styles.vectorItem}>
                <View style={styles.vectorHeader}>
                  <Text style={styles.vectorGlyphUp}>&#9650;</Text>
                  <Text style={styles.vectorLabel}>CONSENSUS TAILWINDS</Text>
                </View>
                <Text style={styles.serifBodySecondary}>{beats.strengthens}</Text>
              </View>
            )}

            {beats.weakens && (
              <View style={[styles.vectorItem, styles.vectorFriction]}>
                <View style={styles.vectorHeader}>
                  <Text style={styles.vectorGlyphDown}>&#9660;</Text>
                  <Text style={[styles.vectorLabel, { color: '#FFA595' }]}>LIQUIDITY RESISTANCE</Text>
                </View>
                <Text style={styles.serifBodySecondary}>{beats.weakens}</Text>
              </View>
            )}
          </View>
        )}

        {/* Chapter IV: Oracle Directive */}
        {beats.oracleAdvice && (
          <View style={styles.chapterSection}>
            <View style={styles.dividerBox}>
              <View style={styles.dividerLine} />
              <Text style={styles.dividerSymbol}>&#9671;</Text>
              <View style={styles.dividerLine} />
            </View>
            <View style={styles.chapterHeader}>
              <Text style={styles.chapterNumeral}>IV</Text>
              <Text style={[styles.chapterTitle, { color: ObsidianTokens.colors.gold.primary }]}>
                ORACLE DIRECTIVE
              </Text>
            </View>
            <View style={styles.directiveCallout}>
              <Text style={styles.directiveText}>{beats.oracleAdvice}</Text>
            </View>
          </View>
        )}

        {/* Chapter V: Protocol Risk Warning */}
        {beats.warning && (
          <View style={styles.chapterSection}>
            <View style={styles.dividerBox}>
              <View style={styles.dividerLine} />
              <Text style={styles.dividerSymbol}>&#9671;</Text>
              <View style={styles.dividerLine} />
            </View>
            <View style={styles.chapterHeader}>
              <Text style={styles.chapterNumeral}>V</Text>
              <Text style={[styles.chapterTitle, { color: '#FFA595' }]}>
                PROTOCOL RISK PARAMETER
              </Text>
            </View>
            <Text style={[styles.serifBody, { color: 'rgba(255, 165, 149, 0.92)' }]}>
              {beats.warning}
            </Text>
          </View>
        )}

        {/* Chapter VI: Final Immutable Omen */}
        {beats.finalOmen && (
          <View style={styles.omenWrapper}>
            <View style={styles.dividerBox}>
              <View style={styles.dividerLine} />
              <Text style={styles.dividerSymbol}>&#10022;</Text>
              <View style={styles.dividerLine} />
            </View>
            <Text style={styles.omenKicker}>FINAL IMMUTABLE OMEN</Text>
            <Text style={styles.omenQuote}>"{beats.finalOmen}"</Text>
            <Text style={styles.omenBottomGlyph}>&#10022; &#10022; &#10022;</Text>
          </View>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    paddingVertical: 12,
    gap: 14,
  },
  intentPanel: {
    backgroundColor: ObsidianTokens.colors.ink.surface,
    borderColor: ObsidianTokens.colors.gold.primary,
    borderWidth: 1,
    borderRadius: ObsidianTokens.radii.panels,
    padding: 16,
  },
  intentHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 8,
  },
  intentGlyph: {
    color: ObsidianTokens.colors.gold.primary,
    fontSize: 12,
  },
  intentLabel: {
    fontFamily: Platform.select({ ios: 'SpaceMono', android: 'SpaceMono', default: 'monospace' }),
    color: ObsidianTokens.colors.gold.primary,
    fontSize: 9,
    letterSpacing: 2,
    fontWeight: '700',
  },
  intentHairline: {
    flex: 1,
    height: 1,
    backgroundColor: ObsidianTokens.colors.gold.subtle,
  },
  intentQuestion: {
    fontFamily: Platform.select({ ios: 'Georgia', android: 'serif', default: 'serif' }),
    color: ObsidianTokens.colors.ink.text,
    fontSize: 15,
    fontStyle: 'italic',
    lineHeight: 22,
  },
  metricsContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
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
  scrollContainer: {
    backgroundColor: ObsidianTokens.colors.ink.surface,
    borderColor: ObsidianTokens.colors.gold.subtle,
    borderWidth: 1,
    borderRadius: ObsidianTokens.radii.panels,
    padding: 20,
  },
  scrollHeader: {
    alignItems: 'center',
    marginBottom: 20,
  },
  sealGlyphs: {
    color: ObsidianTokens.colors.gold.primary,
    fontSize: 12,
    letterSpacing: 4,
    marginBottom: 6,
  },
  sealTitle: {
    fontFamily: Platform.select({ ios: 'SpaceMono', android: 'SpaceMono', default: 'monospace' }),
    color: ObsidianTokens.colors.gold.primary,
    fontSize: 10,
    letterSpacing: 2.5,
    fontWeight: '700',
  },
  sealDivider: {
    width: 60,
    height: 1,
    backgroundColor: ObsidianTokens.colors.gold.subtle,
    marginTop: 10,
  },
  chapterSection: {
    marginBottom: 4,
  },
  chapterHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 10,
  },
  chapterNumeral: {
    fontFamily: Platform.select({ ios: 'SpaceMono', android: 'SpaceMono', default: 'monospace' }),
    color: ObsidianTokens.colors.gold.primary,
    fontSize: 10,
    fontWeight: '700',
  },
  chapterTitle: {
    fontFamily: Platform.select({ ios: 'SpaceMono', android: 'SpaceMono', default: 'monospace' }),
    color: ObsidianTokens.colors.gold.primary,
    fontSize: 9,
    letterSpacing: 1.5,
    fontWeight: '700',
  },
  serifBody: {
    fontFamily: Platform.select({ ios: 'Georgia', android: 'serif', default: 'serif' }),
    color: ObsidianTokens.colors.ink.text82,
    fontSize: 14,
    lineHeight: 23,
  },
  serifBodySecondary: {
    fontFamily: Platform.select({ ios: 'Georgia', android: 'serif', default: 'serif' }),
    color: ObsidianTokens.colors.ink.text82,
    fontSize: 13,
    lineHeight: 20,
  },
  dividerBox: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    marginVertical: 18,
  },
  dividerLine: {
    flex: 1,
    height: 1,
    backgroundColor: ObsidianTokens.colors.ink.hairline,
  },
  dividerSymbol: {
    color: ObsidianTokens.colors.gold.muted,
    fontSize: 10,
  },
  vectorItem: {
    backgroundColor: ObsidianTokens.colors.ink.fill,
    borderColor: 'rgba(200, 162, 74, 0.2)',
    borderWidth: 1,
    borderRadius: 10,
    padding: 12,
    marginTop: 8,
  },
  vectorFriction: {
    borderColor: 'rgba(212, 82, 64, 0.25)',
    backgroundColor: 'rgba(212, 82, 64, 0.05)',
  },
  vectorHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 6,
  },
  vectorGlyphUp: {
    fontSize: 9,
    color: ObsidianTokens.colors.gold.primary,
  },
  vectorGlyphDown: {
    fontSize: 9,
    color: '#D45240',
  },
  vectorLabel: {
    fontFamily: Platform.select({ ios: 'SpaceMono', android: 'SpaceMono', default: 'monospace' }),
    color: ObsidianTokens.colors.gold.primary,
    fontSize: 9,
    letterSpacing: 1,
    fontWeight: '700',
  },
  directiveCallout: {
    backgroundColor: ObsidianTokens.colors.ink.fill,
    borderLeftColor: ObsidianTokens.colors.gold.primary,
    borderLeftWidth: 3,
    paddingLeft: 14,
    paddingVertical: 10,
    paddingRight: 10,
    borderRadius: 4,
  },
  directiveText: {
    fontFamily: Platform.select({ ios: 'Georgia', android: 'serif', default: 'serif' }),
    color: ObsidianTokens.colors.ink.text,
    fontSize: 14,
    lineHeight: 22,
    fontStyle: 'italic',
  },
  omenWrapper: {
    alignItems: 'center',
    paddingVertical: 10,
  },
  omenKicker: {
    fontFamily: Platform.select({ ios: 'SpaceMono', android: 'SpaceMono', default: 'monospace' }),
    color: ObsidianTokens.colors.gold.primary,
    fontSize: 9,
    letterSpacing: 2,
    marginBottom: 10,
  },
  omenQuote: {
    fontFamily: Platform.select({ ios: 'Georgia', android: 'serif', default: 'serif' }),
    color: ObsidianTokens.colors.ink.text,
    fontSize: 16,
    fontStyle: 'italic',
    textAlign: 'center',
    lineHeight: 25,
    paddingHorizontal: 8,
  },
  omenBottomGlyph: {
    color: ObsidianTokens.colors.gold.primary,
    fontSize: 10,
    letterSpacing: 4,
    marginTop: 12,
  },
});
