<template>
    <div ref="dropPinWrapper">
        <Button
            :icon="'pi pi-map-marker'"
            :class="['sr-drop-pin-button', { 'active': mapStore.dropPinEnabled }]"
            @click="toggleDropPin"
            rounded
            text
            size="small"
            aria-label="Toggle Drop Pin"
        />
    </div>
</template>


<script setup lang="ts">
import { ref, onMounted } from 'vue';
import { Control } from 'ol/control';
import { useMapStore } from "@/stores/mapStore";
import Button from 'primevue/button';

const mapStore = useMapStore();
const emit = defineEmits(['drop-pin-control-created']);

const dropPinWrapper = ref<HTMLElement | null>(null);

onMounted(() => {
    const element = document.createElement('div');
    element.className = 'sr-drop-pin-control ol-unselectable ol-control';
    if (dropPinWrapper.value) {
        element.appendChild(dropPinWrapper.value);
    } else {
        console.error("Error: dropPinWrapper is null");
    }

    const customControl = new Control({ element });
    emit('drop-pin-control-created', customControl);
});

const toggleDropPin = () => {
    mapStore.dropPinEnabled = !mapStore.dropPinEnabled;
    console.log(`Drop pin enabled: ${mapStore.dropPinEnabled}`);
};
</script>
<style scoped>
.sr-drop-pin-button {
    width: 2.5rem;
    height: 2.5rem;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 1.2rem;
    background-color: black;
    border-radius: 50%;
    border: none;
    box-shadow: none;
    transition: color 0.2s, background-color 0.2s;
}

/* Force icon color to white when off */
.sr-drop-pin-button :deep(.p-button-icon) {
    color: white;
}

/* Change icon color when active (on) */
.sr-drop-pin-button.active :deep(.p-button-icon) {
    color: var(--p-primary-color);
}



</style>