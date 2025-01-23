import { defineStore } from 'pinia';
import colormap  from 'colormap';
import { db } from '@/db/SlideRuleDb';

export const useAtl03ColorMapStore = defineStore('atl03ColorMap', {
    state: () => ({
        isInitialized: false as boolean,
        selectedAtl03YapcColorMapName: 'viridis' as string,
        numShadesForAtl03Yapc: 256 as number,
        atl03YapcColorMap: [] as string[],
        atl03CnfOptions: [
            {label:'atl03_tep',value:-2}, 
            {label:'atl03_not_considered',value:-1}, 
            {label:'atl03_background',value:0}, 
            {label:'atl03_within_10m',value:1}, 
            {label:'atl03_low',value:2}, 
            {label:'atl03_medium',value:3}, 
            {label:'atl03_high',value:4}
        ] as {label:string,value:number}[],
        atl08ClassOptions: [
            {label:'atl08_noise',value:0}, 
            {label:'atl08_ground',value:1}, 
            {label:'atl08_canopy',value:2}, 
            {label:'atl08_top_of_canopy',value:3}, 
            {label:'atl08_unclassified',value:4}
        ] as {label:string,value:number}[],
        atl03CnfColorMap: [] as string[],
        atl08ClassColorMap: [] as string[],
        namedColorPalette: [] as string[],
        dataOrderNdx: {} as Record<string, number>,
        debugCnt: 0 as number,
    }),
    getters: {
        getDimensions(state): string[] {
            return Object.keys(state.dataOrderNdx).sort((a, b) => {
                const aValue = state.dataOrderNdx[a];
                const bValue = state.dataOrderNdx[b];
                return aValue - bValue;
            });
        },
        getDataOrderNdx(): Record<string, number> {
            return this.dataOrderNdx;
        },    
        getDebugCnt(): number {
            return this.debugCnt;
        },    
    },
    actions: {
        async initializeAtl03ColorMapStore() {
            //console.log('initializeAtl03ColorMapStore isInitialized:',this.isInitialized);
            if(!this.isInitialized){
                this.isInitialized = true;
                this.atl03CnfColorMap = await db.getAllAtl03CnfColors();
                this.atl08ClassColorMap = await db.getAllAtl08ClassColors();
                const plotConfig = await db.getPlotConfig();
                if(plotConfig){
                    this.selectedAtl03YapcColorMapName = plotConfig.defaultYapcColorMapName;
                    this.numShadesForAtl03Yapc = plotConfig.defaultYapcNumShades;
                }
                this.namedColorPalette = await db.getAllColors();
            }
        },
        setSelectedAtl03YapcColorMapName(atl03YapcColorMap: string) {
            this.selectedAtl03YapcColorMapName = atl03YapcColorMap;
        },
        getSelectedAtl03YapcColorMapName() {
            return this.selectedAtl03YapcColorMapName;
        },
        setNumShadesForAtl03Yapc(numShades: number) {
            this.numShadesForAtl03Yapc = numShades;
        },
        getNumShadesForAtl03Yapc() {
            return this.numShadesForAtl03Yapc;
        },
        updateAtl03YapcColorMapValues() {
            try {
              const colorArray = colormap({
                colormap: this.selectedAtl03YapcColorMapName,
                nshades: this.numShadesForAtl03Yapc,
                format: 'rgba',
                alpha: 1
              });
              
              // Convert from [r, g, b, a] to 'rgba(r,g,b,a)'
              this.atl03YapcColorMap = colorArray.map(
                ([r, g, b, a]) => `rgba(${r}, ${g}, ${b}, ${a})`
              );
            } catch (error) {
              console.error('updateAtl03YapcColorMapValues error:', error);
              throw error;
            }
          },
        getAtl03YapcColorMap() {
            return this.atl03YapcColorMap;
        },
        getYapcColorForValue(value:number, minValue:number, maxValue:number):string {
            // Normalize the value to a value between 0 and 255
            const normalizedValue = Math.floor(((value - minValue) / (maxValue - minValue)) * this.numShadesForAtl03Yapc-1);
            // Clamp the value to ensure it's within the valid range
            const colorIndex = Math.max(0, Math.min(this.numShadesForAtl03Yapc-1, normalizedValue));
            // Return the color from the selected colormap
            const c = this.atl03YapcColorMap[colorIndex];
            // if(this.debugCnt++ < 10){
            //     console.log('getYapcColorForValue:',value,minValue,maxValue,normalizedValue,colorIndex,c);
            // }
            return c;
        },
        createGradientColorFunction(ndx_name:string,minValue: number, maxValue: number) {
            const range = maxValue - minValue;
            const scale = (this.numShadesForAtl03Yapc - 1) / range;
            let ndx:number = -1;
          
            return (params:any) => {
                if(ndx<0){
                    ndx = this.getDataOrderNdx[ndx_name]
                }
                const value = params.data[ndx];
                // Clamp quickly
                if (value <= minValue) return this.atl03YapcColorMap[0];
                if (value >= maxValue) return this.atl03YapcColorMap[this.numShadesForAtl03Yapc - 1];
                const colorIndex = Math.floor((value - minValue) * scale);
                return this.atl03YapcColorMap[colorIndex];
            }
        },
        getColorGradientStyle() {
            //console.log('getColorGradientStyle');
            return {
                background: `linear-gradient(to right, ${this.atl03YapcColorMap})`,
                height: '10px', // Adjust the height as needed
                width: '100%',  // Adjust the width as needed
            };
        },
        setDebugCnt(debugCnt: number) {
            this.debugCnt = debugCnt;
        },
        incrementDebugCnt(): number {
            this.debugCnt += 1;
            return this.debugCnt;
        },
        setCnfColorMap(rgbColorMap: string[]) {
            this.atl03CnfColorMap = rgbColorMap;
        },
        getCnfColorMap() {
            return this.atl03CnfColorMap;
        },
        getColorForAtl03CnfValue(value:number) { // value is the atl03_cnf value -2 to 4
            const ndx = value + 2;
            if(ndx < 0 || ndx > 6){
                if(this.debugCnt++ < 10){
                    console.error('getColorForAtl03CnfValue invalid value:',value);
                }
                return 'White'; // Return White for invalid values
            }
            const c = this.atl03CnfColorMap[ndx];
            return c;
        },
        async setColorForAtl03CnfValue(value:number,namedColorValue:string) { // value is the atl03_cnf value -2 to 4
            const ndx = value + 2;
            if(ndx < 0 || ndx > 6){
                console.error('setColorForAtl03CnfValue invalid value:',value);
                return;
            }
            this.atl03CnfColorMap[ndx] = namedColorValue;
            await db.addOrUpdateAtl03CnfColor(value,namedColorValue);
        },
        getColorForAtl08ClassValue(value:number) { // value is the atl08_class value 0 to 4
            const ndx = value;
            if(ndx < 0 || ndx > 4){
                console.error('getRGBColorForAtl08ClassValue invalid value:',value);
                return 'White'; // Return White for invalid values
            }
            const c = this.atl08ClassColorMap[ndx];
            return c;
        },
        async setColorForAtl08ClassValue(value:number,namedColorValue:string) { // value is the atl08_class value 0 to 4
            const ndx = value;
            if(ndx < 0 || ndx > 4){
                console.error('setColorForAtl08ClassValue invalid value:',value);
                return;
            }
            this.atl08ClassColorMap[ndx] = namedColorValue;
            await db.addOrUpdateAtl08ClassColor(value,namedColorValue);
        },
        async setNamedColorPalette(namedColorPalette: string[]) {
            this.namedColorPalette = namedColorPalette;
            await db.setAllColors(namedColorPalette)
        },
        getNamedColorPalette() {
            //console.log('getNamedColorPalette:',this.namedColorPalette)
            return this.namedColorPalette;
        },
        async restoreDefaultAtl03CnfColorMap() {
            await db.restoreDefaultAtl03CnfColors();
            this.atl03CnfColorMap = await db.getAllAtl03CnfColors();
        },
        async restoreDefaultAtl08ClassColorMap() {
            await db.restoreDefaultAtl08ClassColors();
            this.atl03CnfColorMap = await db.getAllAtl08ClassColors();
        },
        async restoreDefaultYapcColorMap() {
            await db.restoreDefaultYapcColorMap();
            const plotConfig = await db.getPlotConfig();
            if(plotConfig){
                this.selectedAtl03YapcColorMapName = plotConfig.defaultYapcColorMapName;
                this.numShadesForAtl03Yapc = plotConfig.defaultYapcNumShades;
            } else {
                console.error('restoreDefaultYapcColorMap no plotConfig');
            }
        },
        async restoreDefaultColors() {
            await db.restoreDefaultColors();
            this.namedColorPalette = await db.getAllColors();
        },
        setDataOrderNdx(dataOrderNdx: Record<string, number>) {
            this.dataOrderNdx = dataOrderNdx;
        },
    },
});