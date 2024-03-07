import { defineStore } from 'pinia';

export const useSrToastStore = defineStore('srToast', {
    state: () => ({
        life: 10000, // default life of a toast in milliseconds (10 seconds)
    }),
    actions: {
        setLife(life: number) {
            this.life = life;
        },
        getLife(): number{
            return this.life;
        }
    },
});