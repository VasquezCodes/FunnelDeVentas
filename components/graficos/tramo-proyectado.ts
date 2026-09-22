/**
 * El tramo proyectado: la continuación punteada de la línea real.
 *
 * Al final de la serie hay un mes que todavía no ha pasado y que el tablero
 * proyecta (`lib/proyeccion.ts`). Va punteado, que es la convención de «esto
 * aún no es un dato», con su punto de anillo discontinuo y su leyenda.
 *
 * ── Por qué la proyección son dos meses y no uno ────────────────────────
 * Recharts no pinta un trazo con dos estilos, así que la parte punteada es
 * una serie aparte, y arranca en el último real para que no haya un salto
 * entre trazos. Con UN mes proyectado eso son dos puntos, y entre dos puntos
 * no hay curva posible por mucha interpolación que se pida: sale la recta
 * angulosa con que acababa el gráfico.
 *
 * La primera solución fue arrastrar un par de puntos reales más, ya
 * dibujados, para tener tres. Se veía: el área tiene relleno translúcido, y
 * el punteado asomaba por debajo como una sombra al lado de la curva sólida.
 *
 * Así que los tres puntos salen de donde tienen que salir: el último real y
 * DOS meses proyectados (lib/proyeccion.ts), cada uno con su propio plan por
 * el mismo ritmo. La curva sale sola y no se pisa nada.
 *
 * ── Lo que ya no hace ────────────────────────────────────────────────────
 * Hubo un tramo punteado para el mes a medias —el que solo tiene una
 * quincena capturada—. Se quitó: eran dos marcas distintas para dos cosas
 * que el que mira no tiene por qué separar, y la única referencia extra que
 * se quería era la proyección. El mes a medias es un real, aunque sea
 * parcial, y va en la línea sólida como los demás.
 */

import type { Proyeccion } from '@/lib/proyeccion'

export function tramoProyectado<T extends { real: number | null }>(
  datos: readonly T[],
  proyeccion: Proyeccion | null,
): Array<T & { proyectado: number | null }> {
  const puntos = proyeccion?.puntos.filter((p) => datos[p.indice] !== undefined) ?? []
  if (puntos.length === 0) return datos.map((d) => ({ ...d, proyectado: null }))

  const valores = new Map(puntos.map((p) => [p.indice, p.valor]))
  // El arranque: el último real antes del primer mes proyectado. Es el punto
  // que comparten la línea sólida y la punteada, para que no haya un salto.
  let arranque = -1
  for (let i = 0; i < puntos[0].indice; i++) {
    if (datos[i].real !== null) arranque = i
  }

  return datos.map((d, i) => {
    const valor = valores.get(i)
    if (valor !== undefined) return { ...d, proyectado: valor }
    return { ...d, proyectado: i === arranque ? d.real : null }
  })
}
