import { Link, Stack } from 'expo-router'
import { StyleSheet } from 'react-native'

import { AppText } from '@/components/app-text'

import { AppView } from '@/components/app-view'
import { useLanguage } from '@/services/i18n'

export default function NotFoundScreen() {
  const { t } = useLanguage()
  return (
    <>
      <Stack.Screen options={{ title: t('not_found_title', 'Lost in the mempool') }} />
      <AppView style={styles.container}>
        <AppText type="title" style={{ textAlign: 'center' }}>
          {t('not_found_desc', 'This screen does not exist.')}
        </AppText>
        <Link href="/" style={styles.link}>
          <AppText type="link">{t('not_found_home', 'Return to the Altar')}</AppText>
        </Link>
      </AppView>
    </>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 20,
  },
  link: {
    marginTop: 15,
    paddingVertical: 15,
  },
})
