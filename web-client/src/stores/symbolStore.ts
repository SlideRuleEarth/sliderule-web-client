import { defineStore } from 'pinia'
import { ref } from 'vue'

export const useSymbolStore = defineStore('symbolStore', () => {
    const size = ref<Record<string,number>>({});
    const savedSize = ref<Record<string,number>>({});
    function setSize(recIdStr: string, sizeValue: number) {
        size.value[recIdStr] = sizeValue;
    }
    function getSize(symbol: string) {
        return size.value[symbol] ?? 0;
    }
    function saveSize(recIdStr: string) {
        savedSize.value[recIdStr] = size.value[recIdStr];
    }
    function getSavedSize(recIdStr: string) {
        return savedSize.value[recIdStr] ?? 0;
    }
    function restoreSize(recIdStr: string) {
        size.value[recIdStr] = savedSize.value[recIdStr];
    }
    return {
        size,
        setSize,
        getSize,
        saveSize,
        getSavedSize,
        restoreSize,
    }
});