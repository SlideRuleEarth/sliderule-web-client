<script setup lang="ts">
    import { ref,onMounted } from "vue";
    import { Control } from 'ol/control';
    import { srViews } from '@/composables/SrViews';
    import { useMapParamsStore } from "@/stores/mapParamsStore";

    const mapParamsStore = useMapParamsStore();
    const viewControlElement = ref(null);

    const emit = defineEmits(['view-control-created', 'update-view']);

    onMounted(() => {
      console.log("SrViewControl onMounted viewControlElement:", viewControlElement.value);
      if (viewControlElement.value) {
        const customControl = new Control({ element: viewControlElement.value });
        emit('view-control-created',customControl);
      }
    });
    
    function updateView(selectedLabel: string) {
        console.log("updateView:", selectedLabel);
        const view = srViews.value[selectedLabel];
        console.log("updateView view:", view);
        if (view) {
          mapParamsStore.setSrView(view);
          emit('update-view', view);
        }
    }
</script>

<template>
  <div ref="viewControlElement" class="sr-view-control ol-unselectable ol-control">
    <form class="select-view" name="select-proj-form">
      <select @change="updateView(($event.target as HTMLInputElement).value)" class="sel-proj-menu" name="sr-proj-sel-menu">
        <option v-for="srView in srViews" :value="srView.name" :key="srView.name">
          {{ srView.name }}
        </option>
      </select>
    </form>
    <!-- <SrViewButtonBox /> -->
  </div>

</template>

<style scoped>

  .ol-control.sr-view-control .select-view select {
    color: white;
    background-color: black;
    border-radius: var(--border-radius);
  }

  .sr-view-control .sr-view-button-box {
    display: flex; /* Aligns children (input and icon) in a row */
    flex-direction: row; /* Stack children horizonally */
    align-items: center; /* Centers children vertically */
    justify-content: center; /* Centers children horizontally */
    margin: 0px;
  }
  
</style>
