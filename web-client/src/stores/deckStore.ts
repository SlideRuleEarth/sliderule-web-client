import { defineStore } from 'pinia';
import {Deck} from '@deck.gl/core/typed';
import {Layer} from 'ol/layer';

export const useDeckStore = defineStore('deck', {
    state: () => ({
        deckLayer: null as any,
        deckInstance: null as any,
    }),
    actions: {
        setDeckLayer(layer:Layer) {
            this.deckLayer = layer;
        },
        setDeckInstance(instance:Deck) {
            this.deckInstance = instance;
        },
    },
});