<script setup lang="ts">
    import { useMapParamsStore } from "@/stores/mapParamsStore.js";
    import { ref,onMounted } from "vue";
    import { Control } from 'ol/control';
    import { projections } from '@/composables/SrProjections.js';
    import proj4 from 'proj4';
    import { register } from 'ol/proj/proj4';
    //import SrProjectionButtonBox from "./SrProjectionButtonBox.vue";

    const projectionControlElement = ref(null);

    const mapParamsStore = useMapParamsStore();

    const emit = defineEmits(['projectionControlCreated', 'updateProjection']);

    onMounted(() => {
        //console.log("SrProjectionControl onMounted projectionControlElement:", projectionControlElement.value);
        if (projectionControlElement.value) {
          const customControl = new Control({ element: projectionControlElement.value });
          emit('projectionControlCreated', customControl);
          //console.log("SrProjectionControl onMounted customControl:", customControl);
        }
        projections.value.forEach(projection => {
            //console.log(`Title: ${projection.title}, Name: ${projection.name}`);
            proj4.defs(projection.name, projection.proj4def);
        });
        register(proj4);

        if (!mapParamsStore.projection) {
            mapParamsStore.projection = projections.value[0];
        }
        updateProjection(mapParamsStore.projection.label);
    });
    
    function updateProjection(selectedLabel: string) {
        //console.log("updateProjection:", selectedLabel);
        const projection = projections.value.find(projection => projection.label === selectedLabel);
        //console.log("updateProjection layer:", layer);
        if (projection) {
            //mapParamsStore.setProjection(projection);
            emit('updateProjection', projection);
            //console.log("updateProjection mapParamsStore.projection:", mapParamsStore.projection);
        }
    }
</script>

<template>
  <div ref="projectionControlElement" class="sr-projection-control ol-unselectable ol-control">
    <form class="select-projection" name="select-proj-form">
      <select @change="updateProjection(($event.target as HTMLInputElement).value)" class="sel-proj-menu" name="sr-proj-sel-menu">
        <option v-for="projection in projections" :value="projection.label" :key="projection.label">
          {{ projection.label }}
        </option>
      </select>
    </form>
    <!-- <SrProjectionButtonBox /> -->
  </div>

</template>

<style scoped>

  .ol-control.sr-projection-control .select-projection select {
    color: white;
    background-color: black;
    border-radius: var(--border-radius);
  }

  .sr-projection-control .sr-projection-button-box {
    display: flex; /* Aligns children (input and icon) in a row */
    flex-direction: row; /* Stack children horizonally */
    align-items: center; /* Centers children vertically */
    justify-content: center; /* Centers children horizontally */
    margin: 0px;
  }
  
</style>
