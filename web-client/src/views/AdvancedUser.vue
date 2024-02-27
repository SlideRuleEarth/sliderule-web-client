<script setup lang="ts">
    import SrSideBar from "@/components/SrSideBar.vue";
    import TwoColumnLayout from "../layouts/TwoColumnLayout.vue";
    import SrMap from "@/components/SrMap.vue";
    import SrSliderInput from "@/components/SrSliderInput.vue";
    import SrTextInput from "@/components/SrTextInput.vue";
    import SrMenuInput from "@/components/SrMenuInput.vue";
    import Button from 'primevue/button';
    import { onMounted, ref } from 'vue';
    import { watchDebounced } from '@vueuse/core'
    import {useToast} from "primevue/usetoast";
    import { atl06p } from '@/sliderule/icesat2.js';
    import { init } from '@/sliderule/core';
    import ProgressSpinner from 'primevue/progressspinner';
    import { useAdvancedModeStore } from '@/stores/advancedModeStore.js';
    import { createLegend } from '@/composables/SrMapUtils';
    import { addVectorLayer,pnt_cnt } from '@/composables/SrMapUtils';
    import { ElevationData } from '@/composables/SrMapUtils';
    import { useElevationData } from "@/composables/SrMapUtils";
    import { useMapStore } from '@/stores/mapStore';
    import { fromLonLat } from 'ol/proj.js';
    import {useElevationStore} from "@/stores/elevationStore";

    const advancedModeStore = useAdvancedModeStore();
    const elevationStore = useElevationStore();

    const toast = useToast();
    const urlValue = ref('slideruleearth.io');
    const lengthValue = ref(40);
    const stepValue = ref(20);
    const confidenceValue = ref(4);
    const iterationsValue = ref(6);
    const spreadValue = ref(20.0);
    const PE_CountValue = ref(10);
    const windowValue = ref(3.0);
    const sigmaValue = ref(5.0);
    const surfaceTypeValue = ref('Land');
    const surfaceTypeItems = ref([
       { value: 'Land', label: 'Land'},
       { value: 'Ocean', label: 'Ocean'},
       { value: 'Sea Ice', label: 'Sea Ice'},
       { value: 'Land Ice', label: 'Land Ice'},
       { value: 'Inland Water', label: 'Inland Water'},
    ]  );
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
                    recs.push(result["elevation"]);
                }
                cb_count.value += 1;
                //let recs:ElevationData[] = result["elevation"];
                if(cb_count.value === 1) {
                    console.log("atl06p cb first result:", result)
                }
                for (let i = 0; i < recs.length; i++) {
                    let rec = recs[i];
                    if(rec.h_mean < elevationStore.getMin()) {
                        elevationStore.setMin(rec.h_mean);
                    }
                    if(rec.h_mean > elevationStore.getMax()) {
                        elevationStore.setMax(rec.h_mean);
                    }
                }
            },
        };
    
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
                ["ATL03_20181019065445_03150111_005_01.h5"],
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
                addVectorLayer(flatRecs);
                isLoading.value = false;
                console.log("pnt_cnt:",pnt_cnt)
                createLegend();
            });
        
    };

    // Function that is called when the "Run Test" button is clicked
    const runTestClicked = () => {
        console.log('runTestClicked');
        const mapStore = useMapStore();
        const map = mapStore.getMap();
        const ed = [
          {longitude: -77.1230, latitude: 39.0117, elevation: 0},
          {longitude: -77.1230, latitude: 39.0107, elevation: 100},
          {longitude: -77.1230, latitude: 39.0097, elevation: 200},
          {longitude: -77.1230, latitude: 39.0087, elevation: 300},
        ];
        const edArray: ElevationData[] = ed.map(item => {
          let edItem = useElevationData(); // Initialize a new ElevationData object
          edItem.latitude = item.latitude; 
          edItem.longitude = item.longitude;
          edItem.h_mean = item.elevation; // Assuming elevation maps to h_mean
          return edItem;
        });
       
        addVectorLayer(edArray);
        if(map){
            const view = map.getView();
            console.log("Hello World!")
            if (view) {
                console.log("animating view...")
                let center = [-77.1230, 39.0117];
                if (view.getProjection().getUnits() !== 'degrees') {
                    center = fromLonLat(center);
                    console.log("CONVERTED center:",center);
                }
                console.log("center:",center);
                view.animate({
                    center: center,
                    duration: 1000,
                    zoom: 17,
                });
                map.render();
            } else {
                console.error('View is not defined');
            }

            // map.getAllLayers().forEach((layer: Layer) => {
            //   console.log(`layer:`,layer.getProperties());
            // });

            createLegend();

        } else {
            console.error('Map is not defined');
        }
    };        

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
                            </div>  
                            <div class="run-sr-button" >
                                <Button label="Run SlideRule" @click="runSlideRuleClicked"></Button>
                            </div>
                            <div class="runtest-sr-button" >
                                <Button label="Run Test" @click="runTestClicked"></Button>
                            </div>
                            <div class="run-sr-progress-spinner">
                                <ProgressSpinner v-if="isLoading" animationDuration="1.25s" />
                            </div>
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
    .run-sr-button {
        display: flex;
        align-items: center;
        justify-content: center;
        flex-direction: column;
        margin: 2rem;
    }
    .run-sr-progress-spinner {
        display: flex;
        align-items: center;
        justify-content: center;
        flex-direction: column;
        margin: 2rem;
    }
</style>