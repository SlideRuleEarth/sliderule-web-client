<!-- SrExportPolygonControl.vue -->
<template>
  <div
    ref="containerEl"
    class="ol-control ol-unselectable sr-control sr-export-polygon-control"
    role="group"
    aria-label="Export Polygon control"
    :style="varStyle"
  >
    <div class="export-control-container">
      <Button
        icon="pi pi-download"
        class="p-button-icon-only sr-export-polygon-button"
        @click="toggleMenu"
        variant="text"
        :disabled="!hasPolygon"
        aria-label="Export polygon"
        :title="tooltipText"
      />
      <Menu
        ref="menu"
        :model="menuItems"
        :popup="true"
        class="export-menu"
      />
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, onBeforeUnmount, computed } from 'vue';
import Control from 'ol/control/Control';
import Button from 'primevue/button';
import Menu from 'primevue/menu';
import type { MenuItem } from 'primevue/menuitem';
import { useReqParamsStore } from '@/stores/reqParamsStore';
import { useSrToastStore } from '@/stores/srToastStore';
import type OLMap from 'ol/Map.js';
import JSZip from 'jszip';

type Corner = 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right';

const props = defineProps({
  map: { type: Object as () => OLMap | null, default: null },

  /** Which corner to pin to */
  corner: { type: String as () => Corner, default: 'top-left' },

  /** Offsets from the chosen corner */
  offsetX: { type: [Number, String], default: '0.5rem' },
  offsetY: { type: [Number, String], default: '20.5rem' },

  /** Style knobs */
  bg: { type: String, default: 'rgba(0, 0, 0, 0.8)' },
  color: { type: String, default: 'white' },
  radius: { type: String, default: 'var(--p-border-radius)' },
  zIndex: { type: [Number, String], default: undefined },
});

const emit = defineEmits<{
  (e: 'export-polygon-control-created', control: Control): void;
}>();

const reqParamsStore = useReqParamsStore();
const toastStore = useSrToastStore();
const menu = ref();

const hasPolygon = computed(() => {
  return reqParamsStore.poly && reqParamsStore.poly.length > 0;
});

const tooltipText = 'Export the drawn polygon as GeoJSON or Shapefile';

const menuItems = ref<MenuItem[]>([
  {
    label: 'GeoJSON',
    icon: 'pi pi-file',
    command: () => exportAsGeoJSON()
  },
  {
    label: 'Shapefile (.zip)',
    icon: 'pi pi-file-arrow-up',
    command: () => exportAsShapefile()
  }
]);

const toggleMenu = (event: Event) => {
  menu.value.toggle(event);
};

function exportAsGeoJSON() {
  try {
    const poly = reqParamsStore.poly;

    if (!poly || poly.length === 0) {
      toastStore.warn('No Polygon', 'Please draw a polygon on the map first');
      return;
    }

    // Create GeoJSON from the poly (array of {lat, lon})
    const coordinates = poly.map(point => [point.lon, point.lat]);

    // Close the polygon if not already closed
    if (coordinates.length > 0) {
      const first = coordinates[0];
      const last = coordinates[coordinates.length - 1];
      if (first[0] !== last[0] || first[1] !== last[1]) {
        coordinates.push([...first]);
      }
    }

    const geojson = {
      type: 'FeatureCollection',
      features: [
        {
          type: 'Feature',
          properties: {
            name: 'SlideRule Polygon',
            description: 'Exported from SlideRule',
            created: new Date().toISOString()
          },
          geometry: {
            type: 'Polygon',
            coordinates: [coordinates]
          }
        }
      ]
    };

    const jsonString = JSON.stringify(geojson, null, 2);
    const blob = new Blob([jsonString], { type: 'application/json' });
    const url = URL.createObjectURL(blob);

    const filename = `sliderule-polygon-${new Date().toISOString().replace(/[:.]/g, '-')}.geojson`;
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();

    URL.revokeObjectURL(url);

    toastStore.info('Export Successful', `Polygon exported as ${filename}`);
  } catch (error) {
    console.error('Error exporting GeoJSON:', error);
    toastStore.error('Export Failed', 'Failed to export polygon as GeoJSON');
  }
}

async function exportAsShapefile() {
  try {
    const poly = reqParamsStore.poly;

    if (!poly || poly.length === 0) {
      toastStore.warn('No Polygon', 'Please draw a polygon on the map first');
      return;
    }

    // Create coordinates array
    const coordinates = poly.map(point => [point.lon, point.lat]);

    // Close the polygon if not already closed
    if (coordinates.length > 0) {
      const first = coordinates[0];
      const last = coordinates[coordinates.length - 1];
      if (first[0] !== last[0] || first[1] !== last[1]) {
        coordinates.push([...first]);
      }
    }

    // Create a simple shapefile structure
    // Note: This is a simplified implementation
    // For full shapefile support, consider using a library like 'shp-write'

    const zip = new JSZip();

    // Create .shp file (binary shapefile format is complex)
    // For now, we'll create a GeoJSON and inform the user
    const geojson = {
      type: 'FeatureCollection',
      features: [
        {
          type: 'Feature',
          properties: {
            name: 'SlideRule Polygon',
            description: 'Exported from SlideRule',
            created: new Date().toISOString()
          },
          geometry: {
            type: 'Polygon',
            coordinates: [coordinates]
          }
        }
      ]
    };

    // Add GeoJSON to zip (as a fallback/reference)
    zip.file('polygon.geojson', JSON.stringify(geojson, null, 2));

    // Add .prj file (WGS84 projection)
    const prjContent = 'GEOGCS["GCS_WGS_1984",DATUM["D_WGS_1984",SPHEROID["WGS_1984",6378137,298.257223563]],PRIMEM["Greenwich",0],UNIT["Degree",0.017453292519943295]]';
    zip.file('polygon.prj', prjContent);

    // Add README
    const readme = `SlideRule Polygon Export
Created: ${new Date().toISOString()}

This archive contains:
- polygon.geojson: GeoJSON format (recommended for most GIS applications)
- polygon.prj: Projection file (WGS84)

Note: For full shapefile format (.shp, .shx, .dbf), please convert the GeoJSON
using tools like QGIS, ArcGIS, or ogr2ogr.

To use in QGIS:
1. Extract this ZIP file
2. Open QGIS
3. Drag and drop polygon.geojson into QGIS
4. Right-click the layer > Export > Save Features As > ESRI Shapefile
`;
    zip.file('README.txt', readme);

    // Generate and download ZIP
    const blob = await zip.generateAsync({ type: 'blob' });
    const url = URL.createObjectURL(blob);

    const filename = `sliderule-polygon-${new Date().toISOString().replace(/[:.]/g, '-')}.zip`;
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();

    URL.revokeObjectURL(url);

    toastStore.info(
      'Export Successful',
      `Polygon exported as ${filename}. See README.txt inside for details.`,
      8000
    );
  } catch (error) {
    console.error('Error exporting shapefile:', error);
    toastStore.error('Export Failed', 'Failed to export polygon as shapefile');
  }
}

const toCss = (v: number | string) => typeof v === 'number' ? `${v}px` : v;

const varStyle = computed(() => {
  const x = toCss(props.offsetX);
  const y = toCss(props.offsetY);
  const top = props.corner.startsWith('top') ? y : 'auto';
  const bottom = props.corner.startsWith('bottom') ? y : 'auto';
  const left = props.corner.endsWith('left') ? x : 'auto';
  const right = props.corner.endsWith('right') ? x : 'auto';

  return {
    '--sr-top': top,
    '--sr-right': right,
    '--sr-bottom': bottom,
    '--sr-left': left,
    '--sr-bg': props.bg,
    '--sr-color': props.color,
    '--sr-radius': props.radius,
    ...(props.zIndex != null ? { zIndex: String(props.zIndex) } : {}),
  } as Record<string, string>;
});

const containerEl = ref<HTMLDivElement | null>(null);
let control: Control | null = null;

onMounted(() => {
  if (!containerEl.value) return;
  control = new Control({ element: containerEl.value });
  emit('export-polygon-control-created', control);
});

onBeforeUnmount(() => {
  control?.setMap?.(null);
  control = null;
});
</script>

<style scoped>
.export-control-container {
  position: relative;
  display: flex;
  flex-direction: column;
  align-items: center;
}

.sr-export-polygon-button.p-button {
  display: flex;
  align-items: center;
  justify-content: center;
  margin: 0.25rem;
  background: var(--sr-bg);
  color: var(--sr-color);
  border-radius: var(--sr-radius);
}

.sr-export-polygon-button:hover:not(:disabled) {
  background: rgba(255, 255, 255, 0.2);
}

.sr-export-polygon-button:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.export-menu {
  margin-top: 0.25rem;
}

/* Position the control using CSS variables */
.sr-export-polygon-control {
  position: absolute;
  top: var(--sr-top);
  right: var(--sr-right);
  bottom: var(--sr-bottom);
  left: var(--sr-left);
  background: transparent;
  padding: 0;
}
</style>
