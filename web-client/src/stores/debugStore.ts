import { defineStore } from 'pinia';

export const useDebugStore = defineStore('debugStore', {
    state: () => ({
        enableSpotPatternDetails: true as boolean,
    }),
    actions: {
        setEnableSpotPatternDetails(enable:boolean= true) {
            this.enableSpotPatternDetails = enable;
        },
        getEnableSpotPatternDetails() {
            return this.enableSpotPatternDetails;
        }

    }
});