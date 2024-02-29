import { defineStore } from 'pinia';

export const useElevationStore = defineStore('elevation', {
    state: () => ({
        min: 10000,
        max: -10000,
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