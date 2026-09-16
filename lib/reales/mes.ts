/**
 * El mes, a partir de sus quincenas.
 *
 * Los reales se capturan por quincena; el mes no se guarda, se calcula aquí.
 * Es una función pura a propósito: la usan la fuente de datos (el tablero)
 * y la pantalla de captura, y si cada una hiciera su cuenta acabarían
 * diciendo cosas distintas.
 *
 * ── La regla ─────────────────────────────────────────────────────────────
 * Para cada indicador, el real del mes es la suma de las quincenas que
 * tienen dato, y se compara con la meta de ESAS quincenas: con las dos, el
 * plan del mes entero; con una sola, el de esa quincena. Así un mes a medias
 * se lee «a la fecha» y no sale «Fuera de plan» solo por estar a medias.
 * Se pidió así: «si ahora mismo quisiera ver septiembre, me mostraría el
 * mes como la primera quincena nomás».
 *
 * Vacío no es cero: una quincena sin dato no suma ni cuenta para el plan;
 * una quincena con 0 sí.
 */

import type { Meta, Periodo, Real } from '@/lib/tipos'

/** Id de quincena ('2026-09-Q1') → id de indicador → valor real. */
export type ValoresPorQuincena = Record<string, Record<string, number>>

/** En un mes a medias, qué quincena tiene datos. */
export type Cobertura = 'q1' | 'q2'

export interface ResumenMes {
  real: number | null
  meta: number | null
}

/** '2026-09' → ['2026-09-Q1', '2026-09-Q2']. */
export function idsDeQuincenas(mesId: string): [string, string] {
  return [`${mesId}-Q1`, `${mesId}-Q2`]
}

/** Al céntimo: sumar dos importes en coma flotante deja colas (0,1 + 0,2). */
function alCentimo(n: number): number {
  return Math.round(n * 100) / 100
}

/** La regla de un indicador en un mes. */
export function resumirMes(
  q1: number | null,
  q2: number | null,
  metaQ1: number | null,
  metaQ2: number | null,
  metaMes: number | null,
): ResumenMes {
  if (q1 !== null && q2 !== null) return { real: alCentimo(q1 + q2), meta: metaMes }
  if (q1 !== null) return { real: q1, meta: metaQ1 }
  if (q2 !== null) return { real: q2, meta: metaQ2 }
  return { real: null, meta: metaMes }
}

function valorDe(valores: Record<string, number> | undefined, indicadorId: string): number | null {
  const valor = valores?.[indicadorId]
  return typeof valor === 'number' && Number.isFinite(valor) ? valor : null
}

function tieneDatos(valores: Record<string, number> | undefined): boolean {
  return valores !== undefined && Object.keys(valores).length > 0
}

/**
 * Un mes está en curso cuando solo una de sus quincenas tiene algún dato.
 * La interfaz lo marca («hasta el 15») para que nadie lo lea como cerrado.
 */
export function coberturaDelMes(mesId: string, quincenas: ValoresPorQuincena): Cobertura | null {
  const [idQ1, idQ2] = idsDeQuincenas(mesId)
  const hayQ1 = tieneDatos(quincenas[idQ1])
  const hayQ2 = tieneDatos(quincenas[idQ2])
  if (hayQ1 && !hayQ2) return 'q1'
  if (hayQ2 && !hayQ1) return 'q2'
  return null
}

/** Los reales de un periodo: los de la quincena, o la suma del mes. */
export function realesDelPeriodo(periodo: Periodo, quincenas: ValoresPorQuincena): Real[] {
  if (periodo.tipo === 'quincena') {
    return Object.entries(quincenas[periodo.id] ?? {}).map(([indicadorId, valor]) => ({
      periodoId: periodo.id,
      indicadorId,
      valor,
      origen: 'manual' as const,
    }))
  }

  const [idQ1, idQ2] = idsDeQuincenas(periodo.id)
  const ids = new Set([
    ...Object.keys(quincenas[idQ1] ?? {}),
    ...Object.keys(quincenas[idQ2] ?? {}),
  ])
  const reales: Real[] = []
  for (const indicadorId of ids) {
    const { real } = resumirMes(
      valorDe(quincenas[idQ1], indicadorId),
      valorDe(quincenas[idQ2], indicadorId),
      null,
      null,
      null,
    )
    if (real !== null) {
      reales.push({ periodoId: periodo.id, indicadorId, valor: real, origen: 'manual' })
    }
  }
  return reales
}

/**
 * Las metas de un mes, ajustadas a lo que ya pasó: en un indicador con una
 * sola quincena capturada, la meta es la de esa quincena.
 */
export function metasDelMes(
  mesId: string,
  metasMes: readonly Meta[],
  metasQ1: readonly Meta[],
  metasQ2: readonly Meta[],
  quincenas: ValoresPorQuincena,
): Meta[] {
  const [idQ1, idQ2] = idsDeQuincenas(mesId)
  const metaQ1 = new Map(metasQ1.map((m) => [m.indicadorId, m.valor]))
  const metaQ2 = new Map(metasQ2.map((m) => [m.indicadorId, m.valor]))

  return metasMes.map((m) => {
    const { meta } = resumirMes(
      valorDe(quincenas[idQ1], m.indicadorId),
      valorDe(quincenas[idQ2], m.indicadorId),
      metaQ1.get(m.indicadorId) ?? null,
      metaQ2.get(m.indicadorId) ?? null,
      m.valor,
    )
    return meta === null || meta === m.valor ? m : { ...m, valor: meta }
  })
}
