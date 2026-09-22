'use client'

/**
 * Una ficha del Embudo, abierta en grande.
 *
 * La ficha pequeña contesta «cómo va esta etapa»; abierta contesta el porqué:
 * la misma serie a lo alto, con doce periodos (nueve hasta el elegido y tres
 * de plan por delante) y un eje con cifras; debajo, de qué canales vino el
 * resultado y cómo convirtió desde la etapa anterior frente a la tasa del
 * plan (hoja «Variables»).
 *
 * Es un <dialog> nativo abierto con showModal(): el fondo inerte, el foco
 * atrapado y Escape para cerrar los da el navegador. Pulsar fuera también
 * cierra. Las flechas de la cabecera pasan a la etapa vecina sin cerrar.
 */

import { useEffect, useRef, type ReactNode } from 'react'
import { CaretLeftIcon, CaretRightIcon, XIcon } from '@phosphor-icons/react/ssr'

import {
  CeldaFicha,
  cociente,
  hayProyeccion,
  type Ficha,
  type PuntoDeSerie,
} from '@/components/graficos/fichas'
import { LeyendaPlanReal } from '@/components/graficos/leyenda-plan-real'
import { Semaforo } from '@/components/semaforo'
import { calcularEstado, formatearTasaConversion, formatearValor } from '@/lib/comparacion'
import { tasaEntre, tasaReal } from '@/lib/tasas'
import { gsap, prefiereQuietud, useGSAP } from '@/lib/animacion'
import { etiquetaConCobertura } from '@/lib/periodos'
import type { Comparativa, Estado, Indicador, Periodo, TasaDelPlan } from '@/lib/tipos'
import { CANALES_ACTIVOS, NOMBRE_CANAL, type Canal } from '@/lib/tipos'
import { cn } from '@/lib/utils'

const TODOS_LOS_CANALES = Object.keys(NOMBRE_CANAL) as Canal[]

export interface EmbudoAmpliadoProps {
  /** Posición de la ficha abierta, o null si no hay ninguna. */
  abierta: number | null
  /** Las fichas con la ventana grande, en el mismo orden que las pequeñas. */
  fichas: Ficha[]
  /** La ventana grande y dónde cae en ella el periodo elegido. */
  ventana: PuntoDeSerie[]
  elegido: number
  /** Las etapas, de la boca al cierre. */
  etapas: Indicador[]
  tasas: TasaDelPlan[]
  onCambiar: (indice: number) => void
  onCerrar: () => void
  /**
   * Todos los periodos del plan, en orden, y cómo cambiar de uno a otro. La
   * ficha abierta enseña doce meses y no se podía mover entre ellos: para ver
   * otro mes había que cerrarla, cambiar arriba y volver a abrirla. Sin esto,
   * el cuadro se queda como estaba y el mes es solo un rótulo.
   */
  periodos?: Periodo[]
  onCambiarPeriodo?: (id: string) => void
}

export function EmbudoAmpliado({
  abierta,
  fichas,
  ventana,
  elegido,
  etapas,
  tasas,
  onCambiar,
  onCerrar,
  periodos: periodosDelPlan,
  onCambiarPeriodo,
}: EmbudoAmpliadoProps) {
  const dialogo = useRef<HTMLDialogElement>(null)

  useEffect(() => {
    const d = dialogo.current
    if (!d) return
    if (abierta !== null && !d.open) d.showModal()
    if (abierta === null && d.open) d.close()
  }, [abierta])

  const ficha = abierta !== null ? fichas[abierta] : undefined
  const punto = ventana[elegido]
  const periodos = ventana.map((p) => p.periodo)
  const etapa = ficha ? etapas.find((e) => e.id === ficha.id) : undefined

  /**
   * El viaje de un mes a otro.
   *
   * El gráfico ya se rehace solo: su `clave` lleva los meses de la ventana, y
   * al cambiar de mes vuelve a trazarse el plan, a dibujarse la curva y a
   * contar la cifra. Lo que faltaba era que el resto fuera con él —el rótulo
   * y las tablas del pie cambiaban de golpe, como si fuera otra pantalla— y
   * que se notara HACIA DÓNDE se va.
   *
   * Por eso todo entra del lado del que se viene: el rótulo, el cuerpo entero
   * y, detrás, las filas del pie escalonadas. Es el gesto de pasar una
   * página, y el sentido lo da el signo. Solo al CAMBIAR de mes: al abrir la
   * ficha ya hay una entrada, y dos animaciones a la vez son ruido.
   */
  const mesAnterior = useRef<string | null>(null)
  useGSAP(
    () => {
      const mes = punto?.periodo.id
      const antes = mesAnterior.current
      mesAnterior.current = mes ?? null
      if (!mes || !antes || antes === mes || abierta === null || prefiereQuietud()) return

      // Los ids son '2026-09' y se ordenan como texto: mayor es más tarde.
      const lado = mes > antes ? 1 : -1
      gsap
        .timeline({ defaults: { ease: 'power3.out' } })
        .fromTo(
          '[data-mes-ficha]',
          { xPercent: lado * 60, opacity: 0 },
          { xPercent: 0, opacity: 1, duration: 0.34 },
        )
        // El cuerpo entero con él: es lo que convierte el cambio en un gesto y
        // no en un parpadeo. Poco recorrido —36 px— y desvanecido a la vez,
        // que es lo que hace que se note sin marear.
        .fromTo('[data-cuerpo]', { x: lado * 36, opacity: 0 }, { x: 0, opacity: 1, duration: 0.52 }, '<')
        // Las filas del pie llegan detrás: la tabla se rellena en vez de
        // aparecer de golpe.
        .fromTo(
          '[data-pie] tbody tr',
          { y: 14, opacity: 0 },
          { y: 0, opacity: 1, duration: 0.42, stagger: 0.03 },
          '<0.14',
        )
        // El DOM se queda como estaba: sin esto, un `transform` en una fila de
        // tabla se lleva por delante el hover y el foco.
        .set(['[data-mes-ficha]', '[data-cuerpo]', '[data-pie] tbody tr'], {
          clearProps: 'opacity,transform',
        })
    },
    { scope: dialogo, dependencies: [punto?.periodo.id, abierta] },
  )

  return (
    <dialog
      ref={dialogo}
      aria-label={ficha ? `${ficha.titulo}, en grande` : undefined}
      onCancel={(evento) => {
        evento.preventDefault()
        onCerrar()
      }}
      // Pulsar el fondo cierra: el clic llega al propio <dialog> solo fuera de su caja.
      onClick={(evento) => {
        if (evento.target === evento.currentTarget) onCerrar()
      }}
      className="aparecer m-auto max-h-[calc(100dvh-2rem)] w-[min(60rem,calc(100vw-2rem))] overflow-y-auto rounded-2xl border bg-card p-0 text-foreground shadow-(--sombra-alta) backdrop:bg-[color-mix(in_oklab,var(--foreground)_32%,transparent)]"
      style={{ borderColor: 'var(--border)' }}
    >
      {ficha && punto && abierta !== null && (
        <div>
          <div className="flex items-center justify-between gap-3 border-b px-6 py-3" style={{ borderColor: 'var(--regla-fina)' }}>
            <div className="flex min-w-0 flex-wrap items-center gap-x-5 gap-y-1.5">
              <PasoDeMes
                actual={punto.periodo}
                periodos={periodosDelPlan}
                onCambiar={onCambiarPeriodo}
              />
              {/* La rejilla de fichas lleva su leyenda en la cabecera de la
                  hoja, pero esta ficha se abre encima y la tapa: aquí dentro
                  el gráfico es más grande, tiene eje y rejilla, y era el único
                  sitio donde tres trazos distintos no se explicaban. */}
              <LeyendaPlanReal
                forma="lineas"
                proyeccion={hayProyeccion([ficha], periodos)}
              />
            </div>
            <div className="flex items-center gap-1">
              <BotonIcono
                etiqueta="Ficha anterior"
                disabled={abierta === 0}
                onClick={() => onCambiar(abierta - 1)}
              >
                <CaretLeftIcon weight="bold" className="size-4" />
              </BotonIcono>
              <BotonIcono
                etiqueta="Ficha siguiente"
                disabled={abierta === fichas.length - 1}
                onClick={() => onCambiar(abierta + 1)}
              >
                <CaretRightIcon weight="bold" className="size-4" />
              </BotonIcono>
              <span aria-hidden="true" className="mx-1 h-5 w-px" style={{ backgroundColor: 'var(--regla)' }} />
              <BotonIcono etiqueta="Cerrar" onClick={onCerrar}>
                <XIcon weight="bold" className="size-4" />
              </BotonIcono>
            </div>
          </div>

          {/* Lo que viaja al cambiar de mes: el gráfico y las tablas. La
              cabecera se queda quieta, que es lo que da la sensación de que
              es la misma ficha con otro mes y no otra pantalla. */}
          <div data-cuerpo>
          <CeldaFicha
            key={ficha.id}
            ficha={ficha}
            indiceFicha={abierta}
            ventana={periodos}
            elegido={elegido}
            clave={`${periodos.map((p) => p.id).join('|')}#${elegido}#${ficha.id}`}
            grande
          />

          <div data-pie className="grid grid-cols-1 gap-px border-t md:grid-cols-2" style={{ backgroundColor: 'var(--regla-fina)', borderColor: 'var(--regla-fina)' }}>
            {etapa ? (
              <>
                <PorCanal etapa={etapa} punto={punto} />
                <DesdeLaAnterior etapa={etapa} etapas={etapas} punto={punto} tasas={tasas} />
              </>
            ) : (
              <TasasDelEmbudo etapas={etapas} punto={punto} tasas={tasas} />
            )}
          </div>
          </div>
        </div>
      )}
    </dialog>
  )
}

/**
 * El mes de la ficha abierta, y cómo cambiarlo sin cerrarla.
 *
 * Va donde antes solo se leía «Septiembre 2026», y por eso se pinta como una
 * pieza —borde, flechas dentro— y no como texto con dos botones al lado: lo
 * que se ve tiene que decir que se puede tocar.
 *
 * Las flechas de la derecha del cuadro pasan de una ETAPA a otra y estas de
 * un MES a otro. Son dos pares a dos palmos, así que cada una dice a dónde
 * lleva —«Ir a Agosto 2026», «Ficha anterior»—: sin eso, un lector de
 * pantalla oiría cuatro flechas iguales.
 *
 * Sin `periodos` ni `onCambiar` se queda en lo que era: un rótulo.
 */
function PasoDeMes({
  actual,
  periodos,
  onCambiar,
}: {
  actual: Periodo
  periodos?: Periodo[]
  onCambiar?: (id: string) => void
}) {
  const etiqueta = etiquetaConCobertura(actual)
  if (!periodos || !onCambiar) {
    return <p className="text-sm text-muted-foreground">{etiqueta}</p>
  }

  // `periodos` viene en orden cronológico: atrás es el anterior del array.
  const indice = periodos.findIndex((p) => p.id === actual.id)
  const atras = indice > 0 ? periodos[indice - 1] : null
  const adelante = indice >= 0 && indice < periodos.length - 1 ? periodos[indice + 1] : null

  return (
    <div className="flex items-center gap-0.5 rounded-full border p-0.75" style={{ borderColor: 'var(--border)' }}>
      <BotonIcono
        etiqueta={atras ? `Ir a ${atras.etiqueta}` : 'No hay mes anterior'}
        disabled={!atras}
        onClick={() => atras && onCambiar(atras.id)}
      >
        <CaretLeftIcon weight="bold" className="size-4" />
      </BotonIcono>
      {/* `inline-block` no es decorativo: a un elemento en línea no se le
          aplica ni `min-width` ni `transform`, así que sin esto ni el ancho se
          mantiene ni la transición del mes se ve.

          Y el ancho estable hace falta porque, si no, la pieza encoge al pasar
          de «Septiembre» a «Mayo» y las flechas se mueven bajo el dedo. */}
      <span
        data-mes-ficha
        className="inline-block min-w-40 text-center text-sm font-medium text-foreground"
      >
        {etiqueta}
      </span>
      <BotonIcono
        etiqueta={adelante ? `Ir a ${adelante.etiqueta}` : 'No hay mes siguiente'}
        disabled={!adelante}
        onClick={() => adelante && onCambiar(adelante.id)}
      >
        <CaretRightIcon weight="bold" className="size-4" />
      </BotonIcono>
    </div>
  )
}

function BotonIcono({
  etiqueta,
  disabled = false,
  onClick,
  children,
}: {
  etiqueta: string
  disabled?: boolean
  onClick: () => void
  children: ReactNode
}) {
  return (
    <button
      type="button"
      aria-label={etiqueta}
      title={etiqueta}
      disabled={disabled}
      onClick={onClick}
      className="grid size-9 place-items-center rounded-full text-muted-foreground transition-colors duration-200 hover:bg-[color-mix(in_oklab,var(--foreground)_6%,transparent)] hover:text-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring disabled:pointer-events-none disabled:opacity-35"
    >
      {children}
    </button>
  )
}

/** Una sección del pie de la ficha grande: título pequeño y su contenido. */
function Seccion({ titulo, children, className }: { titulo: string; children: ReactNode; className?: string }) {
  return (
    <section className={cn('bg-card px-6 pt-5 pb-6', className)}>
      <h4 className="text-sm font-medium text-foreground">{titulo}</h4>
      <div className="mt-3">{children}</div>
    </section>
  )
}

/** De qué canales vino el resultado de la etapa en el periodo elegido. */
function PorCanal({ etapa, punto }: { etapa: Indicador; punto: PuntoDeSerie }) {
  // Los canales activos siempre; los demás, solo si traen plan o resultado.
  const filas = TODOS_LOS_CANALES.flatMap((canal): Array<{ canal: Canal; c: Comparativa }> => {
    const c = punto.comparativas.find((x) => x.indicador.id === `${etapa.id}.${canal}`)
    if (!c) return []
    const conCifras = CANALES_ACTIVOS.includes(canal) || (c.meta ?? 0) > 0 || c.real !== null
    return conCifras ? [{ canal, c }] : []
  })

  if (filas.length === 0) {
    return (
      <Seccion titulo="Por canal">
        <p className="text-sm text-muted-foreground">
          El plan no reparte esta etapa por canal: a esta altura del embudo el origen ya no se sigue.
        </p>
      </Seccion>
    )
  }

  const cifra = (v: number | null) => (v === null ? '' : formatearValor(v, 'cantidad'))
  return (
    <Seccion titulo="Por canal">
      <table className="w-full text-sm tabular-nums">
        <thead>
          <tr className="text-xs text-muted-foreground">
            <th scope="col" className="pb-2 text-left font-normal">
              <span className="sr-only">Canal</span>
            </th>
            <th scope="col" className="pb-2 pl-3 text-right font-normal">Real</th>
            <th scope="col" className="pb-2 pl-3 text-right font-normal">Plan</th>
            <th scope="col" className="pb-2 pl-4 text-left font-normal">
              <span className="sr-only">Estado</span>
            </th>
          </tr>
        </thead>
        <tbody>
          {filas.map(({ canal, c }) => (
            <tr key={canal} className="border-t" style={{ borderColor: 'var(--regla-fina)' }}>
              <th scope="row" className="py-2 text-left font-normal text-foreground">
                {NOMBRE_CANAL[canal]}
              </th>
              <td className="py-2 pl-3 text-right font-medium text-foreground">{cifra(c.real)}</td>
              <td className="py-2 pl-3 text-right text-muted-foreground">{cifra(c.meta)}</td>
              <td className="py-2 pl-4">
                <Semaforo estado={c.estado} cumplimiento={c.cumplimiento} />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </Seccion>
  )
}

/** Una tasa, real frente a plan, con su juicio. */
function FilaTasa({ nombre, real, plan }: { nombre: string; real: number | null; plan: number | null }) {
  const estado: Estado = calcularEstado(cociente(real, plan), 'mayor-mejor')
  return (
    <tr className="border-t" style={{ borderColor: 'var(--regla-fina)' }}>
      <th scope="row" className="py-2 text-left font-normal text-foreground">
        {nombre}
      </th>
      <td className="py-2 pl-3 text-right font-medium text-foreground">
        {real === null ? '' : formatearTasaConversion(real)}
      </td>
      <td className="py-2 pl-3 text-right text-muted-foreground">
        {plan === null ? '' : formatearTasaConversion(plan)}
      </td>
      <td className="py-2 pl-4">
        <Semaforo estado={estado} />
      </td>
    </tr>
  )
}

function TablaTasas({ children }: { children: ReactNode }) {
  return (
    <table className="w-full text-sm tabular-nums">
      <thead>
        <tr className="text-xs text-muted-foreground">
          <th scope="col" className="pb-2 text-left font-normal">
            <span className="sr-only">Tasa</span>
          </th>
          <th scope="col" className="pb-2 pl-3 text-right font-normal">Real</th>
          <th scope="col" className="pb-2 pl-3 text-right font-normal">Plan</th>
          <th scope="col" className="pb-2 pl-4 text-left font-normal">
            <span className="sr-only">Estado</span>
          </th>
        </tr>
      </thead>
      <tbody>{children}</tbody>
    </table>
  )
}

const realDe = (punto: PuntoDeSerie, id: string) =>
  punto.comparativas.find((c) => c.indicador.id === id)?.real ?? null

/** Cómo convirtió la etapa desde la anterior, total y por canal, frente al plan. */
function DesdeLaAnterior({
  etapa,
  etapas,
  punto,
  tasas,
}: {
  etapa: Indicador
  etapas: Indicador[]
  punto: PuntoDeSerie
  tasas: TasaDelPlan[]
}) {
  const posicion = etapas.findIndex((e) => e.id === etapa.id)
  const anterior = posicion > 0 ? etapas[posicion - 1] : undefined
  const total = anterior ? tasaEntre(tasas, anterior.id, etapa.id) : undefined

  // La boca del embudo no tiene etapa anterior: sus leads salen de la materia
  // prima de cada canal. Se enseñan las CVR que los generan, en el orden de
  // la tabla «Por canal» de al lado para que las filas se lean a la par.
  if (!anterior) {
    const deOrigen = TODOS_LOS_CANALES.flatMap((canal) =>
      tasas.filter((t) => t.canal === canal && t.hacia === `${etapa.id}.${canal}`),
    )
    if (deOrigen.length > 0) {
      return (
        <Seccion titulo="Tasas que generan los leads">
          <TablaTasas>
            {deOrigen.map((t) => (
              <FilaTasa
                key={t.id}
                nombre={t.nombre}
                real={tasaReal(realDe(punto, t.desde), realDe(punto, t.hacia))}
                plan={t.plan}
              />
            ))}
          </TablaTasas>
        </Seccion>
      )
    }
  }

  if (!anterior || !total) {
    return (
      <Seccion titulo="Desde la etapa anterior">
        <p className="text-sm text-muted-foreground">
          {anterior
            ? 'El plan no trae una tasa para este paso.'
            : 'Es la boca del embudo: no hay etapa anterior.'}
        </p>
      </Seccion>
    )
  }

  const porCanal = tasas.filter(
    (t) =>
      t.canal !== undefined &&
      t.desde === `${anterior.id}.${t.canal}` &&
      t.hacia === `${etapa.id}.${t.canal}` &&
      realDe(punto, t.desde) !== null,
  )

  return (
    <Seccion titulo={total.nombre}>
      <TablaTasas>
        {/* La global primero: la suma de los canales. Debajo, la misma tasa
            canal a canal (llamadas de Publicidad entre leads de Publicidad). */}
        <FilaTasa
          nombre={porCanal.length > 0 ? 'Todos los canales' : `De ${anterior.nombre.toLowerCase()}`}
          real={tasaReal(realDe(punto, anterior.id), realDe(punto, etapa.id))}
          plan={total.plan}
        />
        {porCanal.map((t) => (
          <FilaTasa
            key={t.id}
            nombre={t.canal ? NOMBRE_CANAL[t.canal] : t.nombre}
            real={tasaReal(realDe(punto, t.desde), realDe(punto, t.hacia))}
            plan={t.plan}
          />
        ))}
      </TablaTasas>
    </Seccion>
  )
}

/** La ficha de conversión abierta: cada paso del embudo, real frente a plan. */
function TasasDelEmbudo({
  etapas,
  punto,
  tasas,
}: {
  etapas: Indicador[]
  punto: PuntoDeSerie
  tasas: TasaDelPlan[]
}) {
  const pasos = etapas.slice(1).flatMap((hacia, i) => {
    const desde = etapas[i]
    const tasa = tasaEntre(tasas, desde.id, hacia.id)
    return tasa ? [{ tasa, desde, hacia }] : []
  })
  return (
    <Seccion titulo="Paso a paso" className="md:col-span-2">
      <TablaTasas>
        {pasos.map(({ tasa, desde, hacia }) => (
          <FilaTasa
            key={tasa.id}
            nombre={tasa.nombre}
            real={tasaReal(realDe(punto, desde.id), realDe(punto, hacia.id))}
            plan={tasa.plan}
          />
        ))}
      </TablaTasas>
    </Seccion>
  )
}
