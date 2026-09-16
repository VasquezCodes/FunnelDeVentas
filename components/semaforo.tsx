/**
 * Semáforo de estado.
 *
 * Regla no negociable del tablero: **el color nunca viaja solo**. Cerca del
 * 8 % de los hombres no distingue el rojo del verde, así que cada estado se
 * codifica tres veces —color, forma y texto— y cualquiera de las tres basta
 * para leerlo. Si algún día hay que quitar algo por espacio, se quita el
 * color, nunca el texto.
 *
 * ── Sin píldora ──────────────────────────────────────────────────────────
 * Fue una píldora tintada con borde, icono, palabra, separador y cifra: la
 * insignia de estado de cualquier kit, y el usuario la rechazó por eso. Ahora
 * es una anotación, como las de un informe de dirección: una marca maciza
 * con la forma del estado, la palabra en su color y la cifra en tinta. Sin
 * fondo, sin borde y sin separador: se lee en línea con el texto que anota.
 *
 * ── Una sola voz ─────────────────────────────────────────────────────────
 * Las palabras son las de `ETIQUETAS_ESTADO` ('@/lib/comparacion'): En
 * plan, Al límite, Fuera de plan y Sin dato, en el tablero y en la captura.
 * Hablan de *plan*, no de calidad: el tablero compara contra un plan de
 * negocio, y «fuera de plan» describe un hecho mientras que «crítico»
 * emitiría un juicio que el dato solo no sostiene. Hubo un segundo juego en
 * los gráficos —«En objetivo», «En riesgo», «Crítico»—; al unificar, el
 * usuario prefirió este. Por eso el semáforo no acepta una palabra propia.
 *
 * No lleva 'use client': no tiene estado ni escucha eventos, así que se
 * renderiza en el servidor y no añade un gramo de JavaScript al cliente.
 */

import { cn } from 'cn'

import { ETIQUETAS_ESTADO, formatearCumplimiento } from '@/lib/comparacion'
import type { Estado } from '@/lib/tipos'

// ── Tokens ──────────────────────────────────────────────────────────────

/**
 * Nombre del token CSS de color fuerte de cada estado.
 *
 * Se expone como función (y no como clase de Tailwind) porque Tailwind
 * compila las clases que encuentra escritas *literalmente* en el código:
 * una clase construida al vuelo —`text-estado-${estado}`— no existiría en
 * el CSS final. Además, varios componentes necesitan el VALOR del color y no
 * una clase, porque lo escriben en estilos en línea, a menudo mezclado con
 * `color-mix`: los fondos de tarjeta-kpi, veredicto, canales, cabecera-mes y
 * filas-comparadas, y el color del propio Semaforo. (Los gráficos no: dentro
 * del trazado no entra ningún color de estado.) Un único mapa aquí evita que
 * cada componente reinvente la correspondencia estado → color.
 *
 * 'sin-dato' cae en --estado-neutro: gris deliberado, para que la ausencia
 * de dato no parezca un juicio.
 */
const TOKEN_FUERTE: Record<Estado, string> = {
  ok: '--estado-ok',
  alerta: '--estado-alerta',
  critico: '--estado-critico',
  'sin-dato': '--estado-neutro',
}

/**
 * Token del fondo suave de cada estado. 'sin-dato' usa --muted porque no
 * existe (ni hace falta) un `--estado-neutro-suave`: la ausencia de dato se
 * apoya en la superficie neutra del chasis.
 */
const TOKEN_SUAVE: Record<Estado, string> = {
  ok: '--estado-ok-suave',
  alerta: '--estado-alerta-suave',
  critico: '--estado-critico-suave',
  'sin-dato': '--muted',
}

/** Nombre del token CSS del color fuerte: 'ok' → '--estado-ok'. */
export function colorEstado(estado: Estado): string {
  return TOKEN_FUERTE[estado]
}

/** El mismo token ya envuelto para usar como valor: 'ok' → 'var(--estado-ok)'. */
export function varEstado(estado: Estado): string {
  return `var(${TOKEN_FUERTE[estado]})`
}

/** Fondo suave listo para usar: 'ok' → 'var(--estado-ok-suave)'. */
export function varEstadoSuave(estado: Estado): string {
  return `var(${TOKEN_SUAVE[estado]})`
}

// ── Marca ───────────────────────────────────────────────────────────────

/**
 * Cada estado con su silueta, maciza y pequeña: círculo en plan, triángulo
 * al límite, cuadrado fuera de plan y círculo hueco sin dato. Es la
 * convención de los informes que marcan el rojo, el ámbar y el verde con
 * forma además de color: la forma sola ya los separa, sin color y sin texto.
 *
 * Las siluetas no ocupan lo mismo a propósito. A igual caja, un triángulo se
 * ve menor que un círculo y un cuadrado, mayor: cada una está ajustada para
 * que las tres pesen lo mismo a la vista.
 */
function Marca({ estado, lado }: { estado: Estado; lado: string }) {
  return (
    <svg
      viewBox="0 0 10 10"
      aria-hidden="true"
      className="shrink-0"
      style={{ width: lado, height: lado }}
      fill="currentColor"
    >
      {estado === 'ok' && <circle cx="5" cy="5" r="4.5" />}
      {/* El trazo del mismo color redondea las puntas: a este tamaño, un
          triángulo de esquinas vivas se pixela. */}
      {estado === 'alerta' && (
        <path d="M5 0.7 9.6 8.9 0.4 8.9Z" stroke="currentColor" strokeWidth="0.9" strokeLinejoin="round" />
      )}
      {estado === 'critico' && <rect x="1.1" y="1.1" width="7.8" height="7.8" rx="0.6" />}
      {estado === 'sin-dato' && (
        <circle cx="5" cy="5" r="3.9" fill="none" stroke="currentColor" strokeWidth="1.4" />
      )}
    </svg>
  )
}

// ── Componente ──────────────────────────────────────────────────────────

export interface SemaforoProps {
  estado: Estado
  /**
   * Fracción real/meta (0.78 = 78 %). Si es null —o si se omite— el semáforo
   * se queda en marca + palabra y no imprime cifra. Es opcional porque hay
   * sitios (la fila de captura manual, por ejemplo) donde el porcentaje ya
   * está a dos centímetros y repetirlo es ruido.
   */
  cumplimiento?: number | null
  /** 'sm' para rejillas densas y tablas · 'md' para la tarjeta destacada. */
  tamano?: 'sm' | 'md'
  className?: string
}

export function Semaforo({ estado, cumplimiento = null, tamano = 'sm', className }: SemaforoProps) {
  const hayCumplimiento =
    cumplimiento !== null && cumplimiento !== undefined && Number.isFinite(cumplimiento)
  const pequeno = tamano === 'sm'

  return (
    <span
      className={cn(
        'inline-flex shrink-0 items-center whitespace-nowrap',
        pequeno ? 'text-xs' : 'text-[0.8125rem]',
        // Después del tamaño: `cn` fusiona como tailwind-merge y un tamaño
        // escrito detrás anularía el interlineado.
        'leading-none',
        className,
      )}
    >
      {/* La marca y la palabra, en el color del estado. El texto es la
          codificación que sobrevive a cualquier daltonismo, a una impresión
          en blanco y negro y a un lector de pantalla. */}
      <span
        className={cn('inline-flex items-center font-medium', pequeno ? 'gap-1.5' : 'gap-2')}
        style={{ color: varEstado(estado) }}
      >
        <Marca estado={estado} lado={pequeno ? '0.4375rem' : '0.5rem'} />
        {ETIQUETAS_ESTADO[estado]}
      </span>

      {hayCumplimiento && (
        // La cifra en tinta, como el resto de cifras de la hoja: el juicio lo
        // pone la palabra; el número es un dato. Tabular, para que al cambiar
        // de periodo no cambie de ancho ni dé un salto.
        <span className={cn('text-foreground tabular-nums', pequeno ? 'ml-2' : 'ml-2.5')}>
          {formatearCumplimiento(cumplimiento)}
        </span>
      )}
    </span>
  )
}
