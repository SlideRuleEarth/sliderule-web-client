import { defineStore } from 'pinia';
import { ref, computed } from 'vue';

export const useActiveTabStore = defineStore('activeTabStore', () => {
    const tabLabels: string[] = ['Elevation Plot', 'Time Series', 'Table', '3-D View'];
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
    const activeTabLabel = computed<string | null>(() => {
        const index = parseInt(activeTab.value, 10);
        return tabLabels[index] ?? null; // Return null if index is out of bounds
    });

    // Get label for a specific tab index
    const getTabLabelByIndex = (index: string): string | null => {
        const numericIndex = parseInt(index, 10);
        return tabLabels[numericIndex] ?? null;
    };

    const isActiveTabTimeSeries = computed(() => {
        return activeTab.value === '1';
    });

    const isElevationPlot = computed(() => {
        return activeTab.value === '0';
    });
    
    // Check if the active tab’s label matches the given string
    const isActiveTabLabel = (label: string): boolean => {
        // you can choose to do case‐insensitive compare if you like:
        const isMatch = activeTabLabel.value === label;
        //console.log('isActiveTabLabel isMatch:', isMatch,'isActiveTabLabel:', activeTabLabel.value, 'label:', label);
        return isMatch;
        // or for case‐insensitive:
        // return activeTabLabel.value?.toLowerCase() === label.toLowerCase();
    };

    return {
        activeTab,
        getActiveTab,
        setActiveTab,
        activeTabLabel,
        getTabLabelByIndex,
        isActiveTabTimeSeries,
        isActiveTabLabel,
        isElevationPlot,
    };
});
