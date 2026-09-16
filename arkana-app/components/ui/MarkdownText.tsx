import React from 'react';
import { View, Text, StyleSheet, Platform } from 'react-native';
import { ObsidianTokens } from '@/constants/theme';

interface MarkdownTextProps {
  content: string;
  baseColor?: string;
  fontSize?: number;
}

export function MarkdownText({
  content,
  baseColor = ObsidianTokens.colors.ink.text82,
  fontSize = 14,
}: MarkdownTextProps) {
  const lines = (content || '').split('\n');

  const renderInline = (text: string, keyPrefix: string, isHeader: boolean = false) => {
    const parts: React.ReactNode[] = [];
    const tokenRegex = /(\*\*\*[^*]+\*\*\*|\*\*[^*]+\*\*|\*[^*]+\*|_[^_]+_|`[^`]+`)/g;
    let lastIndex = 0;
    let match: RegExpExecArray | null;
    let index = 0;

    while ((match = tokenRegex.exec(text)) !== null) {
      if (match.index > lastIndex) {
        parts.push(
          <Text key={`${keyPrefix}-t-${index++}`}>
            {text.substring(lastIndex, match.index)}
          </Text>
        );
      }

      const matchText = match[0];
      if (matchText.startsWith('***') && matchText.endsWith('***')) {
        parts.push(
          <Text
            key={`${keyPrefix}-bi-${index++}`}
            style={[
              styles.boldText,
              styles.italicText,
              { color: isHeader ? ObsidianTokens.colors.gold.primary : ObsidianTokens.colors.ink.text },
            ]}
          >
            {matchText.slice(3, -3)}
          </Text>
        );
      } else if (matchText.startsWith('**') && matchText.endsWith('**')) {
        parts.push(
          <Text
            key={`${keyPrefix}-b-${index++}`}
            style={[
              styles.boldText,
              { color: isHeader ? ObsidianTokens.colors.gold.primary : ObsidianTokens.colors.ink.text },
            ]}
          >
            {matchText.slice(2, -2)}
          </Text>
        );
      } else if (matchText.startsWith('*') && matchText.endsWith('*')) {
        parts.push(
          <Text key={`${keyPrefix}-i-${index++}`} style={styles.italicText}>
            {matchText.slice(1, -1)}
          </Text>
        );
      } else if (matchText.startsWith('_') && matchText.endsWith('_')) {
        parts.push(
          <Text key={`${keyPrefix}-u-${index++}`} style={styles.italicText}>
            {matchText.slice(1, -1)}
          </Text>
        );
      } else if (matchText.startsWith('`') && matchText.endsWith('`')) {
        parts.push(
          <Text key={`${keyPrefix}-c-${index++}`} style={styles.codeText}>
            {matchText.slice(1, -1)}
          </Text>
        );
      }
      lastIndex = tokenRegex.lastIndex;
    }

    if (lastIndex < text.length) {
      parts.push(
        <Text key={`${keyPrefix}-end`}>
          {text.substring(lastIndex)}
        </Text>
      );
    }

    return parts;
  };

  return (
    <View style={styles.container}>
      {lines.map((line, lineIdx) => {
        const trimmed = line.trim();
        if (!trimmed) {
          return <View key={lineIdx} style={styles.emptyLine} />;
        }

        // Horizontal divider
        if (trimmed === '--' || trimmed === '***' || trimmed === '___') {
          return <View key={lineIdx} style={styles.divider} />;
        }

        // Headers: #, ##, ###, ####, etc.
        const headerMatch = trimmed.match(/^(#{1,6})\s*(.*)$/);
        if (headerMatch) {
          const level = headerMatch[1].length;
          let headerText = headerMatch[2].trim();
          // Strip redundant surrounding ** if present in header
          if (headerText.startsWith('**') && headerText.endsWith('**') && headerText.length > 4) {
            headerText = headerText.slice(2, -2).trim();
          }
          const isH2 = level <= 2;
          return (
            <View key={lineIdx} style={isH2 ? styles.header2Box : styles.header3Box}>
              <Text style={isH2 ? styles.header2Text : styles.header3Text}>
                {renderInline(headerText, `h-${lineIdx}`, true)}
              </Text>
            </View>
          );
        }

        // Bullet lists
        if (trimmed.startsWith('* ') || trimmed.startsWith('- ') || trimmed.startsWith('\u2022 ')) {
          const bulletContent = trimmed.replace(/^(\*|-|\u2022)\s+/, '');
          return (
            <View key={lineIdx} style={styles.bulletRow}>
              <Text style={styles.bulletGlyph}>{'\u2726'}</Text>
              <Text style={[styles.bodyText, { color: baseColor, fontSize, flex: 1 }]}>
                {renderInline(bulletContent, `b-${lineIdx}`)}
              </Text>
            </View>
          );
        }

        // Numbered lists (e.g. "1. ")
        const numMatch = trimmed.match(/^(\d+)\.\s+(.*)$/);
        if (numMatch) {
          const num = numMatch[1];
          const numContent = numMatch[2];
          return (
            <View key={lineIdx} style={styles.bulletRow}>
              <Text style={styles.numberGlyph}>{num}.</Text>
              <Text style={[styles.bodyText, { color: baseColor, fontSize, flex: 1 }]}>
                {renderInline(numContent, `n-${lineIdx}`)}
              </Text>
            </View>
          );
        }

        // Regular paragraph text
        return (
          <Text
            key={lineIdx}
            style={[styles.bodyText, { color: baseColor, fontSize }]}
          >
            {renderInline(trimmed, `p-${lineIdx}`)}
          </Text>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    width: '100%',
  },
  emptyLine: {
    height: 8,
  },
  divider: {
    height: 1,
    backgroundColor: 'rgba(200, 162, 74, 0.25)',
    marginVertical: 10,
    width: '100%',
  },
  header2Box: {
    marginTop: 10,
    marginBottom: 6,
  },
  header2Text: {
    fontFamily: Platform.select({ ios: 'Georgia', android: 'serif', default: 'serif' }),
    fontSize: 17,
    fontWeight: '300',
    color: ObsidianTokens.colors.gold.primary,
    letterSpacing: 0.5,
  },
  header3Box: {
    marginTop: 8,
    marginBottom: 4,
  },
  header3Text: {
    fontFamily: Platform.select({ ios: 'Georgia', android: 'serif', default: 'serif' }),
    fontSize: 15,
    fontWeight: '600',
    color: ObsidianTokens.colors.gold.primary,
    letterSpacing: 0.5,
  },
  bulletRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
    marginVertical: 3,
    paddingLeft: 2,
  },
  bulletGlyph: {
    color: ObsidianTokens.colors.gold.primary,
    fontSize: 8,
    marginTop: 5,
  },
  numberGlyph: {
    fontFamily: Platform.select({ ios: 'SpaceMono', android: 'SpaceMono', default: 'monospace' }),
    color: ObsidianTokens.colors.gold.primary,
    fontSize: 11,
    marginTop: 2,
  },
  bodyText: {
    fontFamily: Platform.select({ ios: 'Georgia', android: 'serif', default: 'serif' }),
    lineHeight: 22,
    marginVertical: 2,
  },
  boldText: {
    fontWeight: '700',
  },
  italicText: {
    fontStyle: 'italic',
    color: ObsidianTokens.colors.gold.muted,
  },
  codeText: {
    fontFamily: Platform.select({ ios: 'SpaceMono', android: 'SpaceMono', default: 'monospace' }),
    backgroundColor: 'rgba(200, 162, 74, 0.12)',
    color: ObsidianTokens.colors.gold.primary,
    fontSize: 12,
    paddingHorizontal: 4,
    borderRadius: 3,
  },
});
