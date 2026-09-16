/**
 * Lectura de la hoja «Variables»: las hipótesis del plan.
 *
 * Ahí viven las tasas con las que el plan calcula el embudo (la conversión a
 * llamada, el CTR, la CVR de cada canal). No se leen por celda sino por
 * NOMBRE DEFINIDO: el libro las nombra (`CVR_Llamada` → Variables!$G$5), así
 * que alguien puede mover la celda en el Excel sin que el tablero se entere.
 */

import type { WorkBook } from 'xlsx'

/** 'Variables!$G$5' o "'Variables'!$G$5" → { hoja, celda }. Solo una celda. */
function celdaDe(ref: string): { hoja: string; celda: string } | null {
  const m = /^'?([^'!]+)'?!\$?([A-Z]+)\$?(\d+)$/.exec(ref.trim())
  return m ? { hoja: m[1], celda: `${m[2]}${m[3]}` } : null
}

/**
 * Los nombres definidos que apuntan a un número de una sola celda, con su
 * valor. Los nombres se normalizan (NFC): «Prospección» puede llegar con la
 * tilde compuesta o descompuesta según quién guardó el libro.
 */
export function valoresDeNombres(libro: WorkBook): Map<string, number> {
  const valores = new Map<string, number>()
  for (const definido of libro.Workbook?.Names ?? []) {
    const destino = celdaDe(definido.Ref ?? '')
    if (!destino) continue
    const valor = libro.Sheets[destino.hoja]?.[destino.celda]?.v
    if (typeof valor !== 'number' || !Number.isFinite(valor)) continue
    valores.set(definido.Name.normalize('NFC'), valor)
  }
  return valores
}
