import { defineStore } from 'pinia';

export const useElevationStore = defineStore('elevation', {
    state: () => ({
        min: 0,
        max: 300,
    }),
    actions: {
        setMin(min: number) {
            this.min = min;
        },
        setMax(max: number) {
            this.max = max;
        },
        getMin() {
            return this.min;
        },
        getMax() {
            return this.max;
        },
    },
});