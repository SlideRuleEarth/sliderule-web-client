import { defineStore } from 'pinia';
import { Deck } from '@deck.gl/core';
import { SELECTED_LAYER_NAME } from '@/utils/SrMapUtils';

export const useDeckStore = defineStore('deck', {
    state: () => ({
        deckInstance: null as any,
        pointCloudLayers: [] as any[],
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
        addLayer(layer:any) { 
            this.pointCloudLayers.push(layer);
            //console.log('addLayer:',layer);
        },
        replaceOrAddHighlightLayer(layer:any): boolean {
            for (let i = 0; i < this.pointCloudLayers.length; i++) {
                if (this.pointCloudLayers[i].id === SELECTED_LAYER_NAME) {
                    this.pointCloudLayers[i] = layer;
                    return true;
                    break;
                }
            }
            this.pointCloudLayers.push(layer);
            return false;
        },
        getLayers() {
            const newLayers = [];
            const layers = this.pointCloudLayers;
            for (let i = 0; i < layers.length; i++) {
                newLayers.push(layers[i]);
            }
            //console.log('getLayers:',layers);
            return newLayers;
        }
    }
});