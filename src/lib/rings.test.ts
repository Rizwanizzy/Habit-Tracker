import { describe, it, expect } from 'vitest'
import { layoutRings, ringGeometry, segmentArcs } from './rings'

describe('layoutRings', () => {
  it('n = 0: no rings, hiddenCount 0', () => {
    const result = layoutRings([])
    expect(result.rings).toEqual([])
    expect(result.hiddenCount).toBe(0)
  })

  it('n = 1: one full ring h1', () => {
    const result = layoutRings(['h1'])
    expect(result.rings).toEqual([{ habitIds: ['h1'] }])
    expect(result.hiddenCount).toBe(0)
  })

  it('n = 7: seven full rings h1..h7 outer to inner', () => {
    const result = layoutRings(['h1','h2','h3','h4','h5','h6','h7'])
    expect(result.rings).toEqual(
      ['h1','h2','h3','h4','h5','h6','h7'].map((id) => ({ habitIds: [id] }))
    )
    expect(result.hiddenCount).toBe(0)
  })

  it('n = 8: shared [h1,h2], then six singles h3..h8', () => {
    const result = layoutRings(['h1','h2','h3','h4','h5','h6','h7','h8'])
    expect(result.rings).toEqual([
      { habitIds: ['h1','h2'] },
      { habitIds: ['h3'] },
      { habitIds: ['h4'] },
      { habitIds: ['h5'] },
      { habitIds: ['h6'] },
      { habitIds: ['h7'] },
      { habitIds: ['h8'] },
    ])
    expect(result.hiddenCount).toBe(0)
  })

  it('n = 9: shared [h1,h2,h3], then h4..h9 singles', () => {
    const result = layoutRings(['h1','h2','h3','h4','h5','h6','h7','h8','h9'])
    expect(result.rings).toEqual([
      { habitIds: ['h1','h2','h3'] },
      { habitIds: ['h4'] },
      { habitIds: ['h5'] },
      { habitIds: ['h6'] },
      { habitIds: ['h7'] },
      { habitIds: ['h8'] },
      { habitIds: ['h9'] },
    ])
  })

  it('n = 10: shared [h1..h4], then h5..h10 singles', () => {
    const result = layoutRings(['h1','h2','h3','h4','h5','h6','h7','h8','h9','h10'])
    expect(result.rings).toEqual([
      { habitIds: ['h1','h2','h3','h4'] },
      { habitIds: ['h5'] },
      { habitIds: ['h6'] },
      { habitIds: ['h7'] },
      { habitIds: ['h8'] },
      { habitIds: ['h9'] },
      { habitIds: ['h10'] },
    ])
  })

  it('n = 11: shared [h1..h4],[h5,h6], then h7..h11 singles', () => {
    const result = layoutRings(['h1','h2','h3','h4','h5','h6','h7','h8','h9','h10','h11'])
    expect(result.rings).toEqual([
      { habitIds: ['h1','h2','h3','h4'] },
      { habitIds: ['h5','h6'] },
      { habitIds: ['h7'] },
      { habitIds: ['h8'] },
      { habitIds: ['h9'] },
      { habitIds: ['h10'] },
      { habitIds: ['h11'] },
    ])
  })

  it('n = 13: shared [h1..h4],[h5..h8], then h9..h13 singles', () => {
    const result = layoutRings(['h1','h2','h3','h4','h5','h6','h7','h8','h9','h10','h11','h12','h13'])
    expect(result.rings).toEqual([
      { habitIds: ['h1','h2','h3','h4'] },
      { habitIds: ['h5','h6','h7','h8'] },
      { habitIds: ['h9'] },
      { habitIds: ['h10'] },
      { habitIds: ['h11'] },
      { habitIds: ['h12'] },
      { habitIds: ['h13'] },
    ])
  })

  it('n = 14: shared [h1..h4],[h5..h8],[h9,h10], then h11..h14 singles', () => {
    const result = layoutRings(['h1','h2','h3','h4','h5','h6','h7','h8','h9','h10','h11','h12','h13','h14'])
    expect(result.rings).toEqual([
      { habitIds: ['h1','h2','h3','h4'] },
      { habitIds: ['h5','h6','h7','h8'] },
      { habitIds: ['h9','h10'] },
      { habitIds: ['h11'] },
      { habitIds: ['h12'] },
      { habitIds: ['h13'] },
      { habitIds: ['h14'] },
    ])
  })

  it('n = 28: seven shared rings of 4, no full ring', () => {
    const ids = Array.from({ length: 28 }, (_, i) => `h${i + 1}`)
    const result = layoutRings(ids)
    expect(result.rings.length).toBe(7)
    expect(result.rings).toEqual([
      { habitIds: ['h1','h2','h3','h4'] },
      { habitIds: ['h5','h6','h7','h8'] },
      { habitIds: ['h9','h10','h11','h12'] },
      { habitIds: ['h13','h14','h15','h16'] },
      { habitIds: ['h17','h18','h19','h20'] },
      { habitIds: ['h21','h22','h23','h24'] },
      { habitIds: ['h25','h26','h27','h28'] },
    ])
    expect(result.hiddenCount).toBe(0)
  })

  it('n = 29: hiddenCount 1', () => {
    const ids = Array.from({ length: 29 }, (_, i) => `h${i + 1}`)
    const result = layoutRings(ids)
    expect(result.hiddenCount).toBe(1)
    expect(result.rings.length).toBe(7)
  })

  it('for every n from 1 to 28: ring count <= 7, each habit once, order matches input, no shared ring > 4', () => {
    for (let n = 1; n <= 28; n++) {
      const ids = Array.from({ length: n }, (_, i) => `h${i + 1}`)
      const result = layoutRings(ids)

      expect(result.rings.length).toBeLessThanOrEqual(7)

      const allHabits = result.rings.flatMap((r) => r.habitIds)
      expect(allHabits.length).toBe(n)
      expect(new Set(allHabits).size).toBe(n)

      expect(allHabits).toEqual(ids)

      for (const ring of result.rings) {
        expect(ring.habitIds.length).toBeLessThanOrEqual(4)
      }
    }
  })
})

describe('ringGeometry', () => {
  it('center diameter >= 96px at size 240 for 1 to 7 rings', () => {
    for (let r = 1; r <= 7; r++) {
      const geo = ringGeometry(240, r)
      expect(geo.centerRadius * 2).toBeGreaterThanOrEqual(96)
    }
  })

  it('Rings fit the box and keep at least a 6px stroke', () => {
    for (let r = 1; r <= 7; r++) {
      const geo = ringGeometry(240, r)
      for (const ring of geo.rings) {
        expect(ring.width).toBeGreaterThanOrEqual(6)
        expect(ring.radius + ring.width / 2).toBeLessThanOrEqual(120.000001)
        expect(ring.radius - ring.width / 2).toBeGreaterThanOrEqual(geo.centerRadius)
      }
    }
  })

  it('More rings: strokes thin and the hole shrinks (never below its minimum)', () => {
    const geos = [1, 2, 3, 4, 5, 6, 7].map((r) => ringGeometry(240, r))
    for (let i = 1; i < geos.length; i++) {
      expect(geos[i].rings[0].width).toBeLessThanOrEqual(geos[i - 1].rings[0].width)
      expect(geos[i].centerRadius).toBeLessThanOrEqual(geos[i - 1].centerRadius)
      expect(geos[i].centerRadius).toBeGreaterThanOrEqual(48)
    }
  })

  it('Rings sit edge to edge: no neighbour gap smaller than the layout gap', () => {
    for (let r = 2; r <= 7; r++) {
      const geo = ringGeometry(240, r)
      for (let i = 1; i < geo.rings.length; i++) {
        const inner = geo.rings[i - 1]
        const outer = geo.rings[i]
        const gap = outer.radius - inner.radius - (inner.width + outer.width) / 2
        expect(gap).toBeGreaterThanOrEqual(1.9)
      }
    }
  })

  it('Seven rings at size 240: ~8.5px strokes and a 96px hole (was hairline 2.6px at the old 560 box)', () => {
    const geo = ringGeometry(240, 7)
    expect(geo.rings[0].width).toBeCloseTo((72 - 12) / 7, 2)
    expect(geo.centerRadius).toBeCloseTo(48, 2)
  })
})

describe('segmentArcs', () => {
  it('segment lengths plus gaps add up to circumference', () => {
    const radius = 100
    const numSegments = 4
    const arcs = segmentArcs(radius, numSegments)

    const gapRad = 6 / radius
    const totalGapRad = numSegments * gapRad

    let totalArcRad = 0
    for (const arc of arcs) {
      totalArcRad += arc.endAngle - arc.startAngle
    }

    expect(totalArcRad + totalGapRad).toBeCloseTo(2 * Math.PI, 5)
  })

  it("arcs go clockwise from 12 o'clock", () => {
    const arcs = segmentArcs(100, 3)
    expect(arcs[0].startAngle).toBeCloseTo(-Math.PI / 2, 5)
  })

  it('equal shares', () => {
    const arcs = segmentArcs(100, 4)
    const lengths = arcs.map((a) => a.endAngle - a.startAngle)
    for (const len of lengths) {
      expect(len).toBeCloseTo(lengths[0], 5)
    }
  })
})
