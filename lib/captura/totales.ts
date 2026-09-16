/**
 * Los totales de una quincena, calculados y nunca tecleados.
 *
 * La captura solo pide las partes —cada canal, cada partida— y los
 * totales salen de sumarlas (`lib/plan/sumas.ts`). Así no pueden descuadrar:
 * es la comprobación de las filas «Cero» del Excel, hecha imposible de fallar.
 *
 * Se usa en los dos lados con la misma regla: la pantalla de captura, al
 * teclear, y la lectura de los reales para el tablero. En Firestore no se
 * guarda ningún total, así que uno nunca se queda viejo.
 */

import { SUMANDOS } from '@/lib/plan/sumas'
import type { ValoresPorQuincena } from '@/lib/reales/mes'

/** El dinero se suma al céntimo: 0,1 + 0,2 no puede enseñar 0,30000000000000004. */
const alCentimo = (n: number) => Math.round(n * 100) / 100

/**
 * Las cifras de UNA quincena, con los totales del plan en uso añadidos.
 *
 * `calculados` son los totales de ese plan (`totalesCalculadosEn`). Cada uno
 * es la suma de los sumandos con dato; un 0 cuenta como dato. Si ninguno lo
 * tiene, el total no aparece: escribir un 0 afirmaría que no hubo nada, y lo
 * que pasa es que nadie lo ha capturado. Un total que ya viniera en la
 * entrada —tecleado antes— nunca cuenta: ni gana a la suma ni la sustituye.
 *
 * Así pasa con Discoveries al cambiar a un libro que la reparte por canal: la
 * cifra que se tecleó con el libro anterior deja de verse, y el total es lo
 * que digan sus canales, lo mismo que enseña la captura. Con un libro que no
 * la reparte no es un total y vale lo tecleado.
 */
export function completarTotales(
  valores: Readonly<Record<string, number>>,
  calculados: ReadonlySet<string>,
): Record<string, number> {
  const salida: Record<string, number> = { ...valores }

  for (const [total, sumandos] of SUMANDOS) {
    if (!calculados.has(total)) continue
    delete salida[total]
    const conDato = sumandos.filter((id) => valores[id] !== undefined)
    if (conDato.length === 0) continue
    salida[total] = alCentimo(conDato.reduce((suma, id) => suma + valores[id], 0))
  }

  return salida
}

/**
 * Cuántos sumandos de un total tienen dato, sobre cuántos tiene: el
 * «3 de 7 canales» de la fila de total. null si el indicador no es un total.
 */
export function sumandosConDato(
  valores: Readonly<Record<string, number>>,
  totalId: string,
): { con: number; de: number } | null {
  const sumandos = SUMANDOS.get(totalId)
  if (!sumandos) return null
  return {
    con: sumandos.filter((id) => valores[id] !== undefined).length,
    de: sumandos.length,
  }
}

/**
 * Todas las quincenas leídas de Firestore, cada una con sus totales.
 *
 * Se completa al leer, una sola vez, para que los reales, la meta a la fecha
 * de un mes en curso y la cobertura vean los mismos totales. Si solo los
 * reales los vieran, un total a medias —una quincena con canales y la otra
 * vacía— se compararía con el plan del mes entero y saldría «Fuera de plan»
 * por estar a medias.
 */
export function completarQuincenas(
  quincenas: Readonly<ValoresPorQuincena>,
  calculados: ReadonlySet<string>,
): ValoresPorQuincena {
  const salida: ValoresPorQuincena = {}
  for (const [id, valores] of Object.entries(quincenas)) salida[id] = completarTotales(valores, calculados)
  return salida
}
