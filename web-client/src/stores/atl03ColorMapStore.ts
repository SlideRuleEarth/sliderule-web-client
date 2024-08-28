import { defineStore } from 'pinia';
import colormap  from 'colormap';

export const useAtl03ColorMapStore = defineStore('atl03ColorMap', {
    state: () => ({
        selectedAtl03ColorMap: 'viridis' as string,
        numShadesForAtl03: 1024 as number,
        atl03ColorMap: [] as[number, number, number, number][],
    }),
    actions: {
        setAtl03ColorMap(atl03ColorMap: string) {
            this.selectedAtl03ColorMap = atl03ColorMap;
        },
        getSelectedAtl03ColorMap() {
            return this.selectedAtl03ColorMap;
        },
        setNumShadesForAtl03(numShades: number) {
            this.numShadesForAtl03 = numShades;
        },
        getNumShadesForAtl03() {
            return this.numShadesForAtl03;
        },
        getNumOfAtl03ShadesOptions() {
            return [{name:'1024', value:'1024'},{name:'512', value:'512'},{name:'256', value:'256'}];
        },
        updateAtl03ColorMapValues()
        {
            try{
                this.atl03ColorMap = colormap({
                    colormap: this.selectedAtl03ColorMap, // Use the selected colormap
                    nshades: this.numShadesForAtl03, // Number of shades in the colormap
                    format: 'rgba', // Use RGBA format for alpha transparency
                    alpha: 1 // Fully opaque
                });
            } catch (error) {
                console.warn('updateAtl03ColorMapValues this.selectedAtl03ColorMap:',this.selectedAtl03ColorMap);
                console.warn('updateAtl03ColorMapValues this.numShadesForAtl03:',this.numShadesForAtl03);
                console.error('updateAtl03ColorMapValues error:',error);
                throw error;
            }
            //console.log('selectedAtl03ColorMap:',this.selectedAtl03ColorMap);
            //console.log('atl03ColorMap:',this.atl03ColorMap);   
        },
        getAtl03ColorMap() {
            return this.atl03ColorMap;
        },
        getColorForValue(value:number, minValue:number, maxValue:number) {
            // Normalize the value to a value between 0 and 255
            const normalizedValue = Math.floor(((value - minValue) / (maxValue - minValue)) * this.numShadesForAtl03-1);
            // Clamp the value to ensure it's within the valid range
            const colorIndex = Math.max(0, Math.min(this.numShadesForAtl03-1, normalizedValue));
            // Return the color from the selected colormap
            const c = this.atl03ColorMap[colorIndex];
            //console.log('getColorForValue:',value,minValue,maxValue,normalizedValue,colorIndex,c);
            return c;
        },
        getColorGradientStyle() {
            console.log('getColorGradientStyle');
            const gradientColors = this.atl03ColorMap
                .map(color => `rgba(${color.join(',')})`) // Convert each color to a valid CSS rgba string
                .join(', '); // Join colors to create a CSS gradient string
            return {
                background: `linear-gradient(to right, ${gradientColors})`,
                height: '10px', // Adjust the height as needed
                width: '100%',  // Adjust the width as needed
            };
        }
    },
});