import { defineStore } from 'pinia';
import colormap  from 'colormap';

export const useColorMapStore = defineStore('colorMap', {
    state: () => ({
        elevationColorMap: 'viridis' as string,
        numShadesForElevation: 256 as number,
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
        updateColorMapValues()
        {
            this.colorMap = colormap({
                colormap: this.elevationColorMap, // Use the selected colormap
                nshades: this.numShadesForElevation, // Number of shades in the colormap
                format: 'rgba', // Use RGBA format for alpha transparency
                alpha: 1 // Fully opaque
            });
            console.log('colorMap:',this.colorMap);   
        },
        getColorMap() {
            return this.colorMap;
        },
        getColorForElevation(elevation:number, minElevation:number, maxElevation:number) {
            // Normalize the elevation to a value between 0 and 255
            const normalizedValue = Math.floor(((elevation - minElevation) / (maxElevation - minElevation)) * 255);
            // Clamp the value to ensure it's within the valid range
            const colorIndex = Math.max(0, Math.min(255, normalizedValue));
            // Return the color from the Viridis colormap
            return this.colorMap[colorIndex];
        },
        getColorGradientStyle1(){
            console.log('getColorGradientStyle');
            const gradientColors = this.colorMap.map(color => color).join(', '); // Join colors to create a CSS gradient
            return {
              background: `linear-gradient(to right, ${gradientColors})`,
              height: '20px', // Adjust the height and width as needed
              width: '100%',  // Adjust the width as needed
            };            
        },
        getColorGradientStyle() {
            console.log('getColorGradientStyle');
            const gradientColors = this.colorMap
                .map(color => `rgba(${color.join(',')})`) // Convert each color to a valid CSS rgba string
                .join(', '); // Join colors to create a CSS gradient string
            return {
                background: `linear-gradient(to right, ${gradientColors})`,
                height: '20px', // Adjust the height as needed
                width: '100%',  // Adjust the width as needed
            };
        }
    },
});