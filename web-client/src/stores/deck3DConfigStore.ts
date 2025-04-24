import { defineStore } from 'pinia';
import { ref, computed } from 'vue';
import { OrbitView, OrbitController } from '@deck.gl/core';

/**
 * Pinia store for Deck configuration parameters
 * (numbers and booleans extracted from DeckImpl options)
 */
export const useDeck3DConfigStore = defineStore('deckConfig', () => {
    // a fixed ID for our single OrbitView
    const viewId = 'main';

    // OrbitView parameters
    const fovy = ref<number>(50);
    const orbitAxis = ref<'Z' | 'Y'>('Z');

    // Controller parameters
    const autoRotate = ref<boolean>(false);
    const inertia = ref<number>(0);
    const zoomSpeed = ref<number>(0.02);
    const rotateSpeed = ref<number>(0.3);
    const panSpeed = ref<number>(0.5);

    // Initial view state parameters
    const zoom = ref<number>(5);
    const fitZoom = ref<number>(0);
    const rotationX = ref<number>(45);
    const rotationOrbit = ref<number>(30);
    const scale = ref<number>(100);
    const centroid = ref<[number, number, number]>([
        scale.value / 2,
        scale.value / 2,
        scale.value / 2,
    ]);

    // Debug flag
    const debug = ref<boolean>(true);

    // Computed props for controller
    const controllerProps = computed(() => ({
        type: OrbitController,
        autoRotate: autoRotate.value,
        inertia: inertia.value,
        zoomSpeed: zoomSpeed.value,
        rotateSpeed: rotateSpeed.value,
        panSpeed: panSpeed.value,
    }));

    // Computed array of OrbitView instances, including matching id
    const views = computed(() => [
        new OrbitView({
            id: viewId,
            orbitAxis: orbitAxis.value,
            fovy: fovy.value,
        }),
    ]);

    // Computed mapping of viewId to its initial state
    const initialViewState = computed(() => ({
        [viewId]: {
            target: [...centroid.value] as [number, number, number],
            zoom: zoom.value,
            rotationX: rotationX.value,
            rotationOrbit: rotationOrbit.value,
        },
    }));

    return {
        viewId,
        fovy,
        orbitAxis,
        autoRotate,
        inertia,
        zoomSpeed,
        rotateSpeed,
        panSpeed,
        zoom,
        fitZoom,
        rotationX,
        rotationOrbit,
        scale,
        centroid,
        debug,
        controllerProps,
        views,
        initialViewState,
    };
});
