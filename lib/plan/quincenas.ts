/**
 * Quincenas derivadas del plan mensual.
 *
 * El Excel es mensual: 33 columnas, una por mes, y ni una quincena. Pero el
 * equipo revisa cada quince días, así que la quincena se deriva partiendo la
 * meta del mes por la mitad.
 *
 * ── El supuesto, dicho en voz alta ───────────────────────────────────────
 * Partir por la mitad asume que la venta se reparte de forma uniforme dentro
 * del mes. En una agencia rara vez es así: el cierre se carga a la segunda
 * quincena, cuando el comercial persigue su número. Con lo cual la primera
 * quincena tenderá a verse en rojo y la segunda a compensar, y eso NO es un
 * fallo del equipo, es el reparto.
 *
 * Se deja el 50/50 porque es lo pedido y porque es la única regla que no hay
 * que explicar. Si algún día se quiere afinar, hay dos caminos y este es el
 * sitio: un reparto 40/60, o un peso por días naturales (la Q1 de marzo son
 * 15 días de 31, no la mitad).
 *
 * ── Lo que NO se parte ───────────────────────────────────────────────────
 * Las magnitudes acumulables —conteos y dinero— se dividen. Un porcentaje no:
 * una tasa de conversión del 30 % mensual no es del 15 % quincenal, es del
 * 30 % en las dos. Hoy el catálogo no tiene ningún indicador porcentual, pero
 * la regla se escribe igual: el día que entre uno, esto ya está bien.
 */

import type { Indicador, Meta, Periodo } from '@/lib/tipos'
import { construirPeriodoQuincena } from '@/lib/periodos'

/** Magnitudes que se acumulan a lo largo del mes y por tanto se reparten. */
function seReparte(indicador: Indicador | undefined): boolean {
  if (!indicador) return true
  return indicador.unidad !== 'porcentaje'
}

/**
 * Parte el valor del mes en sus dos quincenas.
 *
 * ── Las cantidades no admiten decimales ──────────────────────────────────
 * Dividir entre dos a secas producía 648 metas de media unidad: 222,5
 * engaged leads, 133,5 llamadas. Y en los indicadores de números pequeños
 * era directamente inservible: el plan pide 1 venta ARCO en junio, la
 * quincena pedía 0,5, y como el real solo puede ser 0 o 1, el cumplimiento
 * salía 0 % o 200 %. El semáforo gritaba «crítico» o «excelente» y las dos
 * lecturas eran falsas.
 *
 * Ahora las cantidades se reparten en dos enteros que suman exactamente el
 * mes: 445 → 222 y 223; 1 → 0 y 1. Nunca se pide media persona ni medio
 * contrato, y el mes sigue cuadrando con la suma de sus quincenas.
 *
 * ── Y el resto va a la segunda ───────────────────────────────────────────
 * Cuando el reparto es impar, el que sobra cae en la Q2. No es un capricho:
 * en una agencia el cierre se carga a la segunda quincena, cuando el
 * comercial persigue su número. Es el mismo sesgo que ya asume el 50/50 y
 * al menos aquí juega a favor.
 */
function repartir(valor: number, indicador: Indicador | undefined): [number, number] {
  if (!seReparte(indicador)) return [valor, valor]

  if (indicador?.unidad === 'cantidad') {
    const primera = Math.floor(valor / 2)
    return [primera, valor - primera]
  }

  // Dinero: se admite el decimal, pero redondeado al céntimo para no
  // arrastrar colas de coma flotante hasta la interfaz.
  const mitad = Math.round((valor / 2) * 100) / 100
  return [mitad, Math.round((valor - mitad) * 100) / 100]
}

export interface PlanConQuincenas {
  periodos: Periodo[]
  metas: Meta[]
}

/**
 * Añade dos quincenas por cada mes del plan, con sus metas.
 *
 * Los meses originales se conservan intactos: el tablero ofrece las dos
 * lecturas y es el usuario quien elige con qué grano mira.
 */
export function conQuincenas(
  periodos: readonly Periodo[],
  metas: readonly Meta[],
  indicadores: readonly Indicador[],
): PlanConQuincenas {
  const porIndicador = new Map(indicadores.map((i) => [i.id, i]))

  // Las metas del mes, agrupadas, para no recorrer el array entero por cada
  // periodo (33 meses × 52 indicadores se nota).
  const metasDelMes = new Map<string, Meta[]>()
  for (const meta of metas) {
    const lista = metasDelMes.get(meta.periodoId)
    if (lista) lista.push(meta)
    else metasDelMes.set(meta.periodoId, [meta])
  }

  const periodosSalida: Periodo[] = [...periodos]
  const metasSalida: Meta[] = [...metas]

  for (const mes of periodos) {
    if (mes.tipo !== 'mes') continue

    const delMes = metasDelMes.get(mes.id) ?? []

    for (const quincena of [1, 2] as const) {
      const periodo = construirPeriodoQuincena(mes.anio, mes.mes, quincena)
      periodosSalida.push(periodo)

      for (const meta of delMes) {
        const [primera, segunda] = repartir(meta.valor, porIndicador.get(meta.indicadorId))
        metasSalida.push({
          periodoId: periodo.id,
          indicadorId: meta.indicadorId,
          valor: quincena === 1 ? primera : segunda,
        })
      }
    }
  }

  return { periodos: periodosSalida, metas: metasSalida }
}
