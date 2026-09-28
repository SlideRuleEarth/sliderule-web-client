import { describe, it, expect } from 'vitest'
import { formatTips, tipLifeMs } from '@/utils/tipUtils'

describe('tipUtils', () => {
  it('keeps a single tip as is', () => {
    const toast = formatTips([{ summary: 'Link to Plot', msg: 'Click on a plot point' }])
    expect(toast.summary).toBe('Link to Plot')
    expect(toast.detail).toBe('Click on a plot point')
  })

  it('lists several tips in one toast and drops duplicates', () => {
    const toast = formatTips([
      { summary: 'Tip', msg: 'Plot Legends are draggable' },
      { summary: 'Link to Plot', msg: 'Click on a plot point' },
      { summary: 'Link to Plot', msg: 'Click on a plot point' }
    ])
    expect(toast.summary).toBe('Tips')
    expect(toast.detail).toBe(
      '<ul><li>Plot Legends are draggable</li><li>Click on a plot point</li></ul>'
    )
  })

  it('gives more reading time to more text', () => {
    expect(tipLifeMs(['one two three four five six'])).toBeGreaterThan(tipLifeMs(['one two']))
  })

  it('leaves time to read the five Analysis view tips (~50 words)', () => {
    const words = Array(50).fill('word').join(' ')
    expect(tipLifeMs([words])).toBeGreaterThanOrEqual(15000)
  })
})
