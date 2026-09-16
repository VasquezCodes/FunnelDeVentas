import { describe, expect, it } from 'vitest'

import { NOMBRES_DE_TASAS, construirTasas } from '@/lib/plan/tasas'

/** Los valores de la hoja Variables del libro de abril de 2026. */
const DEL_LIBRO = new Map<string, number>([
  ['CVR_Llamada', 0.6],
  ['CVR_Cualificación', 0.3],
  ['CVR_Propuestas', 0.5],
  ['CVR_Cierre', 0.4],
  ['CVR_LinkCTR', 0.01],
  ['CVR_Publicidad', 0.1],
  ['CVR_Prospección', 0.06],
  ['CVR_Referidos', 0.2],
  ['CVR_Afiliados', 0.2],
  ['CVR_Contenido', 0.02],
  ['CVR_Apertura', 0.5],
  ['CVR_Newsletter', 0.02],
])

const buscar = (desde: string, hacia: string) =>
  construirTasas(DEL_LIBRO).tasas.find((t) => t.desde === desde && t.hacia === hacia)

describe('construirTasas', () => {
  it('ata cada tasa del embudo a sus dos etapas', () => {
    expect(buscar('eleads', 'llamadas')?.plan).toBe(0.6)
    expect(buscar('llamadas', 'discoveries')?.plan).toBe(0.3)
    expect(buscar('discoveries', 'propuestas')?.plan).toBe(0.5)
    expect(buscar('propuestas', 'ventas')?.plan).toBe(0.4)
  })

  it('repite la conversión a llamada en cada canal', () => {
    const tasa = buscar('eleads.publicidad', 'llamadas.publicidad')
    expect(tasa?.plan).toBe(0.6)
    expect(tasa?.canal).toBe('publicidad')
  })

  it('no inventa tasas que el Excel no tiene: nada de llamada a venta', () => {
    expect(buscar('llamadas', 'ventas')).toBeUndefined()
    expect(buscar('llamadas.referidos', 'ventas.referidos')).toBeUndefined()
  })

  it('ata las variables previas de cada canal a sus leads', () => {
    expect(buscar('publicidad-impresiones', 'publicidad-clicks')?.nombre).toBe('Link CTR')
    expect(buscar('publicidad-clicks', 'eleads.publicidad')?.plan).toBe(0.1)
    expect(buscar('prospeccion-contactos', 'eleads.prospeccion')?.plan).toBe(0.06)
    expect(buscar('newsletter-envios', 'newsletter-aperturas')?.plan).toBe(0.5)
    expect(buscar('newsletter-aperturas', 'eleads.newsletter')?.canal).toBe('newsletter')
  })

  it('una tasa sin su nombre en el libro queda sin plan y se avisa una vez', () => {
    const sinCierre = new Map(DEL_LIBRO)
    sinCierre.delete('CVR_Cierre')
    const { tasas, faltan } = construirTasas(sinCierre)
    expect(tasas.find((t) => t.desde === 'propuestas')?.plan).toBeNull()
    expect(faltan).toEqual(['CVR_Cierre'])
  })

  it('declara todos los nombres que necesita', () => {
    expect([...NOMBRES_DE_TASAS].sort()).toEqual([...DEL_LIBRO.keys()].sort())
  })
})
