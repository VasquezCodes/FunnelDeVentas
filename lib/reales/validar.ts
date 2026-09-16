/**
 * Lo que llega del navegador no se cree: se comprueba.
 *
 * La Server Action es una puerta pública. Aunque la pantalla de captura solo
 * deja teclear números ≥ 0 con dos decimales, a la acción se le puede llamar
 * con cualquier cosa. Aquí se exige lo mismo que en la pantalla y se rechaza
 * lo que no encaja, sin arreglarlo en silencio.
 */

/** Id de mes: '2026-09'. Nada de quincenas ni de meses imposibles. */
export const PATRON_MES = /^\d{4}-(0[1-9]|1[0-2])$/

export type ResultadoLimpieza =
  | { ok: true; valores: Record<string, number> }
  | { ok: false; mensaje: string }

export function limpiarValores(entrada: unknown, idsValidos: ReadonlySet<string>): ResultadoLimpieza {
  if (typeof entrada !== 'object' || entrada === null || Array.isArray(entrada)) {
    return { ok: false, mensaje: 'Los valores no tienen el formato esperado.' }
  }

  const valores: Record<string, number> = {}
  for (const [indicadorId, valor] of Object.entries(entrada)) {
    if (!idsValidos.has(indicadorId)) {
      return { ok: false, mensaje: `El indicador «${indicadorId}» no está en el plan.` }
    }
    if (typeof valor !== 'number' || !Number.isFinite(valor) || valor < 0) {
      return { ok: false, mensaje: `El valor de «${indicadorId}» no es un número válido.` }
    }
    valores[indicadorId] = Math.round(valor * 100) / 100
  }
  return { ok: true, valores }
}
