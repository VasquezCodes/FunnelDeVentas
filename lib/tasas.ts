/**
 * La tasa real: qué fracción de lo que había llegó a la etapa siguiente.
 *
 * Se calcula siempre con los dos lados del mismo periodo. Sin denominador, o
 * con un denominador de 0, no hay tasa: no hubo nada que convertir, y ni el
 * infinito ni el cero dirían la verdad. Un 0 arriba sí es una tasa: había
 * leads y ninguno llegó.
 */

import type { TasaDelPlan } from '@/lib/tipos'

export function tasaReal(desde: number | null, hacia: number | null): number | null {
  if (desde === null || hacia === null || desde === 0) return null
  const tasa = hacia / desde
  return Number.isFinite(tasa) ? tasa : null
}

/** La tasa del plan entre dos indicadores, si el catálogo la tiene. */
export function tasaEntre(
  tasas: readonly TasaDelPlan[],
  desde: string,
  hacia: string,
): TasaDelPlan | undefined {
  return tasas.find((t) => t.desde === desde && t.hacia === hacia)
}
