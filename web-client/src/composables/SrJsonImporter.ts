// src/composables/useJsonImporter.ts
import { ref } from 'vue';
import { z } from 'zod';
import { createLogger } from '@/utils/logger';

const logger = createLogger('SrJsonImporter');

export function useJsonImporter<T>(schema: z.ZodType<T>) {
  const data = ref<T | null>(null);
  const error = ref<string | null>(null);
  const importJson = (jsonString: string) => {
    try {
        if(schema === null || typeof schema !== 'object') {
            throw new Error('Invalid schema provided for JSON import');
        }
        error.value = null;
        const parsedJson = JSON.parse(jsonString);
        logger.debug('Raw JSON input', { jsonString, parsedJson });
        const validationResult = schema.safeParse(parsedJson);
        logger.debug('Parsed JSON', { parsedJson, schema, validationResult });
        if (validationResult.success) {
            data.value = validationResult.data;
        } else {
            // Construct a user-friendly error message from Zod's error object
            const formattedErrors = validationResult.error.errors.map(
                (e) => `${e.path.join('.')} - ${e.message}`
            );
            error.value = `Invalid JSON structure:\n${formattedErrors.join('\n')}`;
        }
    } catch (e: unknown) {
        if (e instanceof SyntaxError) {
            error.value = `Invalid JSON format: ${e.message}`;
        } else {
            error.value = 'An unexpected error occurred during import';
            logger.error('Import error', { error: e instanceof Error ? e.message : String(e) });
        }
        data.value = null;
        }
  };

  return {
    data,
    error,
    importJson,
  };
}