import type { SrRequestSummary } from '@/db/SlideRuleDb';
import type { SrParquetPathTypeJsType } from '@/utils/SrParquetUtils';
import { defineStore } from 'pinia';
export const useCurReqSumStore = defineStore('curAtl06ReqSum', {
    state: () => ({
      h_mean_min: 100000,
      h_mean_max: -100000,
      h_mean_low: 100000,   // 5th percentile
      h_mean_high: -100000, // 95th percentile
      lat_min: 90,
      lat_max: -90,
      lon_min: 180,
      lon_max: -180,
      num_arrow_data_recs: 0,
      num_arrow_meta_recs: 0,
      num_exceptions: 0,
      tgt_arrow_data_recs: 0,
      tgt_arrow_meta_recs: 0,
      tgt_exceptions: 0,
      read_state: 'idle',
      duration: 0,
      percent_complete: 0,
      allFieldTypes: [] as SrParquetPathTypeJsType[],
      allFieldNames: [] as string[],
      hMeanNdx: -1,
      latNdx: -1,
      lonNdx: -1,
      overlayNdx: -1,
    }),
    getters: {
      hMeanMin: (state) => state.h_mean_min,
      hMeanMax: (state) => state.h_mean_max,
      latMin: (state) => state.lat_min,
      latMax: (state) => state.lat_max,
      lonMin: (state) => state.lon_min,
      lonMax: (state) => state.lon_max,
      numArrowDataRecs: (state) => state.num_arrow_data_recs,
      numArrowMetaRecs: (state) => state.num_arrow_meta_recs,
      tgtArrowDataRecs: (state) => state.tgt_arrow_data_recs,
      tgtArrowMetaRecs: (state) => state.tgt_arrow_meta_recs,
      numExceptions: (state) => state.num_exceptions,
      tgtExceptions: (state) => state.tgt_exceptions,
      readState: (state) => state.read_state,
      hMeanLow: (state) => state.h_mean_low,
      hMeanHigh: (state) => state.h_mean_high,
      percentComplete: (state) => Math.floor(state.percent_complete),
      overlayNdx: (state) => state.overlayNdx,
    },
    actions: {
      set_h_mean_Min(h_mean_min: number) {
        this.h_mean_min = h_mean_min;
      },
      set_h_mean_Max(h_mean_max: number) {
        this.h_mean_max = h_mean_max;
      },
      set_lat_Min(lat_min: number) {
        this.lat_min = lat_min;
      },
      set_lat_Max(lat_max: number) {
        this.lat_max = lat_max;
      },
      set_lon_Min(lon_min: number) {
        this.lon_min = lon_min;
      },
      set_lon_Max(lon_max: number) {
        this.lon_max = lon_max;
      },
      setNumArrowDataRecs(num_arrow_data_recs: number) {
        this.num_arrow_data_recs = num_arrow_data_recs;
      },
      setNumArrowMetaRecs(num_arrow_meta_recs: number) {
        this.num_arrow_meta_recs = num_arrow_meta_recs;
      },
      setTgtArrowDataRecs(tgt_arrow_data_recs: number) {
        this.tgt_arrow_data_recs = tgt_arrow_data_recs;
      },
      setTgtArrowMetaRecs(tgt_arrow_meta_recs: number) {
        this.tgt_arrow_meta_recs = tgt_arrow_meta_recs;
      },
      setNumExceptions(num_exceptions: number) {
        this.num_exceptions = num_exceptions;
      },
      setTgtExceptions(tgt_exceptions: number) {
        this.tgt_exceptions = tgt_exceptions;
      },
      setReadState(read_state: string) {
        this.read_state = read_state;
      },
      set_h_mean_Low(h_mean_low: number) {
        this.h_mean_low = h_mean_low;
      },
      set_h_mean_High(h_mean_high: number) {
        this.h_mean_high = h_mean_high;
      },
      setSummary(srs: SrRequestSummary) {
        if (srs) {
          this.set_h_mean_Min(srs.extHMean.minHMean);
          this.set_h_mean_Max(srs.extHMean.maxHMean);
          this.set_lat_Min(srs.extLatLon.minLat);
          this.set_lat_Max(srs.extLatLon.maxLat);
          this.set_lon_Min(srs.extLatLon.minLon);
          this.set_lon_Max(srs.extLatLon.maxLon);
          this.set_h_mean_Low(srs.extHMean.lowHMean);
          this.set_h_mean_High(srs.extHMean.highHMean);
        } else {
          console.error('setSummary() called with null summary:', srs);
        }
      },
      setPercentComplete(percentComplete: number) {
        this.percent_complete = percentComplete;
      },
      setOverlayNdx(overlayNdx: number) {
        this.overlayNdx = overlayNdx;
      },
    },
  });
  