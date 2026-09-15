import React from 'react';
import {
  StyleSheet,
  View,
  Text,
  Modal,
  Pressable,
  ScrollView,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import * as Haptics from 'expo-haptics';
import { ObsidianTokens } from '@/constants/theme';
import { useLanguage, LANGUAGES, LanguageCode } from '@/services/i18n';

export function LanguageSelectionModal() {
  const {
    language,
    setLanguage,
    t,
    hasChosenLanguage,
    isModalOpen,
    closeLanguageModal,
  } = useLanguage();

  const [selectedCode, setSelectedCode] = React.useState<LanguageCode>(language);

  React.useEffect(() => {
    setSelectedCode(language);
  }, [language, isModalOpen]);

  if (!isModalOpen) return null;

  const handleSelect = (code: LanguageCode) => {
    try {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    } catch {}
    setSelectedCode(code);
  };

  const handleConfirm = async () => {
    try {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    } catch {}
    await setLanguage(selectedCode);
  };

  return (
    <Modal
      visible={isModalOpen}
      animationType="fade"
      transparent={false}
      onRequestClose={() => {
        if (hasChosenLanguage) closeLanguageModal();
      }}
    >
      <View style={styles.backdrop}>
        <SafeAreaView style={styles.safeArea}>
          {/* Header Row */}
          <View style={styles.topBar}>
            <View style={{ width: 36 }} />
            <Text style={styles.topBarKicker}>CONSECRATE THE DIALECT</Text>
            {hasChosenLanguage ? (
              <Pressable
                style={({ pressed }) => [styles.closeBtn, pressed && styles.cardPressed]}
                onPress={closeLanguageModal}
                hitSlop={12}
              >
                <Text style={styles.closeIcon}>{'\u2715'}</Text>
              </Pressable>
            ) : (
              <View style={{ width: 36 }} />
            )}
          </View>

          <ScrollView
            contentContainerStyle={styles.scrollContent}
            showsVerticalScrollIndicator={false}
          >
            {/* Sacred Seal & Lore Section */}
            <View style={styles.loreBox}>
              <Text style={styles.sealGlyphs}>&#10022; &#10070; &#10022;</Text>
              <Text style={styles.oracleAphorism}>
                "{t('onboarding_title')}"
              </Text>
              <View style={styles.aphorismDivider} />
              <Text style={styles.aphorismSubtitle}>
                {t('onboarding_subtitle')}
              </Text>
            </View>

            {/* Languages Grid / List */}
            <View style={styles.langList}>
              {LANGUAGES.map((item) => {
                const isSelected = item.code === selectedCode;
                return (
                  <Pressable
                    key={item.code}
                    style={({ pressed }) => [
                      styles.langCard,
                      isSelected && styles.langCardSelected,
                      pressed && styles.cardPressed,
                    ]}
                    onPress={() => handleSelect(item.code)}
                  >
                    <View style={[styles.tagPill, isSelected && styles.tagPillSelected]}>
                      <Text style={[styles.tagText, isSelected && styles.tagTextSelected]}>
                        {item.tag}
                      </Text>
                    </View>

                    <View style={styles.langInfo}>
                      <Text style={[styles.nativeText, isSelected && styles.nativeTextSelected]}>
                        {item.nativeName}
                      </Text>
                      <Text style={styles.englishText}>{item.name}</Text>
                    </View>

                    <View style={styles.radioBox}>
                      {isSelected ? (
                        <Text style={styles.selectedGlyph}>&#10022;</Text>
                      ) : (
                        <View style={styles.unselectedDot} />
                      )}
                    </View>
                  </Pressable>
                );
              })}
            </View>

            {/* Bottom Footer Note */}
            <View style={styles.footerNote}>
              <Text style={styles.footerText}>
                Archetype card titles remain in canonical English.
              </Text>
            </View>
          </ScrollView>

          {/* Sticky Bottom Confirmation Bar */}
          <View style={styles.confirmBar}>
            <Pressable
              style={({ pressed }) => [
                styles.confirmBtn,
                pressed && styles.cardPressed,
              ]}
              onPress={handleConfirm}
            >
              <Text style={styles.confirmBtnText}>
                {t('enter_arkana', 'ENTER ARKANA')} {'\u2192'}
              </Text>
            </Pressable>
          </View>
        </SafeAreaView>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: ObsidianTokens.colors.ink.void,
  },
  safeArea: {
    flex: 1,
  },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: ObsidianTokens.spacing.screenGutter,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: ObsidianTokens.colors.gold.subtle,
  },
  topBarKicker: {
    fontFamily: Platform.select({ ios: 'SpaceMono', android: 'SpaceMono', default: 'monospace' }),
    color: ObsidianTokens.colors.gold.primary,
    fontSize: 9,
    letterSpacing: 2,
    fontWeight: '700',
  },
  closeBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: ObsidianTokens.colors.ink.surface,
    borderColor: ObsidianTokens.colors.gold.subtle,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  closeIcon: {
    color: ObsidianTokens.colors.gold.primary,
    fontSize: 13,
    fontWeight: '700',
  },
  scrollContent: {
    paddingHorizontal: ObsidianTokens.spacing.screenGutter,
    paddingVertical: 20,
    paddingBottom: 40,
  },
  loreBox: {
    alignItems: 'center',
    backgroundColor: ObsidianTokens.colors.ink.surface,
    borderColor: ObsidianTokens.colors.gold.subtle,
    borderWidth: 1,
    borderRadius: ObsidianTokens.radii.panels,
    padding: 22,
    marginBottom: 20,
  },
  sealGlyphs: {
    color: ObsidianTokens.colors.gold.primary,
    fontSize: 14,
    letterSpacing: 6,
    marginBottom: 12,
  },
  oracleAphorism: {
    fontFamily: Platform.select({ ios: 'Georgia', android: 'serif', default: 'serif' }),
    color: ObsidianTokens.colors.ink.text,
    fontSize: 16,
    lineHeight: 25,
    fontStyle: 'italic',
    textAlign: 'center',
  },
  aphorismDivider: {
    width: 50,
    height: 1,
    backgroundColor: ObsidianTokens.colors.gold.subtle,
    marginVertical: 14,
  },
  aphorismSubtitle: {
    fontFamily: Platform.select({ ios: 'SpaceMono', android: 'SpaceMono', default: 'monospace' }),
    color: ObsidianTokens.colors.gold.primary,
    fontSize: 9,
    letterSpacing: 1.5,
    textAlign: 'center',
  },
  langList: {
    gap: 10,
  },
  langCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: ObsidianTokens.colors.ink.surface,
    borderColor: ObsidianTokens.colors.ink.hairline,
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  langCardSelected: {
    borderColor: ObsidianTokens.colors.gold.primary,
    backgroundColor: ObsidianTokens.colors.ink.fill,
  },
  tagPill: {
    width: 38,
    height: 38,
    borderRadius: 8,
    backgroundColor: ObsidianTokens.colors.ink.void,
    borderColor: ObsidianTokens.colors.ink.hairline,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 14,
  },
  tagPillSelected: {
    borderColor: ObsidianTokens.colors.gold.primary,
    backgroundColor: ObsidianTokens.colors.gold.surface,
  },
  tagText: {
    fontFamily: Platform.select({ ios: 'SpaceMono', android: 'SpaceMono', default: 'monospace' }),
    color: ObsidianTokens.colors.ink.text55,
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 1,
  },
  tagTextSelected: {
    color: ObsidianTokens.colors.gold.primary,
  },
  langInfo: {
    flex: 1,
  },
  nativeText: {
    fontFamily: Platform.select({ ios: 'Georgia', android: 'serif', default: 'serif' }),
    color: ObsidianTokens.colors.ink.text,
    fontSize: 16,
    fontWeight: '400',
    marginBottom: 2,
  },
  nativeTextSelected: {
    color: ObsidianTokens.colors.gold.primary,
    fontWeight: '600',
  },
  englishText: {
    fontFamily: Platform.select({ ios: 'SpaceMono', android: 'SpaceMono', default: 'monospace' }),
    color: ObsidianTokens.colors.ink.text42,
    fontSize: 10,
    letterSpacing: 1,
  },
  radioBox: {
    width: 24,
    height: 24,
    alignItems: 'center',
    justifyContent: 'center',
  },
  selectedGlyph: {
    color: ObsidianTokens.colors.gold.primary,
    fontSize: 14,
  },
  unselectedDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: ObsidianTokens.colors.ink.hairline,
  },
  footerNote: {
    alignItems: 'center',
    marginTop: 20,
  },
  footerText: {
    fontFamily: Platform.select({ ios: 'SpaceMono', android: 'SpaceMono', default: 'monospace' }),
    color: ObsidianTokens.colors.ink.text42,
    fontSize: 9,
    letterSpacing: 1,
    textAlign: 'center',
  },
  cardPressed: {
    transform: [{ scale: ObsidianTokens.motion.pressScale }],
  },
  confirmBar: {
    paddingHorizontal: ObsidianTokens.spacing.screenGutter,
    paddingTop: 12,
    paddingBottom: Platform.select({ ios: 16, android: 16, default: 12 }),
    backgroundColor: ObsidianTokens.colors.ink.void,
    borderTopWidth: 1,
    borderTopColor: ObsidianTokens.colors.gold.subtle,
  },
  confirmBtn: {
    backgroundColor: ObsidianTokens.colors.gold.primary,
    borderRadius: 10,
    paddingVertical: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  confirmBtnText: {
    fontFamily: Platform.select({ ios: 'SpaceMono', android: 'SpaceMono', default: 'monospace' }),
    color: ObsidianTokens.colors.ink.void,
    fontSize: 12,
    letterSpacing: 2,
    fontWeight: '700',
  },
});
