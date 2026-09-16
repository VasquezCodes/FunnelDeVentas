import { describe, expect, it } from 'vitest'

import { tasaReal } from '@/lib/tasas'

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
