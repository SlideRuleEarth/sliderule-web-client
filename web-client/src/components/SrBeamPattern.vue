<template>
    <div class="checkbox-container p-3">
        <Fieldset
            legend="Beam Pattern"
            :toggleable="false"
            :collapsed="false"
        >
            <!-- Row 1: Spots 1, 2, 3 -->
            <div class="flex gap-4 mb-3">
                <div>
                    <Checkbox :inputId="'spot' + 1" v-model="selectedSpots" value="1" size="small"/>
                    <label :for="'spot' + 1">1</label>
                </div>
                <div>
                    <Checkbox :inputId="'spot' + 2" v-model="selectedSpots" value="2" size="small"/>
                    <label :for="'spot' + 2">2</label>
                </div>
                <div>
                    <Checkbox :inputId="'spot' + 3" v-model="selectedSpots" value="3" size="small"/>
                    <label :for="'spot' + 3">3</label>
                </div>
            </div>
        
            <!-- Row 2: Spots 4, 5, 6 -->
            <div class="flex gap-4">
                <div>
                    <Checkbox :inputId="'spot' + 4" v-model="selectedSpots" value="4" size="small"/>
                    <label :for="'spot' + 4">4</label>
                </div>
                <div>
                    <Checkbox :inputId="'spot' + 5" v-model="selectedSpots" value="5" size="small"/>
                    <label :for="'spot' + 5">5</label>
                </div>
                <div>
                    <Checkbox :inputId="'spot' + 6" v-model="selectedSpots" value="6" size="small"/>
                    <label :for="'spot' + 6">6</label>
                </div>
            </div>
        </Fieldset>
    </div>
</template>
  
<script setup lang="ts">
    import { ref } from 'vue';
    import Checkbox from 'primevue/checkbox';
    import Fieldset from 'primevue/fieldset';
    
    // The array holding the selected checkboxes
    const selectedSpots = ref<string[]>([]);
</script>
    
  <style scoped>
    .checkbox-container {
        /* 
        Use :deep() to target elements/classes that lie beyond the 
        component's scope (for instance, in the child component's DOM). 
        */
        :deep(.flex) {
        display: flex;
        }
    
        :deep(.mb-3) {
        margin-bottom: 1rem;
        }
    
        /* If you're using gap classes (e.g. from a utility library) 
        and need direct styling, you can target them as well: */
        :deep(.gap-4) {
        gap: 1rem;
        }
    
        /* Or, if you prefer margins between child elements instead of gap: 
        :deep(.gap-4 > * + *) {
            margin-left: 1rem;
        } 
        */
    }
</style>
  