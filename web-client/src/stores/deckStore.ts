import { defineStore } from 'pinia';
import { Deck } from '@deck.gl/core';
import { SELECTED_LAYER_NAME,EL_LAYER_NAME } from '@/utils/SrMapUtils';

export const useDeckStore = defineStore('deck', {
    state: () => ({
        deckInstance: null as any,
        pointCloudLayers: [] as any[],
        pointSize: 3,
        isDragging: false,
    }),
    actions: {
        setDeckInstance(instance:Deck) {
            //console.log('setDeckInstance to:',instance,' from this.deckInstance:',this.deckInstance);
            this.deckInstance = instance;
        },
        getDeckInstance() {
            return this.deckInstance;
        },
        clearDeckInstance() {
            const startTime = performance.now(); // Start time
            if (this.deckInstance) {
                console.warn('clearDeckInstance()');
                this.pointCloudLayers = [];
                this.getDeckInstance().setProps({layers:this.getLayers()});
                this.deckInstance.finalize(); // This ensures all resources are properly released.
                this.deckInstance = null;
            } else {
                console.warn('clearDeckInstance(): deckInstance is null');
            }
            const now = performance.now();
            console.log(`clearDeckInstance took ${now - startTime} milliseconds. endTime:`,now);
        },
        replaceOrAddLayer(layer:any,name:string): boolean {
            for (let i = 0; i < this.pointCloudLayers.length; i++) {
                if (this.pointCloudLayers[i].id === name) {
                    this.pointCloudLayers[i] = layer;
                    return true;
                }
            }
            this.pointCloudLayers.push(layer);
            return false;
        },
        deleteLayer(layerId:string) {
            for (let i = 0; i < this.pointCloudLayers.length; i++) {
                if (this.pointCloudLayers[i].id === layerId) {
                    this.pointCloudLayers.splice(i,1);
                    this.getDeckInstance().setProps({layers:this.getLayers()});
                    return true;
                }
            }
            return false;
        },
        deleteSelectedLayer() {
            return this.deleteLayer(SELECTED_LAYER_NAME);
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
        setIsDragging(isDragging: boolean) {
            this.isDragging = isDragging;
        },
        getIsDragging(): boolean {
            return this.isDragging;
        },
    }
});