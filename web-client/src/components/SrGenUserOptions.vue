<script setup lang="ts">
    import { ref } from 'vue';
    import { useReqParamsStore } from '@/stores/reqParamsStore';

    const reqParameterStore = useReqParamsStore();
    const selectedBox = ref<number | null>(null);

    const boxes = [
        { id: 1, name: "ICESat-2 Ice Sheet", description: "For regions with ice", image: "/SrSeaIce.webp" },
        { id: 2, name: "ICESat-2 Land Vegetation", description: "For regions with vegetation", image: "/SrCanopy.webp" },
        { id: 3, name: "ICESat-2 Bathymetry", description: "For shallow water bathymetry", image: "/SrOcean.webp" },
        { id: 4, name: "ICESat-2 Photons", description: "For photon cloud", image: "/SrNoise.webp" },
        { id: 5, name: "GEDI Vegetation Density", description: "For regions with vegetation using GEDI ", image: "/SrInlandWater.webp" },
        { id: 6, name: "GEDI Footprint", description: "GEDI footprint region", image: "/SrGround.webp" },
    ];

    const selectBox = (boxId: number) => {
        selectedBox.value = boxId;
        const selectedBoxInfo = boxes.find(box => box.id === boxId);
        if (!selectedBoxInfo) {
            console.error("GenUserOptions Unknown selection.");
            return;
        }
        if (selectedBoxInfo?.name) {
            switch (selectedBoxInfo.name) {
                case 'ICESat-2 Ice Sheet':
                    // Add specific logic for ICESat-2 Ice Sheet
                    console.log("ICESat-2 Ice Sheet box selected.");
                    reqParameterStore.setMissionValue('ICESat-2');
                    reqParameterStore.setIceSat2API('atl06');
                    reqParameterStore.setSrt([
                        reqParameterStore.getSurfaceReferenceType('Sea Ice'),
                        reqParameterStore.getSurfaceReferenceType('Land Ice'),
                    ]);
                    break;
                case 'ICESat-2 Land Vegetation':
                    // Add specific logic for ICESat-2 Land Vegetation
                    console.log("ICESat-2 Land Vegetation box selected.");
                    reqParameterStore.setMissionValue('ICESat-2');
                    reqParameterStore.setIceSat2API('atl06');
                    reqParameterStore.setSrt([
                        reqParameterStore.getSurfaceReferenceType('Land'),
                    ]);
                    break;
                case 'ICESat-2 Bathymetry':
                    // Add specific logic for ICESat-2 Bathymetry
                    console.log("ICESat-2 Bathymetry box selected.");
                    reqParameterStore.setMissionValue('ICESat-2');
                    reqParameterStore.setIceSat2API('atl06');
                    reqParameterStore.setSrt([
                        reqParameterStore.getSurfaceReferenceType('Inland Water'),
                    ]);
                    break;
                case 'ICESat-2 Photons':
                    // Add specific logic for ICESat-2 Photons
                    console.log("ICESat-2 Photons box selected.");
                    reqParameterStore.setMissionValue('ICESat-2');
                    reqParameterStore.setIceSat2API('atl03');
                    break;
                case 'GEDI Vegetation Density':
                    // Add specific logic for GEDI Vegetation Density
                    console.log("GEDI Vegetation Density box selected.");
                    reqParameterStore.setMissionValue('GEDI');
                    reqParameterStore.setGediAPI('gedi04a');
                    reqParameterStore.setSrt([
                        reqParameterStore.getSurfaceReferenceType('Land'),
                    ]);
                    break;
                case 'GEDI Footprint':
                    // Add specific logic for GEDI Footprint
                    console.log("GEDI Footprint box selected.");
                    reqParameterStore.setMissionValue('GEDI');
                    reqParameterStore.setGediAPI('gedi01b');
                    reqParameterStore.setSrt([
                        reqParameterStore.getSurfaceReferenceType('Land'),
                    ]);
                    break;
                default:
                    console.error("GenUserOptions Unknown selection.");
                    break;
            }
        } 
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