
<template>
    <div class="sr-export-panel">
        <SrCustomTooltip ref="tooltipRef"  id="exportBtnTooltip"/>
        <Button
            icon="pi pi-file-export"
            label="Export"
            class="sr-export-btn sr-glow-button"
            :id="id"
            @click="exportButtonClick"
            @mouseover="tooltipRef.showTooltip($event, 'Export this record')"
            @mouseleave="tooltipRef.hideTooltip()"
            variant="text"
            rounded 
        >
        </Button>
        <SrExportDialog
            v-model="showExportDialog"
            :reqId="props.reqId"
        />
    </div>
</template>

<script setup lang="ts">
import { ref } from 'vue';
import SrCustomTooltip from '@/components/SrCustomTooltip.vue';
import SrExportDialog from '@/components/SrExportDialog.vue';
import Button from 'primevue/button';

const props = withDefaults(
    defineProps<{
        reqId: number;
    }>(),
    {
        reqId: 0,
    }
);
const tooltipRef = ref();
const showExportDialog = ref(false);
const exportButtonClick = () => {
    showExportDialog.value = true;
};
const id=`sr-export-btn-${props.reqId}`;

</script>
<style scoped>
.sr-export-panel {
    display: flex;
    justify-content: center;
    align-items: center;
    margin-top: 0.5rem;
    margin-bottom: 0.5rem;
} 
.sr-export-btn{
    min-width: 4rem;
    min-height: 2rem;
}</style>