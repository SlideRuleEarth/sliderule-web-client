import { defineStore } from "pinia";
export const useSrParquetCfgStore = defineStore("srParquetCfg", {
    state: () => ({
        parquetReader:{name:'hyparquet',value:'hyparquet'},
        parquetReaderOptions: [
            { name: 'hyparquet', value: 'hyparquet' },
            { name: 'parquetjs', value: 'parquetjs' },
            // { name: 'pyarrow', value: 'pyarrow' },
            // { name: 'fastparquet', value: 'fastparquet' },
            // { name: 'pandas', value: 'pandas' },
            // { name: 'dask', value: 'dask' },
            // { name: 'dask-cudf', value: 'dask-cudf' },
            // { name: 'dask-cuda', value: 'dask-cuda' },
            // { name: 'dask-cudf', value: 'dask-cudf' },
            // { name: 'dask-cudf', value: 'dask-cudf' },
            // { name: 'dask-cudf', value: 'dask-cudf' },
            // { name: 'dask-cudf', value: 'dask-cudf' },
            // { name: 'dask-cudf', value: 'dask-cudf' },
            // { name: 'dask-cudf', value: 'dask-cudf' },
            // { name: 'dask-cudf', value: 'dask-cudf' },
            // { name: 'dask-cudf', value: 'dask-cudf' },
            // { name: 'dask-cudf', value: 'dask-cudf' },
            // { name: 'dask-cudf', value: 'dask-cudf' },
            // { name: 'dask-cudf', value: 'dask-cudf' },
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