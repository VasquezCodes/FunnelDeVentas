/**
 * Los reales, en Firestore.
 *
 * Un documento por quincena en la colección `quincenas` (en local,
 * `quincenas-dev`), con id el del periodo ('2026-09-Q1') y el campo
 * `valores`: id de indicador → número. Vacío no es cero: una casilla vacía
 * no se guarda.
 *
 * Solo el servidor habla con Firestore, con el Admin SDK. Las reglas de la
 * base niegan todo al navegador: sin cuentas de usuario no habría forma
 * segura de dejarle entrar.
 *
 * Sin caché entre peticiones, a propósito: lo guardado tiene que verse al
 * recargar. `cache` de React solo evita repetir la lectura dentro de una
 * misma petición, donde la piden la fuente de datos y la página.
 */

import 'server-only'

import { cache } from 'react'
import { cert, getApps, initializeApp, type App } from 'firebase-admin/app'
import { FieldValue, getFirestore } from 'firebase-admin/firestore'

import type { ValoresPorQuincena } from '@/lib/reales/mes'

/** Falta una variable: se dice cuál, no «algo salió mal». */
function exigir(nombre: string): string {
  const valor = process.env[nombre]
  if (!valor) {
    throw new Error(
      `Falta ${nombre}. Los resultados se guardan en Firebase y sin esa variable no hay forma de entrar.`,
    )
  }
  return valor
}

/** Una sola instancia por proceso: inicializar dos veces lanza. */
function aplicacion(): App {
  return (
    getApps()[0] ??
    initializeApp({
      credential: cert({
        projectId: exigir('FIREBASE_PROJECT_ID'),
        clientEmail: exigir('FIREBASE_CLIENT_EMAIL'),
        // En Vercel y en .env la clave suele llegar con los saltos de línea
        // escritos como «\n»; el certificado los necesita de verdad.
        privateKey: exigir('FIREBASE_PRIVATE_KEY').replace(/\\n/g, '\n'),
      }),
    })
  )
}

function coleccion() {
  return getFirestore(aplicacion()).collection(process.env.FIRESTORE_COLECCION || 'quincenas')
}

/** Solo números finitos: lo que no lo sea se ignora, no se inventa. */
function valoresDe(dato: unknown): Record<string, number> {
  if (typeof dato !== 'object' || dato === null) return {}
  const valores: Record<string, number> = {}
  for (const [indicadorId, valor] of Object.entries(dato)) {
    if (typeof valor === 'number' && Number.isFinite(valor)) valores[indicadorId] = valor
  }
  return valores
}

export const leerQuincenas = cache(async (): Promise<ValoresPorQuincena> => {
  const instantanea = await coleccion().get()
  const quincenas: ValoresPorQuincena = {}
  for (const documento of instantanea.docs) {
    quincenas[documento.id] = valoresDe(documento.get('valores'))
  }
  return quincenas
})

export interface EstadoQuincenas {
  quincenas: ValoresPorQuincena
  /** Por qué no se pudieron leer, o null si se leyeron. */
  error: string | null
}

/**
 * La lectura que usa el tablero: nunca lanza. Si Firestore falla, el plan se
 * sigue enseñando sin reales y el motivo sube hasta un aviso en pantalla.
 * Nunca se cae a datos de ejemplo: un tablero que miente en silencio es peor
 * que uno que avisa.
 */
export const estadoDeQuincenas = cache(async (): Promise<EstadoQuincenas> => {
  try {
    return { quincenas: await leerQuincenas(), error: null }
  } catch (error) {
    console.error('[reales] No se pudieron leer las quincenas de Firestore:', error)
    return { quincenas: {}, error: error instanceof Error ? error.message : String(error) }
  }
})

// ── Configuración: el enlace del plan ────────────────────────────────────

/**
 * La configuración de este entorno. Un documento por colección de
 * quincenas, así local (`quincenas-dev`) y producción (`quincenas`) guardan
 * cada uno su enlace y cambiar uno no toca el otro.
 */
function configuracion() {
  return getFirestore(aplicacion())
    .collection('configuracion')
    .doc(process.env.FIRESTORE_COLECCION || 'quincenas')
}

/** El enlace del plan que se eligió desde la captura, o null si nunca se cambió. */
export async function leerEnlaceGuardado(): Promise<{ url: string; version: string } | null> {
  const documento = await configuracion().get()
  const url = documento.get('urlPlan')
  if (typeof url !== 'string' || url === '') return null
  const version = documento.get('versionPlan')
  return { url, version: typeof version === 'string' ? version : '0' }
}

/**
 * Guarda el enlace del plan. La versión cambia en cada guardado, aunque el
 * enlace sea el mismo: así volver a guardarlo relee el Excel sin esperar a
 * que caduque la caché.
 */
export async function guardarEnlace(url: string): Promise<void> {
  await configuracion().set(
    { urlPlan: url, versionPlan: String(Date.now()), actualizadoEn: FieldValue.serverTimestamp() },
    { merge: true },
  )
}

/**
 * Reemplaza enteros los documentos de las quincenas indicadas, de un golpe:
 * o se guardan todas o ninguna. Reemplazar (y no fusionar) es lo que hace
 * que una cifra borrada en la captura desaparezca también aquí.
 */
export async function guardarQuincenas(documentos: ValoresPorQuincena): Promise<void> {
  const destino = coleccion()
  const lote = destino.firestore.batch()
  for (const [id, valores] of Object.entries(documentos)) {
    lote.set(destino.doc(id), { valores, actualizadoEn: FieldValue.serverTimestamp() })
  }
  await lote.commit()
}
