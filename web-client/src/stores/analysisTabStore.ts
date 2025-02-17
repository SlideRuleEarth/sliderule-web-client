import { defineStore } from 'pinia';
import { ref, computed } from 'vue';

export const useAnalysisTabStore = defineStore('analysisTabStore', () => {
    const tabLabels: string[] = ['Elevation Plot', 'Time Series', 'Table'];
    const activeTab = ref<string>('0'); // Store activeTab as a string

    // Getter: Get the active tab index as a string
    const getActiveTab = computed<string>(() => activeTab.value);

    // Setter: Set the active tab index safely
    const setActiveTab = (index: string): void => {
        const numericIndex = parseInt(index, 10);
        if (!isNaN(numericIndex) && numericIndex >= 0 && numericIndex < tabLabels.length) {
            activeTab.value = index;
        } else {
            console.warn(`Invalid tab index: ${index}`);
        }
    };

    // Get label of the active tab
    const getActiveTabLabel = computed<string | null>(() => {
        const index = parseInt(activeTab.value, 10);
        return tabLabels[index] ?? null; // Return null if index is out of bounds
    });

    // Get label for a specific tab index
    const getTabLabelByIndex = (index: string): string | null => {
        const numericIndex = parseInt(index, 10);
        return tabLabels[numericIndex] ?? null;
    };

    return {
        activeTab,
        getActiveTab,
        setActiveTab,
        getActiveTabLabel,
        getTabLabelByIndex,
    };
});
