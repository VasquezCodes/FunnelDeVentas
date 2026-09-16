/**
 * Página principal — Server Component.
 *
 * Carga el plan a través de la interfaz `FuenteDatos`, que hoy implementa el
 * Excel de SharePoint. Este archivo es el ÚNICO sitio que sabe qué fuente
 * está en uso: cambiarla no toca ni un componente.
 *
 * ── Por qué no hay respaldo con datos de ejemplo ─────────────────────────
 * La tentación es caer a la fuente de ejemplo si Graph falla, para que la
 * página «siempre funcione». Sería peor: el tablero enseñaría cifras
 * plausibles que no son las del plan, y nadie tiene forma de notarlo mirando.
 * Un tablero que miente en silencio es más peligroso que uno que se cae. Si
 * no se puede leer el plan, se dice cuál es el fallo y cómo se arregla.
 */

import { FolderSimpleDashedIcon, KeyIcon, WarningIcon } from '@phosphor-icons/react/ssr'
import { connection } from 'next/server'

import type { Meta, Real } from '@/lib/tipos'
import { fuenteExcel, procedenciaDelPlan } from '@/lib/plan/fuente'
import { estadoDeQuincenas } from '@/lib/reales/almacen'
import { Tablero } from '@/components/tablero'

/**
 * Resultado de cargar el plan: o los datos, o el motivo por el que no.
 *
 * El fallo se captura AQUÍ, alrededor de la lectura de datos, y no
 * envolviendo el JSX en un try/catch: eso último confunde los errores de
 * datos con los de render y React avisa, con razón.
 *
 * Tampoco se delega a un `error.tsx`. Sería lo idiomático, pero en producción
 * Next sanea el mensaje de un error de servidor y solo deja un identificador,
 * con lo que se perderían justo las dos frases que dicen qué arreglar.
 */
type Carga =
  | { ok: true; datos: Awaited<ReturnType<typeof leerTodo>> }
  | { ok: false; mensaje: string }

async function leerTodo() {
  const fuente = fuenteExcel

  const [indicadores, periodos, procedencia, reales] = await Promise.all([
    fuente.indicadores(),
    fuente.periodos(),
    procedenciaDelPlan(),
    estadoDeQuincenas(),
  ])

  // El plan entero son unos pocos miles de números: se precarga todo y así
  // cambiar de mes o recorrer la serie es instantáneo, sin ida y vuelta al
  // servidor. Cuando el histórico crezca, aquí es donde se acota la ventana.
  const cargas = await Promise.all(
    periodos.map(async (p) => ({
      id: p.id,
      metas: await fuente.metas(p.id),
      reales: await fuente.reales(p.id),
    })),
  )

  const metasPorPeriodo: Record<string, Meta[]> = {}
  const realesPorPeriodo: Record<string, Real[]> = {}
  for (const c of cargas) {
    metasPorPeriodo[c.id] = c.metas
    realesPorPeriodo[c.id] = c.reales
  }

  return {
    indicadores,
    periodos,
    metasPorPeriodo,
    realesPorPeriodo,
    procedencia,
    errorReales: reales.error,
  }
}

async function cargar(): Promise<Carga> {
  try {
    return { ok: true, datos: await leerTodo() }
  } catch (error) {
    return { ok: false, mensaje: error instanceof Error ? error.message : String(error) }
  }
}

export default async function Pagina() {
  // Cada petición se renderiza de nuevo: lo guardado en la captura tiene que
  // verse al recargar, no cuando caduque una caché.
  await connection()

  // La fecha de hoy, según el servidor: sin ningún resultado guardado, el
  // tablero abre en el periodo de hoy. Se calcula aquí y no en el navegador
  // para que el servidor y el cliente pinten el mismo periodo.
  const hoy = new Date().toISOString().slice(0, 10)

  const carga = await cargar()

  if (!carga.ok) return <NoSePudoLeerElPlan mensaje={carga.mensaje} />

  const { indicadores, periodos, metasPorPeriodo, realesPorPeriodo, procedencia, errorReales } =
    carga.datos

  return (
    <Tablero
      indicadores={indicadores}
      periodos={periodos}
      metasPorPeriodo={metasPorPeriodo}
      realesPorPeriodo={realesPorPeriodo}
      errorReales={errorReales}
      hoy={hoy}
      procedencia={{
        libro: procedencia.libro,
        modificadoEn: procedencia.modificadoEn,
        meses: procedencia.meses,
        incidencias: procedencia.incidencias,
      }}
    />
  )
}

/**
 * Estado de fallo. Dice qué pasó y qué hacer, no «algo salió mal».
 *
 * Las dos causas reales, por frecuencia: el libro cambió de carpeta al
 * cerrar el mes (la ruta lleva año y mes), o el secreto de Azure caducó.
 */
function NoSePudoLeerElPlan({ mensaje }: { mensaje: string }) {
  return (
    <main className="mx-auto flex min-h-screen max-w-184 flex-col justify-center px-6 py-16">
      <div className="bandeja">
        <div className="nucleo p-7">
          <div className="flex items-start gap-3">
            <WarningIcon
              weight="duotone"
              className="mt-0.5 size-5 shrink-0"
              style={{ color: 'var(--estado-alerta)' }}
              aria-hidden="true"
            />
            <div className="min-w-0">
              <h1 className="font-display text-xl leading-tight font-semibold tracking-tight">
                No se pudo leer el plan
              </h1>
              <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                El tablero compara contra el plan de negocio, y sin él no hay nada honesto que
                enseñar. No se muestran cifras de ejemplo a propósito: un tablero que aparenta
                funcionar con datos que no son el plan es peor que uno que se para.
              </p>

              <p
                className="cifra mt-4 rounded-lg px-3 py-2.5 text-xs leading-relaxed wrap-break-word"
                style={{ background: 'color-mix(in oklab, var(--foreground) 4%, transparent)' }}
              >
                {mensaje}
              </p>

              <div className="mt-5 space-y-2.5 text-sm">
                <p className="font-medium">Lo que suele ser:</p>
                {/* Cada causa con su objeto: la carpeta que cambió y la llave
                    que caducó. En carmín porque son pistas para orientarse, no
                    otro aviso: el aviso ya lo da el triángulo de arriba. */}
                <ul className="space-y-2.5 text-sm leading-relaxed text-muted-foreground">
                  <li className="flex items-start gap-2.5">
                    <FolderSimpleDashedIcon
                      weight="duotone"
                      aria-hidden="true"
                      className="mt-[0.2rem] size-4 shrink-0 text-brand"
                    />
                    <span>
                      <span className="text-foreground">El libro cambió de carpeta.</span> La ruta
                      del Excel lleva año y mes («2026/04 - Abril/Plan de Negocio 0426.xlsm»), así
                      que al cerrar cada mes hay que actualizar{' '}
                      <span className="cifra">SHAREPOINT_PLAN_URL</span>.
                    </span>
                  </li>
                  <li className="flex items-start gap-2.5">
                    <KeyIcon
                      weight="duotone"
                      aria-hidden="true"
                      className="mt-[0.2rem] size-4 shrink-0 text-brand"
                    />
                    <span>
                      <span className="text-foreground">El secreto de Azure caducó.</span> Se
                      renueva en el registro de aplicación y se actualiza{' '}
                      <span className="cifra">AZURE_CLIENT_SECRET</span>.
                    </span>
                  </li>
                </ul>
              </div>
            </div>
          </div>
        </div>
      </div>
    </main>
  )
}
