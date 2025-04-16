<template>
    <!-- This component only renders to the map, nothing in DOM -->
</template>
<script setup lang="ts">
import { watch, onMounted, onUnmounted } from 'vue';
import type OLMap from 'ol/Map';
import { Vector as VectorSource } from 'ol/source';
import { Vector as VectorLayer } from 'ol/layer';
import Feature from 'ol/Feature';
import Point from 'ol/geom/Point';
import { fromLonLat } from 'ol/proj';
import Style from 'ol/style/Style';
import CircleStyle from 'ol/style/Circle';
import Fill from 'ol/style/Fill';
import Stroke from 'ol/style/Stroke';
import { useGlobalChartStore } from '@/stores/globalChartStore';

const props = defineProps<{
    map: OLMap | null;
}>();

const globalChartStore = useGlobalChartStore();

let highlightLayer: VectorLayer<VectorSource> | null = null;
let locationFeature: Feature<Point> | null = null;

function createPulseStyle(): Style[] {
    const core = new Style({
        image: new CircleStyle({
            radius: 6,
            fill: new Fill({ color: 'rgba(255, 255, 0, 1)' }),
            stroke: new Stroke({ color: 'orange', width: 2 }),
        }),
    });

    const pulse = new Style({
        image: new CircleStyle({
            radius: 15,
            fill: new Fill({ color: 'rgba(255, 200, 0, 0.3)' }),
        }),
    });

    return [pulse, core];
}

function updateHighlight(lat: number, lon: number) {
    const coord = fromLonLat([lon, lat]);
    console.log('SrLocationFinder updateHighlight lat:', lat, 'lon:', lon, 'coord:', coord);
    if(props.map){
        if(highlightLayer){
            props.map.removeLayer(highlightLayer);     // if already added
            props.map.addLayer(highlightLayer);        // re-add to top so it will be seen
        } else {
            console.error('SrLocationFinder highlightLayer is null');
            return;
        }
    } else {
        console.error('SrLocationFinder map is null');
        return;
    }
    if (!locationFeature) {
        locationFeature = new Feature(new Point(coord));
        locationFeature.setStyle(createPulseStyle());
        highlightLayer?.getSource()?.addFeature(locationFeature);
    } else {
        const geom = locationFeature.getGeometry() as Point;
        geom.setCoordinates(coord);
        locationFeature.setStyle(createPulseStyle()); // optional: re-apply style
        locationFeature.changed(); // ✅ force OL to re-render it
    }
}


onMounted(() => {
    console.log('SrLocationFinder mounted props.map:', props.map);
    if (!props.map) return;

    const source = new VectorSource();
    highlightLayer = new VectorLayer({ source });
    props.map.addLayer(highlightLayer);

    watch(
        () => globalChartStore.enableLocationFinder,
        (enabled) => {
            if (enabled) {
                updateHighlight(globalChartStore.locationFinderLat, globalChartStore.locationFinderLon);
            } else {
                console.log('SrLocationFinder watch enableLocationFinder:', enabled);
                highlightLayer?.getSource()?.clear();
                locationFeature = null;
            }
        },
        { immediate: false }
    );
    watch(
    () => [globalChartStore.locationFinderLat, globalChartStore.locationFinderLon],
    ([lat, lon]) => {
        if (globalChartStore.enableLocationFinder) {
            console.log('SrLocationFinder watch locationFinderLat:', lat, 'locationFinderLon:', lon);
            updateHighlight(lat, lon);
        }
    }
);


});

onUnmounted(() => {
    if (props.map && highlightLayer) {
        props.map.removeLayer(highlightLayer);
    }
});
</script>

<style scoped>
/* Optional: you could animate the pulse with a repeating effect using canvas updates,
   but here we layer styles instead for performance */
</style>
