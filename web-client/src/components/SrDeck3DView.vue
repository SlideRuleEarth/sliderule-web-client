<template>
    <div ref="deckContainer" class="deck-canvas" />
</template>

<script setup lang="ts">
import { ref, onMounted, nextTick } from 'vue';
import { Deck } from '@deck.gl/core';
import { ScatterplotLayer } from '@deck.gl/layers';
import { OrbitView, OrbitController } from '@deck.gl/core';

const deckContainer = ref<HTMLDivElement | null>(null);

const exampleData = [
    [0.5, 0.5, 0.5],
];

onMounted(async () => {
    await nextTick();

    if (!deckContainer.value) {
        console.error('deckContainer not mounted');
        return;
    }

    const layer = new ScatterplotLayer({
        id: 'scatter-3d',
        data: exampleData,
        getPosition: (d) => d,
        getRadius: 50, // in pixels
        radiusUnits: 'pixels',
        getFillColor: [255, 0, 0],
        opacity: 1.0,
        pickable: true,
    });

    new Deck({
        parent: deckContainer.value,
        views: [new OrbitView({ orbitAxis: 'Z', fovy: 50 })],
        controller: {
            type: OrbitController,
            autoRotate: true,
        } as any,
        initialViewState: {
            target: [0.5, 0.5, 0.5],
            zoom: 1,
            rotationX: 0,
            rotationOrbit: 0,
        } as any,
        layers: [layer],
        onAfterRender: () => {
            console.log('Deck rendered frame');
        },
        onClick: (info) => {
            console.log('Clicked:', info.object);
        },
    });
});
</script>

<style scoped>
.deck-canvas {
    width: 100%;
    height: 600px;
    background: #111;
}
</style>
