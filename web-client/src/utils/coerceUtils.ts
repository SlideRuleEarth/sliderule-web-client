export function coerceToNumberArray(input: unknown): { valid: number[]; invalid: string[] } {
    const arr = Array.isArray(input) ? input : [input];

    const valid: number[] = [];
    const invalid: string[] = [];

    for (const item of arr) {
        const num = Number(item);
        if (typeof item === 'number' || (typeof item === 'string' && item.trim() !== '')) {
            if (!isNaN(num)) {
                valid.push(num);
            } else {
                invalid.push(String(item));
            }
        } else {
            invalid.push(String(item));
        }
    }

    return { valid, invalid };
}
