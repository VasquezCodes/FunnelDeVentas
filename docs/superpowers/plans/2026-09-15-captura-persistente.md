# Captura persistente por quincena — plan de implementación

> **Para agentes:** SUB-SKILL OBLIGATORIA: usar superpowers:subagent-driven-development (recomendado) o superpowers:executing-plans para implementar este plan tarea a tarea. Los pasos usan casillas (`- [ ]`) para el seguimiento.

**Objetivo:** que la captura manual guarde de verdad los reales en Firestore, quincena a quincena, protegida por una contraseña que se pide en cada guardado, y que el tablero enseñe solo lo capturado, con el mes en curso leído «a la fecha».

**Arquitectura:**
- Firestore guarda un documento por quincena y solo se toca desde el servidor de Next.js, con el Admin SDK. Las reglas niegan todo al navegador.
- Una función pura (`lib/reales/mes.ts`) consolida el mes a partir de sus quincenas. La usan la fuente de datos y la pantalla de captura.
- Guardar es una Server Action que comprueba la contraseña, valida, escribe las dos quincenas de un golpe y llama a `revalidatePath('/')`.
- La página se renderiza en cada petición (`connection()`), sin caché de reales entre peticiones.

**Tecnología:** Next.js 16.3.4 (App Router, Turbopack), React 19.2, TypeScript, `firebase-admin` 14.4.0, Vitest 5.0.1, Recharts 3.8, Tailwind v4, CLI de Firebase 15.3.1 y MCP de Firebase.

**Especificación:** `docs/superpowers/specs/2026-09-15-captura-persistente-design.md`

## Restricciones globales

- **Next.js 16 no es el que conoces.** Antes de usar una API de Next hay que leer su guía en `node_modules/next/dist/docs/` (lo dice `AGENTS.md`).
  - `revalidateTag` sin segundo argumento está en desuso.
  - `updateTag` solo cubre las etiquetas de `fetch` y de `'use cache'`.
  - La página se hace dinámica con `await connection()` (de `next/server`).
- **Sin commits.** El usuario hace los commits y el push cuando decide. Ninguna tarea termina en `git commit`.
- **Firebase:**
  - Proyecto `funnel-de-ventas-bf`, base `(default)` en `us-east4`.
  - Colección `quincenas` en producción. En local, `FIRESTORE_COLECCION=quincenas-dev`.
- **Variables de entorno:**
  - `FIREBASE_PROJECT_ID`, `FIREBASE_CLIENT_EMAIL` y `FIREBASE_PRIVATE_KEY`.
  - `FIRESTORE_COLECCION`, opcional.
  - `CLAVE_CAPTURA`.
  - La clave privada no se escribe jamás en un archivo que vaya a Git ni en este plan.
- **Vacío no es cero:** una casilla vacía no se guarda; un 0 sí es un dato.
- **Contraseña:** se pide en cada guardado, nunca se recuerda y nunca llega al código del navegador. Se compara en tiempo constante y un fallo espera 1,5 s.
- **Vocabulario de estados (ya vigente):** En plan / Al límite / Fuera de plan / Sin dato (`ETIQUETAS_ESTADO`).
- **Estilo de la casa:**
  - Comentarios y textos en castellano, con la voz de los comentarios existentes: explican el porqué.
  - `cn` fusiona como tailwind-merge, así que `leading-none` va después del tamaño de letra.
  - Nada de píldoras de estado ni insignias de kit.
- **Verificación:** `npx tsc --noEmit`, `npx eslint <archivos>` y `npm test` limpios, y la consola del navegador sin errores.

---

### Tarea 1: Firestore y configuración local

**Archivos:**
- Crear (con el MCP): `firebase.json`, `firestore.rules` y `firestore.indexes.json`.
- Modificar: `.gitignore` y `.env.local` (añadir al final, sin leer lo que ya tiene).

**Interfaces:**
- Produce: la base `(default)` creada con las reglas desplegadas, y las variables locales `FIREBASE_*`, `FIRESTORE_COLECCION=quincenas-dev` y `CLAVE_CAPTURA=prueba-local-2026`.

- [ ] **Paso 1: Inicializar Firestore con el MCP.** `firebase_init` con `features.firestore`, `location_id: "us-east4"` y estas reglas:

```
rules_version = '2';

// Nadie entra desde el navegador. El tablero lee y escribe desde el servidor
// con el Admin SDK, que no pasa por estas reglas.
service cloud.firestore {
  match /databases/{database}/documents {
    match /{document=**} {
      allow read, write: if false;
    }
  }
}
```

- [ ] **Paso 2: Desplegar las reglas y crear la base.**

Ejecutar: `firebase deploy --only firestore --project funnel-de-ventas-bf --non-interactive`
Esperado: `Deploy complete!`.

- [ ] **Paso 3: Comprobar que la base existe.**

Ejecutar: `firebase firestore:databases:list --project funnel-de-ventas-bf`
Esperado: aparece `(default)` en `us-east4`.

- [ ] **Paso 4: Ignorar en Git la clave y los restos de la CLI.** Añadir al final de `.gitignore`:

```
# firebase
*firebase-adminsdk*.json
.firebase/
firebase-debug.log
firestore-debug.log
```

- [ ] **Paso 5: Añadir las variables al final de `.env.local`** con un heredoc, con los valores del JSON de la cuenta de servicio que dio el usuario. La clave va entre comillas dobles y con los `\n` literales, tal cual vienen en el JSON:

```
# Firebase (Admin SDK), proyecto funnel-de-ventas-bf. Solo servidor.
FIREBASE_PROJECT_ID=funnel-de-ventas-bf
FIREBASE_CLIENT_EMAIL=<client_email del JSON>
FIREBASE_PRIVATE_KEY="<private_key del JSON>"
# En local, otra colección: las pruebas no tocan los datos de producción.
FIRESTORE_COLECCION=quincenas-dev
# Contraseña de captura SOLO para local. La real vive en Vercel.
CLAVE_CAPTURA=prueba-local-2026
```

Comprobar (solo nombres, sin valores): `grep -oE '^[A-Z_]+=' .env.local`
Esperado: aparecen las cinco variables nuevas junto a las `AZURE_*` y `SHAREPOINT_PLAN_URL`.

---

### Tarea 2: Vitest y la regla del mes (`lib/reales/mes.ts`)

**Archivos:**
- Crear: `vitest.config.ts`, `lib/reales/mes.ts` y `lib/reales/mes.test.ts`.
- Modificar: `package.json` (dependencia de desarrollo y script `test`).

**Interfaces:**
- Produce:
  - `type ValoresPorQuincena = Record<string, Record<string, number>>`
  - `type Cobertura = 'q1' | 'q2'`
  - `interface ResumenMes { real: number | null; meta: number | null }`
  - `idsDeQuincenas(mesId: string): [string, string]`
  - `resumirMes(q1, q2, metaQ1, metaQ2, metaMes): ResumenMes`, todos `number | null`
  - `coberturaDelMes(mesId: string, quincenas: ValoresPorQuincena): Cobertura | null`
  - `realesDelPeriodo(periodo: Periodo, quincenas: ValoresPorQuincena): Real[]`
  - `metasDelMes(mesId: string, metasMes: readonly Meta[], metasQ1: readonly Meta[], metasQ2: readonly Meta[], quincenas: ValoresPorQuincena): Meta[]`

- [ ] **Paso 1: Instalar Vitest.**

Ejecutar: `npm install -D vitest@5.0.1`
Añadir a `scripts` de `package.json`: `"test": "vitest run"`.

- [ ] **Paso 2: Crear `vitest.config.ts`.**

```ts
import { fileURLToPath } from 'node:url'
import { defineConfig } from 'vitest/config'

// Solo las funciones puras: lo que habla con Firebase o con Next se prueba
// de punta a punta, no con dobles.
export default defineConfig({
  resolve: {
    alias: { '@': fileURLToPath(new URL('./', import.meta.url)) },
  },
  test: {
    environment: 'node',
    include: ['lib/**/*.test.ts', 'components/**/*.test.ts'],
  },
})
```

- [ ] **Paso 3: Escribir las pruebas que fallan, en `lib/reales/mes.test.ts`.**

```ts
import { describe, expect, it } from 'vitest'

import type { Meta, Periodo } from '@/lib/tipos'
import { construirPeriodoMes, construirPeriodoQuincena } from '@/lib/periodos'
import {
  coberturaDelMes,
  idsDeQuincenas,
  metasDelMes,
  realesDelPeriodo,
  resumirMes,
  type ValoresPorQuincena,
} from '@/lib/reales/mes'

const meta = (periodoId: string, indicadorId: string, valor: number): Meta => ({
  periodoId,
  indicadorId,
  valor,
})

describe('idsDeQuincenas', () => {
  it('da los ids de las dos quincenas del mes', () => {
    expect(idsDeQuincenas('2026-09')).toEqual(['2026-09-Q1', '2026-09-Q2'])
  })
})

describe('resumirMes', () => {
  it('con las dos quincenas suma y compara con el plan del mes entero', () => {
    expect(resumirMes(50, 53, 72, 73, 145)).toEqual({ real: 103, meta: 145 })
  })
  it('con solo la 1ª compara con la meta de la 1ª', () => {
    expect(resumirMes(50, null, 72, 73, 145)).toEqual({ real: 50, meta: 72 })
  })
  it('con solo la 2ª compara con la meta de la 2ª', () => {
    expect(resumirMes(null, 53, 72, 73, 145)).toEqual({ real: 53, meta: 73 })
  })
  it('sin ninguna no hay real y el plan es el del mes', () => {
    expect(resumirMes(null, null, 72, 73, 145)).toEqual({ real: null, meta: 145 })
  })
  it('un 0 es un dato, no un vacío', () => {
    expect(resumirMes(0, null, 72, 73, 145)).toEqual({ real: 0, meta: 72 })
  })
  it('suma importes al céntimo', () => {
    expect(resumirMes(0.1, 0.2, 1, 1, 2).real).toBe(0.3)
  })
})

describe('coberturaDelMes', () => {
  it('solo 1ª quincena con datos: en curso hasta el 15', () => {
    const q: ValoresPorQuincena = { '2026-09-Q1': { eleads: 50 } }
    expect(coberturaDelMes('2026-09', q)).toBe('q1')
  })
  it('solo 2ª quincena con datos', () => {
    const q: ValoresPorQuincena = { '2026-09-Q2': { eleads: 50 } }
    expect(coberturaDelMes('2026-09', q)).toBe('q2')
  })
  it('las dos con datos: mes completo', () => {
    const q: ValoresPorQuincena = { '2026-09-Q1': { eleads: 50 }, '2026-09-Q2': { eleads: 53 } }
    expect(coberturaDelMes('2026-09', q)).toBeNull()
  })
  it('ninguna, o un documento vacío: sin marca', () => {
    expect(coberturaDelMes('2026-09', {})).toBeNull()
    expect(coberturaDelMes('2026-09', { '2026-09-Q1': {} })).toBeNull()
  })
})

describe('realesDelPeriodo', () => {
  const quincenas: ValoresPorQuincena = {
    '2026-09-Q1': { eleads: 50, ventas: 2 },
    '2026-09-Q2': { eleads: 53 },
  }

  it('una quincena devuelve lo guardado tal cual', () => {
    const q1: Periodo = construirPeriodoQuincena(2026, 9, 1)
    expect(realesDelPeriodo(q1, quincenas)).toEqual([
      { periodoId: '2026-09-Q1', indicadorId: 'eleads', valor: 50, origen: 'manual' },
      { periodoId: '2026-09-Q1', indicadorId: 'ventas', valor: 2, origen: 'manual' },
    ])
  })

  it('el mes suma lo que hay, indicador a indicador', () => {
    const mes = construirPeriodoMes(2026, 9)
    expect(realesDelPeriodo(mes, quincenas)).toEqual([
      { periodoId: '2026-09', indicadorId: 'eleads', valor: 103, origen: 'manual' },
      { periodoId: '2026-09', indicadorId: 'ventas', valor: 2, origen: 'manual' },
    ])
  })

  it('un mes sin quincenas no tiene reales', () => {
    expect(realesDelPeriodo(construirPeriodoMes(2026, 10), quincenas)).toEqual([])
  })
})

describe('metasDelMes', () => {
  const metasMes = [meta('2026-09', 'eleads', 145), meta('2026-09', 'ventas', 5)]
  const metasQ1 = [meta('2026-09-Q1', 'eleads', 72), meta('2026-09-Q1', 'ventas', 2)]
  const metasQ2 = [meta('2026-09-Q2', 'eleads', 73), meta('2026-09-Q2', 'ventas', 3)]

  it('mes a medias: la meta de lo que ya pasó', () => {
    const q: ValoresPorQuincena = { '2026-09-Q1': { eleads: 50 } }
    expect(metasDelMes('2026-09', metasMes, metasQ1, metasQ2, q)).toEqual([
      meta('2026-09', 'eleads', 72),
      meta('2026-09', 'ventas', 5),
    ])
  })

  it('mes completo o sin datos: la meta del mes entero', () => {
    const completo: ValoresPorQuincena = {
      '2026-09-Q1': { eleads: 50 },
      '2026-09-Q2': { eleads: 53 },
    }
    expect(metasDelMes('2026-09', metasMes, metasQ1, metasQ2, completo)).toEqual(metasMes)
    expect(metasDelMes('2026-09', metasMes, metasQ1, metasQ2, {})).toEqual(metasMes)
  })
})
```

- [ ] **Paso 4: Comprobar que fallan.**

Ejecutar: `npm test`
Esperado: FALLA con `Failed to resolve import "@/lib/reales/mes"`.

- [ ] **Paso 5: Implementar `lib/reales/mes.ts`.**

```ts
/**
 * El mes, a partir de sus quincenas.
 *
 * Los reales se capturan por quincena; el mes no se guarda, se calcula aquí.
 * Es una función pura a propósito: la usan la fuente de datos (el tablero)
 * y la pantalla de captura, y si cada una hiciera su cuenta acabarían
 * diciendo cosas distintas.
 *
 * ── La regla ─────────────────────────────────────────────────────────────
 * Para cada indicador, el real del mes es la suma de las quincenas que
 * tienen dato, y se compara con la meta de ESAS quincenas: con las dos, el
 * plan del mes entero; con una sola, el de esa quincena. Así un mes a medias
 * se lee «a la fecha» y no sale «Fuera de plan» solo por estar a medias.
 * Se pidió así: «si ahora mismo quisiera ver septiembre, me mostraría el
 * mes como la primera quincena nomás».
 *
 * Vacío no es cero: una quincena sin dato no suma ni cuenta para el plan;
 * una quincena con 0 sí.
 */

import type { Meta, Periodo, Real } from '@/lib/tipos'

/** Id de quincena ('2026-09-Q1') → id de indicador → valor real. */
export type ValoresPorQuincena = Record<string, Record<string, number>>

/** En un mes a medias, qué quincena tiene datos. */
export type Cobertura = 'q1' | 'q2'

export interface ResumenMes {
  real: number | null
  meta: number | null
}

/** '2026-09' → ['2026-09-Q1', '2026-09-Q2']. */
export function idsDeQuincenas(mesId: string): [string, string] {
  return [`${mesId}-Q1`, `${mesId}-Q2`]
}

/** Al céntimo: sumar dos importes en coma flotante deja colas (0,1 + 0,2). */
function alCentimo(n: number): number {
  return Math.round(n * 100) / 100
}

/** La regla de un indicador en un mes. */
export function resumirMes(
  q1: number | null,
  q2: number | null,
  metaQ1: number | null,
  metaQ2: number | null,
  metaMes: number | null,
): ResumenMes {
  if (q1 !== null && q2 !== null) return { real: alCentimo(q1 + q2), meta: metaMes }
  if (q1 !== null) return { real: q1, meta: metaQ1 }
  if (q2 !== null) return { real: q2, meta: metaQ2 }
  return { real: null, meta: metaMes }
}

function valorDe(valores: Record<string, number> | undefined, indicadorId: string): number | null {
  const valor = valores?.[indicadorId]
  return typeof valor === 'number' && Number.isFinite(valor) ? valor : null
}

function tieneDatos(valores: Record<string, number> | undefined): boolean {
  return valores !== undefined && Object.keys(valores).length > 0
}

/**
 * Un mes está en curso cuando solo una de sus quincenas tiene algún dato.
 * La interfaz lo marca («hasta el 15») para que nadie lo lea como cerrado.
 */
export function coberturaDelMes(mesId: string, quincenas: ValoresPorQuincena): Cobertura | null {
  const [idQ1, idQ2] = idsDeQuincenas(mesId)
  const hayQ1 = tieneDatos(quincenas[idQ1])
  const hayQ2 = tieneDatos(quincenas[idQ2])
  if (hayQ1 && !hayQ2) return 'q1'
  if (hayQ2 && !hayQ1) return 'q2'
  return null
}

/** Los reales de un periodo: los de la quincena, o la suma del mes. */
export function realesDelPeriodo(periodo: Periodo, quincenas: ValoresPorQuincena): Real[] {
  if (periodo.tipo === 'quincena') {
    return Object.entries(quincenas[periodo.id] ?? {}).map(([indicadorId, valor]) => ({
      periodoId: periodo.id,
      indicadorId,
      valor,
      origen: 'manual' as const,
    }))
  }

  const [idQ1, idQ2] = idsDeQuincenas(periodo.id)
  const ids = new Set([
    ...Object.keys(quincenas[idQ1] ?? {}),
    ...Object.keys(quincenas[idQ2] ?? {}),
  ])
  const reales: Real[] = []
  for (const indicadorId of ids) {
    const { real } = resumirMes(
      valorDe(quincenas[idQ1], indicadorId),
      valorDe(quincenas[idQ2], indicadorId),
      null,
      null,
      null,
    )
    if (real !== null) reales.push({ periodoId: periodo.id, indicadorId, valor: real, origen: 'manual' })
  }
  return reales
}

/**
 * Las metas de un mes, ajustadas a lo que ya pasó: en un indicador con una
 * sola quincena capturada, la meta es la de esa quincena.
 */
export function metasDelMes(
  mesId: string,
  metasMes: readonly Meta[],
  metasQ1: readonly Meta[],
  metasQ2: readonly Meta[],
  quincenas: ValoresPorQuincena,
): Meta[] {
  const [idQ1, idQ2] = idsDeQuincenas(mesId)
  const metaQ1 = new Map(metasQ1.map((m) => [m.indicadorId, m.valor]))
  const metaQ2 = new Map(metasQ2.map((m) => [m.indicadorId, m.valor]))

  return metasMes.map((m) => {
    const { meta } = resumirMes(
      valorDe(quincenas[idQ1], m.indicadorId),
      valorDe(quincenas[idQ2], m.indicadorId),
      metaQ1.get(m.indicadorId) ?? null,
      metaQ2.get(m.indicadorId) ?? null,
      m.valor,
    )
    return meta === null || meta === m.valor ? m : { ...m, valor: meta }
  })
}
```

- [ ] **Paso 6: Comprobar que pasan.**

Ejecutar: `npm test`
Esperado: PASA (todas las pruebas de `mes.test.ts`).

---

### Tarea 3: Contraseña y validación de valores (puras)

**Archivos:**
- Crear: `lib/reales/clave.ts`, `lib/reales/clave.test.ts`, `lib/reales/validar.ts` y `lib/reales/validar.test.ts`.

**Interfaces:**
- Produce:
  - `claveValida(recibida: string, esperada: string | undefined): boolean`
  - `PATRON_MES: RegExp`
  - `type ResultadoLimpieza = { ok: true; valores: Record<string, number> } | { ok: false; mensaje: string }`
  - `limpiarValores(entrada: unknown, idsValidos: ReadonlySet<string>): ResultadoLimpieza`

- [ ] **Paso 1: Pruebas que fallan, `lib/reales/clave.test.ts`.**

```ts
import { describe, expect, it } from 'vitest'

import { claveValida } from '@/lib/reales/clave'

describe('claveValida', () => {
  it('acepta la contraseña correcta', () => {
    expect(claveValida('prueba-local-2026', 'prueba-local-2026')).toBe(true)
  })
  it('rechaza una incorrecta, también de otra longitud', () => {
    expect(claveValida('otra', 'prueba-local-2026')).toBe(false)
    expect(claveValida('prueba-local-2026x', 'prueba-local-2026')).toBe(false)
  })
  it('falla cerrado si la variable no existe o está vacía', () => {
    expect(claveValida('', undefined)).toBe(false)
    expect(claveValida('', '')).toBe(false)
    expect(claveValida('algo', undefined)).toBe(false)
  })
})
```

- [ ] **Paso 2: Pruebas que fallan, `lib/reales/validar.test.ts`.**

```ts
import { describe, expect, it } from 'vitest'

import { PATRON_MES, limpiarValores } from '@/lib/reales/validar'

const ids = new Set(['eleads', 'ventas'])

describe('limpiarValores', () => {
  it('acepta números ≥ 0 y los deja al céntimo', () => {
    expect(limpiarValores({ eleads: 50, ventas: 2.005 }, ids)).toEqual({
      ok: true,
      valores: { eleads: 50, ventas: 2.01 },
    })
  })
  it('acepta el 0 y el objeto vacío', () => {
    expect(limpiarValores({ eleads: 0 }, ids)).toEqual({ ok: true, valores: { eleads: 0 } })
    expect(limpiarValores({}, ids)).toEqual({ ok: true, valores: {} })
  })
  it('rechaza indicadores que no están en el plan', () => {
    expect(limpiarValores({ inventado: 1 }, ids).ok).toBe(false)
  })
  it('rechaza negativos, NaN, infinitos y textos', () => {
    expect(limpiarValores({ eleads: -1 }, ids).ok).toBe(false)
    expect(limpiarValores({ eleads: Number.NaN }, ids).ok).toBe(false)
    expect(limpiarValores({ eleads: Number.POSITIVE_INFINITY }, ids).ok).toBe(false)
    expect(limpiarValores({ eleads: '5' }, ids).ok).toBe(false)
  })
  it('rechaza lo que no es un objeto', () => {
    expect(limpiarValores(null, ids).ok).toBe(false)
    expect(limpiarValores([1, 2], ids).ok).toBe(false)
    expect(limpiarValores('eleads', ids).ok).toBe(false)
  })
})

describe('PATRON_MES', () => {
  it('reconoce ids de mes y rechaza el resto', () => {
    expect(PATRON_MES.test('2026-09')).toBe(true)
    expect(PATRON_MES.test('2026-13')).toBe(false)
    expect(PATRON_MES.test('2026-09-Q1')).toBe(false)
  })
})
```

- [ ] **Paso 3: Comprobar que fallan.**

Ejecutar: `npm test`
Esperado: FALLA en `clave.test.ts` y `validar.test.ts` por los imports que aún no existen.

- [ ] **Paso 4: Implementar `lib/reales/clave.ts`.**

```ts
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
```

- [ ] **Paso 5: Implementar `lib/reales/validar.ts`.**

```ts
/**
 * Lo que llega del navegador no se cree: se comprueba.
 *
 * La Server Action es una puerta pública. Aunque la pantalla de captura solo
 * deja teclear números ≥ 0 con dos decimales, a la acción se le puede llamar
 * con cualquier cosa. Aquí se exige lo mismo que en la pantalla y se rechaza
 * lo que no encaja, sin arreglarlo en silencio.
 */

/** Id de mes: '2026-09'. Nada de quincenas ni de meses imposibles. */
export const PATRON_MES = /^\d{4}-(0[1-9]|1[0-2])$/

export type ResultadoLimpieza =
  | { ok: true; valores: Record<string, number> }
  | { ok: false; mensaje: string }

export function limpiarValores(entrada: unknown, idsValidos: ReadonlySet<string>): ResultadoLimpieza {
  if (typeof entrada !== 'object' || entrada === null || Array.isArray(entrada)) {
    return { ok: false, mensaje: 'Los valores no tienen el formato esperado.' }
  }

  const valores: Record<string, number> = {}
  for (const [indicadorId, valor] of Object.entries(entrada)) {
    if (!idsValidos.has(indicadorId)) {
      return { ok: false, mensaje: `El indicador «${indicadorId}» no está en el plan.` }
    }
    if (typeof valor !== 'number' || !Number.isFinite(valor) || valor < 0) {
      return { ok: false, mensaje: `El valor de «${indicadorId}» no es un número válido.` }
    }
    valores[indicadorId] = Math.round(valor * 100) / 100
  }
  return { ok: true, valores }
}
```

- [ ] **Paso 6: Comprobar que pasan.**

Ejecutar: `npm test`
Esperado: PASA (`mes`, `clave` y `validar`).

---

### Tarea 4: El almacén en Firestore (`lib/reales/almacen.ts`)

**Archivos:**
- Crear: `lib/reales/almacen.ts`.
- Modificar: `package.json` (dependencia `firebase-admin`).

**Interfaces:**
- Consume: `ValoresPorQuincena` (Tarea 2).
- Produce:
  - `leerQuincenas(): Promise<ValoresPorQuincena>`, con `cache` de React.
  - `interface EstadoQuincenas { quincenas: ValoresPorQuincena; error: string | null }`
  - `estadoDeQuincenas(): Promise<EstadoQuincenas>`, con `cache` de React; nunca lanza.
  - `guardarQuincenas(documentos: ValoresPorQuincena): Promise<void>`

- [ ] **Paso 1: Instalar el Admin SDK.**

Ejecutar: `npm install firebase-admin@14.4.0`
No hace falta tocar `next.config.ts`: `firebase-admin` está en la lista por defecto de `serverExternalPackages` (ver `node_modules/next/dist/docs/01-app/03-api-reference/05-config/01-next-config-js/serverExternalPackages.md`).

- [ ] **Paso 2: Implementar `lib/reales/almacen.ts`.**

```ts
/**
 * Los reales, en Firestore.
 *
 * Un documento por quincena en la colección `quincenas` (en local,
 * `quincenas-dev`), con id el del periodo ('2026-09-Q1') y el campo
 * `valores`: id de indicador → número. Vacío no es cero: una casilla vacía
 * no se guarda.
 *
 * Solo el servidor habla con Firestore, con el Admin SDK. Las reglas de la
 * base niegan todo al navegador: sin cuentas de usuario no habría forma
 * segura de dejarle entrar.
 *
 * Sin caché entre peticiones, a propósito: lo guardado tiene que verse al
 * recargar. `cache` de React solo evita repetir la lectura dentro de una
 * misma petición, donde la piden la fuente de datos y la página.
 */

import 'server-only'

import { cache } from 'react'
import { cert, getApps, initializeApp, type App } from 'firebase-admin/app'
import { FieldValue, getFirestore } from 'firebase-admin/firestore'

import type { ValoresPorQuincena } from '@/lib/reales/mes'

/** Falta una variable: se dice cuál, no «algo salió mal». */
function exigir(nombre: string): string {
  const valor = process.env[nombre]
  if (!valor) {
    throw new Error(`Falta ${nombre}. Los resultados se guardan en Firebase y sin esa variable no hay forma de entrar.`)
  }
  return valor
}

/** Una sola instancia por proceso: inicializar dos veces lanza. */
function aplicacion(): App {
  return (
    getApps()[0] ??
    initializeApp({
      credential: cert({
        projectId: exigir('FIREBASE_PROJECT_ID'),
        clientEmail: exigir('FIREBASE_CLIENT_EMAIL'),
        // En Vercel y en .env la clave suele llegar con los saltos de línea
        // escritos como «\n»; el certificado los necesita de verdad.
        privateKey: exigir('FIREBASE_PRIVATE_KEY').replace(/\\n/g, '\n'),
      }),
    })
  )
}

function coleccion() {
  return getFirestore(aplicacion()).collection(process.env.FIRESTORE_COLECCION || 'quincenas')
}

/** Solo números finitos: lo que no lo sea se ignora, no se inventa. */
function valoresDe(dato: unknown): Record<string, number> {
  if (typeof dato !== 'object' || dato === null) return {}
  const valores: Record<string, number> = {}
  for (const [indicadorId, valor] of Object.entries(dato)) {
    if (typeof valor === 'number' && Number.isFinite(valor)) valores[indicadorId] = valor
  }
  return valores
}

export const leerQuincenas = cache(async (): Promise<ValoresPorQuincena> => {
  const instantanea = await coleccion().get()
  const quincenas: ValoresPorQuincena = {}
  for (const documento of instantanea.docs) {
    quincenas[documento.id] = valoresDe(documento.get('valores'))
  }
  return quincenas
})

export interface EstadoQuincenas {
  quincenas: ValoresPorQuincena
  /** Por qué no se pudieron leer, o null si se leyeron. */
  error: string | null
}

/**
 * La lectura que usa el tablero: nunca lanza. Si Firestore falla, el plan se
 * sigue enseñando sin reales y el motivo sube hasta un aviso en pantalla.
 * Nunca se cae a datos de ejemplo: un tablero que miente en silencio es peor
 * que uno que avisa.
 */
export const estadoDeQuincenas = cache(async (): Promise<EstadoQuincenas> => {
  try {
    return { quincenas: await leerQuincenas(), error: null }
  } catch (error) {
    console.error('[reales] No se pudieron leer las quincenas de Firestore:', error)
    return { quincenas: {}, error: error instanceof Error ? error.message : String(error) }
  }
})

/**
 * Reemplaza enteros los documentos de las quincenas indicadas, de un golpe:
 * o se guardan todas o ninguna. Reemplazar (y no fusionar) es lo que hace
 * que una cifra borrada en la captura desaparezca también aquí.
 */
export async function guardarQuincenas(documentos: ValoresPorQuincena): Promise<void> {
  const destino = coleccion()
  const lote = destino.firestore.batch()
  for (const [id, valores] of Object.entries(documentos)) {
    lote.set(destino.doc(id), { valores, actualizadoEn: FieldValue.serverTimestamp() })
  }
  await lote.commit()
}
```

- [ ] **Paso 3: Tipos.**

Ejecutar: `npx tsc --noEmit`
Esperado: sin errores. Firestore se prueba de punta a punta en la Tarea 5, al cargar la página.

---

### Tarea 5: La fuente de datos lee Firestore; el mes en curso; la página dinámica

**Archivos:**
- Modificar: `lib/tipos.ts`, `lib/periodos.ts`, `lib/plan/fuente.ts` y `app/page.tsx`.
- Crear: `lib/periodos.test.ts`.
- Borrar: `lib/plan/reales-ejemplo.ts`.

**Interfaces:**
- Consume: `estadoDeQuincenas` (Tarea 4); `coberturaDelMes`, `idsDeQuincenas`, `metasDelMes` y `realesDelPeriodo` (Tarea 2).
- Produce:
  - `Periodo.cobertura?: 'q1' | 'q2'`
  - `marcaCobertura(p: Periodo): string | null`
  - `etiquetaConCobertura(p: Periodo): string`
  - La prop `errorReales: string | null` que la página pasa a `<Tablero>`.

- [ ] **Paso 1: Pruebas que fallan, `lib/periodos.test.ts`.**

```ts
import { describe, expect, it } from 'vitest'

import { construirPeriodoMes, etiquetaConCobertura, marcaCobertura } from '@/lib/periodos'

describe('marca del mes en curso', () => {
  const septiembre = construirPeriodoMes(2026, 9)

  it('sin cobertura no hay marca', () => {
    expect(marcaCobertura(septiembre)).toBeNull()
    expect(etiquetaConCobertura(septiembre)).toBe(septiembre.etiqueta)
  })
  it('solo 1ª quincena: hasta el 15', () => {
    const enCurso = { ...septiembre, cobertura: 'q1' as const }
    expect(marcaCobertura(enCurso)).toBe('hasta el 15')
    expect(etiquetaConCobertura(enCurso)).toBe(`${septiembre.etiqueta} · hasta el 15`)
  })
  it('solo 2ª quincena: desde el 16', () => {
    expect(marcaCobertura({ ...septiembre, cobertura: 'q2' })).toBe('desde el 16')
  })
})
```

Ejecutar: `npm test`
Esperado: FALLA (`marcaCobertura` no existe).

- [ ] **Paso 2: `lib/tipos.ts`: añadir la cobertura a `Periodo`** (después de `etiquetaCorta`):

```ts
  /**
   * Solo en un mes a medias: qué quincena tiene datos. 'q1' ⇒ el mes se lee
   * «hasta el 15». Lo pone la fuente de datos al leer los reales.
   */
  cobertura?: 'q1' | 'q2'
```

Y en el comentario de `FuenteDatos`, junto a `metas`:

```ts
  /** Metas del plan. En un mes en curso, las de lo que ya pasó (ver lib/reales/mes.ts). */
  metas(periodoId: string): Promise<Meta[]>
```

- [ ] **Paso 3: `lib/periodos.ts`: añadir al final.**

```ts
// ── Mes en curso ────────────────────────────────────────────────────────

/** «hasta el 15» o «desde el 16» si el mes está a medias; null si no. */
export function marcaCobertura(p: Periodo): string | null {
  if (p.cobertura === 'q1') return 'hasta el 15'
  if (p.cobertura === 'q2') return 'desde el 16'
  return null
}

/** La etiqueta con su marca: «Septiembre 2026 · hasta el 15». */
export function etiquetaConCobertura(p: Periodo): string {
  const marca = marcaCobertura(p)
  return marca ? `${p.etiqueta} · ${marca}` : p.etiqueta
}
```

Ejecutar: `npm test`
Esperado: PASA.

- [ ] **Paso 4: `lib/plan/fuente.ts`: los reales salen de Firestore.**

1. En el comentario de cabecera, cambiar «Los reales son de ejemplo mientras la captura no persista; el día que lo haga, solo cambia `reales()`.» por:

```ts
 * El plan es real y viene de SharePoint. Los reales salen de Firestore
 * (`lib/reales/almacen.ts`), quincena a quincena; el mes se calcula con la
 * regla de `lib/reales/mes.ts`.
```

2. Sustituir `import { realesDeEjemplo } from '@/lib/plan/reales-ejemplo'` por:

```ts
import { estadoDeQuincenas } from '@/lib/reales/almacen'
import { coberturaDelMes, idsDeQuincenas, metasDelMes, realesDelPeriodo } from '@/lib/reales/mes'
```

3. Sustituir `periodos`, `metas` y `reales` de `fuenteExcel` por:

```ts
  /**
   * Del más reciente al más antiguo: es lo que espera el contrato. Los meses
   * a medias llevan su cobertura, para que la interfaz los marque.
   */
  async periodos(): Promise<Periodo[]> {
    const [plan, { quincenas }] = await Promise.all([obtenerPlan(), estadoDeQuincenas()])
    return plan.periodos
      .map((p) => {
        if (p.tipo !== 'mes') return p
        const cobertura = coberturaDelMes(p.id, quincenas)
        return cobertura ? { ...p, cobertura } : p
      })
      .sort((a, b) => compararPeriodos(b, a))
  },

  /** En un mes en curso, la meta es la de lo que ya pasó. */
  async metas(periodoId: string): Promise<Meta[]> {
    const [plan, { quincenas }] = await Promise.all([obtenerPlan(), estadoDeQuincenas()])
    const delPeriodo = (id: string) => plan.metas.filter((m) => m.periodoId === id)
    const metas = delPeriodo(periodoId)
    const periodo = plan.periodos.find((p) => p.id === periodoId)
    if (periodo?.tipo !== 'mes') return metas
    const [idQ1, idQ2] = idsDeQuincenas(periodoId)
    return metasDelMes(periodoId, metas, delPeriodo(idQ1), delPeriodo(idQ2), quincenas)
  },

  async reales(periodoId: string): Promise<Real[]> {
    const [plan, { quincenas }] = await Promise.all([obtenerPlan(), estadoDeQuincenas()])
    const periodo = plan.periodos.find((p) => p.id === periodoId)
    return periodo ? realesDelPeriodo(periodo, quincenas) : []
  },
```

- [ ] **Paso 5: Borrar `lib/plan/reales-ejemplo.ts`.** Comprobar que nadie más lo importa: `grep -rn "reales-ejemplo" app components lib` no debe devolver nada.

- [ ] **Paso 6: `app/page.tsx`: dinámica y con el estado de los reales.**

1. Imports:

```ts
import { connection } from 'next/server'

import { estadoDeQuincenas } from '@/lib/reales/almacen'
```

2. En `leerTodo`, pedir también el estado de los reales y devolver su error:

```ts
  const [indicadores, periodos, procedencia, reales] = await Promise.all([
    fuente.indicadores(),
    fuente.periodos(),
    procedenciaDelPlan(),
    estadoDeQuincenas(),
  ])
```

```ts
  return {
    indicadores,
    periodos,
    metasPorPeriodo,
    realesPorPeriodo,
    procedencia,
    errorReales: reales.error,
  }
```

3. Al principio de `Pagina`:

```ts
  // Cada petición se renderiza de nuevo: lo guardado en la captura tiene que
  // verse al recargar, no cuando caduque una caché.
  await connection()
```

4. Desestructurar `errorReales` y pasarlo: `<Tablero … errorReales={errorReales} />`. En `components/tablero.tsx`, añadir a `DatosPrecargados`:

```ts
  /** Por qué no se pudieron leer los resultados guardados, o null. */
  errorReales?: string | null
```

Y desestructurar `errorReales = null` en `Tablero`. El aviso llega en la Tarea 7.

- [ ] **Paso 7: Comprobar de punta a punta.**

Ejecutar: `npx tsc --noEmit`, `npm test` y `npx eslint lib app components/tablero.tsx`.
Después, con `npm run dev` y la colección de pruebas vacía, cargar `http://localhost:3000`.
Esperado:
- No aparece ningún real de ejemplo. Los meses salen «sin resultado» con su plan como previsto.
- No hay aviso de error en la consola del servidor ni en la del navegador.

---

### Tarea 6: La Server Action `guardarMes`

**Archivos:**
- Crear: `app/captura/acciones.ts`.

**Interfaces:**
- Consume: `claveValida` y `PATRON_MES`/`limpiarValores` (Tarea 3); `guardarQuincenas` (Tarea 4); `idsDeQuincenas` (Tarea 2); `fuenteExcel` (Tarea 5).
- Produce:
  - `type ResultadoGuardado = { ok: true } | { ok: false; motivo: 'clave' | 'datos' | 'servidor'; mensaje: string }`
  - `guardarMes(entrada: { mesId: string; q1: Record<string, number>; q2: Record<string, number>; clave: string }): Promise<ResultadoGuardado>`

- [ ] **Paso 1: Leer la guía de Server Actions de esta versión:** `node_modules/next/dist/docs/01-app/02-guides/server-actions.md`, y `revalidatePath.md` en `03-api-reference/04-functions/`.

- [ ] **Paso 2: Implementar `app/captura/acciones.ts`.**

```ts
'use server'

/**
 * Guardar un mes de la captura: las dos quincenas de un golpe.
 *
 * Es una puerta pública —a una Server Action se la puede llamar desde fuera
 * de la pantalla—, así que no se da nada por bueno:
 *
 *   1. La contraseña primero. Si falla, se espera un segundo y medio antes de
 *      responder: probar contraseñas a ciegas deja de salir a cuenta.
 *   2. El mes tiene que existir en el plan y cada indicador también; cada
 *      valor, un número finito ≥ 0 con dos decimales como mucho.
 *   3. Las dos quincenas se reemplazan enteras y a la vez.
 *   4. `revalidatePath('/')` devuelve el tablero ya actualizado en la misma
 *      respuesta.
 */

import { revalidatePath } from 'next/cache'

import { fuenteExcel } from '@/lib/plan/fuente'
import { guardarQuincenas } from '@/lib/reales/almacen'
import { claveValida } from '@/lib/reales/clave'
import { idsDeQuincenas } from '@/lib/reales/mes'
import { PATRON_MES, limpiarValores } from '@/lib/reales/validar'

export type ResultadoGuardado =
  | { ok: true }
  | { ok: false; motivo: 'clave' | 'datos' | 'servidor'; mensaje: string }

const ESPERA_CLAVE_INCORRECTA_MS = 1500

export async function guardarMes(entrada: {
  mesId: string
  q1: Record<string, number>
  q2: Record<string, number>
  clave: string
}): Promise<ResultadoGuardado> {
  if (!claveValida(String(entrada?.clave ?? ''), process.env.CLAVE_CAPTURA)) {
    await new Promise((resolver) => setTimeout(resolver, ESPERA_CLAVE_INCORRECTA_MS))
    return { ok: false, motivo: 'clave', mensaje: 'Contraseña incorrecta.' }
  }

  const mesId = String(entrada.mesId ?? '')
  if (!PATRON_MES.test(mesId)) {
    return { ok: false, motivo: 'datos', mensaje: 'El mes no es válido.' }
  }

  try {
    const [periodos, indicadores] = await Promise.all([
      fuenteExcel.periodos(),
      fuenteExcel.indicadores(),
    ])
    if (!periodos.some((p) => p.id === mesId)) {
      return { ok: false, motivo: 'datos', mensaje: 'Ese mes no está en el plan.' }
    }

    const ids = new Set(indicadores.map((i) => i.id))
    const q1 = limpiarValores(entrada.q1, ids)
    if (!q1.ok) return { ok: false, motivo: 'datos', mensaje: q1.mensaje }
    const q2 = limpiarValores(entrada.q2, ids)
    if (!q2.ok) return { ok: false, motivo: 'datos', mensaje: q2.mensaje }

    const [idQ1, idQ2] = idsDeQuincenas(mesId)
    await guardarQuincenas({ [idQ1]: q1.valores, [idQ2]: q2.valores })
  } catch (error) {
    console.error('[captura] No se pudo guardar el mes', mesId, error)
    return {
      ok: false,
      motivo: 'servidor',
      mensaje: 'No se pudo guardar en Firebase. Inténtalo de nuevo en un momento.',
    }
  }

  revalidatePath('/')
  return { ok: true }
}
```

- [ ] **Paso 3: Tipos y lint.**

Ejecutar: `npx tsc --noEmit` y `npx eslint app/captura/acciones.ts`
Esperado: limpios. La acción se prueba desde la pantalla en la Tarea 7.

---

### Tarea 7: La pantalla de captura, el cuadro de la contraseña y el tablero

**Archivos:**
- Crear: `components/dialogo-clave.tsx`.
- Reescribir: `components/captura-manual.tsx`.
- Modificar: `components/tablero.tsx`.

**Interfaces:**
- Consume: `guardarMes` y `ResultadoGuardado` (Tarea 6); `resumirMes` e `idsDeQuincenas` (Tarea 2); `ultimoDiaDelMes` (`lib/periodos.ts`); `errorReales` (Tarea 5).
- Produce:
  - `<DialogoClave abierto guardando error cambios onConfirmar onCancelar />`
  - `<CapturaManual mes indicadores metasQ1 metasQ2 realesQ1 realesQ2 bloqueo onGuardar onCambiosPendientes />`

- [ ] **Paso 1: Crear `components/dialogo-clave.tsx`.**

```tsx
'use client'

/**
 * El cuadro que pide la contraseña antes de guardar.
 *
 * Es un <dialog> nativo abierto con showModal(): el navegador ya da el fondo
 * inerte, el foco atrapado dentro y Escape para cerrar. No hace falta una
 * librería para eso.
 *
 * El campo no está controlado por React: la contraseña se lee del formulario
 * al enviar y se borra del DOM tras un fallo. Así no vive en el estado de
 * ningún componente más tiempo del necesario.
 */

import { useEffect, useId, useRef } from 'react'
import { LockKeyIcon, WarningIcon } from '@phosphor-icons/react/ssr'

import { Input } from '@/components/ui/input'

export interface DialogoClaveProps {
  abierto: boolean
  guardando: boolean
  /** El motivo del último fallo («Contraseña incorrecta.»), o null. */
  error: string | null
  cambios: number
  onConfirmar: (clave: string) => void
  onCancelar: () => void
}

export function DialogoClave({
  abierto,
  guardando,
  error,
  cambios,
  onConfirmar,
  onCancelar,
}: DialogoClaveProps) {
  const dialogo = useRef<HTMLDialogElement>(null)
  const campo = useRef<HTMLInputElement>(null)
  const id = useId()

  useEffect(() => {
    const d = dialogo.current
    if (!d) return
    if (abierto && !d.open) d.showModal()
    if (!abierto && d.open) d.close()
  }, [abierto])

  // Tras un fallo, el campo se vacía y recupera el foco para volver a teclear.
  useEffect(() => {
    if (!error || !campo.current) return
    campo.current.value = ''
    campo.current.focus()
  }, [error])

  return (
    <dialog
      ref={dialogo}
      aria-labelledby={`${id}-titulo`}
      onCancel={(evento) => {
        evento.preventDefault()
        if (!guardando) onCancelar()
      }}
      className="m-auto w-[min(26rem,calc(100vw-2rem))] rounded-2xl border bg-card p-0 text-foreground shadow-[var(--sombra-alta)] backdrop:bg-[color-mix(in_oklab,var(--foreground)_32%,transparent)]"
      style={{ borderColor: 'var(--border)' }}
    >
      <form
        className="p-6"
        onSubmit={(evento) => {
          evento.preventDefault()
          const clave = String(new FormData(evento.currentTarget).get('clave') ?? '')
          if (clave) onConfirmar(clave)
        }}
      >
        <h2
          id={`${id}-titulo`}
          className="font-display flex items-center gap-2 text-xl leading-tight font-semibold"
        >
          <LockKeyIcon weight="duotone" aria-hidden="true" className="size-5 shrink-0 text-brand" />
          Confirmar cambios
        </h2>
        <p className="mt-2 text-sm text-muted-foreground">
          {cambios} {cambios === 1 ? 'cifra cambiada' : 'cifras cambiadas'}. Escribe la contraseña de
          captura para guardarlas.
        </p>

        <label htmlFor={`${id}-clave`} className="mt-5 block text-sm font-medium">
          Contraseña
        </label>
        <Input
          ref={campo}
          id={`${id}-clave`}
          name="clave"
          type="password"
          autoComplete="off"
          required
          disabled={guardando}
          aria-invalid={error ? true : undefined}
          aria-describedby={error ? `${id}-error` : undefined}
          className="mt-1.5 h-10"
        />
        {error && (
          <p
            id={`${id}-error`}
            role="alert"
            className="mt-2 flex items-center gap-1.5 text-xs"
            style={{ color: 'var(--estado-critico)' }}
          >
            <WarningIcon weight="duotone" aria-hidden="true" className="size-3.5 shrink-0" />
            {error}
          </p>
        )}

        <div className="mt-6 flex justify-end gap-2">
          <button
            type="button"
            onClick={onCancelar}
            disabled={guardando}
            className="h-10 rounded-full px-4 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground disabled:opacity-50"
          >
            Cancelar
          </button>
          <button
            type="submit"
            disabled={guardando}
            className="h-10 rounded-full bg-brand px-5 text-sm font-medium text-primary-foreground shadow-[var(--sombra-tray)] transition-colors hover:bg-[var(--brand-strong)] focus-visible:ring-3 focus-visible:ring-ring/50 disabled:opacity-60"
          >
            {guardando ? 'Guardando…' : 'Guardar'}
          </button>
        </div>
      </form>
    </dialog>
  )
}
```

Antes de usar `ref` en `Input`, comprobar que `components/ui/input.tsx` pasa las props al `<input>`. En React 19 `ref` es una prop más. Si no la reenvía, usar un `<input>` con las mismas clases que `Input`.

- [ ] **Paso 2: Reescribir `components/captura-manual.tsx` entero.**

```tsx
'use client'

/**
 * Captura manual de los valores REALES de un mes, quincena a quincena.
 *
 * Es la pantalla donde una persona se sienta con el informe de HighLevel
 * delante y teclea lo que de verdad pasó. Cinco decisiones la gobiernan:
 *
 *  1. SE CAPTURA POR QUINCENA. Cada indicador tiene dos casillas, la 1ª y la
 *     2ª quincena, que se guardan por separado. El mes no se teclea: se
 *     calcula con la misma regla que usa el tablero (`resumirMes`).
 *
 *  2. LA META SIEMPRE A LA VISTA, en gris, junto a cada casilla. Capturar a
 *     ciegas y descubrir después que se falló el plan es peor que verlo
 *     mientras se teclea.
 *
 *  3. FEEDBACK EN VIVO. El bloque del mes —suma, cumplimiento y semáforo— se
 *     recalcula en cada pulsación con el mismo motor puro que pinta el
 *     tablero. Si el tablero y esta pantalla difirieran, nadie confiaría en
 *     ninguno.
 *
 *  4. VACÍO NO ES CERO. Una casilla vacía no se guarda; un 0 sí, porque es un
 *     dato («no hubo cierres»).
 *
 *  5. GUARDAR PIDE LA CONTRASEÑA, SIEMPRE. No hay cuentas: la contraseña de
 *     captura es lo que impide que cualquiera con el enlace cambie las
 *     cifras. Se pide en cada guardado y no se recuerda.
 */

import { useEffect, useId, useMemo, useState } from 'react'
import {
  ArrowsClockwiseIcon,
  CheckIcon,
  PencilSimpleLineIcon,
  WarningIcon,
} from '@phosphor-icons/react/ssr'
import { toast } from 'sonner'

import type { Indicador, Meta, Periodo, Real, Unidad } from '@/lib/tipos'
import {
  SIN_DATO,
  compararIndicador,
  formatearCumplimiento,
  formatearValor,
} from '@/lib/comparacion'
import { ultimoDiaDelMes } from '@/lib/periodos'
import { resumirMes } from '@/lib/reales/mes'
import { cn } from '@/lib/utils'
import type { ResultadoGuardado } from '@/app/captura/acciones'
import { DialogoClave } from '@/components/dialogo-clave'
import { Semaforo } from '@/components/semaforo'
import { Input } from '@/components/ui/input'

// ── Utilidades de entrada ───────────────────────────────────────────────

/**
 * Lo que se admite mientras se teclea: dígitos y como mucho un separador
 * decimal con dos cifras. La validación se aplica AL TECLEAR: una tecla que
 * no cabe simplemente no entra.
 */
const PATRON_ENTRADA = /^\d*(?:[.,]\d{0,2})?$/

/** Texto del campo → número. null para el vacío y el separador suelto. */
function aNumero(texto: string): number | null {
  const limpio = texto.trim().replace(',', '.')
  if (limpio === '' || limpio === '.') return null
  const valor = Number(limpio)
  return Number.isFinite(valor) && valor >= 0 ? valor : null
}

type Borrador = Record<string, string>

/** Registros guardados → borrador editable, por indicador. */
function aBorrador(reales: readonly Real[]): Borrador {
  const borrador: Borrador = {}
  for (const real of reales) {
    borrador[real.indicadorId] = Number.isFinite(real.valor) ? String(real.valor) : ''
  }
  return borrador
}

/** Borrador → lo que se guarda: solo las casillas con número. */
function aValores(borrador: Borrador): Record<string, number> {
  const valores: Record<string, number> = {}
  for (const [indicadorId, texto] of Object.entries(borrador)) {
    const valor = aNumero(texto)
    if (valor !== null) valores[indicadorId] = valor
  }
  return valores
}

/** Dos textos dicen lo mismo si representan el mismo número, o nada. */
function mismoValor(a: string | undefined, b: string | undefined): boolean {
  return aNumero(a ?? '') === aNumero(b ?? '')
}

/** Hairline: nunca un gris de 1px genérico, siempre mezclado con el fondo. */
const HAIRLINE = 'border-[color-mix(in_oklab,var(--foreground)_7%,transparent)]'

/** Rejilla compartida por la cabecera y por cada fila: una sola verdad. */
const REJILLA =
  'grid grid-cols-[minmax(11rem,1fr)_10.5rem_10.5rem_7.5rem_4.5rem_8.5rem] items-center gap-x-3'

type Quincena = 'q1' | 'q2'
const QUINCENAS: Quincena[] = ['q1', 'q2']

// ── Props ───────────────────────────────────────────────────────────────

export interface CapturaManualProps {
  /** El mes que se captura (siempre un periodo de tipo 'mes'). */
  mes: Periodo
  indicadores: Indicador[]
  metasQ1: Meta[]
  metasQ2: Meta[]
  realesQ1: Real[]
  realesQ2: Real[]
  /** Por qué no se puede guardar ahora, o null si se puede. */
  bloqueo: string | null
  onGuardar: (
    q1: Record<string, number>,
    q2: Record<string, number>,
    clave: string,
  ) => Promise<ResultadoGuardado>
  /** Cuántas casillas difieren de lo guardado: el tablero avisa antes de salir. */
  onCambiosPendientes: (cuantos: number) => void
}

// ── Componente ──────────────────────────────────────────────────────────

export function CapturaManual({
  mes,
  indicadores,
  metasQ1,
  metasQ2,
  realesQ1,
  realesQ2,
  bloqueo,
  onGuardar,
  onCambiosPendientes,
}: CapturaManualProps) {
  const prefijoId = useId()

  const [guardado, setGuardado] = useState(() => ({
    q1: aBorrador(realesQ1),
    q2: aBorrador(realesQ2),
  }))
  const [borrador, setBorrador] = useState(guardado)

  /**
   * Al cambiar de mes se recarga todo, ajustando el estado durante el render
   * (patrón oficial de React para estado derivado de props): así no se pinta
   * ni un fotograma con las cifras del mes anterior bajo el título del nuevo.
   * El tablero ya preguntó antes si había cambios sin guardar.
   */
  const [mesSincronizado, setMesSincronizado] = useState(mes.id)
  if (mesSincronizado !== mes.id) {
    const nuevo = { q1: aBorrador(realesQ1), q2: aBorrador(realesQ2) }
    setMesSincronizado(mes.id)
    setGuardado(nuevo)
    setBorrador(nuevo)
  }

  const [pidiendoClave, setPidiendoClave] = useState(false)
  const [guardando, setGuardando] = useState(false)
  const [errorClave, setErrorClave] = useState<string | null>(null)

  const metaDe = useMemo(
    () => ({
      q1: new Map(metasQ1.map((m) => [m.indicadorId, m.valor])),
      q2: new Map(metasQ2.map((m) => [m.indicadorId, m.valor])),
    }),
    [metasQ1, metasQ2],
  )

  /**
   * Una fila por indicador, ya comparada. Se recalcula en cada pulsación: son
   * pocas sumas y divisiones, y el semáforo no puede ir un carácter por
   * detrás de lo que se ve escrito.
   */
  const filas = indicadores.map((indicador) => {
    const texto = { q1: borrador.q1[indicador.id] ?? '', q2: borrador.q2[indicador.id] ?? '' }
    const meta = {
      q1: metaDe.q1.get(indicador.id) ?? null,
      q2: metaDe.q2.get(indicador.id) ?? null,
    }
    // Las metas de las quincenas suman exactamente el mes (lib/plan/quincenas.ts).
    const metaMes =
      meta.q1 !== null && meta.q2 !== null ? Math.round((meta.q1 + meta.q2) * 100) / 100 : null
    const delMes = resumirMes(aNumero(texto.q1), aNumero(texto.q2), meta.q1, meta.q2, metaMes)
    return {
      indicador,
      texto,
      meta,
      delMes,
      comparativa: compararIndicador(indicador, delMes.meta, delMes.real),
      cambiado: {
        q1: !mismoValor(texto.q1, guardado.q1[indicador.id]),
        q2: !mismoValor(texto.q2, guardado.q2[indicador.id]),
      },
    }
  })

  const cambios = filas.reduce((n, f) => n + Number(f.cambiado.q1) + Number(f.cambiado.q2), 0)

  useEffect(() => {
    onCambiosPendientes(cambios)
  }, [cambios, onCambiosPendientes])

  // Recargar o cerrar la pestaña con cambios sin guardar: el navegador pregunta.
  useEffect(() => {
    if (cambios === 0) return
    const avisar = (evento: BeforeUnloadEvent) => evento.preventDefault()
    window.addEventListener('beforeunload', avisar)
    return () => window.removeEventListener('beforeunload', avisar)
  }, [cambios])

  function escribir(quincena: Quincena, indicadorId: string, texto: string) {
    // Una entrada que no encaja se descarta entera: nunca se guarda un valor inválido.
    if (!PATRON_ENTRADA.test(texto)) return
    setBorrador((anterior) => ({
      ...anterior,
      [quincena]: { ...anterior[quincena], [indicadorId]: texto },
    }))
  }

  async function confirmar(clave: string) {
    setGuardando(true)
    setErrorClave(null)
    let resultado: ResultadoGuardado
    try {
      resultado = await onGuardar(aValores(borrador.q1), aValores(borrador.q2), clave)
    } catch {
      resultado = {
        ok: false,
        motivo: 'servidor',
        mensaje: 'No se pudo conectar con el servidor. Inténtalo de nuevo.',
      }
    }
    setGuardando(false)

    if (!resultado.ok) {
      setErrorClave(resultado.mensaje)
      return
    }
    setGuardado(borrador)
    setPidiendoClave(false)
    toast.success('Cambios guardados', {
      description: `${mes.etiqueta}: ${cambios} ${cambios === 1 ? 'cifra' : 'cifras'}.`,
    })
  }

  const finDeMes = ultimoDiaDelMes(mes.anio, mes.mes)

  return (
    <section className="bandeja aparecer">
      <div className="nucleo">
        {/* ── Cabecera ─────────────────────────────────────────────── */}
        <header
          className={`flex flex-wrap items-end justify-between gap-x-6 gap-y-3 border-b px-5 py-4 ${HAIRLINE}`}
        >
          <div>
            <p className="eyebrow flex items-center gap-1.5">
              <PencilSimpleLineIcon
                weight="duotone"
                aria-hidden="true"
                className="size-3.5 shrink-0 text-brand"
              />
              Captura manual
            </p>
            <h2 className="font-display mt-1 text-2xl leading-none tracking-tight text-foreground">
              {mes.etiqueta}
            </h2>
            <p className="mt-1.5 text-xs text-muted-foreground">
              Resultado real de cada quincena frente al plan
            </p>
          </div>

          <p className="text-xs text-muted-foreground" aria-live="polite">
            {cambios === 0 ? (
              'Todo guardado'
            ) : (
              <>
                <span className="cifra text-base text-foreground">{cambios}</span>{' '}
                {cambios === 1 ? 'cambio sin guardar' : 'cambios sin guardar'}
              </>
            )}
          </p>
        </header>

        {/* ── Rejilla ──────────────────────────────────────────────────
            El contenedor scrollea en horizontal; el body nunca. */}
        <div className="overflow-x-auto">
          <div className="min-w-[58rem]">
            <div className={`${REJILLA} border-b px-5 py-2 ${HAIRLINE}`} role="presentation">
              <span className="eyebrow">Indicador</span>
              <span className="eyebrow">1ª quincena · 1–15</span>
              <span className="eyebrow">2ª quincena · 16–{finDeMes}</span>
              <span className="eyebrow text-right">Mes</span>
              <span className="eyebrow text-right">Cumpl.</span>
              <span className="eyebrow">Estado</span>
            </div>

            <div>
              {filas.map((fila) => {
                const { indicador, comparativa } = fila
                return (
                  <div
                    key={indicador.id}
                    className={`${REJILLA} border-b px-5 py-2 transition-colors duration-200 [transition-timing-function:var(--ease-fluid)] last:border-b-0 hover:bg-muted/50 ${HAIRLINE}`}
                  >
                    <span title={indicador.definicion} className="text-sm font-medium text-foreground">
                      {indicador.nombre}
                    </span>

                    {QUINCENAS.map((q) => (
                      <Casilla
                        key={q}
                        id={`${prefijoId}-${q}-${indicador.id}`}
                        etiqueta={`${indicador.nombre}, ${q === 'q1' ? '1ª' : '2ª'} quincena`}
                        texto={fila.texto[q]}
                        meta={fila.meta[q]}
                        unidad={indicador.unidad}
                        cambiado={fila.cambiado[q]}
                        onEscribir={(texto) => escribir(q, indicador.id, texto)}
                      />
                    ))}

                    {/* El mes: la suma frente al plan de lo que ya pasó. */}
                    <span className="text-right">
                      <span className="cifra block text-sm text-foreground">
                        {formatearValor(fila.delMes.real, indicador.unidad)}
                      </span>
                      <span className="cifra block text-[0.6875rem] text-muted-foreground">
                        de {formatearValor(fila.delMes.meta, indicador.unidad)}
                      </span>
                    </span>

                    <span className="cifra text-right text-sm text-muted-foreground">
                      {formatearCumplimiento(comparativa.cumplimiento)}
                    </span>

                    <span className="min-w-0">
                      <Semaforo estado={comparativa.estado} />
                    </span>
                  </div>
                )
              })}
            </div>
          </div>
        </div>

        {/* ── Pie ──────────────────────────────────────────────────────── */}
        <footer
          className={`flex flex-wrap items-center justify-between gap-4 border-t px-5 py-4 ${HAIRLINE}`}
        >
          <div className="max-w-md space-y-2">
            {bloqueo && (
              <p role="status" className="flex items-start gap-2 text-xs text-[var(--estado-alerta)]">
                <WarningIcon weight="duotone" aria-hidden="true" className="mt-px size-3.5 shrink-0" />
                <span>{bloqueo}</span>
              </p>
            )}
            <p className="flex items-start gap-2 text-xs leading-relaxed text-muted-foreground">
              <ArrowsClockwiseIcon
                weight="duotone"
                aria-hidden="true"
                className="mt-px size-3.5 shrink-0 text-brand"
              />
              <span>
                Los valores capturados aquí se sustituirán por la sincronización automática con el
                CRM en la fase 2. La captura manual quedará como respaldo.
              </span>
            </p>
          </div>

          <button
            type="button"
            disabled={cambios === 0 || bloqueo !== null}
            onClick={() => {
              setErrorClave(null)
              setPidiendoClave(true)
            }}
            className="group/guardar relative inline-flex h-11 shrink-0 items-center rounded-full bg-brand pl-5 pr-12 text-sm font-medium text-primary-foreground shadow-[var(--sombra-tray)] transition-[transform,background-color,opacity] duration-300 [transition-timing-function:var(--ease-fluid)] outline-none hover:bg-[var(--brand-strong)] focus-visible:ring-3 focus-visible:ring-ring/50 active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-50"
          >
            Guardar cambios
            <span
              aria-hidden="true"
              className="absolute right-2 grid h-7 w-7 place-items-center rounded-full bg-primary-foreground/15 transition-transform duration-300 [transition-timing-function:var(--ease-fluid)] group-hover/guardar:translate-x-0.5 group-hover/guardar:-translate-y-0.5 group-hover/guardar:scale-105"
            >
              <CheckIcon weight="bold" className="size-3.5" />
            </span>
          </button>
        </footer>
      </div>

      <DialogoClave
        abierto={pidiendoClave}
        guardando={guardando}
        error={errorClave}
        cambios={cambios}
        onConfirmar={confirmar}
        onCancelar={() => setPidiendoClave(false)}
      />
    </section>
  )
}

/** Una casilla de quincena, con su meta al lado. */
function Casilla({
  id,
  etiqueta,
  texto,
  meta,
  unidad,
  cambiado,
  onEscribir,
}: {
  id: string
  etiqueta: string
  texto: string
  meta: number | null
  unidad: Unidad
  cambiado: boolean
  onEscribir: (texto: string) => void
}) {
  return (
    <div className="flex min-w-0 items-center gap-2">
      <div className="relative w-[5.75rem] shrink-0">
        {unidad === 'moneda' && (
          <span
            aria-hidden="true"
            className="cifra pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-xs text-muted-foreground"
          >
            €
          </span>
        )}
        {unidad === 'porcentaje' && (
          <span
            aria-hidden="true"
            className="cifra pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 text-xs text-muted-foreground"
          >
            %
          </span>
        )}
        <Input
          id={id}
          aria-label={etiqueta}
          /*
           * type="text" con inputMode="decimal" y no type="number": el campo
           * numérico nativo admite «e», «+» y «-», y cambia el valor con la
           * rueda del ratón. En una pantalla de captura eso es corromper un
           * dato sin que nadie lo note.
           */
          type="text"
          inputMode="decimal"
          autoComplete="off"
          value={texto}
          onChange={(evento) => onEscribir(evento.target.value)}
          placeholder={SIN_DATO}
          data-cambiado={cambiado || undefined}
          className={cn(
            'cifra text-right tabular-nums',
            unidad === 'moneda' && 'pl-6',
            unidad === 'porcentaje' && 'pr-6',
            // Lo cambiado y aún sin guardar lleva un borde de marca muy suave.
            cambiado &&
              'border-[color-mix(in_oklab,var(--brand)_55%,transparent)] bg-[color-mix(in_oklab,var(--brand)_5%,transparent)]',
          )}
        />
      </div>
      <span className="cifra truncate text-[0.6875rem] text-muted-foreground">
        de {formatearValor(meta, unidad)}
      </span>
    </div>
  )
}

export default CapturaManual
```

- [ ] **Paso 3: `components/tablero.tsx`.**

1. Imports:
   - Quitar `useCallback` (ya no se usa) e `import { toast } from 'sonner'`.
   - Añadir:

```ts
import { guardarMes } from '@/app/captura/acciones'
import { idsDeQuincenas } from '@/lib/reales/mes'
```

2. Tras el estado de `tipo`:

```ts
  /** Casillas cambiadas y sin guardar en la captura. */
  const [pendientes, setPendientes] = useState(0)
```

3. Sustituir el `guardar` con `useCallback` por los manejadores que protegen los cambios sin guardar:

```ts
  /**
   * Con cambios sin guardar en la captura, cambiar de mes, de grano o de
   * vista pregunta antes de perderlos: son hasta 104 casillas por mes.
   */
  const puedeSalir = () =>
    pendientes === 0 ||
    window.confirm(
      `Hay ${pendientes} ${pendientes === 1 ? 'cambio' : 'cambios'} sin guardar. ¿Salir sin guardarlos?`,
    )
  const cambiarPeriodo = (id: string) => {
    if (puedeSalir()) setPeriodoId(id)
  }
  const cambiarTipo = (t: TipoPeriodo) => {
    if (puedeSalir()) setTipo(t)
  }
  const cambiarVista = (v: Vista) => {
    if (v === vista || !puedeSalir()) return
    setVista(v)
    setPendientes(0)
  }
```

4. En `<SelectorPeriodo>`: `onCambiar={cambiarPeriodo}` y `onCambiarTipo={cambiarTipo}`. En los tres `<Chasis>`: `onCambiarVista={cambiarVista}`.

5. Sustituir el bloque `if (vista === 'captura') { … }` por:

```tsx
  /**
   * Se captura por mes. Si el tablero está en la vista Quincena, se abre el
   * mes de esa quincena.
   */
  const mesCaptura =
    periodo.tipo === 'mes'
      ? periodo
      : (periodos.find((p) => p.tipo === 'mes' && p.anio === periodo.anio && p.mes === periodo.mes) ??
        null)

  if (vista === 'captura' && mesCaptura) {
    const [idQ1, idQ2] = idsDeQuincenas(mesCaptura.id)
    return (
      <Chasis vista={vista} onCambiarVista={cambiarVista} controles={controles}>
        <CapturaManual
          mes={mesCaptura}
          indicadores={indicadores}
          metasQ1={metasPorPeriodo[idQ1] ?? []}
          metasQ2={metasPorPeriodo[idQ2] ?? []}
          realesQ1={realesPorPeriodo[idQ1] ?? []}
          realesQ2={realesPorPeriodo[idQ2] ?? []}
          // Guardar reemplaza las dos quincenas enteras: si no se pudo leer lo
          // guardado, guardar ahora borraría lo que no se ha cargado.
          bloqueo={
            errorReales
              ? 'No se puede guardar: los resultados guardados no se pudieron leer, y guardar ahora borraría lo que no se ha cargado.'
              : null
          }
          onGuardar={(q1, q2, clave) => guardarMes({ mesId: mesCaptura.id, q1, q2, clave })}
          onCambiosPendientes={setPendientes}
        />
      </Chasis>
    )
  }
```

6. Encima de `<Carrusel paneles={paneles} />`, el aviso:

```tsx
        {errorReales && <AvisoReales motivo={errorReales} />}
```

Y, junto a `AvisoIncidencias`:

```tsx
/**
 * Los resultados guardados no se pudieron leer. Se dice, y el tablero enseña
 * el plan sin reales: nunca se cae a datos de ejemplo.
 */
function AvisoReales({ motivo }: { motivo: string }) {
  return (
    <p className="flex items-start gap-2 text-xs leading-relaxed" style={{ color: 'var(--estado-alerta)' }}>
      <WarningIcon weight="duotone" aria-hidden="true" className="mt-[0.1rem] size-4 shrink-0" />
      <span>
        No se pudieron leer los resultados guardados ({motivo}). El tablero enseña el plan sin
        reales.
      </span>
    </p>
  )
}
```

- [ ] **Paso 4: Tipos y lint.**

Ejecutar: `npx tsc --noEmit` y `npx eslint components/captura-manual.tsx components/dialogo-clave.tsx components/tablero.tsx`
Esperado: limpios.

- [ ] **Paso 5: Probar la captura en local** (`npm run dev`, colección `quincenas-dev`, contraseña `prueba-local-2026`).
  1. Abrir «Capturar datos» en septiembre de 2026 y teclear en la 1ª quincena: Engaged Leads 50 y Ventas 2. El contador dice «2 cambios sin guardar» y las casillas cambiadas llevan el borde de marca.
  2. «Guardar cambios» con la contraseña `mala`. Esperado: tras ~1,5 s, «Contraseña incorrecta.», el campo vacío y lo tecleado intacto. Al recargar sin guardar, el navegador pregunta; después, las casillas están vacías.
  3. Repetir y guardar con `prueba-local-2026`. Esperado: el cuadro se cierra, sale «Cambios guardados» y el contador vuelve a «Todo guardado». Al recargar, las cifras siguen ahí.
  4. Con un cambio pendiente, cambiar de mes o volver al tablero. Esperado: el aviso de confirmación, y al cancelar no pasa nada.

---

### Tarea 8: La marca del mes en curso y el tramo punteado

**Archivos:**
- Crear: `components/graficos/tramo-en-curso.ts` y `components/graficos/tramo-en-curso.test.ts`.
- Modificar:
  - `components/cabecera-mes.tsx`.
  - `components/graficos/fichas.tsx`: el `mes` de la cabecera en la línea 309, `datos`/`tope` en 413-424 y el trazado en 572-658.
  - `components/canales.tsx`: línea 336.
  - `components/dinero.tsx`: línea 279.
  - `components/tendencias.tsx`: `visibles`/`sueltos` en 341-353, el mes en 582 y el trazado en 684-772.

**Interfaces:**
- Consume: `marcaCobertura` y `etiquetaConCobertura` (Tarea 5).
- Produce: `tramoEnCurso<T extends { real: number | null }>(datos: readonly T[], enCurso: number): Array<T & { realEnCurso: number | null }>`

- [ ] **Paso 1: Pruebas que fallan, `components/graficos/tramo-en-curso.test.ts`.**

```ts
import { describe, expect, it } from 'vitest'

import { tramoEnCurso } from '@/components/graficos/tramo-en-curso'

const serie = [
  { id: 'a', real: 10 },
  { id: 'b', real: 12 },
  { id: 'c', real: 5 },
]

describe('tramoEnCurso', () => {
  it('sin mes en curso no cambia nada', () => {
    expect(tramoEnCurso(serie, -1)).toEqual(serie.map((d) => ({ ...d, realEnCurso: null })))
  })
  it('separa el último tramo: el real acaba antes y el tramo une los dos meses', () => {
    expect(tramoEnCurso(serie, 2)).toEqual([
      { id: 'a', real: 10, realEnCurso: null },
      { id: 'b', real: 12, realEnCurso: 12 },
      { id: 'c', real: null, realEnCurso: 5 },
    ])
  })
  it('en curso el primero: queda un punto suelto', () => {
    expect(tramoEnCurso(serie, 0)[0]).toEqual({ id: 'a', real: null, realEnCurso: 10 })
  })
  it('un mes en curso sin real no se toca', () => {
    const conHueco = [{ id: 'a', real: 10 }, { id: 'b', real: null }]
    expect(tramoEnCurso(conHueco, 1)).toEqual(conHueco.map((d) => ({ ...d, realEnCurso: null })))
  })
})
```

Ejecutar: `npm test`
Esperado: FALLA (el módulo no existe).

- [ ] **Paso 2: Implementar `components/graficos/tramo-en-curso.ts`.**

```ts
/**
 * El tramo del mes en curso, aparte.
 *
 * Un mes a medias se dibuja «a la fecha»: su real es el de una quincena y,
 * sin marca, la curva parecería hundirse. La convención de periodo
 * incompleto es punteada: el último tramo va punteado y su punto, hueco.
 *
 * Recharts no pinta un mismo trazo con dos estilos, así que se separa en dos
 * series: `real`, que acaba en el mes anterior, y `realEnCurso`, que une ese
 * mes con el que está en curso.
 */
export function tramoEnCurso<T extends { real: number | null }>(
  datos: readonly T[],
  enCurso: number,
): Array<T & { realEnCurso: number | null }> {
  const actual = datos[enCurso]
  if (enCurso < 0 || !actual || actual.real === null) {
    return datos.map((d) => ({ ...d, realEnCurso: null }))
  }
  return datos.map((d, i) => {
    if (i === enCurso) return { ...d, real: null, realEnCurso: actual.real }
    if (i === enCurso - 1) return { ...d, realEnCurso: d.real }
    return { ...d, realEnCurso: null }
  })
}
```

Ejecutar: `npm test`
Esperado: PASA.

- [ ] **Paso 3: Las etiquetas con su marca.** Importar `etiquetaConCobertura` de `@/lib/periodos` y cambiar:
  - `fichas.tsx:309`: `mes={ventana[elegido] ? etiquetaConCobertura(ventana[elegido]) : undefined}`
  - `canales.tsx:336`: `mes={actual ? etiquetaConCobertura(actual.periodo) : undefined}`
  - `dinero.tsx:279`: `mes={actual ? etiquetaConCobertura(actual.periodo) : undefined}`
  - `tendencias.tsx:582`: `{puntoMostrado ? etiquetaConCobertura(puntoMostrado.periodo) : null}`

- [ ] **Paso 4: La marca en la cabecera del tablero.** En `components/cabecera-mes.tsx`, importar `marcaCobertura` de `@/lib/periodos` y, en el `<dd>` del mes, después del `<span>` del año:

```tsx
              {/* Un mes a medias se lee «a la fecha»: la marca lo dice para
                  que nadie lo confunda con un mes cerrado. */}
              {marcaCobertura(periodo) && (
                <span className="text-sm leading-none text-muted-foreground sm:text-base">
                  · {marcaCobertura(periodo)}
                </span>
              )}
```

- [ ] **Paso 5: El tramo punteado en las fichas** (`components/graficos/fichas.tsx`).
  1. Importar `tramoEnCurso` de `@/components/graficos/tramo-en-curso`.
  2. Sustituir la construcción de `datos` y la de `tope` por:

```tsx
  // Un mes a medias (solo en meses, nunca en quincenas) va punteado.
  const enCurso = ventana.findIndex((p) => p.cobertura !== undefined)
  const datos = useMemo(
    () =>
      tramoEnCurso(
        ventana.map((periodo, i) => ({
          id: periodo.id,
          mes: etiquetaMes(periodo),
          plan: ficha.puntos[i]?.plan ?? null,
          real: ficha.puntos[i]?.real ?? null,
        })),
        enCurso,
      ),
    [ventana, ficha.puntos, enCurso],
  )
  const n = datos.length
  const tope =
    Math.max(0, ...datos.flatMap((d) => [d.plan ?? 0, d.real ?? 0, d.realEnCurso ?? 0])) || 1
```

  3. Después del `<Area … />` del real y antes del `<Line dataKey="plan" … />`:

```tsx
            {/* El tramo del mes en curso: punteado y con el punto hueco. El
                punto lleva data-punto-suelto para aparecer al final de la
                entrada, con los demás sueltos. */}
            {enCurso >= 0 && (
              <Line
                type="monotone"
                dataKey="realEnCurso"
                stroke="var(--color-real)"
                strokeWidth={2}
                strokeLinecap="round"
                strokeDasharray="0.1 5"
                connectNulls={false}
                isAnimationActive={false}
                activeDot={false}
                dot={({ cx, cy, index }) =>
                  index === enCurso && cx != null && cy != null ? (
                    <circle
                      key="punto-en-curso"
                      data-punto-suelto
                      cx={Number(cx)}
                      cy={Number(cy)}
                      r={index === mostrado ? RADIO_PUNTO : RADIO_SUELTO + 1}
                      fill="var(--card)"
                      stroke="var(--color-real)"
                      strokeWidth={2}
                    />
                  ) : (
                    <g key={`sin-punto-${index}`} />
                  )
                }
              />
            )}
```

- [ ] **Paso 6: El tramo punteado en la Serie** (`components/tendencias.tsx`).
  1. Importar `tramoEnCurso`.
  2. Después de `visibles`:

```tsx
  // Un mes a medias va punteado, como en las fichas.
  const enCurso = visibles.findIndex((p) => p.periodo.cobertura !== undefined)
  const dibujo = useMemo(() => tramoEnCurso(visibles, enCurso), [visibles, enCurso])
```

  3. `sueltos` se calcula sobre `dibujo` (`dibujo.map((p) => p.real)` y `dibujo.map((p) => p.meta)`), y `<AreaChart data={dibujo} …>`. Los rótulos del eje y la escala siguen leyendo `visibles`.
  4. El mismo `<Line dataKey="realEnCurso" …>` del paso anterior, entre el `<Area>` y el `<Line dataKey="meta">`.

- [ ] **Paso 7: Comprobar.**

Ejecutar: `npm test`, `npx tsc --noEmit` y `npx eslint components`
Esperado: limpios.

Con septiembre con solo la 1ª quincena guardada (Tarea 7):
- La cabecera dice «Septiembre 2026 · hasta el 15» y las hojas, «Septiembre 2026 · hasta el 15».
- Cada ficha se compara con el plan de la 1ª quincena.
- En las gráficas, el tramo de agosto a septiembre va punteado y el punto de septiembre, hueco.

Al guardar también la 2ª quincena, la marca desaparece y el mes se compara con el plan completo.

---

### Tarea 9: Verificación final y entrega

- [ ] **Paso 1: Todo limpio.** `npm test`, `npx tsc --noEmit` y `npx eslint app components lib`.
- [ ] **Paso 2: Recorrido de punta a punta** con un script de CDP en el navegador sin interfaz. Se repiten los pasos de captura de la Tarea 7 (contraseña mala, buena y recarga) y las comprobaciones de la Tarea 8. La consola del navegador tiene que quedar sin errores.
- [ ] **Paso 3: Capturas** del tablero y de la captura a 1440 y 400 px, en claro y en oscuro.
- [ ] **Paso 4: Dejar vacía la colección de pruebas** (`quincenas-dev`) o avisar de lo que queda en ella.
- [ ] **Paso 5: Entregar al usuario lo que falta para producción:**
  - Las cuatro variables en Vercel (`FIREBASE_PROJECT_ID`, `FIREBASE_CLIENT_EMAIL`, `FIREBASE_PRIVATE_KEY` y `CLAVE_CAPTURA`). En producción no se define `FIRESTORE_COLECCION`.
  - Commit y push a `master` cuando lo decida.
  - Generar otra clave de servicio para Vercel y borrar la que se pegó en el chat.

---

## Notas de la ejecución (2026-09-15)

Lo que cambió respecto al plan al ejecutarlo, y por qué:

- **`@types/node` pasa de `^20` a `^22`.** Vitest 5 lo pide como dependencia opcional y npm no resolvía el conflicto. El runtime ya es Node 22 (22.19 en local), así que es alinear los tipos con lo que corre. `tsc` quedó limpio.
- **Sin resultados guardados, el tablero abre en el periodo de hoy.** Al retirar los reales de ejemplo, un tablero vacío abría en el último mes del plan (diciembre de 2028). La página calcula la fecha en el servidor (`hoy`) y el tablero busca el periodo que la contiene. Se calcula en el servidor para que el servidor y el navegador pinten lo mismo.
- **El plan se lee una vez por petición.** `obtenerPlan` va envuelto en `cache` de React. `unstable_cache` deserializaba el plan entero en cada una de sus ~200 llamadas por render. En desarrollo, pintar el tablero bajó de 3–8 s a menos de medio segundo, y guardar y repintar, de 10–30 s a unos 4 s.
- **Guardar va dentro de `useTransition`,** como pide la guía de Next 16 para invocar una Server Action desde un evento. Así «Guardando…» dura hasta que el tablero ya se ha repintado con lo guardado. Sin eso, el cuadro se cerraba antes y el tablero enseñaba un momento las cifras viejas. El aviso de «Cambios guardados» sale al confirmarse la transición.
- **`.firebaserc`** deja `funnel-de-ventas-bf` como proyecto por defecto de la CLI.

**Verificación:**
- `npm test`: 32 pruebas en 5 archivos. `tsc` y `eslint` limpios.
- Recorrido de punta a punta en local, sobre la colección `quincenas-dev` vaciada antes, todo correcto y sin errores en la consola:
  1. Contraseña mala: no escribe nada.
  2. Contraseña buena: guarda y sobrevive a la recarga.
  3. Marca «hasta el 15» y tramo punteado en las 7 gráficas.
  4. Aviso al salir con cambios sin guardar.
  5. Con la 2ª quincena guardada, la marca y el tramo desaparecen.
