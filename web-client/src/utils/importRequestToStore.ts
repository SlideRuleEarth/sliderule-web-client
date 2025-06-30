// src/utils/importRequestToStore.ts
import { ICESat2RequestSchema } from '@/zod/ICESat2Schemas';
import { useReqParamsStore } from '@/stores/reqParamsStore';
import { useRasterParamsStore } from '@/stores/rasterParamsStore';
import { applyParsedJsonToStores } from '@/utils/applyParsedJsonToStores';

const userFacingErrors: Record<string, string[]> = {};

function addError(section: string, message: string) {
    if (!userFacingErrors[section]) userFacingErrors[section] = [];
    userFacingErrors[section].push(message);
}

type ToastFn = (summary: string, detail: string, severity?: string) => void;

function showGroupedErrors(
    errors: Record<string, string[]>,
    summary: string,
    fallbackDetail?: string,
    toastFn?: ToastFn
) {
    let detail: string;

    if (Object.keys(errors).length > 0) {
        detail = Object.entries(errors)
            .map(([section, msgs]) =>
                `${section}:` + msgs.map(msg => `  - ${msg}`).join('\n')
            )
            .join('\n\n');

        // Log detailed error structure for debugging
        console.log('[showGroupedErrors] Grouped error details:', {
            summary,
            errors,
            formattedDetail: detail
        });
    } else {
        detail = fallbackDetail ?? 'An unknown error occurred.';
        console.log('[showGroupedErrors] No specific errors. Using fallback:', {
            summary,
            fallbackDetail: detail
        });
    }

    if (toastFn) {
        toastFn(summary, detail, 'warn');
    } else {
        console.warn(`[toast missing] ${summary}: ${detail}`);
    }
}

function flattenErrorObject(obj: Record<string, string[]>): string[] {
    return Object.entries(obj).flatMap(([section, msgs]) =>
        msgs.map(msg => `${section}: ${msg}`)
    );
}

export function importRequestJsonToStore(
    json: unknown,
    toastFn?: ToastFn
): { success: boolean; errors?: string[] } {
    const store = useReqParamsStore();
    const rasterStore = useRasterParamsStore();

    const result = ICESat2RequestSchema.safeParse(json);
    console.log('Zod validation for', json, ' result:', result);
    if (!result.success) {
        result.error.errors.forEach(e => {
            const key = e.path.join('.') || 'unknown';
            addError(key, e.message);
        });
        showGroupedErrors(userFacingErrors, 'Import Failed', 'Please correct these issues in your JSON.', toastFn);
        return { success: false, errors: flattenErrorObject(userFacingErrors) };
    }

    const data = result.data.parms;
    applyParsedJsonToStores(data, store, rasterStore, addError);

    if (Object.keys(userFacingErrors).length > 0) {
        showGroupedErrors(userFacingErrors, 'Some fields were ignored or invalid', undefined, toastFn);
    }

    return {
        success: true,
        errors: Object.keys(userFacingErrors).length > 0 ? flattenErrorObject(userFacingErrors) : undefined
    };
}
