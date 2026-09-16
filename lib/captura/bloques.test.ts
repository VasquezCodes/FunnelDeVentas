import { describe, expect, it } from 'vitest'

import { BLOQUES, BLOQUES_POR_CANAL } from '@/lib/captura/bloques'
import { INDICADORES_DEL_PLAN, POR_ID } from '@/lib/plan/catalogo'
import { SUMANDOS, TOTALES_CALCULADOS } from '@/lib/plan/sumas'
import { NOMBRE_CANAL } from '@/lib/tipos'

const filasDe = (bloque: (typeof BLOQUES)[number]) => bloque.grupos.flatMap((g) => g.filas)

/** Posición del bloque donde vive un indicador, como fila o como total. */
const posicionDe = (id: string) =>
  BLOQUES.findIndex((b) => b.total === id || filasDe(b).includes(id))

describe('BLOQUES', () => {
  it('cada indicador del catálogo aparece una sola vez, como fila o como total', () => {
    const enBloques = BLOQUES.flatMap((b) => [...filasDe(b), ...(b.total ? [b.total] : [])])
    expect(enBloques).toHaveLength(52)
    expect([...enBloques].sort()).toEqual(INDICADORES_DEL_PLAN.map((i) => i.id).sort())
  })

  it('ningún total tiene casilla: no aparece entre las filas', () => {
    const filas = BLOQUES.flatMap(filasDe)
    for (const total of TOTALES_CALCULADOS) expect(filas).not.toContain(total)
  })

  it('cada total suma solo filas de su propio bloque', () => {
    for (const bloque of BLOQUES) {
      if (!bloque.total) continue
      expect(TOTALES_CALCULADOS.has(bloque.total)).toBe(true)
      expect(filasDe(bloque)).toEqual(expect.arrayContaining([...SUMANDOS.get(bloque.total)!]))
    }
  })

  it('las etapas van en el orden en que avanza el lead', () => {
    const orden = ['eleads', 'llamadas', 'discoveries', 'propuestas', 'ventas'].map(posicionDe)
    expect(orden.every((p) => p >= 0)).toBe(true)
    expect(orden).toEqual([...orden].sort((a, b) => a - b))
  })

  it('solo los insumos van plegados, y son el último bloque', () => {
    const plegados = BLOQUES.filter((b) => b.plegado)
    expect(plegados).toHaveLength(1)
    expect(plegados[0]).toBe(BLOQUES.at(-1))
    expect(filasDe(plegados[0])).toContain('publicidad-impresiones')
  })

  it('en los insumos, cada subtítulo es el canal de todas sus filas', () => {
    const insumos = BLOQUES.at(-1)!
    expect(insumos.grupos.map((g) => g.titulo)).toEqual([
      'Publicidad',
      'Prospección',
      'Referidos',
      'Afiliados',
      'Contenido',
      'Newsletter',
    ])
    for (const grupo of insumos.grupos) {
      for (const id of grupo.filas) {
        const canal = POR_ID.get(id)?.canal
        expect(canal && NOMBRE_CANAL[canal]).toBe(grupo.titulo)
      }
    }
  })
})

describe('BLOQUES_POR_CANAL', () => {
  const filasPorCanal = BLOQUES_POR_CANAL.flatMap(filasDe)

  it('tiene exactamente las mismas casillas que la vista por etapa, cada una una vez', () => {
    expect(filasPorCanal).toHaveLength(new Set(filasPorCanal).size)
    expect([...filasPorCanal].sort()).toEqual(BLOQUES.flatMap(filasDe).sort())
  })

  it('un bloque por canal, en el orden del catálogo, solo con filas de su canal', () => {
    const deCanal = BLOQUES_POR_CANAL.filter((b) => b.canal)
    expect(deCanal.map((b) => b.titulo)).toEqual(Object.values(NOMBRE_CANAL))
    for (const bloque of deCanal) {
      for (const id of filasDe(bloque)) expect(POR_ID.get(id)?.canal).toBe(bloque.canal)
    }
  })

  it('dentro de un canal, de la materia prima a la venta y al final su gasto', () => {
    const publicidad = BLOQUES_POR_CANAL.find((b) => b.canal === 'publicidad')!
    expect(filasDe(publicidad)).toEqual([
      'publicidad-impresiones',
      'publicidad-clicks',
      'publicidad-inversion',
      'eleads.publicidad',
      'llamadas.publicidad',
      'ventas.publicidad',
      'captacion.publicidad',
    ])
  })

  it('lo que no es de ningún canal va detrás, y sin totales tecleables', () => {
    const sinCanal = BLOQUES_POR_CANAL.filter((b) => !b.canal)
    expect(sinCanal.map((b) => b.id)).toEqual(['discoveries-propuestas', 'ingresos'])
    for (const total of TOTALES_CALCULADOS) expect(filasPorCanal).not.toContain(total)
  })
})
