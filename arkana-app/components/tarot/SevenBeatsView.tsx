import React from 'react';
import { StyleSheet, View, Text } from 'react-native';

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
              <Text style={styles.metricValue}>{metrics.dominant_suit}</Text>
            </View>
          )}
          {metrics.dominant_energy && (
            <View style={styles.metricPill}>
              <Text style={styles.metricLabel}>ENERGY</Text>
              <Text style={styles.metricValue}>{metrics.dominant_energy}</Text>
            </View>
          )}
        </View>
      )}

      {/* Beat 1: The Story */}
      {beats.story && (
        <View style={[styles.beatCard, styles.storyBorder]}>
          <View style={styles.beatHeader}>
            <Text style={styles.beatIcon}>📜</Text>
            <Text style={styles.beatTitle}>THE NARRATIVE SYNTHESIS</Text>
          </View>
          <Text style={styles.beatContent}>{beats.story}</Text>
        </View>
      )}

      {/* Beat 2: Hidden Forces */}
      {beats.hiddenForces && (
        <View style={styles.beatCard}>
          <View style={styles.beatHeader}>
            <Text style={styles.beatIcon}>👁️</Text>
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
              <Text style={styles.beatIcon}>🛡️</Text>
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
            <Text style={[styles.beatTitle, { color: '#14F195' }]}>ORACLE DIRECTIVE</Text>
          </View>
          <Text style={styles.beatContent}>{beats.oracleAdvice}</Text>
        </View>
      )}

      {/* Beat 6: Warning */}
      {beats.warning && (
        <View style={[styles.beatCard, styles.warningBorder]}>
          <View style={styles.beatHeader}>
            <Text style={styles.beatIcon}>⚠️</Text>
            <Text style={[styles.beatTitle, { color: '#FFB800' }]}>WARNING (HARD-FORK RISK)</Text>
          </View>
          <Text style={styles.beatContent}>{beats.warning}</Text>
        </View>
      )}

      {/* Beat 7: Final Omen */}
      {beats.finalOmen && (
        <View style={[styles.beatCard, styles.omenCard]}>
          <Text style={styles.omenBadge}>FINAL IMMUTABLE OMEN</Text>
          <Text style={styles.omenQuote}>« {beats.finalOmen} »</Text>
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
    backgroundColor: '#1E1638',
    borderColor: '#382866',
    borderWidth: 1,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 8,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  metricLabel: {
    color: '#8B949E',
    fontSize: 9,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
  metricValue: {
    color: '#14F195',
    fontSize: 11,
    fontWeight: 'bold',
  },
  beatCard: {
    backgroundColor: '#121422',
    borderColor: '#232742',
    borderWidth: 1,
    borderRadius: 14,
    padding: 14,
  },
  storyBorder: {
    borderColor: '#3D2F70',
    backgroundColor: '#16122C',
  },
  successBorder: {
    borderColor: '#14F19544',
  },
  dangerBorder: {
    borderColor: '#FF446644',
  },
  adviceBorder: {
    borderColor: '#14F195',
    backgroundColor: '#0E1F1A',
  },
  warningBorder: {
    borderColor: '#FFB800',
    backgroundColor: '#1F1A0E',
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
    fontSize: 18,
  },
  beatTitle: {
    color: '#F5D061',
    fontSize: 12,
    fontWeight: '800',
    letterSpacing: 1,
  },
  beatTitleSmall: {
    color: '#F5D061',
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
  beatContent: {
    color: '#D1D5DB',
    fontSize: 14,
    lineHeight: 22,
  },
  beatContentSmall: {
    color: '#D1D5DB',
    fontSize: 12,
    lineHeight: 18,
  },
  omenCard: {
    backgroundColor: '#1C1538',
    borderColor: '#F5D061',
    borderWidth: 1.5,
    alignItems: 'center',
    padding: 18,
  },
  omenBadge: {
    color: '#14F195',
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 2,
    marginBottom: 8,
  },
  omenQuote: {
    color: '#F5D061',
    fontSize: 15,
    fontStyle: 'italic',
    fontWeight: '600',
    textAlign: 'center',
    lineHeight: 24,
  },
});
