// Tips issued together (e.g. by the components of one view as it mounts) are
// shown as a single toast whose life scales with the amount of text to read.

export interface Tip {
  summary: string
  msg: string
}

const TIP_BASE_LIFE_MS = 4000
const TIP_PER_WORD_MS = 500 // ~120 words per minute, generous on purpose

export function tipLifeMs(texts: string[]): number {
  const words = texts.join(' ').split(/\s+/).filter(Boolean).length
  return TIP_BASE_LIFE_MS + words * TIP_PER_WORD_MS
}

/**
 * Combine tips into one toast. Duplicates (same message) are dropped; a single
 * tip keeps its own summary, several are listed under "Tips".
 */
export function formatTips(tips: Tip[]): { summary: string; detail: string; life: number } {
  const unique = tips.filter((tip, i) => tips.findIndex((t) => t.msg === tip.msg) === i)
  const msgs = unique.map((tip) => tip.msg)
  if (unique.length === 1) {
    return { summary: unique[0].summary, detail: msgs[0], life: tipLifeMs(msgs) }
  }
  const detail = '<ul>' + msgs.map((msg) => `<li>${msg}</li>`).join('') + '</ul>'
  return { summary: 'Tips', detail, life: tipLifeMs(msgs) }
}
