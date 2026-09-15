import type { Metadata } from 'next'
import './globals.css'
import { fraunces, geistSans, geistMono } from '@/lib/fonts'
import { Toaster } from '@/components/ui/sonner'

export const metadata: Metadata = {
  // Un nombre, no una descripción. En una pestaña solo se leen los primeros
  // caracteres, y la marca ya la pone el icono, así que el título no tiene
  // que repetirla ni explicar el mecanismo: nombra el sujeto y se acabó.
  title: 'Funnel de ventas',
  description:
    'Comparación del plan de negocio contra el resultado real del funnel de ventas, por mes o por quincena.',
}

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html
      lang="es"
      suppressHydrationWarning
      className={`${fraunces.variable} ${geistSans.variable} ${geistMono.variable}`}
    >
      <head>
        {/*
          El tema se aplica ANTES de pintar, inline y en <head>: si se dejara
          a un efecto, quien tenga el oscuro elegido vería un fogonazo blanco
          en cada carga.

          El claro es el modo de la casa y NO se sigue la preferencia del
          sistema. Es una decisión, no un descuido: este tablero se lee sobre
          papel cálido, con las cifras en tinta, y esa es la lectura para la
          que está calibrado. Quien quiera el oscuro lo elige con el botón y
          entonces sí se recuerda.
        */}
        <script
          dangerouslySetInnerHTML={{
            __html: `try{if(localStorage.getItem('tema')==='oscuro')document.documentElement.classList.add('dark')}catch(e){}`,
          }}
        />
      </head>
      <body suppressHydrationWarning className="min-h-screen antialiased grano">
        {children}
        <Toaster richColors position="top-center" />
      </body>
    </html>
  )
}
