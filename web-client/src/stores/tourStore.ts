import { defineStore } from 'pinia';
import { ref } from 'vue';

export const useTourStore = defineStore('tour', () => {
    const hasSeenIntro = ref(false);

    function markSeen() {
        hasSeenIntro.value = true;
        localStorage.setItem('srTourSeen', 'true');
    }

    function checkSeen() {
        hasSeenIntro.value = localStorage.getItem('srTourSeen') === 'true';
    }

    function resetTour() {
        hasSeenIntro.value = false;
        localStorage.removeItem('srTourSeen');
    }


    return {
        hasSeenIntro,
        markSeen,
        checkSeen,
        resetTour
    };
});
