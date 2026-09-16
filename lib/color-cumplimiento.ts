/**
 * Del rojo al verde: el color de un cumplimiento.
 *
 * Lo pidió el usuario para el Dinero: que arranque en rojo, pase por
 * amarillo y llegue a verde, más verde cuanto más cerca del plan. Las
 * franjas son las del semáforo (`UMBRALES_POR_DEFECTO`), así que el color y
 * la palabra nunca se contradicen: rojo con «Fuera de plan», ámbar con «Al
 * límite», verde con «En plan». Llegar al plan entero añade un verde más
 * intenso.
 *
 * Solo para lecturas de «mayor es mejor» (el ingreso). Devuelve tokens CSS,
 * no hex: el tema oscuro trae sus propios tonos.
 */

import { UMBRALES_POR_DEFECTO } from '@/lib/tipos'

export type Franja = 'critico' | 'alerta' | 'ok' | 'ok-fuerte' | 'sin-dato'

const TOKEN: Record<Franja, string> = {
  critico: 'var(--estado-critico)',
  alerta: 'var(--estado-alerta)',
  ok: 'var(--estado-ok)',
  'ok-fuerte': 'var(--estado-ok-fuerte)',
  'sin-dato': 'var(--estado-neutro)',
}

export function franjaDeCumplimiento(cumplimiento: number | null): Franja {
  if (cumplimiento === null || !Number.isFinite(cumplimiento)) return 'sin-dato'
  if (cumplimiento >= 1) return 'ok-fuerte'
  if (cumplimiento >= UMBRALES_POR_DEFECTO.ok) return 'ok'
  if (cumplimiento >= UMBRALES_POR_DEFECTO.alerta) return 'alerta'
  return 'critico'
}

/** El color sólido de la franja de un cumplimiento. */
export function colorDeCumplimiento(cumplimiento: number | null): string {
  return TOKEN[franjaDeCumplimiento(cumplimiento)]
}

/**
 * Las paradas de la escala continua, por cumplimiento. Cada cambio de color
 * ocupa solo dos puntos DESPUÉS de su umbral: el color coincide con la
 * palabra del semáforo salvo en esa transición mínima, y dentro de la franja
 * verde se va haciendo más intenso hasta el plan cumplido.
 */
const PARADAS: Array<{ posicion: number; color: string }> = [
  { posicion: 0, color: TOKEN.critico },
  { posicion: UMBRALES_POR_DEFECTO.alerta, color: TOKEN.critico },
  { posicion: UMBRALES_POR_DEFECTO.alerta + 0.02, color: TOKEN.alerta },
  { posicion: UMBRALES_POR_DEFECTO.ok, color: TOKEN.alerta },
  { posicion: UMBRALES_POR_DEFECTO.ok + 0.02, color: TOKEN.ok },
  { posicion: 1, color: TOKEN['ok-fuerte'] },
]

/**
 * El color de un cumplimiento en la escala continua (0 = nada, 1 = el plan
 * entero). Es el color del anillo del Dinero.
 */
export function colorEnPosicion(posicion: number): string {
  if (posicion <= 0) return PARADAS[0].color
  for (let i = 1; i < PARADAS.length; i++) {
    const a = PARADAS[i - 1]
    const b = PARADAS[i]
    if (posicion > b.posicion) continue
    if (a.color === b.color) return a.color
    const hacia = Math.round(((posicion - a.posicion) / (b.posicion - a.posicion)) * 100)
    if (hacia <= 0) return a.color
    if (hacia >= 100) return b.color
    return `color-mix(in oklch, ${b.color} ${hacia}%, ${a.color})`
  }
  return PARADAS[PARADAS.length - 1].color
}
