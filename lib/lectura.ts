/**
 * Motor de lectura: convierte una tanda de comparativas en una frase.
 *
 * ── Por qué esto es código y no un rótulo fijo ───────────────────────────
 * Un tablero que solo apila cifras deja el trabajo difícil al que mira:
 * decidir qué significan juntas. La pregunta real que trae alguien a esta
 * pantalla no es «¿cuántos leads hubo?», es «¿vamos bien, y si no, dónde se
 * rompió?». Eso se puede contestar con reglas, así que se contesta.
 *
 * ── Qué NO hace ──────────────────────────────────────────────────────────
 * No adivina causas que el dato no sostiene. Distingue dos cosas, que son
 * las únicas que el embudo permite separar con honestidad:
 *
 *   · VOLUMEN — entra menos de lo previsto por la boca.
 *   · CONVERSIÓN — entra lo previsto pero se cae por el camino.
 *
 * «La publicidad rinde peor» sería una tercera afirmación, y esa sí sale del
 * cruce con el gasto por canal, no de aquí.
 *
 * Puro y sin fechas del sistema: mismas comparativas, misma frase.
 */

import type { Comparativa, Conversion, Estado } from '@/lib/tipos'

/** Cuánto tiene que desviarse una tasa para que merezca mencionarse. */
const TOLERANCIA_TASA = 0.02

/** Por debajo de esto el cumplimiento deja de ser «rozar el plan». */
const UMBRAL_EN_PLAN = 0.95

export interface Lectura {
  /** La conclusión, en una frase. Es lo primero que se lee de la página. */
  titular: string
  /** El matiz: dónde mirar. Vacío si no hay nada honesto que añadir. */
  detalle: string
  /** Cumplimiento del indicador de cabecera, si lo hay. */
  cumplimiento: number | null
  /** Tono para el acento del bloque. Nunca viaja solo: siempre hay texto. */
  tono: Estado
  /** Reparto de estados, para la tira apilada. */
  reparto: Record<Estado, number>
}

function porcentaje(fraccion: number): string {
  return `${Math.round(fraccion * 100)} %`
}

/**
 * Etapa donde el embudo se estrecha más respecto al plan.
 * Devuelve null si ninguna conversión se aparta lo suficiente.
 */
function peorConversion(conversiones: readonly Conversion[]): Conversion | null {
  let peor: Conversion | null = null
  let peorBrecha = TOLERANCIA_TASA

  for (const c of conversiones) {
    if (c.tasaPlan === null || c.tasaReal === null) continue
    // La dirección del indicador de destino decide qué es empeorar.
    const brecha =
      c.hacia.direccion === 'menor-mejor' ? c.tasaReal - c.tasaPlan : c.tasaPlan - c.tasaReal
    if (brecha > peorBrecha) {
      peorBrecha = brecha
      peor = c
    }
  }

  return peor
}

export function leer(
  comparativas: readonly Comparativa[],
  conversiones: readonly Conversion[],
  cabeceraId = 'ingreso-total',
): Lectura {
  const reparto: Record<Estado, number> = {
    mejor: 0,
    'en-plan': 0,
    cerca: 0,
    fuera: 0,
    'sin-dato': 0,
  }
  for (const c of comparativas) reparto[c.estado] += 1

  const conDato = comparativas.filter((c) => c.estado !== 'sin-dato')
  const cabecera = comparativas.find((c) => c.indicador.id === cabeceraId) ?? null
  const cumplimiento = cabecera?.cumplimiento ?? null

  // ── Nadie ha capturado nada ───────────────────────────────────────────
  if (conDato.length === 0) {
    return {
      titular: 'Este periodo todavía no tiene resultado.',
      detalle:
        'El plan está cargado y esperando. En cuanto se capturen las cifras del mes, aquí aparecerá la comparación.',
      cumplimiento: null,
      tono: 'sin-dato',
      reparto,
    }
  }

  // ── La boca del embudo y el cierre, por separado ───────────────────────
  const boca = comparativas.find((c) => c.indicador.etapa === 1) ?? null
  const cierre = comparativas.find((c) => c.indicador.etapa === 5) ?? null
  const estrechamiento = peorConversion(conversiones)

  const bocaFloja = boca?.cumplimiento !== null && (boca?.cumplimiento ?? 1) < UMBRAL_EN_PLAN
  const hayEstrechamiento = estrechamiento !== null

  // ── Titular ───────────────────────────────────────────────────────────
  let titular: string
  let tono: Estado = cabecera?.estado ?? 'sin-dato'

  if (cumplimiento === null) {
    titular = 'El mes tiene cifras, pero falta el ingreso.'
    tono = 'sin-dato'
  } else if (cumplimiento >= 1) {
    titular = `El mes cierra por encima del plan, al ${porcentaje(cumplimiento)}.`
  } else if (cumplimiento >= UMBRAL_EN_PLAN) {
    titular = `El mes cierra en plan, al ${porcentaje(cumplimiento)}.`
  } else {
    titular = `El mes cierra al ${porcentaje(cumplimiento)} del plan.`
  }

  // ── Detalle: dónde mirar ──────────────────────────────────────────────
  // El orden importa. Si entra menos volumen Y además se convierte peor, lo
  // que manda es el volumen: se arregla antes el grifo que la cañería.
  let detalle = ''

  if (bocaFloja && boca) {
    const falta = porcentaje(1 - (boca.cumplimiento ?? 1))
    detalle = `Entra un ${falta} menos de ${boca.indicador.nombre.toLowerCase()} de lo previsto: el estrechamiento empieza en la boca del embudo.`

    // El matiz que salva al equipo comercial: menos materia prima, mejor cierre.
    if (cierre && (cierre.cumplimiento ?? 0) >= (boca.cumplimiento ?? 0) + 0.05) {
      detalle += ` Aun así se cierra mejor de lo que ese volumen daba de sí.`
    }
  } else if (hayEstrechamiento && estrechamiento) {
    detalle = `El volumen de entrada acompaña, pero se pierde al pasar de ${estrechamiento.desde.nombre.toLowerCase()} a ${estrechamiento.hacia.nombre.toLowerCase()}.`
  } else if (reparto.fuera > 0) {
    detalle = `${reparto.fuera} ${reparto.fuera === 1 ? 'indicador está' : 'indicadores están'} fuera del plan.`
  } else if (reparto.cerca > 0) {
    detalle = `${reparto.cerca} ${reparto.cerca === 1 ? 'indicador se queda cerca' : 'indicadores se quedan cerca'} del plan.`
  } else {
    detalle = 'Todos los indicadores con dato están en plan.'
  }

  return { titular, detalle, cumplimiento, tono, reparto }
}
