<script setup lang="ts">
import { ref, onMounted } from "vue";
import Dialog from "primevue/dialog";
import Button from "primevue/button";
import type OLMap from 'ol/Map.js';
import type { Feature as OLFeature } from "ol";
import type { Geometry } from "ol/geom";
import { useToast } from "primevue/usetoast";
import { useMapStore } from "@/stores/mapStore";

// ✅ NEW imports from your updated composable
import {
  loadShapefileToMap, // orchestrates: parse → store → draw → fit → toasts
} from "@/composables/useReadShapefiles";

const props = defineProps({
  reportUploadProgress: { type: Boolean, default: false },
  loadReqPoly: { type: Boolean, default: false }
});

const emit = defineEmits<{
    (e: "features", features: OLFeature<Geometry>[]): void;
    (e: 'done'): void;   // use lowercase; parent listens as @done
}>();

const mapStore = useMapStore();
const toast = useToast();

const showDialog = ref(false);
const fileEl = ref<HTMLInputElement | null>(null);
const pickedNames = ref<string[]>([]);

function openNativePicker() {
    fileEl.value?.click();
}

function handleFilesChange(e: Event) {
    const input = e.target as HTMLInputElement | null;
    const files = input?.files ?? null;

    // ✅ No spread; works regardless of lib settings
    pickedNames.value = files ? Array.from(files).map(f => f.name) : [];

    // hand off to your existing handler
    onFilesSelected(e);
}


function openFileDialog() {
    showDialog.value = true;
    mapStore.setPolySource("Shapefile");
}

onMounted(() => {
    if (props.loadReqPoly) {
        console.log("onMounted SrShapefileUpload: will load request polygon");
    } else {
        console.log("onMounted SrShapefileUpload: will load features");
    }
});
const onCloseDialog = () => {
    showDialog.value = false;
    emit('done');
};

const onFilesSelected = async (event: Event) => {
    const files = (event.target as HTMLInputElement).files;
    if (!files || files.length === 0) return;

    try {
        // If a single .zip, pass it as File; otherwise pass the FileList
        const singleFile = files.length === 1 ? files[0] : null;
        const input =
        singleFile && singleFile.name.toLowerCase().endsWith(".zip")
            ? singleFile
            : files;

        // 1) Load → store → draw → fit (toasts included inside)
        await loadShapefileToMap(input, {
            loadReqPoly: props.loadReqPoly,
            map: useMapStore().getMap() as OLMap | null, // optional; loadShapefileToMap will default to the store
            fitToExtent: true,
            toast: toast,
            toastLifeMs: 10000
        });

        //showDialog.value = false;
        //emit('done');
    } catch (err) {
        console.error("Shapefile upload failed:", err);
        toast.add({
        severity: "error",
        summary: "Upload failed",
        detail: err instanceof Error ? err.message : String(err),
        life: 5000
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
        class="p-button"
        @click="openFileDialog"
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
        <div class="picker">
            <!-- Hidden native input -->
            <input
                ref="fileEl"
                id="shp-files"
                type="file"
                multiple
                accept=".prj,.shp,.dbf,.shx,.zip"
                class="sr-visually-hidden"
                @change="handleFilesChange"
            />

            <!-- Trigger button -->
            <Button
                icon="pi pi-folder-open"
                label="Choose Files"
                class="p-button"
                @click="openNativePicker"
            />

            <!-- Hint -->
            <div class="hint">
                Accepts .zip, or .shp + .dbf + .shx + .prj
            </div>

            <!-- Selected filenames -->
            <ul v-if="pickedNames.length" class="picked">
                <li v-for="n in pickedNames" :key="n">{{ n }}</li>
            </ul>
        </div>

        <template #footer>
            <Button
                label="Done"
                severity="secondary"
                @click="onCloseDialog"
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
  min-width: 220px;
}

.shp-upload .file-row { margin-bottom: 1rem; }
.shp-upload .file-input { width: 100%; margin-bottom: 1.5em; }
:deep(.shp-upload-dialog) { min-width: 340px; }
@media (max-width: 380px) {
  :deep(.shp-upload-dialog) { min-width: auto; width: 95vw; }
}
/* Hide input but keep it accessible */
.sr-visually-hidden {
  position: absolute !important;
  width: 1px; height: 1px;
  padding: 0; margin: -1px;
  overflow: hidden; clip: rect(0,0,0,0);
  white-space: nowrap; border: 0;
}

/* Dialog styling */
:deep(.shp-upload-dialog.p-dialog) {
  width: 480px;
  max-width: 95vw;
  border-radius: 1rem;
  box-shadow: 0 20px 50px rgba(0,0,0,.6);
}
:deep(.shp-upload-dialog .p-dialog-content) {
  padding: 1rem 1rem .5rem;
}

/* Picker layout */
.picker {
  display: grid;
  gap: .5rem;
}
.hint {
  font-size: .875rem;
  opacity: .75;
}
.picked {
  margin: .25rem 0 0;
  padding-left: 1.1rem;
  max-height: 7.5rem;
  overflow: auto;
  border-left: 2px solid var(--p-content-border-color, rgba(255,255,255,.12));
}
.picked li {
  font-size: .875rem;
  line-height: 1.4;
  word-break: break-all;
}

</style>
