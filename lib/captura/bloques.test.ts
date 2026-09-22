import { describe, expect, it } from 'vitest'

import { bloquesDe, bloquesPorCanalDe, type BloqueCaptura } from '@/lib/captura/bloques'
import { INDICADORES_DEL_PLAN, POR_ID } from '@/lib/plan/catalogo'
import { SUMANDOS, totalesCalculadosEn } from '@/lib/plan/sumas'
import { NOMBRE_CANAL } from '@/lib/tipos'

/** Los dos libros que hay: el 0726 reparte Discoveries por canal; los anteriores, no. */
const CON_DESGLOSE = INDICADORES_DEL_PLAN.map((i) => i.id)
const SIN_DESGLOSE = CON_DESGLOSE.filter(
  (id) => !id.startsWith('discoveries.') && !id.startsWith('propuestas.'),
)
const LIBROS = [
  { nombre: 'con Discoveries por canal', ids: CON_DESGLOSE, cuantos: 66 },
  { nombre: 'sin Discoveries por canal', ids: SIN_DESGLOSE, cuantos: 52 },
]

const filasDe = (bloque: BloqueCaptura) => bloque.grupos.flatMap((g) => g.filas)

describe.each(LIBROS)('bloquesDe, $nombre', ({ ids, cuantos }) => {
  const bloques = bloquesDe(ids)

  /** Posición del bloque donde vive un indicador, como fila o como total. */
  const posicionDe = (id: string) =>
    bloques.findIndex((b) => b.total === id || filasDe(b).includes(id))

  it('cada indicador del plan aparece una sola vez, como fila o como total', () => {
    const enBloques = bloques.flatMap((b) => [...filasDe(b), ...(b.total ? [b.total] : [])])
    expect(enBloques).toHaveLength(cuantos)
    expect([...enBloques].sort()).toEqual([...ids].sort())
  })

  it('ningún total del plan tiene casilla', () => {
    const filas = bloques.flatMap(filasDe)
    for (const total of totalesCalculadosEn(ids)) expect(filas).not.toContain(total)
  })

  it('cada total suma solo filas de su propio bloque', () => {
    for (const bloque of bloques) {
      if (!bloque.total) continue
      const sumandos = SUMANDOS.get(bloque.total)!.filter((id) => ids.includes(id))
      expect(sumandos.length).toBeGreaterThan(0)
      expect(filasDe(bloque)).toEqual(expect.arrayContaining(sumandos))
    }
  })

  it('las etapas van en el orden en que avanza el lead', () => {
    const orden = ['eleads', 'llamadas', 'discoveries', 'propuestas', 'ventas'].map(posicionDe)
    expect(orden.every((p) => p >= 0)).toBe(true)
    expect(orden).toEqual([...orden].sort((a, b) => a - b))
  })

  it('solo los insumos van plegados, y son el primer bloque', () => {
    const plegados = bloques.filter((b) => b.plegado)
    expect(plegados).toHaveLength(1)
    expect(plegados[0]).toBe(bloques[0])
    expect(filasDe(plegados[0])).toContain('publicidad-impresiones')
  })

  it('en los insumos, cada subtítulo es el canal de todas sus filas', () => {
    const insumos = bloques[0]!
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

describe('bloquesDe, según cómo trae Discoveries el libro', () => {
  it('por canal: Discoveries y Propuestas, cada una con sus canales y su total', () => {
    const bloques = bloquesDe(CON_DESGLOSE)
    for (const etapa of ['discoveries', 'propuestas']) {
      const bloque = bloques.find((b) => b.id === etapa)!
      expect(bloque.total).toBe(etapa)
      expect(filasDe(bloque)).toEqual(SUMANDOS.get(etapa))
    }
    expect(bloques.map((b) => b.id)).not.toContain('discoveries-propuestas')
  })

  it('sin desglose: Discoveries se teclea, junto a Propuestas', () => {
    const bloques = bloquesDe(SIN_DESGLOSE)
    const juntas = bloques.find((b) => b.id === 'discoveries-propuestas')!
    expect(filasDe(juntas)).toEqual(['discoveries', 'propuestas'])
    expect(bloques.map((b) => b.id)).not.toContain('discoveries')
  })

  it('una fila que el libro no trae no sale en ningún bloque', () => {
    const sinClics = CON_DESGLOSE.filter((id) => id !== 'publicidad-clicks')
    expect(bloquesDe(sinClics).flatMap(filasDe)).not.toContain('publicidad-clicks')
  })
})

describe.each(LIBROS)('bloquesPorCanalDe, $nombre', ({ ids }) => {
  const porCanal = bloquesPorCanalDe(ids)
  const filasPorCanal = porCanal.flatMap(filasDe)

  it('tiene exactamente las mismas casillas que la vista por etapa, cada una una vez', () => {
    expect(filasPorCanal).toHaveLength(new Set(filasPorCanal).size)
    expect([...filasPorCanal].sort()).toEqual(bloquesDe(ids).flatMap(filasDe).sort())
  })

  it('un bloque por canal, en el orden del catálogo, solo con filas de su canal', () => {
    const deCanal = porCanal.filter((b) => b.canal)
    expect(deCanal.map((b) => b.titulo)).toEqual(Object.values(NOMBRE_CANAL))
    for (const bloque of deCanal) {
      for (const id of filasDe(bloque)) expect(POR_ID.get(id)?.canal).toBe(bloque.canal)
    }
  })

  it('ningún total del plan tiene casilla', () => {
    for (const total of totalesCalculadosEn(ids)) expect(filasPorCanal).not.toContain(total)
  })
})

describe('bloquesPorCanalDe, según cómo trae Discoveries el libro', () => {
  it('por canal: cada canal lleva sus discoveries entre llamadas y ventas; detrás, Propuestas', () => {
    const bloques = bloquesPorCanalDe(CON_DESGLOSE)
    expect(filasDe(bloques.find((b) => b.canal === 'publicidad')!)).toEqual([
      'publicidad-impresiones',
      'publicidad-clicks',
      'publicidad-inversion',
      'eleads.publicidad',
      'llamadas.publicidad',
      'discoveries.publicidad',
      'propuestas.publicidad',
      'ventas.publicidad',
      'captacion.publicidad',
    ])
    // Propuestas ya va dentro de cada canal: detrás no se repite.
    expect(bloques.filter((b) => !b.canal).map((b) => b.id)).toEqual(['ingresos'])
  })

  it('sin desglose: de la materia prima a la venta, y detrás Discoveries y Propuestas', () => {
    const bloques = bloquesPorCanalDe(SIN_DESGLOSE)
    expect(filasDe(bloques.find((b) => b.canal === 'publicidad')!)).toEqual([
      'publicidad-impresiones',
      'publicidad-clicks',
      'publicidad-inversion',
      'eleads.publicidad',
      'llamadas.publicidad',
      'ventas.publicidad',
      'captacion.publicidad',
    ])
    expect(bloques.filter((b) => !b.canal).map((b) => b.id)).toEqual(['discoveries-propuestas', 'ingresos'])
  })
})
