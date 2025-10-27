import Permalink from 'ol-ext/control/Permalink'
import { createLogger } from '@/utils/logger'

const logger = createLogger('usePermalink')

function isLocalStorageAvailable() {
  try {
    const test = '__test__'
    window.localStorage.setItem(test, test)
    window.localStorage.removeItem(test)
    return true
  } catch {
    return false
  }
}

export function usePermalink() {
  if (isLocalStorageAvailable()) {
    const plink = new Permalink({ visible: true, localStorage: 'position' })
    return plink
  } else {
    logger.error('localStorage not available no Permalink control added')
    return undefined
  }
}
