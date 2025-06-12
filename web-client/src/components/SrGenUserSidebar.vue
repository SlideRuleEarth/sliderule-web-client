<script setup lang="ts">
    import SrReqDisplay from "./SrReqDisplay.vue";
    import { useMapStore } from "@/stores/mapStore";
    import { onMounted,defineAsyncComponent } from "vue";
    const SrGenUserPresets = defineAsyncComponent(() => import('./SrGenUserPresets.vue'));

    onMounted(() => {
        //console.log('Mounted SrGenUserSidebar');
        useMapStore().setPolySource('Draw on Map');
    });
</script>

<template>
    <div class="sr-gen-user-sidebar-container">
        <div class="sr-gen-user-wrapper">
            <SrReqDisplay />
        </div>
        <SrGenUserPresets />
    </div>
</template>

<style scoped>
    .sr-gen-user-sidebar-container {
        display: flex;
        flex-direction: column;
        gap: 1rem;
        height: 100vh;
    }
    .sr-gen-user-wrapper {
        margin-top: 0.25rem;
    }

</style>