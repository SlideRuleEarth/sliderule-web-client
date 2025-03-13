import { defineStore } from 'pinia';
import { ref } from 'vue';
import { db } from '@/db/SlideRuleDb';
import colormap  from 'colormap';

/**
 * Factory function to create a unique store instance per reqId
 */
export function useGradientColorMapStore(reqIdStr: string) {
    const store = defineStore(`gradientColorMapStore-${reqIdStr}`, () => {
        const isInitialized = ref(false);
        const selectedGradientColorMapName = ref('viridis');
        const numShadesForGradient = ref(256);
        const gradientColorMap = ref<string[]>([]);
        let dataOrderNdx = {} as Record<string, number>;
        let debugCnt = 0;
        function initializeColorMapStore() {
            //console.log('gradientColorMapStore initializeColorMapStore isInitialized:',isInitialized.value);
            isInitialized.value = true;
            updateGradientColorMapValues();
        }
        function setSelectedGradientColorMapName(gradientColorMap: string):void {
            //console.log('setSelectedGradientColorMapName:',gradientColorMap);
            selectedGradientColorMapName.value = gradientColorMap;
            updateGradientColorMapValues();
        }

        function getSelectedGradientColorMapName():string {
            //console.log('getSelectedGradientColorMapName:',selectedGradientColorMapName.value);
            return selectedGradientColorMapName.value;
        }

        function setNumShadesForGradient(numShades: number) {
            //console.log('setNumShadesForGradient:',numShades);
            numShadesForGradient.value = Math.max(numShades, 10); //at least 10 shades
            updateGradientColorMapValues();
        }

        function getNumShadesForGradient():number {
            //console.log('getNumShadesForGradient:',numShadesForGradient.value);
            return numShadesForGradient.value;
        }

        function updateGradientColorMapValues():void {
            try {
              const colorArray = colormap({
                colormap: selectedGradientColorMapName.value,
                nshades: numShadesForGradient.value,
                format: 'rgba',
                alpha: 1
              });
              
              // Convert from [r, g, b, a] to 'rgba(r,g,b,a)'
              gradientColorMap.value = colorArray.map(
                ([r, g, b, a]) => `rgba(${r}, ${g}, ${b}, ${a})`
              );
            } catch (error) {
              console.error(`updateGradientColorMapValues ${reqIdStr} error:`, error);
              throw error;
            }
            //console.log(`updateGradientColorMapValues ${reqIdStr}:`,selectedGradientColorMapName.value,numShadesForGradient.value);
        }

        function getGradientColorMap():string[] {
            //console.log(`getGradientColorMap ${reqIdStr}:`,gradientColorMap.value);
            return gradientColorMap.value;
        }

        // function getGradientColorForValue(value:number, minValue:number, maxValue:number):string {
        //     // Normalize the value to a value between 0 and 255
        //     const normalizedValue = Math.floor(((value - minValue) / (maxValue - minValue)) * numShadesForGradient.value-1);
        //     // Clamp the value to ensure it's within the valid range
        //     const colorIndex = Math.max(0, Math.min(numShadesForGradient.value-1, normalizedValue));
        //     // Return the color from the selected colormap
        //     const c = gradientColorMap.value[colorIndex];
        //     if(debugCnt++ < 10){
        //         console.log(`getGradientColorForValue ${reqIdStr}:`,value,minValue,maxValue,normalizedValue,colorIndex,c);
        //     }
        //     return c;
        // }

        function getDimensions(): string[] {
            return Object.keys(dataOrderNdx).sort((a, b) => {
                const aValue = dataOrderNdx[a];
                const bValue = dataOrderNdx[b];
                return aValue - bValue;
            });
        }

        function createGradientColorFunction(ndx_name:string,minValue: number, maxValue: number) {
            const range = maxValue - minValue;
            const scale = (numShadesForGradient.value - 1) / range;
            let ndx:number = -1;
            //console.log(`createGradientColorFunction ${reqIdStr}:`,ndx_name,minValue,maxValue,range,scale);
            return (params:any) => {
                if(ndx<0){
                    ndx = dataOrderNdx[ndx_name]
                }
                const value = params.data[ndx];
                // Clamp quickly
                if (value <= minValue) return gradientColorMap.value[0];
                if (value >= maxValue) return gradientColorMap.value[numShadesForGradient.value - 1];
                const colorIndex = Math.floor((value - minValue) * scale);
                const color = gradientColorMap.value[colorIndex];
                // if(debugCnt++ < 10){
                //     console.log(`createGradientColorFunction ${reqIdStr} params:`,params);
                //     console.log(`createGradientColorFunction ${reqIdStr} dataOrderNdx:`,dataOrderNdx);
                //     console.log(`createGradientColorFunction ${reqIdStr} ndx:`,ndx, 'ndx_name:',ndx_name,'value:',value,'colorIndex:',colorIndex, 'color:',color);
                // }
                return color;
            }
        }

        function getColorGradientStyle() {
            //console.log('getColorGradientStyle');
            return {
                background: `linear-gradient(to right, ${gradientColorMap.value})`,
                height: '10px', // Adjust the height as needed
                width: '100%',  // Adjust the width as needed
            };
        }

        async function restoreDefaultGradientColorMap() {
            await db.restoreDefaultGradientColorMap();
            const plotConfig = await db.getPlotConfig();
            if(plotConfig){
                selectedGradientColorMapName.value = plotConfig.defaultGradientColorMapName;
                numShadesForGradient.value = plotConfig.defaultGradientNumShades;
            } else {
                console.error(`getGradientColorMap ${reqIdStr}: restoreDefaultGradientColorMap no plotConfig`);
            }
        }

        function setDataOrderNdx(thisDataOrderNdx: Record<string, number>) {
            dataOrderNdx = thisDataOrderNdx;
        }

        function getDataOrderNdx(): Record<string, number> {
            return dataOrderNdx;
        }

        return {
            isInitialized,
            selectedGradientColorMapName,
            numShadesForGradient,
            gradientColorMap,
            setSelectedGradientColorMapName,
            getSelectedGradientColorMapName,
            setNumShadesForGradient,
            getNumShadesForGradient,
            updateGradientColorMapValues,
            getGradientColorMap,
            getDimensions,
            getDataOrderNdx,
            setDataOrderNdx,
            createGradientColorFunction,
            getColorGradientStyle,
            restoreDefaultGradientColorMap,
            initializeColorMapStore,
        };
    })();
    store.initializeColorMapStore();
    return store;
}
