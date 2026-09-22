import { describe, expect, it } from 'vitest'

import { construirPeriodoMes, construirPeriodoQuincena, compararPeriodos } from '@/lib/periodos'
import { periodoInicial } from '@/components/periodo-inicial'
import type { Periodo } from '@/lib/tipos'

/** Meses del plan, del más reciente al más antiguo: como los ordena el tablero. */
function meses(desde: [number, number], hasta: [number, number]): Periodo[] {
  const salida: Periodo[] = []
  for (let anio = desde[0]; anio <= hasta[0]; anio++) {
    for (let mes = 1; mes <= 12; mes++) {
      if (anio === desde[0] && mes < desde[1]) continue
      if (anio === hasta[0] && mes > hasta[1]) continue
      salida.push(construirPeriodoMes(anio, mes))
    }
  }
  return salida.sort((a, b) => compararPeriodos(b, a))
}

const PLAN = meses([2026, 7], [2028, 12])

describe('periodoInicial', () => {
  it('abre en el mes de hoy aunque no tenga ni un resultado', () => {
    expect(periodoInicial(PLAN, new Set(), '2026-09-22')).toBe('2026-09')
  })

  it('abre en el mes de hoy aunque haya resultados capturados por delante', () => {
    // El caso que motivó la regla: un año sembrado hacia adelante dejaba el
    // tablero abriendo en septiembre de 2027.
    const conDato = new Set(['2026-09', '2026-10', '2027-06', '2027-09'])
    expect(periodoInicial(PLAN, conDato, '2026-09-22')).toBe('2026-09')
  })

  it('distingue la quincena de hoy dentro del mes', () => {
    const quincenas = [
      construirPeriodoQuincena(2026, 9, 2),
      construirPeriodoQuincena(2026, 9, 1),
    ]
    expect(periodoInicial(quincenas, new Set(), '2026-09-22')).toBe('2026-09-Q2')
    expect(periodoInicial(quincenas, new Set(), '2026-09-15')).toBe('2026-09-Q1')
  })

  it('cae al último periodo con resultado si hoy queda fuera del plan', () => {
    const conDato = new Set(['2026-08', '2026-11'])
    expect(periodoInicial(PLAN, conDato, '2029-03-01')).toBe('2026-11')
    expect(periodoInicial(PLAN, conDato, '2026-01-01')).toBe('2026-11')
  })

  it('cae al primero de la lista si no hay hoy ni resultados', () => {
    expect(periodoInicial(PLAN, new Set())).toBe('2028-12')
  })

  it('devuelve cadena vacía sin periodos, en vez de reventar', () => {
    expect(periodoInicial([], new Set(), '2026-09-22')).toBe('')
  })
})
