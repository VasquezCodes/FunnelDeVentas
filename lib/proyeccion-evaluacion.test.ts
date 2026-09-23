import { describe, expect, it } from 'vitest'

import { evaluar } from '@/lib/proyeccion-evaluacion'
import type { PuntoPlanReal } from '@/lib/proyeccion'

const p = (plan: number | null, real: number | null): PuntoPlanReal => ({ plan, real })

describe('evaluar', () => {
  it('un equipo que cumple siempre el plan se proyecta sin error', () => {
    const serie = [p(100, 100), p(200, 200), p(150, 150), p(300, 300)]
    const e = evaluar(serie)
    expect(e.meses).toBe(3)
    expect(e.errorMedio).toBeCloseTo(0, 10)
    expect(e.sesgo).toBeCloseTo(0, 10)
  })

  it('proyecta cada mes solo con lo anterior: nunca mira el resultado que puntúa', () => {
    // El segundo mes se proyecta con el primero (al 80 %): 200 × 0,8 = 160,
    // y lo real fue 200. Un 20 % corto.
    const e = evaluar([p(100, 80), p(200, 200)])
    expect(e.detalle).toEqual([{ indice: 1, proyectado: 160, real: 200 }])
    expect(e.errorMedio).toBeCloseTo(0.2, 10)
    expect(e.sesgo).toBeCloseTo(-0.2, 10)
  })

  it('el sesgo distingue quedarse corto de pasarse; el error medio, no', () => {
    const corto = evaluar([p(100, 80), p(100, 100)])
    const largo = evaluar([p(100, 120), p(100, 100)])
    expect(corto.errorMedio).toBeCloseTo(largo.errorMedio!, 10)
    expect(corto.sesgo! < 0 && largo.sesgo! > 0).toBe(true)
  })

  it('un mes con real 0 no se puntúa: no hay error relativo contra cero', () => {
    expect(evaluar([p(100, 90), p(100, 0)]).meses).toBe(0)
  })

  it('sin meses que comparar no inventa una nota', () => {
    expect(evaluar([p(100, 90)])).toMatchObject({ meses: 0, errorMedio: null, sesgo: null })
  })
})
