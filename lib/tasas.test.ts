import { describe, expect, it } from 'vitest'

import { costePorMil, tasaReal } from '@/lib/tasas'

describe('tasaReal', () => {
  it('es lo que llegó entre lo que había', () => {
    expect(tasaReal(50, 30)).toBe(0.6)
  })

  it('sin uno de los dos lados no hay tasa', () => {
    expect(tasaReal(null, 30)).toBeNull()
    expect(tasaReal(50, null)).toBeNull()
  })

  it('sin nada que convertir no hay tasa, ni infinita ni cero', () => {
    expect(tasaReal(0, 3)).toBeNull()
    expect(tasaReal(0, 0)).toBeNull()
  })

  it('un cero arriba es una tasa del 0 %', () => {
    expect(tasaReal(40, 0)).toBe(0)
  })
})

describe('costePorMil', () => {
  it('el CPM del plan: 1.880 € entre 94.000 impresiones son 20 €', () => {
    expect(costePorMil(1880, 94000)).toBeCloseTo(20, 10)
  })

  it('sin impresiones no hay CPM: no se sirvió ni un anuncio', () => {
    expect(costePorMil(1880, 0)).toBeNull()
  })

  it('sin uno de los dos lados tampoco', () => {
    expect(costePorMil(null, 94000)).toBeNull()
    expect(costePorMil(1880, null)).toBeNull()
  })

  it('invertir 0 es un CPM de 0, no una ausencia', () => {
    expect(costePorMil(0, 94000)).toBe(0)
  })
})
