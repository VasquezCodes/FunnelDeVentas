/**
 * Qué indicadores son la suma de otros.
 *
 * En el Excel, varias filas no se planifican: salen de sumar otras. El total
 * de cada etapa repartida es la suma de sus canales —las filas «Cero» de la
 * hoja lo comprueban—, el ingreso es la suma de sus partidas y el gasto de
 * captación, la de sus canales. Es un hecho del plan, no de una pantalla, y
 * por eso vive aquí.
 *
 * Se deriva del catálogo en vez de escribirse a mano: si un día el Excel
 * estrena canal, el catálogo lo recoge y los totales lo suman sin tocar este
 * archivo.
 *
 * Discoveries y Propuestas son un total solo en los libros que las reparten
 * por canal (Discoveries desde el 0726; Propuestas, después). En los
 * anteriores son cifras que se teclean. Por eso lo que se calcula en un plan
 * concreto lo dice `totalesCalculadosEn`, con las filas que ese libro trae.
 */

import type { Indicador } from '@/lib/tipos'
import { INDICADORES_DEL_PLAN } from '@/lib/plan/catalogo'

function idsDonde(condicion: (i: Indicador) => boolean): string[] {
  return INDICADORES_DEL_PLAN.filter(condicion).map((i) => i.id)
}

/**
 * Id del total → ids de sus sumandos, en el orden del catálogo.
 *
 * Las ventas ARCO se quedan fuera del ingreso: son contratos, no dinero. Su
 * importe ya entra por «Altas ARCO».
 */
export const SUMANDOS: ReadonlyMap<string, readonly string[]> = new Map([
  ...['eleads', 'llamadas', 'discoveries', 'propuestas', 'ventas'].map(
    (etapa) => [etapa, idsDonde((i) => i.desglosaA === etapa)] as const,
  ),
  [
    'ingreso-total',
    idsDonde((i) => i.grupo === 'dinero' && i.unidad === 'moneda' && i.id !== 'ingreso-total'),
  ],
  ['captacion-total', idsDonde((i) => i.grupo === 'captacion' && i.canal !== undefined)],
])

/** Todos los indicadores que pueden calcularse, en algún libro. */
export const TOTALES_CALCULADOS: ReadonlySet<string> = new Set(SUMANDOS.keys())

/** Los totales que se calculan en un plan: los que tienen alguna de sus partes entre sus filas. */
export function totalesCalculadosEn(ids: Iterable<string>): Set<string> {
  const delPlan = new Set(ids)
  return new Set(
    [...SUMANDOS].filter(([, sumandos]) => sumandos.some((id) => delPlan.has(id))).map(([total]) => total),
  )
}

/**
 * Los ids que se pueden teclear y guardar en un plan: todos menos sus
 * totales. La acción de guardar rechaza cualquier otro.
 */
export function idsCapturables(ids: Iterable<string>): Set<string> {
  const lista = [...ids]
  const calculados = totalesCalculadosEn(lista)
  return new Set(lista.filter((id) => !calculados.has(id)))
}
