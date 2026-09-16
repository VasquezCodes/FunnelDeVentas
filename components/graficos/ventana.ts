/**
 * La ventana de periodos de una ficha: los que rodean al elegido.
 *
 * Pura y sin React, para poder probarla sin montar gráficos.
 */

import { compararPeriodos } from '@/lib/periodos'
import type { Periodo } from '@/lib/tipos'

/** Periodos de historia de cada ficha, contando el elegido. */
export const LARGO_VENTANA = 6

/**
 * Los `largo` periodos que acaban en el elegido y, detrás, hasta `siguientes`
 * periodos más: lo que viene, que solo tiene plan.
 *
 * Si el elegido cae cerca de un extremo del plan, la ventana se completa por
 * el otro lado: todas las fichas tienen el mismo número de puntos y el mes
 * elegido nunca se queda en un gráfico de un solo punto.
 */
export function ventanaDe<T extends { periodo: Periodo }>(
  serie: readonly T[],
  periodoId: string,
  largo = LARGO_VENTANA,
  siguientes = 0,
): { ventana: T[]; elegido: number } {
  const ordenada = serie.slice().sort((a, b) => compararPeriodos(a.periodo, b.periodo))
  let indice = ordenada.findIndex((p) => p.periodo.id === periodoId)
  if (indice < 0) indice = ordenada.length - 1
  const total = largo + siguientes
  const fin = Math.min(ordenada.length, indice + siguientes + 1)
  const inicio = Math.max(0, Math.min(fin - total, ordenada.length - total))
  return { ventana: ordenada.slice(inicio, inicio + total), elegido: indice - inicio }
}
