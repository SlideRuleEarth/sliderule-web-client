<script setup lang="ts">
    import SrGenUserSidebarOptions from "@/components/SrGenUserPresets.vue";
    import SrReqDisplay from "./SrReqDisplay.vue";
    import { useMapStore } from "@/stores/mapStore";
    import { onMounted } from "vue";

    onMounted(() => {
        //console.log('Mounted SrGenUserSidebar');
        useMapStore().setPolySource('Draw on Map');
    });
</script>

<template>
    <div class="sr-gen-user-sidebar-container">
        <SrGenUserSidebarOptions />
        <SrReqDisplay />
    </div>
</template>

<style scoped>
    .sr-gen-user-sidebar-container {
        display: flex;
        flex-direction: column;
        gap: 1rem;
        height: 100vh;
    }

</style>