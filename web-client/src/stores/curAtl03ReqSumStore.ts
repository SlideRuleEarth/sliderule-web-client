import { defineStore } from 'pinia';

export const useCurAtl03ReqStore = defineStore('curAtl03Req', {
    state: () => ({
        num_atl03_recs: 0,
        num_arrow_data_recs: 0,
        num_arrow_meta_recs: 0,
        num_exceptions: 0,
        tgt_atl03_recs: 0,
        tgt_arrow_data_recs: 0,
        tgt_arrow_meta_recs: 0,
        tgt_exceptions: 0,
        read_state: 'idle',
        req_id: 0,
    }),
    actions: {
        setReqId(req_id: number) {
            this.req_id = req_id;
        },
        getReqId() {
            return this.req_id;
        },
        setNumAtl03Recs(num_atl03_recs: number) {
            this.num_atl03_recs = num_atl03_recs;
        },
        getNumAtl03Recs() {
            return this.num_atl03_recs;
        },
        setNumArrowDataRecs(num_arrow_data_recs: number) {
            this.num_arrow_data_recs = num_arrow_data_recs;
        },
        getNumArrowDataRecs() {
            return this.num_arrow_data_recs;
        },
        setNumArrowMetaRecs(num_arrow_meta_recs: number) {
            this.num_arrow_meta_recs = num_arrow_meta_recs;
        },
        getNumArrowMetaRecs() {
            return this.num_arrow_meta_recs;
        },
        setTgtAtl03Recs(tgt_atl03_recs: number) {
            this.tgt_atl03_recs = tgt_atl03_recs;
        },
        getTgtAtl03Recs() {
            return this.tgt_atl03_recs;
        },
        setTgtArrowDataRecs(tgt_arrow_data_recs: number) {
            this.tgt_arrow_data_recs = tgt_arrow_data_recs;
        },
        getTgtArrowDataRecs() {
            return this.tgt_arrow_data_recs;
        },
        setTgtArrowMetaRecs(tgt_arrow_meta_recs: number) {
            this.tgt_arrow_meta_recs = tgt_arrow_meta_recs;
        },
        getTgtArrowMetaRecs() {
            return this.tgt_arrow_meta_recs;
        },
        setNumExceptions(num_exceptions: number) {
            this.num_exceptions = num_exceptions;
        },
        getNumExceptions() {
            return this.num_exceptions;
        },
        setTgtExceptions(tgt_exceptions: number) {
            this.tgt_exceptions = tgt_exceptions;
        },
        getTgtExceptions() {
            return this.tgt_exceptions;
        },
        setReadState(read_state: string) {
            this.read_state = read_state;
        },
        getReadState() {
            return this.read_state;
        },

    }
});