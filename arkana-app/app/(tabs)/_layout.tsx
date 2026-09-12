import { Tabs } from 'expo-router'
import React from 'react'
import { Platform } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { UiIconSymbol } from '@/components/ui/ui-icon-symbol'

export default function TabLayout() {
  const insets = useSafeAreaInsets()
  // Android navigation bar or gesture indicator safe area
  const bottomInset = Math.max(insets.bottom, Platform.OS === 'android' ? 16 : 0)

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarStyle: {
          backgroundColor: '#0E101A',
          borderTopColor: '#1F2338',
          borderTopWidth: 1,
          height: 58 + bottomInset,
          paddingBottom: bottomInset > 0 ? bottomInset + 4 : 8,
          paddingTop: 8,
        },
        tabBarActiveTintColor: '#14F195',
        tabBarInactiveTintColor: '#6E7681',
        tabBarLabelStyle: {
          fontSize: 11,
          fontWeight: '600',
        },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: 'Altar',
          tabBarIcon: ({ color }) => <UiIconSymbol size={24} name="sparkles" color={color} />,
        }}
      />
      <Tabs.Screen
        name="oracle"
        options={{
          title: 'Oracle AI',
          tabBarIcon: ({ color }) => (
            <UiIconSymbol size={24} name="bubble.left.and.bubble.right.fill" color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="codex"
        options={{
          title: 'Codex',
          tabBarIcon: ({ color }) => <UiIconSymbol size={24} name="book.closed.fill" color={color} />,
        }}
      />
      <Tabs.Screen
        name="wallet"
        options={{
          title: 'Seeker',
          tabBarIcon: ({ color }) => <UiIconSymbol size={24} name="wallet.pass.fill" color={color} />,
        }}
      />
      <Tabs.Screen name="account" options={{ href: null }} />
      <Tabs.Screen name="settings" options={{ href: null }} />
      <Tabs.Screen name="demo" options={{ href: null }} />
    </Tabs>
  )
}
