import { Platform } from 'react-native'
import Snackbar from 'react-native-snackbar'
import { formatError } from '@/utils/format-error'
import { soundService } from '@/services/soundService'

/** Surface a failed wallet or RPC action to the user instead of leaving it in the console. */
export function showError(title: string, error: unknown) {
  try {
    soundService.playTxError()
  } catch {}
  if (Platform.OS === 'web' || !Snackbar?.show) {
    console.warn(`${title}: ${formatError(error)}`)
    return
  }
  Snackbar.show({ duration: Snackbar.LENGTH_LONG, text: `${title}: ${formatError(error)}` })
}
