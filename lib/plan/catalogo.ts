/**
 * Catálogo de indicadores: la traducción entre la hoja «Plan de Ventas» y el
 * dominio del tablero.
 *
 * ── Cómo se identifica una fila del Excel ────────────────────────────────
 * Por su CLAVE (columna A) siempre que la tenga. La columna B —la etiqueta
 * que lee un humano— no sirve como identificador general: «Publicidad»
 * aparece cinco veces en la hoja (como canal de leads, de llamadas y de
 * ventas, y como línea de gasto).
 *
 * Pero hay cuatro filas SIN clave que el tablero necesita, y son justo las
 * que más pesan:
 *
 *     FLECHA Mensualidad          54.000 € en abril
 *     ARCO Mensualidad            45.000 €
 *     Ingresos                    152.900 €  ← el total
 *     TOTAL GASTOS DE CAPTACIÓN   5.868 €
 *
 * Las dos mensualidades son el 65 % del ingreso del mes. Leer solo las filas
 * con clave enseñaría 53.900 € de ingreso contra un plan de 152.900 €, que no
 * es un matiz: es un tablero que miente. Por eso esas cuatro se localizan por
 * etiqueta, y solo esas cuatro — se ha comprobado que sus textos son únicos
 * en la hoja.
 *
 * Si alguien añade claves a esas filas en el Excel, este módulo las
 * encontrará por clave y las entradas por etiqueta dejarán de usarse solas.
 */

import type { Canal, Indicador } from '@/lib/tipos'
import { CANALES_ACTIVOS, NOMBRE_CANAL } from '@/lib/tipos'

/** Una fila del Excel, atada al indicador que produce. */
export interface EntradaCatalogo {
  /** Columna A. Preferente. */
  clave?: string
  /** Columna B. Solo para las cuatro filas sin clave, cuyo texto es único. */
  etiqueta?: string
  /** Una fila que solo traen algunos libros: si falta, no es una incidencia. */
  opcional?: boolean
  indicador: Indicador
}

const CANALES: Canal[] = [
  'publicidad',
  'prospeccion',
  'referidos',
  'afiliados',
  'contenido',
  'newsletter',
  'interno',
]

/** «Prospección» → «Prospeccion»: así se escriben las claves del Excel. */
const CLAVE_CANAL: Record<Canal, string> = {
  publicidad: 'Publicidad',
  prospeccion: 'Prospección',
  referidos: 'Referidos',
  afiliados: 'Afiliados',
  contenido: 'Contenido',
  newsletter: 'Newsletter',
  interno: 'Interno',
}

// ── Etapas del embudo ───────────────────────────────────────────────────

interface DefEtapa {
  id: string
  clave: string
  nombre: string
  etapa: number
  definicion: string
  /** Prefijo de las claves de desglose. Ausente si la etapa no se reparte. */
  prefijoCanal?: string
  /** El desglose solo lo traen algunos libros del plan. */
  desgloseOpcional?: boolean
}

const ETAPAS: DefEtapa[] = [
  {
    id: 'eleads',
    clave: 'ELeads_FLECHA',
    nombre: 'Engaged Leads',
    etapa: 1,
    prefijoCanal: 'ELeads_FLECHA',
    definicion:
      'Contactos que han respondido o interactuado, no solo entrado. Es la boca real del embudo: un lead que nunca contesta no llega a ninguna parte.',
  },
  {
    id: 'llamadas',
    clave: 'Llamadas_FLECHA',
    nombre: 'Llamadas iniciales',
    etapa: 2,
    prefijoCanal: 'Llamadas_FLECHA',
    definicion:
      'Primeras llamadas mantenidas con un lead. El plan las calcula aplicando la tasa de cualificación sobre los engaged leads.',
  },
  {
    id: 'discoveries',
    clave: 'Discoveries_FLECHA',
    nombre: 'Discoveries',
    etapa: 3,
    // Los libros desde el de julio de 2026 (0726) la reparten por canal; los
    // anteriores traen solo el total, que entonces se teclea.
    prefijoCanal: 'Discoveries_FLECHA',
    desgloseOpcional: true,
    definicion:
      'Sesiones de diagnóstico con el cliente potencial. Sale de aplicar la tasa de cualificación sobre las llamadas iniciales.',
  },
  {
    id: 'propuestas',
    clave: 'Propuestas_FLECHA',
    nombre: 'Propuestas',
    etapa: 4,
    // El libro las reparte por canal desde que se añadieron las filas
    // «Propuestas_FLECHA_<Canal>». Opcional como las de Discoveries: los
    // libros anteriores solo traen el total, y entonces se teclea.
    prefijoCanal: 'Propuestas_FLECHA',
    desgloseOpcional: true,
    definicion:
      'Propuestas enviadas tras la discovery. Sale de aplicar la tasa de propuestas sobre las discoveries del periodo.',
  },
  {
    id: 'ventas',
    clave: 'Ventas_FLECHA',
    nombre: 'Ventas FLECHA',
    etapa: 5,
    prefijoCanal: 'Ventas_FLECHA',
    definicion:
      'Contratos FLECHA firmados en el periodo: cuántos, no cuánto. El importe de esas firmas va aparte, en «Ventas FLECHA» del bloque de ingresos.',
  },
]

// ── Insumos por canal ───────────────────────────────────────────────────
// La materia prima con la que cada canal produce leads. Se leen para poder
// explicar POR QUÉ un canal se quedó corto: sin clics no hay leads.
//
// ── El orden es la cadena, no el de la hoja ─────────────────────────────
// Van de lo que se pone a lo que sale, que es como el plan los encadena y
// como se capturan:
//
//     Inversión ──CPM──▶ Impresiones ──CTR──▶ Clics ──CVR──▶ Engaged Leads
//
// Estaban al revés —impresiones, clics, inversión—, que es el orden de las
// filas del Excel. En la captura por canal eso pedía teclear el resultado
// antes que su causa: primero las impresiones y al final el dinero que las
// compró. Los otros canales siguen la misma regla, y el último insumo de
// cada uno es siempre el que multiplica por su CVR para dar los leads:
// clics en publicidad, contactos en prospección y referidos, visitas en
// contenido, aperturas en newsletter.

interface DefInsumo {
  id: string
  clave: string
  nombre: string
  canal: Canal
  unidad: Indicador['unidad']
  direccion: Indicador['direccion']
  definicion: string
}

const INSUMOS: DefInsumo[] = [
  {
    id: 'publicidad-inversion',
    clave: 'Publicidad_Inversion',
    nombre: 'Inversión en publicidad',
    canal: 'publicidad',
    unidad: 'moneda',
    direccion: 'menor-mejor',
    definicion:
      'Dinero puesto en medios pagados. Se lee como «menor mejor»: gastar por debajo del plan es buena noticia siempre que el volumen aguante, y si no aguanta lo dirá la etapa correspondiente.',
  },
  {
    id: 'publicidad-impresiones',
    clave: 'Publicidad_Impresiones',
    nombre: 'Impresiones',
    canal: 'publicidad',
    unidad: 'cantidad',
    direccion: 'mayor-mejor',
    definicion: 'Veces que se sirvió un anuncio. El plan las deriva de la inversión y el CPM.',
  },
  {
    id: 'publicidad-clicks',
    clave: 'Publicidad_Clicks',
    nombre: 'Clics a landing',
    canal: 'publicidad',
    unidad: 'cantidad',
    direccion: 'mayor-mejor',
    definicion: 'Clics que llegan a la landing o al formulario desde un anuncio.',
  },
  {
    id: 'prospeccion-contactos',
    clave: 'Prospeccion_Contactos',
    nombre: 'Contactos a prospectar',
    canal: 'prospeccion',
    unidad: 'cantidad',
    direccion: 'mayor-mejor',
    definicion: 'Contactos en frío que el equipo se compromete a trabajar en el periodo.',
  },
  {
    id: 'referidos-reactivaciones',
    clave: 'Referidos_Reactivaciones',
    nombre: 'Reactivaciones a hacer',
    canal: 'referidos',
    unidad: 'cantidad',
    direccion: 'mayor-mejor',
    definicion: 'Reactivaciones planificadas sobre la base de referidos.',
  },
  {
    id: 'referidos-contactos',
    clave: 'Referidos_Contactos',
    nombre: 'Contactos reactivados',
    canal: 'referidos',
    unidad: 'cantidad',
    direccion: 'mayor-mejor',
    definicion: 'Contactos de la base que se vuelven a tocar buscando una referencia.',
  },
  {
    id: 'afiliados-reactivaciones',
    clave: 'Afiliados_Reactivaciones',
    nombre: 'Reactivaciones a hacer',
    canal: 'afiliados',
    unidad: 'cantidad',
    direccion: 'mayor-mejor',
    definicion: 'Reactivaciones planificadas sobre la red de afiliados.',
  },
  {
    id: 'afiliados-contactos',
    clave: 'Afiliados_Contactos',
    nombre: 'Contactos reactivados',
    canal: 'afiliados',
    unidad: 'cantidad',
    direccion: 'mayor-mejor',
    definicion: 'Contactos de afiliados que se vuelven a tocar.',
  },
  {
    id: 'contenido-creacion',
    clave: 'Contenido_Creacion',
    nombre: 'Contenidos a crear',
    canal: 'contenido',
    unidad: 'cantidad',
    direccion: 'mayor-mejor',
    definicion: 'Piezas largas que el plan compromete producir en el periodo.',
  },
  {
    id: 'contenido-visitas',
    clave: 'Contenido_Visitas',
    nombre: 'Visitas a contenido largo',
    canal: 'contenido',
    unidad: 'cantidad',
    direccion: 'mayor-mejor',
    definicion: 'Visitas a las piezas largas: el artículo o el vídeo que hace el trabajo de fondo.',
  },
  {
    id: 'newsletter-envios',
    clave: 'Newsletter_EEmail',
    nombre: 'Envíos de newsletter',
    canal: 'newsletter',
    unidad: 'cantidad',
    direccion: 'mayor-mejor',
    definicion: 'Correos que el plan prevé enviar.',
  },
  {
    id: 'newsletter-aperturas',
    clave: 'Newsletter_AEmail',
    nombre: 'Aperturas de newsletter',
    canal: 'newsletter',
    unidad: 'cantidad',
    direccion: 'mayor-mejor',
    definicion: 'Correos de la newsletter que se abren.',
  },
]

// ── Construcción del catálogo ───────────────────────────────────────────

function entradasDelEmbudo(): EntradaCatalogo[] {
  const salida: EntradaCatalogo[] = []

  for (const etapa of ETAPAS) {
    salida.push({
      clave: etapa.clave,
      indicador: {
        id: etapa.id,
        nombre: etapa.nombre,
        unidad: 'cantidad',
        direccion: 'mayor-mejor',
        etapa: etapa.etapa,
        linea: 'flecha',
        grupo: 'embudo',
        clave: etapa.clave,
        definicion: etapa.definicion,
      },
    })

    if (!etapa.prefijoCanal) continue

    for (const canal of CANALES) {
      const clave = `${etapa.prefijoCanal}_${CLAVE_CANAL[canal]}`
      salida.push({
        clave,
        ...(etapa.desgloseOpcional ? { opcional: true } : {}),
        indicador: {
          id: `${etapa.id}.${canal}`,
          nombre: NOMBRE_CANAL[canal],
          unidad: 'cantidad',
          direccion: 'mayor-mejor',
          // etapa null a propósito: ver la nota en `Indicador.desglosaA`.
          etapa: null,
          desglosaA: etapa.id,
          canal,
          linea: 'flecha',
          grupo: 'embudo',
          clave,
          definicion: `${etapa.nombre} atribuidos al canal ${NOMBRE_CANAL[canal]}.`,
        },
      })
    }
  }

  return salida
}

function entradasDeDinero(): EntradaCatalogo[] {
  return [
    {
      // Sin clave en el Excel. Es el total y es lo primero que se mira.
      etiqueta: 'Ingresos',
      indicador: {
        id: 'ingreso-total',
        nombre: 'Ingreso total',
        unidad: 'moneda',
        direccion: 'mayor-mejor',
        etapa: null,
        grupo: 'dinero',
        definicion:
          'Todo el ingreso del mes: las dos mensualidades recurrentes, las altas de FLECHA y ARCO, y otros ingresos. En el Excel es una fila calculada, sin clave propia.',
      },
    },
    {
      etiqueta: 'FLECHA Mensualidad',
      indicador: {
        id: 'ingreso-flecha-recurrente',
        nombre: 'Recurrente FLECHA',
        unidad: 'moneda',
        direccion: 'mayor-mejor',
        etapa: null,
        linea: 'flecha',
        grupo: 'dinero',
        definicion:
          'Mensualidades de la cartera FLECHA viva. No se captura como clave en el Excel, pero es la mayor partida de ingreso del mes.',
      },
    },
    {
      clave: 'Ventas_FLECHA_Ingreso',
      indicador: {
        id: 'ingreso-flecha-setup',
        nombre: 'Ventas FLECHA',
        unidad: 'moneda',
        direccion: 'mayor-mejor',
        etapa: null,
        linea: 'flecha',
        grupo: 'dinero',
        clave: 'Ventas_FLECHA_Ingreso',
        definicion:
          'Lo que se cobra de una vez al firmar un contrato FLECHA: la fila «FLECHA Setup (Ventas)» del Excel. No incluye la mensualidad que ese contrato genera después.',
      },
    },
    {
      etiqueta: 'ARCO Mensualidad',
      indicador: {
        id: 'ingreso-arco-recurrente',
        nombre: 'Recurrente ARCO',
        unidad: 'moneda',
        direccion: 'mayor-mejor',
        etapa: null,
        linea: 'arco',
        grupo: 'dinero',
        definicion: 'Mensualidades de la cartera ARCO viva. Tampoco tiene clave en el Excel.',
      },
    },
    {
      clave: 'Ventas_ARCO_Ingreso',
      indicador: {
        id: 'ingreso-arco-setup',
        nombre: 'Ventas ARCO',
        unidad: 'moneda',
        direccion: 'mayor-mejor',
        etapa: null,
        linea: 'arco',
        grupo: 'dinero',
        clave: 'Ventas_ARCO_Ingreso',
        definicion:
          'Lo que se cobra de una vez al firmar un contrato ARCO: la fila «ARCO Setup (Ventas)» del Excel.',
      },
    },
    {
      clave: 'Ventas_Otros_Ingreso',
      indicador: {
        id: 'ingreso-otros',
        nombre: 'Otros ingresos',
        unidad: 'moneda',
        direccion: 'mayor-mejor',
        etapa: null,
        linea: 'otros',
        grupo: 'dinero',
        clave: 'Ventas_Otros_Ingreso',
        definicion: 'Ingresos que no vienen de FLECHA ni de ARCO.',
      },
    },
    {
      clave: 'Ventas_ARCO',
      indicador: {
        id: 'ventas-arco',
        // Cuántos contratos, no cuánto dinero. Se llamaba «Ventas ARCO» y ese
        // nombre es ahora el del importe, que es como lo dice el Excel y como
        // lo dice el equipo; esta fila se nombra por lo que cuenta.
        nombre: 'Contratos ARCO',
        unidad: 'cantidad',
        direccion: 'mayor-mejor',
        etapa: null,
        linea: 'arco',
        grupo: 'dinero',
        clave: 'Ventas_ARCO',
        definicion:
          'Contratos ARCO firmados en el mes. ARCO no pasa por el embudo de FLECHA: entra por otra vía y por eso no es una etapa.',
      },
    },
  ]
}

function entradasDeCaptacion(): EntradaCatalogo[] {
  const salida: EntradaCatalogo[] = [
    {
      etiqueta: 'TOTAL GASTOS DE CAPTACIÓN',
      indicador: {
        id: 'captacion-total',
        nombre: 'Gasto de captación',
        unidad: 'moneda',
        direccion: 'menor-mejor',
        etapa: null,
        grupo: 'captacion',
        definicion:
          'Todo lo invertido en traer clientes, sumando los seis canales. Fila calculada del Excel, sin clave.',
      },
    },
  ]

  // El Excel no tiene línea de gasto para «Interno»: no cuesta dinero externo.
  const CON_GASTO: Canal[] = [
    'publicidad',
    'prospeccion',
    'referidos',
    'afiliados',
    'contenido',
    'newsletter',
  ]
  const CLAVE_GASTO: Partial<Record<Canal, string>> = {
    publicidad: 'Gastos_Publicidad',
    // Sin tilde en la hoja, a diferencia de las claves de embudo.
    prospeccion: 'Gastos_Prospeccion',
    referidos: 'Gastos_Referidos',
    afiliados: 'Gastos_Afiliados',
    contenido: 'Gastos_Contenido',
    newsletter: 'Gastos_Newsletter',
  }

  for (const canal of CON_GASTO) {
    const clave = CLAVE_GASTO[canal]!
    salida.push({
      clave,
      indicador: {
        id: `captacion.${canal}`,
        nombre: NOMBRE_CANAL[canal],
        unidad: 'moneda',
        direccion: 'menor-mejor',
        etapa: null,
        canal,
        grupo: 'captacion',
        clave,
        definicion: `Gasto de captación imputado al canal ${NOMBRE_CANAL[canal]}.`,
      },
    })
  }

  return salida
}

function entradasDeInsumos(): EntradaCatalogo[] {
  return INSUMOS.map((insumo) => ({
    clave: insumo.clave,
    indicador: {
      id: insumo.id,
      nombre: insumo.nombre,
      unidad: insumo.unidad,
      direccion: insumo.direccion,
      etapa: null,
      canal: insumo.canal,
      grupo: 'insumo',
      clave: insumo.clave,
      definicion: insumo.definicion,
    },
  }))
}

export const CATALOGO: EntradaCatalogo[] = [
  ...entradasDelEmbudo(),
  ...entradasDeDinero(),
  ...entradasDeCaptacion(),
  ...entradasDeInsumos(),
]

/** Todos los indicadores del catálogo, en orden de lectura del tablero. */
export const INDICADORES_DEL_PLAN: Indicador[] = CATALOGO.map((e) => e.indicador)

/** Búsqueda por id, para no recorrer el array en cada componente. */
export const POR_ID = new Map(INDICADORES_DEL_PLAN.map((i) => [i.id, i]))

/** Las cinco etapas, ordenadas de la boca al cierre. */
export const ETAPAS_DEL_EMBUDO: Indicador[] = INDICADORES_DEL_PLAN.filter(
  (i) => i.etapa !== null,
).sort((a, b) => (a.etapa ?? 0) - (b.etapa ?? 0))

/** Desgloses por canal de una etapa, solo de los canales con cifras. */
export function canalesDe(etapaId: string): Indicador[] {
  return CANALES_ACTIVOS.map((canal) => POR_ID.get(`${etapaId}.${canal}`)).filter(
    (i): i is Indicador => i !== undefined,
  )
}
