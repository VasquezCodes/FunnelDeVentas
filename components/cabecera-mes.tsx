'use client'

/**
 * Cabecera del tablero: el título de la herramienta y, debajo, el mes con
 * sus cuatro cifras generales.
 *
 * ── Dos pisos, dos preguntas ─────────────────────────────────────────────
 * Arriba, qué es esto: «Funnel de ventas», en la serif de la casa y en el
 * cuerpo mayor de la página, con su entradilla y firmado por la raya de
 * marca. Es lo que no cambia.
 *
 * Abajo, cómo va el mes, en una fila de libro de cuentas. El mes encabeza la
 * fila —las cifras son suyas— y cada cifra lleva su plan debajo: un número
 * sin su plan no dice si es bueno o malo.
 *
 * Antes el mes iba enorme y el título en letra de etiqueta. Pero el mes ya
 * está en el selector de la barra, así que el cuerpo grande pasa al título;
 * el mes sigue siendo lo segundo que se lee, y lo que se anima al cambiar.
 *
 * ── Una rejilla con subrejillas ──────────────────────────────────────────
 * Cada cifra ocupa tres filas —etiqueta, cifra, plan— que comparte con las
 * demás por `subgrid`. Así las cifras quedan a la misma altura aunque la
 * etiqueta del ingreso lleve su semáforo, y el mes se sienta en la fila de
 * las cifras.
 *
 * ── Sin tarjeta ──────────────────────────────────────────────────────────
 * Se apoya directamente sobre el papel. Una cabecera no es un objeto aparte:
 * es el encabezamiento de la hoja.
 *
 * ── Un solo momento de movimiento ────────────────────────────────────────
 * Al cargar, el título sube por palabras y la raya de marca se traza; el mes
 * se revela por letras y las cifras cuentan hasta su valor. Al cambiar de
 * mes se repite solo lo que cambió —el mes y las cifras—, y ahí deja de ser
 * adorno: confirma que el cambio ocurrió.
 */

import { useRef } from 'react'

import type { Comparativa, Periodo } from '@/lib/tipos'
import { formatearValor } from '@/lib/comparacion'
import { MESES_LARGOS, capitalizar, marcaCobertura } from '@/lib/periodos'
import { cn } from '@/lib/utils'
import { Semaforo, varEstado } from '@/components/semaforo'
import { lecturaDe, puntoDeComparativa } from '@/components/graficos/fichas'
import { contarHasta, gsap, prefiereQuietud, SplitText, useGSAP } from '@/lib/animacion'

/**
 * Las cuatro cifras que resumen un mes. Ni una más: es una cabecera.
 *
 * El ingreso, los leads y las ventas son parte de su plan («de 145 del
 * plan»); la captación es un gasto y se compara con él («frente a…»), como
 * los costes de las fichas.
 */
const GENERALES: Array<{ id: string; etiqueta: string; relacion: 'de' | 'frente' }> = [
  { id: 'ingreso-total', etiqueta: 'Ingreso', relacion: 'de' },
  { id: 'eleads', etiqueta: 'Engaged leads', relacion: 'de' },
  { id: 'ventas', etiqueta: 'Ventas', relacion: 'de' },
  { id: 'captacion-total', etiqueta: 'Captación', relacion: 'frente' },
]

/**
 * Los filetes entre cifras, según cuántas columnas quepan. En dos columnas
 * (móvil) la rejilla es de dos por dos: un filete vertical en medio y uno
 * horizontal entre las filas. En cuatro, uno antes de cada cifra salvo la
 * primera. En la fila única, también antes de la primera: la separa del mes.
 */
const FILETES = [
  '@max-[36rem]:pb-4 @[72rem]:border-l @[72rem]:pl-6',
  'border-l pl-5 @max-[36rem]:pb-4 @[72rem]:pl-6',
  '@max-[36rem]:border-t @max-[36rem]:pt-4 @[36rem]:border-l @[36rem]:pl-5 @[72rem]:pl-6',
  'border-l pl-5 @max-[36rem]:border-t @max-[36rem]:pt-4 @[72rem]:pl-6',
]
/** El aire a la derecha de cada cifra: el mismo que a la izquierda del filete. */
const AIRE_DERECHO = 'pr-5 @[72rem]:pr-6'

export interface CabeceraMesProps {
  periodo: Periodo
  comparativas: Comparativa[]
}

export function CabeceraMes({ periodo, comparativas }: CabeceraMesProps) {
  const raiz = useRef<HTMLElement>(null)
  /** Cuándo entró la cabecera: al cargar, el mes espera a que entre el título. */
  const montadaEn = useRef<number | null>(null)
  const porId = new Map(comparativas.map((c) => [c.indicador.id, c]))

  const cifras = GENERALES.map(({ id, etiqueta, relacion }) => {
    const c = porId.get(id)
    const unidad = c?.indicador.unidad ?? ('cantidad' as const)
    const formatear = (n: number) => formatearValor(n, unidad)
    return {
      id,
      etiqueta,
      formatear,
      estado: c?.estado ?? ('sin-dato' as const),
      cumplimiento: c?.cumplimiento ?? null,
      // La cifra con su plan, en la misma frase que las fichas del embudo.
      lectura: lecturaDe(formatear, relacion, puntoDeComparativa(c)),
    }
  })

  // El nombre del mes va suelto para poder animarlo por letras; el año
  // acompaña en un cuerpo mucho menor. Siempre con mayúscula inicial:
  // MESES_LARGOS está en minúscula para poder usarlo dentro de una frase.
  // En una quincena, «2ª quincena» va encima y pequeño: en una sola línea
  // («2ª quincena · Septiembre 2026») el título se comía el ancho de las
  // cifras y el ingreso se salía por el borde.
  const nombreMes = capitalizar(MESES_LARGOS[periodo.mes - 1])

  // ── La entrada, al cargar ──────────────────────────────────────────────
  // El título, la raya de marca y las columnas no cambian con el mes: entran
  // una vez. Volver a animarlos en cada cambio sería ruido.
  useGSAP(
    () => {
      if (prefiereQuietud()) return

      const titulo = raiz.current?.querySelector<HTMLElement>('[data-titulo]')
      const entradilla = raiz.current?.querySelector<HTMLElement>('[data-entradilla]')
      const firma = raiz.current?.querySelector<HTMLElement>('[data-firma]')
      const filete = raiz.current?.querySelector<HTMLElement>('[data-filete]')
      const columnas = raiz.current?.querySelectorAll<HTMLElement>('[data-columna]')

      const linea = gsap.timeline({ defaults: { ease: 'power3.out' } })

      if (titulo) {
        // Por palabras y con máscara: cada palabra sube desde su renglón.
        const partido = SplitText.create(titulo, { type: 'words', aria: 'auto', mask: 'words' })
        linea.from(partido.words, { yPercent: 110, duration: 0.8, stagger: 0.07 })
      }
      if (entradilla) {
        linea.from(entradilla, { opacity: 0, y: 6, duration: 0.5 }, 0.3)
      }
      if (firma) {
        linea.from(firma, { scaleX: 0, duration: 0.45, ease: 'power2.out' }, 0.35)
      }
      if (filete) {
        // Arranca cuando la firma ya casi ha terminado: se lee como un solo
        // gesto que continúa, no como dos rayas que compiten.
        linea.from(filete, { scaleX: 0, duration: 0.85, ease: 'power2.inOut' }, 0.62)
      }
      if (columnas?.length) {
        linea.from(columnas, { opacity: 0, y: 8, duration: 0.45, stagger: 0.06 }, 0.55)
      }
    },
    { scope: raiz },
  )

  // ── El mes y sus cifras, en cada cambio de periodo ─────────────────────
  // `revertOnUpdate` deshace la partición de SplitText antes de volver a
  // partir, que si no se acumularía.
  useGSAP(
    () => {
      const nodos = cifras.map((_, i) =>
        raiz.current?.querySelector<HTMLElement>(`[data-cifra="${i}"]`),
      )

      // Con movimiento reducido: todo colocado, nada animado. Se escriben
      // las cifras y se sale. No es una versión pobre — es la misma página
      // sin el trayecto.
      if (prefiereQuietud()) {
        cifras.forEach((cifra, i) => {
          const nodo = nodos[i]
          if (nodo) nodo.textContent = cifra.lectura.cifra
        })
        return
      }

      // Al cargar, el mes espera a que el título haya entrado; al cambiar de
      // mes, entra en el acto. Se mide el tiempo y no «la primera vez»: en
      // desarrollo React monta dos veces, y la segunda ya no sería la primera.
      const ahora = performance.now()
      montadaEn.current ??= ahora
      const retraso = ahora - montadaEn.current < 1000 ? 0.4 : 0

      const nodoMes = raiz.current?.querySelector<HTMLElement>('[data-mes]')
      if (nodoMes) {
        // Se parte en letras Y palabras: solo letras puede romper la palabra
        // por cualquier sitio al ajustar el ancho.
        const partido = SplitText.create(nodoMes, {
          type: 'chars,words',
          // El lector de pantalla lee la etiqueta completa, no letra a letra.
          aria: 'auto',
          mask: 'chars',
        })
        gsap.from(partido.chars, {
          yPercent: 115,
          duration: 0.75,
          stagger: 0.022,
          ease: 'power3.out',
          delay: retraso,
        })
      }

      cifras.forEach((cifra, i) => {
        const nodo = nodos[i]
        if (!nodo) return
        if (cifra.lectura.valor === null) {
          nodo.textContent = cifra.lectura.cifra
          return
        }
        contarHasta(nodo, cifra.lectura.valor, cifra.formatear, {
          duracion: 1.0,
          retraso: retraso + 0.1 + i * 0.06,
        })
      })
    },
    { scope: raiz, dependencies: [periodo.id], revertOnUpdate: true },
  )

  return (
    <header ref={raiz} className="pt-3 pb-1 sm:pt-6">
      {/* ── El título ─────────────────────────────────────────────────── */}
      <h1
        data-titulo
        className="font-display text-[clamp(2.25rem,1.2rem+3.4vw,3.5rem)] leading-none font-semibold tracking-[-0.03em]"
      >
        Funnel de ventas
      </h1>
      <p data-entradilla className="mt-3 text-base text-muted-foreground sm:text-[1.0625rem]">
        Plan de negocio frente al resultado real
      </p>

      {/* ── Firma ─────────────────────────────────────────────────────
          Dos tramos: uno corto en carmín de marca y el resto neutro. Es el
          recurso de identidad clásico —una raya de marca que firma el
          título— y es lo único de la cabecera que lleva el carmín, así que
          no compite con ninguna cifra.

          Se traza al cargar, primero el carmín y luego el resto: la marca
          firma y después se extiende la línea. */}
      <div aria-hidden="true" className="mt-6 flex w-full items-center sm:mt-7">
        <div
          data-firma
          className="h-0.5 w-14 origin-left rounded-full"
          style={{ backgroundColor: 'var(--brand)' }}
        />
        <div
          data-filete
          className="h-px flex-1 origin-left"
          style={{ backgroundColor: 'var(--regla)' }}
        />
      </div>

      {/* ── La fila del mes ─────────────────────────────────────────── */}
      <div className="@container mt-6 sm:mt-7">
        <dl className="grid grid-cols-2 @[36rem]:grid-cols-4 @[72rem]:grid-cols-[auto_repeat(4,minmax(0,1fr))]">
          {/* El mes encabeza la fila. Con sitio, se sienta en la fila de las
              cifras; si no cabe, va encima de ellas. */}
          <div className="col-span-full pb-5 @[72rem]:col-span-1 @[72rem]:row-span-3 @[72rem]:grid @[72rem]:grid-rows-subgrid @[72rem]:pr-8 @[72rem]:pb-0">
            <dt className="sr-only">Periodo</dt>
            <dd className="self-end @[72rem]:row-start-2">
              {periodo.tipo === 'quincena' && (
                <span className="mb-2 block text-sm leading-none font-medium text-muted-foreground sm:text-base">
                  {periodo.quincena}ª quincena
                </span>
              )}
              <span className="flex items-baseline gap-x-2.5">
              {/*
                La `key` es obligatoria y no es una optimización.

                SplitText sustituye el contenido de este nodo por un span por
                letra. React, que cree tener ahí un nodo de texto, al cambiar
                de mes intenta actualizar algo que GSAP ya reescribió, no lo
                encuentra y el nombre del mes se queda congelado en el
                anterior. (`revertOnUpdate` no basta: la limpieza del efecto
                corre DESPUÉS del render, así que restaura el texto viejo justo
                cuando React acababa de intentar poner el nuevo.)

                Con una key distinta por periodo, React desmonta el nodo y
                monta uno limpio: GSAP siempre parte un elemento recién nacido
                con el texto correcto.
              */}
              <span
                key={periodo.id}
                data-mes
                className="font-display block text-[clamp(1.625rem,1.1rem+2.2vw,2.625rem)] leading-[0.92] font-semibold tracking-tight"
                // SplitText avisa: `text-wrap: balance` interfiere con el
                // reparto en líneas, así que aquí se desactiva.
                style={{ textWrap: 'nowrap', fontKerning: 'none' }}
              >
                {nombreMes}
              </span>
              <span className="text-base leading-none font-medium text-muted-foreground tabular-nums sm:text-lg">
                {periodo.anio}
              </span>
              {/* Un mes a medias se lee «a la fecha»: la marca lo dice para
                  que nadie lo confunda con un mes cerrado. */}
              {marcaCobertura(periodo) && (
                <span className="text-sm leading-none text-muted-foreground sm:text-base">
                  · {marcaCobertura(periodo)}
                </span>
              )}
              </span>
            </dd>
          </div>

          {cifras.map((cifra, i) => (
            <div
              key={cifra.id}
              data-columna
              className={cn('row-span-3 grid min-w-0 grid-rows-subgrid', AIRE_DERECHO, FILETES[i])}
              style={{ borderColor: 'var(--regla-fina)' }}
            >
              <dt className="flex min-h-6 flex-wrap items-center justify-between gap-x-2 gap-y-1 text-[0.8125rem] font-medium text-muted-foreground">
                {cifra.etiqueta}
                {/* El ingreso es el veredicto del mes: lleva su semáforo, con
                    icono y palabra. Las demás son cifras, no juicios. */}
                {cifra.id === 'ingreso-total' && (
                  <Semaforo
                    estado={cifra.estado}                    cumplimiento={cifra.cumplimiento}
                    tamano="sm"
                  />
                )}
              </dt>
              <dd
                data-cifra={i}
                // El cuerpo sigue al ancho de la cabecera (cqi), no al de la
                // ventana: con el panel del mes al lado, «$101,082» tiene que
                // caber en su columna. Nunca se parte.
                className="font-display mt-2 self-end text-[clamp(1.375rem,2.2cqi,2rem)] leading-none font-semibold whitespace-nowrap tabular-nums"
                style={{
                  color: cifra.lectura.apagada
                    ? 'var(--muted-foreground)'
                    : cifra.id === 'ingreso-total'
                      ? varEstado(cifra.estado)
                      : undefined,
                }}
              >
                {/* El valor lo escribe GSAP. Este es el fotograma del
                    servidor: ya trae la cifra final, así que si el JS no
                    llega nunca, la cabecera sigue diciendo la verdad. */}
                {cifra.lectura.cifra}
              </dd>
              <dd className="mt-2 text-[0.8125rem] leading-snug text-muted-foreground tabular-nums">
                {cifra.lectura.relacion}
              </dd>
            </div>
          ))}
        </dl>
      </div>
    </header>
  )
}
