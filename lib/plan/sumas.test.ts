import { describe, expect, it } from 'vitest'

import { INDICADORES_DEL_PLAN } from '@/lib/plan/catalogo'
import { SUMANDOS, TOTALES_CALCULADOS, idsCapturables, totalesCalculadosEn } from '@/lib/plan/sumas'

/**
 * Los libros que hay. El desglose por canal ha ido llegando por etapas: el
 * 0726 estrenó el de Discoveries y después llegó el de Propuestas, así que
 * hay libros con las dos repartidas, con una sola y con ninguna.
 */
const CON_DESGLOSE = INDICADORES_DEL_PLAN.map((i) => i.id)
const SIN_PROPUESTAS = CON_DESGLOSE.filter((id) => !id.startsWith('propuestas.'))
const SIN_DESGLOSE = SIN_PROPUESTAS.filter((id) => !id.startsWith('discoveries.'))

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

  it('el total de Discoveries suma sus siete canales', () => {
    expect(SUMANDOS.get('discoveries')).toEqual([
      'discoveries.publicidad',
      'discoveries.prospeccion',
      'discoveries.referidos',
      'discoveries.afiliados',
      'discoveries.contenido',
      'discoveries.newsletter',
      'discoveries.interno',
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

describe('TOTALES_CALCULADOS', () => {
  it('son los siete totales que pueden calcularse', () => {
    expect([...TOTALES_CALCULADOS].sort()).toEqual([
      'captacion-total',
      'discoveries',
      'eleads',
      'ingreso-total',
      'llamadas',
      'propuestas',
      'ventas',
    ])
  })
})

describe('totalesCalculadosEn', () => {
  it('Discoveries solo se calcula en el libro que la reparte por canal', () => {
    expect(totalesCalculadosEn(CON_DESGLOSE).has('discoveries')).toBe(true)
    expect(totalesCalculadosEn(SIN_DESGLOSE).has('discoveries')).toBe(false)
  })

  it('Propuestas, igual: es un total solo donde el libro la reparte', () => {
    expect(totalesCalculadosEn(CON_DESGLOSE).has('propuestas')).toBe(true)
    expect(totalesCalculadosEn(SIN_PROPUESTAS).has('propuestas')).toBe(false)
  })

  it('los otros cinco se calculan en los dos libros', () => {
    for (const ids of [CON_DESGLOSE, SIN_DESGLOSE]) {
      expect([...totalesCalculadosEn(ids)]).toEqual(
        expect.arrayContaining(['eleads', 'llamadas', 'ventas', 'ingreso-total', 'captacion-total']),
      )
    }
  })
})

describe('idsCapturables', () => {
  it('deja fuera los totales del plan y conserva el resto, en su orden', () => {
    const ids = ['eleads', 'eleads.publicidad', 'discoveries', 'ingreso-total', 'ingreso-otros']
    expect([...idsCapturables(ids)]).toEqual(['eleads.publicidad', 'discoveries', 'ingreso-otros'])
  })

  it('con Discoveries por canal se teclean sus canales y no el total', () => {
    const ids = idsCapturables(CON_DESGLOSE)
    expect(ids.has('discoveries')).toBe(false)
    expect(ids.has('discoveries.publicidad')).toBe(true)
  })

  it('sin desglose, Discoveries y Propuestas se siguen tecleando', () => {
    expect(idsCapturables(SIN_DESGLOSE).has('discoveries')).toBe(true)
    expect(idsCapturables(SIN_DESGLOSE).has('propuestas')).toBe(true)
  })
})
