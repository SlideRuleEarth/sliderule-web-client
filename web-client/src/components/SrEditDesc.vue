<script setup lang="ts">
import { db } from '@/db/SlideRuleDb';
import { ref, watch, onMounted } from 'vue';
import InputText from 'primevue/inputtext';
import FloatLabel from 'primevue/floatlabel';
import { useSrToastStore } from "@/stores/srToastStore";
import { getCenter } from '@/utils/geoUtils';

// Define props first
const props = defineProps({
    reqId: {
        type: Number,
        default: 0
    },
    label: {
        type: String,
        default: 'Description'
    }
});

const descrRef = ref('');

// Watch for changes in the reqId and fetch the description asynchronously
const fetchDescription = async () => {
    //console.log('fetchDescription called with reqId:', props.reqId);
    if (props.reqId !== 0) {
        descrRef.value = await db.getDescription(props.reqId);
        //console.log('fetchDescription called with reqId:', props.reqId,'descrRef.value:', descrRef.value);
        if(!descrRef.value) {
            const status = await db.getStatus(props.reqId);
            if(status === 'success' || status === 'imported') {
                const summary = await db.getWorkerSummary(props.reqId);
                if (summary && summary.extLatLon) {
                    const c = getCenter(summary.extLatLon);
                        // Fetch address data from OpenStreetMap
                    const response = await fetch(
                        `https://nominatim.openstreetmap.org/reverse?format=json&lat=${c.lat}&lon=${c.lon}`
                    );
                    const data = await response.json();
                    const descr = data.display_name;
                    console.log('fetchDescription New Description:', descr);
                    // If display_name is available, update the request record
                    if (data && descr) {
                        descrRef.value = descr;
                        db.updateRequest(props.reqId, {description: descrRef.value} );
                    }
                } else {
                    console.error('fetchDescription No extLatLon found for reqId:', props.reqId);
                    // Handle the case where no extLatLon is found
                }
            } else {
                console.warn('fetchDescription No description available for status:', status);
            }
        } else {
            //console.log('fetchDescription Description:', descrRef.value);
            // Update the store with the fetched description
        }
    } else {
        descrRef.value = 'fetchDescription No description available';
    }
    //console.log('fetchDescription FINAL Description:', descrRef.value);
};

onMounted(fetchDescription);

// Also, watch for changes in the `reqId` prop to re-fetch the description if needed
watch(() => props.reqId, fetchDescription);

const onEditComplete = async (event: Event) => {
    const inputElement = event.target as HTMLInputElement;
    const newValue = inputElement.value.trim();
    descrRef.value = newValue; // Update the specific field with the new value
    await db.updateRequestRecord({ req_id: props.reqId, description: descrRef.value},false);
    useSrToastStore().info('Description Updated', 'You updated the description',2000);
    //console.log('Edit completed, new value:', newValue, 'Description:', descrRef.value);
};
</script>
<template>
    <FloatLabel class="full-width-label">
        <InputText
            v-model="descrRef"
            class="p-inputtext p-component"
            @keydown.enter="onEditComplete"
            @blur="onEditComplete"
        />
        <label v-if="props.label !=''">{{ label }}</label>
    </FloatLabel>   
</template>

<style scoped>
.full-width-label {
    width: 100%;
    display: flex;
    flex-direction: column;
    align-items: center;
}

.p-inputtext {
    width: 100%;
    text-align: center;
}

label {
    width: 100%;
    text-align: center;
    display: block;
}

</style>

<style scoped>
</style>
