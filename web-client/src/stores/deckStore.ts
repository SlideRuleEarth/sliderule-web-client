import { defineStore } from 'pinia';
import { Deck } from '@deck.gl/core';
import { SELECTED_LAYER_NAME_PREFIX,EL_LAYER_NAME_PREFIX } from '@/utils/SrMapUtils';

export const useDeckStore = defineStore('deck', {
    state: () => ({
        deckInstance: null as any,
        pointCloudLayers: [] as any[],
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
                this.pointCloudLayers = [];
                this.getDeckInstance().setProps({layers:[]});
                this.deckInstance.finalize(); // This ensures all resources are properly released.
                this.deckInstance = null;
            } else {
                console.warn('clearDeckInstance(): deckInstance is null');
            }
            const now = performance.now();
            console.log(`clearDeckInstance took ${now - startTime} milliseconds. endTime:`,now);
        },
        replaceOrAddLayer(layer: any, name: string): boolean {
          // 1) Replace if found
          let found = false;
          for (let i = 0; i < this.pointCloudLayers.length; i++) {
            if (this.pointCloudLayers[i].id === name) {
              this.pointCloudLayers[i] = layer;
              found = true;
              break;
            }
          }
          // 2) Otherwise add
          if (!found) {
            this.pointCloudLayers.push(layer);
          }
        
          // 3) Always ensure the highlight layer is last in the array
          const idx = this.pointCloudLayers.findIndex(l => l.id === SELECTED_LAYER_NAME_PREFIX);
          if (idx !== -1) {
            const [highlightLayer] = this.pointCloudLayers.splice(idx, 1);
            // push it so it's guaranteed at the end
            this.pointCloudLayers.push(highlightLayer);
          }
        
          return found;
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
        getLayers() {
            // See documentaion for DeckGL layers https://deck.gl/docs/developer-guide/using-layers#updating-layers
            // must create new array
            const newLayers = [];
            const layers = this.pointCloudLayers;
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
        updatePropsWithLayers(){ // this causes it to be drawn
            const theLayers = this.getLayers();
            console.log('updatePropsWithLayers:',theLayers);
            this.deckInstance.setProps({layers:theLayers});
        }
    }
});