import { describe, expect, it } from 'vitest'

import { completarQuincenas, completarTotales, sumandosConDato } from '@/lib/captura/totales'
import { INDICADORES_DEL_PLAN } from '@/lib/plan/catalogo'
import { totalesCalculadosEn } from '@/lib/plan/sumas'
import { metasDelMes } from '@/lib/reales/mes'

/** Los totales de los dos libros que hay: el 0726 reparte Discoveries por canal; los anteriores, no. */
const IDS = INDICADORES_DEL_PLAN.map((i) => i.id)
const CON_DESGLOSE = totalesCalculadosEn(IDS)
const SIN_DESGLOSE = totalesCalculadosEn(IDS.filter((id) => !id.startsWith('discoveries.')))

describe('completarTotales', () => {
  it('con los siete canales, el total es su suma', () => {
    const salida = completarTotales(
      {
        'eleads.publicidad': 40,
        'eleads.prospeccion': 12,
        'eleads.referidos': 3,
        'eleads.afiliados': 0,
        'eleads.contenido': 2,
        'eleads.newsletter': 1,
        'eleads.interno': 5,
      },
      CON_DESGLOSE,
    )
    expect(salida.eleads).toBe(63)
  })

  it('con solo algunos canales, suma los que tienen dato', () => {
    const salida = completarTotales(
      { 'eleads.publicidad': 40, 'eleads.prospeccion': 12, 'eleads.referidos': 3 },
      CON_DESGLOSE,
    )
    expect(salida.eleads).toBe(55)
  })

  it('sin ningún sumando con dato, el total no aparece: vacío no es cero', () => {
    // Un total tecleado sin ninguna de sus partes no se conserva: la cifra
    // vendría de un libro que no repartía esa etapa, y ya no manda.
    expect(completarTotales({ eleads: 20 }, CON_DESGLOSE)).toEqual({})
  })

  it('con un libro que reparte Discoveries, su total es la suma de los canales y gana a la cifra tecleada', () => {
    const salida = completarTotales(
      { discoveries: 20, 'discoveries.publicidad': 8, 'discoveries.prospeccion': 3 },
      CON_DESGLOSE,
    )
    expect(salida.discoveries).toBe(11)
  })

  it('con un libro que reparte Discoveries, una cifra tecleada antes sin canales no cuenta', () => {
    // Septiembre se guardó con el libro anterior: 29 discoveries y ningún canal.
    expect(completarTotales({ discoveries: 29 }, CON_DESGLOSE)).toEqual({})
  })

  it('con un libro que no la reparte, Discoveries es la cifra tecleada', () => {
    expect(completarTotales({ discoveries: 29 }, SIN_DESGLOSE)).toEqual({ discoveries: 29 })
  })

  it('un 0 es un dato y da un total de 0', () => {
    expect(completarTotales({ 'ventas.publicidad': 0 }, CON_DESGLOSE).ventas).toBe(0)
  })

  it('el dinero se suma al céntimo, sin colas de coma flotante', () => {
    const salida = completarTotales(
      { 'captacion.publicidad': 0.1, 'captacion.prospeccion': 0.2 },
      CON_DESGLOSE,
    )
    expect(salida['captacion-total']).toBe(0.3)
  })

  it('el ingreso total no suma las ventas ARCO, que son contratos', () => {
    const salida = completarTotales(
      { 'ingreso-flecha-recurrente': 54000, 'ingreso-arco-setup': 17500, 'ventas-arco': 1 },
      CON_DESGLOSE,
    )
    expect(salida['ingreso-total']).toBe(71500)
  })

  it('un total que ya venía en la entrada lo sustituye la suma', () => {
    expect(completarTotales({ eleads: 999, 'eleads.publicidad': 40 }, CON_DESGLOSE).eleads).toBe(40)
  })

  it('un total que ya venía sin sumandos con dato se quita', () => {
    expect(completarTotales({ eleads: 999 }, CON_DESGLOSE)).toEqual({})
  })

  it('conserva las cifras tecleadas y no muta la entrada', () => {
    const entrada = { 'eleads.publicidad': 40, discoveries: 20 }
    const salida = completarTotales(entrada, SIN_DESGLOSE)
    expect(salida).toEqual({ 'eleads.publicidad': 40, discoveries: 20, eleads: 40 })
    expect(entrada).toEqual({ 'eleads.publicidad': 40, discoveries: 20 })
  })
})

describe('sumandosConDato', () => {
  it('cuenta los sumandos con dato, el 0 incluido, sobre los que tiene el total', () => {
    const valores = { 'eleads.publicidad': 40, 'eleads.referidos': 0 }
    expect(sumandosConDato(valores, 'eleads')).toEqual({ con: 2, de: 7 })
  })

  it('el gasto total tiene seis sumandos', () => {
    expect(sumandosConDato({}, 'captacion-total')).toEqual({ con: 0, de: 6 })
  })

  it('un indicador que no es un total no tiene sumandos', () => {
    expect(sumandosConDato({ 'ventas-arco': 2 }, 'ventas-arco')).toBeNull()
  })
})

describe('completarQuincenas', () => {
  it('completa los totales de cada quincena sin tocar la entrada', () => {
    const entrada = {
      '2026-09-Q1': { 'eleads.publicidad': 30, 'eleads.prospeccion': 20 },
      '2026-09-Q2': { discoveries: 5 },
    }
    const salida = completarQuincenas(entrada, SIN_DESGLOSE)
    expect(salida['2026-09-Q1']).toEqual({
      'eleads.publicidad': 30,
      'eleads.prospeccion': 20,
      eleads: 50,
    })
    expect(salida['2026-09-Q2']).toEqual({ discoveries: 5 })
    expect(entrada['2026-09-Q1']).toEqual({ 'eleads.publicidad': 30, 'eleads.prospeccion': 20 })
  })

  it('con las quincenas completas, un total a medias se compara con la meta de la 1ª quincena', () => {
    const quincenas = completarQuincenas({ '2026-09-Q1': { 'eleads.publicidad': 30 } }, CON_DESGLOSE)
    const meta = (periodoId: string, valor: number) => ({ periodoId, indicadorId: 'eleads', valor })
    expect(
      metasDelMes(
        '2026-09',
        [meta('2026-09', 145)],
        [meta('2026-09-Q1', 72)],
        [meta('2026-09-Q2', 73)],
        quincenas,
      ),
    ).toEqual([meta('2026-09', 72)])
  })
})
