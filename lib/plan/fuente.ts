/**
 * Fuente de datos respaldada por el Excel del plan de negocio.
 *
 * Implementa el mismo contrato `FuenteDatos` que la fuente de ejemplo, así
 * que el tablero no sabe —ni tiene por qué saber— de dónde salen las cifras.
 *
 * El plan es real y viene de SharePoint. Los reales salen de Firestore
 * (`lib/reales/almacen.ts`), quincena a quincena; el mes se calcula con la
 * regla de `lib/reales/mes.ts`.
 */

import 'server-only'

import { createHash } from 'node:crypto'
import { cache } from 'react'

import type { FuenteDatos, Indicador, Meta, Periodo, Real, TasaDelPlan } from '@/lib/tipos'
import { compararPeriodos } from '@/lib/periodos'
import { cachearLecturaDelPlan, descargarLibro } from '@/lib/plan/graph'
import { enlaceDelPlan } from '@/lib/plan/enlace'
import { leerPlan, type PlanLeido } from '@/lib/plan/excel'
import { conQuincenas } from '@/lib/plan/quincenas'
import { estadoDeQuincenas } from '@/lib/reales/almacen'
import { completarQuincenas } from '@/lib/captura/totales'
import { totalesCalculadosEn } from '@/lib/plan/sumas'
import { coberturaDelMes, idsDeQuincenas, metasDelMes, realesDelPeriodo } from '@/lib/reales/mes'

/** Lo que se guarda en caché: el resultado de leer, nunca el binario. */
interface PlanEnCache extends PlanLeido {
  libro: string
  modificadoEn: string
  leidoEn: string
}

const leerDelOrigen = async (url: string): Promise<PlanEnCache> => {
  const { contenido, nombre, modificadoEn } = await descargarLibro(url)
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

/**
 * El plan, leído una sola vez por petición.
 *
 * `unstable_cache` guarda el plan entre peticiones, pero cada llamada lo
 * vuelve a deserializar entero, y la página lo pide unas doscientas veces
 * (metas y reales de cada periodo). `cache` de React lo reduce a una lectura
 * por petición: sin esto, pintar el tablero tras guardar tardaba segundos.
 */
//
// La clave de la caché lleva el enlace y su versión: al elegir otro libro
// desde la captura —o volver a guardar el mismo— se lee el Excel en ese
// momento, sin esperar la media hora. El prefijo cambia cuando cambia la
// forma de lo guardado, para no servir un plan con la forma de antes.
const obtenerPlan = cache(async (): Promise<PlanEnCache> => {
  const { url, version } = await enlaceDelPlan()
  const huella = createHash('sha256').update(`${url}|${version}`).digest('hex').slice(0, 24)
  return cachearLecturaDelPlan(`plan-de-ventas-discoveries-por-canal:${huella}`, () => leerDelOrigen(url))()
})

/**
 * Las quincenas guardadas, con sus totales ya calculados, una vez por
 * petición. En Firestore nunca hay totales (lib/captura/totales.ts): se
 * completan aquí para que los reales, la meta a la fecha y la cobertura
 * vean las mismas cifras.
 */
const quincenasCompletas = cache(async () => {
  // Los totales del libro en uso: con uno que reparte Discoveries por canal,
  // una cifra de Discoveries tecleada con el libro anterior ya no cuenta.
  const [plan, estado] = await Promise.all([obtenerPlan(), estadoDeQuincenas()])
  return completarQuincenas(estado.quincenas, totalesCalculadosEn(plan.indicadores.map((i) => i.id)))
})

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

  /**
   * Del más reciente al más antiguo: es lo que espera el contrato. Los meses
   * a medias llevan su cobertura, para que la interfaz los marque.
   */
  async periodos(): Promise<Periodo[]> {
    const [plan, quincenas] = await Promise.all([obtenerPlan(), quincenasCompletas()])
    return plan.periodos
      .map((p) => {
        if (p.tipo !== 'mes') return p
        const cobertura = coberturaDelMes(p.id, quincenas)
        return cobertura ? { ...p, cobertura } : p
      })
      .sort((a, b) => compararPeriodos(b, a))
  },

  /** En un mes en curso, la meta es la de lo que ya pasó. */
  async metas(periodoId: string): Promise<Meta[]> {
    const [plan, quincenas] = await Promise.all([obtenerPlan(), quincenasCompletas()])
    const delPeriodo = (id: string) => plan.metas.filter((m) => m.periodoId === id)
    const metas = delPeriodo(periodoId)
    const periodo = plan.periodos.find((p) => p.id === periodoId)
    if (periodo?.tipo !== 'mes') return metas
    const [idQ1, idQ2] = idsDeQuincenas(periodoId)
    return metasDelMes(periodoId, metas, delPeriodo(idQ1), delPeriodo(idQ2), quincenas)
  },

  async reales(periodoId: string): Promise<Real[]> {
    const [plan, quincenas] = await Promise.all([obtenerPlan(), quincenasCompletas()])
    const periodo = plan.periodos.find((p) => p.id === periodoId)
    return periodo ? realesDelPeriodo(periodo, quincenas) : []
  },

  async tasas(): Promise<TasaDelPlan[]> {
    return (await obtenerPlan()).tasas
  },
}
