import { defineStore } from 'pinia';
import { type ElevationData } from '@/composables/SrMapUtils';

export const useElevationStore = defineStore('elevation', {
    state: () => ({
        min: 10000,
        max: -10000,
        recs: [] as ElevationData[]
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
        pushRecs(flat_recs: ElevationData[]) {
            this.recs.push(...flat_recs);
        },
        clearRecs() {
            this.recs = [];
        }

    },
});