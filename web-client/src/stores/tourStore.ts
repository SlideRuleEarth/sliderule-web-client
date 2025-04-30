// useTourStore.ts
import { defineStore } from 'pinia';

export const useTourStore = defineStore('tour', {
    state: () => ({
        hasSeenIntro: false,
    }),
    actions: {
        markSeen() {
            this.hasSeenIntro = true;
            localStorage.setItem('srTourSeen', 'true');
        },
        checkSeen() {
            this.hasSeenIntro = localStorage.getItem('srTourSeen') === 'true';
        }
    }
});
