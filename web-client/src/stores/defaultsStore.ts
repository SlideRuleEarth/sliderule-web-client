import { defineStore } from 'pinia'
import { ref } from 'vue'
import type { CreConfig, BathyConfig, CoreConfig, Icesat2Config, SwotConfig, GediConfig } from '@/types/slideruleDefaultsInterfaces'

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

    const fetchDefaults = async () => {
        if ((fetched.value || loading.value ) ) return
        loading.value = true
        error.value = null
        try {
            const res = await fetch('https://sliderule.slideruleearth.io/source/defaults')
            if (!res.ok) throw new Error(`Failed to fetch: ${res.statusText}`)
            const json = await res.json()

            if (!json || Object.keys(json).length === 0) {
                throw new Error('Fetched defaults are null or empty')
            }
            
            defaults.value = json as SlideRuleDefaults
            fetched.value = true
            console.log('Fetched defaults:', defaults.value)
        } catch (err) {
            error.value = err as Error
        } finally {
            loading.value = false
        }
    }

    const getNestedDefault = async <T = unknown>(
        apiKey: string,
        nestedKey: string
    ): Promise<T | null> => {
        const validKeys: (keyof SlideRuleDefaults)[] = ['core', 'icesat2', 'cre', 'gedi', 'swot', 'bathy']
    
        if (!validKeys.includes(apiKey as keyof SlideRuleDefaults)) {
            console.warn(`Invalid API key: ${apiKey}`)
            return null
        }
    
        await fetchDefaults()
        
        const typedKey = apiKey as keyof SlideRuleDefaults
    
        const fallbackOrder: Partial<Record<keyof SlideRuleDefaults, (keyof SlideRuleDefaults)[]>> = {
            bathy: ['core', 'icesat2', 'bathy'],
            gedi: ['core', 'gedi'],
            swot: ['core', 'swot'],
            cre: ['core', 'cre'],
            core: ['core'],
            icesat2: ['core','icesat2'],
        }
    
        const tryKeys = fallbackOrder[typedKey] || [typedKey]
    
        for (const key of tryKeys) {
            const section = defaults.value?.[key]
            if (section && nestedKey in section) {
                return (section as Record<string, unknown>)[nestedKey] as T
            }
        }
    
        console.warn(`Nested key "${nestedKey}" not found in any fallbacks for "${apiKey}"`)
        return null
    }

    const getNestedMissionDefault = async <T = unknown>(
        missionKey: string, // ICESat-2, GEDI
        nestedKey: string
    ): Promise<T | null> => {
        if(missionKey === 'ICESat-2') {
            return getNestedDefault<T>('icesat2', nestedKey);
        }
        if( missionKey === 'GEDI') {
            return getNestedDefault<T>('gedi', nestedKey);
        }
        console.error(`Invalid mission key: ${missionKey}`);
        return null;
    }

    const getDefaults = async (): Promise<SlideRuleDefaults | null> => {
        await fetchDefaults();
        return defaults.value
    }
    
    
    return {
        loading,
        error,
        fetched,
        defaults,
        getNestedDefault,
        getNestedMissionDefault,  
        getDefaults,
    }
})
