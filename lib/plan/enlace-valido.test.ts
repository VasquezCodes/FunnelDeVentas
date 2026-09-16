import { describe, expect, it } from 'vitest'

import { limpiarEnlace } from '@/lib/plan/enlace-valido'

/** Con la forma de los enlaces reales, pero inventado. */
const BUENO =
  'https://empresa-my.sharepoint.com/personal/usuario_empresa_com/Documents/Contabilidad/2026/07%20-%20Julio/Plan%20de%20Negocio%200726.xlsm'

describe('limpiarEnlace', () => {
  it('acepta un enlace de SharePoint o OneDrive a un libro de Excel', () => {
    expect(limpiarEnlace(BUENO)).toEqual({ ok: true, url: BUENO })
  })

  it('quita los espacios de alrededor que deja el copiar y pegar', () => {
    expect(limpiarEnlace(`  ${BUENO}\n`)).toEqual({ ok: true, url: BUENO })
  })

  it('rechaza lo que no es un enlace', () => {
    expect(limpiarEnlace('Plan de Negocio 0726.xlsm').ok).toBe(false)
    expect(limpiarEnlace('').ok).toBe(false)
  })

  it('rechaza enlaces que no son https ni de SharePoint', () => {
    expect(limpiarEnlace(BUENO.replace('https:', 'http:')).ok).toBe(false)
    expect(limpiarEnlace('https://ejemplo.com/Plan.xlsm').ok).toBe(false)
    expect(limpiarEnlace('https://sharepoint.com.ejemplo.com/Plan.xlsm').ok).toBe(false)
  })

  it('pide un libro de Excel, no cualquier archivo', () => {
    expect(limpiarEnlace(BUENO.replace('.xlsm', '.pdf')).ok).toBe(false)
    expect(limpiarEnlace(BUENO.replace('.xlsm', '.xlsx')).ok).toBe(true)
  })
})
