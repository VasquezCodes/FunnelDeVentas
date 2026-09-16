/**
 * El borrador de la pantalla de captura: lo que se teclea, como texto.
 *
 * Vive fuera del componente para poder probarlo. Dos reglas lo gobiernan:
 *
 *  - Vacío no es cero. Una casilla vacía —o un separador suelto, estado
 *    intermedio real al teclear «,5»— no es un número y no se guarda.
 *  - Los totales no se teclean. Lo guardado llega con los cinco totales ya
 *    calculados (`completarQuincenas`); si pasaran al borrador, viajarían al
 *    guardar y la acción los rechazaría.
 */

import type { Real } from '@/lib/tipos'
import { TOTALES_CALCULADOS } from '@/lib/plan/sumas'

/** Texto de cada casilla, por id de indicador. */
export type Borrador = Record<string, string>

/**
 * Lo que se admite mientras se teclea: dígitos y como mucho un separador
 * decimal con dos cifras. Una tecla que no cabe simplemente no entra.
 */
export const PATRON_ENTRADA = /^\d*(?:[.,]\d{0,2})?$/

/**
 * Texto de la casilla → número. null para el vacío y el separador suelto.
 * Se acepta la coma decimal porque es la que trae el teclado en español.
 */
export function aNumero(texto: string): number | null {
  const limpio = texto.trim().replace(',', '.')
  if (limpio === '' || limpio === '.') return null
  const valor = Number(limpio)
  return Number.isFinite(valor) && valor >= 0 ? valor : null
}

/** Lo guardado → borrador editable, sin los totales calculados. */
export function aBorrador(reales: readonly Real[]): Borrador {
  const borrador: Borrador = {}
  for (const real of reales) {
    if (TOTALES_CALCULADOS.has(real.indicadorId)) continue
    borrador[real.indicadorId] = Number.isFinite(real.valor) ? String(real.valor) : ''
  }
  return borrador
}

/** Borrador → lo que se guarda: solo las casillas con número. */
export function aValores(borrador: Borrador): Record<string, number> {
  const valores: Record<string, number> = {}
  for (const [indicadorId, texto] of Object.entries(borrador)) {
    const valor = aNumero(texto)
    if (valor !== null) valores[indicadorId] = valor
  }
  return valores
}

/** Dos textos dicen lo mismo si representan el mismo número, o nada. */
export function mismoValor(a: string | undefined, b: string | undefined): boolean {
  return aNumero(a ?? '') === aNumero(b ?? '')
}
