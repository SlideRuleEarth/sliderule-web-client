import { defineStore } from 'pinia';

export const useElevationStore = defineStore('elevation', {
    state: () => ({
        min: 100000,
        max: -100000,
        num_recs: 0,
        req_id: 0,
        duration: 0,
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
        setNumRecs(num_recs: number) {
            this.num_recs = num_recs;
        },
        addNumRecs(num_recs: number) {
            this.num_recs += num_recs;
        },
        getNumRecs() {
            return this.num_recs;
        }
    },
});