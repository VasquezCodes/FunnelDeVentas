'use server'

/**
 * Guardar un mes de la captura: las dos quincenas de un golpe.
 *
 * Es una puerta pública —a una Server Action se la puede llamar desde fuera
 * de la pantalla—, así que no se da nada por bueno:
 *
 *   1. La contraseña primero. Si falla, se espera un segundo y medio antes de
 *      responder: probar contraseñas a ciegas deja de salir a cuenta.
 *   2. El mes tiene que existir en el plan y cada indicador también; cada
 *      valor, un número finito ≥ 0 con dos decimales como mucho. Los cinco
 *      totales no se aceptan: se calculan al leer (lib/captura/totales.ts).
 *   3. Las dos quincenas se reemplazan enteras y a la vez.
 *   4. `revalidatePath('/')` devuelve el tablero ya actualizado en la misma
 *      respuesta.
 */

import { revalidatePath } from 'next/cache'

import { fuenteExcel } from '@/lib/plan/fuente'
import { guardarQuincenas } from '@/lib/reales/almacen'
import { claveValida } from '@/lib/reales/clave'
import { idsDeQuincenas } from '@/lib/reales/mes'
import { idsCapturables } from '@/lib/plan/sumas'
import { PATRON_MES, limpiarValores } from '@/lib/reales/validar'

export type ResultadoGuardado =
  | { ok: true }
  | { ok: false; motivo: 'clave' | 'datos' | 'servidor'; mensaje: string }

const ESPERA_CLAVE_INCORRECTA_MS = 1500

export async function guardarMes(entrada: {
  mesId: string
  q1: Record<string, number>
  q2: Record<string, number>
  clave: string
}): Promise<ResultadoGuardado> {
  if (!claveValida(String(entrada?.clave ?? ''), process.env.CLAVE_CAPTURA)) {
    await new Promise((resolver) => setTimeout(resolver, ESPERA_CLAVE_INCORRECTA_MS))
    return { ok: false, motivo: 'clave', mensaje: 'Contraseña incorrecta.' }
  }

  const mesId = String(entrada.mesId ?? '')
  if (!PATRON_MES.test(mesId)) {
    return { ok: false, motivo: 'datos', mensaje: 'El mes no es válido.' }
  }

  try {
    const [periodos, indicadores] = await Promise.all([
      fuenteExcel.periodos(),
      fuenteExcel.indicadores(),
    ])
    if (!periodos.some((p) => p.id === mesId)) {
      return { ok: false, motivo: 'datos', mensaje: 'Ese mes no está en el plan.' }
    }

    // Solo lo que se teclea: un total que llegue se rechaza como cualquier
    // indicador que no se puede capturar.
    const ids = idsCapturables(indicadores.map((i) => i.id))
    const q1 = limpiarValores(entrada.q1, ids)
    if (!q1.ok) return { ok: false, motivo: 'datos', mensaje: q1.mensaje }
    const q2 = limpiarValores(entrada.q2, ids)
    if (!q2.ok) return { ok: false, motivo: 'datos', mensaje: q2.mensaje }

    const [idQ1, idQ2] = idsDeQuincenas(mesId)
    await guardarQuincenas({ [idQ1]: q1.valores, [idQ2]: q2.valores })
  } catch (error) {
    console.error('[captura] No se pudo guardar el mes', mesId, error)
    return {
      ok: false,
      motivo: 'servidor',
      mensaje: 'No se pudo guardar en Firebase. Inténtalo de nuevo en un momento.',
    }
  }

  revalidatePath('/')
  return { ok: true }
}
