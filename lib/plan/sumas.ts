/**
 * Qué indicadores son la suma de otros.
 *
 * En el Excel, cinco filas no se planifican: salen de sumar otras. El total
 * de cada etapa repartida es la suma de sus canales —las filas «Cero» de la
 * hoja lo comprueban—, el ingreso es la suma de sus partidas y el gasto de
 * captación, la de sus canales. Es un hecho del plan, no de una pantalla, y
 * por eso vive aquí.
 *
 * Se deriva del catálogo en vez de escribirse a mano: si un día el Excel
 * estrena canal, el catálogo lo recoge y los totales lo suman sin tocar este
 * archivo.
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
  ...['eleads', 'llamadas', 'ventas'].map(
    (etapa) => [etapa, idsDonde((i) => i.desglosaA === etapa)] as const,
  ),
  [
    'ingreso-total',
    idsDonde((i) => i.grupo === 'dinero' && i.unidad === 'moneda' && i.id !== 'ingreso-total'),
  ],
  ['captacion-total', idsDonde((i) => i.grupo === 'captacion' && i.canal !== undefined)],
])

/** Los indicadores que se calculan y nunca se teclean ni se guardan. */
export const TOTALES_CALCULADOS: ReadonlySet<string> = new Set(SUMANDOS.keys())

/**
 * Los ids que se pueden teclear y guardar: todos menos los totales. La
 * acción de guardar rechaza cualquier otro.
 */
export function idsCapturables(ids: Iterable<string>): Set<string> {
  return new Set([...ids].filter((id) => !TOTALES_CALCULADOS.has(id)))
}
