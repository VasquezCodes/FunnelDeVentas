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
import { CANALES_ACTIVOS, NOMBRE_CANAL } from '@/lib/tipos'
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
): FilaCanal[] {
  const porId = new Map(comparativas.map((c) => [c.indicador.id, c]))

  const filas: FilaCanal[] = CANALES_ACTIVOS.map((canal, i) => {
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
      // La rampa tiene tres pasos y los canales activos son tres, en el mismo
      // orden de volumen. Si algún día se activa un cuarto, aquí hay que
      // decidir: ampliar la rampa o plegar la cola en «otros».
      color: `var(--canal-${Math.min(i + 1, 3)})`,
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
