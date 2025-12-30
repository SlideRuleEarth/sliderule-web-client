import { defineStore } from 'pinia'
import { app } from '@/main'
import { formatNetworkErrorMessage, formatNetworkErrorTitle } from '@/utils/errorSuggestions'

export const useSrToastStore = defineStore('srToast', {
  state: () => ({
    life: 60000 // default life of a toast in milliseconds (60 seconds)
  }),
  actions: {
    setLife(life: number) {
      this.life = life
    },
    getLife(): number {
      return this.life
    },
    error(title: string = 'Title', body: string = 'Body', life?: number): void {
      app.config.globalProperties.$toast.add({
        severity: 'error',
        summary: title,
        detail: body,
        life: life ?? 0 // Error toasts stay until user closes them (life: 0 means no auto-close)
      })
    },
    success(title: string = 'Title', body: string = 'Body', life?: number): void {
      app.config.globalProperties.$toast.add({
        severity: 'success',
        summary: title,
        detail: body,
        life: life ?? this.life // Use provided life or default to this.life
      })
    },
    info(title: string = 'Title', body: string = 'Body', life?: number): void {
      app.config.globalProperties.$toast.add({
        severity: 'info',
        summary: title,
        detail: body,
        life: life ?? this.life // Use provided life or default to this.life
      })
    },
    warn(title: string = 'Title', body: string = 'Body', life?: number): void {
      app.config.globalProperties.$toast.add({
        severity: 'warn',
        summary: title,
        detail: body,
        life: life ?? this.life // Use provided life or default to this.life
      })
    },
    networkError(func: string | undefined, code: string, message: string, life?: number): void {
      const title = formatNetworkErrorTitle(code)
      const body = formatNetworkErrorMessage(func, code, message)
      app.config.globalProperties.$toast.add({
        severity: 'error',
        summary: title,
        detail: body,
        life: life ?? 0 // Error toasts stay until user closes them
      })
    }
  }
})
