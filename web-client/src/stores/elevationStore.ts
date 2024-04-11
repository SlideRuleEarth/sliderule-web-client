import { defineStore } from 'pinia';
import { type Elevation } from '@/composables/db';

export const useElevationStore = defineStore('elevation', {
    state: () => ({
        min: 100000,
        max: -100000,
        recs: [] as Elevation[]
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