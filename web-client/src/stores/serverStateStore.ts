import { defineStore } from 'pinia'
import { ref } from 'vue'

export const useServerStateStore = defineStore('serverStateStore', () => {
    
    const isFetching = ref<boolean>(false);
    const isAborting = ref<boolean>(false);



    return {
        isFetching,
        isAborting,
    }
});
