import type { SrRequestSummary } from '@/db/SlideRuleDb';
import type { set } from 'ol/transform';
import { defineStore } from 'pinia';

export const useCurAtl06ReqSumStore = defineStore('curAtl06ReqSum', {
    state: () => ({
        h_mean_min: 100000,
        h_mean_max: -100000,
        h_mean_low: 100000,   // 5th percentile
        h_mean_high: -100000, // 95th percentile
        lat_min: 90,
        lat_max: -90,
        lon_min: 180,
        lon_max: -180,
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
        },
        get_h_mean_Low() {
            return this.h_mean_low;
        },
        get_h_mean_High() {
            return this.h_mean_high;
        },
        set_h_mean_Low(h_mean_low: number) {
            this.h_mean_low = h_mean_low;
        },
        set_h_mean_High(h_mean_high: number) {
            this.h_mean_high = h_mean_high;
        },
        setSummary(srs: SrRequestSummary) {
            if(srs.req_id){
                this.setReqId(srs.req_id);
            }
            if(srs.summary){
                this.set_h_mean_Min(srs.summary.extHMean.minHMean);
                this.set_h_mean_Max(srs.summary.extHMean.maxHMean);
                this.set_lat_Min(srs.summary.extLatLon.minLat);
                this.set_lat_Max(srs.summary.extLatLon.maxLat);
                this.set_lon_Min(srs.summary.extLatLon.minLon);
                this.set_lon_Max(srs.summary.extLatLon.maxLon);
                this.set_h_mean_Low(srs.summary.extHMean.lowHMean);
                this.set_h_mean_High(srs.summary.extHMean.highHMean);
            } else {
                console.error('setSummary() called with null summary:', srs);
            }
        }
    },
});