/**
 * Implementación de `FuenteDatos` sobre los datos de ejemplo.
 *
 * Esta es la fuente de HOY: lee de `lib/mock/datos.ts` y no habla con nadie.
 * La de la fase 2 —la sincronización con HighLevel— entrará por esta misma
 * interfaz: bastará con exportar otra implementación y cambiar la instancia
 * que consume el tablero. Ni los componentes ni el motor de comparación se
 * tocan, porque nadie aguas arriba sabe de dónde salen los datos.
 *
 * Los métodos son asíncronos aunque los datos estén en memoria, precisamente
 * para que la firma no cambie cuando detrás haya una llamada de red. La
 * "latencia" se simula con un `await` que se resuelve de inmediato: sin
 * temporizadores, para no meter ruido en el render del servidor ni en los
 * tests.
 */

import type { FuenteDatos, Indicador, Meta, Periodo, Real } from '@/lib/tipos'
import { INDICADORES, METAS, PERIODOS_MOCK, REALES } from '@/lib/mock/datos'

/** Cede el turno una vez, sin temporizadores. Marca el punto asíncrono. */
async function cederTurno(): Promise<void> {
  await Promise.resolve()
}

export const fuenteMock: FuenteDatos = {
  async indicadores(): Promise<Indicador[]> {
    await cederTurno()
    // Se devuelve una copia: las tablas del módulo son de solo lectura de
    // hecho, y así ningún consumidor puede ordenarlas o mutarlas en sitio.
    return [...INDICADORES]
  },

  async periodos(): Promise<Periodo[]> {
    await cederTurno()
    // PERIODOS_MOCK ya viene del más reciente al más antiguo, como pide el
    // contrato.
    return [...PERIODOS_MOCK]
  },

  async metas(periodoId: string): Promise<Meta[]> {
    await cederTurno()
    return METAS.filter((meta) => meta.periodoId === periodoId)
  },

  async reales(periodoId: string): Promise<Real[]> {
    await cederTurno()
    return REALES.filter((real) => real.periodoId === periodoId)
  },
}
