/**
 * Fuente de datos respaldada por el Excel del plan de negocio.
 *
 * Implementa el mismo contrato `FuenteDatos` que la fuente de ejemplo, así
 * que el tablero no sabe —ni tiene por qué saber— de dónde salen las cifras.
 *
 * El plan es real y viene de SharePoint. Los reales son de ejemplo mientras
 * la captura no persista; el día que lo haga, solo cambia `reales()`.
 */

import 'server-only'

import type { FuenteDatos, Indicador, Meta, Periodo, Real } from '@/lib/tipos'
import { compararPeriodos } from '@/lib/periodos'
import { cachearLecturaDelPlan, descargarLibro } from '@/lib/plan/graph'
import { leerPlan, type PlanLeido } from '@/lib/plan/excel'
import { conQuincenas } from '@/lib/plan/quincenas'
import { realesDeEjemplo } from '@/lib/plan/reales-ejemplo'

/** Lo que se guarda en caché: el resultado de leer, nunca el binario. */
interface PlanEnCache extends PlanLeido {
  libro: string
  modificadoEn: string
  leidoEn: string
}

const leerDelOrigen = async (): Promise<PlanEnCache> => {
  const { contenido, nombre, modificadoEn } = await descargarLibro()
  const leido = leerPlan(contenido)

  // El Excel es mensual. Las quincenas se derivan partiendo la meta por la
  // mitad; el porqué y sus límites están en `lib/plan/quincenas.ts`.
  const { periodos, metas } = conQuincenas(leido.periodos, leido.metas, leido.indicadores)
  const plan = { ...leido, periodos, metas }

  if (plan.incidencias.length > 0) {
    // No se lanza: un indicador perdido no debe tumbar el tablero entero.
    // Pero tiene que quedar rastro, y la interfaz también lo enseña.
    console.warn(
      `[plan] ${plan.incidencias.length} filas del catálogo no se encontraron en el Excel:`,
      plan.incidencias.join(', '),
    )
  }

  return {
    ...plan,
    libro: nombre,
    modificadoEn,
    // Sella cuándo se leyó. Al venir de dentro de la caché, esta marca dice
    // la edad real del dato y no el instante del render.
    leidoEn: new Date().toISOString(),
  }
}

const obtenerPlan = cachearLecturaDelPlan('plan-de-ventas', leerDelOrigen)

/** Estado de la lectura, para que la interfaz pueda decir de dónde viene. */
export interface ProcedenciaDelPlan {
  libro: string
  modificadoEn: string
  leidoEn: string
  meses: number
  indicadores: number
  incidencias: string[]
}

export async function procedenciaDelPlan(): Promise<ProcedenciaDelPlan> {
  const plan = await obtenerPlan()
  return {
    libro: plan.libro,
    modificadoEn: plan.modificadoEn,
    leidoEn: plan.leidoEn,
    // Solo los meses: `periodos` incluye ahora las quincenas derivadas y
    // decir «99 meses» sería mentir sobre lo que trae el Excel.
    meses: plan.periodos.filter((p) => p.tipo === 'mes').length,
    indicadores: plan.indicadores.length,
    incidencias: plan.incidencias,
  }
}

export const fuenteExcel: FuenteDatos = {
  async indicadores(): Promise<Indicador[]> {
    return (await obtenerPlan()).indicadores
  },

  /** Del más reciente al más antiguo: es lo que espera el contrato. */
  async periodos(): Promise<Periodo[]> {
    const plan = await obtenerPlan()
    return plan.periodos.slice().sort((a, b) => compararPeriodos(b, a))
  },

  async metas(periodoId: string): Promise<Meta[]> {
    const plan = await obtenerPlan()
    return plan.metas.filter((m) => m.periodoId === periodoId)
  },

  async reales(periodoId: string): Promise<Real[]> {
    const plan = await obtenerPlan()
    const metas = plan.metas.filter((m) => m.periodoId === periodoId)
    return realesDeEjemplo(periodoId, metas)
  },
}
