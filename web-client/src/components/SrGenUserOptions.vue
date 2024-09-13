<script setup lang="ts">
    import { ref } from 'vue';
    import { useToast } from 'primevue/usetoast';

    const selectedBox = ref<number | null>(null);
    const toast = useToast();

    const boxes = [
        { id: 1, name: "ICESat-2 Ice Sheet", description: "Description Here", image: "/SrSeaIce.webp" },
        { id: 2, name: "ICESat-2 Land Vegetation", description: "Description Here", image: "/SrCanopy.webp" },
        { id: 3, name: "ICESat-2 Bathymetry", description: "Description Here", image: "/SrOcean.webp" },
        { id: 4, name: "ICESat-2 Photons", description: "Description Here", image: "/SrNoise.webp" },
        { id: 5, name: "GEDI Vegetation Density", description: "Description Here", image: "/SrInlandWater.webp" },
        { id: 6, name: "GEDI Footprint", description: "Description Here", image: "/SrGround.webp" },
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
    <div class="sr-radio-box-container">
        <div
            v-for="box in boxes"
            :key="box.id"
            class="sr-radio-box"
            :class="{ 'selected': selectedBox === box.id }"
            @click="selectBox(box.id)"
        >
            <img :src="box.image" :alt="box.name" class="sr-radio-box-image">
            <div class="sr-radio-box-content">
                <h3>{{ box.name }}</h3>
                <p>{{ box.description }}</p>
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
        width: 100%;
        padding: 1rem;
    }

    .sr-radio-box-container {
        display: flex;
        flex-direction: column;
        gap: 0.5rem;
    }

    .sr-radio-box {
        display: flex;
        align-items: center;
        background-color: #2c2c2c;
        border: 2px solid #3a3a3a;
        border-radius: 0.5rem;
        cursor: pointer;
        transition: all 0.3s ease;
        padding: 0.75rem;
    }

    .sr-radio-box.selected {
        background-color: #3a3a3a;
        border-color: #A4DEEB;
    }

    .sr-radio-box-image {
        width: 2.75rem;
        height: 2.75rem;
        margin-right: 1rem;
        object-fit: contain;
    }

    .sr-radio-box-content {
        display: flex;
        flex-direction: column;
    }

    .sr-radio-box-content h3 {
        margin: 0;
        font-size: 1rem;
        font-weight: 500;
    }

    .sr-radio-box-content p {
        margin: 0;
        font-size: 0.8rem;
        color: #a0a0a0;
    }
</style>