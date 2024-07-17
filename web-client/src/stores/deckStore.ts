import { defineStore } from 'pinia';
import { Deck } from '@deck.gl/core';

export const useDeckStore = defineStore('deck', {
    state: () => ({
        deckInstance: null as any,
    }),
    actions: {
        setDeckInstance(instance:Deck) {
            console.log('setDeckInstance:',instance,'this.deckInstance:',this.deckInstance);
            this.deckInstance = instance;
        },
        getDeckInstance() {
            return this.deckInstance;
        },
        clearDeckInstance() {
            if (this.deckInstance) {
                console.warn('clearDeckInstance()');
                this.deckInstance.finalize(); // This ensures all resources are properly released.
                this.deckInstance = null;
            } else {
                console.warn('clearDeckInstance(): deckInstance is null');
            }
        },    
    }
});