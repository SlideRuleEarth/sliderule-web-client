import { describe, it, expect, vi } from 'vitest'

vi.mock('@/utils/fetchUtils', () => ({ fetchS3AccessCredentials: vi.fn() }))

import { fillTile, TILE_SIDE } from '@/utils/atl06StatsReader'
import { cellIdToFaceIJ } from '@/utils/s2CellGrid'

describe('atl06StatsReader.fillTile', () => {
  it('places valid means at their local cell and drops fill-value means', () => {
    const ids = new BigUint64Array([0x452ad49900000000n, 0x452ad4a100000000n, 0x452ad58f00000000n])
    const heights = new Float64Array([1.25, 3.0934758785320806e38, NaN])
    const tile = { values: new Float32Array(TILE_SIDE * TILE_SIDE).fill(NaN) }
    fillTile(tile, ids, heights, 14)

    const faceIJ = new Int32Array(3)
    cellIdToFaceIJ(0x452ad499, 0, 14, faceIJ)
    const mask = TILE_SIDE - 1
    expect(tile.values[(faceIJ[1] & mask) * TILE_SIDE + (faceIJ[2] & mask)]).toBe(1.25)
    expect(tile.values.filter((v) => !Number.isNaN(v)).length).toBe(1)
  })
})
