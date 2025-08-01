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
                    accept=".prj,.shp,.dbf,.shx,.zip"
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
import { useToast } from "primevue/usetoast";

const toast = useToast();

const emit = defineEmits<{
    (e: "features", features: OLFeature<Geometry>[]): void;
}>();

const showDialog = ref(false);

const onFilesSelected = async (event: Event) => {
    const files = (event.target as HTMLInputElement).files;
    if (!files || files.length === 0) return;

    try {
        const singleFile = files.length === 1 ? files[0] : null;

        // If it's a .zip, pass it directly
        const input = singleFile && singleFile.name.toLowerCase().endsWith('.zip')
            ? singleFile
            : files;

        const { features, warning, detectedProjection } = await readShapefileToOlFeatures(input);

        if (detectedProjection) {
            toast.add({
                severity: 'info',
                summary: 'Detected Projection (.prj)',
                detail: detectedProjection,
                life: 8000,
            });
        }

        if (warning) {
            toast.add({
                severity: 'warn',
                summary: 'Projection Warning',
                detail: warning,
                life: 8000,
            });
        }
        emit("features", features);
        showDialog.value = false;
    } catch (err) {
        toast.add({
            severity: 'error',
            summary: 'Upload failed',
            detail: (err instanceof Error ? err.message : String(err)),
            life: 5000,
        });
    }
};


</script>
