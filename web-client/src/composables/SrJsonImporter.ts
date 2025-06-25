// src/composables/useJsonImporter.ts
import { ref } from 'vue';
import { z, ZodError } from 'zod';

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
        console.log('Raw JSON input:', jsonString, 'Parsed JSON:', parsedJson);
        const validationResult = schema.safeParse(parsedJson);
        console.log('Parsed JSON:', parsedJson, 'Validation result:', validationResult);
        if (validationResult.success) {
            data.value = validationResult.data;
        } else {
            // Construct a user-friendly error message from Zod's error object
            const formattedErrors = validationResult.error.errors.map(
                (e) => `${e.path.join('.')} - ${e.message}`
            );
            error.value = `Invalid JSON structure:\n${formattedErrors.join('\n')}`;
        }
    } catch (e) {
        if (e instanceof SyntaxError) {
            error.value = `Invalid JSON format: ${e.message}`;
        } else {
            error.value = 'An unexpected error occurred during import';
            console.error(e);
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