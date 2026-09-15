/**
 * Series compartidas por todos los gráficos «plan contra real».
 *
 * Un solo sitio para el par de colores. `ChartContainer` convierte cada
 * clave en una variable CSS (`--color-plan`, `--color-real`) acotada al
 * gráfico, y las marcas se pintan con ellas. Así el Embudo, la Serie, el
 * Dinero y los Canales dicen «plan» con el mismo gris y «real» con la misma
 * tinta, y cambiar el par es tocar dos líneas.
 *
 * Son tokens, no hexadecimales: `--serie-plan` y `--serie-real` ya tienen su
 * valor claro y oscuro en `app/globals.css`, así que el modo oscuro sale
 * solo.
 *
 * ── Color por familia de indicador ──────────────────────────────────
 * Desde el rediseño de 2026-09-14 el real lleva el color de su FAMILIA y no
 * la tinta: carmín de marca para el embudo (leads, llamadas, ventas), verde
 * para el dinero y azul para captación y costes. Así el mismo indicador se
 * ve igual en la Serie que en su propio panel. `colorDeFamilia` es la única
 * función que decide esto; ningún gráfico elige su color a mano.
 */

import type { ChartConfig } from '@/components/ui/chart'
import type { Indicador } from '@/lib/tipos'

/** Familia de indicador → token de color de su serie real. */
export const COLOR_FAMILIA = {
  embudo: 'var(--metrica-carmin)',
  dinero: 'var(--metrica-verde)',
  captacion: 'var(--metrica-azul)',
} as const

/** Grupos del catálogo que no son familia propia caen a la tinta neutra. */
export function colorDeFamilia(indicador: Pick<Indicador, 'grupo'> | null | undefined): string {
  const grupo = indicador?.grupo
  if (grupo === 'embudo' || grupo === 'dinero' || grupo === 'captacion') {
    return COLOR_FAMILIA[grupo]
  }
  return 'var(--serie-real)'
}

/** Config plan/real con el real en el color de la familia del indicador. */
export function configPlanReal(indicador: Pick<Indicador, 'grupo'> | null | undefined) {
  return {
    plan: { label: 'Plan', color: 'var(--serie-plan)' },
    real: { label: 'Real', color: colorDeFamilia(indicador) },
  } satisfies ChartConfig
}
