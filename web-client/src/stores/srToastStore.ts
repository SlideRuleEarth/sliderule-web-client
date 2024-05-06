import { defineStore } from 'pinia';

export const useSrToastStore = defineStore('srToast', {
    state: () => ({
        life: 60000,//5000, // default life of a toast in milliseconds (5 seconds)
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