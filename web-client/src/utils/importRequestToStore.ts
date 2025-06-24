// src/utils/importRequestToStore.ts
import { IceSat2ParamsSchema } from '@/zod/IceSat2ParamsSchema';
import { useReqParamsStore } from '@/stores/reqParamsStore';
import { useRasterParamsStore } from '@/stores/rasterParamsStore';
import { geojsonPolygonToSrRegion } from '@/utils/geojsonToSrRegion';
import { mapGtStringsToSrListNumberItems } from '@/utils/parmUtils';
import { coerceToNumberArray } from '@/utils/coerceUtils';
import { useToast } from 'primevue/usetoast';

const toast = useToast();
const userFacingErrors: Record<string, string[]> = {};

function addError(section: string, message: string) {
    if (!userFacingErrors[section]) userFacingErrors[section] = [];
    userFacingErrors[section].push(message);
}

function coerceAndTrack(fieldName: string, input: unknown, assign: (values: number[]) => void) {
    const { valid, invalid } = coerceToNumberArray(input);
    assign(valid);
    if (invalid.length > 0) {
        addError(fieldName, `invalid value(s): ${invalid.join(', ')}`);
    }
}

function showGroupedErrors(
    errors: Record<string, string[]>,
    summary: string,
    fallbackDetail?: string
) {
    const formatted = Object.entries(errors)
        .map(
            ([section, msgs]) =>
                `${section}:\n` + msgs.map(msg => `  - ${msg}`).join('\n')
        )
        .join('\n\n');

    toast.add({
        severity: 'warn',
        summary,
        detail: `<pre>${formatted}</pre>`,
        life: 12000,
    });
}

function flattenErrorObject(obj: Record<string, string[]>): string[] {
    return Object.entries(obj).flatMap(([section, msgs]) =>
        msgs.map(msg => `${section}: ${msg}`)
    );
}


export function importRequestJsonToStore(json: unknown): { success: boolean; errors?: string[] } {
    const store = useReqParamsStore();
    const rasterStore = useRasterParamsStore();

    const result = IceSat2ParamsSchema.safeParse(json);
    if (!result.success) {
        result.error.errors.forEach(e => {
            const key = e.path.join('.') || 'unknown';
            addError(key, e.message);
        });
        showGroupedErrors(userFacingErrors, 'Import Failed', 'Please correct these issues in your JSON.');
        return { success: false, errors: flattenErrorObject(userFacingErrors) };
    }



    const data = result.data;

    // --- Universal imports ---
    if (data.asset) store.setAsset(data.asset);
    const region = geojsonPolygonToSrRegion(data.poly);
    if (region) {
        store.setPoly(region);
    }
    if (data.rgt !== undefined) store.setUseRgt(true), store.setRgt(data.rgt);
    if (data.cycle !== undefined) store.setUseCycle(true), store.setCycle(data.cycle);
    if (data.region !== undefined) store.setUseRegion(true), store.setRegion(data.region);
    if (data.t0) store.setUseTime(true), store.setT0(new Date(data.t0));
    if (data.t1) store.setT1(new Date(data.t1));

    if (data.beams) {
        const matched = mapGtStringsToSrListNumberItems(data.beams);
        store.setSelectedGtOptions(matched);
        const unmatched = data.beams.filter(name => !matched.some(gt => gt.label === name));
        if (unmatched.length > 0) {
            addError('beams', `unrecognized value(s): ${unmatched.join(', ')}`);
        }
    }


    if (data.cnf) coerceAndTrack('cnf', data.cnf, (v) => store.signalConfidenceNumber = v);
    if (data.quality_ph) coerceAndTrack('quality_ph', data.quality_ph, (v) => store.qualityPHNumber = v);
    if (data.cnt !== undefined) coerceAndTrack('cnt', data.cnt, (v) => store.setMinimumPhotonCount(v[0]));
    if (data.ats !== undefined) coerceAndTrack('ats', data.ats, (v) => store.setAlongTrackSpread(v[0]));
    if (data.srt !== undefined) store.surfaceReferenceType = [{ name: 'Custom', value: data.srt }];
    if (data.len !== undefined) store.setUseLength(true), store.setLengthValue(data.len);
    if (data.res !== undefined) store.setUseStep(true), store.setStepValue(data.res);
    if (data.pass_invalid) store.setPassInvalid(true);
    if (data.timeout !== undefined) store.setUseServerTimeout(true), store.setServerTimeout(data.timeout);
    if (data["rqst-timeout"] !== undefined) store.setUseReqTimeout(true), store.setReqTimeout(data["rqst-timeout"]);
    if (data["node-timeout"] !== undefined) store.setUseNodeTimeout(true), store.setNodeTimeout(data["node-timeout"]);
    if (data["read-timeout"] !== undefined) store.setUseReadTimeout(true), store.setReadTimeout(data["read-timeout"]);
    if (data.datum === 'EGM08') store.useDatum = true;
    if (data.dist_in_seg) store.distanceIn = { name: 'segments', value: 'segments' };
    if (data.cmr?.polygon) store.setConvexHull(data.cmr.polygon);

    // --- Field arrays ---
    if (data.atl03_geo_fields) store.atl03_geo_fields = data.atl03_geo_fields;
    if (data.atl03_corr_fields) store.atl03_corr_fields = data.atl03_corr_fields;
    if (data.atl03_ph_fields) store.atl03_ph_fields = data.atl03_ph_fields;
    if (data.atl06_fields) store.atl06_fields = data.atl06_fields;
    if (data.atl08_fields) store.atl08_fields = data.atl08_fields;
    if (data.atl13_fields) store.atl13_fields = data.atl13_fields;
    if (data.samples) rasterStore.setParmsFromJson(data.samples);

    // --- ATL08 ---
    if (data.atl08_class) {
        store.enableAtl08Classification = true;
        store.atl08LandType = data.atl08_class;
    }

    // --- ATL13 ---
    if (data.atl13) {
        store.useAtl13Point = !!data.atl13.coord;
        store.atl13 = {
            ...store.atl13,
            ...data.atl13
        };
    }

    // --- ATL24 ---
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

    // --- YAPC ---
    if (data.yapc) {
        store.enableYAPC = true;
        store.setYAPCScore(data.yapc.score);
        if ('knn' in data.yapc) store.setUseYAPCKnn(true), store.setYAPCKnn(data.yapc.knn!);
        if ('win_h' in data.yapc) store.setUsesYAPCWindowHeight(true), store.setYAPCWindowHeight(data.yapc.win_h!);
        if ('win_x' in data.yapc) store.setUsesYAPCWindowWidth(true), store.setYAPCWindowWidth(data.yapc.win_x!);
        if ('version' in data.yapc) store.setYAPCVersion(data.yapc.version);
    }
    if (Object.keys(userFacingErrors).length > 0) {
        showGroupedErrors(userFacingErrors, 'Some fields were ignored or invalid');
    }

    return {
        success: true,
        errors: Object.keys(userFacingErrors).length > 0 ? flattenErrorObject(userFacingErrors) : undefined
    };

}
