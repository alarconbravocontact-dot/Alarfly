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

## 17. Cierre (Prompt 1/2)

Commit local sobre `claude/fintech-platform-nodejs-pdgvjf`. No se
avanza al Prompt 2 — se entrega el resumen ejecutivo pedido y se
espera confirmación/continuación explícita del usuario.

---

# Parte 2 — UX + Animaciones + Interacción + Tema Claro/Oscuro (Prompt 2/2)

> Continúa directamente sobre el resultado real del Prompt 1 — nada de
> lo documentado arriba se rehizo. Alcance: animaciones de scroll,
> botón "Volver arriba", botón de compartir, sugerencias/feedback
> (extendiendo el contacto ya existente), modo claro/oscuro real y
> persistente, accesibilidad, responsive y rendimiento. No se tocó
> lógica financiera, ERP, autenticación, Ledger ni afiliados — todos
> los cambios de esta parte son de presentación/interacción o,
> cuando fue estrictamente necesario (la categoría del formulario de
> contacto), una extensión aditiva de un modelo ya existente.

## 18. Auditoría previa a esta parte

Antes de escribir código se revisó, contra el estado real dejado por
el Prompt 1:

- **`ThemeContext.jsx` ya existía**, completo, pero con una limitación
  real: **solo funcionaba con sesión** (`if (!user) { setRawTheme
  ('dark'); return; }`) — un visitante de la Landing/legales/contacto/
  404 no tenía ningún control de tema, siempre veía oscuro fijo. Se
  **extendió** (nunca se reconstruyó) para que, sin sesión, use
  `localStorage` directamente como fuente de verdad — mismo
  `data-theme`, mismos tokens de `theme.css`, un solo sistema.
- **`theme.css` ya cubría** fondo/superficies/texto/bordes/estados
  (positivo/negativo/warning/info) en los dos temas — confirmado
  completo antes de tocar nada. Solo faltaba una tripleta RGB
  (`--color-bg-rgb`, ver sección 20).
- **No había ningún mecanismo de scroll/animación, botón "volver
  arriba" ni botón de compartir** en todo el proyecto — se audita y
  confirma con `grep` antes de construir cualquiera de los tres.
- **El formulario de contacto del Prompt 1 YA era, de hecho, un
  mecanismo de feedback utilizable** (nombre/correo/asunto/mensaje,
  validación, loading/éxito/error, protección básica contra spam) —
  se **extendió** con una categoría (sugerencia/comentario/mejora/
  reporte) en vez de construir un segundo sistema, tal como pide
  explícitamente la sección 5 del prompt ("si existe, reutilizarlo").
- **Íconos de sol/luna/flecha arriba no existían** en `Icon.jsx` — se
  agregaron al mismo registro ya existente, mismo criterio de trazo a
  mano sin librería que el resto del set.

## 19. Animaciones de scroll

`core/ui/Reveal.jsx` (nuevo, genérico): envuelve cualquier bloque y le
aplica fade + un desplazamiento corto de 12px al entrar en el
viewport, con un único `IntersectionObserver` por instancia (nunca un
listener de `scroll`, que es la causa típica de layout thrashing en
este tipo de animación) — se desconecta solo apenas el elemento
aparece una vez. Transición de 320ms (rápida, discreta). **Respeta
`prefers-reduced-motion: reduce`** en dos capas: JS (el componente
nunca activa la animación, se muestra de inmediato) y CSS (una regla
`@media` de respaldo, por si el componente llegara a montarse con la
animación activa). Conectado en las 8 secciones de contenido de la
Landing (no en el Hero, que debe verse de inmediato, ni en el pie de
página). Nada de parallax ni efectos pesados — solo opacidad y un
`transform: translateY()` corto.

## 20. Botón "Volver arriba"

`core/ui/BackToTop.jsx` (nuevo): aparece pasados 480px de scroll,
desaparece por debajo de ese umbral, con transición suave de opacidad.
Un solo listener de `scroll`, protegido con `requestAnimationFrame`
(nunca recalcula en cada evento de scroll, que puede dispararse
decenas de veces por segundo). Es un `<button>` real (no un `<div>` con
`onClick`) — funciona con teclado (Tab + Enter, verificado), con
`aria-label="Volver arriba"`, `aria-hidden`/`tabIndex` que se
desactivan cuando está oculto (no queda alcanzable por teclado sin
verse). El scroll usa `behavior: 'smooth'`, excepto si
`prefers-reduced-motion: reduce` está activo, en cuyo caso salta
directo (`behavior: 'auto'`). Conectado en la Landing y en las 3
páginas legales (donde más sentido tiene — Términos es la página más
larga del sitio).

## 21. Botón de compartir

`core/ui/ShareButton.jsx` (nuevo): usa la **Web Share API** nativa
cuando el navegador la soporta (deja que el propio sistema operativo
muestre sus apps reales de compartir — nunca se integró ningún SDK de
red social). Cuando no está disponible (confirmado con Playwright: no
existe en Chromium headless, el caso típico de navegador de
escritorio), copia la URL actual al portapapeles y confirma con el
**mismo sistema de toasts ya existente** (`ToastContext`, que ya
estaba montado globalmente desde el Prompt 1 y funciona sin sesión) —
no se inventó un mecanismo de confirmación aparte. Conectado en la
Landing y en las 3 páginas legales (compartir el enlace directo a una
política o a los Términos es un caso de uso real — alguien se lo puede
querer reenviar a un colega o abogado).

## 22. Sugerencias / Feedback

Se auditó primero si ya existía un mecanismo de contacto o feedback —
sí, el formulario de contacto del Prompt 1 — así que se **extendió**
en vez de crear un sistema aparte: `ContactMessage.category` (enum
nuevo `ContactMessageCategory`: `GENERAL`/`SUGGESTION`/`COMMENT`/
`IMPROVEMENT`/`BUG_REPORT`, migración puramente aditiva, `GENERAL` por
defecto para no romper el caso de uso original). El formulario ganó un
selector "¿Qué nos quieres decir?" con las 5 categorías — validación,
loading, éxito y error ya los tenía el formulario original y se
reutilizan sin cambios; la protección contra spam (honeypot + ventana
de enfriamiento por IP) tampoco se duplicó.

## 23. Modo claro y modo oscuro

**No se crearon dos diseños independientes** — el sistema de tokens de
`theme.css` ya existía completo desde una sesión anterior (fondo,
superficies, texto primario/secundario, bordes, estados positivo/
negativo/warning/info, con sus tripletas RGB para fondos translúcidos)
y ya cubría botones/inputs/cards/tablas/modales/enlaces a través de
`module.css` (confirmado con `grep`: 87 usos de `var(--color-*)`, cero
colores fijos). El trabajo real de esta sección fue:

1. **Extender `ThemeContext` a visitantes sin sesión** (ver sección
   18) — un solo sistema, dos fuentes de verdad (servidor con sesión,
   `localStorage` sin ella), nunca dos temas separados.
2. **`core/ui/ThemeToggle.jsx`** (nuevo): botón que cicla
   oscuro→claro→automático→oscuro, con `aria-label`/`title`
   describiendo el estado actual y el próximo. Conectado en la
   Landing, las 3 páginas legales y la 404.
3. **Bug real encontrado y corregido**: el fondo del nav sticky de la
   Landing (`.landing-nav`) tenía escrito a mano el tono OSCURO fijo
   (`rgba(11, 13, 16, 0.85)`) — en tema claro, la barra de navegación
   seguía viéndose oscura encima de una página ya clara (confirmado
   con captura de pantalla). Causa: faltaba una tripleta RGB para
   `--color-bg` en `theme.css` (ya existían para
   positive/negative/warning/info/brand, no para bg). Se agregó
   `--color-bg-rgb` a los dos temas y se corrigió el nav para usar
   `rgba(var(--color-bg-rgb), 0.85)` — ahora cambia con el tema,
   confirmado con una nueva captura.
4. **El modo oscuro no se tocó** — sigue siendo exactamente la
   identidad ya construida ("Tinta"/negro mate). El modo claro
   ("Papel"/hueso cálido, "Tinta"/carbón cálido) ya era una adaptación
   profesional existente, ahora verificada también en las 4 páginas
   públicas nuevas del Prompt 1 (antes nunca se habían visto en claro,
   porque no existía ningún control de tema sin sesión).

## 24. Persistencia del tema y parpadeo (FOUC)

- **Elegir claro/oscuro/automático** ya funcionaba con sesión (`Mi
  Cuenta > Preferencias`, sin cambios); ahora también funciona sin
  sesión vía `ThemeToggle` + `localStorage['theme-public']`.
- **"Automático"** sigue resolviendo contra `prefers-color-scheme` del
  sistema operativo, reevaluado en vivo (ya existía, sin cambios).
- **Bug real de parpadeo (FOUC) encontrado y corregido**: no existía
  ningún mecanismo para fijar el tema antes del primer render de
  React — la página siempre pintaba primero con los tokens del
  `:root` (oscuro) y recién después, cuando `ThemeContext` montaba,
  saltaba al tema real si era distinto. Se agregó un script inline en
  `index.html` (antes de cualquier CSS/JS de la app) que lee
  **exactamente las mismas claves de `localStorage`** que ya usa
  `ThemeContext.jsx` (nunca un mecanismo de tema aparte) y fija
  `data-theme` + el `<meta name="theme-color">` de forma síncrona,
  antes de la primera pintura. Verificado con Playwright: cambiar el
  tema, recargar, y confirmar que `data-theme` ya es el correcto en el
  primer `evaluate()` posible (sin esperar a que React monte nada).

## 25. Accesibilidad

- **Contraste**: medido con la fórmula real de contraste WCAG (no
  estimado) sobre texto de cuerpo, texto secundario, los 2 botones
  nuevos y el botón primario, **en los dos temas** — las 12
  combinaciones dieron ratio ≥ 6.2:1 (AA para texto normal exige
  4.5:1) — el sistema de tokens ya estaba bien calibrado, nada que
  corregir ahí.
- **Bug real encontrado y corregido** (no de contraste, de token):
  `NotificationCenter.css` tenía dos `color: #fff` escritos a mano
  (insignia de notificaciones, botón de marcar como atendida) — fuera
  del sistema de tokens, así que no se adaptaban al tema. Corregido a
  `var(--color-on-accent)`, el token que el proyecto ya usa
  exactamente para este caso (texto claro encima de un fondo de color
  saturado) en otros 5 archivos.
- **Bug real encontrado y corregido** (botones superpuestos): con el
  modo "principiante" de íconos activo por defecto (`Icon.jsx`,
  `beginnerMode`), los botones circulares de ancho fijo (32px:
  `IncognitoToggle`, y los nuevos `ThemeToggle`/`ShareButton`) no
  dejaban espacio para su propia etiqueta de texto — el texto se
  salía del botón y se montaba encima del siguiente ícono de la barra
  (confirmado con captura de pantalla en la Landing Y en la barra
  superior ya existente del ERP: "Tema"/"Ocultar montos"/
  "Notificaciones" se veían unos encima de otros). **No es un bug que
  haya introducido esta pieza en soledad** — `IncognitoToggle` ya
  tenía exactamente el mismo problema estructural desde antes; se
  corrigió en los 3 archivos a la vez (criterio consistente): de
  `width` fijo + círculo perfecto a `min-width` + forma píldora
  (`border-radius: var(--radius-pill)`), que crece con su contenido —
  sigue viéndose como un círculo limpio cuando no hay etiqueta.
- **Teclado**: verificado con Playwright — Tab alcanza el selector de
  tema y el botón de compartir, Enter los activa (cambia el tema;
  dispara copiar+toast). El botón "Volver arriba" es un `<button>`
  real, alcanzable y activable por teclado, con `aria-hidden`/
  `tabIndex=-1` cuando está oculto (nunca "atrapa" el foco de alguien
  navegando solo con teclado en un botón invisible).
- **`prefers-reduced-motion`**: respetado en `Reveal` (aparece de
  inmediato, sin transición) y en `BackToTop` (`scrollTo` sin
  `behavior: 'smooth'`) — verificado con Playwright emulando esta
  preferencia.
- **Formularios**: el formulario de contacto ya tenía
  `aria-invalid`/`aria-describedby`/`role="alert"` por campo (Prompt
  1, sin cambios); el nuevo selector de categoría usa una etiqueta
  nativa `<label>` (nombre accesible sin necesitar `aria-label`
  aparte).
- **Imágenes**: sin cambios — la Landing y las páginas legales no usan
  ninguna imagen raster (confirmado en el Prompt 1); nada que auditar
  de nuevo acá.

## 26. Responsive (390px / 768px / desktop)

Verificado con Playwright, 15 combinaciones (Landing, Privacidad,
Términos, Contacto, 404 × 390/768/1440px).

**Bug real encontrado y corregido, en dos pasos**: agregar `ThemeToggle`
+ `ShareButton` al nav público produjo primero 126px de desborde
horizontal a 390px (4 elementos — tema, compartir, iniciar sesión,
empieza gratis — no cabían en una sola fila). Se corrigió en dos
pasos: (1) ocultar la etiqueta de texto de los 2 botones nuevos a
≤600px (mismo criterio ya usado ahí mismo para ocultar los enlaces
"Producto/Precio/Preguntas" en ese breakpoint), que bajó el desborde a
32px; (2) agregar `flex-wrap` al grupo de acciones del nav para que,
si aun así no caben, pasen a una segunda línea sin perder ningún botón
ni cortar "Empieza gratis". Resultado final: **15/15 combinaciones en
0px de desborde**, confirmado con captura de pantalla del nav a 390px
(logo arriba, tema+compartir+iniciar sesión en una fila, "Empieza
gratis" en su propia fila — se ve intencional, no roto).

**Regresión real encontrada y corregida en el ERP autenticado** (fuera
del alcance explícito de páginas públicas, pero verificada porque esta
pieza tocó un archivo global, `ThemeContext.jsx`): se había agregado
`ThemeToggle` también a la barra superior del ERP (`AppLayout.jsx`)
como mejora adicional — eso empujó esa barra, ya ajustada de espacio
desde una pieza anterior del proyecto, a 46px de desborde a 390px.
Como Mi Cuenta > Preferencias **ya** ofrece el mismo control de tema
para un usuario con sesión, se revirtió esa adición puntual (el
componente `ThemeToggle` en sí se conserva, solo se sacó de esa barra
en particular) en vez de tocar los breakpoints ya afinados del ERP —
la opción más segura y con menos riesgo de otra regresión. Confirmado:
0px de desborde en Panel principal, Venta Rápida y Finanzas a
390/768px tras revertir.

## 27. Rendimiento — antes/después (mismo método que el Prompt 1: Playwright + CDP contra el build de producción con `vite preview`, nunca el servidor de desarrollo)

| Métrica | Prompt 1 (antes de esta parte) | Prompt 2 (después) |
|---|---|---|
| LCP (Landing) | 400 ms | 392 ms |
| CLS (Landing) | 0,0000 | 0,0000 |
| DOMContentLoaded | 290 ms | 304 ms |
| Chunk de entrada (JS) | 365,50 kB (gzip 110,23 kB) | 369,58 kB (gzip 111,50 kB) |
| Chunk de entrada (CSS) | 46,74 kB (gzip 8,01 kB) | 49,61 kB (gzip 8,35 kB) |
| Peso real en disco de lo que carga la Landing | ≈416 KB | ≈422,6 KB |
| Requests totales | 9 | 9 |

**Sin degradación real**: LCP mejoró ligeramente (dentro del margen de
medición), CLS se mantuvo en 0 exacto (las animaciones de `Reveal` son
`opacity`/`transform`, que el navegador puede animar sin recalcular
layout — por diseño, nunca mueven el contenido de alrededor), y el
crecimiento de bundle (+4 KB JS, +3 KB CSS sin comprimir) es
exactamente el tamaño esperado de 4 componentes nuevos, pequeños y sin
ninguna dependencia externa (`Reveal`/`BackToTop`/`ShareButton`/
`ThemeToggle`, un único `IntersectionObserver` y un único listener de
`scroll` protegido con `requestAnimationFrame` en total). No se usó
ninguna librería de animación — nunca se consideró necesaria.

## 28. Tests, lint, build (regresión completa)

- **Jest (backend)**: **753/753** (752 del Prompt 1 + 1 nuevo de
  `contact.service.test.js`, que guarda específicamente que la
  categoría de feedback se persiste correctamente).
- **Lint backend** (`eslint src`): 0 errores.
- **Lint frontend** (`oxlint`): mismo baseline de 9 warnings ya
  conocido (`only-export-components`, patrón arquitectónico
  deliberado) — sin warnings nuevos pese a los ~10 componentes/
  archivos nuevos de esta parte.
- **Build frontend** (`vite build`): limpio, 907 módulos.
- **Prisma**: `npx prisma validate` sin errores; migración
  `20261003202817_contact_message_category` puramente aditiva.
- Ningún test se eliminó ni se omitió para forzar un resultado verde
  — los 3 bugs reales encontrados (nav oscuro en tema claro, botones
  superpuestos, desborde de 126px→32px→0px) se corrigieron en el
  código de producción, re-verificados con Playwright después de cada
  fix, nunca "parcheados" solo en el test.

## 29. Playwright (verificación en vivo, los dos servidores reales + Postgres real)

- **Tema**: ciclo completo oscuro→claro→automático→oscuro con clics
  reales; persistencia confirmada recargando la página
  (`localStorage['theme-public']`); las 4 páginas públicas
  confirmadas en claro con los colores exactos esperados (fondo
  `rgb(246,244,239)`, texto `rgb(30,28,24)`).
- **Animaciones de scroll**: con movimiento normal, las secciones
  empiezan ocultas y pasan a visibles al hacer scroll (confirmado
  comparando el estado antes/después de un scroll al final de la
  página); con `prefers-reduced-motion: reduce` emulado, la primera
  sección ya está visible sin ningún scroll.
- **Volver arriba**: oculto al cargar, visible pasados 480px de
  scroll, el clic y la tecla Enter devuelven `scrollY` a 0.
- **Compartir**: sin Web Share API (caso real de Chromium de
  escritorio), copia al portapapeles y muestra el toast "Enlace
  copiado al portapapeles."; con teclado (foco + Enter) funciona
  igual.
- **Feedback**: categoría "Sugerencia" seleccionada, formulario
  enviado, fila real confirmada en Postgres con `category: SUGGESTION`
  antes de limpiarla.
- **Responsive**: ver sección 26 — 15/15 páginas públicas + 6/6
  pantallas del ERP autenticado en 0px de desborde.
- 0 errores de consola nuevos en todo el recorrido (aparte del
  bloqueo ya conocido de Google Fonts en este entorno de pruebas, sin
  relación con esta pieza).

## 30. Regresiones

Ninguna en el ERP ni en lo ya construido del Prompt 1. Los 2 bugs de
responsive/superposición de botones eran regresiones que esta MISMA
pieza introdujo al conectar los componentes nuevos — se encontraron y
corrigieron dentro de la propia verificación, antes del cierre, no
después. La regresión de la barra superior del ERP (sección 26) se
revirtió por completo. El resto de bugs encontrados (nav oscuro en
tema claro, `#fff` fuera de tokens) eran reales pero preexistentes al
layout ya construido, solo visibles ahora porque esta pieza fue la
primera vez que alguien probó esas pantallas en tema claro — se
corrigieron igual.

## 31. Documentación

Esta sección (18-31) se agregó a `WEB_SEO_PERFORMANCE_FINAL.md` (no
se creó un documento nuevo). `PROGRESS_LOG.md` actualizado con el
cierre de esta parte.

## 32. Cierre definitivo (Prompt 2/2)

Commit local sobre `claude/fintech-platform-nodejs-pdgvjf`. Con esto
se cierra por completo la etapa WEB/UX de Alarfly — no se crea una
tercera fase ni otro plan. Cualquier trabajo adicional sobre la capa
web requiere una instrucción explícita nueva del usuario.
