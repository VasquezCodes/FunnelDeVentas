'use client'

/**
 * Captura manual de los valores REALES de un periodo.
 *
 * Es la pantalla donde una persona se sienta con el informe de HighLevel
 * delante y teclea lo que de verdad pasó. Tres decisiones la gobiernan:
 *
 *  1. LA META SIEMPRE A LA VISTA, en gris y de solo lectura. Capturar a
 *     ciegas y descubrir después que se falló el plan es peor que verlo
 *     mientras se teclea: quien captura suele ser quien puede explicar el
 *     desvío, y lo explica mejor en caliente.
 *
 *  2. FEEDBACK EN VIVO. Desviación, cumplimiento y semáforo se recalculan
 *     en cada pulsación con el mismo motor puro que pinta el tablero
 *     (`compararIndicador`), no con una fórmula duplicada aquí. Si el
 *     tablero y esta pantalla difirieran, nadie confiaría en ninguno.
 *
 *  3. VACÍO NO ES CERO. Un indicador sin capturar se guarda como ausente,
 *     nunca como 0: un 0 es un dato («no hubo cierres») y contamina el
 *     semáforo y las medias. Por eso el guardado avisa de los huecos pero
 *     no bloquea: un periodo a medio capturar es un estado legítimo.
 *
 * Sin base de datos todavía: el estado vive en `useState` y sale por el
 * callback `onGuardar`. Cuando exista persistencia, este componente no
 * cambia — cambia quién le pasa `onGuardar`.
 */

import { useId, useMemo, useState } from 'react'
import {
  ArrowsClockwiseIcon,
  CheckIcon,
  PencilSimpleLineIcon,
  WarningIcon,
} from '@phosphor-icons/react/ssr'
import { toast } from 'sonner'

import type { Indicador, Meta, Periodo, Real } from '@/lib/tipos'
import {
  SIN_DATO,
  compararIndicador,
  formatearCumplimiento,
  formatearDesviacion,
  formatearValor,
} from '@/lib/comparacion'
import { Semaforo } from '@/components/semaforo'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'

// ── Utilidades de entrada ───────────────────────────────────────────────

/**
 * Lo que se admite mientras se teclea: dígitos y como mucho un separador
 * decimal con dos cifras. No hay signo menos, ni notación científica, ni
 * separador de millares.
 *
 * La validación «solo números >= 0» se aplica AL TECLEAR, no al guardar:
 * una tecla que no cabe simplemente no entra. Un mensaje de error a
 * posteriori obliga a leer, entender y corregir; un campo que nunca llega
 * a estar mal no obliga a nada.
 */
const PATRON_ENTRADA = /^\d*(?:[.,]\d{0,2})?$/

/**
 * Texto del campo → número del dominio. Devuelve null para el campo vacío
 * (y para un separador suelto, estado intermedio real al teclear «,5»).
 * Se acepta la coma decimal porque es la que trae el teclado en español.
 */
function aNumero(texto: string): number | null {
  const limpio = texto.trim().replace(',', '.')
  if (limpio === '' || limpio === '.') return null
  const valor = Number(limpio)
  return Number.isFinite(valor) && valor >= 0 ? valor : null
}

/** Registros existentes → borrador editable, indexado por indicador. */
function aBorrador(reales: readonly Real[]): Record<string, string> {
  const borrador: Record<string, string> = {}
  for (const real of reales) {
    borrador[real.indicadorId] = Number.isFinite(real.valor) ? String(real.valor) : ''
  }
  return borrador
}

/** Hairline: nunca un gris de 1px genérico, siempre mezclado con el fondo. */
const HAIRLINE = 'border-[color-mix(in_oklab,var(--foreground)_7%,transparent)]'

/** Rejilla compartida por la cabecera y por cada fila: una sola verdad. */
const REJILLA =
  'grid grid-cols-[minmax(11rem,1fr)_5.5rem_8rem_6.5rem_5.5rem_9.5rem] items-center gap-x-3'

// ── Props ───────────────────────────────────────────────────────────────

interface CapturaManualProps {
  periodo: Periodo
  indicadores: Indicador[]
  metas: Meta[]
  realesIniciales: Real[]
  onGuardar: (valores: Real[]) => void
}

// ── Componente ──────────────────────────────────────────────────────────

export function CapturaManual({
  periodo,
  indicadores,
  metas,
  realesIniciales,
  onGuardar,
}: CapturaManualProps) {
  const prefijoId = useId()

  const [borrador, setBorrador] = useState<Record<string, string>>(() =>
    aBorrador(realesIniciales),
  )

  /**
   * Al cambiar de periodo hay que recargar el borrador. Se hace ajustando
   * el estado durante el render (patrón oficial de React para estado
   * derivado de props) en vez de con un efecto: así no se pinta ni un
   * fotograma con las cifras del periodo anterior bajo el título del
   * nuevo, que es exactamente el error que haría capturar datos cruzados.
   */
  const [periodoSincronizado, setPeriodoSincronizado] = useState(periodo.id)
  const [intentoGuardar, setIntentoGuardar] = useState(false)
  if (periodoSincronizado !== periodo.id) {
    setPeriodoSincronizado(periodo.id)
    setBorrador(aBorrador(realesIniciales))
    setIntentoGuardar(false)
  }

  const metaPorIndicador = useMemo(() => {
    const mapa = new Map<string, number>()
    for (const meta of metas) mapa.set(meta.indicadorId, meta.valor)
    return mapa
  }, [metas])

  /**
   * Una fila por indicador, ya comparada. Se recalcula en cada pulsación:
   * son siete divisiones, no hay nada que memorizar y sí mucho que perder
   * si el semáforo va un carácter por detrás de lo que se ve escrito.
   */
  const filas = indicadores.map((indicador) => {
    const texto = borrador[indicador.id] ?? ''
    const valor = aNumero(texto)
    const meta = metaPorIndicador.get(indicador.id) ?? null
    return {
      indicador,
      texto,
      valor,
      meta,
      comparativa: compararIndicador(indicador, meta, valor),
      idInput: `${prefijoId}-${indicador.id}`,
    }
  })

  const capturados = filas.filter((fila) => fila.valor !== null).length
  const pendientes = filas.length - capturados

  function escribir(indicadorId: string, texto: string) {
    // Una entrada que no encaja se descarta entera: el campo se queda como
    // estaba y el cursor no salta. Nunca se guarda un valor inválido.
    if (!PATRON_ENTRADA.test(texto)) return
    setBorrador((anterior) => ({ ...anterior, [indicadorId]: texto }))
  }

  function guardar() {
    setIntentoGuardar(true)

    const capturadoEn = new Date().toISOString()

    // Solo viajan los indicadores con dato. Los huecos se quedan fuera del
    // array: ausencia de registro es ausencia de dato, no un cero.
    const valores: Real[] = filas
      .filter((fila): fila is typeof fila & { valor: number } => fila.valor !== null)
      .map((fila) => ({
        periodoId: periodo.id,
        indicadorId: fila.indicador.id,
        valor: fila.valor,
        origen: 'manual' as const,
        capturadoEn,
      }))

    onGuardar(valores)

    toast.success('Periodo guardado', {
      description:
        pendientes === 0
          ? `${periodo.etiqueta} · ${capturados} indicadores capturados.`
          : `${periodo.etiqueta} · ${capturados} capturados, ${pendientes} sin dato todavía.`,
    })
  }

  return (
    <section className="bandeja aparecer">
      <div className="nucleo">
        <form
          onSubmit={(evento) => {
            evento.preventDefault()
            guardar()
          }}
          noValidate
        >
          {/* ── Cabecera ─────────────────────────────────────────────── */}
          <header
            className={`flex flex-wrap items-end justify-between gap-x-6 gap-y-3 border-b px-5 py-4 ${HAIRLINE}`}
          >
            <div>
              {/* El mismo lápiz que el botón de la barra: el modo se reconoce
                  igual allí que aquí. */}
              <p className="eyebrow flex items-center gap-1.5">
                <PencilSimpleLineIcon
                  weight="duotone"
                  aria-hidden="true"
                  className="size-3.5 shrink-0 text-brand"
                />
                Captura manual
              </p>
              <h2 className="font-display mt-1 text-2xl leading-none tracking-tight text-foreground">
                {periodo.etiqueta}
              </h2>
              <p className="mt-1.5 text-xs text-muted-foreground">
                {periodo.tipo === 'quincena' ? 'Quincena' : 'Mes'} · resultado real frente al plan
              </p>
            </div>

            <p className="text-xs text-muted-foreground">
              <span className="cifra text-base text-foreground">{capturados}</span>
              <span className="cifra"> / {filas.length}</span> indicadores capturados
            </p>
          </header>

          {/* ── Rejilla de captura ───────────────────────────────────────
              El contenedor scrollea en horizontal; el body nunca. */}
          <div className="overflow-x-auto">
            <div className="min-w-[46rem]">
              <div
                className={`${REJILLA} border-b px-5 py-2 ${HAIRLINE}`}
                role="presentation"
              >
                <span className="eyebrow">Indicador</span>
                <span className="eyebrow text-right">Meta</span>
                <span className="eyebrow text-right">Real</span>
                <span className="eyebrow text-right">Desviación</span>
                <span className="eyebrow text-right">Cumpl.</span>
                <span className="eyebrow">Estado</span>
              </div>

              <div>
                {filas.map((fila) => {
                  const { indicador, comparativa } = fila
                  const vacio = fila.valor === null
                  const avisarVacio = vacio && intentoGuardar
                  const idAyuda = `${fila.idInput}-ayuda`

                  return (
                    <div
                      key={indicador.id}
                      className={`${REJILLA} border-b px-5 py-2 transition-colors duration-200 [transition-timing-function:var(--ease-fluid)] last:border-b-0 hover:bg-muted/50 ${HAIRLINE}`}
                    >
                      {/* Nombre = etiqueta del campo: al hacer clic, foco al input. */}
                      <Label
                        htmlFor={fila.idInput}
                        title={indicador.definicion}
                        className="cursor-pointer text-sm font-medium text-foreground"
                      >
                        {indicador.nombre}
                      </Label>

                      {/* Meta: referencia, gris, jamás editable. */}
                      <span className="cifra text-right text-sm text-muted-foreground">
                        {formatearValor(fila.meta, indicador.unidad)}
                      </span>

                      {/* Real: el único campo que se toca. */}
                      <div className="relative">
                        {indicador.unidad === 'moneda' && (
                          <span
                            aria-hidden="true"
                            className="cifra pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-xs text-muted-foreground"
                          >
                            $
                          </span>
                        )}
                        {indicador.unidad === 'porcentaje' && (
                          <span
                            aria-hidden="true"
                            className="cifra pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 text-xs text-muted-foreground"
                          >
                            %
                          </span>
                        )}
                        <Input
                          id={fila.idInput}
                          /*
                           * type="text" con inputMode="decimal" y no
                           * type="number": el campo numérico nativo admite
                           * «e», «+» y «-», y sobre todo cambia el valor con
                           * la rueda del ratón al pasar por encima. En una
                           * pantalla de captura eso es corromper un dato sin
                           * que nadie lo note. El teclado del móvil sigue
                           * saliendo numérico gracias a inputMode.
                           */
                          type="text"
                          inputMode="decimal"
                          autoComplete="off"
                          value={fila.texto}
                          onChange={(evento) => escribir(indicador.id, evento.target.value)}
                          placeholder={SIN_DATO}
                          aria-describedby={idAyuda}
                          aria-invalid={avisarVacio || undefined}
                          className={`cifra text-right tabular-nums ${
                            indicador.unidad === 'moneda' ? 'pl-6' : ''
                          } ${indicador.unidad === 'porcentaje' ? 'pr-6' : ''} ${
                            avisarVacio
                              ? 'border-estado-alerta/60 bg-[var(--estado-alerta-suave)]'
                              : ''
                          }`}
                        />
                      </div>

                      {/*
                       * Desviación y cumplimiento en color de texto neutro,
                       * nunca en color de estado: el juicio lo emite el
                       * semáforo y lo emite una sola vez. Dos elementos
                       * diciendo lo mismo en rojo convierten una fila floja
                       * en una alarma.
                       */}
                      <span className="cifra text-right text-sm text-foreground">
                        {formatearDesviacion(comparativa.desviacion, indicador.unidad)}
                      </span>
                      <span className="cifra text-right text-sm text-muted-foreground">
                        {formatearCumplimiento(comparativa.cumplimiento)}
                      </span>

                      <span id={idAyuda} className="min-w-0">
                        <Semaforo estado={comparativa.estado} />
                      </span>
                    </div>
                  )
                })}
              </div>
            </div>
          </div>

          {/* ── Pie: aviso de huecos, nota de fase 2 y acción ─────────── */}
          <footer className={`flex flex-wrap items-center justify-between gap-4 border-t px-5 py-4 ${HAIRLINE}`}>
            <div className="max-w-md space-y-2">
              {/* El aviso solo aparece tras intentar guardar. Antes sería
                  regañar a alguien por no haber terminado de escribir. */}
              {intentoGuardar && pendientes > 0 && (
                <p
                  role="status"
                  className="flex items-start gap-2 text-xs text-[var(--estado-alerta)]"
                >
                  <WarningIcon
                    weight="duotone"
                    aria-hidden="true"
                    className="mt-px size-3.5 shrink-0"
                  />
                  <span>
                    <span className="cifra">{pendientes}</span>{' '}
                    {pendientes === 1 ? 'indicador queda' : 'indicadores quedan'} sin dato. Se ha
                    guardado igual: podrás completarlo más adelante.
                  </span>
                </p>
              )}

              <p className="flex items-start gap-2 text-xs leading-relaxed text-muted-foreground">
                {/* Flechas en círculo y no una «i»: lo que anuncia la nota es
                    la sincronización con el CRM, y el icono lo dice antes de
                    leerla. */}
                <ArrowsClockwiseIcon
                  weight="duotone"
                  aria-hidden="true"
                  className="mt-px size-3.5 shrink-0 text-brand"
                />
                <span>
                  Los valores capturados aquí se sustituirán por la sincronización automática con
                  el CRM en la fase 2. La captura manual quedará como respaldo.
                </span>
              </p>
            </div>

            {/*
             * Botón dentro de botón: el círculo del icono es una pieza
             * propia pegada al borde interior. Al pasar el ratón se desplaza
             * 2 px en diagonal y escala un 5 % — solo transform y opacidad,
             * nada que provoque relayout.
             */}
            <button
              type="submit"
              className="group/guardar relative inline-flex h-11 shrink-0 items-center rounded-full bg-brand pl-5 pr-12 text-sm font-medium text-primary-foreground shadow-[var(--sombra-tray)] transition-[transform,background-color] duration-300 [transition-timing-function:var(--ease-fluid)] outline-none hover:bg-[var(--brand-strong)] focus-visible:ring-3 focus-visible:ring-ring/50 active:scale-[0.98]"
            >
              Guardar periodo
              <span
                aria-hidden="true"
                className="absolute right-2 grid h-7 w-7 place-items-center rounded-full bg-primary-foreground/15 transition-transform duration-300 [transition-timing-function:var(--ease-fluid)] group-hover/guardar:translate-x-0.5 group-hover/guardar:-translate-y-0.5 group-hover/guardar:scale-105"
              >
                <CheckIcon weight="bold" className="size-3.5" />
              </span>
            </button>
          </footer>
        </form>
      </div>
    </section>
  )
}

export default CapturaManual
