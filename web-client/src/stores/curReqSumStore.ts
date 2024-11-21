import { ref, computed } from 'vue';
import type { SrRequestSummary } from '@/db/SlideRuleDb';
import type { SrParquetPathTypeJsType } from '@/utils/SrParquetUtils';

export const useCurReqSumStore = () => {
  const h_mean_min = ref(100000);
  const h_mean_max = ref(-100000);
  const h_mean_low = ref(100000); // 5th percentile
  const h_mean_high = ref(-100000); // 95th percentile
  const lat_min = ref(90);
  const lat_max = ref(-90);
  const lon_min = ref(180);
  const lon_max = ref(-180);
  const num_arrow_data_recs = ref(0);
  const num_arrow_meta_recs = ref(0);
  const num_exceptions = ref(0);
  const tgt_arrow_data_recs = ref(0);
  const tgt_arrow_meta_recs = ref(0);
  const tgt_exceptions = ref(0);
  const read_state = ref('idle');
  const duration = ref(0);
  const percent_complete = ref(0);
  const allFieldTypes = ref<SrParquetPathTypeJsType[]>([]);
  const allFieldNames = ref<string[]>([]);
  const hMeanNdx = ref(-1);
  const latNdx = ref(-1);
  const lonNdx = ref(-1);
  const overlay_ndx = ref(-1);

  const hMeanMin = computed(() => h_mean_min.value);
  const hMeanMax = computed(() => h_mean_max.value);
  const latMin = computed(() => lat_min.value);
  const latMax = computed(() => lat_max.value);
  const lonMin = computed(() => lon_min.value);
  const lonMax = computed(() => lon_max.value);
  const numArrowDataRecs = computed(() => num_arrow_data_recs.value);
  const numArrowMetaRecs = computed(() => num_arrow_meta_recs.value);
  const tgtArrowDataRecs = computed(() => tgt_arrow_data_recs.value);
  const tgtArrowMetaRecs = computed(() => tgt_arrow_meta_recs.value);
  const numExceptions = computed(() => num_exceptions.value);
  const tgtExceptions = computed(() => tgt_exceptions.value);
  const readState = computed(() => read_state.value);
  const hMeanLow = computed(() => h_mean_low.value);
  const hMeanHigh = computed(() => h_mean_high.value);
  const percentComplete = computed(() => Math.floor(percent_complete.value));
  const overlayNdx = computed(() => overlay_ndx.value);

  function set_h_mean_Min(value: number) {
    h_mean_min.value = value;
  }

  function set_h_mean_Max(value: number) {
    h_mean_max.value = value;
  }

  function set_lat_Min(value: number) {
    lat_min.value = value;
  }

  function set_lat_Max(value: number) {
    lat_max.value = value;
  }

  function set_lon_Min(value: number) {
    lon_min.value = value;
  }

  function set_lon_Max(value: number) {
    lon_max.value = value;
  }

  function setNumArrowDataRecs(value: number) {
    num_arrow_data_recs.value = value;
  }

  function setNumArrowMetaRecs(value: number) {
    num_arrow_meta_recs.value = value;
  }

  function setTgtArrowDataRecs(value: number) {
    tgt_arrow_data_recs.value = value;
  }

  function setTgtArrowMetaRecs(value: number) {
    tgt_arrow_meta_recs.value = value;
  }

  function setNumExceptions(value: number) {
    num_exceptions.value = value;
  }

  function setTgtExceptions(value: number) {
    tgt_exceptions.value = value;
  }

  function setReadState(value: string) {
    read_state.value = value;
  }

  function set_h_mean_Low(value: number) {
    h_mean_low.value = value;
  }

  function set_h_mean_High(value: number) {
    h_mean_high.value = value;
  }

  function setSummary(srs: SrRequestSummary) {
    if (srs) {
      set_h_mean_Min(srs.extHMean.minHMean);
      set_h_mean_Max(srs.extHMean.maxHMean);
      set_lat_Min(srs.extLatLon.minLat);
      set_lat_Max(srs.extLatLon.maxLat);
      set_lon_Min(srs.extLatLon.minLon);
      set_lon_Max(srs.extLatLon.maxLon);
      set_h_mean_Low(srs.extHMean.lowHMean);
      set_h_mean_High(srs.extHMean.highHMean);
    } else {
      console.error('setSummary() called with null summary:', srs);
    }
  }

  function setPercentComplete(value: number) {
    percent_complete.value = value;
  }

  function setOverlayNdx(value: number) {
    overlay_ndx.value = value;
  }

  return {
    h_mean_min,
    h_mean_max,
    h_mean_low,
    h_mean_high,
    lat_min,
    lat_max,
    lon_min,
    lon_max,
    num_arrow_data_recs,
    num_arrow_meta_recs,
    num_exceptions,
    tgt_arrow_data_recs,
    tgt_arrow_meta_recs,
    tgt_exceptions,
    read_state,
    duration,
    percent_complete,
    allFieldTypes,
    allFieldNames,
    hMeanNdx,
    latNdx,
    lonNdx,
    overlay_ndx,
    hMeanMin,
    hMeanMax,
    latMin,
    latMax,
    lonMin,
    lonMax,
    numArrowDataRecs,
    numArrowMetaRecs,
    tgtArrowDataRecs,
    tgtArrowMetaRecs,
    numExceptions,
    tgtExceptions,
    readState,
    hMeanLow,
    hMeanHigh,
    percentComplete,
    overlayNdx,
    set_h_mean_Min,
    set_h_mean_Max,
    set_lat_Min,
    set_lat_Max,
    set_lon_Min,
    set_lon_Max,
    setNumArrowDataRecs,
    setNumArrowMetaRecs,
    setTgtArrowDataRecs,
    setTgtArrowMetaRecs,
    setNumExceptions,
    setTgtExceptions,
    setReadState,
    set_h_mean_Low,
    set_h_mean_High,
    setSummary,
    setPercentComplete,
    setOverlayNdx,
  };
};
