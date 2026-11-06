import type { App } from 'vue'
import type { Router } from 'vue-router'
import type { ToastMessageOptions } from 'primevue/toast'
import type { ToastServiceMethods } from 'primevue/toastservice'
import { useReqMsgLogStore, type ReqMsgSeverity } from '@/stores/reqMsgLogStore'

// Pages whose feedback goes to the message log instead of popping up
const LOGGED_ROUTES = new Set(['request', 'request-with-params'])

let addPopup: ToastServiceMethods['add'] | null = null

function toLogSeverity(severity: ToastMessageOptions['severity']): ReqMsgSeverity {
  switch (severity) {
    case 'success':
      return 'success'
    case 'warn':
      return 'warn'
    case 'error':
      return 'error'
    default:
      return 'info'
  }
}

/**
 * Wrap the PrimeVue toast service (shared by useToast() and $toast) so that, while
 * the Request page is showing, ungrouped toasts are written to the message log
 * instead of popping up. Grouped toasts (e.g. upload progress) still pop up.
 */
export function installToastRouting(app: App, router: Router): void {
  const service = app.config.globalProperties.$toast
  const originalAdd = service.add.bind(service)
  addPopup = originalAdd
  service.add = (message: ToastMessageOptions) => {
    const routeName = router.currentRoute.value.name
    if (!message.group && typeof routeName === 'string' && LOGGED_ROUTES.has(routeName)) {
      useReqMsgLogStore().add(
        toLogSeverity(message.severity),
        message.summary ?? '',
        message.detail == null ? '' : String(message.detail)
      )
      return
    }
    originalAdd(message)
  }
}

/** Always show a pop-up, even on pages whose feedback goes to the message log. */
export function showPopupToast(message: ToastMessageOptions): void {
  addPopup?.(message)
}
