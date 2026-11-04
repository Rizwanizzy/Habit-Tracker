import { describe, expect, it } from 'vitest'
import {
  indexFromScroll,
  rangeFor,
  scrollTopForValue,
  valueFromIndex,
  WHEEL_ITEM_H,
} from './wheel'

describe('indexFromScroll', () => {
  it('maps clean snap positions to row indices', () => {
    expect(indexFromScroll(0, WHEEL_ITEM_H, 31)).toBe(0)
    expect(indexFromScroll(36, WHEEL_ITEM_H, 31)).toBe(1)
    expect(indexFromScroll(WHEEL_ITEM_H * 5, WHEEL_ITEM_H, 31)).toBe(5)
  })

  it('rounds fractional scroll positions to the nearest row', () => {
    expect(indexFromScroll(20, WHEEL_ITEM_H, 31)).toBe(1)
    expect(indexFromScroll(17, WHEEL_ITEM_H, 31)).toBe(0)
    expect(indexFromScroll(54, WHEEL_ITEM_H, 31)).toBe(2)
  })

  it('clamps negative and overshoot scroll values into range', () => {
    expect(indexFromScroll(-40, WHEEL_ITEM_H, 31)).toBe(0)
    expect(indexFromScroll(10_000, WHEEL_ITEM_H, 31)).toBe(30)
  })

  it('stays safe with a degenerate count', () => {
    expect(indexFromScroll(100, WHEEL_ITEM_H, 0)).toBe(0)
    expect(indexFromScroll(100, WHEEL_ITEM_H, 1)).toBe(0)
  })
})

describe('valueFromIndex', () => {
  it('offsets by the minimum', () => {
    expect(valueFromIndex(0, 1)).toBe(1)
    expect(valueFromIndex(4, 1)).toBe(5)
    expect(valueFromIndex(2, 10)).toBe(12)
  })
})

describe('scrollTopForValue', () => {
  it('is the exact inverse of indexFromScroll', () => {
    for (let v = 1; v <= 31; v++) {
      const top = scrollTopForValue(v, WHEEL_ITEM_H, 1)
      expect(indexFromScroll(top, WHEEL_ITEM_H, 31)).toBe(v - 1)
    }
  })

  it('clamps values below the minimum', () => {
    expect(scrollTopForValue(0, WHEEL_ITEM_H, 1)).toBe(0)
  })
})

describe('rangeFor', () => {
  it('keeps the default range for normal values', () => {
    expect(rangeFor(3, 1, 31)).toEqual({ min: 1, max: 31 })
  })

  it('raises the max so a large saved value stays reachable', () => {
    expect(rangeFor(45, 1, 31)).toEqual({ min: 1, max: 45 })
    expect(rangeFor(31, 1, 31)).toEqual({ min: 1, max: 31 })
  })

  it('never goes below min', () => {
    expect(rangeFor(0, 1, 31)).toEqual({ min: 1, max: 31 })
  })
})
