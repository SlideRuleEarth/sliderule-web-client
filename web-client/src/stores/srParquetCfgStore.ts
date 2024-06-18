import { defineStore } from "pinia";
export const useSrParquetCfgStore = defineStore("srParquetCfg", {
    state: () => ({
        parquetReader:{name:'duckDb',value:'duckDb'},
        parquetReaderOptions: [
            { name: 'duckDb', value: 'duckDb' },
            // { name: 'hyparquet', value: 'hyparquet' },
        ],
    }),
    actions:{
        setParquetReader(parquetReader: {name:string, value:string}) {
            this.parquetReader = parquetReader
        },
        getParquetReader() {
            return this.parquetReader;
        },
    }
});