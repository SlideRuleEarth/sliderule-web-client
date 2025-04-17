<script setup lang="ts">
import { watch, onMounted, onUnmounted } from 'vue';
import type OLMap from 'ol/Map';
import { fromLonLat } from 'ol/proj';
import { useGlobalChartStore } from '@/stores/globalChartStore';

const props = defineProps<{
    map: OLMap | null;
}>();

const globalChartStore = useGlobalChartStore();
let highlightEl: HTMLDivElement | null = null;

function updatePosition(lat: number, lon: number) {
    if (!props.map || !highlightEl) return;

    const coord = fromLonLat([lon, lat], props.map.getView().getProjection());
    const pixel = props.map.getPixelFromCoordinate(coord);
    if (!pixel) return;

    const [x, y] = pixel;
    const mapRect = props.map.getTargetElement().getBoundingClientRect();

    const globalX = mapRect.left + x;
    const globalY = mapRect.top + y;

    highlightEl.style.left = `${globalX}px`;
    highlightEl.style.top = `${globalY}px`;

    // Optional pulse effect
    highlightEl.classList.add('active');
    setTimeout(() => highlightEl?.classList.remove('active'), 1000);

    console.log('Highlight marker fixed position (body):', { globalX, globalY });
}

onMounted(() => {
    if (!props.map) return;

    highlightEl = document.createElement('div');
    highlightEl.className = 'map-highlight-marker';
    document.body.appendChild(highlightEl);

    console.log('Highlight marker appended to <body>', highlightEl);

    watch(
        () => globalChartStore.enableLocationFinder,
        (enabled) => {
            if (!highlightEl) return;
            if (enabled) {
                updatePosition(globalChartStore.locationFinderLat, globalChartStore.locationFinderLon);
            } else {
                highlightEl.style.left = '-9999px';
                highlightEl.style.top = '-9999px';
            }
        },
        { immediate: true }
    );

    watch(
        () => [globalChartStore.locationFinderLat, globalChartStore.locationFinderLon],
        ([lat, lon]) => {
            if (globalChartStore.enableLocationFinder) {
                updatePosition(lat, lon);
            }
        }
    );
});

onUnmounted(() => {
    if (highlightEl) {
        highlightEl.remove();
        highlightEl = null;
    }
});
</script>

<template>
    <!-- No DOM rendered by this component -->
</template>

<style>
/* using !important instead of :deep because we had to append marker to the <body> */
.map-highlight-marker {
    position: fixed !important;
    width: 8px !important;
    height: 8px !important;
    border-radius: 50% !important;
    background: rgba(255, 0, 0, 0.8) !important;
    border: 2px solid var(--p-primary-400) !important;
    pointer-events: none !important;
    transform: translate(-50%, -50%) !important;
    transition: transform 0.2s ease, opacity 0.2s ease;
    z-index: 999999 !important;
}

.map-highlight-marker.active {
    transform: translate(-50%, -50%) scale(3.0) !important;
    opacity: 1 !important;
}
</style>
