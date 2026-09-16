import { describe, expect, it } from 'vitest'

import { construirPeriodoMes } from '@/lib/periodos'
import { ventanaDe } from '@/components/graficos/ventana'

/** Doce meses de 2026, desordenados a propósito. */
const SERIE = Array.from({ length: 12 }, (_, i) => ({ periodo: construirPeriodoMes(2026, i + 1) })).reverse()
const ids = (v: ReturnType<typeof ventanaDe>) => v.ventana.map((p) => p.periodo.id)

describe('ventanaDe', () => {
  it('sin siguientes, acaba en el elegido', () => {
    const v = ventanaDe(SERIE, '2026-09', 6)
    expect(ids(v)).toEqual(['2026-04', '2026-05', '2026-06', '2026-07', '2026-08', '2026-09'])
    expect(v.elegido).toBe(5)
  })

  it('con un siguiente, añade el periodo que viene', () => {
    const v = ventanaDe(SERIE, '2026-09', 6, 1)
    expect(ids(v)).toEqual(['2026-04', '2026-05', '2026-06', '2026-07', '2026-08', '2026-09', '2026-10'])
    expect(v.elegido).toBe(5)
  })

  it('en el último periodo del plan no inventa siguientes: rellena con historia', () => {
    const v = ventanaDe(SERIE, '2026-12', 6, 1)
    expect(ids(v)).toHaveLength(7)
    expect(ids(v).at(-1)).toBe('2026-12')
    expect(v.elegido).toBe(6)
  })

  it('al principio del plan rellena hacia delante', () => {
    const v = ventanaDe(SERIE, '2026-02', 6, 1)
    expect(ids(v)[0]).toBe('2026-01')
    expect(ids(v)).toHaveLength(7)
    expect(v.elegido).toBe(1)
  })
})
