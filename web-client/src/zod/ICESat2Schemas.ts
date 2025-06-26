// src/zod/ICESat2ParamsSchema.ts
import { z } from 'zod';

const GeoJSONPolygon = z.object({
    type: z.literal('Polygon'),
    coordinates: z.array(z.array(z.number())),
});

const YapcSchema = z.object({
    score: z.number(),
    version: z.number().optional(),
    knn: z.number().optional(),
    win_h: z.number().optional(),
    win_x: z.number().optional(),
});

const Atl24Schema = z.object({
    compact: z.boolean().optional(),
    class_ph: z.array(z.string()).optional(),
    classification: z.array(z.number()).optional(),
    confidence_threshold: z.number().optional(),
    invalid_kd: z.boolean().optional(),
    invalid_wind_speed: z.boolean().optional(),
    low_confidence: z.boolean().optional(),
    night: z.boolean().optional(),
    sensor_depth_exceeded: z.boolean().optional(),
    anc_fields: z.array(z.string()).optional(),
}).optional();

const OutputFormatSchema = z.object({
    format: z.string(),
    path: z.string(),
    with_checksum: z.boolean().optional(),
    as_geo: z.boolean().optional(),
});

const Atl13Schema = z.object({
    refid: z.number().optional(),
    name: z.string().optional(),
    coord: z.object({ lon: z.number(), lat: z.number() }).optional(),
}).optional();

export const ICESat2ParamsSchema = z.object({
    asset: z.string().optional(),
    poly: GeoJSONPolygon.optional(),
    rgt: z.number().optional(),
    cycle: z.number().optional(),
    region: z.number().optional(),
    t0: z.string().datetime().optional(),
    t1: z.string().datetime().optional(),
    beams: z.array(z.string()).optional(),
    cnf: z.union([z.number(), z.array(z.number()), z.array(z.string())]).optional(),
    quality_ph: z.array(z.number()).optional(),
    srt: z.union([
            z.literal(-1),
            z.array(z.number()),
            z.array(z.string()),
    ]).optional(),
    len: z.number().optional(),
    res: z.number().optional(),
    pass_invalid: z.boolean().optional(),
    ats: z.number().optional(),
    cnt: z.number().optional(),
    output: OutputFormatSchema.optional(),
    atl03_geo_fields: z.array(z.string()).optional(),
    atl03_corr_fields: z.array(z.string()).optional(),
    atl03_ph_fields: z.array(z.string()).optional(),
    atl06_fields: z.array(z.string()).optional(),
    atl08_fields: z.array(z.string()).optional(),
    atl08_class: z.array(z.string()).optional(),
    atl13: Atl13Schema,
    atl13_fields: z.array(z.string()).optional(),
    atl24: Atl24Schema,
    timeout: z.number().optional(),
    'rqst-timeout': z.number().optional(),
    'node-timeout': z.number().optional(),
    'read-timeout': z.number().optional(),
    datum: z.string().optional(),
    samples: z.record(z.unknown()).optional(),
    yapc: YapcSchema.optional(),
    cmr: z.object({ polygon: GeoJSONPolygon }).optional(),
    dist_in_seg: z.boolean().optional(),
});


// Define ICESat-2 request schema
export const ICESat2RequestSchema = z.object({
    parms: ICESat2ParamsSchema,
    resources: z.array(z.string()).optional(),
});
export type ICESat2Params = z.infer<typeof ICESat2ParamsSchema>;
