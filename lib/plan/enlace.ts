/**
 * Qué libro del plan se lee.
 *
 * El plan cambia: cada mes se cierra un libro nuevo («Plan de Negocio 0726»)
 * y a veces trae filas nuevas. El enlace se elige desde la captura y se
 * guarda en Firebase; la variable `SHAREPOINT_PLAN_URL` queda solo como
 * respaldo, para el primer arranque o si Firebase no responde.
 */

import 'server-only'

import { cache } from 'react'

import { leerEnlaceGuardado } from '@/lib/reales/almacen'

export interface EnlaceDelPlan {
  url: string
  /** Cambia en cada guardado: forma parte de la clave de la caché del plan. */
  version: string
  origen: 'captura' | 'entorno'
}

export const enlaceDelPlan = cache(async (): Promise<EnlaceDelPlan> => {
  try {
    const guardado = await leerEnlaceGuardado()
    if (guardado) return { ...guardado, origen: 'captura' }
  } catch (error) {
    // Sin Firebase el tablero sigue: lee el libro de la variable de entorno.
    console.error('[plan] No se pudo leer el enlace guardado; se usa SHAREPOINT_PLAN_URL.', error)
  }
  const url = process.env.SHAREPOINT_PLAN_URL
  if (!url) {
    throw new Error(
      'Falta el enlace del plan: no se ha elegido ninguno desde Captura de datos y SHAREPOINT_PLAN_URL está vacía.',
    )
  }
  return { url, version: 'entorno', origen: 'entorno' }
})
