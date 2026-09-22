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

/**
 * CPM: lo que cuesta poner mil impresiones.
 *
 *     CPM = inversión × 1000 / impresiones
 *
 * No es una tasa de conversión sino un precio, y por eso va en euros y no en
 * porcentaje. Es el primer eslabón de la cadena de publicidad —la inversión
 * compra impresiones a ese precio— y el plan lo fija en 20 €: 1.880 € entre
 * 94.000 impresiones.
 *
 * Sin impresiones no hay CPM: dividir entre cero diría infinito, y lo que
 * pasa es que no se sirvió ni un anuncio. Se lee como «menor mejor», igual
 * que la inversión: pagar menos por mil impresiones es buena noticia.
 */
export function costePorMil(inversion: number | null, impresiones: number | null): number | null {
  if (inversion === null || impresiones === null || impresiones === 0) return null
  const cpm = (inversion * 1000) / impresiones
  return Number.isFinite(cpm) ? cpm : null
}

/** La tasa del plan entre dos indicadores, si el catálogo la tiene. */
export function tasaEntre(
  tasas: readonly TasaDelPlan[],
  desde: string,
  hacia: string,
): TasaDelPlan | undefined {
  return tasas.find((t) => t.desde === desde && t.hacia === hacia)
}
