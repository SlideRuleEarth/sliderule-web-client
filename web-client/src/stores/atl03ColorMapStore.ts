import { defineStore } from 'pinia';
import colormap  from 'colormap';
import { db } from '@/db/SlideRuleDb';

export const useAtl03ColorMapStore = defineStore('atl03ColorMap', {
    state: () => ({
        isInitialized: false as boolean,
        selectedAtl03YapcColorMapName: 'viridis' as string,
        numShadesForAtl03Yapc: 1024 as number,
        atl03YapcColorMap: [] as[number, number, number, number][],
        atl03ColorKey: 'atl03_cnf' as string,
        atl03ColorKeyOptions: ['YAPC','atl03_cnf','atl08_class'] as string[],
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
        }    
    },
    actions: {
        async initializeAtl03ColorMapStore() {
            //console.log('initializeAtl03ColorMapStore isInitialized:',this.isInitialized);
            if(!this.isInitialized){
                this.isInitialized = true;
                this.atl03CnfColorMap = await db.getAllAtl03CnfColors();
                this.atl08ClassColorMap = await db.getAllAtl08ClassColors();
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
        updateAtl03YapcColorMapValues()
        {
            try{
                this.atl03YapcColorMap = colormap({
                    colormap: this.selectedAtl03YapcColorMapName, // Use the selected colormap
                    nshades: this.numShadesForAtl03Yapc, // Number of shades in the colormap
                    format: 'rgba', // Use RGBA format for alpha transparency
                    alpha: 1 // Fully opaque
                });
            } catch (error) {
                console.warn('updateAtl03YapcColorMapValues this.selectedAtl03YapcColorMap:',this.selectedAtl03YapcColorMapName);
                console.warn('updateAtl03YapcColorMapValues this.numShadesForAtl03Yapc:',this.numShadesForAtl03Yapc);
                console.error('updateAtl03YapcColorMapValues error:',error);
                throw error;
            }
            //console.log('selectedAtl03YapcColorMap:',this.selectedAtl03YapcColorMap);
            //console.log('atl03YapcColorMap:',this.atl03YapcColorMap);   
        },
        getAtl03YapcColorMap() {
            return this.atl03YapcColorMap;
        },
        getYapcColorForValue(value:number, minValue:number, maxValue:number) {
            // Normalize the value to a value between 0 and 255
            const normalizedValue = Math.floor(((value - minValue) / (maxValue - minValue)) * this.numShadesForAtl03Yapc-1);
            // Clamp the value to ensure it's within the valid range
            const colorIndex = Math.max(0, Math.min(this.numShadesForAtl03Yapc-1, normalizedValue));
            // Return the color from the selected colormap
            const c = this.atl03YapcColorMap[colorIndex];
            if(this.debugCnt++ < 10){
                console.log('getYapcColorForValue:',value,minValue,maxValue,normalizedValue,colorIndex,c);
            }
            return c;
        },
        getColorGradientStyle() {
            //console.log('getColorGradientStyle');
            const gradientColors = this.atl03YapcColorMap
                .map(color => `rgba(${color.join(',')})`) // Convert each color to a valid CSS rgba string
                .join(', '); // Join colors to create a CSS gradient string
            return {
                background: `linear-gradient(to right, ${gradientColors})`,
                height: '10px', // Adjust the height as needed
                width: '100%',  // Adjust the width as needed
            };
        },
        setAtl03ColorKey(atl03ColorKey: string) {
            this.atl03ColorKey = atl03ColorKey;
        },
        getAtl03ColorKey() {
            return this.atl03ColorKey;
        },
        getAtl03ColorKeyOptions() {
            return this.atl03ColorKeyOptions;
        },
        setDebugCnt(debugCnt: number) {
            this.debugCnt = debugCnt;
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
        async restoreDefaultColors() {
            await db.restoreDefaultColors();
            this.namedColorPalette = await db.getAllColors();
        },
        setDataOrderNdx(dataOrderNdx: Record<string, number>) {
            this.dataOrderNdx = dataOrderNdx;
        },
    },
});