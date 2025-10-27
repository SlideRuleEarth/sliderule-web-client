import { ref, computed, watch } from 'vue';
import { defineStore } from 'pinia';
import colormap from 'colormap';
import { db } from '@/db/SlideRuleDb';
import { createUnifiedColorMapper } from '@/utils/colorUtils';
import { createLogger } from '@/utils/logger';

const logger = createLogger('GradientColorMapStore');

export function useGradientColorMapStore(reqIdStr: string) {
    return defineStore(`gradientColorMapStore-${reqIdStr}`, () => {
        const isInitialized = ref(false);
        const selectedGradientColorMapName = ref('viridis');
        const numShadesForGradient = ref(512);
        const gradientColorMapRGBA = ref<number[][]>([]);
        const gradientColorMap = computed(() =>
            gradientColorMapRGBA.value.map(([r, g, b, a]) => `rgba(${r}, ${g}, ${b}, ${a})`)
        );

        const gradientColorMapStyle = computed(() => ({
            background: `linear-gradient(to right, ${gradientColorMap.value.join(', ')})`,
            height: '10px',
            width: '100%'
        }));

        let dataOrderNdx = {} as Record<string, number>;

        function updateGradientColorMapValues(): void {
            try {
                const rawColorArray = colormap({
                    colormap: selectedGradientColorMapName.value,
                    nshades: numShadesForGradient.value,
                    format: 'rgba',
                    alpha: 1
                });
                gradientColorMapRGBA.value = rawColorArray;
            } catch (error) {
                logger.error('updateGradientColorMapValues error', { reqIdStr, error: error instanceof Error ? error.message : String(error) });
                throw error;
            }
        }

        function setSelectedGradientColorMapName(name: string): void {
            selectedGradientColorMapName.value = name;
        }

        function setNumShadesForGradient(numShades: number): void {
            numShadesForGradient.value = Math.max(numShades, 10);
        }

        async function restoreDefaultGradientColorMap(): Promise<void> {
            await db.restoreDefaultGradientColorMap();
            const plotConfig = await db.getPlotConfig();
            if (plotConfig) {
                selectedGradientColorMapName.value = plotConfig.defaultGradientColorMapName;
                numShadesForGradient.value = plotConfig.defaultGradientNumShades;
            } else {
                logger.error('restoreDefaultGradientColorMap: no plotConfig', { reqIdStr });
            }
        }

        function setDataOrderNdx(ndx: Record<string, number>) {
            dataOrderNdx = ndx;
        }

        function getDataOrderNdx(): Record<string, number> {
            return dataOrderNdx;
        }

        function getDimensions(): string[] {
            return Object.keys(dataOrderNdx).sort((a, b) => dataOrderNdx[a] - dataOrderNdx[b]);
        }

        function createGradientColorFunction(ndx_name: string, minValue: number, maxValue: number) {
            let ndx: number = -1;
            return createUnifiedColorMapper({
                colorMap: gradientColorMap.value,
                min: minValue,
                max: maxValue,
                valueAccessor: (params: any) => {
                    if (ndx < 0) ndx = dataOrderNdx[ndx_name];
                    const value = params.data[ndx];
                    // Convert BigInt to Number if necessary
                    return typeof value === 'bigint' ? Number(value) : value;
                }
            });
        }

        // Auto-update gradient whenever config changes
        watch([selectedGradientColorMapName, numShadesForGradient], updateGradientColorMapValues, { immediate: true });

        return {
            isInitialized,
            selectedGradientColorMapName,
            numShadesForGradient,
            gradientColorMap,
            gradientColorMapRGBA,
            gradientColorMapStyle,
            setSelectedGradientColorMapName,
            setNumShadesForGradient,
            updateGradientColorMapValues,
            restoreDefaultGradientColorMap,
            setDataOrderNdx,
            getDataOrderNdx,
            getDimensions,
            createGradientColorFunction
        };
    })();
}
