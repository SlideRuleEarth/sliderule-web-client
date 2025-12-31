// src/zod/ICESat2ParamsSchema.ts
import { z } from 'zod'
const Coordinate = z.object({
  lon: z.number(),
  lat: z.number()
})

// ATL24 classification name to value mapping
const atl24ClassificationMap: Record<string, number> = {
  unclassified: 0,
  atl24_unclassified: 0,
  bathymetry: 40,
  atl24_bathymetry: 40,
  sea_surface: 41,
  atl24_sea_surface: 41
}

// Schema that accepts both string names and numbers, converting strings to numbers
const Atl24ClassificationSchema = z
  .array(z.union([z.number(), z.string()]))
  .transform((arr) =>
    arr.map((val) => {
      if (typeof val === 'number') return val
      const normalized = val.toLowerCase().trim()
      return atl24ClassificationMap[normalized] ?? parseInt(val, 10)
    })
  )
  .optional()

// const _GeoJSONPolygon = z.object({
//     type: z.literal('Polygon'),
//     coordinates: z.array(z.array(z.array(z.number()))),
// });

const YapcSchema = z.object({
  score: z.number(),
  version: z.number().optional(),
  knn: z.number().optional(),
  win_h: z.number().optional(),
  win_x: z.number().optional()
})
export const PhoRealSchema = z.object({
  above_classifier: z.boolean().optional(),
  binsize: z.number().optional(),
  geoloc: z.string().optional(),
  send_waveform: z.boolean().optional(),
  use_abs_h: z.boolean().optional()
})
const Atl24Schema = z
  .object({
    compact: z.boolean().optional(),
    // class_ph accepts both strings ["bathymetry"] and numbers [40]
    class_ph: z.array(z.union([z.number(), z.string()])).optional(),
    // classification is legacy - use class_ph instead
    classification: Atl24ClassificationSchema,
    confidence_threshold: z.number().optional(),
    // These fields can be either boolean or array of strings ["off", "on"]
    // The UI uses multi-select with On/Off options, server returns lowercase
    invalid_kd: z.union([z.boolean(), z.array(z.string())]).optional(),
    invalid_wind_speed: z.union([z.boolean(), z.array(z.string())]).optional(),
    low_confidence: z.union([z.boolean(), z.array(z.string())]).optional(),
    night: z.union([z.boolean(), z.array(z.string())]).optional(),
    sensor_depth_exceeded: z.union([z.boolean(), z.array(z.string())]).optional(),
    anc_fields: z.array(z.string()).optional()
  })
  .optional()

const OutputFormatSchema = z.object({
  format: z.string(),
  path: z.string(),
  with_checksum: z.boolean().optional(),
  as_geo: z.boolean().optional()
})

const Atl13Schema = z
  .object({
    refid: z.number().optional(),
    name: z.string().optional(),
    coord: z.object({ lon: z.number(), lat: z.number() }).optional()
  })
  .optional()

export const ICESat2ParamsSchema = z.object({
  asset: z.string().optional(),
  poly: z.array(Coordinate).optional(),
  rgt: z.array(z.number()).optional(),
  cycle: z.array(z.number()).optional(),
  region: z.array(z.number()).optional(),
  t0: z.string().datetime().optional(),
  t1: z.string().datetime().optional(),
  beams: z.array(z.string()).optional(),
  cnf: z.union([z.number(), z.array(z.number()), z.array(z.string())]).optional(),
  quality_ph: z.array(z.number()).optional(),
  srt: z.union([z.literal(-1), z.array(z.number()), z.array(z.string())]).optional(),
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
  phoreal: PhoRealSchema.optional(),
  cmr: z
    .object({
      polygon: z.array(Coordinate).optional(),
      version: z.string().optional()
    })
    .optional(),
  dist_in_seg: z.boolean().optional(),
  track: z.array(z.number()).optional()
})

// Define ICESat-2 request schema
export const ICESat2RequestSchema = z.object({
  parms: ICESat2ParamsSchema,
  resources: z.array(z.string()).optional()
})
export type ICESat2Params = z.infer<typeof ICESat2ParamsSchema>
