import { defineStore } from 'pinia'

export const useAuthDialogStore = defineStore('authDialog', {
  state: () => ({
    visible: false
  }),
  actions: {
    show() {
      this.visible = true
    },
    hide() {
      this.visible = false
    }
  }
})
