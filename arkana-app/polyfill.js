import { install } from 'react-native-quick-crypto'
import { Buffer } from 'buffer'

install()
if (typeof global.Buffer === 'undefined') {
  global.Buffer = Buffer
}
