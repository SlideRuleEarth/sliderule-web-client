// src/composables/useViewportHeight.ts
import { ref, onMounted, onBeforeUnmount } from 'vue';

export function useViewportHeight() {
    const viewportHeight = ref(window.innerHeight);

    const setVh = () => {
        const vh = window.innerHeight * 0.01;
        document.documentElement.style.setProperty('--vh', `${vh}px`);
        viewportHeight.value = window.innerHeight;
    };

    onMounted(() => {
        setVh();
        window.addEventListener('resize', setVh);
    });

    onBeforeUnmount(() => {
        window.removeEventListener('resize', setVh);
    });

    return {
        viewportHeight,
    };
}
