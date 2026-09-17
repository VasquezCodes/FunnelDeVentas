'use client'

/**
 * El libro del plan que se está usando, y cómo cambiarlo.
 *
 * El plan de negocio se cierra cada mes en un libro nuevo («Plan de Negocio
 * 0726») y a veces trae filas nuevas. Desde aquí se pega el enlace del libro
 * nuevo: se comprueba la forma en el navegador, se pide la contraseña de
 * captura y el servidor lo abre y lo lee entero antes de aceptarlo. Si no se
 * puede usar, se dice por qué y el tablero sigue con el plan de antes.
 *
 * El enlace en uso no se enseña: basta el nombre del libro, y así la ruta
 * interna de SharePoint no viaja a la página.
 */

import { startTransition, useId, useState, useTransition } from 'react'
import { FileSpreadsheet } from 'lucide-react'
import { WarningIcon } from '@phosphor-icons/react/ssr'
import { toast } from 'sonner'

import { cambiarPlan, type ResultadoCambioPlan } from '@/app/captura/acciones'
import { DialogoClave } from '@/components/dialogo-clave'
import { IconoEnPastilla } from '@/components/graficos/hoja'
import { Input } from '@/components/ui/input'
import { limpiarEnlace } from '@/lib/plan/enlace-valido'
import { cn } from '@/lib/utils'

const FECHA = new Intl.DateTimeFormat('es-ES', { day: 'numeric', month: 'short', year: 'numeric' })

export interface PlanDeNegocioProps {
  /** Nombre del libro en uso: «Plan de Negocio 0426.xlsm». */
  libro: string | null
  /** Última modificación del libro, en ISO. */
  modificadoEn: string | null
  /** Por qué no se puede cambiar ahora (cambios sin guardar), o null. */
  bloqueo: string | null
}

export function PlanDeNegocio({ libro, modificadoEn, bloqueo }: PlanDeNegocioProps) {
  const id = useId()
  const [editando, setEditando] = useState(false)
  const [enlace, setEnlace] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [pidiendoClave, setPidiendoClave] = useState(false)
  const [errorClave, setErrorClave] = useState<string | null>(null)
  const [cambiando, iniciarCambio] = useTransition()

  const cerrar = () => {
    setEditando(false)
    setEnlace('')
    setError(null)
  }

  function confirmar(clave: string) {
    setErrorClave(null)
    const url = enlace
    // En una transición, como guardar cifras: el cuadro sigue abierto hasta
    // que el tablero se ha vuelto a pintar con el plan nuevo.
    iniciarCambio(async () => {
      let resultado: ResultadoCambioPlan
      try {
        resultado = await cambiarPlan({ url, clave })
      } catch {
        resultado = { ok: false, motivo: 'servidor', mensaje: 'No se pudo conectar con el servidor. Inténtalo de nuevo.' }
      }
      startTransition(() => {
        if (!resultado.ok) {
          if (resultado.motivo === 'clave') {
            setErrorClave(resultado.mensaje)
            return
          }
          setPidiendoClave(false)
          setError(resultado.mensaje)
          return
        }
        setPidiendoClave(false)
        cerrar()
        toast.success('Plan actualizado', {
          description: `${resultado.libro}: ${resultado.meses} meses, de ${resultado.desde} a ${resultado.hasta}.`,
        })
      })
    })
  }

  return (
    <div className="px-6 pt-5">
      <div
        className="flex flex-wrap items-center justify-between gap-x-4 gap-y-3 rounded-xl px-4 py-3"
        style={{ backgroundColor: 'color-mix(in oklab, var(--foreground) 3%, transparent)' }}
      >
        <div className="flex min-w-0 items-center gap-3">
          <IconoEnPastilla Icono={FileSpreadsheet} color="var(--metrica-verde)" />
          <div className="min-w-0">
            <p className="text-xs text-muted-foreground">Plan de negocio</p>
            <p className="flex min-w-0 items-baseline gap-x-2.5">
              <span className="truncate text-sm font-medium text-foreground">{libro ?? 'Sin libro'}</span>
              {modificadoEn && (
                <span className="hidden shrink-0 text-xs text-muted-foreground sm:inline">
                  modificado el {FECHA.format(new Date(modificadoEn))}
                </span>
              )}
            </p>
          </div>
        </div>

        {!editando && (
          <button
            type="button"
            disabled={bloqueo !== null}
            title={bloqueo ?? undefined}
            onClick={() => setEditando(true)}
            className="h-9 shrink-0 rounded-full border px-4 text-sm font-medium text-foreground transition-colors duration-150 hover:bg-[color-mix(in_oklab,var(--foreground)_5%,transparent)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring disabled:cursor-not-allowed disabled:opacity-50"
            style={{ borderColor: 'var(--regla)' }}
          >
            Cambiar libro
          </button>
        )}
      </div>

      {bloqueo && !editando && <p className="mt-2 px-1 text-xs text-muted-foreground">{bloqueo}</p>}

      {editando && (
        <form
          // Sin la validación del navegador: su globo dice «introduce una
          // URL» y no por qué este enlace no vale. Lo dice `limpiarEnlace`.
          noValidate
          className="mt-3 rounded-xl border px-4 py-4"
          style={{ borderColor: 'var(--regla-fina)' }}
          onSubmit={(evento) => {
            evento.preventDefault()
            const comprobado = limpiarEnlace(enlace)
            if (!comprobado.ok) {
              setError(comprobado.mensaje)
              return
            }
            setError(null)
            setErrorClave(null)
            setPidiendoClave(true)
          }}
        >
          <label htmlFor={`${id}-enlace`} className="block text-sm font-medium text-foreground">
            Enlace del libro nuevo
          </label>
          <Input
            id={`${id}-enlace`}
            type="url"
            inputMode="url"
            autoComplete="off"
            autoFocus
            value={enlace}
            onChange={(evento) => {
              setEnlace(evento.target.value)
              setError(null)
            }}
            placeholder="https://…sharepoint.com/…/Plan de Negocio 0726.xlsm"
            aria-invalid={error ? true : undefined}
            aria-describedby={`${id}-ayuda`}
            className="mt-1.5 h-10"
          />
          <p id={`${id}-ayuda`} className="mt-2 text-xs text-muted-foreground">
            Se abre y se comprueba antes de usarlo. Si no se puede leer, el tablero sigue con el plan actual.
          </p>
          {error && (
            <p role="alert" className="mt-2 flex items-start gap-1.5 text-xs" style={{ color: 'var(--estado-critico)' }}>
              <WarningIcon weight="duotone" aria-hidden="true" className="mt-px size-3.5 shrink-0" />
              <span>{error}</span>
            </p>
          )}
          <div className="mt-4 flex justify-end gap-2">
            <button
              type="button"
              onClick={cerrar}
              className="h-10 rounded-full px-4 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={enlace.trim() === ''}
              className={cn(
                'h-10 rounded-full bg-brand px-5 text-sm font-medium text-primary-foreground shadow-(--sombra-tray) transition-colors hover:bg-brand-strong focus-visible:ring-3 focus-visible:ring-ring/50',
                'disabled:cursor-not-allowed disabled:opacity-50',
              )}
            >
              Usar este libro
            </button>
          </div>
        </form>
      )}

      <DialogoClave
        abierto={pidiendoClave}
        guardando={cambiando}
        error={errorClave}
        cambios={0}
        titulo="Cambiar el plan"
        descripcion="El tablero pasará a leer el libro nuevo. Escribe la contraseña de captura para confirmarlo."
        accion="Cambiar plan"
        accionEnCurso="Comprobando el libro…"
        onConfirmar={confirmar}
        onCancelar={() => setPidiendoClave(false)}
      />
    </div>
  )
}
