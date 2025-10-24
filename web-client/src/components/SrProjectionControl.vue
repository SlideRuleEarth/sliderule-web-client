<script setup lang="ts">
    import { ref,onMounted } from "vue";
    import { Control } from 'ol/control';
    import { srProjections } from '@/composables/SrProjections';
    import proj4 from 'proj4';
    import { register } from 'ol/proj/proj4';
    import { createLogger } from '@/utils/logger';

    const logger = createLogger('SrProjectionControl');

    const projectionControlElement = ref(null);

    const emit = defineEmits(['projection-control-created', 'update-projection']);

    onMounted(() => {
        //console.log("SrProjectionControl onMounted projectionControlElement:", projectionControlElement.value);
        Object.values(srProjections.value).forEach(projection => {
            logger.debug('Registering projection', { title: projection.title, name: projection.name });
            proj4.defs(projection.name, projection.proj4def);
        });
        register(proj4);
        if (projectionControlElement.value) {
          const customControl = new Control({ element: projectionControlElement.value });
          emit('projection-control-created', customControl);
          //console.log("SrProjectionControl onMounted customControl:", customControl);
        }
    });
    
    function updateProjection(selectedLabel: string) {
        //console.log("updateProjection:", selectedLabel);
        const projection =  Object.values(srProjections.value).find(projection => projection.label === selectedLabel);
        //console.log("updateProjection layer:", layer);
        if (projection) {
            emit('update-projection', projection);
        }
    }
</script>

<template>
  <div ref="projectionControlElement" class="sr-projection-control ol-unselectable ol-control">
    <form class="select-projection" name="select-proj-form">
      <select @change="updateProjection(($event.target as HTMLInputElement).value)" class="sel-proj-menu" name="sr-proj-sel-menu">
        <option v-for="srProjection in srProjections" :value="srProjection.label" :key="srProjection.label">
          {{ srProjection.label }}
        </option>
      </select>
    </form>
  </div>

</template>

<style scoped>

  .ol-control.sr-projection-control .select-projection select {
    color: white;
    background-color: black;
    border-radius: var(--p-border-radius);
  }

  .sr-projection-control .sr-projection-button-box {
    display: flex; /* Aligns children (input and icon) in a row */
    flex-direction: row; /* Stack children horizonally */
    align-items: center; /* Centers children vertically */
    justify-content: center; /* Centers children horizontally */
    margin: 0px;
  }
  
</style>
