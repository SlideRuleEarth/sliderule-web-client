<script setup lang="ts">
    import TwoColumnLayout from "../layouts/TwoColumnLayout.vue";
    import SrMap from "@/components/SrMap.vue";
    import { onMounted } from 'vue';
    import SrSideBar from "@/components/SrSideBar.vue";
    
    onMounted(() => {
    });

</script>

<template>
    <TwoColumnLayout>
        <template v-slot:sidebar-col>
            <SrSideBar />
        </template>
        <template v-slot:main>
            <SrMap />
        </template>
    </TwoColumnLayout>
</template>
<style scoped>

</style>