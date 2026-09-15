'use client'

/**
 * Ancho real del contenedor de un gráfico, y la escala del texto.
 *
 * Un gráfico SVG no se adapta con CSS: el ancho de sus ejes, cuántas marcas
 * caben o si los nombres tienen que partirse en dos líneas son números que
 * hay que decidir en JavaScript. Las media queries tampoco sirven, porque lo
 * que importa es el sitio que le deja el carrusel, no la ventana.
 *
 * Devuelve una ref de CALLBACK y no un `useRef`: el nodo puede no existir en
 * el primer render (el Embudo pinta un estado vacío sin gráfico) y aparecer
 * después. Con un objeto ref el efecto no se enteraría, porque su identidad
 * no cambia; con la callback, el nodo nuevo entra como dependencia.
 *
 * Mientras no se ha medido devuelve null y el gráfico usa su disposición
 * ancha, que es también la que pinta el servidor.
 *
 * ── La escala del texto ─────────────────────────────────────────────────
 * La app escala todo su texto desde la raíz («todo en rem»: el `html` pasa
 * al 108 % desde 1024 px y al 114 % desde 1536 px). El texto de un SVG de
 * Recharts, en cambio, va en px fijos, así que en pantallas anchas los
 * nombres de etapa se quedaban más pequeños que la leyenda de su propia
 * tarjeta. `escalaTexto` es el tamaño de la raíz sobre 16 px (1 mientras no
 * se ha medido), para que el gráfico multiplique sus tamaños de letra por
 * él. Se lee en el mismo aviso del ResizeObserver: la raíz solo cambia en
 * esos dos cortes, y los dos cambian también el ancho de la tarjeta, así que
 * el observador salta igualmente.
 */

import { useEffect, useState } from 'react'

export function useAnchoContenedor<T extends HTMLElement>(): [
  (nodo: T | null) => void,
  number | null,
  number,
] {
  const [nodo, setNodo] = useState<T | null>(null)
  const [ancho, setAncho] = useState<number | null>(null)
  const [escalaTexto, setEscalaTexto] = useState(1)

  useEffect(() => {
    if (!nodo) return
    const observador = new ResizeObserver((entradas) => {
      const entrada = entradas[entradas.length - 1]
      if (!entrada) return
      setAncho(Math.round(entrada.contentRect.width))
      setEscalaTexto(parseFloat(getComputedStyle(document.documentElement).fontSize) / 16 || 1)
    })
    observador.observe(nodo)
    return () => observador.disconnect()
  }, [nodo])

  return [setNodo, ancho, escalaTexto]
}
