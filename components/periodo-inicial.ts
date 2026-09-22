/**
 * En qué periodo se abre el tablero.
 *
 * Pura y sin React, para poder probarla sin montar el tablero entero.
 *
 * ── Manda el periodo de hoy ──────────────────────────────────────────────
 * Antes mandaba «el último con resultado», con el argumento de que el plan
 * llega a diciembre de 2028 y abrir en el último periodo dejaba la página en
 * blanco. El argumento era bueno y la regla, mala: da por hecho que los
 * resultados se capturan hacia atrás y nunca por delante. En cuanto hay
 * cifras en un mes futuro —un adelanto, una previsión cargada a mano, datos
 * de prueba— el tablero abre en un mes que todavía no ha pasado, y quien
 * entra a ver cómo va el mes tiene que retroceder a mano cada vez.
 *
 * Hoy es el periodo que alguien viene a mirar y a capturar. Se abre ahí.
 * Lo demás son respaldos para cuando hoy no cae dentro del plan: el último
 * con resultado y, si tampoco lo hay, el primero de la lista.
 */

import type { Periodo } from '@/lib/tipos'

/**
 * @param porTipo  Periodos del grano elegido, del más reciente al más antiguo.
 * @param conDato  Ids de los periodos con algún resultado capturado.
 * @param hoy      Fecha ISO 'YYYY-MM-DD' según el servidor. Ausente en pruebas.
 */
export function periodoInicial(
  porTipo: readonly Periodo[],
  conDato: ReadonlySet<string>,
  hoy?: string,
): string {
  const deHoy = hoy ? porTipo.find((p) => p.inicio <= hoy && hoy <= p.fin) : undefined
  if (deHoy) return deHoy.id

  // Hoy queda fuera del plan: o el libro aún no ha llegado hasta aquí, o ya
  // se cerró. Lo más útil entonces sí es el último periodo con cifras.
  const conReal = porTipo.find((p) => conDato.has(p.id))
  return conReal?.id ?? porTipo[0]?.id ?? ''
}
