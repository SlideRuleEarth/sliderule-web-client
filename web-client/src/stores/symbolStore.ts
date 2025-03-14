import { defineStore } from 'pinia'
import { ref } from 'vue'

export const useSymbolStore = defineStore('symbolStore', () => {
    const size = ref<Record<string,number>>({});
    function setSize(symbol: string, sizeValue: number) {
        size.value[symbol] = sizeValue;
    }
    function getSize(symbol: string) {
        return size.value[symbol] ?? 0;
    }
    return {
        size,
        setSize,
        getSize,
    }
});