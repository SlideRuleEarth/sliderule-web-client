import { defineStore } from 'pinia';
import { Deck } from '@deck.gl/core';
import { ScatterplotLayer } from '@deck.gl/layers';
import { SELECTED_LAYER_NAME_PREFIX,EL_LAYER_NAME_PREFIX } from '@/utils/SrMapUtils';
import { generateNameSuffix } from '@/utils/SrMapUtils';

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
            // This creates new objects so deck will recognize not ignore them
            // Check if the any of the existing layer's id contains SELECTED_LAYER_NAME_PREFIX
            this.deckLayers = this.deckLayers.map(layer =>
                layer.id.includes(SELECTED_LAYER_NAME_PREFIX)
                  ? new ScatterplotLayer({ // must create a new layer so deck doesn't ignore the change
                      ...layer.props,
                      // same ID, but visible now set to false
                      id: layer.id,
                      visible: false
                    })
                  : layer
            ); 
            let found = false;       
            // If it is not in the existing set then add the new layer
            for (let i = 0; i < this.deckLayers.length; i++) {
                if (this.deckLayers[i].id === newLayer.id) {
                    console.log('appendLayer: layer already exists:',newLayer.id);
                    found = true;
                    break;
                }
            }
            if(found){
                new ScatterplotLayer({ // must create a new layer so deck doesn't ignore the change
                    ...newLayer.props,
                    // same ID, but visible now set to true
                    id: newLayer.id,
                    visible: true
                  })
            }
            this.deckLayers.push(newLayer);
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
        getLayers() {
            return this.deckLayers;
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
        updatePropsWithLayers(){ // this causes it to be drawn
            const theLayers = this.getLayers();
            console.log('updatePropsWithLayers:',theLayers);
            this.deckInstance.setProps({layers:theLayers});
        }
    }
});