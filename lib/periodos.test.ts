import { describe, expect, it } from 'vitest'

import { construirPeriodoMes, etiquetaConCobertura, marcaCobertura } from '@/lib/periodos'

describe('marca del mes en curso', () => {
  const septiembre = construirPeriodoMes(2026, 9)

  it('sin cobertura no hay marca', () => {
    expect(marcaCobertura(septiembre)).toBeNull()
    expect(etiquetaConCobertura(septiembre)).toBe(septiembre.etiqueta)
  })
  it('solo 1ª quincena: hasta el 15', () => {
    const enCurso = { ...septiembre, cobertura: 'q1' as const }
    expect(marcaCobertura(enCurso)).toBe('hasta el 15')
    expect(etiquetaConCobertura(enCurso)).toBe(`${septiembre.etiqueta} · hasta el 15`)
  })
  it('solo 2ª quincena: desde el 16', () => {
    expect(marcaCobertura({ ...septiembre, cobertura: 'q2' })).toBe('desde el 16')
  })
})
