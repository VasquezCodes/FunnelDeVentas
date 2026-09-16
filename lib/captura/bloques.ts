/**
 * Cómo se agrupa la pantalla de captura.
 *
 * La captura enseñaba los 52 indicadores en una lista plana: «Publicidad»
 * salía cuatro veces sin decir de qué, y los totales se tecleaban al lado de
 * sus partes. Aquí se agrupan como en la hoja «Plan de Ventas» —cada etapa
 * con sus canales, luego el dinero, el gasto y los insumos—, pero en el
 * orden en que avanza el lead y no al revés, que es como calcula el Excel.
 *
 * Es solo estructura: qué filas van juntas, en qué orden, cuál es el total
 * de cada bloque y cuál va plegado. Los totales se calculan en
 * `lib/captura/totales.ts`; los iconos los pone la pantalla.
 */

import { INDICADORES_DEL_PLAN } from '@/lib/plan/catalogo'
import { SUMANDOS } from '@/lib/plan/sumas'
import { NOMBRE_CANAL, type Canal } from '@/lib/tipos'

export interface GrupoCaptura {
  /** Subtítulo dentro del bloque. null si el bloque no se subdivide. */
  titulo: string | null
  /** Ids de los indicadores que se teclean, en orden. */
  filas: readonly string[]
}

export interface BloqueCaptura {
  id: string
  titulo: string
  grupos: readonly GrupoCaptura[]
  /** Id del total calculado que cierra el bloque, o null si no tiene. */
  total: string | null
  /** Cerrado al abrir la pantalla. */
  plegado: boolean
}

/** Un bloque de un solo grupo, sin subtítulo. */
function bloque(
  id: string,
  titulo: string,
  filas: readonly string[],
  total: string | null,
): BloqueCaptura {
  return { id, titulo, grupos: [{ titulo: null, filas }], total, plegado: false }
}

/** Los insumos, un subgrupo por canal en el orden del catálogo. */
function gruposDeInsumos(): GrupoCaptura[] {
  const porCanal = new Map<Canal, string[]>()
  for (const indicador of INDICADORES_DEL_PLAN) {
    if (indicador.grupo !== 'insumo' || !indicador.canal) continue
    const filas = porCanal.get(indicador.canal)
    if (filas) filas.push(indicador.id)
    else porCanal.set(indicador.canal, [indicador.id])
  }
  return [...porCanal].map(([canal, filas]) => ({ titulo: NOMBRE_CANAL[canal], filas }))
}

const sumandosDe = (total: string) => SUMANDOS.get(total) ?? []

export const BLOQUES: readonly BloqueCaptura[] = [
  bloque('eleads', 'Engaged Leads', sumandosDe('eleads'), 'eleads'),
  bloque('llamadas', 'Llamadas iniciales', sumandosDe('llamadas'), 'llamadas'),
  // Juntas: el plan no las reparte por canal, y dos bloques de una sola
  // fila trocearían la pantalla sin informar.
  bloque('discoveries-propuestas', 'Discoveries y propuestas', ['discoveries', 'propuestas'], null),
  bloque('ventas', 'Ventas FLECHA', sumandosDe('ventas'), 'ventas'),
  // El orden del panel Dinero, no el del Excel: primero lo ya ganado (las
  // mensualidades) y después lo vendido en el mes. Las ventas ARCO son
  // contratos y no suman al ingreso; van junto a su importe, «Altas ARCO».
  bloque(
    'ingresos',
    'Ingresos',
    [
      'ingreso-flecha-recurrente',
      'ingreso-arco-recurrente',
      'ingreso-flecha-setup',
      'ventas-arco',
      'ingreso-arco-setup',
      'ingreso-otros',
    ],
    'ingreso-total',
  ),
  bloque('captacion', 'Gasto de captación', sumandosDe('captacion-total'), 'captacion-total'),
  // Hoy ningún gráfico los usa: se pueden capturar sin que estorben.
  {
    id: 'insumos',
    titulo: 'Insumos por canal',
    grupos: gruposDeInsumos(),
    total: null,
    plegado: true,
  },
]
