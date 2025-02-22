import { defineStore } from 'pinia';
import { ref } from 'vue';
import { db } from '@/db/SlideRuleDb';

/**
 * Factory function to create a unique store instance per reqId
 */
export async function useAtl08ClassColorMapStore(reqIdStr: string) {
    const store = defineStore(`atl08ClassStore-${reqIdStr}`, () => {
        const isInitialized = ref(false);
        const dataOrderNdx =  ref<Record<string, number>>({});
        const atl08ClassColorMap = ref([] as string[]);
        const atl08ClassOptions = [
            {label:'atl08_noise',value:0}, 
            {label:'atl08_ground',value:1}, 
            {label:'atl08_canopy',value:2}, 
            {label:'atl08_top_of_canopy',value:3}, 
            {label:'atl08_unclassified',value:4}
        ] as {label:string,value:number}[];

        async function initializeColorMapStore() {
            isInitialized.value = true;
            atl08ClassColorMap.value = await db.getAllAtl08ClassColors();
        }


        function getDimensions(): string[] {
            return Object.keys(dataOrderNdx.value).sort((a, b) => {
                const aValue = dataOrderNdx.value[a];
                const bValue = dataOrderNdx.value[b];
                return aValue - bValue;
            });
        }
        function getDataOrderNdx(): Record<string, number> {
            return dataOrderNdx.value;
        }

        function setDataOrderNdx(dataOrderNdxObj: Record<string, number>) {
            dataOrderNdx.value = dataOrderNdxObj;
        }

        function createDiscreteColorFunction(
            getColorFunction: (value: number) => string,
            ndx_name: string
        ){
            const colorCache: Record<number, string> = {};
            let ndx: number = -1;
            const colorFunction = (params: any) => {
                if (ndx < 0) {
                    ndx = dataOrderNdx.value[ndx_name];
                }
                const value = params.data[ndx];
                if (colorCache[value] === undefined) {
                    colorCache[value] = getColorFunction(value);
                }
                return colorCache[value];
            };

            // Function to clear the cache
            colorFunction.resetCache = () => {
                Object.keys(colorCache).forEach(key => delete colorCache[Number(key)]);
                ndx = -1; // Reset index so it is recalculated
                console.log(`Cache for ${ndx_name} reset.`);
            };

            return colorFunction;
        }

        const getColorForAtl08ClassValue = (value:number) => { // value is the atl08_class value 0 to 4
            const ndx = value;
            if(ndx < 0 || ndx > 4){
                console.error('getRGBColorForAtl08ClassValue invalid value:',value);
                return 'White'; // Return White for invalid values
            }
            const c = atl08ClassColorMap.value[ndx];
            return c;
        }; 

        const getAtl08ClassColorCached = createDiscreteColorFunction(
            getColorForAtl08ClassValue,
            'atl08_class'
        );

        function getColorUsingAtl08_class(params: any): string {
            return getAtl08ClassColorCached(params);
        }

        function resetAtl08ClassColorCaches() {
            getAtl08ClassColorCached.resetCache();
        }

        async function restoreDefaultAtl08ClassColorMap() {
            await db.restoreDefaultAtl08ClassColors();
            atl08ClassColorMap.value = await db.getAllAtl08ClassColors();
        }

        async function setColorForAtl08ClassValue(value:number,namedColorValue:string) { // value is the atl08_class value 0 to 4
            const ndx = value;
            if(ndx < 0 || ndx > 4){
                console.error('setColorForAtl08ClassValue invalid value:',value);
                return;
            }
            atl08ClassColorMap.value[ndx] = namedColorValue;
            await db.addOrUpdateAtl08ClassColor(value,namedColorValue);
        }

        return {
            dataOrderNdx,
            getDimensions,
            getDataOrderNdx,
            setDataOrderNdx,
            getAtl08ClassColorCached,
            getColorUsingAtl08_class,
            resetAtl08ClassColorCaches,
            restoreDefaultAtl08ClassColorMap,
            setColorForAtl08ClassValue,
            getColorForAtl08ClassValue,
            atl08ClassOptions,
            initializeColorMapStore,
        };
    })();

    await store.initializeColorMapStore();
    return store;

}