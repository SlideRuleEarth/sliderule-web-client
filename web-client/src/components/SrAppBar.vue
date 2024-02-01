<script setup lang="ts">

    import Button from 'primevue/button';
    import { onMounted, ref, Ref } from 'vue';
    import { useMapStore } from '@/stores/mapStore';
    import Geocoder from 'ol-geocoder';

    const mapStore = useMapStore();

    const geocoderContainer: Ref<HTMLElement | null> = ref(null);

    const emit = defineEmits(['logo-click','tool-button-click','popular-button-click','about-button-click']);

    const handleLogoClick = () => {
    emit('logo-click');
    };
    const handleToolButtonClick = () => {
    emit('tool-button-click');
    };
    const handlePopularButtonClick = () => {
    emit('popular-button-click');
    };
    const handleAboutButtonClick = () => {
    emit('about-button-click');
    };

    // Define a function to handle the addresschosen event
    function onAddressChosen(evt: any) {
        //console.log(evt);
        // Zoom to the selected location
        const map = mapStore.getMap();
        if(map){
            const view = map.getView();
            if (view) {
                view.animate({
                    center: evt.coordinate,
                    duration: 1000,
                    zoom: 10,
                });
            } else {
                console.error('View is not defined');
            }
        } else {
            console.error('Map is not defined');
        }
    }
    onMounted(() => {
        // Initialize ol-geocoder
        const geocoder = new Geocoder('nominatim', {
        provider: 'osm',
        lang: 'en',
        placeholder: 'Search for ...',
        targetType: 'glass-button',
        limit: 5,
        keepOpen: false,
        });    
        // Listen to geocoder events, e.g., address chosen
        geocoder.on('addresschosen', onAddressChosen);

        if (geocoderContainer.value) {
            geocoderContainer.value.appendChild(geocoder.element);
        }
    });

</script>

<template>
    <div class="container">
        <img src="/IceSat-2_SlideRule_logo.png" alt="SlideRule logo" @click="handleLogoClick" class="logo" />
        <div class="center-content">
            <div ref="geocoderContainer">
            </div>
        </div>
        <div class="right-content">
            <Button icon="pi pi-sliders-h" label="tool" class="p-button-rounded p-button-text" @click="handleToolButtonClick" />
            <Button icon="pi pi-map" label="Popular" class="p-button-rounded p-button-text" @click="handlePopularButtonClick" />
            <Button icon="pi pi-info-circle" label="About" class="p-button-rounded p-button-text" @click="handleAboutButtonClick" />
        </div>
    </div>
</template>
  
<style scoped>
    .container {
        display: flex;
        justify-content: space-between;
        align-items: center;
    }
    
    .center-content {
        display: flex;
        align-items: center;
    }
    
    .right-content {
        display: flex;
        align-items: right;
    }

    .logo {
        height: 50px; /* Adjust as needed */
    }
    .responsive-input {
        width: 100%; /* Full width on smaller screens */
        min-width: 21rem;
    }

    @media (min-width: 600px) { /* Adjust the breakpoint as needed */
        .responsive-input {
            width: 300px; /* Fixed width on larger screens */
        }
    }

    @media (max-width: 768px) {
        .container {
            flex-direction: column;
            align-items: flex-start;
        }

        .right-content {
            width: 100%;
            justify-content: flex-end; /* Align items to the end (right) */
            margin-top: 10px;
        }
    }

    @media (max-width: 480px) {
        .logo {
            height: 40px;
        }

        .right-content {
            flex-direction: column;
            align-items: flex-end; /* Align items to the end (right) */
        }
    }

</style>
  