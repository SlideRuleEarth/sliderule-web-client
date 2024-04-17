import { defineStore } from 'pinia';
import { Deck } from '@deck.gl/core/typed';

export const useDeckStore = defineStore('deck', {
    state: () => ({
        deckInstance: null as any,
    }),
    actions: {
        setDeckInstance(instance:Deck) {
            this.deckInstance = instance;
        },
        getDeckInstance() {
            return this.deckInstance;
        }
    },
});