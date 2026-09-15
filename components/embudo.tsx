'use client'

/**
 * Embudo de ventas: cada etapa contra su plan, mes a mes (v5, fichas).
 *
 * ── Por qué fichas ──────────────────────────────────────────────────────
 * Las cuatro versiones anteriores dibujaban el embudo de UN mes: barras
 * emparejadas, cajas centradas, una silueta, columnas. Todas contestaban
 * «dónde está hoy cada etapa» y ninguna «desde cuándo». Aquí cada etapa es
 * una ficha con su cifra, su plan y sus últimos seis meses, y la hoja entera
 * se mueve a la vez: al pasar por junio se lee el embudo de junio. La
 * escalera no hace falta dibujarla: está en el orden de las fichas, de la
 * boca al cierre.
 *
 * ── La sexta ficha ──────────────────────────────────────────────────────
 * La conversión de lead a venta: de cada cien leads, cuántos acaban en
 * venta. Separa «entra poco» de «vendemos mal», que es la pregunta de fondo
 * de «dónde se estrecha». Con los reales de ejemplo lo dice sin rodeos: los
 * leads se hunden y la conversión sube.
 *
 * Todo en carmín: es la familia del embudo (`--metrica-carmin`), el mismo
 * color con que la Serie pinta estas métricas. Cada etapa lleva su icono de
 * Lucide, elegido por lo que pasa en ella: el lead se interesa, se le
 * llama, se descubre qué necesita, se le propone y se cierra. La gramática
 * de la ficha (cifra, plan, juicio y mini serie) vive en `fichas.tsx`.
 */

import { useMemo } from 'react'
import { FunnelIcon } from '@phosphor-icons/react/ssr'
import {
  BadgeCheck,
  FileText,
  Percent,
  PhoneCall,
  ScanSearch,
  Users,
  type LucideIcon,
} from 'lucide-react'

import { COLOR_FAMILIA } from '@/components/graficos/config'
import {
  HojaVacia,
  RejillaFichas,
  cociente,
  puntoCalculado,
  puntoDeComparativa,
  ventanaDe,
  type Ficha,
  type PuntoDeSerie,
} from '@/components/graficos/fichas'
import { formatearTasaConversion, formatearValor } from '@/lib/comparacion'
import type { Comparativa, Indicador } from '@/lib/tipos'

/** Un icono por etapa del catálogo; una etapa nueva sale sin icono, no rota. */
const ICONO_ETAPA: Record<string, LucideIcon> = {
  eleads: Users,
  llamadas: PhoneCall,
  discoveries: ScanSearch,
  propuestas: FileText,
  ventas: BadgeCheck,
}

export interface EmbudoProps {
  /** Los periodos del grano elegido, con sus comparativas. */
  serie: PuntoDeSerie[]
  /** El periodo elegido en el tablero. */
  periodoId: string
}

function esEtapa(c: Comparativa): c is Comparativa & { indicador: Indicador & { etapa: number } } {
  return c.indicador.etapa !== null
}

export function Embudo({ serie, periodoId }: EmbudoProps) {
  const { ventana, elegido } = useMemo(() => ventanaDe(serie, periodoId), [serie, periodoId])
  const periodos = useMemo(() => ventana.map((p) => p.periodo), [ventana])

  /** Las etapas, de la boca al cierre, tal como las trae el periodo elegido. */
  const etapas = useMemo(
    () =>
      (ventana[elegido]?.comparativas ?? [])
        .filter(esEtapa)
        .sort((a, b) => a.indicador.etapa - b.indicador.etapa)
        .map((c) => c.indicador),
    [ventana, elegido],
  )

  const fichas = useMemo<Ficha[]>(() => {
    const color = COLOR_FAMILIA.embudo
    const buscar = (punto: PuntoDeSerie, id: string) =>
      punto.comparativas.find((c) => c.indicador.id === id)

    const lista = etapas.map(
      (indicador): Ficha => ({
        id: indicador.id,
        titulo: indicador.nombre,
        Icono: ICONO_ETAPA[indicador.id],
        color,
        formatear: (n) => formatearValor(n, indicador.unidad),
        relacion: 'de',
        puntos: ventana.map((p) => puntoDeComparativa(buscar(p, indicador.id))),
      }),
    )

    // La tasa se calcula mes a mes con los dos lados del mismo mes: la del
    // plan con las metas, la real con los reales. Promediar tasas de meses
    // distintos daría un número que no es de ningún mes.
    const boca = etapas[0]
    const cierre = etapas[etapas.length - 1]
    if (boca && cierre && boca.id !== cierre.id) {
      lista.push({
        id: 'conversion-lead-venta',
        titulo: 'Conversión de lead a venta',
        Icono: Percent,
        color,
        formatear: formatearTasaConversion,
        relacion: 'frente',
        puntos: ventana.map((p) => {
          const deBoca = buscar(p, boca.id)
          const deCierre = buscar(p, cierre.id)
          return puntoCalculado(
            cociente(deCierre?.meta, deBoca?.meta),
            cociente(deCierre?.real, deBoca?.real),
            'mayor-mejor',
          )
        }),
      })
    }
    return lista
  }, [etapas, ventana])

  const hayCifras = fichas.some((f) =>
    f.puntos.some((p) => (p.plan ?? 0) > 0 || (p.real ?? 0) > 0),
  )

  if (etapas.length === 0 || !hayCifras) {
    return (
      <HojaVacia
        Icono={FunnelIcon}
        titulo="Todavía no hay embudo que dibujar"
        motivo={
          etapas.length === 0
            ? 'Ningún indicador de este periodo tiene una posición de embudo asignada.'
            : 'Las etapas existen, pero no hay metas ni resultados en estos meses.'
        }
      />
    )
  }

  return (
    <RejillaFichas
      ventana={periodos}
      elegido={elegido}
      fichas={fichas}
      descripcion="Embudo de ventas por etapa"
      nombreFila="Etapa"
      colorLeyenda={COLOR_FAMILIA.embudo}
      datos={ventana}
    />
  )
}
