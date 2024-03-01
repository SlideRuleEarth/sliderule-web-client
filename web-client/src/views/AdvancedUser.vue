<script setup lang="ts">
    import SrSideBar from "@/components/SrSideBar.vue";
    import TwoColumnLayout from "../layouts/TwoColumnLayout.vue";
    import SrMap from "@/components/SrMap.vue";
    import SrSliderInput from "@/components/SrSliderInput.vue";
    import SrTextInput from "@/components/SrTextInput.vue";
    import SrMenuInput from "@/components/SrMenuInput.vue";
    import SrMenuMultiInput from "@/components/SrMenuMultiInput.vue";
    import Button from 'primevue/button';
    import { onMounted, ref } from 'vue';
    import { watchDebounced } from '@vueuse/core'
    import {useToast} from "primevue/usetoast";
    import { atl06p } from '@/sliderule/icesat2.js';
    import { init } from '@/sliderule/core';
    import ProgressSpinner from 'primevue/progressspinner';
    import { useAdvancedModeStore } from '@/stores/advancedModeStore.js';
    import { createLegend } from '@/composables/SrMapUtils';
    import { createElevationDeckGLLayer, pnt_cnt } from '@/composables/SrMapUtils';
    import { ElevationData } from '@/composables/SrMapUtils';
    import { useMapStore } from '@/stores/mapStore';
    import {useElevationStore} from "@/stores/elevationStore";
    import { Map as OLMap } from 'ol';
    import  SrGraticuleSelect  from "@/components/SrGraticuleSelect.vue";
    const graticuleClick = () => {
        const mapStore = useMapStore();
        mapStore.toggleGraticule();
    }
    const advancedModeStore = useAdvancedModeStore();
    const elevationStore = useElevationStore();

    const toast = useToast();
    const urlValue = ref('slideruleearth.io');
    const surfaceTypeValue = ref('Land');
    const surfaceTypeItems = ref([
       { value: 'Land', label: 'Land'},
       { value: 'Ocean', label: 'Ocean'},
       { value: 'Sea Ice', label: 'Sea Ice'},
       { value: 'Land Ice', label: 'Land Ice'},
       { value: 'Inland Water', label: 'Inland Water'},
    ]  );
    const lengthValue = ref(40);
    const stepValue = ref(20);
    const confidenceValue = ref(4);
    const selectedLandClassItems = ref([]);
    const landClassItems = ref([
       { value: 'atl08_noise', label: 'atl08_noise'},
       { value: 'atl08_ground', label: 'atl08_ground'},
       { value: 'atl08_canopy', label: 'atl08_canopy'},
       { value: 'atl08_top_of_canopy', label: 'atl08_top_of_canopy'},
       { value: 'atl08_unclassified', label: 'atl08_unclassified'},
    ]  );
    const iterationsValue = ref(6);
    const spreadValue = ref(20.0);
    const PE_CountValue = ref(10);
    const windowValue = ref(3.0);
    const sigmaValue = ref(5.0);
    const variableItems = ref([
       { value: 'h_mean', label: 'h_mean'},
       { value: 'h_sigma', label: 'h_sigma'},
       { value: 'dh_fit_dx', label: 'dh_fit_dx'},
       { value: 'dh_fit_dy', label: 'dh_fit_dy'},
       { value: 'rms_misfit', label: 'rms_misfit'},
       { value: 'w_surface_window_final', label: 'w_surface_window_final'},
       { value: 'delta_time', label: 'delta_time'},
       { value: 'cycle', label: 'cycle'},
       { value: 'rgt', label: 'rgt'},
    ]  );
    const colorMapItems = ref([
         { value: 'viridis', label: 'viridis'},
         { value: 'plasma', label: 'plasma'},
         { value: 'inferno', label: 'inferno'},
         { value: 'magma', label: 'magma'},
         { value: 'cividis', label: 'cividis'},
    ]   );

    const isLoading = ref(false);
    const cb_count = ref(0);

    onMounted(() => {
        advancedModeStore.advanced = true;
        init({});
    });


    // Function that is called when stepValue changes
    //const onStepValueChange = (newValue, oldValue) => {
    const onStepValueChange = (newValue) => {
        stepValue.value =newValue;
        //console.log(`Step value changed from ${oldValue} to ${newValue}`,stepValue.value);
    };

    // Watcher for stepValue
    watchDebounced(
        stepValue,
        onStepValueChange,
        { debounce: 500, maxWait: 1000 },
    );

    // Function that is called when the "Run SlideRule" button is clicked
    const runSlideRuleClicked = () => {
        // console.log('logoClick');
        toast.add({ severity: 'info', summary: 'Run', detail: 'RunSlideRule was clicked', life: 3000 });
        console.log("runSlideRuleClicked typeof atl06p:",typeof atl06p);
        //console.log("runSlideRuleClicked atl06p:", atl06p);
        //const recs: any[] = [];
        // Create the legend
        let recs:ElevationData[] = [];
        const callbacks = {
            atl06rec: (result) => {
                if(cb_count.value === 0) {
                    console.log('first atl06p cb result["elevation"]:', result["elevation"]); // result["elevation"] is an array of ElevationData');
                }
                const currentRecs = result["elevation"];
                const curFlatRecs = currentRecs.flat();
                recs.push(curFlatRecs);
                cb_count.value += 1;
                if(cb_count.value === 1) {
                    console.log("atl06p cb first result:", result)
                    const r = curFlatRecs[0];
                    console.log(`h_mean:${r.h_mean}  min:${elevationStore.getMin()} max:${elevationStore.getMax()}`)
                }
                for (let i = 0; i < curFlatRecs.length; i++) {
                    let rec = curFlatRecs[i];
                    if(rec.h_mean < elevationStore.getMin()) {
                        elevationStore.setMin(rec.h_mean);
                    }
                    if(rec.h_mean > elevationStore.getMax()) {
                        elevationStore.setMax(rec.h_mean);
                    }
                }
            },
        };
        const mapStore = useMapStore();
        const map = mapStore.getMap() as OLMap ;
        if (map){
            console.log("atl06p cb_count:",cb_count.value)        
            isLoading.value = true; 
            atl06p({ 
                    "cnf": "atl03_high",
                    "ats": 20.0,
                    "cnt": 10,
                    "len": 40.0,
                    "res": 20.0,
                    "maxi": 1 
                }, 
                ["ATL03_20230529000937_10481906_006_01.h5"],
                callbacks
                )
            .then(
                () => { // result
                    // Log the result to the console

                    // Display a toast message indicating successful completion
                    toast.add({
                        severity: 'success', // Use 'success' severity for successful operations
                        summary: 'Success', // A short summary of the outcome
                        detail: 'RunSlideRule completed successfully.', // A more detailed success message
                        life: 10000 // Adjust the duration as needed
                    });
                },
                error => {
                    // Log the error to the console
                    console.error('runSlideRuleClicked Error = ', error);

                    // Display a toast message indicating the error
                    toast.add({
                        severity: 'error', // Use 'error' severity for error messages
                        summary: 'Error', // A short summary of the error
                        detail: 'An error occurred while running SlideRule.', // A more detailed error message
                        life: 5000 // Adjust the duration as needed
                    });
                }
            ).catch((error => {
                // Log the error to the console
                console.error('runSlideRuleClicked Error = ', error);

                // Display a toast message indicating the error
                toast.add({
                    severity: 'error', // Use 'error' severity for error messages
                    summary: 'Error', // A short summary of the error
                    detail: 'An error occurred while running SlideRule.', // A more detailed error message
                    life: 5000 // Adjust the duration as needed
                });
            }))
            .finally(() => {
                const flatRecs = recs.flat();
                const tgt = map.getViewport() as HTMLDivElement; 
                const deckLayer = createElevationDeckGLLayer(flatRecs,tgt);
                map.addLayer(deckLayer);
                isLoading.value = false;
                console.log(`cb_count:${cb_count.value} pnt_cnt: ${pnt_cnt.value}`)
                createLegend();
            });
        }
    };

    // Function that is called when the "Run Test" button is clicked
    // const runTestClicked = () => {
    //     console.log('runTestClicked');
    //     const mapStore = useMapStore();
    //     const map = mapStore.getMap();
    //     const ed = [
    //       {longitude: -77.1230, latitude: 39.0117, elevation: 0},
    //       {longitude: -77.1230, latitude: 39.0107, elevation: 100},
    //       {longitude: -77.1230, latitude: 39.0097, elevation: 200},
    //       {longitude: -77.1230, latitude: 39.0087, elevation: 300},
    //     ];
    //     const edArray: ElevationData[] = ed.map(item => {
    //       let edItem = useElevationData(); // Initialize a new ElevationData object
    //       edItem.latitude = item.latitude; 
    //       edItem.longitude = item.longitude;
    //       edItem.h_mean = item.elevation; // Assuming elevation maps to h_mean
    //       return edItem;
    //     });
       

    //     if(map){
    //         //const tgt = map.getTargetElement() as HTMLDivElement; 
    //         const tgt = map.getViewport() as HTMLDivElement; 
    //         //console.log("map target:",tgt);
    //         const deckLayer = getTestDeckGLLayer(edArray, tgt);
    //         let center = [-0.4531566, 51.4709959]; // London
    //         const zoom = 3;
    //         map.addLayer(deckLayer);
    //         const view = map.getView();


    //         console.log("Hello World!")
    //         if (view) {
    //             console.log("animating view...")
    //             if (view.getProjection().getUnits() !== 'degrees') {
    //                 center = fromLonLat(center);
    //                 console.log("CONVERTED center:",center);
    //             }
    //             console.log("center:",center);
    //             view.animate({
    //                 center: center,
    //                 duration: 1000,
    //                 zoom: zoom,
    //             });
    //             map.render();
    //         } else {
    //             console.error('View is not defined');
    //         }

    //         // map.getAllLayers().forEach((layer: Layer) => {
    //         //   console.log(`layer:`,layer.getProperties());
    //         // });

    //         createLegend();

    //     } else {
    //         console.error('Map is not defined');
    //     }
    // };        

</script>

<template>
    <div class="advanced-user">
        <TwoColumnLayout>
            <template v-slot:sidebar-col>
                <SrSideBar>
                    <template v-slot:sr-sidebar-body>
                        <div class="card flex justify-content-center">
                            <div class="card flex justify-content-center">
                                <SrTextInput
                                    v-model="urlValue"
                                    label="URL:"
                                />
                                <SrMenuInput
                                    v-model="surfaceTypeValue"
                                    label="Surface:"
                                    :menuOptions="surfaceTypeItems" 
                                    default="Land"
                                />
                                <SrSliderInput
                                    v-model="lengthValue"
                                    label="Length:"
                                    :min="5"
                                    :max="200" 
                                    :decimal-places="0"                  
                                />
                                <SrSliderInput
                                    v-model="stepValue"
                                    label="Step:"
                                    :min="5"
                                    :max="100" 
                                    :decimal-places="0"
                                />
                                <SrSliderInput
                                    v-model="confidenceValue"
                                    label="Confidence:"
                                    :min="-2"
                                    :max="4" 
                                    :decimal-places="0"
                                />
                                <SrMenuMultiInput
                                    v-model="selectedLandClassItems"
                                    label="Land Class:"
                                    :menuOptions="landClassItems" 
                                />
                                <SrSliderInput
                                    v-model="iterationsValue"
                                    label="Iterations:"
                                    :min="0"
                                    :max="20" 
                                    :decimal-places="0"
                                />
                                <SrSliderInput
                                    v-model="spreadValue"
                                    label="Spread:"
                                    :min="0"
                                    :max="100.0" 
                                    :decimal-places="1"
                                />
                                <SrSliderInput
                                    v-model="PE_CountValue"
                                    label="PE Count:"
                                    :min="0"
                                    :max="50" 
                                    :decimal-places="0"
                                />
                                <SrSliderInput
                                    v-model="windowValue"
                                    label="Window:"
                                    :min="0.5"
                                    :max="10.0" 
                                    :decimal-places="1"
                                />
                                <SrSliderInput
                                    v-model="sigmaValue"
                                    label="Sigma:"
                                    :min="1.0"
                                    :max="10.0" 
                                    :decimal-places="1"
                                />
                                <SrMenuInput
                                    v-model="surfaceTypeValue"
                                    label="Variable:"
                                    :menuOptions="variableItems" 
                                    default="h_mean"
                                />
                                <SrMenuInput
                                    v-model="surfaceTypeValue"
                                    label="ColorMap:"
                                    :menuOptions="colorMapItems" 
                                    default="viridis"
                                />
                                <SrGraticuleSelect @graticule-click="graticuleClick"/>
                            </div>  
                            <div class="button-spinner-container">
                                <Button label="Run SlideRule" @click="runSlideRuleClicked" :disabled="isLoading"></Button>
                                <ProgressSpinner v-if="isLoading" animationDuration="1.25s" style="width: 3rem; height: 3rem"  />
                            </div>
                           <!-- <div class="runtest-sr-button" >
                                <Button label="Run Test" @click="runTestClicked"></Button>
                            </div> -->
                        </div>
                    </template>
                </SrSideBar>
            </template>
            <template v-slot:main>
                <SrMap />
            </template>
        </TwoColumnLayout>
    </div>
</template>
<style scoped>
    .example-slider-input {
        display: flex;
        align-items: center;
        justify-content: center;
        flex-direction: column;
    }
    .button-spinner-container {
        display: flex;
        align-items: center; /* This will vertically center the spinner with the button */
        justify-content: center; /* Center the content horizontally */
    }
    .runtest-sr-button {
        display: flex;
        align-items: center;
        justify-content: center;
        flex-direction: column;
        margin: 2rem;
    }

</style>