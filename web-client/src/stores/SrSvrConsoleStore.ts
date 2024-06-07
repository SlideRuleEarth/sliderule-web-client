import { defineStore } from 'pinia';

export const useSrSvrConsoleStore = defineStore('SrSvrConsoleStore', {
  state: () => ({
    lines: [] as string[],
  }),
  actions: {
    addLine(line: string) {
      this.lines.push(line);
    },
  },
});
