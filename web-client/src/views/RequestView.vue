<script setup lang="ts">
    import MainTwoColumnLayout from "../layouts/MainTwoColumnLayout.vue";
    import SrMap from "@/components/SrMap.vue";
    import { onMounted } from 'vue';
    import SrSideBar from "@/components/SrSideBar.vue";
    
    onMounted(() => {
    });

</script>

<template>
    <MainTwoColumnLayout>
        <template v-slot:sidebar-col>
            <SrSideBar />
        </template>
        <template v-slot:main>
            <SrMap />
        </template>
    </MainTwoColumnLayout>
</template>
<style scoped>

</style>