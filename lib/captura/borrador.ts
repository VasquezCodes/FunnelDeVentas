/**
 * El borrador de la pantalla de captura: lo que se teclea, como texto.
 *
 * Vive fuera del componente para poder probarlo. Dos reglas lo gobiernan:
 *
 *  - Vacío no es cero. Una casilla vacía —o un separador suelto, estado
 *    intermedio real al teclear «,5»— no es un número y no se guarda.
 *  - Solo lo que se teclea. Lo guardado llega con los totales ya calculados
 *    (`completarQuincenas`); si pasaran al borrador, viajarían al guardar y
 *    la acción los rechazaría. Qué se teclea depende del libro: Discoveries
 *    es una casilla en los que no la reparten y un total en los que sí.
 */

import type { Real } from '@/lib/tipos'

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

/** Lo guardado → borrador editable, solo con las casillas del plan (`idsCapturables`). */
export function aBorrador(reales: readonly Real[], capturables: ReadonlySet<string>): Borrador {
  const borrador: Borrador = {}
  for (const real of reales) {
    if (!capturables.has(real.indicadorId)) continue
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
