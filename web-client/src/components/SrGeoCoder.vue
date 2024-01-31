<script setup>
import InputText from 'primevue/inputtext';
import Button from 'primevue/button';
import { onMounted } from 'vue';
import { Geocoder } from 'ol-geocoder';
import { useMapParamsStore } from "@/stores/mapParamsStore.js";

const emit = defineEmits(['geo-search-button-click']);
const mapParamsStore = useMapParamsStore();

const handleGeoSearchButtonClick = () => {
  emit('geo-search-button-click',searchText.value);
  console.log('handleGeoSearchButtonClick',searchText.value);
};
onMounted(() => {

  const popup = new ol.Overlay.Popup();

  // Instantiate with some options and add the Control
  const geocoder = new Geocoder('nominatim', {
    provider: 'osm',
    targetType: 'text-input',
    lang: 'en',
    label: 'Find a location by name',
    placeholder: 'Search for ...',
    limit: 5,
    keepOpen: false,
  });

  mapParamsStore.map.addControl(geocoder);
  mapParamsStore.map.addOverlay(popup);

  // Listen when an address is chosen
  geocoder.on('addresschosen', (evt) => {
    setTimeout(() => {
      popup.show(evt.coordinate, evt.address.formatted);
    }, 3000);
  });
});

</script>

<template>
    <div class="center-content">
        <Button icon="pi pi-search" class="p-button-rounded p-button-text" @click="handleGeoSearchButtonClick" />
        <InputText v-model="searchText" placeholder="Search Location, coordinates and more" class="responsive-input" />
    </div>
</template>