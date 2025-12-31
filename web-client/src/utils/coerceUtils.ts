export function coerceToNumberArray(input: unknown): {
  valid: number[]
  invalid: string[]
  conversions: Array<{ from: string; to: number }>
} {
  const arr = Array.isArray(input) ? input : [input]

  const valid: number[] = []
  const invalid: string[] = []
  const conversions: Array<{ from: string; to: number }> = []

  for (const item of arr) {
    const num = Number(item)
    if (typeof item === 'number') {
      valid.push(num)
    } else if (typeof item === 'string' && item.trim() !== '') {
      if (!isNaN(num)) {
        valid.push(num)
        conversions.push({ from: item, to: num })
      } else {
        invalid.push(String(item))
      }
    } else {
      invalid.push(String(item))
    }
  }

  return { valid, invalid, conversions }
}
