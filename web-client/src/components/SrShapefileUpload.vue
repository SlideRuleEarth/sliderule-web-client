
<script setup lang="ts">
import { ref } from "vue";
import Dialog from "primevue/dialog";
import Button from "primevue/button";
import type { Feature as OLFeature } from "ol";
import type { Geometry } from "ol/geom";
import { readShapefileToOlFeatures } from "@/composables/useReadShapefiles";
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
<template>
    <div class="shp-upload">
        <div class="trigger">
            <Button
                icon="pi pi-upload"
                label="Upload Shapefile"
                class="p-button-sm"
                @click="showDialog = true"
            />
        </div>

        <Dialog
            v-model:visible="showDialog"
            header="Upload Shapefile"
            modal
            :closable="true"
            :dismissableMask="true"
            class="shp-upload-dialog"
        >
            <div class="p-fluid file-row">
                <input
                    type="file"
                    multiple
                    accept=".prj,.shp,.dbf,.shx,.zip"
                    @change="onFilesSelected"
                    class="file-input"
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

<style scoped>
/* center the launch button like the GeoJSON one */
.shp-upload .trigger {
    display: flex;
    justify-content: center;
    margin: 0.5rem 0 0.25rem;
}

/* optional: keep widths consistent with your GeoJSON button */
.shp-upload .trigger :deep(.p-button) {
    min-width: 220px; /* tweak to match your other button */
}

/* existing dialog bits */
.shp-upload .file-row { margin-bottom: 1rem; }
.shp-upload .file-input { width: 100%; margin-bottom: 1.5em; }
:deep(.shp-upload-dialog) { min-width: 340px; }
@media (max-width: 380px) {
    :deep(.shp-upload-dialog) { min-width: auto; width: 95vw; }
}
</style>
