/**
 * La contraseña de captura.
 *
 * No hay cuentas: una contraseña compartida, que vive en Vercel como
 * `CLAVE_CAPTURA`, es lo que impide que cualquiera con el enlace cambie las
 * cifras. Se pide en cada guardado.
 *
 * Se compara en tiempo constante: una comparación normal tarda más cuanto
 * más se parece lo tecleado a la contraseña, y eso se puede medir. Las dos
 * se resumen antes con SHA-256 para que midan lo mismo, porque
 * `timingSafeEqual` exige longitudes iguales y comparar longitudes ya
 * delataría la de la contraseña.
 *
 * Falla cerrado: sin la variable, ninguna contraseña vale.
 */

import { createHash, timingSafeEqual } from 'node:crypto'

const resumir = (texto: string) => createHash('sha256').update(texto, 'utf8').digest()

export function claveValida(recibida: string, esperada: string | undefined): boolean {
  if (!esperada) return false
  return timingSafeEqual(resumir(recibida), resumir(esperada))
}
