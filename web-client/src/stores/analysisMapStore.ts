import { defineStore } from 'pinia';

export const useAnalysisMapStore = defineStore('analysisMapStore', {
    state: () => ({
        isLoading: false,
        isAborting: false,

    }),
    actions: {
        setIsLoading(isLoading: boolean) {
            this.isLoading = isLoading;
        },
        getIsLoading() {
            return this.isLoading;
        },
        setIsAborting(isAborting: boolean) {
            this.isAborting = isAborting;
        },
        getIsAborting() {
            return this.isAborting;
        },
    },
});