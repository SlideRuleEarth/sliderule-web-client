import { defineStore } from "pinia";
export const useSrParquetCfgStore = defineStore("srParquetCfg", {
    state: () => ({
        parquetReader:{name:'duckDb',value:'duckDb'},
        parquetReaderOptions: [
            { name: 'duckDb', value: 'duckDb' },
            // { name: 'hyparquet', value: 'hyparquet' },
        ],
        maxNumPntsToDisplay: 50000,
        chunkSizeToRead: 10000,
    }),
    actions:{
        setParquetReader(parquetReader: {name:string, value:string}) {
            this.parquetReader = parquetReader
        },
        getParquetReader() {
            return this.parquetReader;
        },
        setMaxNumPntsToDisplay(maxNumPntsToDisplay: number) {
            this.maxNumPntsToDisplay = maxNumPntsToDisplay
        },
        getMaxNumPntsToDisplay() {
            return this.maxNumPntsToDisplay;
        },
        setChunkSizeToRead(chunkSizeToRead: number) {
            this.chunkSizeToRead = chunkSizeToRead
        },
        getChunkSizeToRead() {
            return this.chunkSizeToRead;
        }

    }
});