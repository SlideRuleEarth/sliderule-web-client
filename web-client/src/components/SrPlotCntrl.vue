<template>
    <Fieldset :legend="getOverlayedReqLegend(reqIdStr)">
        <div class="sr-ydata-menu">
            <label
                class="sr-y-data-label"
                :for="`srYdataItems-overlayed-${reqIdStr}`"
            >
                Y Data
            </label> 
            <Select
                class="sr-select-ydata"
                v-model="yDataSelectedReactive[reqIdStr]"
                :options="chartStore.getYDataOptions(reqIdStr)"
                placeholder="Select Y data"
                :id="`srYdataItems-overlayed-${reqIdStr}`"
                size="small"
            />
        </div>
        <div class="sr-ydata-menu">
            <label
                class="sr-y-data-label"
                :for="`srYColEncode-overlayed-${reqIdStr}`"
            >
                Color Encode
            </label>
            <Select
                class="sr-select-col-encode-data"
                v-model="yColorEncodeSelectedReactive[reqIdStr]"
                :options="chartStore.getYDataOptions(reqIdStr)"
                placeholder="Select Color Encode With"
                :id="`srYColEncode-overlayed-${reqIdStr}`"
                size="small"
            />
        </div>
        <div>
            <SrSymbolSize
                :reqIdStr="reqIdStr"
                @update:symbolSize="handleSymbolSizeUpdate"
            />
        </div>
    </Fieldset>
</template>
  
  <script setup lang="ts">
  import { reactive, computed } from 'vue';
  import { useChartStore } from '@/stores/chartStore';
  import SrSymbolSize from '@/components/SrSymbolSize.vue';
  
  const props = defineProps<{ reqIdStr: string }>();
  
  const chartStore = useChartStore();
  const yDataSelectedReactive = reactive<Record<string, string>>({});
  const yColorEncodeSelectedReactive = reactive<Record<string, string>>({});
  
  const getOverlayedReqLegend = (reqIdStr: string): string =>
    `Overlayed Req ${reqIdStr}`;
  
  const handleSymbolSizeUpdate = (newSymbolSize: number) => {
    console.log(`Updated symbol size for ${props.reqIdStr}:`, newSymbolSize);
  };
  </script>
  
  <style scoped>

.sr-ydata-menu {
    display: inline-flex; /* Allow the container to shrink-wrap its content */
    flex-direction: column;
    justify-content: center;
    align-items: flex-start; /* Align content to the left */
    gap: 0.5rem; /* Add spacing between elements */
    width: auto; /* Let the container size itself based on the content */
    padding: 0.5rem; /* Optional: Add some padding for spacing */
}
.sr-y-data-label {
    margin: 0;
    font-size: small;
}
.sr-select-col-encode-data,
.sr-select-y-data {
    width: 100%;
    margin: 0.25rem;
}
  </style>
  