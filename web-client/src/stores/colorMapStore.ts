import { defineStore } from 'pinia';
import colormap  from 'colormap';

export const useColorMapStore = defineStore('colorMap', {
    state: () => ({
        elevationColorMap: 'viridis' as string,
        numShadesForElevation: 1024 as number,
        colorMap: [] as[number, number, number, number][],
    }),
    actions: {
        setElevationColorMap(colorMap: string) {
            this.elevationColorMap = colorMap;
        },
        getElevationColorMap() {
            return this.elevationColorMap;
        },
        setNumShadesForElevation(numShades: number) {
            this.numShadesForElevation = numShades;
        },
        getNumShadesForElevation() {
            return this.numShadesForElevation;
        },
        getNumOfElevationShadesOptions() {
            return [{name:'1024', value:'1024'},{name:'512', value:'512'},{name:'256', value:'256'}];
        },
        updateColorMapValues()
        {
            try{
                this.colorMap = colormap({
                    colormap: this.elevationColorMap, // Use the selected colormap
                    nshades: this.numShadesForElevation, // Number of shades in the colormap
                    format: 'rgba', // Use RGBA format for alpha transparency
                    alpha: 1 // Fully opaque
                });
            } catch (error) {
                console.warn('updateColorMapValues this.elevationColorMap:',this.elevationColorMap);
                console.warn('updateColorMapValues this.numShadesForElevation:',this.numShadesForElevation);
                console.error('updateColorMapValues error:',error);
                throw error;
            }
            //console.log('elevationColorMap:',this.elevationColorMap);
            //console.log('colorMap:',this.colorMap);   
        },
        getColorMap() {
            return this.colorMap;
        },
        getColorForElevation(elevation:number, minElevation:number, maxElevation:number) {
            // Normalize the elevation to a value between 0 and 255
            const normalizedValue = Math.floor(((elevation - minElevation) / (maxElevation - minElevation)) * this.numShadesForElevation-1);
            // Clamp the value to ensure it's within the valid range
            const colorIndex = Math.max(0, Math.min(this.numShadesForElevation-1, normalizedValue));
            // Return the color from the selected colormap
            const c = this.colorMap[colorIndex];
            //console.log('getColorForElevation:',elevation,minElevation,maxElevation,normalizedValue,colorIndex,c);
            return c;
        },
        getColorGradientStyle() {
            console.log('getColorGradientStyle');
            const gradientColors = this.colorMap
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