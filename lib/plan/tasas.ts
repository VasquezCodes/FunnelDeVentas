/**
 * Catálogo de tasas del plan: qué nombre definido del libro es cada tasa y
 * entre qué dos indicadores se mide.
 *
 * El plan construye el embudo multiplicando: impresiones × CTR = clics,
 * clics × CVR = leads, leads × 60 % = llamadas… Este módulo ata cada una de
 * esas hipótesis a sus dos indicadores, para poder ponerle al lado la tasa
 * real.
 *
 * Solo entran las tasas que el Excel tiene como tales en la hoja
 * «Variables». Hubo una «de llamada a venta» por canal, calculada aquí como
 * cualificación × propuestas × cierre; el usuario la quitó: si no está en el
 * Excel, no se usa.
 */

import type { Canal, TasaDelPlan } from '@/lib/tipos'

interface DefTasa {
  /** El nombre definido del libro que guarda la tasa. */
  definido: string
  nombre: string
  desde: string
  hacia: string
  canal?: Canal
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

const DEFINICIONES: DefTasa[] = [
  // ── El embudo ────────────────────────────────────────────────────────
  { definido: 'CVR_Llamada', nombre: 'Tasa de conversión a llamada', desde: 'eleads', hacia: 'llamadas' },
  { definido: 'CVR_Cualificación', nombre: 'Tasa de cualificación', desde: 'llamadas', hacia: 'discoveries' },
  { definido: 'CVR_Propuestas', nombre: 'Tasa de propuestas', desde: 'discoveries', hacia: 'propuestas' },
  { definido: 'CVR_Cierre', nombre: 'Tasa de cierre', desde: 'propuestas', hacia: 'ventas' },

  // ── Las mismas tasas, canal a canal ──────────────────────────────────
  // Donde el Excel reparte por canal las dos etapas, la tasa del plan es la
  // misma en cada canal: los leads de Publicidad × 60 % son las llamadas de
  // Publicidad.
  //
  // Se declaran las cuatro etapas. Que una salga o no depende del libro: las
  // tasas se filtran por los indicadores que ese plan trae, así que en un
  // libro que no reparta Discoveries —o Propuestas— sus tasas de canal
  // sencillamente no existen y la fila no se despliega.
  ...(
    [
      ['CVR_Llamada', 'Tasa de conversión a llamada', 'eleads', 'llamadas'],
      ['CVR_Cualificación', 'Tasa de cualificación', 'llamadas', 'discoveries'],
      ['CVR_Propuestas', 'Tasa de propuestas', 'discoveries', 'propuestas'],
      ['CVR_Cierre', 'Tasa de cierre', 'propuestas', 'ventas'],
    ] as const
  ).flatMap(([definido, nombre, desde, hacia]) =>
    CANALES.map(
      (canal): DefTasa => ({
        definido,
        nombre,
        desde: `${desde}.${canal}`,
        hacia: `${hacia}.${canal}`,
        canal,
      }),
    ),
  ),

  // ── Variables previas: de la materia prima de cada canal a sus leads ──
  { definido: 'CVR_LinkCTR', nombre: 'Link CTR', desde: 'publicidad-impresiones', hacia: 'publicidad-clicks', canal: 'publicidad' },
  { definido: 'CVR_Publicidad', nombre: 'CVR Publicidad', desde: 'publicidad-clicks', hacia: 'eleads.publicidad', canal: 'publicidad' },
  { definido: 'CVR_Prospección', nombre: 'CVR Prospección', desde: 'prospeccion-contactos', hacia: 'eleads.prospeccion', canal: 'prospeccion' },
  { definido: 'CVR_Referidos', nombre: 'CVR Referidos', desde: 'referidos-contactos', hacia: 'eleads.referidos', canal: 'referidos' },
  { definido: 'CVR_Afiliados', nombre: 'CVR Afiliados', desde: 'afiliados-contactos', hacia: 'eleads.afiliados', canal: 'afiliados' },
  { definido: 'CVR_Contenido', nombre: 'CVR Contenido', desde: 'contenido-visitas', hacia: 'eleads.contenido', canal: 'contenido' },
  { definido: 'CVR_Apertura', nombre: 'CVR Apertura', desde: 'newsletter-envios', hacia: 'newsletter-aperturas', canal: 'newsletter' },
  { definido: 'CVR_Newsletter', nombre: 'CVR Newsletter', desde: 'newsletter-aperturas', hacia: 'eleads.newsletter', canal: 'newsletter' },
]

/** Todos los nombres definidos que el catálogo necesita del libro. */
export const NOMBRES_DE_TASAS: ReadonlySet<string> = new Set(DEFINICIONES.map((d) => d.definido))

/**
 * Las tasas del plan a partir de los nombres leídos del libro. Una tasa cuyo
 * nombre falte queda con `plan: null` —nunca se inventa— y el nombre sale en
 * `faltan` para que la interfaz pueda decir qué se perdió.
 */
export function construirTasas(valores: ReadonlyMap<string, number>): {
  tasas: TasaDelPlan[]
  faltan: string[]
} {
  const tasas = DEFINICIONES.map(
    (def): TasaDelPlan => ({
      id: `${def.desde}>${def.hacia}`,
      nombre: def.nombre,
      desde: def.desde,
      hacia: def.hacia,
      plan: valores.get(def.definido) ?? null,
      ...(def.canal ? { canal: def.canal } : {}),
    }),
  )
  const faltan = [...NOMBRES_DE_TASAS].filter((n) => !valores.has(n))
  return { tasas, faltan }
}
