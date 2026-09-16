import { describe, expect, it } from 'vitest'

import type { Meta, Periodo } from '@/lib/tipos'
import { construirPeriodoMes, construirPeriodoQuincena } from '@/lib/periodos'
import {
  coberturaDelMes,
  idsDeQuincenas,
  metasDelMes,
  realesDelPeriodo,
  resumirMes,
  type ValoresPorQuincena,
} from '@/lib/reales/mes'

const meta = (periodoId: string, indicadorId: string, valor: number): Meta => ({
  periodoId,
  indicadorId,
  valor,
})

describe('idsDeQuincenas', () => {
  it('da los ids de las dos quincenas del mes', () => {
    expect(idsDeQuincenas('2026-09')).toEqual(['2026-09-Q1', '2026-09-Q2'])
  })
})

describe('resumirMes', () => {
  it('con las dos quincenas suma y compara con el plan del mes entero', () => {
    expect(resumirMes(50, 53, 72, 73, 145)).toEqual({ real: 103, meta: 145 })
  })
  it('con solo la 1ª compara con la meta de la 1ª', () => {
    expect(resumirMes(50, null, 72, 73, 145)).toEqual({ real: 50, meta: 72 })
  })
  it('con solo la 2ª compara con la meta de la 2ª', () => {
    expect(resumirMes(null, 53, 72, 73, 145)).toEqual({ real: 53, meta: 73 })
  })
  it('sin ninguna no hay real y el plan es el del mes', () => {
    expect(resumirMes(null, null, 72, 73, 145)).toEqual({ real: null, meta: 145 })
  })
  it('un 0 es un dato, no un vacío', () => {
    expect(resumirMes(0, null, 72, 73, 145)).toEqual({ real: 0, meta: 72 })
  })
  it('suma importes al céntimo', () => {
    expect(resumirMes(0.1, 0.2, 1, 1, 2).real).toBe(0.3)
  })
})

describe('coberturaDelMes', () => {
  it('solo 1ª quincena con datos: en curso hasta el 15', () => {
    const q: ValoresPorQuincena = { '2026-09-Q1': { eleads: 50 } }
    expect(coberturaDelMes('2026-09', q)).toBe('q1')
  })
  it('solo 2ª quincena con datos', () => {
    const q: ValoresPorQuincena = { '2026-09-Q2': { eleads: 50 } }
    expect(coberturaDelMes('2026-09', q)).toBe('q2')
  })
  it('las dos con datos: mes completo', () => {
    const q: ValoresPorQuincena = { '2026-09-Q1': { eleads: 50 }, '2026-09-Q2': { eleads: 53 } }
    expect(coberturaDelMes('2026-09', q)).toBeNull()
  })
  it('ninguna, o un documento vacío: sin marca', () => {
    expect(coberturaDelMes('2026-09', {})).toBeNull()
    expect(coberturaDelMes('2026-09', { '2026-09-Q1': {} })).toBeNull()
  })
})

describe('realesDelPeriodo', () => {
  const quincenas: ValoresPorQuincena = {
    '2026-09-Q1': { eleads: 50, ventas: 2 },
    '2026-09-Q2': { eleads: 53 },
  }

  it('una quincena devuelve lo guardado tal cual', () => {
    const q1: Periodo = construirPeriodoQuincena(2026, 9, 1)
    expect(realesDelPeriodo(q1, quincenas)).toEqual([
      { periodoId: '2026-09-Q1', indicadorId: 'eleads', valor: 50, origen: 'manual' },
      { periodoId: '2026-09-Q1', indicadorId: 'ventas', valor: 2, origen: 'manual' },
    ])
  })

  it('el mes suma lo que hay, indicador a indicador', () => {
    const mes = construirPeriodoMes(2026, 9)
    expect(realesDelPeriodo(mes, quincenas)).toEqual([
      { periodoId: '2026-09', indicadorId: 'eleads', valor: 103, origen: 'manual' },
      { periodoId: '2026-09', indicadorId: 'ventas', valor: 2, origen: 'manual' },
    ])
  })

  it('un mes sin quincenas no tiene reales', () => {
    expect(realesDelPeriodo(construirPeriodoMes(2026, 10), quincenas)).toEqual([])
  })
})

describe('metasDelMes', () => {
  const metasMes = [meta('2026-09', 'eleads', 145), meta('2026-09', 'ventas', 5)]
  const metasQ1 = [meta('2026-09-Q1', 'eleads', 72), meta('2026-09-Q1', 'ventas', 2)]
  const metasQ2 = [meta('2026-09-Q2', 'eleads', 73), meta('2026-09-Q2', 'ventas', 3)]

  it('mes a medias: la meta de lo que ya pasó', () => {
    const q: ValoresPorQuincena = { '2026-09-Q1': { eleads: 50 } }
    expect(metasDelMes('2026-09', metasMes, metasQ1, metasQ2, q)).toEqual([
      meta('2026-09', 'eleads', 72),
      meta('2026-09', 'ventas', 5),
    ])
  })

  it('mes completo o sin datos: la meta del mes entero', () => {
    const completo: ValoresPorQuincena = {
      '2026-09-Q1': { eleads: 50 },
      '2026-09-Q2': { eleads: 53 },
    }
    expect(metasDelMes('2026-09', metasMes, metasQ1, metasQ2, completo)).toEqual(metasMes)
    expect(metasDelMes('2026-09', metasMes, metasQ1, metasQ2, {})).toEqual(metasMes)
  })
})
