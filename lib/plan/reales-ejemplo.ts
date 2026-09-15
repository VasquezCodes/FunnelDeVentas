/**
 * Resultados reales de ejemplo.
 *
 * ── Por qué existe este archivo ──────────────────────────────────────────
 * El plan viene del Excel; los reales se capturan a mano y todavía no se
 * guardan en ningún sitio. Sin nada que comparar, el tablero entero saldría
 * en «sin dato» y no habría forma de ver si el diseño funciona.
 *
 * Estos números son INVENTADOS y la interfaz lo dice en voz alta. Cuando la
 * captura persista, se borra este archivo y `fuenteExcel.reales()` pasa a
 * leer de donde toque. Nada más cambia.
 *
 * ── La historia que cuentan ──────────────────────────────────────────────
 * Es una historia concreta, no ruido aleatorio, porque un tablero se diseña
 * contra un problema y no contra una nube de puntos:
 *
 *   abr, may   El plan se cumple. Nada que mirar.
 *   jun        Primer aviso: la publicidad empieza a rendir peor por euro.
 *   jul, ago   La boca del embudo se estrecha; abajo todavía aguanta.
 *   sep        Los leads se hunden, pero el equipo comercial cierra MEJOR
 *              que nunca sobre lo poco que entra.
 *
 * O sea: el problema está arriba, en medios, no en ventas. Un tablero que no
 * deje ver eso de un vistazo está mal diseñado, y con estos números se puede
 * comprobar.
 *
 * Deterministas a propósito: nada de Math.random, que daría un número en el
 * servidor y otro en el cliente y rompería la hidratación.
 */

import type { Meta, Real } from '@/lib/tipos'
import { POR_ID } from '@/lib/plan/catalogo'

/** Meses con resultado capturado. Después de estos, el futuro está en blanco. */
const MESES_CERRADOS = ['2026-04', '2026-05', '2026-06', '2026-07', '2026-08', '2026-09']

/**
 * Cumplimiento (real / plan) por mes y por familia de indicador.
 *
 * `cierre` se aplica a las etapas bajas del embudo (propuestas y ventas) para
 * poder contar que el equipo comercial mejora mientras el volumen cae.
 */
interface Factores {
  boca: number
  cierre: number
  dinero: number
  gasto: number
  insumo: number
}

const FACTORES: Record<string, Factores> = {
  '2026-04': { boca: 1.02, cierre: 1.0, dinero: 1.01, gasto: 0.98, insumo: 1.01 },
  '2026-05': { boca: 0.99, cierre: 1.0, dinero: 0.99, gasto: 1.01, insumo: 0.99 },
  '2026-06': { boca: 0.96, cierre: 0.98, dinero: 0.97, gasto: 1.09, insumo: 0.94 },
  '2026-07': { boca: 0.9, cierre: 0.97, dinero: 0.95, gasto: 1.14, insumo: 0.88 },
  '2026-08': { boca: 0.82, cierre: 0.95, dinero: 0.92, gasto: 1.18, insumo: 0.79 },
  '2026-09': { boca: 0.71, cierre: 1.06, dinero: 0.87, gasto: 1.22, insumo: 0.68 },
}

/** Qué factor le toca a cada indicador. */
function factorDe(indicadorId: string, f: Factores): number {
  const indicador = POR_ID.get(indicadorId)
  if (!indicador) return 1

  if (indicador.grupo === 'insumo') return f.insumo
  if (indicador.grupo === 'captacion') return f.gasto
  if (indicador.grupo === 'dinero') return f.dinero

  // Embudo: la boca sufre, el cierre resiste. La etapa madre y sus desgloses
  // por canal comparten factor para que los canales sigan sumando el total.
  const raiz = indicador.desglosaA ?? indicador.id
  const bajo = raiz === 'propuestas' || raiz === 'ventas'
  const base = bajo ? f.cierre * f.boca : f.boca

  // La publicidad es la que se rompe: se lleva un castigo extra y los otros
  // canales lo compensan un poco, que es como se comporta un mix real.
  if (indicador.canal === 'publicidad') return base * 0.94
  if (indicador.canal === 'prospeccion') return base * 1.12
  if (indicador.canal === 'referidos') return base * 1.2

  return base
}

/** Los conteos son enteros; el dinero admite decimales pero se redondea. */
function ajustar(valor: number, unidad: string): number {
  if (unidad === 'cantidad') return Math.max(0, Math.round(valor))
  return Math.max(0, Math.round(valor * 100) / 100)
}

/**
 * Deriva los reales de ejemplo a partir de las metas de un periodo.
 * Un periodo sin factores (el futuro) devuelve lista vacía: todavía no ha
 * pasado, y fabricar un dato ahí sería peor que no tener ninguno.
 */
export function realesDeEjemplo(periodoId: string, metas: readonly Meta[]): Real[] {
  // Un id de quincena ('2026-04-Q1') empieza por el de su mes ('2026-04'),
  // así que el factor se busca por el prefijo. Las quincenas heredan el
  // comportamiento de su mes: como sus metas ya vienen partidas por la
  // mitad, aplicar el mismo factor da un real quincenal coherente que suma
  // exactamente el del mes.
  const mes = periodoId.slice(0, 7)
  const factores = FACTORES[mes]
  if (!factores || !MESES_CERRADOS.includes(mes)) return []

  const salida: Real[] = []

  for (const meta of metas) {
    const indicador = POR_ID.get(meta.indicadorId)
    if (!indicador) continue

    // Un plan de cero no se «cumple» en un porcentaje: se copia el cero y ya.
    const bruto = meta.valor === 0 ? 0 : meta.valor * factorDe(meta.indicadorId, factores)

    salida.push({
      periodoId,
      indicadorId: meta.indicadorId,
      valor: ajustar(bruto, indicador.unidad),
      origen: 'manual',
      capturadoPor: 'Datos de ejemplo',
    })
  }

  return salida
}

/** Meses con resultado en el juego de ejemplo. La interfaz lo usa para avisar. */
export const PERIODOS_CON_REAL = MESES_CERRADOS
