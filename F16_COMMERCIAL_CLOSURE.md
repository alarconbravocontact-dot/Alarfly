# F16_COMMERCIAL_CLOSURE.md — Cierre de Fase 16 (Growth / Comercial)

> **Nota de fuente**: se buscó `Markdown.md`, `ALARFLY_MASTER_UX_UI_REDESIGN.md`
> y `AI_ARQUITECTURA.md` (nombre exacto) en todo el sistema de archivos
> de esta sesión — ninguno de los 3 existe, búsqueda exhaustiva, cero
> resultados. Mismo hallazgo ya reportado en los 3 bloques anteriores
> de F16, reconfirmado acá, no repetido como si fuera nuevo. Se leyeron
> `PROGRESS_LOG.md`, `CLAUDE.md`, `frontend/DESIGN_SYSTEM.md`,
> `F16_COMMERCIAL_FUNNEL_AUDIT.md`, `F16_ACTIVATION_CONVERSION_AUDIT.md`,
> `F16_GROWTH_AUDIT.md`, `F14_ENTERPRISE_CLOSURE.md`,
> `F15_PRODUCTION_CLOSURE.md`, `AI_ARCHITECTURE.md` (nombre en inglés,
> sí existe) como contexto — ninguna afirmación de esos documentos se
> dio por buena sin verificarla contra el código y, cuando correspondía,
> contra el navegador real.

## 1. Resumen ejecutivo

F16 auditó, en 4 bloques, si Alarfly puede llevar a una persona desde
que se entera de que existe hasta que lo recomienda. La respuesta
honesta: **hoy no, porque el primer tramo (visita→registro→trial→pago)
no existe**, por decisión consciente de alcance de sesiones anteriores,
no por un defecto. Lo que SÍ existe (desde el primer login hasta la
recurrencia dentro de la app) se auditó a fondo, con evidencia real de
navegador — y ahí se encontró y corrigió el hallazgo más serio de toda
la fase: **en un teléfono real (390px), la aplicación completa era
inutilizable** — cada cifra de dinero del Panel principal quedaba
cortada a la mitad por un desborde horizontal de toda la página. Se
corrigió (ver E18/sección 6) y se validó en los 5 anchos pedidos
(1440/1280/1024/768 + un teléfono real de 390px), sin tocar el
lenguaje visual (mismo dark-first, wine-red, charcoal, tipografía). Se
agregó además higiene técnica mínima de SEO (robots.txt + noindex,
correcto mientras no exista landing pública). Ninguna otra pieza de
código se tocó — el resto de F16 (registro público, trial, billing,
referidos, afiliados, A/B testing) sigue, correctamente, sin construir.

## 2. Estado inicial de F16

Al empezar este bloque, F16 tenía 3 bloques previos cerrados con
deuda (E1-E5, E6-E10, E11-E15), 0 hallazgos CRITICAL/HIGH sin resolver,
y una deuda 100% dependiente de la misma raíz: ausencia de registro
público/trial/billing real. Ningún bloque anterior había avanzado a
implementación de landing/adquisición/SEO — quedaba explícitamente
para este bloque final.

## 3. E1–E5 (referencia, no repetido)

Ver `F16_COMMERCIAL_FUNNEL_AUDIT.md`. Inventario de capacidades
comerciales, posicionamiento, viabilidad de pricing, flujo de
registro/activación, auditoría del embudo — cerrado con deuda
(registro/trial/billing ausentes, documentados).

## 4. E6–E10 (referencia, no repetido)

Ver `F16_ACTIVATION_CONVERSION_AUDIT.md`. Onboarding, First Value,
Trial→Paid, retención inicial, UX comercial transversal — 3 hallazgos
MEDIUM reales, los 3 corregidos (enlaces directos en el checklist de
onboarding, conexión primera venta→impacto financiero, 2 estados
vacíos críticos con acción). Cerrado con deuda (resto documentado, no
implementado).

## 5. E11–E15 (referencia, no repetido)

Ver `F16_GROWTH_AUDIT.md`. Métricas comerciales, experimentación,
referidos, afiliados, growth loops — cero infraestructura real en las
5 etapas (confirmado con `grep` exhaustivo), cero código nuevo,
arquitectura mínima documentada para cada una. Cerrado con deuda.

## 6. E16 — Sistema de Adquisición

**Canales reales auditados**: el único canal de entrada real hoy es
la invitación directa de un ADMIN existente (`access-levels.inviteUser`)
— interno, no atribuible externamente, sin relación con "adquisición"
en el sentido de Growth. Reconfirmado (sin novedad respecto a E1-E5):
sin landing, sin registro público, sin referidos, sin afiliados, sin
contenido indexable, **y sin ningún mecanismo de contacto** (`grep` de
"contáctanos"/"contact us"/formulario de contacto: cero resultados en
todo el frontend).

Ningún canal está medido (no hay atribución de ningún tipo — no hay
nada que atribuir). Source of Truth propuesto para cuando exista un
registro real: `Company.createdAt` + `AuditLog` (`user.invitation_accepted`)
como ya se documentó en E11 — no se duplica esa conclusión con una
fuente nueva. **No se implementó ningún canal ni mecanismo de
atribución** — no hay ningún problema real de atribución que corregir
porque no existe ninguna atribución todavía.

## 7. E17 — SEO / Contenido Comercial

**Estado técnico encontrado**: `index.html` solo tenía `<title>Alarfly</title>`
— sin meta description, sin Open Graph, sin `robots.txt`, sin
`sitemap.xml`, sin contenido indexable de ningún tipo (confirmado:
`frontend/public/` solo tenía `favicon.svg`). Esto es coherente y
esperado: no existe ninguna página pública que SEO deba optimizar
todavía (E1-E5).

**Hallazgo real, corregido**: sin `robots.txt` ni una directiva
`noindex`, un buscador rastrea/indexa por defecto — el único resultado
real sería la pantalla de "Iniciar sesión" (o, peor, decenas de rutas
de la SPA sin contenido, cada una resolviendo al mismo formulario de
login). Es un defecto técnico real y de bajo riesgo pero concreto de
corregir: `frontend/public/robots.txt` (nuevo, `Disallow: /`
completo) + `<meta name="robots" content="noindex, nofollow">` en
`index.html`. No se agregó meta description/Open Graph — no tiene
sentido optimizar el SEO de una página que se acaba de marcar
explícitamente como "no indexar"; esas etiquetas se agregan el día que
exista contenido público real que sí deba indexarse.

**No se construyó**: ningún blog, CMS, generador de páginas SEO ni
contenido automático — ninguno tiene sentido sin que exista primero
una landing real con una estrategia de contenido detrás.

## 8. E18 — Optimización de Conversión

### Landing / Registro / Trial / Pricing
Sin cambios — no existen (E1-E5/E8), reconfirmado sin repetir la
auditoría completa.

### Onboarding / Primer valor
Ya auditado y corregido en E6-E10 (checklist con enlaces directos,
conexión venta→impacto financiero). Reconfirmado en este bloque que
sigue funcionando: probado en vivo (ver sección 9) sin regresión.

### Validación visual comercial (evidencia real de navegador)

Se validó Login + Panel principal (Inicio, la superficie comercial
real más cercana a un "primer valor" que existe) en **5 anchos**:
1440, 1280, 1024, 768 (los 4 pedidos) y **390 (teléfono real, iPhone)**
— agregado porque 768px es más tablet que teléfono real, y el pedido
exige "viewport móvil real cuando corresponda".

**Hallazgo CRITICAL real, corregido**: a 390px, `document.documentElement.scrollWidth`
media 668px contra un viewport de 390px — un desborde horizontal de
278px que arrastraba a TODA la aplicación. Medido con `scrollWidth`
real (no solo una captura a ancho fijo — el mismo nivel de rigor que
ya exigió un bug similar documentado en este mismo archivo en una
sesión anterior, "Rediseño UX/UI Etapa 3"). Diagnóstico exacto
(elemento por elemento, no supuesto): el menú lateral expandido
(200-240px) + el contenido del topbar (buscador + selector de
moneda + modo incógnito + notificaciones + usuario + cerrar sesión,
468px) juntos necesitaban 668px, muy por encima de los 390px
disponibles — cada tarjeta de dinero del Panel principal (Caja
disponible, Cuentas por cobrar, EBITDA, etc.) quedaba cortada a la
mitad.

**Corrección real** (`AppLayout.jsx`/`.css`, ver sección 12 para el
detalle técnico completo): el menú lateral se fuerza al modo "solo
íconos" (ya existente, ya probado, solo para escritorio hasta ahora)
en viewports de teléfono, sin tocar la preferencia real del usuario;
el buscador de pantallas ("Buscar una pantalla…") se oculta por
completo por debajo de 480px (sigue siendo alcanzable navegando el
menú). Reverificado con la misma medición exacta:
`document.documentElement.scrollWidth === 390` — **exactamente el
ancho del viewport, cero desborde**. Reconfirmado visualmente con una
captura completa: todas las cifras, tarjetas, gráficos y botones se
leen completos, sin cortes.

**Los 4 anchos originalmente pedidos (1440/1280/1024/768) se
revalidaron después del cambio**: sin desborde en ninguno, sin
regresión — el arreglo solo se activa por debajo de 640/480px, nunca
afecta escritorio ni tablet.

### Trial / Pricing (comunicación)
No se comunica en ningún lugar del producto (`grep` de "$25"/"7 días
gratis"/"plan único": cero resultados) — coherente con que no existe
todavía ninguna superficie comercial (landing/pricing page) donde
comunicarlo. No se inventó ningún texto nuevo.

## 9. E19 — Auditoría Comercial Final (sweep completo)

| Área | Estado | Evidencia | Riesgo | Acción |
|---|---|---|---|---|
| Posicionamiento | Documentado (E1-E5), sin landing donde aplicarlo | `F16_COMMERCIAL_FOUNDATION_AUDIT.md` | LOW | Ninguna en este bloque |
| Adquisición | Un solo canal real (invitación interna) | `access-levels.inviteUser`, cero rutas públicas | DEBT | Documentado |
| SEO técnico | Sin metadata/robots hasta este bloque | `index.html`, `public/` | MEDIUM → **corregido** | `robots.txt` + noindex agregados |
| Registro/Onboarding | Onboarding real y ya mejorado (E6) | `setup-status.service`, `SetupProgressBar.jsx` | LOW/DEBT | Sin cambios nuevos en este bloque |
| First Value/Activación | Definido con evidencia (E7), conectado | `QuickSalePage.jsx`, `/finanzas/resumen` | LOW/DEBT | Sin cambios nuevos en este bloque |
| Trial | No existe | Confirmado E1-E5/E8/E16 | DEBT | Documentado, no implementado |
| Pricing | Decisión preservada, sin comunicar | Confirmado `grep` | DEBT | Documentado |
| Conversión (paid) | No existe | Confirmado E8 | DEBT | Documentado |
| Retención | Mecanismos reales, sin canal externo | `core/alerts`, `notifyAlert()` vacía | DEBT | Documentado (E9) |
| Referidos | No existe | Confirmado E13 | DEBT | Documentado |
| Afiliados | No existe | Confirmado E14 | DEBT | Documentado |
| Growth loops | No existe (correcto por aislamiento) | Confirmado E15 | DEBT/FUTURO | Documentado |
| Métricas comerciales | Ingredientes existen, sin panel | Confirmado E11 | DEBT | Documentado |
| **UX/Responsive (Login+Inicio)** | **Desborde crítico en teléfono real** | `scrollWidth` medido en 5 anchos | **CRITICAL → corregido** | `AppLayout.jsx`/`.css` |
| Seguridad/RBAC/Multiempresa | Sin superficie nueva, reconfirmado sin regresión | Playwright con rol restringido a 390px | — | Ninguna necesaria |
| Dark patterns | Ninguno encontrado (nada que manipular — sin pricing/trial visible) | `grep` + revisión de baja de cuenta ya documentada | — | Ninguna necesaria |

## 10. Métricas comerciales definidas

Ver E11 (`F16_GROWTH_AUDIT.md`, sección 1) — 4 métricas mínimas
documentadas (empresas creadas/semana, invitados vs. aceptados, %
empresas con 1+ paso de setup, usuarios con sesión en 7/30 días), las
4 calculables con fuentes ya existentes, ninguna implementada como
panel todavía (requiere decisión de acceso cruzando empresas).

## 11. Funnel final

```
VISITA         → NO EXISTE (sin landing)
ENTENDIMIENTO  → NO EXISTE
INTERÉS        → NO EXISTE
REGISTRO       → NO EXISTE (solo invitación interna)
PRIMER VALOR   → Existe y mejorado (E7): venta→Resumen financiero
ACTIVACIÓN     → Definida (E7), no medida como score todavía
PRUEBA         → NO EXISTE
CONVERSIÓN     → NO EXISTE
RETENCIÓN      → Existe (core/alerts), sin canal externo (email/push)
RECOMENDACIÓN  → NO EXISTE (sin growth loop que cruce empresas)
```

## 12. Activation event definido

Ver E7: 1 paso de `setup-status.service` completado + 1 movimiento de
dinero real registrado. Documentado, no implementado como indicador
visible (reconfirmado en este bloque, sin cambios).

## 13. Retention event definido

Ver E9: "volver porque hay una decisión financiera pendiente"
(cobranza/pago por vencer vía `core/alerts`), no una frecuencia
artificial. Reconfirmado sin cambios.

## 14. Conversion event definido

**No se puede definir todavía** (ver E8) — conversión significa
"empezó a pagar", y no existe ningún concepto de pago comercial en el
sistema. Candidato conceptual documentado: primera transacción exitosa
contra el plan de $25/mes ya decidido, pendiente de que exista billing
real.

## 15. Referral architecture

Ver E13 (`F16_GROWTH_AUDIT.md`) — modelo mínimo documentado (código
de referido por persona, atribución inmutable, cuenta solo tras
activación real), no implementado.

## 16. Affiliate architecture

Ver E14 — `AffiliateAccount`/`AffiliateConversion` con
`commissionStatus` manual (nunca pago automático), $5 por el pedido
comercial actual, documentado, no implementado.

## 17. Growth loops identificados

Ver E15 — ninguno cruza el límite de una empresa hoy (consecuencia
correcta del aislamiento multiempresa); el único real es expansión de
equipo (invitar usuario), no adquisición.

## 18. Landing state

No existe. Ningún cambio en este bloque — construirla es una decisión
de producto de mayor alcance, fuera de todo lo que F16 auditó (F16
audita/prepara el sistema comercial, no construye la landing en sí).

## 19. Pricing state

$25/mes, 7 días gratis, un solo plan — decisión preservada sin
alterar en los 4 bloques de F16. No se comunica en ningún lugar del
producto todavía (no hay dónde: sin landing/pricing page).

## 20. Trial state

No existe ningún campo, lógica ni comunicación de trial — reconfirmado
en cada uno de los 4 bloques de F16, sin cambios.

## 21. Onboarding state

Real y parcialmente mejorado (E6): 4 pasos verificados contra el
sistema real, cada uno con enlace directo a su pantalla desde F16-E6.
Sin wizard guiado activo (documentado como deuda, decisión de
producto pendiente).

## 22. Seguridad

Sin cambios de superficie en este bloque (0 endpoints nuevos). El
único código nuevo es presentación (CSS/JSX de layout) — reconfirmado
en vivo que no afecta RBAC: un rol restringido (`COLLABORATOR`) sigue
viendo exactamente el mismo subconjunto de módulos en el menú
colapsado a 390px que en escritorio, sin ningún ítem adicional ni
oculto de más.

## 23. Multiempresa

Sin cambios — ningún endpoint nuevo, ningún dato cruzando `companyId`.
Reconfirmado (sin repetir la auditoría completa de F14) que la
aislación sigue intacta.

## 24. UX

Ver E18 — el hallazgo real y corregido de esta fase completa. Resto
de la UX (onboarding, estados vacíos, ayuda contextual, glosario)
reconfirmado sin cambios respecto a E6-E10.

## 25. Responsive

**Antes**: desborde crítico en teléfono real (390px), aplicación
inutilizable. **Después**: validado sin desborde en 1440/1280/1024/768/390,
con evidencia real de navegador (`scrollWidth` medido, no solo
capturas). Sin regresión en el toggle manual de escritorio (probado:
expandir/contraer/persistencia tras recargar, sin cambios).

## 26. Tests

708/708 antes → 708/708 después (backend sin cambios — el fix de esta
fase es 100% frontend). 0 regresiones. No se agregaron tests
unitarios nuevos: el cambio es de presentación/layout responsivo
(condicional de viewport + CSS), sin lógica de negocio pura que
probar con Jest — se validó con Playwright contra el navegador real
en su lugar, que es la herramienta correcta para este tipo de defecto
(mismo criterio ya usado en el resto del proyecto para piezas
puramente de frontend).

## 27. Validación real

Confirmada, no solo análisis estático: Playwright contra los
servidores reales (backend+frontend) y Postgres real. Medido
`scrollWidth`/`clientWidth` elemento por elemento (no solo
`isVisible()`/capturas) para diagnosticar la causa exacta antes de
corregir. Revalidado en los 5 anchos después del fix. Revalidado el
toggle manual de escritorio (expandir/contraer/persistencia). Revalidado
con un rol restringido (`COLLABORATOR`) a 390px para confirmar que el
fix no afecta RBAC. `robots.txt`/meta `noindex` confirmados presentes
en el build de producción y servidos en vivo por el dev server.

## 28. Riesgos

Ninguno nuevo de seguridad (0 endpoints nuevos, RBAC reconfirmado sin
regresión). Riesgo de producto ya documentado en bloques anteriores
(construir Growth antes de tener registro público sería especulativo)
— no se tomó ese riesgo en este bloque tampoco.

## 29. Deuda

Toda la deuda de F16 sigue siendo, en esencia, la misma raíz
documentada desde E1-E5: sin registro público/trial/billing real, la
mayoría de las piezas clásicas de Growth (adquisición medible, SEO de
contenido, conversión a pago, referidos, afiliados, A/B testing,
growth loops que crucen empresas) no tienen todavía nada real que
medir o construir sobre eso. Se suma a esta lista, nueva de este
bloque: onboarding guiado activo (wizard), panel de métricas
comerciales de la plataforma (cruza el aislamiento multiempresa a
propósito, requiere una decisión de rol nueva).

## 30. Futuras oportunidades

Secuencia de dependencia real documentada en `F16_GROWTH_AUDIT.md`
sección 11: registro público + empresa → trial + billing → panel de
métricas comerciales → referidos → afiliados → A/B testing (solo si
el volumen lo justifica). El robots.txt/noindex agregado en este
bloque debe revisarse y relajarse (quitar `noindex`, agregar meta
description/Open Graph reales) el día que exista una landing pública
real que sí deba indexarse.

## 31. Qué NO se implementó y por qué

- Landing pública, registro público, creación de empresa fuera del
  seed: fuera de alcance explícito de F16 desde E1-E5, ninguna
  instrucción de ningún bloque pidió construirla.
- Trial real (campos/lógica de vencimiento) y cualquier forma de
  billing/pago/suscripción: instrucción explícita de no implementar
  sin decisión de proveedor.
- Referidos y afiliados (incluida cualquier pieza de pago de
  comisión/payout): dependen de registro público real; instrucción
  explícita de no construir infraestructura de pago sin necesidad
  real.
- A/B testing / feature flags: sin volumen ni flujo público que
  experimentar — habría sido "A/B testing ficticio", prohibido
  explícitamente.
- CRM, marketing automation, campañas, publicidad, IA de Growth,
  chatbot comercial, CMS/blog, generación automática de contenido SEO:
  ninguno tiene una necesidad real hoy, y todos están explícitamente
  fuera de alcance de F16.
- Un panel de métricas comerciales de la plataforma: cruza el
  aislamiento multiempresa a propósito, requiere un nuevo tipo de
  acceso (`PLATFORM_ADMIN`) — decisión de producto que no correspondía
  tomar unilateralmente en un bloque de auditoría.
- Onboarding guiado activo (wizard): decisión de diseño de mayor
  alcance (¿modal? ¿cuántos pasos se pueden omitir?), documentada
  como deuda desde E6, no resuelta unilateralmente.

## 32. Estado final F16

**F16 — CERRADA CON DEUDA**

Justificación con evidencia: **CRITICAL=0, HIGH=0** tras esta sesión
(el único CRITICAL real de toda la fase — el desborde móvil — se
encontró y se corrigió en este mismo bloque, con validación real en 5
anchos). La deuda restante, en su totalidad, es infraestructura
comercial que depende de una precondición explícitamente fuera de
alcance de F16 (registro público/trial/billing real) — no hay ningún
hallazgo de seguridad, RBAC, multiempresa ni UX pendiente sin
documentar. F16 deja el producto **listo para que, el día que se
decida construir registro público y billing, el resto del sistema
(onboarding, first value, retención, UX responsiva) ya esté probado y
funcionando** — no bloquea esa decisión, la espera.
