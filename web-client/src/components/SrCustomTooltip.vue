<template>
  <Teleport to="body">
    <div class="tooltip" :id="props.id" v-if="visible" :style="tooltipStyle" v-html="text"></div>
  </Teleport>
</template>

<script setup lang="ts">
import { ref, nextTick } from 'vue';
import { Teleport } from 'vue';
import DOMPurify from 'dompurify';

const props = defineProps<{ id: string }>();

const visible = ref(false);
const text = ref('');
const tooltipStyle = ref<Record<string, string>>({});

const showTooltip = async (event: MouseEvent, content: string | undefined) => {
    if (!content) {
        console.warn('Tooltip content is undefined or empty:', content);
        return;
    }

    // Sanitize HTML content
    const sanitized = DOMPurify.sanitize(content);
    text.value = sanitized;
    visible.value = true;

    await nextTick(); // Ensure tooltip is rendered

    const tooltipEl = document.getElementById(props.id) as HTMLElement | null;
    const tooltipRect = tooltipEl?.getBoundingClientRect();
    const { clientX: x, clientY: y } = event;
    const tooltipOffset = 10;

    const windowWidth = window.innerWidth;
    const windowHeight = window.innerHeight;

    let left = x + tooltipOffset;
    let top = y + tooltipOffset;

    if (tooltipRect) {
        if (left + tooltipRect.width > windowWidth) {
            left = x - tooltipRect.width - tooltipOffset;
        }
        if (top + tooltipRect.height > windowHeight) {
            top = y - tooltipRect.height - tooltipOffset;
        }
    }

    tooltipStyle.value = {
        top: `${Math.max(0, top)}px`,
        left: `${Math.max(0, left)}px`
    };
    //console.log('x:',x,'y',y,'Tooltip style:', tooltipStyle.value,'Tooltip element:', tooltipEl, 'Rect:', tooltipRect);
};

const hideTooltip = () => {
    visible.value = false;
};

defineExpose({
    showTooltip,
    hideTooltip
});
</script>

<style scoped>
.tooltip {
    position: absolute;
    background-color: #333;
    color: #fff;
    padding: 5px 8px;
    border-radius: 4px;
    z-index: 1000;
    max-width: 15rem;
    font-size: 0.875rem;
    line-height: 1.25rem;
    pointer-events: none;
    white-space: normal;
    word-break: break-word;
}
</style>
