import { describe, expect, it } from 'vitest'

import { SUMANDOS, TOTALES_CALCULADOS, idsCapturables } from '@/lib/plan/sumas'

describe('SUMANDOS', () => {
  it('el total de Engaged Leads suma sus siete canales', () => {
    expect(SUMANDOS.get('eleads')).toEqual([
      'eleads.publicidad',
      'eleads.prospeccion',
      'eleads.referidos',
      'eleads.afiliados',
      'eleads.contenido',
      'eleads.newsletter',
      'eleads.interno',
    ])
  })

  it('el total de Llamadas suma sus siete canales', () => {
    expect(SUMANDOS.get('llamadas')).toEqual([
      'llamadas.publicidad',
      'llamadas.prospeccion',
      'llamadas.referidos',
      'llamadas.afiliados',
      'llamadas.contenido',
      'llamadas.newsletter',
      'llamadas.interno',
    ])
  })

  it('el total de Ventas suma sus siete canales', () => {
    expect(SUMANDOS.get('ventas')).toEqual([
      'ventas.publicidad',
      'ventas.prospeccion',
      'ventas.referidos',
      'ventas.afiliados',
      'ventas.contenido',
      'ventas.newsletter',
      'ventas.interno',
    ])
  })

  it('el ingreso total suma las cinco partidas en dinero, sin las ventas ARCO en unidades', () => {
    expect(SUMANDOS.get('ingreso-total')).toEqual([
      'ingreso-flecha-recurrente',
      'ingreso-flecha-setup',
      'ingreso-arco-recurrente',
      'ingreso-arco-setup',
      'ingreso-otros',
    ])
  })

  it('el gasto total suma los seis canales con gasto (Interno no tiene)', () => {
    expect(SUMANDOS.get('captacion-total')).toEqual([
      'captacion.publicidad',
      'captacion.prospeccion',
      'captacion.referidos',
      'captacion.afiliados',
      'captacion.contenido',
      'captacion.newsletter',
    ])
  })

  it('ningún total es sumando de otro ni de sí mismo', () => {
    const sumandos = [...SUMANDOS.values()].flat()
    for (const total of SUMANDOS.keys()) expect(sumandos).not.toContain(total)
  })
})

describe('idsCapturables', () => {
  it('deja fuera los cinco totales y conserva el resto, en su orden', () => {
    const ids = ['eleads', 'eleads.publicidad', 'discoveries', 'ingreso-total', 'ingreso-otros']
    expect([...idsCapturables(ids)]).toEqual(['eleads.publicidad', 'discoveries', 'ingreso-otros'])
  })
})

describe('TOTALES_CALCULADOS', () => {
  it('son exactamente los cinco totales: ni Discoveries ni Propuestas, que no se reparten', () => {
    expect([...TOTALES_CALCULADOS].sort()).toEqual([
      'captacion-total',
      'eleads',
      'ingreso-total',
      'llamadas',
      'ventas',
    ])
  })
})
