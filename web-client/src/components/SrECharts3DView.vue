<script setup lang="ts">
import { ref, onMounted } from 'vue';
import VChart from 'vue-echarts';
import { use } from 'echarts/core';

// ECharts Core Components
import {
    TooltipComponent,
    VisualMapComponent,
} from 'echarts/components';
import { CanvasRenderer } from 'echarts/renderers';

import { useFieldNameStore } from '@/stores/fieldNameStore';
import { computeSamplingRate } from '@/utils/SrDuckDbUtils';
import { useSrToastStore } from '@/stores/srToastStore';
import { createDuckDbClient } from '@/utils/SrDuckDb';
import { db as indexedDb } from '@/db/SlideRuleDb';
import { SrPosition } from '@/types/SrTypes';
import { useGradientColorMapStore } from '@/stores/gradientColorMapStore';

// Explicitly register EVERY component we use.
// This tells the build process that these are essential and cannot be removed.
use([
    TooltipComponent,
    VisualMapComponent,
    CanvasRenderer,
]);

const chartOptions = ref<any>({}); // Use 'any' for simplicity here or define a proper type
const loading = ref(true);

const props = defineProps({
    reqId: {
        type: Number,
        default: 0,
    },
});

onMounted(async () => {
    const startTime = performance.now();
    const toast = useSrToastStore();
    const fieldStore = useFieldNameStore();
    const reqIdStr = props.reqId.toString();
    const gradientStore = useGradientColorMapStore(reqIdStr);
    const colorGradient = gradientStore.gradientColorMap;
    if (!colorGradient || colorGradient.length === 0) {
        console.error('Gradient color map is empty or not initialized');
        toast.error('Configuration Error', 'Gradient color map is not initialized.');
        loading.value = false;
        return;
    }

    try {
        const status = await indexedDb.getStatus(props.reqId);
        if (status === 'error') {
            console.error('Sr3DView: request status is error — skipping');
            return;
        }

        const fileName = await indexedDb.getFilename(props.reqId);
        if (!fileName) throw new Error('Filename not found');

        const duckDbClient = await createDuckDbClient();
        await duckDbClient.insertOpfsParquet(fileName);

        const sample_fraction = await computeSamplingRate(props.reqId);
        const result = await duckDbClient.queryChunkSampled(
            `SELECT * FROM read_parquet('${fileName}')`,
            sample_fraction
        );

        const { value: rows = [], done } = await result.readRows().next();
        console.log(`Fetched ${rows.length} rows from the database.`);

        if (rows.length > 0) {
            const latField = fieldStore.getLatFieldName(props.reqId);
            const lonField = fieldStore.getLonFieldName(props.reqId);
            const heightField = fieldStore.getHFieldName(props.reqId);

            const lonMin = Math.min(...rows.map(d => d[lonField]));
            const lonMax = Math.max(...rows.map(d => d[lonField]));
            const latMin = Math.min(...rows.map(d => d[latField]));
            const latMax = Math.max(...rows.map(d => d[latField]));
            const elevMin = Math.min(...rows.map(d => d[heightField]));
            const elevMax = Math.max(...rows.map(d => d[heightField]));

            // --- Defensive check to prevent division by zero ---
            let lonRange = lonMax - lonMin;
            let latRange = latMax - latMin;
            let elevRange = elevMax - elevMin;

            if (lonRange === 0) lonRange = 1;
            if (latRange === 0) latRange = 1;
            if (elevRange === 0) elevRange = 1;
            // ---------------------------------------------------

            const scatterData: SrPosition[] = rows.map((d) => {
                const x = (d[lonField] - lonMin) / lonRange;
                const y = (d[latField] - latMin) / latRange;
                const z = (d[heightField] - elevMin) / elevRange;
                return [x, y, z] as [number, number, number];
            }).filter(([x, y, z]) =>
                isFinite(x) && isFinite(y) && isFinite(z)
            );
            
            console.log(`Processed ${scatterData.length} valid data points for the chart.`);
            
            if (scatterData.length > 0) {
                chartOptions.value = {
                    tooltip: {
                        formatter: (params: any) => {
                            const [x, y, z] = params.value;
                            const lon = lonMin + x * lonRange;
                            const lat = latMin + y * latRange;
                            const elev = elevMin + z * elevRange;
                            return `Lon: ${lon.toFixed(5)}<br>Lat: ${lat.toFixed(5)}<br>Elev: ${elev.toFixed(2)} m`;
                        },
                    },
                    visualMap: {
                        min: 0,
                        max: 1,
                        dimension: 2,
                        calculable: true,
                        inRange: {
                            color: colorGradient,
                        },
                    },
                    xAxis3D: { name: 'Longitude', type: 'value' },
                    yAxis3D: { name: 'Latitude', type: 'value' },
                    zAxis3D: { name: 'Elevation', type: 'value' },
                    grid3D: {
                        viewControl: {
                            projection: 'perspective',
                            autoRotate: false,
                        },
                        boxWidth: 100,
                        boxDepth: 100,
                        boxHeight: 100,
                        axisLine: {
                            lineStyle: { color: '#ccc' }
                        },
                        axisPointer: { show: true }
                    },
                    series: [
                        {
                            type: 'scatter3D',
                            symbolSize: 2,
                            data: scatterData,
                        },
                    ],
                };
                 console.log('Chart options have been set.', chartOptions.value);
            } else {
                 console.warn('Scatter data is empty after processing. Nothing to render.');
            }
        } else {
            console.warn('No data items processed from query.');
            toast.warn('No Data Processed', 'No elevation data returned from query.');
        }
    } catch (err) {
        console.error('Error loading 3D view:', err);
        toast.error('Error', 'Failed to load elevation data.');
    } finally {
        loading.value = false;
        const endTime = performance.now();
        console.log(`Sr3DView onMounted hook took ${endTime - startTime} ms`);
    }
});
</script>

<template>
    <!-- Set a fixed height on the root container -->
    <div style="height: 600px;">
        <div v-if="loading" class="flex justify-center items-center h-full">
            <p>Loading 3D elevation data...</p>
        </div>
        <!-- Use a safer check with optional chaining for the no-data state -->
        <div v-else-if="!chartOptions.series?.[0]?.data?.length" class="flex justify-center items-center h-full">
             <p>No data available to display in the 3D chart.</p>
        </div>
        <!-- Set VChart height to 100% to fill the new parent -->
        <VChart v-else :option="chartOptions" autoresize style="height: 100%; width: 100%;" />
    </div>
</template>
