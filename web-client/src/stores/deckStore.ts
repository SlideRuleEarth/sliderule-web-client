import { defineStore } from 'pinia';
import { Deck } from '@deck.gl/core';

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
                console.warn('clearDeckInstance()');
                this.deckLayers = [];
                this.getDeckInstance().setProps({layers:[]});
                this.deckInstance.finalize(); // This ensures all resources are properly released.
                this.deckInstance = null;
            } else {
                console.warn('clearDeckInstance(): deckInstance is null');
            }
            const now = performance.now();
            console.log(`clearDeckInstance took ${now - startTime} milliseconds. endTime:`,now);
        },
        appendLayer(newLayer: any) {
            this.deckLayers.push(newLayer);
        },
        hideLayersWithSubstr(substr: string): boolean {
            let hidIt = false;
        
            this.deckLayers = this.deckLayers.map(layer => {
                //console.log('hideLayersWithSubstr Checking:', JSON.stringify(substr), 'against', JSON.stringify(layer.id));
        
                if (layer.id.includes(substr)) {
                    //console.log('hideLayersWithSubstr: BEFORE hiding existing Selected layer:', layer);
        
                    // Create a new layer instance with updated visibility
                    const newLayer = new layer.constructor({
                        ...layer.props, // Copy existing properties
                        visible: false, // Set visibility to false
                        id: layer.id + "-updated-" + Date.now(), // Force a new layer instance
                    });
        
                    //console.log('hideLayersWithSubstr: AFTER hiding existing Selected layer:', newLayer);
                    hidIt = true;
                    return newLayer;
                }
        
                return layer; // Keep other layers unchanged
            });
        
            //console.log('hideLayersWithSubstr:', substr, 'hidIt:', hidIt, 'numLayers:', this.deckLayers.length);
            return hidIt;
        },
        layerExists(layerId:string) {
            let foundit = false;
            for (let i = 0; i < this.deckLayers.length; i++) {
                if (this.deckLayers[i].id === layerId) {
                    foundit = true;
                }
            }
            //console.log('layerExists:',layerId,'foundit:',foundit);
            return foundit;
        },
        isLayerVisible(layerId:string) {
            for (let i = 0; i < this.deckLayers.length; i++) {
                if (this.deckLayers[i].id === layerId) {
                    return this.deckLayers[i].visible;
                }
            }
            return false;
        },
        setVisible(layerId: string, visible: boolean): boolean {
            let updated = false;
        
            this.deckLayers = this.deckLayers.map(layer => {
                if (layer.id === layerId) {
                    //console.log('setVisible: BEFORE updating visibility:', layer);
        
                    // Create a new instance of the same layer type with updated properties
                    const newLayer = new layer.constructor({
                        ...layer.props, // Preserve existing properties
                        visible: visible, // Update visibility
                        id: layer.id + "-updated-" + Date.now(), // Force a new layer instance
                    });
        
                    //console.log('setVisible: AFTER updating visibility:', newLayer);
                    updated = true;
                    return newLayer;
                }
                return layer;
            });
        
            return updated;
        },        
        getLayersCopied() {
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
        updatePropsWithShallowCopiedLayers() { // This forces deck to examine each layer for any real changes
            const theLayers = this.getLayersCopied();
            console.log('updatePropsWithShallowCopiedLayers:',theLayers);
            this.deckInstance.setProps({ layers:  theLayers });
        }
        
    }
});