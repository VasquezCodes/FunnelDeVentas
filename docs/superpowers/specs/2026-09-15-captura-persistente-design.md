# Captura persistente por quincena — diseño

- **Fecha:** 2026-09-15
- **Estado:** diseño aprobado en la conversación; pendiente de revisar por escrito.
- **Lo que pidió el usuario:**
  - Que la captura manual guarde de verdad, en Firebase.
  - Capturar por quincena: la 1ª y la 2ª, dos entradas persistentes distintas.
  - Sin cuentas ni registro de quién capturó: «simplemente capturarlos para mostrar el tablero».
  - «Cada vez que alguien quiera cambiar los datos, que pida una contraseña para poder confirmar y guardar los cambios.»
  - Si falta una quincena, que el mes muestre lo que lleva («septiembre se vería como la primera quincena nomás»).

## Punto de partida

- El tablero está publicado en Vercel (`funnel-de-ventas.vercel.app`), abierto sin login. Se despliega desde GitHub (`VasquezCodes/FunnelDeVentas`, rama `master`).
- El plan viene del Excel de SharePoint, por Graph y con caché (`lib/plan/graph.ts`, `lib/plan/fuente.ts`).
- **Los reales de hoy son inventados** (`lib/plan/reales-ejemplo.ts`) y la captura no guarda nada: `tablero.tsx › guardar` solo muestra un aviso.
- Las quincenas ya existen como periodos derivados (`lib/plan/quincenas.ts`): la meta del mes se parte en dos, en enteros para las cantidades (la unidad impar va a la 2ª) y al céntimo para el dinero. Los porcentajes no se parten; hoy el catálogo no tiene ninguno.

## Decisiones

| Tema | Decisión | Por qué |
|---|---|---|
| Almacén | Cloud Firestore, proyecto `funnel-de-ventas-bf`, base `(default)` en `us-east4` | Lo pidió el usuario. `us-east4` está junto a la región por defecto de las funciones de Vercel (`iad1`). |
| Acceso | Solo desde el servidor de Next.js, con el Admin SDK. Las reglas de Firestore niegan todo al navegador. | Sin cuentas no hay forma segura de que el navegador hable con Firestore. |
| Protección | Una contraseña compartida que se pide **en cada guardado**. Vive en Vercel (`CLAVE_CAPTURA`) y nunca llega al navegador. | Lo pidió el usuario: sin cuentas y confirmando cada cambio. |
| Grano | Se captura por quincena; el mes se calcula. | Lo pidió el usuario. |
| Mes incompleto | El mes enseña lo que lleva, comparado con el plan de las quincenas que tienen dato. | Compararlo con el plan del mes entero pintaría todo «Fuera de plan» a mitad de mes sin estarlo. |
| Reales de ejemplo | Se retiran. | El tablero enseña solo lo capturado. |

## Modelo de datos (Firestore)

- **Colección `quincenas`**, un documento por quincena. El id del documento es el id del periodo: `2026-09-Q1`, `2026-09-Q2`.
- **Campos:**
  - `valores`: mapa `{ [indicadorId]: number }` con los indicadores que tienen dato.
  - `actualizadoEn`: marca de tiempo del servidor.
- **Vacío no es cero.** Una casilla vacía no se guarda y borrar una cifra quita su clave. Un 0 sí es un dato («no hubo cierres»).
- **Tamaño:** 52 indicadores × 2 quincenas × 33 meses, como mucho 66 documentos pequeños.
- **En local** se usa la misma base con otra colección (`FIRESTORE_COLECCION=quincenas-dev`), para que las pruebas no toquen los datos de producción. Por defecto, `quincenas`.

## Reglas del mes

Para cada indicador de un mes:

- **Real del mes:** la suma de las quincenas que tienen dato.
- **Plan con el que se compara:** la suma de las metas de esas mismas quincenas.
  - Con las dos quincenas es el plan del mes entero, porque las metas de las quincenas suman exactamente el mes.
  - Con una sola, el plan de esa quincena.
- **Sin ninguna quincena:** sin resultado. El plan del mes entero se enseña como «previsto», como hoy.

Además:

- **Mes en curso:** un mes lo está cuando solo una de sus dos quincenas tiene algún dato.
  - La cabecera y la cabecera de cada hoja lo dicen: «Septiembre 2026 · hasta el 15» (o «desde el 16» si solo hay 2ª quincena).
  - En las líneas de las gráficas (fichas y Serie), el tramo que llega al mes en curso va punteado y su punto, hueco. Es la convención de periodo incompleto: sus dos líneas, real y plan, van «a la fecha».
- **Vistas de quincena:** no cambian. Cada quincena se compara con su propia meta.

Esta consolidación es una función pura (`lib/reales/mes.ts`), probada aparte. La usan la fuente de datos y la pantalla de captura, así que el tablero y la captura no pueden diferir.

## Flujo de datos

- **Lectura:**
  - `app/page.tsx` sigue cargando todo a través de `FuenteDatos` y pasa a renderizarse en cada petición (`await connection()`), para que lo guardado se vea siempre al recargar.
  - `fuenteExcel.reales()` lee de Firestore (`lib/reales/almacen.ts`): una sola consulta por petición trae todas las quincenas, y `cache` de React evita repetirla dentro de la misma petición.
  - **Sin caché entre peticiones.** En Next 16, `updateTag` solo garantiza invalidar las etiquetas de `fetch` y de `'use cache'`, no las de `unstable_cache`, y `revalidateTag` sin perfil está en desuso. Son unas decenas de documentos por carga, muy dentro de la cuota gratuita de Firestore.
  - Los meses salen de `lib/reales/mes.ts`, junto con qué meses están en curso.
- **Escritura:** una Server Action, `guardarMes({ mesId, q1, q2, clave })`.
  1. Comprueba la contraseña contra `CLAVE_CAPTURA` con una comparación de tiempo constante. Si falla, espera unos 1,5 s y responde «contraseña incorrecta» sin escribir nada.
  2. Valida los datos: el mes existe en el plan, los indicadores existen y cada valor es un número finito ≥ 0 con dos decimales como mucho.
  3. Escribe los dos documentos de un golpe (un *batch*). Se envía el estado completo de las dos quincenas y cada documento se reemplaza, así que lo borrado desaparece.
  4. Llama a `revalidatePath('/')`, así el navegador recibe el tablero ya actualizado en la misma respuesta.
- **En el navegador:** lo guardado pasa a ser el nuevo punto de partida de la captura y el tablero se refresca.
- **Dos personas editando el mismo mes a la vez:** gana el último guardado. Es aceptable para un equipo pequeño y queda fuera de alcance.

## Pantalla de captura (`components/captura-manual.tsx`)

- **Se captura por mes.** El mes se elige en el selector de la barra. Si el tablero está en la vista Quincena, se abre el mes de esa quincena.
- **Una fila por indicador, con tres bloques:**
  - 1ª quincena: la casilla y su meta al lado («de 72»).
  - 2ª quincena: la casilla y su meta («de 73»).
  - Mes: la suma frente al plan (con la regla del mes incompleto), el cumplimiento y el semáforo, recalculados al teclear con el mismo motor que el tablero.
- **Al abrir, cada casilla trae lo guardado.** Las cifras cambiadas se marcan y un contador dice cuántos cambios hay sin guardar.
- **«Guardar cambios» abre siempre un cuadro que pide la contraseña.**
  - Si es correcta, se guarda, el cuadro se cierra y sale el aviso de guardado.
  - Si es incorrecta, el cuadro dice «Contraseña incorrecta» y lo tecleado sigue ahí.
  - Si falla la red o Firebase, el cuadro dice qué pasó y no se pierde nada.
- **Cambios sin guardar:** si se cambia de mes o se vuelve al tablero, se avisa antes de perderlos. En una recarga o al cerrar la pestaña, también (`beforeunload`).
- **Si no se pudieron leer los resultados guardados, no se deja guardar.** Guardar reemplaza las dos quincenas enteras y borraría lo que no se ha podido cargar. La pantalla dice por qué el botón no responde.
- Se mantienen las reglas actuales: solo números ≥ 0 con dos decimales, coma o punto decimal, sin rueda del ratón, y vacío no es cero.

## Tablero

- Enseña solo lo capturado, con la marca del mes en curso descrita arriba.
- **Si Firestore no se puede leer**, un aviso ámbar encima del carrusel dice «No se pudieron leer los resultados guardados» y el motivo. El tablero enseña el plan sin reales. Nunca se vuelve a los datos de ejemplo.
- **El periodo por defecto** sigue siendo el último con resultado. A mitad de mes, es el mes en curso con su 1ª quincena.

## Configuración

**La hago yo (MCP de Firebase y CLI):**
- Crear el proyecto `funnel-de-ventas-bf`. Ya está creado.
- Añadir `firebase.json` y `firestore.rules` al repositorio.
- Desplegar las reglas con `firebase deploy --only firestore`, que crea también la base de datos.
- Añadir a `.gitignore` la clave de servicio (`*firebase-adminsdk*.json`) y los restos de la CLI (`.firebase/`, `firebase-debug.log`).

**Las reglas** (nadie entra desde el navegador; el Admin SDK no pasa por ellas):

```
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /{document=**} {
      allow read, write: if false;
    }
  }
}
```

**Las hace el usuario, una sola vez** (el MCP no genera claves de servicio y aquí no está la CLI de Vercel):
1. En la consola de Firebase: *Configuración del proyecto → Cuentas de servicio → Generar nueva clave privada*. Descarga un JSON; se guarda fuera del repositorio y se me da la ruta para rellenar `.env.local`.
2. En Vercel, en *Settings → Environment Variables* del proyecto:
   - `FIREBASE_PROJECT_ID`, `FIREBASE_CLIENT_EMAIL` y `FIREBASE_PRIVATE_KEY`, sacadas del JSON.
   - `CLAVE_CAPTURA`: la contraseña que elija.
3. Publicar: commit y push a `master`. Es decisión suya: no hago commits sin que me lo pida.

## Seguridad

- **La contraseña** viaja solo en la petición al servidor, por HTTPS, y nunca se incluye en el código del navegador.
- **La clave de servicio** vive solo en las variables de Vercel y en `.env.local`, que Git ignora.
- **Si la contraseña se filtra,** se cambia en Vercel y se vuelve a desplegar: en Vercel, las variables nuevas solo valen para los despliegues nuevos.
- **Leer el tablero sigue siendo público,** como hoy. Protegerlo es otra decisión, para más adelante.

## Archivos

**Nuevos:**
- `lib/reales/mes.ts`: consolidación pura del mes a partir de sus quincenas, con su cobertura.
- `lib/reales/clave.ts`: comprobación de la contraseña (solo servidor).
- `lib/reales/almacen.ts`: el Admin SDK (una sola instancia), `leerQuincenas()` y `guardarQuincenas()` (solo servidor).
- `app/captura/acciones.ts`: la Server Action `guardarMes`.
- `firebase.json` y `firestore.rules`.
- Pruebas: `lib/reales/mes.test.ts` y `lib/reales/clave.test.ts`, con Vitest (dependencia de desarrollo nueva, script `test`).

**Modificados:**
- `lib/plan/fuente.ts`: `reales()` desde Firestore. La meta de un mes en curso pasa a ser la de lo que ya pasó, y la fuente expone qué meses están en curso.
- `app/page.tsx` y `components/tablero.tsx`: pasan la cobertura y el error de lectura; `guardar` llama a la Server Action.
- `components/captura-manual.tsx`: dos casillas por fila, el bloque del mes, los cambios sin guardar y el cuadro de contraseña.
- `components/cabecera-mes.tsx` y `components/graficos/hoja.tsx`: la marca «hasta el 15».
- `components/graficos/fichas.tsx` y `components/tendencias.tsx`: el tramo punteado del mes en curso.

**Retirado:** `lib/plan/reales-ejemplo.ts`.

## Pruebas

- **Unitarias (Vitest):**
  - `mes.ts`: las dos quincenas, solo la 1ª, solo la 2ª, ninguna, 0 frente a vacío, redondeo del dinero y la marca de mes en curso.
  - `clave.ts`: contraseña correcta, incorrecta y variable ausente (falla cerrado: sin variable no se guarda nada).
- **De punta a punta, en local con `quincenas-dev`:**
  1. Capturar la 1ª quincena e intentar guardar con la contraseña mala: no se escribe nada.
  2. Guardar con la buena y recargar: las cifras siguen ahí, y el mes dice «hasta el 15» y se compara con el plan de la 1ª quincena.
  3. Capturar la 2ª quincena: el mes suma las dos y se compara con el plan completo.
- **Interfaz:** scripts de CDP como en las rondas anteriores, capturas a 1440 y 400 px, y `tsc` y `eslint` limpios.

## Fuera de alcance

- Cuentas de usuario y registro de quién capturó.
- Proteger la lectura del tablero.
- La sincronización con el CRM (fase 2).
- Otro reparto de las metas entre quincenas (40/60, por días): sigue el 50/50.
- Edición simultánea: gana el último guardado.
