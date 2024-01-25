<script setup lang="ts">
    import SrSideBar from "@/components/SrSideBar.vue";
    import TwoColumnLayout from "../layouts/TwoColumnLayout.vue";
    import SrMap from "@/components/SrMap.vue";
    import SrSliderInput from "@/components/SrSliderInput.vue";
    import Button from 'primevue/button';
    import { onMounted, ref } from 'vue';
    import { watchDebounced } from '@vueuse/core'
    import {useToast} from "primevue/usetoast";
    import { atl06p } from '@/sliderule/icesat2.js';
    import { init } from '@/sliderule/core.js';


    const toast = useToast();

    const stepValue = ref(10);

    onMounted(() => {
        console.log('AdvancedUser onMounted');
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
    const runSlideRuleClicked = () => {
        // console.log('logoClick');
        toast.add({ severity: 'info', summary: 'Run', detail: 'RunSlideRule was clicked', life: 3000 });
        console.log("runSlideRuleClicked typeof atl06p:",typeof atl06p);
        console.log("runSlideRuleClicked atl06p:", atl06p);
        atl06p(
            { "cnf": "atl03_high",
            "ats": 20.0,
            "cnt": 10,
            "len": 40.0,
            "res": 20.0,
            "maxi": 1 }, 
            ["ATL03_20181019065445_03150111_005_01.h5"])
        .then(result => {
            // Log the result to the console
            console.log('runSlideRuleClicked Results = ', result.length, result[0]);

            // Display a toast message indicating successful completion
            toast.add({
                severity: 'success', // Use 'success' severity for successful operations
                summary: 'Success', // A short summary of the outcome
                detail: 'RunSlideRule completed successfully.', // A more detailed success message
                life: 5000 // Adjust the duration as needed
            });
        })
        .catch((error => {
            // Log the error to the console
            console.error('runSlideRuleClicked Error = ', error);

            // Display a toast message indicating the error
            toast.add({
                severity: 'error', // Use 'error' severity for error messages
                summary: 'Error', // A short summary of the error
                detail: 'An error occurred while running SlideRule.', // A more detailed error message
                life: 5000 // Adjust the duration as needed
            });
        }));
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
                                <SrSliderInput
                                    v-model="stepValue"
                                    label="Step:"
                                    :min="0"
                                    :max="100" 
                                    :decimal-places="2"                   
                                />
                            </div>  
                            <div class="run-sr-button" >
                                <Button label="Run SlideRule" @click="runSlideRuleClicked"></Button>
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
</style>