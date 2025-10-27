import { defineStore } from 'pinia'
import { ref } from 'vue'
import type { CreConfig, BathyConfig, CoreConfig, Icesat2Config, SwotConfig, GediConfig } from '@/types/slideruleDefaultsInterfaces'
import { createLogger } from '@/utils/logger';

const logger = createLogger('DefaultsStore');

export interface SlideRuleDefaults {
    cre: CreConfig
    bathy: BathyConfig
    core: CoreConfig
    icesat2: Icesat2Config
    swot: SwotConfig
    gedi: GediConfig
}

export const useSlideruleDefaults = defineStore('slideruleDefaults', () => {
    const defaults = ref<SlideRuleDefaults | null>(null)
    const loading = ref(false)
    const error = ref<Error | null>(null)
    const fetched = ref(false)

    // --- 1. ONE-TIME FETCHER ---
    async function fetchDefaults() {
        if (fetched.value || loading.value) return;
        loading.value = true;
        error.value = null;
        try {
            const res = await fetch('https://sliderule.slideruleearth.io/source/defaults')
            if (!res.ok) throw new Error(`Failed to fetch: ${res.statusText}`)
            const json = await res.json()
            if (!json || Object.keys(json).length === 0) throw new Error('Fetched defaults are null or empty')
            defaults.value = json as SlideRuleDefaults
            fetched.value = true
            logger.debug('Fetched defaults', { defaults: defaults.value })
        } catch (err) {
            error.value = err as Error
        } finally {
            loading.value = false
        }
    }

    // --- 2. SYNCHRONOUS GETTERS ---
    function getNestedDefault<T = unknown>(apiKey: string, nestedPath: string): T | null {
        const validKeys: (keyof SlideRuleDefaults)[] = ['core', 'icesat2', 'cre', 'gedi', 'swot', 'bathy'];
        if (!defaults.value) throw new Error('getNestedDefault - Defaults not yet loaded');
        if (!validKeys.includes(apiKey as keyof SlideRuleDefaults)) {
            logger.warn('Invalid API key', { apiKey });
            return null;
        }

        const typedKey = apiKey as keyof SlideRuleDefaults;
        const fallbackOrder: Partial<Record<keyof SlideRuleDefaults, (keyof SlideRuleDefaults)[]>> = {
            bathy: ['core', 'icesat2', 'bathy'],
            gedi: ['core', 'gedi'],
            swot: ['core', 'swot'],
            cre: ['core', 'cre'],
            core: ['core'],
            icesat2: ['core', 'icesat2'],
        };
        const tryKeys = fallbackOrder[typedKey] || [typedKey];

        for (const key of tryKeys) {
            let section: any = defaults.value?.[key];
            if (!section) continue;
            const pathParts = nestedPath.split('.');
            let value = section;
            let found = true;
            for (const part of pathParts) {
                if (value && typeof value === 'object' && part in value) {
                    value = value[part];
                } else {
                    found = false;
                    break;
                }
            }
            if (found) return value as T;
        }
        logger.warn('Nested key path not found in any fallbacks', { nestedPath, apiKey });
        return null;
    }


    function getNestedMissionDefault<T = unknown>(missionKey: string, nestedKey: string): T | null {
        if (missionKey === 'ICESat-2') {
            return getNestedDefault<T>('icesat2', nestedKey)
        }
        if (missionKey === 'GEDI') {
            return getNestedDefault<T>('gedi', nestedKey)
        }
        logger.error('Invalid mission key', { missionKey })
        return null
    }

    function getDefaults(): SlideRuleDefaults | null {
        if (!defaults.value) throw new Error('getDefaults - Defaults not yet loaded')
        return defaults.value
    }

    return {
        loading,
        error,
        fetched,
        defaults,
        fetchDefaults, // <-- call ONCE at app startup
        getNestedDefault,
        getNestedMissionDefault,
        getDefaults,
    }
})
