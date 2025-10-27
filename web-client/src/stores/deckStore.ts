import { defineStore } from 'pinia';
import { Deck } from '@deck.gl/core';
import { SELECTED_LAYER_NAME_PREFIX } from '@/types/SrTypes';
import { createLogger } from '@/utils/logger';

const logger = createLogger('DeckStore');

export const useDeckStore = defineStore('deck', {
    state: () => ({
        deckInstance: null as any,
        deckLayers: [] as any[],
        pointSize: 3,
        isDragging: false,
    }),
    actions: {
        setDeckInstance(instance:Deck) {
            //console.log('setDeckInstance to:',instance,'from this.deckInstance:',this.deckInstance);
            this.deckInstance = instance;
        },
        getDeckInstance() {
            return this.deckInstance;
        },
        clearDeckInstance() {
            const startTime = performance.now(); // Start time
            if (this.deckInstance) {
                logger.debug('clearDeckInstance start');
                this.deckLayers = [];
                this.getDeckInstance().setProps({layers:this.getLayers()});
                this.deckInstance.finalize(); // This ensures all resources are properly released.
                this.deckInstance = null;
            } else {
                logger.debug('clearDeckInstance: deckInstance is null');
            }
            const now = performance.now();
            logger.debug('clearDeckInstance completed', { durationMs: now - startTime, endTime: now });
        },
        replaceOrAddLayer(layer:any,name:string): boolean {
            for (let i = 0; i < this.deckLayers.length; i++) {
                if (this.deckLayers[i].id === name) {
                    this.deckLayers[i] = layer;
                    return true;
                }
            }
            this.deckLayers.push(layer);
            return false;
        },
        deleteLayer(layerId:string) {
            for (let i = 0; i < this.deckLayers.length; i++) {
                if (this.deckLayers[i].id === layerId) {
                    this.deckLayers.splice(i,1);
                    this.getDeckInstance().setProps({layers:this.getLayers()});
                    return true;
                }
            }
            return false;
        },
        deleteSelectedLayer() {
            return this.deleteLayer(SELECTED_LAYER_NAME_PREFIX);
        },
        getLayers() {
            // See documentaion for DeckGL layers https://deck.gl/docs/developer-guide/using-layers#updating-layers
            // must create new array
            const newLayers = [];
            const layers = this.deckLayers;
            for (let i = 0; i < layers.length; i++) {
                newLayers.push(layers[i]);
            }
            //console.log('getLayers:',layers);
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