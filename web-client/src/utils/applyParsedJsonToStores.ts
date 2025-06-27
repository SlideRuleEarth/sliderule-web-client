// src/utils/applyParsedJsonToStores.ts
import { geojsonPolygonToSrRegion } from '@/utils/geojsonToSrRegion';
import { mapGtStringsToSrListNumberItems } from '@/utils/parmUtils';
import { coerceToNumberArray } from '@/utils/coerceUtils';
import { surfaceReferenceTypeOptions } from '@/types/SrStaticOptions';
import { convexHull,calculatePolygonArea } from "@/composables/SrTurfUtils";

export function applyParsedJsonToStores(
    data: any,
    store: ReturnType<typeof import('@/stores/reqParamsStore').useReqParamsStore>,
    rasterStore: ReturnType<typeof import('@/stores/rasterParamsStore').useRasterParamsStore>,
    addError: (section: string, message: string) => void
) {
    console.log('Applying parsed JSON data to stores:', data);
    if (data.asset) store.setAsset(data.asset);

    if (data.poly !== undefined ) {
        store.setPoly(data.poly);
        if(data.poly && data.poly.length > 0) {
            store.setConvexHull(convexHull(data.poly));
            store.setAreaOfConvexHull(calculatePolygonArea(data.poly));
        }
    }
    if (data.rgt !== undefined){
        console.log('RGT data found:', data.rgt);
        store.setEnableGranuleSelection(true);
        store.setUseRgt(true);
        store.setRgt(data.rgt);
    }
    if (data.cycle !== undefined) {
        console.log('Cycle data found:', data.cycle);
        store.setEnableGranuleSelection(true);
        store.setUseCycle(true);
        store.setCycle(data.cycle);
    }
    if (data.region !== undefined) {
        console.log('Region data found:', data.region);
        store.setEnableGranuleSelection(true);
        store.setUseRegion(true);
        store.setRegion(data.region);
    }
    if (data.t0) {
        store.setUseTime(true);
        store.setT0(new Date(data.t0));
    }
    if (data.t1) store.setT1(new Date(data.t1));

    if (data.beams) {
        const matched = mapGtStringsToSrListNumberItems(data.beams);
        store.setSelectedGtOptions(matched);
        const unmatched = data.beams.filter((name: string) => !matched.some(gt => gt.label === name));
        if (unmatched.length > 0) {
            addError('beams', `unrecognized value(s): ${unmatched.join(', ')}`);
        }
    }

    if (data.cnf) {
        coerce('cnf', data.cnf, v => store.signalConfidenceNumber = v);
    }
    if (data.quality_ph) {
        coerce('quality_ph', data.quality_ph, v => store.qualityPHNumber = v);
    }
    if (data.cnt !== undefined) {
        store.setUseMinimumPhotonCount(true);
        coerce('cnt', data.cnt, v => store.setMinimumPhotonCount(v[0]));
    }
    if (data.ats !== undefined) {
        store.setUseAlongTrackSpread(true);
        coerce('ats', data.ats, v => store.setAlongTrackSpread(v[0]));
        console.log('Parsing srt values:', data.srt);
    }
    if (data.srt !== undefined) {
        let values: number[] = [];
        if (Array.isArray(data.srt)) {
            values = (data.srt as (string | number)[])
                .map(v => typeof v === 'string' ? parseInt(v, 10) : v)
                .filter((v): v is number => typeof v === 'number' && !isNaN(v));
        } else if (typeof data.srt === 'number') {
            values = [data.srt];
        }
        console.log('Parsed srt values:', values);
        if (values.length > 0) {
            store.surfaceReferenceType = surfaceReferenceTypeOptions.filter(opt => values.includes(opt.value));
            store.enableAtl03Confidence = true;
        } else {
            store.surfaceReferenceType = [];
            addError('srt', `invalid value: ${JSON.stringify(data.srt)}`);
        }
    }

    if (data.len !== undefined) {
        store.setUseLength(true);
        store.setLengthValue(data.len);
    }
    if (data.res !== undefined) {
        store.setUseStep(true);
        store.setStepValue(data.res);
    }
    if (data.pass_invalid !== undefined) {
        store.setPassInvalid(data.pass_invalid);
    }
    if (data.timeout !== undefined) {
        store.setUseServerTimeout(true);
        store.setServerTimeout(data.timeout);
    }
    if (data['rqst-timeout'] !== undefined) {
        store.setUseReqTimeout(true);
        store.setReqTimeout(data['rqst-timeout']);
    }
    if (data['node-timeout'] !== undefined) {
        store.setUseNodeTimeout(true);
        store.setNodeTimeout(data['node-timeout']);
    }
    if (data['read-timeout'] !== undefined) {
        store.setUseReadTimeout(true);
        store.setReadTimeout(data['read-timeout']);
    }
    if (data.datum === 'EGM08') store.useDatum = true;
    if (data.dist_in_seg) store.distanceIn = { name: 'segments', value: 'segments' };

    if (data.atl08_class) {
        store.enableAtl08Classification = true;
        store.atl08LandType = data.atl08_class;
    }

    if (data.atl13) {
        store.useAtl13Point = !!data.atl13.coord;
        store.atl13 = { ...store.atl13, ...data.atl13 };
    }

    if (data.atl24) {
        store.enableAtl24Classification = true;
        if (data.atl24.class_ph) store.atl24_class_ph = data.atl24.class_ph;
        if (data.atl24.compact !== undefined) store.useAtl24Compact = true, store.atl24Compact = data.atl24.compact;
        if (data.atl24.classification !== undefined) store.useAtl24Classification = true, store.atl24Classification = data.atl24.classification;
        if (data.atl24.confidence_threshold !== undefined) store.useAtl24ConfidenceThreshold = true, store.atl24ConfidenceThreshold = data.atl24.confidence_threshold;
        if (data.atl24.invalid_kd !== undefined) store.useAtl24InvalidKD = true, store.atl24InvalidKD = data.atl24.invalid_kd;
        if (data.atl24.invalid_wind_speed !== undefined) store.useAtl24InvalidWindspeed = true, store.atl24InvalidWindspeed = data.atl24.invalid_wind_speed;
        if (data.atl24.low_confidence !== undefined) store.useAtl24LowConfidence = true, store.atl24LowConfidence = data.atl24.low_confidence;
        if (data.atl24.night !== undefined) store.useAtl24Night = true, store.atl24Night = data.atl24.night;
        if (data.atl24.sensor_depth_exceeded !== undefined) store.useAtl24SensorDepthExceeded = true, store.atl24SensorDepthExceeded = data.atl24.sensor_depth_exceeded;
        if (data.atl24.anc_fields) store.atl24AncillaryFields = data.atl24.anc_fields;
    }

    if (data.yapc) {
        store.enableYAPC = true;
        store.setYAPCScore(data.yapc.score);
        if ('knn' in data.yapc) store.setUseYAPCKnn(true), store.setYAPCKnn(data.yapc.knn);
        if ('win_h' in data.yapc) store.setUsesYAPCWindowHeight(true), store.setYAPCWindowHeight(data.yapc.win_h);
        if ('win_x' in data.yapc) store.setUsesYAPCWindowWidth(true), store.setYAPCWindowWidth(data.yapc.win_x);
        if ('version' in data.yapc && data.yapc.version !== undefined) store.setYAPCVersion(data.yapc.version);
    }

    function coerce(field: string, input: unknown, assign: (v: number[]) => void) {
        const { valid, invalid } = coerceToNumberArray(input);
        assign(valid);
        if (invalid.length > 0) addError(field, `invalid value(s): ${invalid.join(', ')}`);
    }

}
