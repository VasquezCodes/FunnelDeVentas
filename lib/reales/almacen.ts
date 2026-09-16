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
