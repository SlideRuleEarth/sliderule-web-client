import { defineStore } from 'pinia';
import {app} from '@/main';

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
        },
        error(title: string = 'I am title', body: string = 'I am body'): void {
            app.config.globalProperties.$toast.add({severity: 'error', summary: title, detail: body, life: this.life});
        },
        success(title: string = 'I am title', body: string = 'I am body'): void {
            app.config.globalProperties.$toast.add({severity: 'success', summary: title, detail: body, life: this.life});
        },
        info(title: string = 'I am title', body: string = 'I am body'): void {
            app.config.globalProperties.$toast.add({severity: 'info', summary: title, detail: body, life: this.life});
        },
        warn(title: string = 'I am title', body: string = 'I am body'): void {
            app.config.globalProperties.$toast.add({severity: 'warn', summary: title, detail: body, life: this.life});
        },
    },
});