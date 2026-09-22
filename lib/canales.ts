/**
 * Rendimiento por canal: cruzar lo que cada canal trae con lo que cuesta.
 *
 * Es el único sitio del sistema donde se puede afirmar «la publicidad rinde
 * peor». El motor de lectura distingue volumen de conversión, pero no puede
 * atribuir culpa a un canal: para eso hace falta dividir el gasto del canal
 * entre los leads del canal, que es lo que se hace aquí.
 *
 * El coste por lead es la cifra que manda. Un canal puede traer más leads que
 * el plan y aun así ser mala noticia si cada uno costó el doble.
 */

import type { Canal, Comparativa, Estado } from '@/lib/tipos'
import { CANALES, NOMBRE_CANAL, colorDeCanal } from '@/lib/tipos'
import { calcularEstado } from '@/lib/comparacion'

export interface FilaCanal {
  canal: Canal
  nombre: string
  /** Token CSS del color de este canal en la rampa. */
  color: string
  leadsPlan: number | null
  leadsReal: number | null
  gastoPlan: number | null
  gastoReal: number | null
  /** gasto / leads. null si falta un lado o no hubo leads. */
  costePlan: number | null
  costeReal: number | null
  /** Estado del coste por lead. Menor es mejor, así que se juzga invertido. */
  estadoCoste: Estado
  /** Cuota sobre el total de leads reales del periodo. null si no hay reales. */
  cuota: number | null
}

/** División que no devuelve Infinity ni NaN. */
function dividir(a: number | null, b: number | null): number | null {
  if (a === null || b === null || b === 0) return null
  const r = a / b
  return Number.isFinite(r) ? r : null
}

/**
 * Construye una fila por canal activo.
 *
 * `etapaId` es la etapa cuyo desglose se usa como denominador del coste.
 * Por defecto los engaged leads: es la boca, y es donde el gasto de
 * captación produce su efecto directo.
 */
export function filasDeCanal(
  comparativas: readonly Comparativa[],
  etapaId = 'eleads',
  canales: readonly Canal[] = CANALES,
): FilaCanal[] {
  const porId = new Map(comparativas.map((c) => [c.indicador.id, c]))

  const filas: FilaCanal[] = canales.map((canal) => {
    const leads = porId.get(`${etapaId}.${canal}`)
    const gasto = porId.get(`captacion.${canal}`)

    const leadsPlan = leads?.meta ?? null
    const leadsReal = leads?.real ?? null
    const gastoPlan = gasto?.meta ?? null
    const gastoReal = gasto?.real ?? null

    const costePlan = dividir(gastoPlan, leadsPlan)
    const costeReal = dividir(gastoReal, leadsReal)

    return {
      canal,
      nombre: NOMBRE_CANAL[canal],
      color: colorDeCanal(canal),
      leadsPlan,
      leadsReal,
      gastoPlan,
      gastoReal,
      costePlan,
      costeReal,
      estadoCoste: calcularEstado(dividir(costeReal, costePlan), 'menor-mejor'),
      cuota: null,
    }
  })

  // Cuota sobre el total real. Se calcula al final porque necesita el total
  // de todas las filas, no solo la propia.
  const totalReal = filas.reduce((suma, f) => suma + (f.leadsReal ?? 0), 0)
  if (totalReal > 0) {
    for (const fila of filas) {
      fila.cuota = fila.leadsReal === null ? null : fila.leadsReal / totalReal
    }
  }

  return filas
}

/**
 * Qué canales dibuja el gráfico: los que tienen leads.
 *
 * Se pregunta a los DATOS y no a una lista escrita a mano. El plan define
 * siete canales y durante mucho tiempo solo tres llevaban cifra, así que el
 * gráfico traía esos tres escritos en el código. Eso enseñaba 133 de los 148
 * leads del mes y no decía que faltaban quince: el resto entraba por
 * contenido, por la newsletter y por dentro de casa, y sencillamente no se
 * veía. Un gráfico que se deja canales fuera sin avisar miente por omisión.
 *
 * «Tener leads» se mira en TODA la serie, no en el periodo elegido: si se
 * mirara mes a mes, la lista de canales —y con ella el conmutador de
 * arriba— cambiaría al pasar de un mes a otro. Cuenta el plan además del
 * real, para que un canal previsto que no trajo nada salga a cero en vez de
 * desaparecer, que es justo la noticia.
 *
 * Los canales van siempre en el orden de `CANALES`, y cada uno conserva su
 * color entre periodos.
 */
export function canalesConLeads(
  serie: ReadonlyArray<{ comparativas: readonly Comparativa[] }>,
  etapaId = 'eleads',
): Canal[] {
  return CANALES.filter((canal) =>
    serie.some((punto) =>
      punto.comparativas.some(
        (c) =>
          c.indicador.id === `${etapaId}.${canal}` && ((c.meta ?? 0) > 0 || (c.real ?? 0) > 0),
      ),
    ),
  )
}

/**
 * Canal con el coste por lead más deteriorado respecto al plan.
 * Devuelve null si ninguno empeoró o si faltan datos.
 */
export function canalMasDeteriorado(filas: readonly FilaCanal[]): FilaCanal | null {
  let peor: FilaCanal | null = null
  let peorRatio = 1.05 // hay que empeorar al menos un 5 % para merecer mención

  for (const fila of filas) {
    const ratio = dividir(fila.costeReal, fila.costePlan)
    if (ratio !== null && ratio > peorRatio) {
      peorRatio = ratio
      peor = fila
    }
  }

  return peor
}
