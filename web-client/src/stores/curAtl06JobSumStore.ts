import { defineStore } from 'pinia';

export const useCurAtl06JobSumStore = defineStore('curAtl06JobSum', {
    state: () => ({
        h_mean_min: 100000,
        h_mean_max: -100000,
        lat_min: -90,
        lat_max: 90,
        lon_min: -180,
        lon_max: 180,
        num_recs: 0,
        req_id: 0,
        duration: 0,
    }),
    actions: {
        set_h_mean_Min(h_mean_min: number) {
            this.h_mean_min = h_mean_min;
        },
        set_h_mean_Max(h_mean_max: number) {
            this.h_mean_max = h_mean_max;
        },
        get_h_mean_Min() {
            return this.h_mean_min;
        },
        get_h_mean_Max() {
            return this.h_mean_max;
        },
        set_lat_Min(lat_min: number) {
            this.lat_min = lat_min;
        },
        set_lat_Max(lat_max: number) {
            this.lat_max = lat_max;
        },
        get_lat_Min() {
            return this.lat_min;
        },
        get_lat_Max() {
            return this.lat_max;
        },
        set_lon_Min(lon_min: number) {
            this.lon_min = lon_min;
        },
        set_lon_Max(lon_max: number) {
            this.lon_max = lon_max;
        },
        get_lon_Min() {
            return this.lon_min;
        },
        get_lon_Max() {
            return this.lon_max;
        },
        setReqId(req_id: number) {
            this.req_id = req_id;
        },
        getReqId() {
            return this.req_id;
        },
        setNumRecs(num_recs: number) {
            this.num_recs = num_recs;
        },
        addNumRecs(num_recs: number) {
            this.num_recs += num_recs;
        },
        getNumRecs() {
            return this.num_recs;
        }
    },
});