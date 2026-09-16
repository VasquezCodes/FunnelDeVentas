import { describe, expect, it } from 'vitest'

import { PATRON_MES, limpiarValores } from '@/lib/reales/validar'

const ids = new Set(['eleads', 'ventas'])

describe('limpiarValores', () => {
  it('acepta números ≥ 0 y los deja al céntimo', () => {
    expect(limpiarValores({ eleads: 50, ventas: 2.005 }, ids)).toEqual({
      ok: true,
      valores: { eleads: 50, ventas: 2.01 },
    })
  })
  it('acepta el 0 y el objeto vacío', () => {
    expect(limpiarValores({ eleads: 0 }, ids)).toEqual({ ok: true, valores: { eleads: 0 } })
    expect(limpiarValores({}, ids)).toEqual({ ok: true, valores: {} })
  })
  it('rechaza indicadores que no están en el plan', () => {
    expect(limpiarValores({ inventado: 1 }, ids).ok).toBe(false)
  })
  it('rechaza negativos, NaN, infinitos y textos', () => {
    expect(limpiarValores({ eleads: -1 }, ids).ok).toBe(false)
    expect(limpiarValores({ eleads: Number.NaN }, ids).ok).toBe(false)
    expect(limpiarValores({ eleads: Number.POSITIVE_INFINITY }, ids).ok).toBe(false)
    expect(limpiarValores({ eleads: '5' }, ids).ok).toBe(false)
  })
  it('rechaza lo que no es un objeto', () => {
    expect(limpiarValores(null, ids).ok).toBe(false)
    expect(limpiarValores([1, 2], ids).ok).toBe(false)
    expect(limpiarValores('eleads', ids).ok).toBe(false)
  })
})

describe('PATRON_MES', () => {
  it('reconoce ids de mes y rechaza el resto', () => {
    expect(PATRON_MES.test('2026-09')).toBe(true)
    expect(PATRON_MES.test('2026-13')).toBe(false)
    expect(PATRON_MES.test('2026-09-Q1')).toBe(false)
  })
})
