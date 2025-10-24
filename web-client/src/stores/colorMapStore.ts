import { defineStore } from 'pinia';
import { db } from '@/db/SlideRuleDb';

export const useColorMapStore = defineStore('colorMapStore', {
    state: () => ({
        isInitialized: false as boolean,
        namedColorPalette: [] as string[],
        debugCnt: 0 as number,
    }),
    getters: {
        getDebugCnt(): number {
            return this.debugCnt;
        },    
    },
    actions: {
        async initializeColorMapStore() {
            //console.log('initializeColorMapStore isInitialized:',this.isInitialized);
            if(!this.isInitialized){
                this.isInitialized = true;
                this.namedColorPalette = await db.getAllColors();
            }
        },

        setDebugCnt(debugCnt: number) {
            this.debugCnt = debugCnt;
        },
        incrementDebugCnt(): number {
            this.debugCnt += 1;
            return this.debugCnt;
        },
        // },
        async setNamedColorPalette(namedColorPalette: string[]) {
            this.namedColorPalette = namedColorPalette;
            await db.setAllColors(namedColorPalette)
        },
        getNamedColorPalette() {
            //console.log('getNamedColorPalette:',this.namedColorPalette)
            return this.namedColorPalette;
        },

        async restoreDefaultColors() {
            await db.restoreDefaultColors();
            this.namedColorPalette = await db.getAllColors();
        },

    },
});

// Automatically call initialize when the store is first used
const store = useColorMapStore();
void store.initializeColorMapStore();