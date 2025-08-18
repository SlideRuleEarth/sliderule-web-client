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
  loadShapefileToMap,          // orchestrates: parse → store → draw → fit → toasts
  readShapefileToOlFeatures,   // optional: still emit features for parent
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

function openFileDialog() {
  showDialog.value = true;
  mapStore.setPolySource("Shapefile");
}

onMounted(() => {
  if (props.loadReqPoly) {
    console.log("SrShapefileUpload: will load request polygon");
  } else {
    console.log("SrShapefileUpload: will load features");
  }
});

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

    // 2) (Optional) still emit OL features to parent to keep current API
    //    This converts the same input to OL features in EPSG:3857.
    // const { features } = await readShapefileToOlFeatures(input);
    // emit("features", features);

    showDialog.value = false;
    emit('done');
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
  min-width: 220px;
}

.shp-upload .file-row { margin-bottom: 1rem; }
.shp-upload .file-input { width: 100%; margin-bottom: 1.5em; }
:deep(.shp-upload-dialog) { min-width: 340px; }
@media (max-width: 380px) {
  :deep(.shp-upload-dialog) { min-width: auto; width: 95vw; }
}
</style>
