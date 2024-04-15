<script setup lang="ts">
    import SrSideBar from "@/components/SrSideBar.vue";
    import TwoColumnLayout from "../layouts/TwoColumnLayout.vue";
    import SrMap from "@/components/SrMap.vue";
    import SrAdvOptSidebar from "@/components/SrAdvOptSidebar.vue";
    import { onMounted } from 'vue';
    import { useAdvancedModeStore } from '@/stores/advancedModeStore.js';

    const advancedModeStore = useAdvancedModeStore();

    onMounted(() => {
        // Get the computed style of the document's root element
        const rootStyle = window.getComputedStyle(document.documentElement);
        // Extract the font size from the computed style
        const fontSize = rootStyle.fontSize;
        // Log the font size to the console
        console.log(`Current root font size: ${fontSize}`);

        advancedModeStore.advanced = true;

        console.log('AdvancedUserView onMounted');
    });
</script>

<template>
    <TwoColumnLayout>
        <template v-slot:sidebar-col>
            <SrSideBar>
                <template v-slot:sr-sidebar-body>
                    <SrAdvOptSidebar/>
                </template>
            </SrSideBar>
        </template>
        <template v-slot:main>
            <SrMap />
        </template>
    </TwoColumnLayout>
</template>
<style scoped>

</style>