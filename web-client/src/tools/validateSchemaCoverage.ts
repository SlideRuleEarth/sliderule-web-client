// tools/validateSchemaCoverage.ts
// This script compares actual API request output with the ICESat2ParamsSchema keys
// Run this manually in dev or testing environments

import { setActivePinia, createPinia } from 'pinia';
import { useReqParamsStore } from '@/stores/reqParamsStore';
import { ICESat2RequestSchema } from '@/zod/ICESat2Schemas';

export function validateSchemaCoverage(reqId: number): string[] {
    setActivePinia(createPinia());
    const store = useReqParamsStore();

    const req = store.getAtlxxReqParams(reqId);
    const schemaKeys = Object.keys(ICESat2RequestSchema.shape);
    const requestKeys = Object.keys(req);

    const missing = requestKeys.filter(k => !schemaKeys.includes(k));
    return missing;
}
