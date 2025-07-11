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
import type { Feature as OLFeature } from "ol";
import type { Geometry } from "ol/geom";
import { readShapefileToOlFeatures } from "@/composables/useReadShapefile";

// Emit the features array to the parent
const emit = defineEmits<{
    (e: "features", features: OLFeature<Geometry>[]): void;
}>();

const showDialog = ref(false);


async function onFilesSelected(event: Event) {
    const files = (event.target as HTMLInputElement).files;
    if (!files) return;

    const shp = Array.from(files).find(f => f.name.endsWith('.shp'));
    const dbf = Array.from(files).find(f => f.name.endsWith('.dbf'));
    const shx = Array.from(files).find(f => f.name.endsWith('.shx'));

    if (!shp || !dbf) {
        alert('Please provide at least .shp and .dbf files');
        return;
    }

    try {
        const olFeatures = await readShapefileToOlFeatures({ shp, dbf, shx });
        emit("features", olFeatures);
        showDialog.value = false;
    } catch (err) {
        // You can use a toast, modal, etc.
        alert((err instanceof Error ? err.message : String(err)));
    }
}

</script>
