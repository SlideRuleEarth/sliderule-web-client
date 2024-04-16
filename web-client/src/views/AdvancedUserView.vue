<script setup lang="ts">
    import SrSideBar from "@/components/SrSideBar.vue";
    import TwoColumnLayout from "../layouts/TwoColumnLayout.vue";
    import SrMap from "@/components/SrMap.vue";
    import SrAdvOptSidebar from "@/components/SrAdvOptSidebar.vue";
    import { onMounted } from 'vue';
    import { useAdvancedModeStore } from '@/stores/advancedModeStore.js';
    import { useMapStore } from '@/stores/mapStore';
    import { createDeckGLInstance} from '@/composables/SrMapUtils';
    import { Map as OLMap } from 'ol';
    import SrModeSelect from "@/components/SrModeSelect.vue";
    import { NavigationFailureType, isNavigationFailure } from 'vue-router'
    import { useRouter } from 'vue-router';
    import {useToast} from 'primevue/usetoast';

    const toast = useToast();
    const router = useRouter();


    const advancedModeStore = useAdvancedModeStore();

    onMounted(() => {
        // Get the computed style of the document's root element
        const rootStyle = window.getComputedStyle(document.documentElement);
        // Extract the font size from the computed style
        const fontSize = rootStyle.fontSize;
        // Log the font size to the console
        console.log(`Current root font size: ${fontSize}`);

        advancedModeStore.advanced = true;
        const mapStore = useMapStore();
        const map = mapStore.getMap() as OLMap ;
        if (map){
            const tgt = map.getViewport() as HTMLDivElement; 
            const deckLayer = createDeckGLInstance(tgt);
            if(deckLayer){
                map.addLayer(deckLayer);
                console.log('deckLayer added:',deckLayer);
            } else {
                console.error('createDeckGLInstance returned null');
            }
        } else {
            console.error('map is null');
        }
        console.log('AdvancedUserView onMounted');
    });

    const advancedClick = async () => {
    // console.log('advancedModeStore.advanced:', advancedModeStore.advanced);
    if (advancedModeStore.advanced) {
        const failure = await router.push('/advanced-user');
        if (isNavigationFailure(failure, NavigationFailureType.aborted)) {
            // show a small notification to the user
            toast.add({severity:'info',summary:'Save?',detail:'You have unsaved changes, discard and leave anyway?'})
        }    
    } else {
        const failure = await router.push('/general-user');
        if (isNavigationFailure(failure, NavigationFailureType.aborted)) {
            // show a small notification to the user
            toast.add({severity:'info',summary:'Save?',detail:'You have unsaved changes, discard and leave anyway?'})
        }    
    }
};

</script>

<template>
    <TwoColumnLayout>
        <template v-slot:sidebar-col>
            <SrSideBar>
                <template v-slot:sr-sidebar-body>
                    <SrAdvOptSidebar/>
                </template>
                <template v-slot:sr-sidebar-footer>
                    <SrModeSelect  @advanced-click="advancedClick" /> 
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