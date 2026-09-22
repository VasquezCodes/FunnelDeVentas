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
 *
 * Los bloques salen de las filas que trae el libro del plan. Casi siempre
 * son las mismas, pero Discoveries cambia de forma: desde el libro 0726 se
 * reparte por canal y tiene su propio bloque con total; en los anteriores es
 * una cifra que se teclea junto a Propuestas.
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
  /** En la vista por canal, el canal del bloque. */
  canal?: Canal
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

/** Los insumos del plan, un subgrupo por canal en el orden del catálogo. */
function gruposDeInsumos(delPlan: ReadonlySet<string>): GrupoCaptura[] {
  const porCanal = new Map<Canal, string[]>()
  for (const indicador of INDICADORES_DEL_PLAN) {
    if (indicador.grupo !== 'insumo' || !indicador.canal || !delPlan.has(indicador.id)) continue
    const filas = porCanal.get(indicador.canal)
    if (filas) filas.push(indicador.id)
    else porCanal.set(indicador.canal, [indicador.id])
  }
  return [...porCanal].map(([canal, filas]) => ({ titulo: NOMBRE_CANAL[canal], filas }))
}

/** ¿Trae el libro Discoveries canal a canal? */
const repartePorCanal = (delPlan: ReadonlySet<string>, etapa: string) =>
  (SUMANDOS.get(etapa) ?? []).some((id) => delPlan.has(id))

/** Los bloques de la vista por etapa, con las filas que trae el libro. */
export function bloquesDe(ids: Iterable<string>): BloqueCaptura[] {
  const delPlan = new Set(ids)
  const solo = (filas: readonly string[]) => filas.filter((id) => delPlan.has(id))
  const sumandosDe = (total: string) => solo(SUMANDOS.get(total) ?? [])

  return [
    // Primero, porque es lo primero que pasa: los envíos, los contactos y los
    // clics son lo que se hace ANTES de que un canal dé un lead, y la vista
    // por canal ya los pone al principio de cada bloque. Con las dos vistas
    // en el mismo orden, cambiar de una a otra no reordena la cabeza de
    // quien está capturando. Sigue plegado: son doce casillas que casi
    // siempre se rellenan de una vez al empezar el mes.
    {
      id: 'insumos',
      titulo: 'Variables previas por canal',
      grupos: gruposDeInsumos(delPlan),
      total: null,
      plegado: true,
    },
    bloque('eleads', 'Engaged Leads', sumandosDe('eleads'), 'eleads'),
    bloque('llamadas', 'Llamadas iniciales', sumandosDe('llamadas'), 'llamadas'),
    // Discoveries y Propuestas se reparten por canal en unos libros y en
    // otros no, y cada una por su cuenta. Tres formas, según lo que traiga:
    //   · las dos repartidas   → un bloque con canales y total cada una
    //   · solo Discoveries     → su bloque, y Propuestas como fila suelta
    //   · ninguna              → las dos juntas, porque dos bloques de una
    //                            sola fila trocean la pantalla sin informar
    ...(repartePorCanal(delPlan, 'discoveries')
      ? [
          bloque('discoveries', 'Discoveries', sumandosDe('discoveries'), 'discoveries'),
          repartePorCanal(delPlan, 'propuestas')
            ? bloque('propuestas', 'Propuestas', sumandosDe('propuestas'), 'propuestas')
            : // Una sola fila, pero su propio bloque: entre Discoveries y
              // Ventas van sus dos tasas, como entre cualquier otra pareja.
              bloque('propuestas', 'Propuestas', solo(['propuestas']), null),
        ]
      : repartePorCanal(delPlan, 'propuestas')
        ? [
            bloque('discoveries-propuestas', 'Discoveries', solo(['discoveries']), null),
            bloque('propuestas', 'Propuestas', sumandosDe('propuestas'), 'propuestas'),
          ]
        : [
            bloque(
              'discoveries-propuestas',
              'Discoveries y propuestas',
              solo(['discoveries', 'propuestas']),
              null,
            ),
          ]),
    bloque('ventas', 'Ventas FLECHA', sumandosDe('ventas'), 'ventas'),
    // El orden del panel Dinero, no el del Excel: primero lo ya ganado (las
    // mensualidades) y después lo vendido en el mes. Las ventas ARCO son
    // contratos y no suman al ingreso; van junto a su importe, «Altas ARCO».
    bloque(
      'ingresos',
      'Ingresos',
      solo([
        'ingreso-flecha-recurrente',
        'ingreso-arco-recurrente',
        'ingreso-flecha-setup',
        'ventas-arco',
        'ingreso-arco-setup',
        'ingreso-otros',
      ]),
      'ingreso-total',
    ),
    bloque('captacion', 'Gasto de captación', sumandosDe('captacion-total'), 'captacion-total'),
  ]
}

// ── Por canal ────────────────────────────────────────────────────────────

/**
 * La misma captura agrupada por canal, para quien tiene delante el informe
 * de un canal y no el de una etapa: un bloque por canal con todo lo suyo, en
 * el orden en que avanza (su materia prima, sus leads, sus llamadas, sus
 * discoveries si el libro las reparte, sus ventas) y al final lo que gastó.
 * Detrás, lo que no es de ningún canal: Propuestas (y Discoveries, si no se
 * reparte) y los ingresos. Son las mismas casillas que la vista por etapa,
 * una vez cada una; los totales siguen sin casilla.
 */
export function bloquesPorCanalDe(ids: Iterable<string>): BloqueCaptura[] {
  const delPlan = new Set(ids)
  const canales: Canal[] = [
    ...new Set(INDICADORES_DEL_PLAN.flatMap((i) => (i.canal && delPlan.has(i.id) ? [i.canal] : []))),
  ]

  return [
    ...canales.map((canal): BloqueCaptura => {
      const previas = INDICADORES_DEL_PLAN.filter(
        (i) => i.grupo === 'insumo' && i.canal === canal && delPlan.has(i.id),
      ).map((i) => i.id)
      const embudo = [
        `eleads.${canal}`,
        `llamadas.${canal}`,
        `discoveries.${canal}`,
        `propuestas.${canal}`,
        `ventas.${canal}`,
        `captacion.${canal}`,
      ].filter((id) => delPlan.has(id))
      return {
        id: `canal-${canal}`,
        titulo: NOMBRE_CANAL[canal],
        grupos: [{ titulo: null, filas: [...previas, ...embudo] }],
        total: null,
        plegado: false,
        canal,
      }
    }),
    ...colaSinCanal(delPlan, canales),
  ]
}

/**
 * Lo que queda detrás de los canales: las casillas de la vista por etapa que
 * ningún canal se ha llevado ya.
 *
 * Antes era una lista de bloques escrita a mano («Discoveries y propuestas»,
 * «Propuestas», «Ingresos»). Dejó de valer en cuanto el libro empezó a
 * repartir Propuestas por canal: sus siete casillas ya van dentro de cada
 * canal, y volver a añadir el bloque entero las habría pintado dos veces —la
 * misma cifra en dos sitios, y la pantalla sin saber cuál manda.
 *
 * Así que se calcula: se quitan de cada bloque las filas ya colocadas y se
 * descartan los que se quedan vacíos. Con esto, cuando el libro reparta otra
 * etapa más, esto sigue funcionando sin tocarlo.
 */
function colaSinCanal(delPlan: ReadonlySet<string>, canales: readonly Canal[]): BloqueCaptura[] {
  const yaPuestas = new Set(
    canales.flatMap((canal) =>
      [...delPlan].filter((id) => id.endsWith(`.${canal}`) || id.startsWith(`${canal}-`)),
    ),
  )

  return bloquesDe(delPlan)
    .filter((b) => b.id !== 'insumos' && b.id !== 'captacion')
    .map((bloque) => ({
      ...bloque,
      grupos: bloque.grupos
        .map((g) => ({ ...g, filas: g.filas.filter((id) => !yaPuestas.has(id)) }))
        .filter((g) => g.filas.length > 0),
    }))
    .filter((b) => b.grupos.length > 0)
}
