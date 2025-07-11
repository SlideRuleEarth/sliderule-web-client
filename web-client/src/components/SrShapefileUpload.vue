<template>
    <div>
        <Button
            icon="pi pi-upload"
            label="Upload Shapefile"
            class="p-button-sm"
            @click="showDialog = true"
        />

        <Dialog
            v-model:visible="showDialog"
            header="Upload Shapefile"
            modal
            :closable="true"
            :dismissableMask="true"
            style="min-width:340px"
        >
            <div class="p-fluid" style="margin-bottom:1rem">
                <input
                    type="file"
                    multiple
                    accept=".shp,.dbf,.shx"
                    @change="onFilesSelected"
                    style="width:100%;margin-bottom:1.5em"
                />
            </div>
            <template #footer>
                <Button
                    label="Close"
                    severity="secondary"
                    @click="showDialog = false"
                />
            </template>
        </Dialog>
    </div>
</template>

<script setup lang="ts">
import { ref } from "vue";
import Dialog from "primevue/dialog";
import Button from "primevue/button";
import GeoJSON from "ol/format/GeoJSON";
import * as shapefile from "shapefile";
import type { Feature as OLFeature } from "ol";
import type { Geometry } from "ol/geom";

// Emit the features array to the parent
const emit = defineEmits<{
    (e: "features", features: OLFeature<Geometry>[]): void;
}>();

const showDialog = ref(false);

// Helper: read file as ArrayBuffer
function readFileAsync(file: File): Promise<ArrayBuffer> {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result as ArrayBuffer);
        reader.onerror = reject;
        reader.readAsArrayBuffer(file);
    });
}

async function onFilesSelected(event: Event) {
    const files = (event.target as HTMLInputElement).files;
    if (!files) return;

    const shpFile = Array.from(files).find(f => f.name.endsWith('.shp'));
    const dbfFile = Array.from(files).find(f => f.name.endsWith('.dbf'));
    const shxFile = Array.from(files).find(f => f.name.endsWith('.shx'));

    if (!shpFile || !dbfFile) {
        alert('Please provide at least .shp and .dbf files');
        return;
    }

    const [shpBuf, dbfBuf, shxBuf] = await Promise.all([
        readFileAsync(shpFile),
        readFileAsync(dbfFile),
        shxFile ? readFileAsync(shxFile) : Promise.resolve(undefined)
    ]);

    // Parse shapefile to GeoJSON
    // Cast shxBuf as any due to type definitions
    const source = await shapefile.open(shpBuf, dbfBuf, shxBuf as any);
    const features: any[] = [];
    let result: { done: boolean; value: any };
    do {
        result = await source.read();
        if (!result.done) features.push(result.value);
    } while (!result.done);

    const geojson = {
        type: 'FeatureCollection',
        features
    };

    // Convert to OpenLayers features
    const geojsonFormat = new GeoJSON();
    const olFeatures = geojsonFormat.readFeatures(geojson, {
        featureProjection: 'EPSG:3857',
    }) as OLFeature<Geometry>[];

    emit("features", olFeatures);
    showDialog.value = false;
}
</script>
