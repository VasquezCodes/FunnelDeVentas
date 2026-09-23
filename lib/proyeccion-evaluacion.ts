/**
 * Cuánto acierta una forma de proyectar: se prueba contra el pasado.
 *
 * Para cada mes con resultado se hace como si todavía no hubiera pasado: se
 * proyecta con lo que se sabía justo antes y se compara con lo que ocurrió.
 * Es la única manera honesta de decir que una proyección es «más precisa»:
 * medirla contra meses reales que no vio al calcularse.
 *
 * Devuelve dos cifras, porque miden cosas distintas:
 *
 *   · error medio (MAPE): cuánto se equivoca, sin mirar hacia dónde. Un 12 %
 *     quiere decir que, de media, la proyección cae a un 12 % de lo real.
 *   · sesgo: si se equivoca siempre hacia el mismo lado. Positivo es que
 *     proyecta de más —optimista—; negativo, de menos. Un método puede tener
 *     poco error medio y aun así engañar siempre en el mismo sentido.
 *
 * Pura: los mismos puntos, la misma nota.
 */

import type { OpcionesProyeccion, PuntoPlanReal } from '@/lib/proyeccion'
import { proyectar } from '@/lib/proyeccion'

export interface Evaluacion {
  /** Meses que se pudieron proyectar y comparar. */
  meses: number
  /** Error absoluto medio, en fracción de lo real (0,12 = 12 %). null sin meses. */
  errorMedio: number | null
  /** Error medio con signo: positivo, optimista; negativo, pesimista. */
  sesgo: number | null
  /** Cada mes probado: lo proyectado frente a lo que pasó. */
  detalle: Array<{ indice: number; proyectado: number; real: number }>
}

/**
 * Proyecta cada mes de la serie con lo que se sabía antes y lo compara con
 * su real. Un mes sin real, sin plan o con real 0 no se puntúa: no hay error
 * relativo que calcular contra cero.
 */
export function evaluar(
  serie: readonly PuntoPlanReal[],
  opciones: OpcionesProyeccion = {},
): Evaluacion {
  const detalle: Evaluacion['detalle'] = []

  for (let t = 1; t < serie.length; t++) {
    const real = serie[t].real
    const plan = serie[t].plan
    if (real === null || real === 0 || plan === null) continue

    // Lo que se sabía antes de ese mes, y el mes como si no hubiera pasado.
    const antes = [...serie.slice(0, t), { plan, real: null }]
    const proyeccion = proyectar(antes, { ...opciones, meses: 1 })
    const punto = proyeccion?.puntos.find((p) => p.indice === t)
    if (!punto) continue

    detalle.push({ indice: t, proyectado: punto.valor, real })
  }

  if (detalle.length === 0) return { meses: 0, errorMedio: null, sesgo: null, detalle }

  const relativos = detalle.map((d) => (d.proyectado - d.real) / d.real)
  const errorMedio = relativos.reduce((s, e) => s + Math.abs(e), 0) / relativos.length
  const sesgo = relativos.reduce((s, e) => s + e, 0) / relativos.length
  return { meses: detalle.length, errorMedio, sesgo, detalle }
}
