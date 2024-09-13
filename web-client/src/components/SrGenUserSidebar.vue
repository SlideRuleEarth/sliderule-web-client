<script setup lang="ts">
    import { ref } from 'vue';
    import SrRunControl from "@/components/SrRunControl.vue";
    import { useToast } from 'primevue/usetoast';

    const selectedBox = ref<number | null>(null);
    const toast = useToast();

    const boxes = [
        { id: 1, name: "ICESat-2 Ice Sheet", description: "ICe that is floating in the ocean", image: "/images/land-icon.png" },
        { id: 2, name: "ICESat-2 Land Vegetation", description: "Shows Vegetation on Land", image: "/images/land-ice-icon.png" },
        { id: 3, name: "ICESat-2 Bathymetry", description: "Deapth of the ocean", image: "/images/sea-ice-icon.png" },
        { id: 4, name: "ICESat-2 Photons", description: "Open water surfaces", image: "/images/ocean-icon.png" },
        { id: 5, name: "GEDI Vegetation Density", description: "Vegetation Density", image: "/images/inland-water-icon.png" },
        { id: 6, name: "GEDI Footprint", description: "Terrain elevation, canopy height, RH metrics and Leaf Area Index (LAI)", image: "/images/inland-water-icon.png" },
    ];

    const selectBox = (boxId: number) => {
        selectedBox.value = boxId;
        const selectedBoxInfo = boxes.find(box => box.id === boxId);
        toast.add({
            severity: 'info',
            summary: 'Surface Type Selected',
            detail: `You selected ${selectedBoxInfo?.name}`,
            life: 3000
        });
    };
</script>

<template>
    <div class="sr-gen-user-sidebar-container">
        <SrRunControl />
        <h4>Options</h4>
        <div class="radio-box-container">
            <div
                v-for="box in boxes"
                :key="box.id"
                class="radio-box"
                :class="{ 'selected': selectedBox === box.id }"
                @click="selectBox(box.id)"
            >
                <img :src="box.image" :alt="box.name" class="radio-box-image">
                <div class="radio-box-content">
                    <h3>{{ box.name }}</h3>
                    <p>{{ box.description }}</p>
                </div>
            </div>
        </div>
    </div>
</template>

<style scoped>
    .sr-gen-user-sidebar-container {
        display: flex;
        flex-direction: column;
        gap: 1rem;
        height: 100%;
        overflow-y: auto;
        padding: 1rem;
    }

    h2 {
        margin-bottom: 0.5rem;
    }

    .radio-box-container {
        display: flex;
        flex-direction: column;
        gap: 0.5rem;
    }

    .radio-box {
        display: flex;
        align-items: center;
        background-color: #2c2c2c;
        border: 1px solid #3a3a3a;
        border-radius: 8px;
        cursor: pointer;
        transition: all 0.3s ease;
        padding: 0.75rem;
    }

    .radio-box.selected {
        background-color: #3a3a3a;
        border-color: #4caf50;
    }

    .radio-box-image {
        width: 48px;
        height: 48px;
        margin-right: 1rem;
        object-fit: contain;
    }

    .radio-box-content {
        display: flex;
        flex-direction: column;
    }

    .radio-box-content h3 {
        margin: 0;
        font-size: 1rem;
        font-weight: 500;
    }

    .radio-box-content p {
        margin: 0;
        font-size: 0.8rem;
        color: #a0a0a0;
    }
</style>