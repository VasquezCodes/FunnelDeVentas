'use client'

/**
 * Registro único de GSAP.
 *
 * Los plugins se registran una sola vez, aquí, y no en cada componente:
 * registrar dentro de un componente que se vuelve a renderizar es trabajo
 * repetido y una fuente clásica de fugas.
 *
 * Importar gsap en el módulo es seguro en SSR mientras no se llame a nada
 * suyo durante el render del servidor. Todo el uso vive dentro de `useGSAP`,
 * que solo corre en cliente.
 */

import gsap from 'gsap'
import { useGSAP } from '@gsap/react'
import { SplitText } from 'gsap/SplitText'
import { Observer } from 'gsap/Observer'
import { DrawSVGPlugin } from 'gsap/DrawSVGPlugin'

// DrawSVG traza las líneas de los gráficos (la espina del embudo, la
// rejilla) como si las dibujara una pluma. Se registra aquí con los demás
// para que ningún gráfico tenga que acordarse de hacerlo.
gsap.registerPlugin(useGSAP, SplitText, Observer, DrawSVGPlugin)

/**
 * Curvas de la casa. Las mismas que usa el CSS (`--ease-fluid`,
 * `--ease-soft`), traducidas a GSAP para que un movimiento hecho con CSS y
 * otro hecho con GSAP no se sientan de dos aplicaciones distintas.
 */
export const CURVA_FLUIDA = 'cubic-bezier(0.32, 0.72, 0, 1)'
export const CURVA_SUAVE = 'cubic-bezier(0.22, 1, 0.36, 1)'

/**
 * ¿Ha pedido el usuario menos movimiento?
 *
 * Se consulta en cada animación en vez de una sola vez al cargar: la
 * preferencia se puede cambiar con la página abierta, y una herramienta
 * interna se deja abierta durante horas.
 */
export function prefiereQuietud(): boolean {
  if (typeof window === 'undefined') return true
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches
}

/**
 * Anima un número de un valor a otro.
 *
 * Devuelve el tween para poder encadenarlo. `formatear` recibe el valor
 * intermedio en cada fotograma: así el contador respeta el formato real del
 * indicador (moneda, porcentaje, cantidad) en vez de imprimir decimales
 * sueltos por el camino.
 *
 * Con movimiento reducido no cuenta: escribe el valor final y se acaba. Un
 * contador es exactamente el tipo de animación que marea a quien pidió que
 * no se moviera nada.
 *
 * Acepta cualquier `Element`, no solo HTML: las columnas de valores de los
 * gráficos son `<text>` de SVG, y lo único que se toca es `textContent`.
 */
export function contarHasta(
  nodo: Element | null,
  valor: number,
  formatear: (n: number) => string,
  opciones: { duracion?: number; retraso?: number } = {},
): gsap.core.Tween | null {
  if (!nodo) return null

  if (prefiereQuietud()) {
    nodo.textContent = formatear(valor)
    return null
  }

  const contador = { n: 0 }
  return gsap.to(contador, {
    n: valor,
    duration: opciones.duracion ?? 1.1,
    delay: opciones.retraso ?? 0,
    ease: 'power2.out',
    onUpdate: () => {
      nodo.textContent = formatear(contador.n)
    },
    // El último fotograma se escribe a mano: `onUpdate` puede quedarse a
    // una milésima del destino y dejar «91,99 %» impreso para siempre.
    onComplete: () => {
      nodo.textContent = formatear(valor)
    },
  })
}

export { gsap, useGSAP, SplitText, Observer, DrawSVGPlugin }
