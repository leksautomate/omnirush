import { readFileSync } from 'node:fs'
import path from 'node:path'
import { describe, expect, it } from 'vitest'

import { extractOpeningDate, parseDocumentaryScript } from '../parse-script'

const fixture = readFileSync(
  path.join(
    process.cwd(),
    'lib/engine/documentary/__tests__/fixtures/midway-vidrush.txt'
  ),
  'utf8'
)

describe('parseDocumentaryScript', () => {
  it('keeps inline Four Pillars metadata and the Rotation Log out of narration', () => {
    const parsed = parseDocumentaryScript(fixture)

    expect(parsed.brief.whatTheVideoIsAbout).toContain('June 1942')
    expect(parsed.brief.keyFacts).toContain(
      'Station HYPO confirms the Japanese target AF is Midway'
    )
    expect(parsed.narration).toMatch(/^By the summer of 1942/)
    expect(parsed.narration).not.toContain('What the Video Is About')
    expect(parsed.narration).not.toContain('Rotation Log')
    expect(parsed.rotationLog?.entries[0]).toEqual({
      label: 'Slot 1 (Context Bridge)',
      value: '1A'
    })
  })

  it.each([
    ['By June 1942, the carrier war had changed.', 1942],
    ['On September 1, 1939, Germany invaded Poland.', 1939],
    ['By the summer of 1942, Japan appeared unstoppable.', 1942],
    ['Between 1914 and 1918, Europe was transformed.', 1914]
  ])('accepts a dated opening: %s', (text, year) => {
    expect(extractOpeningDate(text)?.year).toBe(year)
  })

  it('blocks an undated opening without rewriting narration', () => {
    const text =
      'Japan appeared unstoppable.\n\nIts carrier fleet crossed the Pacific.'
    const parsed = parseDocumentaryScript(text)

    expect(parsed.narration).toBe(text)
    expect(parsed.issues).toContainEqual(
      expect.objectContaining({
        code: 'opening-date-missing',
        severity: 'blocking'
      })
    )
    expect(parsed.issues[0]?.suggestedAction).toContain('year')
  })

  it('reports inferred Four Pillars for narration-only scripts', () => {
    const parsed = parseDocumentaryScript(
      'In 1916, the Battle of the Somme began after a week-long bombardment.'
    )

    expect(parsed.inferredFields).toEqual([
      'whatTheVideoIsAbout',
      'styleOfTalking',
      'whoThisVideoIsFor',
      'keyFacts'
    ])
    expect(
      parsed.issues.filter(issue => issue.code === 'script-section-missing')
    ).toHaveLength(4)
  })
})
