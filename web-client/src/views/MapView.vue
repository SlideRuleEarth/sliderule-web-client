<script setup lang="ts">
    import TwoColumnLayout from "../layouts/TwoColumnLayout.vue";
    import SrMap from "@/components/SrMap.vue";
    import { onMounted } from 'vue';
    import SrSideBar from "@/components/SrSideBar.vue";
    
    onMounted(() => {
        // Get the computed style of the document's root element
        const rootStyle = window.getComputedStyle(document.documentElement);
        // Extract the font size from the computed style
        const fontSize = rootStyle.fontSize;
        // Log the font size to the console
        console.log(`Current root font size: ${fontSize}`);
    });

</script>

<template>
    <TwoColumnLayout>
        <template v-slot:sidebar-col>
            <SrSideBar />
        </template>
        <template v-slot:main>
            <div class="sr-map-container" ID="MapDiv">
                <SrMap />
            </div>
        </template>
    </TwoColumnLayout>
</template>
<style scoped>

</style>