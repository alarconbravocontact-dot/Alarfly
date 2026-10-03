# ALARFLY — Web + Legales + SEO + Rendimiento + Estructura (Prompt 1/2)

> Cierre de esta fase, pedido explícitamente por el usuario: AUDITA →
> IMPLEMENTA → PRUEBA → DOCUMENTA → CIERRA, exclusivamente sobre la
> capa web/pública/legal/SEO/rendimiento. No se tocó lógica de negocio
> del ERP salvo lo estrictamente necesario para una funcionalidad web
> pedida (el formulario de contacto necesitó un modelo y un endpoint
> nuevos; la apertura automática del primer periodo contable ya se
> había corregido en el cierre anterior y no se tocó acá). No se avanza
> al Prompt 2.

## 1. Auditoría previa (¿existe? → ¿funciona? → ¿reutilizar? → ¿extender? → ¿fusionar? → ¿crear?)

Antes de escribir código se inspeccionó todo lo pedido en la sección 1
del prompt. Hallazgos relevantes:

- **Landing pública real** (`/`, `LandingPage.jsx`): ya existe, completa,
  con un solo `<h1>`, estructura semántica correcta, sin imágenes
  raster (todo es SVG/CSS). No se rediseñó — solo se le agregaron los
  3 enlaces legales que faltaban en el pie de página y metadata SEO.
- **Router** (`App.jsx`): 100% rutas estáticas declaradas, sin rutas
  dinámicas por id en ningún módulo (confirmado en cierres anteriores).
  El catch-all (`path="*"`) **redirigía en silencio a "/"** — nunca
  existió una página 404 real. Corregido (sección 4).
- **`index.html`/`robots.txt`**: ambos tenían un bloqueo total de
  indexación (`noindex, nofollow` + `Disallow: /`) dejado desde antes
  de que existiera la Landing pública (comentario original: "F16-E17:
  Alarfly todavía no tiene ninguna página pública"). Ya no aplica —
  corregido (sección 5).
- **Favicon**: existía `favicon.svg` (el logo real de Alarfly, marca
  "A" sobre fondo oscuro redondeado) pero sin ningún tamaño PNG de
  respaldo ni `apple-touch-icon` ni manifest. Corregido generando PNGs
  **del mismo SVG real** (nunca se inventó un logo nuevo) — sección 7.
- **Imágenes públicas**: auditadas todas. La Landing y el resto del
  proyecto no usan ninguna imagen raster pública — todo es SVG/CSS
  (iconos propios, barras del panel de vista previa). El único `<img>`
  de todo el frontend es el código QR del 2FA, generado dinámicamente
  dentro de la app autenticada, no una imagen pública. No había nada
  que optimizar ni ninguna imagen que agregar — sección 9.
- **SEO técnico**: sin `sitemap.xml`, sin canonical, sin Open Graph más
  allá de lo mínimo, sin datos estructurados. Corregido (sección 8).
- **Cookies/tracking**: auditado con `grep` en todo `frontend/src` — no
  existe ningún `document.cookie`, ninguna librería de analítica
  (Google Analytics, Segment, Mixpanel, píxeles) ni ningún tracker de
  terceros. Lo único persistido en el navegador es `localStorage`
  (token de sesión, preferencias de tema/moneda, código de referido de
  afiliado) — no es una cookie. **No se construyó un banner de
  cookies**, porque no hay ninguna cookie que declarar — inventar
  categorías para un banner habría sido exactamente el tipo de dato
  ficticio que el prompt prohíbe explícitamente (sección 11).
- **Formulario de contacto**: no existía ninguno en todo el proyecto.
  Se auditó también la capacidad real de envío de correo del backend —
  **no existe ningún servicio de email configurado** (ni nodemailer,
  ni SendGrid, ni SMTP; confirmado también por `CLAUDE.md`/
  `INTEGRATIONS_ARCHITECTURE.md`, que documentan esto como límite
  consciente desde antes). El formulario nuevo por lo tanto **guarda
  el mensaje para revisión, nunca envía un correo real** — mismo
  patrón ya usado en el proyecto para `JuntaMessage` (sección 12).
- **IA real en el producto**: se buscó explícitamente en todo `src/`
  antes de escribir la cláusula de IA de los Términos. Resultado,
  confirmado también por `AI_ARCHITECTURE.md` (que literalmente dice
  "No implementa IA. No integra ningún proveedor...") — **Alarfly no
  usa inteligencia artificial en ningún punto del producto hoy**. Los
  cálculos financieros son reglas determinísticas; la función de Ayuda
  contextual es un motor de coincidencia por palabras clave, no un
  LLM. La cláusula de IA de los Términos refleja esto honestamente, sin
  inventar una capacidad que no existe (sección 12 de los Términos).
- **Entidad legal/jurisdicción**: se buscó en todo el proyecto (código,
  `.env`, documentación) cualquier dato de razón social, país de
  constitución, domicilio o mecanismo de resolución de disputas — no
  existe ninguno. La cláusula de arbitraje y la de ley aplicable se
  dejaron **explícitamente marcadas como pendientes de confirmación
  del propietario**, en vez de inventarlas (ver sección 3).
- **Pagos/suscripciones**: se auditó si existe algún motor de cobro
  real (Stripe, facturación recurrente). No existe — solo
  `Company.trialStartedAt`/`trialEndsAt` (7 días), sin ninguna
  aplicación automática al vencer. Los Términos lo describen tal cual
  es: un precio de referencia público, sin cobro automatizado dentro
  de la plataforma hoy.

## 2. Páginas creadas

| Ruta | Archivo | Propósito |
|---|---|---|
| `/privacidad` | `pages/legal/PrivacyPolicyPage.jsx` | Política de Privacidad |
| `/terminos` | `pages/legal/TermsPage.jsx` | Términos y Condiciones (incluye IA y arbitraje) |
| `/contacto` | `pages/legal/ContactPage.jsx` | Formulario de contacto funcional |
| `*` (cualquier ruta inexistente) | `pages/NotFoundPage.jsx` | Página 404 real, antes redirigía en silencio a "/" |

Las 3 primeras comparten `pages/legal/LegalLayout.jsx` (mismo nav/pie
de página que la Landing, una sola columna de texto en medio) — no se
creó una segunda identidad visual.

## 3. Legales

### Política de Privacidad
Describe únicamente prácticas reales verificadas contra el código: qué
datos se recopilan (cuenta, empresa, datos operativos, sesión/
auditoría, formulario de contacto, afiliados), qué NO se usa (sin
cookies de seguimiento, sin analítica de terceros), con quién se
comparte (con nadie — no hay proveedores externos), seguridad real
(bcrypt, 2FA cifrado, sesiones revocables, aislamiento por empresa),
derechos del usuario (todos reales: editar perfil, ver rol, exportar
actividad en JSON/CSV, cerrar sesiones remotas, solicitar baja).

### Términos y Condiciones
Cubre las 16 secciones pedidas. Reglas y cupos de roles citados
exactamente como existen en `core/rbac` (Administrador sin límite,
Contador 3, Financiero 4, Colaborador 8). La sección de pagos es
honesta sobre la ausencia de cobro automatizado.

### Pendiente real, marcado explícitamente en la propia página (no inventado)
Las secciones 15 (Resolución de disputas y arbitraje) y 16 (Ley
aplicable) de los Términos no se completaron con una cláusula
definitiva porque el proyecto no tiene definida ninguna entidad legal
operadora, país de constitución, domicilio ni institución arbitral. En
su lugar, cada sección lista exactamente qué dato debe confirmar el
propietario de Alarfly antes de poder redactarse (razón social, país/
domicilio, institución y reglamento de arbitraje, sede e idioma,
árbitro único o panel). Esto es intencional, siguiendo la instrucción
explícita de no inventar esos datos.

## 4. Inteligencia Artificial

Confirmado por auditoría de código (no por suposición): Alarfly no usa
IA hoy. La sección 12 de los Términos lo declara así, explica en qué
se basan realmente los cálculos (reglas determinísticas) y deja
preparado, con un listado explícito de qué debe explicarse (función
exacta, posibilidad de error, carácter de apoyo no vinculante,
responsabilidad del usuario, datos procesados, proveedor nombrado
explícitamente), el texto que se agregará el día que una función de IA
real se incorpore — nunca antes de eso.

## 5. Arbitraje

Ver sección 3 arriba — campos pendientes dejados explícitos en los
Términos, nunca inventados.

## 6. Cookies

No se construyó ningún banner. Auditoría confirmó cero cookies/
tracking real en todo el proyecto (solo `localStorage`, que no es una
cookie). Si en el futuro se integra analítica o un proveedor que sí
use cookies, se deberá construir el banner real en ese momento,
describiendo las categorías reales que existan entonces.

## 7. Contacto

`POST /contact` (`src/core/contact/`, nuevo, público, sin
`requireAuth` — mismo criterio que `/affiliates/register`). Guarda el
mensaje en un modelo nuevo `ContactMessage` (migración
`20261003200424_contact_message_and_web_cierre`, puramente aditiva).
Protección básica contra spam sin ningún servicio externo: honeypot
(campo oculto que un bot rellena y un humano nunca ve) + ventana de
enfriamiento de 1 minuto por IP. **No envía ningún correo real** — se
le dice esto honestamente al usuario en el estado de éxito del
formulario, en vez de prometer un envío que el backend no puede hacer
hoy (no hay ningún servicio de email configurado en el proyecto).

**Bug real encontrado y corregido durante la verificación**: la
primera versión del validador Zod (`honeypot: z.string().max(0)`)
rechazaba con un error 400 visible cualquier honeypot con contenido —
exactamente lo opuesto de lo que debe pasar (un bot detectado nunca
debe enterarse de que lo fue; debe ver un "éxito" falso). Corregido
para que la validación de forma siempre acepte el campo, y la decisión
de descartar en silencio viva en el servicio, después de pasar la
validación.

Frontend: formulario real con los 4 campos pedidos, validación en vivo,
estados de carga/éxito/error, honeypot invisible (fuera de pantalla,
`aria-hidden`+`tabIndex=-1`, no `display:none`), accesible
(`aria-invalid`/`aria-describedby`/`role="alert"` en cada error).

## 8. SEO

- **`index.html`**: ya no tiene el bloqueo global de indexación.
  Agregado: `og:title`/`og:description`/`og:image`/`twitter:card`,
  `theme-color`, enlaces de favicon/manifest completos.
- **`core/ui/Seo.jsx`** (nuevo, genérico): componente que, por ruta,
  fija `document.title`, `meta[name=description]`,
  `meta[name=robots]`, `link[rel=canonical]`, Open Graph y JSON-LD —
  es lo más honesto que se puede hacer sin un servidor de render (SPA
  pura, sin SSR, fuera de alcance de este cierre); Google/Bing ya
  ejecutan JavaScript para indexar, así que esto sí se refleja en el
  resultado de búsqueda real.
- **Landing**: `Seo` con título/descripción/canonical reales +
  JSON-LD `SoftwareApplication` con únicamente hechos que ya se
  muestran en la propia página (nombre, descripción, precio $25/mes,
  prueba gratis) — sin calificación ni reseñas inventadas.
- **`robots.txt`**: permite rastrear la Landing y las páginas públicas
  reales (`/privacidad`, `/terminos`, `/contacto`, `/registro`,
  `/acceso`); excluye por prefijo las rutas que exigen sesión (sin
  valor de indexación real, nunca muestran datos de ninguna empresa a
  un rastreador sin sesión).
- **`sitemap.xml`** (nuevo): solo las páginas con contenido real —
  `/`, `/privacidad`, `/terminos`, `/contacto`. **Nunca se inventó una
  URL para mejorar el SEO** (sin blog, sin casos de éxito, sin FAQ
  separada, sin "Sobre nosotros" — ninguna de esas páginas existe).
- **Dominio usado en `sitemap.xml`/`robots.txt` (`alarfly.com`)**:
  tomado del nombre de marca ya confirmado en todo el proyecto
  (`package.json`, el dominio `demo.alarfly.com` ya usado en los
  correos de prueba desde hace muchas fases) — **pendiente de que el
  propietario confirme el dominio de producción real** antes de
  publicar; si es distinto, hay que actualizar ambos archivos.
- **Estructura semántica de la Landing**: confirmado un solo `<h1>`,
  jerarquía `h2`/`h3` correcta dentro de cada sección (ya existía así,
  no se tocó).

## 9. Favicon

Generados `favicon-16x16.png`, `favicon-32x32.png`,
`apple-touch-icon.png` (180×180), `icon-192.png`, `icon-512.png` y
`manifest.webmanifest` — **todos renderizados del mismo
`favicon.svg` real ya existente** (nunca se creó un logo nuevo).
`index.html` referencia los 3 tamaños + el manifest.

## 10. Imágenes

Sin cambios porque no había nada que optimizar: cero imágenes raster
en toda la capa pública (ver sección 1). Documentado explícitamente en
vez de inventar imágenes que no existían.

## 11. Rendimiento

### Medición ANTES (bundle único, import estático de las ~70 pantallas del ERP)
- `index-*.js`: 1 364,85 kB (gzip 346,50 kB)
- `index-*.css`: 81,33 kB (gzip 12,49 kB)
- Un visitante de la Landing descargaba el ERP completo (Contabilidad,
  Tesorería, Inventario, Fiscal, Analítica Avanzada con Recharts,
  etc.) antes de poder ver una palabra de la página pública.

### Optimización real aplicada
`App.jsx`: las ~70 pantallas que solo existen detrás de
`ProtectedRoute`/`AppLayout` (todo el ERP + panel de afiliado +
administración de afiliados + Mi Cuenta) se migraron de `import`
estático a `React.lazy(() => import(...))`, con un único `<Suspense>`
envolviendo las rutas. Vite/Rollup las separa en sus propios chunks,
descargados solo al navegar ahí — nunca se tocó ninguna lógica de
negocio, solo el mecanismo de import. `LandingPage`, `LoginPage`,
`SignupPage`, las 3 páginas legales y la 404 siguen siendo import
estático (deben estar listas de inmediato).

### Medición DESPUÉS (build real, `npm run build`)
- `index-*.js` (chunk de entrada): **365,50 kB (gzip 110,23 kB)** — 73%
  menos sin comprimir, 68% menos con gzip.
- `index-*.css` (chunk de entrada): **46,74 kB (gzip 8,01 kB)**
- El resto (≈70 chunks) se carga bajo demanda — ej. el chunk más
  pesado de todos, `AnalysisResultView` (402 kB, por Recharts), ya no
  afecta a nadie que no entre a Análisis Avanzados.

### Medición en vivo de la Landing (Playwright + CDP, contra el build de producción servido con `vite preview`, no el servidor de desarrollo)
- **LCP (Largest Contentful Paint)**: 400 ms
- **CLS (Cumulative Layout Shift)**: 0,0000
- **DOMContentLoaded**: 290 ms
- 9 requests en total, peso real en disco de todo lo que carga la
  Landing (JS+CSS, sin contar fuentes de Google Fonts que ya estaban
  antes): **≈416 KB sin comprimir** (antes: ≈1 446 KB) — confirmado con
  los tamaños reales de archivo en `dist/`, no solo con las cabeceras
  de red.

No se aplicó ninguna optimización cosmética — el único cambio es el
mecanismo de carga de código, con una mejora medida y real.

## 12. Responsive

Verificado con Playwright (tolerancia 2px, `scrollWidth` vs
`clientWidth`) en 390/768/1440px para `/`, `/privacidad`, `/terminos`,
`/contacto`, 404 — 15 combinaciones.

**Bug real encontrado y corregido durante la verificación**: al
agregar 3 enlaces nuevos al pie de página (Privacidad/Términos/
Contacto, antes solo tenía 2), `.landing-footer-links` no tenía
`flex-wrap` — a 390px de ancho, los 5 enlaces en una sola fila
producían 21px de desborde horizontal en la Landing y en las 3 páginas
legales (que comparten el mismo pie de página). Corregido agregando
`flex-wrap: wrap` + `justify-content: center` — las 15 combinaciones
dan **0px de desborde** tras el fix. También se re-verificó el ERP
autenticado (Panel principal, Venta Rápida, Finanzas) en 390/768px
tras el cambio de `React.lazy` — sin desborde, sin regresión.

## 13. Tests, lint, build

- **Jest**: 752/752 (747 anteriores + 5 nuevos de
  `contact.service.test.js`, cubriendo: mensaje real guardado, honeypot
  descartado en silencio, límite de envíos por IP, envío permitido tras
  pasar la ventana de enfriamiento, sin límite cuando no hay IP).
- **Lint backend** (`eslint src`): 0 errores.
- **Lint frontend** (`oxlint`): mismo baseline de 9 warnings ya
  conocido (`only-export-components` en los archivos de contexto,
  patrón arquitectónico deliberado, no un error nuevo).
- **Build frontend** (`vite build`): limpio, 899 módulos.
- Ningún test se eliminó ni se omitió para forzar un resultado verde.

## 14. Playwright

Verificado en vivo contra los dos servidores reales:
- Landing: título/descripción/robots/canonical/JSON-LD/enlaces de pie
  de página, todos correctos.
- `/privacidad`/`/terminos`: título correcto, `h1` correcto,
  `robots: index, follow`, 2 bloques de "pendiente de confirmación"
  visibles en Términos (arbitraje + ley aplicable), sección de IA
  presente.
- 404: título exacto `Página no encontrada — Alarfly`, `robots:
  noindex, nofollow`, botón de volver al inicio, diseño Alarfly
  (captura revisada).
- Contacto: envío vacío muestra los 4 errores de campo; envío válido
  guarda el mensaje real (confirmado contra Postgres) y muestra el
  estado de éxito (captura revisada).
- Responsive: ver sección 12.
- ERP autenticado tras el cambio a `React.lazy`: login, Panel
  principal, Venta Rápida y Finanzas cargan y funcionan igual que
  antes — sin regresión funcional.

## 15. Regresiones

Ninguna encontrada en el ERP. El único cambio de lógica de negocio
real es aditivo y nuevo (el modelo/endpoint de contacto); el resto de
cambios son metadata, un mecanismo de carga de código, CSS de la capa
pública, y contenido de páginas nuevas — ninguno toca Ledger/CORE/
AUDIT/permisos/cálculos financieros ya existentes.

## 16. Pendientes reales (no bloquean esta fase, deben resolverse antes de publicar)

1. **Confirmar la entidad legal operadora** (razón social, país,
   domicilio) y el mecanismo de resolución de disputas, para completar
   las secciones 15-16 de los Términos (arbitraje y ley aplicable) —
   hoy quedan honestamente marcadas como pendientes.
2. **Confirmar un correo de contacto dedicado** para solicitudes de
   privacidad (acceso/rectificación/eliminación) — la Política de
   Privacidad lo señala como pendiente en vez de inventar uno.
3. **Confirmar el dominio de producción real** si es distinto de
   `alarfly.com`, y actualizar `sitemap.xml`/`robots.txt`.
4. Si en el futuro se integra un proveedor de email, de analítica o de
   IA, actualizar la Política de Privacidad (sección 4), los Términos
   (sección 12) y, si corresponde, agregar un banner de cookies real
   — nunca antes de que esa integración exista de verdad.

## 17. Cierre

Commit local sobre `claude/fintech-platform-nodejs-pdgvjf`. No se
avanza al Prompt 2 — se entrega el resumen ejecutivo pedido y se
espera confirmación/continuación explícita del usuario.
