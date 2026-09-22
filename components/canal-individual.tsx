'use client'

/**
 * El detalle de un canal, debajo de su diagrama de gasto a leads.
 *
 * La pestaña de un canal es la misma hoja que General con un solo canal
 * (`Canales`, `soloCanal`): arriba su gasto y sus leads contra el plan, con la
 * cinta entre los dos. Debajo va esto, que contesta la pregunta siguiente: si
 * el canal se quedó corto, ¿cuánto le costó y en qué paso se perdió?
 *
 * ── Los dos precios ─────────────────────────────────────────────────────
 * El coste por lead y el coste por venta, frente al plan, con su juicio (se
 * juzgan al revés: pasarse del plan es lo malo). El gasto y los leads no se
 * repiten: ya los dice el diagrama.
 *
 * ── La cadena ────────────────────────────────────────────────────────────
 * El mismo diagrama que la hoja «Variables» del Excel: cada paso con su cifra
 * real y su plan, y en cada flecha la tasa que convierte un paso en el
 * siguiente, real frente a la del plan. Publicidad: impresiones → clics →
 * leads → llamadas → ventas. Solo llevan tasa las flechas que el Excel tiene:
 * hacia ventas no hay tasa por canal y esa flecha va sola. Con un libro que
 * reparte Discoveries, entre llamadas y ventas va también ese paso.
 */

import { lecturaDe, puntoCalculado, puntoDeComparativa, type PuntoDeSerie, type PuntoFicha } from '@/components/graficos/fichas'
import { Semaforo } from '@/components/semaforo'
import { formatearCoste, formatearTasaConversion, formatearValor } from '@/lib/comparacion'
import { tasaEntre, tasaReal } from '@/lib/tasas'
import type { Canal, TasaDelPlan } from '@/lib/tipos'
import { cn } from '@/lib/utils'

/** La materia prima de cada canal antes de sus leads, en orden. */
const PREVIAS: Record<Canal, Array<{ id: string; nombre: string }>> = {
  publicidad: [
    { id: 'publicidad-impresiones', nombre: 'Impresiones' },
    { id: 'publicidad-clicks', nombre: 'Clics' },
  ],
  prospeccion: [{ id: 'prospeccion-contactos', nombre: 'Contactos' }],
  referidos: [{ id: 'referidos-contactos', nombre: 'Contactos' }],
  afiliados: [{ id: 'afiliados-contactos', nombre: 'Contactos' }],
  contenido: [{ id: 'contenido-visitas', nombre: 'Visitas' }],
  newsletter: [
    { id: 'newsletter-envios', nombre: 'Envíos' },
    { id: 'newsletter-aperturas', nombre: 'Aperturas' },
  ],
  interno: [],
}

const cantidad = (n: number) => formatearValor(n, 'cantidad')
const coste = (n: number) => formatearCoste(n)

export interface DetalleCanalProps {
  canal: Canal
  nombre: string
  /** Token del color del canal (su tono de la rampa de Canales). */
  color: string
  /** El periodo que se mira, con sus comparativas. */
  actual: PuntoDeSerie
  tasas: TasaDelPlan[]
}

export function DetalleCanal({ canal, nombre, color, actual, tasas }: DetalleCanalProps) {
  const buscar = (id: string) => actual.comparativas.find((c) => c.indicador.id === id)
  const punto = (id: string) => puntoDeComparativa(buscar(id))

  const gasto = buscar(`captacion.${canal}`)
  const leads = buscar(`eleads.${canal}`)
  const ventas = buscar(`ventas.${canal}`)

  const dividir = (a: number | null | undefined, b: number | null | undefined) =>
    a == null || b == null || b === 0 ? null : a / b
  const puntoPorLead = puntoCalculado(
    dividir(gasto?.meta, leads?.meta),
    dividir(gasto?.real, leads?.real),
    'menor-mejor',
  )
  const puntoPorVenta = puntoCalculado(
    dividir(gasto?.meta, ventas?.meta),
    dividir(gasto?.real, ventas?.real),
    'menor-mejor',
  )

  // La cadena: las variables previas del canal y, detrás, su embudo. Las
  // discoveries, solo si el libro las reparte por canal.
  const pasos = [
    ...PREVIAS[canal],
    { id: `eleads.${canal}`, nombre: 'Leads' },
    { id: `llamadas.${canal}`, nombre: 'Llamadas' },
    { id: `discoveries.${canal}`, nombre: 'Discoveries' },
    { id: `ventas.${canal}`, nombre: 'Ventas' },
  ].filter((p) => buscar(p.id) !== undefined)

  return (
    <>
      <div
        className="grid grid-cols-1 gap-px border-t @[30rem]:grid-cols-2"
        style={{ backgroundColor: 'var(--regla-fina)', borderColor: 'var(--regla-fina)' }}
      >
        <Cifra titulo="Coste por lead" punto={puntoPorLead} formatear={coste} />
        <Cifra titulo="Coste por venta" punto={puntoPorVenta} formatear={coste} />
      </div>

      <div className="border-t px-5 pt-5 pb-6" style={{ borderColor: 'var(--regla-fina)' }}>
        <h3 className="text-[0.8125rem] font-medium text-foreground">Paso a paso</h3>
        <div className="mt-4 overflow-x-auto pb-1">
          <ol aria-label={`Cadena de ${nombre}, del primer paso a la venta`} className="flex min-w-176 items-stretch">
            {pasos.map((paso, i) => {
              const siguiente = pasos[i + 1]
              const tasa = siguiente ? tasaEntre(tasas, paso.id, siguiente.id) : undefined
              return (
                <li key={paso.id} className="contents">
                  <Paso nombre={paso.nombre} punto={punto(paso.id)} />
                  {/* Sin tasa en el Excel (hacia ventas no la hay por canal),
                      la flecha va sola: no se inventa una cifra. */}
                  {siguiente && (
                    <Flecha
                      tasa={
                        tasa
                          ? {
                              nombre: tasa.nombre,
                              real: tasaReal(buscar(paso.id)?.real ?? null, buscar(siguiente.id)?.real ?? null),
                              plan: tasa.plan,
                            }
                          : null
                      }
                      color={color}
                    />
                  )}
                </li>
              )
            })}
          </ol>
        </div>
      </div>
    </>
  )
}

/** Un precio: nombre y juicio, la cifra y su plan. */
function Cifra({
  titulo,
  punto,
  formatear,
}: {
  titulo: string
  punto: PuntoFicha
  formatear: (n: number) => string
}) {
  const lectura = lecturaDe(formatear, 'frente', punto)
  return (
    <section className="bg-card px-5 pt-4 pb-5">
      <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1">
        <h3 className="text-[0.8125rem] font-medium text-foreground">{titulo}</h3>
        <Semaforo estado={punto.estado} cumplimiento={punto.cumplimiento} />
      </div>
      <p
        className={cn(
          'font-display mt-3 text-[2rem] leading-none font-normal tracking-[-0.02em] proportional-nums',
          lectura.apagada ? 'text-muted-foreground' : 'text-foreground',
        )}
      >
        {lectura.cifra}
      </p>
      <p className="mt-2 text-xs text-muted-foreground tabular-nums">{lectura.relacion}</p>
    </section>
  )
}

/** Un paso de la cadena: su cifra real y su plan, con el juicio. */
function Paso({ nombre, punto }: { nombre: string; punto: PuntoFicha }) {
  const lectura = lecturaDe(cantidad, 'de', punto)
  return (
    <div
      // Ancho suficiente para que quepa la palabra más larga del semáforo
      // («Mejor que el plan») sin partirla.
      className="flex min-w-38 flex-1 flex-col rounded-xl px-4 py-3"
      style={{ backgroundColor: 'color-mix(in oklab, var(--foreground) 3.5%, transparent)' }}
    >
      <span className="text-xs text-muted-foreground">{nombre}</span>
      <span
        className={cn(
          'font-display mt-1.5 text-[1.5rem] leading-none font-normal tracking-[-0.01em] proportional-nums',
          lectura.apagada ? 'text-muted-foreground' : 'text-foreground',
        )}
      >
        {lectura.cifra}
      </span>
      <span className="mt-1.5 text-xs text-muted-foreground tabular-nums">{lectura.relacion}</span>
      <Semaforo estado={punto.estado} cumplimiento={punto.cumplimiento} className="mt-2.5" />
    </div>
  )
}

/**
 * La flecha entre dos pasos: qué tasa es, la real encima y la del plan
 * debajo. Sin tasa del Excel para ese paso, solo la flecha.
 */
function Flecha({
  tasa,
  color,
}: {
  tasa: { nombre: string; real: number | null; plan: number | null } | null
  color: string
}) {
  return (
    <div className="flex w-30 shrink-0 flex-col items-center justify-center px-2 text-center">
      {tasa && (
        <>
          <span className="text-[0.6875rem] leading-tight text-muted-foreground">{tasa.nombre}</span>
          <span className="mt-1 text-sm font-semibold text-foreground tabular-nums">
            {formatearTasaConversion(tasa.real)}
          </span>
        </>
      )}
      <svg aria-hidden="true" viewBox="0 0 100 10" preserveAspectRatio="none" className="my-1 h-2.5 w-full">
        <line x1="2" x2="92" y1="5" y2="5" stroke={color} strokeWidth={1.5} vectorEffect="non-scaling-stroke" />
        <path d="M90 1 L98 5 L90 9" fill="none" stroke={color} strokeWidth={1.5} vectorEffect="non-scaling-stroke" strokeLinejoin="round" />
      </svg>
      {tasa && (
        <span className="text-[0.6875rem] text-muted-foreground tabular-nums">
          {tasa.plan === null ? 'sin plan' : `plan ${formatearTasaConversion(tasa.plan)}`}
        </span>
      )}
    </div>
  )
}
