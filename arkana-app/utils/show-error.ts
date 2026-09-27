import { Platform } from 'react-native'
import Snackbar from 'react-native-snackbar'
import { formatError } from '@/utils/format-error'
import { soundService } from '@/services/soundService'
import { localizeErrorText, translate } from '@/services/i18n'

/**
 * Surface a failed wallet or RPC action to the user instead of leaving it in the console.
 * `title` may be a translation key or plain text; known error messages are translated.
 */
export function showError(title: string, error: unknown) {
  title = translate(title, title)
  const message = localizeErrorText(formatError(error))
  try {
    soundService.playTxError()
  } catch {}
  if (Platform.OS === 'web' || !Snackbar?.show) {
    console.warn(`${title}: ${message}`)
    return
  }
  Snackbar.show({ duration: Snackbar.LENGTH_LONG, text: `${title}: ${message}` })
}
