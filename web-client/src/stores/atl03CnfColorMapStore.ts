import { defineStore } from 'pinia';
import { ref } from 'vue';
import { db } from '@/db/SlideRuleDb';


/**
 * Factory function to create a unique store instance per reqId
 */
export async function useAtl03CnfColorMapStore(reqIdStr: string) {
    const store = defineStore(`atl03CnfStore-${reqIdStr}`, () => {
        const isInitialized = ref(false);
        let debugCnt = 0;
        let dataOrderNdx = {} as Record<string, number>;
        const atl03CnfColorMap = ref([] as string[]);
        const atl03CnfOptions = [
            {label:'atl03_tep',value:-2}, 
            {label:'atl03_not_considered',value:-1}, 
            {label:'atl03_background',value:0}, 
            {label:'atl03_within_10m',value:1}, 
            {label:'atl03_low',value:2}, 
            {label:'atl03_medium',value:3}, 
            {label:'atl03_high',value:4}
        ] as {label:string,value:number}[];
        const colorCache: Record<number, string> = {};
        let ndx: number = -1;

        async function initializeColorMapStore() {
            isInitialized.value = true;
            atl03CnfColorMap.value = await db.getAllAtl03CnfColors();
        }

        function getDimensions(): string[] {
            return Object.keys(dataOrderNdx).sort((a, b) => {
                const aValue = dataOrderNdx[a];
                const bValue = dataOrderNdx[b];
                return aValue - bValue;
            });
        }
        function getDataOrderNdx(): Record<string, number> {
            return dataOrderNdx;
        }

        function setDataOrderNdx(dataOrderNdxObj: Record<string, number>) {
            dataOrderNdx = dataOrderNdxObj;
        }

        function cachedColorFunction(params: any){
            if (ndx < 0) {
                // the index can change so look it up 
                ndx = dataOrderNdx['atl03_cnf']
                //console.log('cachedColorFunction :','ndx:',ndx,'dataOrderNdx:',dataOrderNdx);
            }
            const value = params.data[ndx];//grab the atl03_cnf value from the data array using the dataOrderNdx
            if (colorCache[value] === undefined) {
                colorCache[value] = getColorForAtl03CnfValue(value);
                // if(debugCnt<10){
                //     console.log('cachedColorFunction :','ndx:',ndx,'value:',value,'colorCache:',colorCache);
                // }
            }
            // if(debugCnt++<10){
            //     console.log('cachedColorFunction params:',params,'ndx:',ndx,'value:',value,'colorCache:',colorCache);
            // }
            return colorCache[value];
        };


        function getColorForAtl03CnfValue(value:number) { // value is the atl03_cnf value -2 to 4
            const ndx = value + 2;
            if(ndx < 0 || ndx > 6){
                return 'White'; // Return White for invalid values
            }
            const c = atl03CnfColorMap.value[ndx];
            return c;
        };


        async function restoreDefaultAtl03CnfColorMap() {
            await db.restoreDefaultAtl03CnfColors();
            atl03CnfColorMap.value = await db.getAllAtl03CnfColors();
        }

        async function setColorForAtl03CnfValue(value:number,namedColorValue:string) { // value is the atl03_cnf value -2 to 4
            const ndx = value + 2;
            if(ndx < 0 || ndx > 6){
                console.error('setColorForAtl03CnfValue invalid value:',value);
                return;
            }
            resetColorCache();
            atl03CnfColorMap.value[ndx] = namedColorValue;
            await db.addOrUpdateAtl03CnfColor(value,namedColorValue);
        }

        function resetColorCache() {
            //debugCnt = 0;
            Object.keys(colorCache).forEach(key => delete colorCache[Number(key)]);
            ndx = -1; // Reset index so it is recalculated
            console.log(`Cache for atl03_cnf reset.`);
        }

        return {
            dataOrderNdx,
            getDimensions,
            getDataOrderNdx,
            setDataOrderNdx,
            restoreDefaultAtl03CnfColorMap,
            setColorForAtl03CnfValue,
            getColorForAtl03CnfValue,
            cachedColorFunction,
            resetColorCache,
            atl03CnfOptions,
            atl03CnfColorMap,
            initializeColorMapStore,
        };
    })();
    await store.initializeColorMapStore();
    return store;
}