/**
 * Del rojo al verde: el color de un cumplimiento.
 *
 * Lo pidió el usuario para el Dinero: que arranque en rojo, se vaya
 * convirtiendo en amarillo y termine en verde. Hay dos lecturas:
 *
 *  - Las franjas (`franjaDeCumplimiento`) SON las del semáforo: la misma
 *    función, para que el color y la palabra no puedan discrepar. Rojo con
 *    «Fuera del plan», ámbar con «Cerca del plan», verde con «En plan» y el
 *    verde más marcado con «Mejor que el plan».
 *  - La escala continua (`colorEnPosicion`, `degradadoDeCumplimiento`) es el
 *    avance hacia el plan, y cambia de color desde el primer momento. Antes
 *    seguía las franjas y un 68 % salía rojo de punta a punta; el usuario lo
 *    corrigió: «68 % no está tan mal y lo marca en super rojo». Ahora el
 *    amarillo llega hacia el 60 %, el verde hacia el 90 % y el plan cumplido
 *    es el verde más intenso. La palabra del semáforo sigue con sus umbrales.
 *
 * Solo para lecturas de «mayor es mejor» (el ingreso). Devuelve tokens CSS,
 * no hex: el tema oscuro trae sus propios tonos.
 */

import type { Estado } from '@/lib/tipos'
import { calcularEstado } from '@/lib/comparacion'

const TOKEN: Record<Estado, string> = {
  mejor: 'var(--estado-ok-fuerte)',
  'en-plan': 'var(--estado-ok)',
  cerca: 'var(--estado-alerta)',
  fuera: 'var(--estado-critico)',
  'sin-dato': 'var(--estado-neutro)',
}

/**
 * La franja de un cumplimiento ES su estado del semáforo, calculado con el
 * mismo motor. Antes había aquí una escala propia —'critico' | 'alerta' |
 * 'ok' | 'ok-fuerte'— con sus propios cortes, y una prueba se encargaba de
 * vigilar que no contradijera a la palabra que se enseñaba al lado. Dos
 * vocabularios para lo mismo es una contradicción esperando a pasar: ahora
 * no puede haberla, porque es el mismo.
 *
 * Siempre 'mayor-mejor': esto colorea el ingreso, donde más es más.
 */
export function franjaDeCumplimiento(cumplimiento: number | null): Estado {
  return calcularEstado(cumplimiento, 'mayor-mejor')
}

/** El color sólido de la franja de un cumplimiento. */
export function colorDeCumplimiento(cumplimiento: number | null): string {
  return TOKEN[franjaDeCumplimiento(cumplimiento)]
}

/**
 * Las paradas de la escala continua, por cumplimiento: del rojo al amarillo
 * en la primera mitad larga, del amarillo al verde hasta el 90 % y, de ahí
 * al plan, el verde se hace más intenso.
 */
const PARADAS: Array<{ posicion: number; color: string }> = [
  { posicion: 0, color: TOKEN.fuera },
  { posicion: 0.6, color: TOKEN.cerca },
  { posicion: 0.9, color: TOKEN['en-plan'] },
  { posicion: 1, color: TOKEN.mejor },
]

/**
 * La escala continua como degradado CSS, de 0 (a la izquierda) al plan
 * entero (a la derecha). En oklch, como `colorEnPosicion`: del rojo al
 * amarillo pasa por naranja, y del amarillo al verde, por verde oliva.
 */
export function degradadoDeCumplimiento(): string {
  const paradas = PARADAS.map((p) => `${p.color} ${Math.round(p.posicion * 100)}%`).join(', ')
  return `linear-gradient(in oklch 90deg, ${paradas})`
}

/**
 * El color de un cumplimiento en la escala continua (0 = nada, 1 = el plan
 * entero). Es el color del anillo del Dinero en cada punto de su recorrido.
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
