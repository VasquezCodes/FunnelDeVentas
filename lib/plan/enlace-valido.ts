/**
 * ¿Es esto un enlace a un libro del plan?
 *
 * Solo la forma: https, un dominio de SharePoint u OneDrive de empresa
 * (`*.sharepoint.com`) y un archivo de Excel. Que el libro exista, que la
 * aplicación tenga acceso y que traiga la hoja «Plan de Ventas» se comprueba
 * descargándolo (`app/captura/acciones.ts`), no aquí.
 */

export type ResultadoEnlace = { ok: true; url: string } | { ok: false; mensaje: string }

export function limpiarEnlace(texto: string): ResultadoEnlace {
  const limpio = String(texto ?? '').trim()
  let url: URL
  try {
    url = new URL(limpio)
  } catch {
    return { ok: false, mensaje: 'Pega el enlace completo del libro, empezando por https://.' }
  }
  if (url.protocol !== 'https:' || !url.hostname.endsWith('.sharepoint.com')) {
    return { ok: false, mensaje: 'El enlace tiene que ser de SharePoint u OneDrive de la empresa (…sharepoint.com).' }
  }
  if (!/\.xls[xm]$/i.test(decodeURIComponent(url.pathname))) {
    return { ok: false, mensaje: 'El enlace tiene que llevar a un libro de Excel (.xlsm o .xlsx).' }
  }
  return { ok: true, url: limpio }
}
