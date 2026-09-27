import { useMobileWallet } from '@wallet-ui/react-native-web3js'
import { BaseButton } from '@/components/solana/base-button'
import React, { useState } from 'react'
import { showError } from '@/utils/show-error'
import { soundService } from '@/services/soundService'
import { useLanguage } from '@/services/i18n'

export function WalletUiButtonDisconnect({ label }: { label?: string }) {
  const { t } = useLanguage()
  const { disconnect } = useMobileWallet()
  const [isDisconnecting, setIsDisconnecting] = useState(false)

  async function handleDisconnect() {
    if (isDisconnecting) {
      return
    }
    setIsDisconnecting(true)
    try {
      soundService.playWalletDisconnect()
      await disconnect()
    } catch (error) {
      showError('err_title_disconnect', error)
    } finally {
      setIsDisconnecting(false)
    }
  }

  return (
    <BaseButton
      disabled={isDisconnecting}
      label={isDisconnecting ? t('disconnecting_label', 'Disconnecting...') : label ?? t('disconnect_label', 'Disconnect')}
      onPress={() => void handleDisconnect()}
    />
  )
}
