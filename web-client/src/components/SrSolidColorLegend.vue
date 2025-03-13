  <template>
    <div v-if=(computedDisplayIt)>
        <div class="sr-legend-box" :style="{ background: props.transparentBackground ? 'transparent' : 'rgba(255, 255, 255, 0.25)' }" >
            <span class="sr-legend-name"> {{ computedTitle }} </span>
            <div class="sr-legend-row">
                <div class="sr-solid-color-box" :style="{  background: computedSolidColor, height: '0.75rem',  width: '0.75rem', border: '1px solid transparent' }">
                </div>
                <span class="sr-legend-name"> {{ computedHFieldName }} </span>
            </div>
        </div>
    </div>
  </template>

<script setup lang="ts">
import { onMounted, ref } from 'vue';
import { useChartStore } from '@/stores/chartStore';
import { computed, watch } from 'vue';
import { getHFieldNameForFuncStr } from "@/utils/SrDuckDbUtils";
import { useRecTreeStore } from '@/stores/recTreeStore';
const recTreeStore = useRecTreeStore();

// Props definition
const props = withDefaults(
  defineProps<{
    reqIdStr: string;
    data_key: string;
    transparentBackground?: boolean;
  }>(),
  {
    reqIdStr: '',
    data_key: '',
    transparentBackground: false,
  }
);

const chartStore = useChartStore();

const computedDisplayIt = computed(() => {
  return ( chartStore.getMinValue(props.reqIdStr, computedHFieldName) !== null && chartStore.getMaxValue(props.reqIdStr, computedHFieldName) !== null);
});

const computedSolidColor = computed(() => {
  return chartStore.getSolidSymbolColor(props.reqIdStr);
})

const computedReqId = computed(() => {
  return Number(props.reqId);
});

const computedHFieldName = computed(() => {
  return getHFieldNameForFuncStr(recTreeStore.selectedApi);
});

const computedTitle = computed(() => {
  return recTreeStore.selectedApi
    ? recTreeStore.selectedApi.charAt(0).toUpperCase() + recTreeStore.selectedApi.slice(1) + ' Colors'
    : 'Colors';
});


const emit = defineEmits(['color-legendbox-created']);


onMounted(async () => {
  emit('color-legendbox-created');
});

</script>

<style scoped>
.sr-legend-box {
  display: flex;
  flex-direction: column;
  justify-content: center;
  align-items: center;
  padding: 0.3125rem;
  color: var(--p-primary-color);
  background-color: transparent;
  border-radius: var(--p-border-radius);
  border: 1px solid var(--p-fieldset-border-color); /* to match other dialogs with fieldsets */
  transition: border 0.3s ease-in-out; /* Smooth transition effect */
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.3);
}
.sr-legend-row {
    display: flex;
    flex-direction: row;
    align-items: center;
    justify-content: center;
    gap: 0.25rem; /* 4px equivalent */
}
.sr-legend-box:hover {
  background-color: transparent;
  border: 1px solid var(--p-primary-color); /* Show border on hover */
}

.sr-solid-color-box {
  border: 1px solid #ccc; /* Optional styling for better visibility */
  margin-top: 5px; /* Optional spacing */
}

.sr-legend-name {
  font-size: 0.7rem; /* a little bit smaller */
  padding-left: 0.25rem;
  padding-right: 0.25rem;
}
</style>
