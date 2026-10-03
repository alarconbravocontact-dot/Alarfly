# LANDING_MASTER_STRATEGY.md — Estrategia Comercial y Arquitectura de la Landing de Alarfly

> **Nota de fuente, igual que exige esta etapa**: se buscó el archivo
> `Markdown.md` ("Cuestionario Maestro de Landing Page") en todo el
> repositorio — no existe como archivo. Lo que sí existe, y es la base
> de todo este documento, es el trabajo real de F16 (Growth/Comercial)
> que ya auditó el producto desde una óptica de marketing y ya dejó
> decisiones tomadas: `F16_COMMERCIAL_FOUNDATION_AUDIT.md` (resumen del
> cuestionario del usuario + auditoría E1-E5), `F16_COMMERCIAL_FUNNEL_AUDIT.md`
> (embudo real vs. ideal), `F16_ACTIVATION_CONVERSION_AUDIT.md`
> (onboarding/activación/UX comercial, incluida la paleta real
> confirmada contra `theme.css`), `F16_GROWTH_AUDIT.md` (métricas,
> referidos, afiliados) y `F16_COMMERCIAL_CLOSURE.md` (cierre, con el
> hallazgo CRITICAL de 390px ya corregido). **Ninguna de esas
> decisiones se reemplaza acá** — se preservan, se verifican contra el
> producto actual (post-F17), y se completan con lo que esta etapa
> pide que F16 no cubría (mensajería lista para redactar copy, hero,
> estructura de secciones, SEO, dirección visual aplicada a landing,
> funnel de conversión visual). Donde este documento amplía o afina una
> decisión de F16, se marca explícitamente como tal.

---

## 1. Estado real del producto

### Clasificación aplicada en todo este documento
- **EXISTE** — implementado, probado, verificable en código/Postgres real.
- **EXISTE PARCIALMENTE** — hay infraestructura o una versión incompleta.
- **PLANIFICADO** — decidido conceptualmente, no construido.
- **FUTURO** — no forma parte del producto actual, ni decidido en detalle.

### Lo que Alarfly es hoy (EXISTE, auditado F0-F17)
Un ERP financiero multiempresa, en producción interna, con 8 módulos de
negocio completos y probados: **Contabilidad** (plan de cuentas,
asientos, periodos, reportes, consolidación), **Tesorería** (cuentas,
conciliación bancaria, tarjetas, órdenes de pago con aprobación
multinivel, deuda, caja chica, alertas, previsión de liquidez),
**Cuentas por Cobrar y por Pagar** (límite de crédito, cobranza
escalonada automática con bloqueo de cliente, notas de crédito/débito,
conciliación con el banco real), **Inventario** (multi-almacén,
FIFO/LIFO/Promedio Ponderado, trazabilidad de lotes y vencimientos,
reabastecimiento automático), **Fiscal** (motor de impuestos/
retenciones, validaciones preventivas, facturación electrónica con
patrón adaptador, calendario fiscal), **FP&A** (presupuestos
versionados, desviaciones en tiempo real, simulador What-If conectado
a la previsión de liquidez real, KPIs configurables), **Reportes**
(estados financieros, flujo de efectivo, rentabilidad por producto/
cliente, antigüedad de saldos, tablero ejecutivo, exportación PDF/
Excel/CSV), y **Análisis Avanzados** (16 tipos de análisis financiero
automatizados y auditados: Vertical, Horizontal, Razones Financieras,
Punto de Equilibrio, DuPont, VAN/TIR, Benchmarking, Predictivo, entre
otros). A esto se suma gobierno interno real: **Niveles de Acceso**
(4 roles de negocio con cupo por empresa), **Mi Cuenta** (2FA real con
TOTP, sesiones activas revocables), **Centro de Notificaciones**, y
**Junta** (comunicación interna con adjuntos).

### Lo que acaba de confirmarse con F17 (EXISTE, nuevo desde el cierre de F16)
F16 ya daba por sentado que el producto "ya funciona y ya se probó".
**F17 (recién cerrado) fue más allá: auditó 20 experiencias de usuario
real de punta a punta** (primer acceso → configuración → primera venta
→ primera compra → cierre de periodo → gestión de equipo →
presupuesto → seguridad → rentabilidad → inventario avanzado),
encontró y corrigió 19 defectos reales (0 CRITICAL), y en su auditoría
final verificó **la integridad del Ledger a nivel de cada asiento
individual** (0 desbalanceados en operaciones reales), **cadenas
transaccionales completas en vivo** (Venta→Inventario→Factura→CxC→
Cobro→Ledger→Auditoría, y su equivalente de Compras), y **permisos
reales a nivel de API** (no solo ocultar un botón). Esto es un activo
de confianza genuino y nuevo que F16 no tenía todavía — ver sección 19.

### Lo que NO existe (reconfirmado contra el código en esta sesión, sin cambios desde F16)
- **Registro público (signup)**: NO EXISTE. Solo se entra por
  invitación de un Administrador ya existente.
- **Creación de empresa self-service**: NO EXISTE fuera del seed.
- **Trial**: NO EXISTE ningún campo `trial*` en el schema.
- **Pricing/Billing/Suscripción**: NO EXISTE ningún modelo de plan,
  pago o suscripción. 0 integración de pasarela de pago.
- **Landing pública**: NO EXISTE — cualquier visitante sin sesión solo
  ve `/acceso` (login).
- **Recuperación de contraseña por correo, envío de correo en general**:
  NO EXISTE (documentado como límite consciente desde antes de F16).
- **Referidos / Afiliados / A-B testing / Growth loops**: NO EXISTEN.
- **Inteligencia Artificial / aprendizaje automático**: NO EXISTE. Esto
  es una prohibición de mensaje explícita heredada de F16 y reconfirmada
  acá — ver sección 10.

### Conclusión de esta sección
El producto detrás de la landing es real, extenso y recién auditado de
punta a punta. El sistema que llevaría a un visitante desde la landing
hasta pagar **no existe todavía** (sin registro público, sin trial
funcional, sin cobro). Esto no es un defecto de la landing — es una
pieza de infraestructura que la Fase Landing debe construir en una
etapa posterior a la estrategia (ver sección 29, hipótesis/riesgos).
**La landing puede y debe construirse ya** mostrando el producto real,
pero su CTA principal debe ser honesto sobre lo que puede entregar hoy
mismo (ver sección 12).

---

## 2. Producto que estamos vendiendo

**En una frase**: Alarfly es el sistema financiero completo de una
pyme — contabilidad, tesorería, ventas, compras, inventario y
reportes, todo conectado, sin necesitar un contador de tiempo completo
para entenderlo.

**Frase comercial** (para hero/meta description): *Controla el dinero
de tu negocio sin ser contador.*

**Párrafo**: Alarfly reúne en un solo lugar lo que una pyme hoy
maneja repartido entre hojas de cálculo, cuadernos y la memoria del
dueño: cuánto tiene en el banco, quién le debe, a quién le debe,
cuánto vale su inventario, si está ganando o perdiendo dinero este
mes. Cada venta, cada compra y cada pago se registran una sola vez y
se reflejan automáticamente en la contabilidad, en el flujo de caja y
en los reportes — sin doble trabajo, sin hojas de cálculo que se
desactualizan, y explicado siempre en lenguaje simple, nunca en jerga
contable.

**Explicación completa**: Alarfly es un sistema de gestión financiera
multiempresa que cubre el ciclo completo de una pyme: vender
(facturación, cuentas por cobrar, cobranza), comprar (órdenes de
compra, cuentas por pagar, pagos), controlar inventario (multi-
almacén, costeo FIFO/LIFO/Promedio Ponderado, trazabilidad de lotes),
y entender las finanzas resultantes (contabilidad de partida doble,
tesorería con conciliación bancaria real, presupuestos, 16 tipos de
análisis financiero automatizado, reportes ejecutivos). Está pensado
para que lo use el dueño del negocio o alguien de su equipo sin
formación contable formal — cada campo con jerga tiene una explicación
en una frase, y cada módulo avanzado (FP&A, Análisis Avanzados) existe
para dar respuestas, no para exigir que el usuario sepa interpretarlas
solo.

---

## 3. Cliente ideal

### Lo que preserva el cuestionario original (F16, no modificado)
Dueños de pyme sin formación financiera formal, que quieren control
sin volverse contadores.

### Perfil ampliado (construido sobre esa base, con evidencia del producto real)
- **Tamaño de empresa**: pyme con operación real (vende, compra, tiene
  inventario o al menos cuentas por cobrar/pagar) — no un freelancer
  de un solo servicio sin inventario ni equipo. Evidencia: los 4 roles
  de `core/rbac` (Administrador, Contador hasta 3, Financiero hasta 4,
  Colaborador hasta 8) están pensados para un equipo de al menos 2-3
  personas, no para un usuario único.
- **Nivel de madurez**: empresa que ya opera (no una idea en papel) y
  que siente la necesidad de un sistema porque la hoja de cálculo ya
  no alcanza — el producto entero asume datos reales desde el primer
  día (plan de cuentas, periodo contable, catálogo), no un "modo
  demo" conceptual.
- **Responsable de decisión / usuario principal**: el dueño o gerente
  general (rol Administrador, sin límite de cupo, acceso total) es
  quien decide adoptar el sistema; el Contador (si lo tiene, cupo 3)
  y el Financiero (cupo 4) son los usuarios de uso diario más técnico;
  el Colaborador (cupo 8, acceso a Inventario y registro en Ventas/
  Finanzas) cubre al resto del equipo operativo.
- **Contexto operativo — HIPÓTESIS, requiere validación de mercado**:
  el motor de cambio (`core/fx`) tiene a **BCV (Banco Central de
  Venezuela)** como fuente de tasa de cambio por defecto, con soporte
  nativo para VES (bolívares) junto a USD/EUR, auditado a nivel de
  cada tasa registrada. Esto es una decisión de diseño real y
  profunda, no un detalle cosmético — **sugiere fuertemente que el
  cliente ideal original es una pyme venezolana (o que opera con
  bolívares/USD a diario)**, pero esto es una inferencia a partir del
  código, no un dato de mercado confirmado. Se marca explícitamente
  como **hipótesis a validar** con el usuario antes de construir
  mensajería que asuma un país específico.
- **Capacidad de pago**: sin datos de mercado propios (no hay
  clientes pagos todavía). El pricing ya decidido en F16 ($25/mes) es
  coherente con una pyme formal con cierto volumen de operación, no
  con un negocio de subsistencia — pero esto también es una hipótesis
  heredada de la decisión original, no validada con ventas reales.

### Lo que NO se inventa
No se fabrican datos demográficos (edad, ubicación exacta, sector
específico más allá de "pyme con operación comercial/de inventario").
Si el usuario puede confirmar o corregir el país/sector principal, eso
debe resolverse **antes** de escribir el copy final de la landing
(hipótesis #1 de la sección 29).

---

## 4. Problemas principales que resuelve

Evaluados contra las capacidades reales (no se asume que todos son
igual de centrales):

| Problema | ¿Es central hoy? | Evidencia real |
|---|---|---|
| Información financiera dispersa (hojas de cálculo, cuadernos, memoria) | **Sí, el más central** | Todo el producto existe para centralizar esto — es la razón de ser de los 8 módulos |
| Decisiones basadas en intuición, no en datos | **Sí** | FP&A (presupuestos, desviaciones), 16 Análisis Avanzados, Tablero Ejecutivo — todos existen específicamente para esto |
| Falta de visibilidad sobre cuánto hay realmente en caja | **Sí** | Previsión de Liquidez semanal, Posición de Caja Consolidada — ambos EXISTE y verificados en F17 |
| Cuentas por cobrar que se pierden de vista (clientes que no pagan) | **Sí** | Cobranza escalonada automática con bloqueo de cliente — EXISTE, verificado en F17-E18 |
| Inventario sin control (no se sabe cuánto hay, cuánto vale, qué va a vencer) | **Sí** | Multi-almacén, costeo real, trazabilidad de lotes/vencimiento — EXISTE, verificado en F17-E20 |
| Complejidad administrativa / necesitar un contador para todo | **Sí, es el diferenciador de tono** | Todo el sistema de diseño (glosario, HelpTooltip, lenguaje simple) existe para esto, documentado desde el origen del proyecto |
| Falta de control sobre cuentas por pagar | Sí, pero secundario frente a CxC | CxP existe y funciona, pero no tiene una pieza tan distintiva como la cobranza escalonada de CxC |
| Rentabilidad poco clara (¿qué producto/cliente realmente da dinero?) | Sí, diferenciador para una pyme más madura | Rentabilidad por Producto/Cliente — EXISTE, con un bug real encontrado y corregido en F17 (ver auditoría) |

**Los 2 problemas centrales para el mensaje principal**: (1) finanzas
dispersas sin control real, (2) necesitar ser experto en finanzas para
tener ese control. Todo lo demás (CxC, inventario, rentabilidad) son
**pruebas concretas** de cómo Alarfly resuelve esos dos problemas, no
problemas independientes de primer nivel.

---

## 5. Propuesta de valor

### Value Proposition principal
**"El control financiero de tu negocio, sin tener que ser contador."**

### Beneficios principales (4, cada uno con una capacidad real detrás)

1. **Todo en un solo lugar.** Ventas, compras, inventario y
   contabilidad conectados — una venta actualiza el stock, genera el
   asiento contable y mueve la cuenta por cobrar, automáticamente.
   *(Capacidad real: motor de asientos único, verificado en F17 con
   cadenas transaccionales completas.)*
2. **Sabes cuánto dinero tienes, y vas a tener.** No solo el saldo de
   hoy — la Previsión de Liquidez te muestra las próximas 8 semanas
   con tus facturas y deudas reales. *(Capacidad real: `liquidity-forecast`,
   Tesorería punto 5.)*
3. **Nadie se te escapa sin pagar.** La cobranza se escala sola:
   recordatorio, aviso firme, y bloqueo automático si el atraso es
   grave. *(Capacidad real: cobranza escalonada de AR, verificada en
   F17-E18.)*
4. **Entiendes los números sin un diccionario contable.** Cada término
   técnico tiene una explicación en una frase, al lado del campo donde
   lo necesitas. *(Capacidad real: `HelpTooltip`/glosario, aplicado en
   todo el producto desde su diseño original.)*

### Funcionalidad vs. Beneficio vs. Resultado empresarial (lógica real de Alarfly)

| Funcionalidad (qué hace) | Beneficio (qué le da al usuario) | Resultado empresarial (qué logra el negocio) |
|---|---|---|
| Motor de asientos único + cobranza escalonada automática | Nunca más revisar 3 hojas de cálculo distintas para saber si un cliente pagó | Menos horas administrativas, menos dinero perdido por facturas olvidadas |
| Previsión de Liquidez semanal con datos reales | Saber hoy si vas a tener problema de caja en 3 semanas | Decisiones de compra/gasto con anticipación, no reacción de último momento |
| 16 Análisis Avanzados + glosario contextual | Entender qué significa un número sin llamar a un asesor | Decisiones financieras propias, más rápidas, sin depender de terceros |
| Trazabilidad de lotes + alertas de vencimiento | Saber qué mercancía está por vencer antes de perderla | Menos pérdida de inventario, mejor margen real |

---

## 6. Posicionamiento

- **Alarfly es** un sistema de gestión financiera integral para pymes.
- **Para** dueños y equipos de pymes que ya operan (venden, compran,
  manejan inventario) pero no tienen a alguien dedicado de tiempo
  completo a las finanzas.
- **Que necesita** ver en un solo lugar cuánto dinero tiene, quién le
  debe, a quién le debe, y si el negocio realmente está ganando —
  sin tener que ser experto en contabilidad para entenderlo.
- **A diferencia de** llevar las finanzas en hojas de cálculo sueltas
  o en un sistema contable técnico pensado solo para contadores,
  Alarfly conecta ventas, compras, inventario y contabilidad
  automáticamente, y explica cada término en lenguaje simple.
- **Alarfly permite** tomar decisiones financieras con datos reales y
  actualizados, sin necesitar un contador para interpretarlos.

Todo claim en este posicionamiento tiene una capacidad real
verificable detrás (secciones 1, 4 y 5) — ninguno es aspiracional.

---

## 7. Diferenciadores (solo los demostrables)

| Diferenciador | Evidencia real | Nivel de confianza |
|---|---|---|
| **Simplicidad explicada, no simplicidad superficial** | Glosario contextual + `HelpTooltip` aplicado en TODO el producto (más de 10 módulos), no solo en la pantalla de bienvenida | Alto |
| **Integración real entre módulos** (en el sentido correcto, ver sección 10) | Verificado en F17: una venta genera inventario+factura+CxC+Ledger+auditoría en una sola operación atómica | Alto |
| **Automatización operativa real** (no "IA") | 9+ cron jobs reales (depreciación, revaluación, cobranza escalonada, alertas de vencimiento, reabastecimiento automático), motor de alertas genérico reutilizado en 5+ módulos | Alto |
| **Profundidad financiera para una pyme** (no un sistema "light") | 16 tipos de Análisis Avanzados, FP&A con What-If conectado a liquidez real, consolidación multiempresa segura | Alto — es inusual en software pensado para pymes |
| **Multimoneda con tasa oficial real (BCV)** | `core/fx`, auditado, con VES/USD/EUR | Alto como capacidad; la relevancia de mercado es hipótesis (sección 3) |
| **Producto auditado de punta a punta, no solo "construido"** | F17 — 20 experiencias reales verificadas, integridad financiera comprobada asiento por asiento | Alto — y es un diferenciador poco común de comunicar en software para pymes, casi nadie lo hace explícito |

**Prohibido** (regla explícita de esta etapa y ya heredada de F16):
"el mejor", "el número 1", "revolucionario", cualquier superlativo sin
evidencia comparativa real (no hay estudio de mercado ni benchmark
contra competidores).

---

## 8. Panorama competitivo (categorías, sin ranking)

No se investigó un listado exhaustivo de productos específicos en esta
sesión (fuera del alcance de "auditar el producto propio"); se
describe el panorama de categorías ya conocido del mercado de software
de gestión para pymes, en términos generales y sin copiar lenguaje
de nadie:

- **ERPs/contables tradicionales pensados para contadores**: prometen
  "control total" pero exigen conocimiento técnico — el lenguaje suele
  ser denso, orientado a quien ya sabe de contabilidad. Alarfly se
  diferencia ahí explícitamente con su regla de "lenguaje simple,
  nunca jerga contable en la interfaz".
- **Hojas de cálculo/plantillas**: gratis o casi gratis, pero
  manuales, sin automatización, sin trazabilidad real, sin
  integración entre ventas/inventario/contabilidad — el punto de
  comparación más honesto para un negocio que "todavía no tiene
  nada", no un competidor de software en sí.
- **Apps de facturación simples**: resuelven solo un pedazo (emitir
  facturas), rara vez conectan con inventario/tesorería/análisis
  financiero real — Alarfly es más completo pero también más denso;
  esto es honesto reconocerlo, no ocultarlo.
- **Saturación de mensajes genéricos de "software todo en uno"**: la
  categoría entera satura el lenguaje de "simplifica tu negocio" sin
  mostrar qué hace de verdad — el espacio de posicionamiento
  disponible para Alarfly es **mostrar el producto real** (screenshots,
  flujos reales) en vez de solo prometer, y nombrar explícitamente lo
  que NO promete (sin IA todavía, sin ocultar que el registro es hoy
  por invitación).

No se copian diseños, textos ni claims de ningún competidor específico
— esto es un mapa de categorías, no un análisis competitivo nombrado.

---

## 9. Objetivo de la landing (CTA principal)

### La restricción real que determina esto
No existe registro público ni trial funcional (sección 1). Un CTA del
tipo "Regístrate gratis" o "Empieza tu prueba de 7 días" sería **una
promesa que la landing no puede cumplir hoy** — el visitante haría
clic y no habría a dónde ir.

### Decisión (no automática, justificada)
**CTA principal: "Solicitar acceso" / "Agendar una demo"** — una
acción que SÍ se puede cumplir hoy (puede resolverse con un formulario
simple que llegue a un correo/WhatsApp del equipo, sin necesitar
ninguna infraestructura nueva de producto), honesta sobre el estado
real del embudo comercial (sección 1: "REGISTRO → NO EXISTE").

**CTA secundario: "Ver cómo funciona"** — ancla a la sección de
Producto/Capacidades/Product Shots de la misma landing, sin fricción,
para el visitante que todavía no está listo para dejar sus datos.

Esta decisión está directamente ligada al modelo comercial real
(sección 1) — no es una preferencia de diseño. **Si el usuario
confirma que antes de lanzar la landing se construirá el registro
público + trial** (infraestructura, no parte de esta estrategia), el
CTA principal cambiaría a "Empieza gratis" / "Prueba 7 días gratis" —
marcado como **hipótesis #2 en la sección 29**.

---

## 10. Funnel

```
PRIMERA IMPRESIÓN (segundos)
  → "Esto es un sistema financiero completo para mi pyme, y se ve
     simple, no como un sistema contable técnico."
     ↓
INTERÉS
  → El Hero + un vistazo rápido a 2-3 capacidades reales (no una lista
     de 8 módulos de una vez) lo hacen seguir bajando.
     ↓
COMPRENSIÓN
  → Secciones de Producto/Capacidades con screenshots reales del
     Panel principal, Finanzas, Inventario — "así se ve de verdad, no
     es una maqueta".
     ↓
CONFIANZA
  → Sección de Confianza (seguridad real, auditoría, arquitectura,
     NUNCA testimonios/clientes inventados — sección 17) + lenguaje
     honesto sobre qué SÍ hace hoy.
     ↓
CONSIDERACIÓN
  → Pricing (el plan único ya decidido, $25/mes — sección 18) +
     FAQ que responde las objeciones reales (¿necesito saber
     contabilidad? ¿mis datos están seguros? ¿puedo probarlo?).
     ↓
ACCIÓN
  → CTA "Solicitar acceso" (sección 9) — el único que el sistema
     puede cumplir hoy.
     ↓
ONBOARDING (después del CTA, ya construido, EXISTE)
  → Si eventualmente hay signup público: el mismo
     `setup-status.service.js`/`SetupProgressBar` que YA sirve de
     onboarding dentro del producto hoy (4 pasos verificados contra
     datos reales) — no hace falta construir un onboarding nuevo
     para la landing, ya existe y ya fue probado por F16/F17.
```

---

## 11. Arquitectura de información (estructura propuesta)

Partiendo de la estructura que el propio cuestionario original ya
propuso (Hero/Solución/Finanzas/Control/CTA/Precio/Testimonios,
preservada por F16 con 2 matices ya documentados: sin testimonios
inventados, falta un tramo de Registro), y completándola con lo que
esta etapa pide evaluar:

1. **Navbar** — logo, anclas a secciones (Producto, Capacidades,
   Precio, FAQ), CTA "Solicitar acceso" siempre visible.
2. **Hero** — ver sección 13.
3. **Problema** — las finanzas dispersas / depender de ser experto
   (sección 4), en lenguaje humano, con una imagen conceptual simple
   (no un screenshot todavía, es la sección de "dolor").
4. **Propuesta de valor** — la frase principal + los 4 beneficios
   (sección 5), con íconos simples, no un wall of text.
5. **Producto / Capacidades principales** — 4-6 tarjetas (no las 8
   completas de una vez, abrumaría) con las capacidades más fuertes:
   Ventas+Inventario conectados, Cuentas por Cobrar con cobranza
   automática, Previsión de Liquidez, Reportes/Análisis Avanzados.
6. **Cómo funciona** — 3-4 pasos simples (ej. "1. Registra una venta
   → 2. Se actualiza tu inventario y tu contabilidad solos → 3. Ves
   el impacto real en tu caja al instante").
7. **Product shots (Panel principal + 1-2 módulos)** — sección
   propia, con screenshots reales (sección 16), no mezclada dentro de
   "Capacidades" para que tenga su propio peso visual.
8. **Confianza** — sección 17, sin testimonios inventados.
9. **Pricing** — sección 18, el plan único ya decidido.
10. **FAQ** — sección 21.
11. **CTA final** — repetición del CTA principal, con un mensaje de
    cierre.
12. **Footer** — enlaces legales mínimos, contacto, sin prometer
    integraciones ni redes sociales que no existen.

**Diferencias deliberadas respecto a la estructura original del
cuestionario**: se separa "Producto" de "Product shots" (antes
implícito en "Solución") porque el producto real es suficientemente
rico como para merecer dos momentos distintos: explicar y mostrar. Se
quita "Testimonios" como sección con contenido (ya decidido por F16,
preservado) y se deja la puerta abierta a reemplazarla por
"Confianza" con contenido real de arquitectura/seguridad en su lugar
— exactamente lo que F16 sugirió sin decidir, y esta etapa sí decide
(sección 17).

---

## 12. Hero — propuestas conceptuales

**Regla aplicada**: nada de frases genéricas de SaaS ("La plataforma
todo-en-uno para tu negocio", "Simplifica tu empresa hoy"). El Hero
debe decir qué es, para quién, qué problema resuelve, y qué puede
hacer el visitante — en ese orden de prioridad.

### Opción A — directa al dolor central
- **Headline**: "El dinero de tu negocio, bajo control — sin ser contador."
- **Subheadline**: "Ventas, compras, inventario y finanzas conectados
  en un solo lugar. Cada término técnico, explicado en una frase."
- **CTA principal**: "Solicitar acceso"
- **CTA secundario**: "Ver cómo funciona"
- **Mensaje de apoyo** (debajo del CTA): "Sin necesitar un contador de
  tiempo completo para entenderlo."

### Opción B — directa a la capacidad más fuerte (liquidez)
- **Headline**: "Sabe hoy si vas a tener problema de caja en 3 semanas."
- **Subheadline**: "Alarfly conecta tus ventas, compras e inventario
  para mostrarte tu liquidez real — no solo el saldo de hoy."
- **CTA principal**: "Solicitar acceso"
- **CTA secundario**: "Ver cómo funciona"
- **Mensaje de apoyo**: "Contabilidad, cobranza e inventario, todo en
  un mismo sistema."

### Opción C — directa al perfil de cliente
- **Headline**: "El sistema financiero de tu pyme, pensado para ti — no para tu contador."
- **Subheadline**: "Controla ventas, inventario, cuentas por cobrar y
  caja sin perderte en jerga contable."
- **CTA principal**: "Solicitar acceso"
- **CTA secundario**: "Ver cómo funciona"
- **Mensaje de apoyo**: "Cada campo técnico, explicado en una frase
  simple, justo donde lo necesitas."

**Recomendación**: Opción A como headline principal (resume mejor la
propuesta de valor completa en una sola frase), Opción B como
candidata fuerte para una variante de A/B testing futura (cuando
exista esa infraestructura — hoy NO EXISTE, sección 1) por apoyarse en
la capacidad más diferenciada (Previsión de Liquidez real).

---

## 13. Mensajería (Alarfly Messaging Guide)

### Mensaje principal
"El control financiero de tu negocio, sin tener que ser contador."

### Mensajes secundarios
- "Todo conectado: una venta actualiza tu inventario, tu contabilidad
  y tu flujo de caja, al mismo tiempo."
- "La cobranza se escala sola — nadie se te escapa sin pagar."
- "Entiende tus números sin un diccionario contable al lado."

### Claims permitidos (con capacidad real detrás — cita a la sección correspondiente)
- "Contabilidad, tesorería, ventas, compras e inventario en un solo
  sistema" (sección 1).
- "La cobranza se escala automáticamente" (sección 4).
- "Previsión de liquidez con tus datos reales, semana a semana"
  (sección 5).
- "Cada término técnico explicado en una frase" (sección 1, 5, 7).
- "16 tipos de análisis financiero automatizado" (sección 1).
- "Trabaja en bolívares y dólares, con la tasa oficial" (sección 7 —
  siempre que se confirme la hipótesis de mercado venezolano, sección 3).
- "Producto auditado de punta a punta" / "integridad financiera
  verificada" (sección 19) — **claim nuevo, habilitado por F17**.

### Claims que deben evitarse (prohibidos, heredados de F16 y reconfirmados)
- Cualquier frase que implique **Inteligencia Artificial o aprendizaje
  automático en tiempo presente** ("aprende de la conducta de tu
  empresa", "IA que entiende tu negocio", "predicciones con IA"). F16
  ya marcó esto como 🔴 explícitamente: "F12-C (integración real de IA)
  está explícitamente pospuesta, nunca se construyó. Presentarlo en
  presente sería una promesa falsa." **Se mantiene prohibido en esta
  etapa.**
- "Integración" sin calificar — riesgo de ambigüedad ya detectado por
  F16: si se lee como "se conecta con tu banco/SII", es falso (0
  integraciones externas reales); debe usarse siempre como "todos tus
  módulos financieros conectados entre sí", nunca como "se conecta con
  terceros".
- "Empieza gratis" / "Prueba 7 días gratis" como CTA — no existe
  trial funcional hoy (sección 9).
- Cualquier superlativo sin evidencia ("el mejor", "el número 1",
  "revolucionario") — sección 7.
- Testimonios, nombres de clientes, logos, porcentajes de resultados
  — sin clientes reales todavía (sección 17).

### Terminología recomendada
"Control financiero", "sin ser experto", "todo conectado", "en un
solo lugar", "explicado en lenguaje simple" — coherente con el tono ya
establecido en todo el producto (`CLAUDE.md`: "que sea fácil de
entender > que se vea elegante").

### Terminología que debe evitarse
Jerga contable cruda en cualquier texto de cara al visitante
("partida doble", "asiento contable", "conciliación" sin explicar) —
misma regla que ya rige toda la interfaz del producto, extendida a la
landing por coherencia de marca.

---

## 14. Dirección visual

**Se reutiliza la dirección visual REAL del producto, no se inventa
una nueva** — confirmado contra `frontend/src/styles/theme.css` (ya
verificado también por F16-E10, con la misma conclusión):

- **Fondo base**: `#0b0d10` (grafito casi negro, nunca negro puro).
- **Superficies**: `#14171c` / `#1b1f26` (capas, como pide esta etapa).
- **Bordes**: `#2a2f38` (sutiles, como pide esta etapa).
- **Color de marca**: `#9c2740` (vino/rojo intenso), con variante
  fuerte `#c23253` para estados activos/hover. **Nota de reconciliación**:
  esta etapa describe el color de marca como "rojo intenso" — el token
  real del producto es un vino/borgoña (`#9c2740`), deliberadamente no
  un rojo puro saturado, para no competir visualmente con
  `--color-negative` (óxido/terracota, usado para alertas/errores). La
  landing debe usar exactamente este tono real, aplicado con más
  superficie/protagonismo del que tiene hoy dentro del producto (CTAs
  grandes, acentos de sección), pero sin inventar un rojo más
  saturado que divergiría del sistema de diseño real.
- **Texto**: `#edeff2` (primario) / `#8b93a1` (secundario) — alto
  contraste sobre el fondo oscuro, como pide esta etapa.
- **Tipografía**: Inter (texto general) + Source Serif 4 (títulos y
  cifras importantes) — ya es la combinación real del producto,
  coherente con "premium/financiero/serio".
- **Gradientes negro→rojo**: no existen hoy en el producto (que usa
  color plano por disciplina de diseño), pero son coherentes para
  landing — usar con moderación, exactamente como pide esta etapa, en
  el Hero o en separadores de sección, nunca en superficies de datos.
- **Bordes/sombras**: radios de 4/8/10px, sombras discretas — mismos
  valores que `--radius-sm/md/lg` del producto real.

**Regla heredada explícitamente de F16** (su propio hallazgo, ya
corregido una vez — el riesgo de que "marketing use un sistema visual
distinto al del software real" ya fue identificado y evitado): la
landing usa EXACTAMENTE estos tokens. No se crea un segundo sistema de
diseño para marketing.

**No copiar Tesla ni ningún otro producto** — la inspiración premium
dark-first es un lenguaje compartido por muchos productos modernos,
pero la identidad de Alarfly (vino/borgoña, no rojo Ferrari; Source
Serif 4 en vez de una sans-serif geométrica; el "Sello de Estado" como
elemento de firma ya documentado en el Design System del producto) ya
es propia y debe mantenerse así en la landing.

---

## 15. Product shots

### Qué SÍ debería aparecer (producto real, no inventado)
- **Panel principal** — la pieza más fuerte: KPIs reales (Caja
  disponible, CxC vencidas, CxP próximas, EBITDA), feed de "Requiere
  tu atención" con alertas específicas, gráficos de evolución,
  Previsión de Liquidez. Ya existe una captura reciente y real de
  referencia (`final-dashboard-desktop.png`, generada en la auditoría
  de F17) que confirma que la pantalla real sostiene bien un
  screenshot de marketing — rica en datos, sin elementos rotos.
- **Flujo de Venta Rápida** o **Cuentas por Cobrar** (cobranza
  escalonada) — para sostener el beneficio #3 (sección 5).
- **Previsión de Liquidez** (Tesorería) — para sostener el beneficio #2.
- **Un Análisis Avanzado** (ej. el Tablero Ejecutivo o un gráfico de
  Análisis Avanzados) — para sostener la profundidad financiera
  (sección 7) sin abrumar con las 16 opciones de una vez.

### Qué NO se fabrica
Ninguna interfaz ficticia que aparente ser una funcionalidad
existente (ej. no mostrar una pantalla de "Chat con IA" o un
"Dashboard de referidos" que no existen). Toda captura usada debe
corresponder a una pantalla real, navegable hoy en el producto.

### Pendiente antes de implementación
Las capturas reales deberán tomarse limpias (empresa de demostración
curada, sin datos de prueba con nombres como "Cliente Credito E18" o
"Producto con Lote E20") — **tarea de la etapa de construcción, no de
esta estrategia.**

---

## 16. Confianza

### Elementos reales que SÍ pueden usarse
- **Producto real, no mockup** — el mensaje "esto es software que
  funciona hoy, no una maqueta" es en sí un elemento de confianza,
  sostenido con los product shots reales (sección 15).
- **Seguridad real**: autenticación JWT + 2FA real (TOTP), contraseñas
  con hash seguro (bcrypt), sesiones revocables, permisos reales a
  nivel de API (no solo ocultar botones) — todo EXISTE y fue
  reverificado en vivo en el cierre de F17.
- **Auditoría real**: cada operación sensible queda registrada con
  usuario, fecha y acción — sistema único de auditoría (`core/audit`),
  sin duplicación, verificado en F17.
- **Integridad financiera verificada**: F17 confirmó, con evidencia
  real contra Postgres, que el Ledger nunca queda desbalanceado —
  esto es un claim de confianza legítimo y poco común en marketing de
  software para pymes, que esta etapa habilita por primera vez.
- **Arquitectura multiempresa segura**: aislamiento real por empresa,
  auditado desde F14.

### Lo que NO se inventa (regla explícita de esta etapa)
Clientes, logos de empresas, testimonios, métricas de uso ("+500
empresas confían en Alarfly"), porcentajes de resultados, badges de
certificación que no se tienen. **Ninguno de estos existe hoy** — no
hay clientes pagos, no hay certificación formal, no hay métrica de
adopción (confirmado en F16: ni siquiera existe tracking de uso
comercial). La sección de Confianza se construye enteramente sobre
las 4 piezas reales de arriba, nunca sobre prueba social fabricada.

---

## 17. Pricing

### Decisión ya tomada (F16, preservada sin modificar)
**$25/mes, 7 días de prueba gratis, un solo plan, sin costo adicional.**

### Estado técnico real (reconfirmado, sin cambios desde F16)
No existe ningún mecanismo que pueda cobrar, limitar por plan, o
vencer un trial. El plan es una decisión comercial válida, **no
construida**.

### Cómo debería presentarse en la landing
Dado que el trial real no existe todavía (sección 1/9), presentar el
precio como información clara ("$25/mes, un plan único, sin letra
pequeña") **sin prometer activación automática de un trial que hoy no
puede dispararse solo** — el CTA sigue siendo "Solicitar acceso"
(sección 9), y la persona que lo solicite es quien decide manualmente
activarle el acceso (flujo ya existente: invitación → aceptar
invitación), mientras no exista registro público real.

### Lo que esta etapa NO decide (correcto, según su propio alcance)
El proveedor de pago (Stripe, Paddle, MercadoPago u otro) — pendiente,
decisión del usuario, no de esta estrategia ni de esta sesión.

---

## 18. FAQ (propuesta, basada en objeciones reales)

1. **¿Necesito saber de contabilidad para usarlo?** No — cada término
   técnico tiene una explicación en una frase, justo donde lo
   necesitas.
2. **¿Mis datos están seguros?** Sí — autenticación con verificación
   en dos pasos, permisos por rol, y cada acción sensible queda
   registrada con quién la hizo y cuándo.
3. **¿Puedo probarlo antes de pagar?** Depende del estado real de la
   infraestructura de registro al momento de publicar la landing —
   ver hipótesis #2, sección 29. Responder esto con precisión es una
   decisión pendiente, no se inventa una respuesta aquí.
4. **¿Sirve si tengo inventario / varias sucursales / varias
   empresas?** Sí — multi-almacén, multi-sucursal y multiempresa
   existen y están probados.
5. **¿Trabaja con bolívares?** Sí — con tasa oficial BCV y soporte
   para USD/EUR (sujeto a confirmar si el mercado objetivo real es
   Venezuela — hipótesis #1, sección 29; si no lo es, esta pregunta se
   generaliza a "¿trabaja con varias monedas?").
6. **¿Qué pasa si mi negocio crece / necesito más usuarios?** Los
   roles tienen cupos (Administrador sin límite, Contador hasta 3,
   Financiero hasta 4, Colaborador hasta 8) — suficiente para un
   equipo pyme típico.

---

## 19. SEO

- **Keyword principal (hipótesis, sin investigación de volumen de
  búsqueda real — fuera de alcance de esta auditoría de producto)**:
  "sistema financiero para pymes" / "software de contabilidad para
  pymes sin contador".
- **Keywords secundarias**: "control de inventario y finanzas",
  "cuentas por cobrar y por pagar en un solo sistema", "flujo de caja
  para pyme", y si se confirma el mercado venezolano — "sistema
  financiero en bolívares y dólares".
- **Title**: "Alarfly — El control financiero de tu pyme, sin ser contador"
- **Meta description**: "Ventas, compras, inventario y finanzas
  conectados en un solo sistema. Entiende tus números sin jerga
  contable. Solicita acceso a Alarfly."
- **Estructura H1/H2/H3**: H1 = headline del Hero (sección 12, una
  sola vez); H2 = cada sección principal (Problema, Producto, Cómo
  funciona, Confianza, Precio, FAQ); H3 = cada capacidad/beneficio
  individual dentro de esas secciones.
- **Intención de búsqueda**: transaccional/comercial tardía ("software
  de contabilidad para pyme") más que informacional — coherente con
  un CTA de "Solicitar acceso" en vez de contenido educativo largo.
- **Páginas complementarias futuras (no esta etapa)**: una página de
  Precio dedicada (si el pricing se vuelve más complejo que un plan
  único), páginas por caso de uso (ej. "Alarfly para negocios con
  inventario"), un blog si se decide invertir en SEO de contenido —
  ninguna se construye en esta fase.

No se sacrificó claridad comercial por SEO en ningún punto de esta
sección — el H1/Title siguen siendo el mensaje de valor real, no una
keyword forzada.

---

## 20. Responsive

La landing debe funcionar genuinamente desde mobile hasta pantallas
grandes — con una advertencia explícita heredada del hallazgo más
serio de todo F16: **la aplicación completa fue, en algún momento,
inutilizable en un teléfono real a 390px** (desborde horizontal en
todo el Panel principal), ya corregido y validado en 5 anchos
(1440/1280/1024/768/390) y reverificado sin regresión en los 4
bloques de F17. La landing nueva **debe pasar la misma prueba desde el
primer momento** (medición programática `scrollWidth === clientWidth`
en 390px, no solo "verse bien" a ojo), no heredar el mismo riesgo que
ya le costó una corrección CRITICAL al producto.

Mobile no debe ser una versión reducida sin criterio: el Hero, los
product shots (recortados o con scroll horizontal controlado, nunca
cortados a la mitad) y el CTA deben mantener su jerarquía completa en
390px, igual que ya exige el propio sistema de diseño del producto.

---

## 21. Conversión

- **CTA principal**: "Solicitar acceso" (sección 9) — en el Hero, tras
  la sección de Producto, y en el CTA final.
- **CTA secundario**: "Ver cómo funciona" — en el Hero, ancla interna.
- **Ubicación de CTAs**: Hero (ambos), después de Capacidades
  principales (solo el principal), CTA final dedicado.
- **Sticky CTA**: recomendado en mobile (donde el visitante puede
  tardar en llegar al CTA final por el scroll largo) — un botón fijo
  "Solicitar acceso" en la parte inferior, consistente con patrones ya
  usados en el producto (botón flotante de creación rápida, mismo
  criterio de "acción principal siempre alcanzable").
- **Fricciones esperadas**: sin registro público real, el formulario
  de "Solicitar acceso" debe ser mínimo (nombre, correo, nombre de la
  empresa) — no replicar la fricción que F16 ya identificó como
  riesgo si se exige de entrada RIF/dirección/moneda (esos datos ya
  tienen su propia pantalla post-onboarding, `ProfileSection`).
- **Objeciones principales**: "¿necesito saber de contabilidad?",
  "¿es seguro?", "¿puedo probarlo?" — cubiertas en el FAQ (sección 18).
- **Microcopy del CTA**: "Solicitar acceso" (nunca "Regístrate
  gratis", por la razón ya explicada en sección 9) + un texto de apoyo
  corto debajo ("Te contactamos para activar tu cuenta") — honesto
  sobre que hoy el acceso se activa manualmente, no automáticamente.

---

## 22. Casos de uso

Construidos sobre los problemas centrales (sección 4), sin inventar
industrias específicas sin evidencia:

- **Pyme con inventario** (retail, distribución, cualquier negocio que
  compra y vende mercancía física): control de stock, costeo real,
  trazabilidad de lotes/vencimiento, reabastecimiento automático.
- **Pyme de servicios con cuentas por cobrar recurrentes**: cobranza
  escalonada automática, facturación recurrente (ya existe detección
  de patrones de recurrencia en AR), previsión de liquidez.
- **Pyme que ya usa hojas de cálculo y quiere dar el salto**: el caso
  de uso más transversal — el mensaje central de "todo conectado, sin
  doble trabajo" aplica a cualquier pyme que hoy reconcilia manualmente
  entre archivos sueltos.

No se inventan casos de uso por sector específico (ej. "para
restaurantes", "para clínicas") sin evidencia de que el producto tiene
algo especializado para esos sectores — el producto es horizontal
(cualquier pyme con ventas/compras/inventario), no vertical.

---

## 23. Riesgos

1. **CTA "Solicitar acceso" puede convertir peor que un CTA de
   self-service** ("Empieza gratis") — riesgo de negocio real, pero la
   alternativa (prometer un trial que no existe) es peor: generaría
   visitantes frustrados y dañaría la confianza desde el primer
   contacto. Mitigación: construir el registro público real cuanto
   antes (fuera de esta estrategia) para poder cambiar el CTA.
2. **Hipótesis de mercado venezolano sin confirmar** (sección 3) —
   si se construye mensajería asumiendo Venezuela y el mercado real es
   otro (o es más amplio, LatAm en general), el copy final necesitaría
   ajustarse. Mitigación: confirmar con el usuario antes de escribir
   copy final (hipótesis #1, sección 29).
3. **Producto muy amplio, riesgo de abrumar en la landing** — Alarfly
   tiene 8+ módulos reales; mostrar los 8 de una vez en el Hero/
   primera pantalla diluye el mensaje. Mitigación: ya aplicada en la
   estructura (sección 11) — mostrar 4-6 capacidades fuertes, no las 8.
4. **Sin prueba social real** — una landing sin testimonios/logos
   puede sentirse "nueva"/sin validar frente a competidores que sí
   muestran clientes. Mitigación: compensar con el claim nuevo y
   legítimo de "producto auditado de punta a punta" (sección 16/19),
   que es diferenciador precisamente porque casi nadie en esta
   categoría lo comunica.
5. **Riesgo ya corregido, no repetirlo**: el desborde horizontal a
   390px que hizo inutilizable el producto real en un momento de F16
   — la landing nueva debe validarse con la misma disciplina desde el
   día uno (sección 20), no como una corrección posterior.

---

## 24. Hipótesis que deben validarse (antes de escribir copy final)

1. **¿El mercado objetivo real es Venezuela (por el soporte nativo de
   BCV/VES), o es más amplio (LatAm con cualquier par de monedas)?**
   Esto cambia mensajería, ejemplos de moneda en el Hero/FAQ, y
   posiblemente el keyword SEO principal. **Alta prioridad.**
2. **¿Se construirá registro público + trial real antes de publicar la
   landing, o la landing se publica primero con "Solicitar acceso"
   como CTA realista?** Determina si el CTA principal de esta
   estrategia (sección 9) se mantiene o cambia a un flujo self-service.
   **Alta prioridad — bloquea la decisión de CTA final.**
3. **¿Cuál es el presupuesto/capacidad real de pago de las pymes
   objetivo?** El precio de $25/mes ya está decidido (F16), pero nunca
   se validó contra clientes reales — no bloquea la landing (el precio
   ya está decidido), pero sí es relevante para cualquier ajuste
   futuro de pricing.
4. **¿Existen ya conversaciones con clientes potenciales reales** (aunque
   sea informales) **que puedan convertirse en los primeros
   testimonios/casos de uso reales** una vez que acepten ser
   nombrados? Esto no bloquea el lanzamiento (sección 16 ya resuelve
   "sin testimonios por ahora"), pero es valioso saber si hay
   candidatos cercanos.
5. **¿El nombre "Alarfly" necesita alguna explicación/pronunciación en
   el Hero, o es autoexplicativo?** Menor, pero afecta el microcopy
   del logo/navbar.

Ninguna de estas hipótesis bloquea la redacción de ESTA estrategia —
se marcan explícitamente y se continúa, tal como pide esta etapa.

---

## 25. Recomendación final de arquitectura

1. **Construir la landing ahora, con el producto real como
   protagonista** — el producto está más que listo para sostenerla
   (F17 lo confirma con evidencia, no solo intención).
2. **CTA principal: "Solicitar acceso"**, no "Empieza gratis" — hasta
   que exista registro público real (hipótesis #2). Esta es la pieza
   de arquitectura más importante de toda la estrategia: determina qué
   infraestructura hace falta construir en paralelo o antes.
3. **Estructura**: Navbar → Hero → Problema → Propuesta de valor →
   Producto/Capacidades → Cómo funciona → Product shots → Confianza →
   Pricing → FAQ → CTA final → Footer (sección 11).
4. **Headline recomendado**: Opción A de la sección 12 ("El dinero de
   tu negocio, bajo control — sin ser contador").
5. **Dirección visual**: exactamente los tokens reales del producto
   (sección 14), sin un segundo sistema de diseño.
6. **Confianza sin prueba social fabricada**: apoyarse en el claim
   nuevo y legítimo de "producto auditado de punta a punta" (habilitado
   recién por F17) en vez de testimonios inventados.
7. **Antes de escribir copy final**: resolver las hipótesis #1 y #2 de
   la sección 24 con el usuario — ambas cambian decisiones concretas
   de esta estrategia (mercado objetivo, CTA).
8. **Responsive desde el primer commit de la landing**, con la misma
   disciplina de medición que ya existe en el producto (sección 20) —
   no repetir el único hallazgo CRITICAL de toda la historia comercial
   del proyecto.

---

## Resumen de archivos de referencia (no reemplazados, preservados)

- `F16_COMMERCIAL_FOUNDATION_AUDIT.md` — cuestionario original
  (resumen), posicionamiento inicial, pricing decidido.
- `F16_COMMERCIAL_FUNNEL_AUDIT.md` — embudo real vs. ideal.
- `F16_ACTIVATION_CONVERSION_AUDIT.md` — onboarding, activación,
  paleta real confirmada, hallazgo CRITICAL de 390px.
- `F16_GROWTH_AUDIT.md` — métricas, referidos, afiliados (arquitectura
  conceptual, no implementada).
- `F16_COMMERCIAL_CLOSURE.md` — cierre de F16, estado final del
  sistema comercial.
- `F17_PRODUCT_READINESS_FINAL.md` — auditoría de producto más
  reciente y más rigurosa, fuente del nuevo claim de confianza
  "producto auditado de punta a punta" (sección 16/19).
- `frontend/src/styles/theme.css` — fuente real de la dirección visual
  (sección 14).
- `CLAUDE.md` — bitácora completa del producto, fuente de la mayoría
  de capacidades citadas en la sección 1.
