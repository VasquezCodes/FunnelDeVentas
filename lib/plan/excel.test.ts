import { describe, expect, it } from 'vitest'
import * as XLSX from 'xlsx'

import { leerPlan } from '@/lib/plan/excel'

/** Julio de 2026 como serial de Excel, que es como llega la cabecera. */
const JULIO_2026 = Date.UTC(2026, 6, 1) / 86_400_000 + 25569

/**
 * Un libro mínimo con las filas que se le pasen (clave y cifra de julio) y
 * dos tasas en «Variables». Se escribe y se vuelve a leer como un .xlsx real.
 */
function libroCon(filas: Array<[string, number]>): ArrayBuffer {
  const libro = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(
    libro,
    XLSX.utils.aoa_to_sheet([
      ['Claves', null, JULIO_2026],
      [null, 'UDS', null],
      ...filas.map(([clave, valor]) => [clave, clave, valor]),
    ]),
    'Plan de Ventas',
  )
  XLSX.utils.book_append_sheet(libro, XLSX.utils.aoa_to_sheet([[0.6], [0.3]]), 'Variables')
  libro.Workbook = {
    Names: [
      { Name: 'CVR_Llamada', Ref: 'Variables!$A$1' },
      { Name: 'CVR_Cualificación', Ref: 'Variables!$A$2' },
    ],
  }
  const escrito = XLSX.write(libro, { type: 'array', bookType: 'xlsx' }) as ArrayBuffer
  return escrito
}

const PLAN_SIN_DESGLOSE: Array<[string, number]> = [
  ['Llamadas_FLECHA', 133],
  ['Llamadas_FLECHA_Publicidad', 90],
  ['Discoveries_FLECHA', 40],
]

const PLAN_CON_DESGLOSE: Array<[string, number]> = [
  ...PLAN_SIN_DESGLOSE,
  ['Discoveries_FLECHA_Publicidad', 27],
  ['Discoveries_FLECHA_Prospección', 8],
]

describe('leerPlan: Discoveries por canal', () => {
  it('un libro que no reparte Discoveries no lo cuenta como incidencia', () => {
    const { incidencias, indicadores } = leerPlan(libroCon(PLAN_SIN_DESGLOSE))
    expect(incidencias.filter((i) => i.startsWith('Discoveries_FLECHA'))).toEqual([])
    expect(indicadores.map((i) => i.id)).not.toContain('discoveries.publicidad')
  })

  it('un libro que la reparte trae los canales como desglose de Discoveries', () => {
    const { indicadores, metas } = leerPlan(libroCon(PLAN_CON_DESGLOSE))
    const publicidad = indicadores.find((i) => i.id === 'discoveries.publicidad')
    expect(publicidad?.desglosaA).toBe('discoveries')
    expect(publicidad?.canal).toBe('publicidad')
    expect(metas.find((m) => m.indicadorId === 'discoveries.prospeccion')?.valor).toBe(8)
  })

  it('las tasas por canal solo existen si el libro trae sus dos lados', () => {
    const buscar = (tasas: ReturnType<typeof leerPlan>['tasas']) =>
      tasas.find((t) => t.desde === 'llamadas.publicidad' && t.hacia === 'discoveries.publicidad')

    expect(buscar(leerPlan(libroCon(PLAN_SIN_DESGLOSE)).tasas)).toBeUndefined()
    expect(buscar(leerPlan(libroCon(PLAN_CON_DESGLOSE)).tasas)?.plan).toBe(0.3)
    // La global sigue en los dos: sus etapas están en ambos libros.
    const global = leerPlan(libroCon(PLAN_SIN_DESGLOSE)).tasas.find(
      (t) => t.desde === 'llamadas' && t.hacia === 'discoveries',
    )
    expect(global?.plan).toBe(0.3)
  })
})
