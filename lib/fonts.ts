import { Montserrat } from 'next/font/google'
import { GeistMono } from 'geist/font/mono'

// Las mismas familias que el plan de negocio, que es donde vive este tablero:
// Montserrat para el texto y los títulos, Geist Mono para las cifras.
export const montserrat = Montserrat({
  subsets: ['latin'],
  variable: '--font-montserrat',
  display: 'swap',
})

export const geistMono = GeistMono // expone .variable = '--font-geist-mono'
