import { Tabs } from 'expo-router'
import React from 'react'
import { Platform } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { UiIconSymbol } from '@/components/ui/ui-icon-symbol'
import { useLanguage } from '@/services/i18n'
import { soundService } from '@/services/soundService'

export default function TabLayout() {
  const insets = useSafeAreaInsets()
  const { t } = useLanguage()
  // Android navigation bar or gesture indicator safe area
  const bottomInset = Math.max(insets.bottom, Platform.OS === 'android' ? 16 : 0)

  return (
    <Tabs
      screenListeners={{
        tabPress: () => {
          soundService.playTabSwitch();
        },
      }}
      screenOptions={{
        headerShown: false,
        tabBarHideOnKeyboard: true,
        tabBarStyle: {
          backgroundColor: '#08070B',
          borderTopColor: 'rgba(200, 162, 74, 0.25)',
          borderTopWidth: 1,
          height: 56 + bottomInset,
          paddingBottom: bottomInset > 0 ? bottomInset + 2 : 6,
          paddingTop: 6,
        },
        tabBarActiveTintColor: '#C8A24A',
        tabBarInactiveTintColor: 'rgba(237, 231, 220, 0.42)',
        tabBarLabelStyle: {
          fontFamily: Platform.select({ ios: 'SpaceMono', android: 'SpaceMono', default: 'monospace' }),
          fontSize: 10,
          letterSpacing: 1.6,
          fontWeight: '500',
        },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: t('tab_today', 'TODAY'),
          tabBarIcon: ({ color }) => <UiIconSymbol size={22} name="sparkles" color={color} />,
        }}
      />
      <Tabs.Screen
        name="oracle"
        options={{
          title: t('tab_ask', 'ASK'),
          tabBarIcon: ({ color }) => (
            <UiIconSymbol size={22} name="bubble.left.and.bubble.right.fill" color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="codex"
        options={{
          title: t('tab_deck', 'DECK'),
          tabBarIcon: ({ color }) => <UiIconSymbol size={22} name="book.closed.fill" color={color} />,
        }}
      />
      <Tabs.Screen
        name="wallet"
        options={{
          title: t('tab_me', 'ME'),
          tabBarIcon: ({ color }) => <UiIconSymbol size={22} name="wallet.pass.fill" color={color} />,
        }}
      />
    </Tabs>
  )
}
