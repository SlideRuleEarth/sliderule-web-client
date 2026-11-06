import { defineStore } from 'pinia'

export type ReqMsgSeverity = 'info' | 'success' | 'warn' | 'error' | 'server'

export interface ReqMsgEntry {
  id: number
  time: Date
  severity: ReqMsgSeverity
  summary: string
  detail: string
}

const MAX_ENTRIES = 500
let nextId = 1

/**
 * Message log shown in the Request page's left panel, newest first.
 * Holds feedback that would otherwise pop up on the Request page, plus server messages.
 */
export const useReqMsgLogStore = defineStore('reqMsgLog', {
  state: () => ({
    entries: [] as ReqMsgEntry[]
  }),
  actions: {
    add(severity: ReqMsgSeverity, summary: string, detail: string = '') {
      this.entries.unshift({ id: nextId++, time: new Date(), severity, summary, detail })
      if (this.entries.length > MAX_ENTRIES) {
        this.entries.length = MAX_ENTRIES
      }
    },
    clear() {
      this.entries = []
    }
  }
})
