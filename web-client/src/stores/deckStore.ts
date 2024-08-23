import { defineStore } from 'pinia';
import { Deck } from '@deck.gl/core';
import { SELECTED_LAYER_NAME,EL_LAYER_NAME } from '@/utils/SrMapUtils';

export const useDeckStore = defineStore('deck', {
    state: () => ({
        deckInstance: null as any,
        pointCloudLayers: [] as any[],
        pointSize: 3,
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
        replaceOrAddElLayer(layer:any): boolean {
            for (let i = 0; i < this.pointCloudLayers.length; i++) {
                if (this.pointCloudLayers[i].id === EL_LAYER_NAME) {
                    this.pointCloudLayers[i] = layer;
                    return true;
                    break;
                }
            }
            this.pointCloudLayers.push(layer);
            return false;
        },
        replaceOrAddHighlightLayer(layer:any): boolean {
            const replaced = this.deleteLayer(SELECTED_LAYER_NAME);
            this.pointCloudLayers.push(layer);
            return replaced;
        },
        deleteLayer(layerId:string) {
            for (let i = 0; i < this.pointCloudLayers.length; i++) {
                if (this.pointCloudLayers[i].id === layerId) {
                    this.pointCloudLayers.splice(i,1);
                    return true;
                }
            }
            return false;
        },
        deleteSelectedLayer() {
            for (let i = 0; i < this.pointCloudLayers.length; i++) {
                if (this.pointCloudLayers[i].id === SELECTED_LAYER_NAME) {
                    this.pointCloudLayers.splice(i,1);
                    return true;
                }
            }
            return false;
        },
        getLayers() {
            // See documentaion for DeckGL layers https://deck.gl/docs/developer-guide/using-layers#updating-layers
            // must create new array
            const newLayers = [];
            const layers = this.pointCloudLayers;
            for (let i = 0; i < layers.length; i++) {
                newLayers.push(layers[i]);
            }
            console.log('getLayers:',layers);
            return newLayers;
        },
        setPointSize(size:number) {
            this.pointSize = size;
        },
        getPointSize() {
            return this.pointSize;
        },
    }
});