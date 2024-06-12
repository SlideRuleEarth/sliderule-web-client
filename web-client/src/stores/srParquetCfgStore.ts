import { defineStore } from "pinia";
export const useSrParquetCfgStore = defineStore("srParquetCfg", {
    state: () => ({
        parquetReader:{name:'hyparquet',value:'hyparquet'},
        parquetReaderOptions: [
            { name: 'hyparquet', value: 'hyparquet' },
            { name: 'duckDb', value: 'duckDb' },
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