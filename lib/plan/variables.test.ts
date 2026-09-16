import { describe, expect, it } from 'vitest'
import type { WorkBook } from 'xlsx'

import { valoresDeNombres } from '@/lib/plan/variables'

/** Un libro mínimo: la hoja Variables con dos celdas y sus nombres. */
function libro(nombres: Array<{ Name: string; Ref: string }>): WorkBook {
  return {
    SheetNames: ['Variables'],
    Sheets: {
      Variables: {
        '!ref': 'A1:S30',
        G5: { t: 'n', v: 0.6 },
        S26: { t: 'n', v: 0.06 },
        H5: { t: 's', v: 'Tasa de Conversión a Llamada' },
      },
    },
    Workbook: { Names: nombres },
  } as unknown as WorkBook
}

describe('valoresDeNombres', () => {
  it('lee el número de cada nombre definido que apunta a una celda', () => {
    const valores = valoresDeNombres(
      libro([
        { Name: 'CVR_Llamada', Ref: 'Variables!$G$5' },
        { Name: 'CVR_Prospección', Ref: "'Variables'!$S$26" },
      ]),
    )
    expect(valores.get('CVR_Llamada')).toBe(0.6)
    expect(valores.get('CVR_Prospección')).toBe(0.06)
  })

  it('ignora los nombres que no apuntan a un número de una sola celda', () => {
    const valores = valoresDeNombres(
      libro([
        { Name: 'Etiqueta', Ref: 'Variables!$H$5' },
        { Name: 'Canales', Ref: 'Variables!$A$33:$A$39' },
        { Name: 'Vacia', Ref: 'Variables!$Z$99' },
        { Name: 'OtraHoja', Ref: "'PyG'!$A$1" },
      ]),
    )
    expect(valores.size).toBe(0)
  })

  it('normaliza los nombres con tilde, vengan compuestos o no', () => {
    const descompuesto = 'CVR_Prospección'.normalize('NFD')
    const valores = valoresDeNombres(libro([{ Name: descompuesto, Ref: 'Variables!$S$26' }]))
    expect(valores.get('CVR_Prospección')).toBe(0.06)
  })
})
