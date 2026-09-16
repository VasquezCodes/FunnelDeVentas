/**
 * Acceso al libro del plan de negocio en SharePoint, vía Microsoft Graph.
 *
 * ── Por qué se descarga el fichero entero y no se leen rangos ────────────
 * Graph expone una API de workbook (`/workbook/tables/…`, `usedRange`) que
 * sería lo natural: pedir solo la hoja que interesa. Con este libro no
 * funciona. Es un .xlsm de 3,6 MB con macros y fórmulas por todas partes, y
 * Graph no consigue abrir la sesión: devuelve 504 `MaxRequestDurationExceeded`
 * a los ~17 s, de forma reproducible (tres de tres). No es un fallo pasajero
 * ni un problema de permisos.
 *
 * Así que se baja el binario por `/content` y se parsea aquí. Cuesta una
 * descarga de 3,6 MB, y por eso todo lo de este módulo pasa por caché.
 *
 * ── Autenticación ────────────────────────────────────────────────────────
 * Client credentials (app-only): no hay usuario delegado, así que el tablero
 * lee el plan aunque nadie haya iniciado sesión. Es el mismo registro de
 * aplicación que usa control de horas, sobre el mismo tenant.
 */

import { unstable_cache } from 'next/cache'

/** Etiqueta de caché: `revalidateTag(TAG_PLAN)` fuerza a releer el Excel. */
export const TAG_PLAN = 'plan-de-negocio'

/**
 * Cuánto vive el plan en caché. Un plan de negocio se revisa una vez al mes;
 * media hora es de sobra y evita bajar 3,6 MB en cada render.
 */
const VIGENCIA_SEGUNDOS = 1800

/**
 * Un fetch sin límite de tiempo no falla: se queda esperando, y con él la
 * función de servidor que lo llamó. Esta app se cayó una vez por eso en el
 * proyecto hermano, así que aquí todo lleva reloj desde el primer día.
 * La descarga es de varios MB, de ahí que sea más generoso que el token.
 */
const LIMITE_TOKEN_MS = 10_000
const LIMITE_DESCARGA_MS = 45_000

function pedir(url: string, init: RequestInit, limiteMs: number): Promise<Response> {
  return fetch(url, { ...init, signal: AbortSignal.timeout(limiteMs) })
}

/** Formato que espera el endpoint `/shares` de Graph para una URL de fichero. */
function codificarUrlCompartida(url: string): string {
  return 'u!' + Buffer.from(url).toString('base64url')
}

/** Falta una variable de entorno: se dice cuál, no «algo salió mal». */
function exigir(nombre: string): string {
  const valor = process.env[nombre]
  if (!valor) {
    throw new Error(
      `Falta ${nombre}. El plan se lee de SharePoint y sin esa variable no hay forma de entrar.`,
    )
  }
  return valor
}

async function obtenerToken(): Promise<string> {
  const tenant = exigir('AZURE_TENANT_ID')

  const respuesta = await pedir(
    `https://login.microsoftonline.com/${tenant}/oauth2/v2.0/token`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        client_id: exigir('AZURE_CLIENT_ID'),
        client_secret: exigir('AZURE_CLIENT_SECRET'),
        grant_type: 'client_credentials',
        scope: 'https://graph.microsoft.com/.default',
      }),
    },
    LIMITE_TOKEN_MS,
  )

  if (!respuesta.ok) {
    // El cuerpo de Azure trae el código real del error (AADSTS…). Se conserva:
    // es la diferencia entre «no entra» y «el secreto caducó el martes».
    throw new Error(`Azure rechazó las credenciales: ${await respuesta.text()}`)
  }

  const datos = (await respuesta.json()) as { access_token: string }
  return datos.access_token
}

interface Localizacion {
  driveId: string
  itemId: string
  nombre: string
  modificadoEn: string
}

async function localizarLibro(token: string, urlFichero: string): Promise<Localizacion> {
  const respuesta = await pedir(
    `https://graph.microsoft.com/v1.0/shares/${codificarUrlCompartida(urlFichero)}/driveItem`,
    { headers: { Authorization: `Bearer ${token}` } },
    LIMITE_TOKEN_MS,
  )

  if (!respuesta.ok) {
    const error = (await respuesta.json().catch(() => ({}))) as {
      error?: { message?: string }
    }
    // 404 aquí casi siempre significa que el libro del mes cambió de carpeta:
    // la ruta lleva año y mes ('2026/04 - Abril/Plan de Negocio 0426.xlsm').
    throw new Error(
      `No se encuentra el libro del plan (${respuesta.status}). ` +
        `Comprueba el enlace: la ruta incluye el mes y cambia al cerrar cada uno, y la aplicación tiene que tener acceso al archivo. ` +
        `Graph dijo: ${error?.error?.message ?? 'sin detalle'}`,
    )
  }

  const item = (await respuesta.json()) as {
    id: string
    name: string
    lastModifiedDateTime: string
    parentReference: { driveId: string }
  }

  return {
    driveId: item.parentReference.driveId,
    itemId: item.id,
    nombre: item.name,
    modificadoEn: item.lastModifiedDateTime,
  }
}

export interface LibroDescargado {
  contenido: ArrayBuffer
  nombre: string
  modificadoEn: string
}

/**
 * Baja el libro completo. Sin caché: quien lo llama decide si cachear el
 * binario (nunca) o el resultado de parsearlo (siempre).
 *
 * El enlace lo elige la captura (`lib/plan/enlace.ts`); sin él, el de la
 * variable de entorno.
 */
export async function descargarLibro(
  urlFichero: string = exigir('SHAREPOINT_PLAN_URL'),
): Promise<LibroDescargado> {
  const token = await obtenerToken()
  const { driveId, itemId, nombre, modificadoEn } = await localizarLibro(token, urlFichero)

  const respuesta = await pedir(
    `https://graph.microsoft.com/v1.0/drives/${driveId}/items/${itemId}/content`,
    { headers: { Authorization: `Bearer ${token}` } },
    LIMITE_DESCARGA_MS,
  )

  if (!respuesta.ok) {
    throw new Error(`No se pudo descargar el libro: ${respuesta.status}`)
  }

  return { contenido: await respuesta.arrayBuffer(), nombre, modificadoEn }
}

/**
 * Envuelve en caché una lectura ya parseada del libro.
 *
 * El binario nunca se cachea: `unstable_cache` serializa a JSON y un
 * ArrayBuffer de 3,6 MB no sobrevive al viaje. Lo que se guarda es el
 * resultado de leerlo, que son unos pocos kilobytes de números.
 *
 * NOTA DE MIGRACIÓN: Next 16 sustituye `unstable_cache` por la directiva
 * `use cache`, que exige activar `cacheComponents` en next.config.ts. Eso
 * cambia el modelo de renderizado de toda la aplicación (todo pasa a
 * dinámico por defecto y hay que declarar los límites de Suspense), así que
 * es una migración con entidad propia, no un detalle de este módulo.
 */
export function cachearLecturaDelPlan<T>(
  clave: string,
  leer: () => Promise<T>,
): () => Promise<T> {
  return unstable_cache(leer, [clave], {
    revalidate: VIGENCIA_SEGUNDOS,
    tags: [TAG_PLAN],
  })
}
