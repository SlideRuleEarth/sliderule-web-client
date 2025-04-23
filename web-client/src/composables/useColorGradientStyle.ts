import { computed, type Ref } from 'vue';

export function useColorGradientStyle(gradientColorMap: Ref<string[]>) {
    const colorGradientStyle = computed(() => {
        const gradientString = gradientColorMap.value.join(', ');
        return {
            background: `linear-gradient(to right, ${gradientString})`,
            height: '10px',
            width: '100%',
        };
    });

    return {
        colorGradientStyle
    };
}
