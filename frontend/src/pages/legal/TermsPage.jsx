import { Link } from 'react-router-dom';
import Seo from '../../core/ui/Seo';
import LegalLayout from './LegalLayout';

// Cierre Web/SEO: estructura completa pedida, pero cada afirmación
// sobre qué hace/no hace Alarfly se verificó contra el código real
// antes de escribirse (roles y cupos reales de core/rbac, ausencia
// real de pasarela de pago/facturación automatizada, ausencia real de
// IA — ver AI_ARCHITECTURE.md, ausencia real de un dato de
// jurisdicción/entidad legal definida). Donde falta un dato legal que
// el proyecto no tiene, se deja marcado como pendiente en vez de
// inventarlo (ver sección 14 y WEB_SEO_PERFORMANCE_FINAL.md).
export default function TermsPage() {
  return (
    <LegalLayout title="Términos y Condiciones — Alarfly" updatedAt="3 de octubre de 2026">
      <Seo
        title="Términos y Condiciones"
        description="Las reglas de uso de Alarfly: cuentas, empresas, pagos, propiedad de tus datos e inteligencia artificial."
        path="/terminos"
      />

      <p>
        Estos Términos y Condiciones regulan el uso de Alarfly, una plataforma de gestión financiera para pymes
        (ventas, compras, inventario, contabilidad, tesorería y reportes financieros, entre otros módulos). Al crear
        una cuenta o usar el producto, aceptas estos términos.
      </p>

      <nav className="legal-toc" aria-label="Contenido de esta página">
        <h2>Contenido</h2>
        <ol>
          <li>Aceptación de los términos</li>
          <li>Descripción del servicio</li>
          <li>Cuentas, usuarios y empresas</li>
          <li>Responsabilidades del usuario</li>
          <li>Uso permitido</li>
          <li>Propiedad intelectual y propiedad de tus datos</li>
          <li>Disponibilidad del servicio</li>
          <li>Suspensión y cancelación</li>
          <li>Prueba gratuita, precio y pagos</li>
          <li>Limitación de responsabilidad</li>
          <li>Datos y privacidad</li>
          <li>Inteligencia artificial</li>
          <li>Modificaciones del servicio y de estos términos</li>
          <li>Terminación</li>
          <li>Resolución de disputas y arbitraje</li>
          <li>Ley aplicable</li>
        </ol>
      </nav>

      <h2>1. Aceptación de los términos</h2>
      <p>
        Al registrarte, iniciar sesión o usar Alarfly de cualquier forma, aceptas estos Términos y nuestra{' '}
        <Link to="/privacidad">Política de Privacidad</Link>. Si no estás de acuerdo, no debes usar el servicio.
      </p>

      <h2>2. Descripción del servicio</h2>
      <p>
        Alarfly es un sistema de gestión financiera y operativa para empresas: registro de ventas y compras,
        control de inventario, contabilidad con partida doble, tesorería, cuentas por cobrar y por pagar, reportes
        financieros y un programa de afiliados independiente. Alarfly es una herramienta de software — no presta
        servicios de asesoría contable, fiscal, legal ni financiera profesional, y no reemplaza el criterio de un
        contador, abogado o asesor financiero calificado.
      </p>

      <h2>3. Cuentas, usuarios y empresas</h2>
      <p>
        Cada cuenta de usuario pertenece a una empresa dentro de Alarfly. Los datos de una empresa están aislados de
        los de cualquier otra empresa en la plataforma — un usuario de una empresa nunca puede ver los datos de
        otra. Dentro de cada empresa existen 4 roles con distintos permisos y, para los roles distintos de
        Administrador, un cupo máximo de usuarios activos por empresa (Administrador: sin límite; Contador: hasta 3;
        Financiero: hasta 4; Colaborador: hasta 8). Eres responsable de mantener la confidencialidad de tu
        contraseña y de toda actividad que ocurra bajo tu cuenta.
      </p>

      <h2>4. Responsabilidades del usuario</h2>
      <ul>
        <li>Proporcionar información veraz al registrar tu empresa y tus datos de contacto.</li>
        <li>Ingresar tus datos financieros y operativos de forma correcta — Alarfly calcula y organiza lo que tú registras, pero no puede verificar que un monto o una fecha que ingreses sean correctos.</li>
        <li>Cumplir, por tu cuenta, con tus propias obligaciones fiscales y legales — Alarfly te ayuda a organizar esa información, pero la responsabilidad de presentar y pagar tus obligaciones ante cualquier autoridad es tuya.</li>
        <li>No usar el servicio para actividades ilegales ni para vulnerar la seguridad o el aislamiento de datos de otras empresas.</li>
      </ul>

      <h2>5. Uso permitido</h2>
      <p>
        Puedes usar Alarfly para la gestión legítima de tu negocio. No está permitido: intentar acceder a datos de
        otra empresa sin autorización, intentar vulnerar los mecanismos de autenticación o permisos, realizar
        ingeniería inversa del producto, ni usar el servicio para fines fraudulentos.
      </p>

      <h2>6. Propiedad intelectual y propiedad de tus datos</h2>
      <p>
        Alarfly, su marca, su diseño y su código son propiedad del operador del servicio. Tú conservas la propiedad
        de todos los datos que ingreses a tu cuenta (tus ventas, tu contabilidad, tus clientes, etc.) — Alarfly
        únicamente los procesa y los organiza para que tú los uses.
      </p>

      <h2>7. Disponibilidad del servicio</h2>
      <p>
        Procuramos que Alarfly esté disponible de forma continua, pero no garantizamos un porcentaje específico de
        disponibilidad ni un servicio ininterrumpido — pueden existir mantenimientos programados, interrupciones no
        planificadas, o afectaciones fuera de nuestro control.
      </p>

      <h2>8. Suspensión y cancelación</h2>
      <p>
        El Administrador de tu empresa puede activar o desactivar usuarios dentro de su propia cuenta en cualquier
        momento. Cualquier usuario puede solicitar la baja de su propia cuenta desde Mi Cuenta — esa solicitud la
        revisa el Administrador de la empresa antes de aplicarse. Podemos suspender una cuenta que incumpla
        gravemente estos Términos, notificándolo cuando sea razonablemente posible.
      </p>

      <h2>9. Prueba gratuita, precio y pagos</h2>
      <p>
        Toda empresa nueva recibe 7 días de prueba gratuita desde su registro, sin necesidad de tarjeta de pago.
        Alarfly muestra públicamente un precio de referencia por el uso continuado del servicio más allá del período
        de prueba. <strong>Hoy, la plataforma no procesa cobros ni suscripciones de forma automatizada</strong> — la
        continuidad del servicio después de la prueba, y cualquier arreglo de pago correspondiente, se coordina
        directamente con el operador de Alarfly por los canales de contacto indicados en esta página. Si en el
        futuro se habilita un cobro automatizado dentro de la plataforma, esta sección se actualizará para describir
        exactamente cómo funciona.
      </p>

      <h2>10. Limitación de responsabilidad</h2>
      <p>
        Alarfly se ofrece "tal cual". En la máxima medida permitida por la ley aplicable, el operador no será
        responsable por daños indirectos, pérdida de beneficios o pérdida de datos derivados del uso del servicio,
        salvo en los casos en que la ley no permita limitar esa responsabilidad.
      </p>

      <h2>11. Datos y privacidad</h2>
      <p>
        El tratamiento de tus datos personales y los de tu empresa se describe en nuestra{' '}
        <Link to="/privacidad">Política de Privacidad</Link>, que forma parte de estos Términos.
      </p>

      <h2>12. Inteligencia artificial</h2>
      <p>
        <strong>Alarfly no utiliza inteligencia artificial ni modelos de lenguaje para generar resultados,
        cálculos ni recomendaciones dentro del producto hoy.</strong> Todos los cálculos financieros, contables y de
        inventario del sistema (partida doble, costeo, impuestos, proyecciones, etc.) se ejecutan con reglas y
        fórmulas determinísticas definidas en el código — no con IA generativa. La función de "Ayuda contextual" del
        producto tampoco usa IA: responde con artículos predefinidos encontrados por coincidencia de palabras clave,
        nunca con texto generado.
      </p>
      <p>
        Si en el futuro Alarfly incorpora alguna funcionalidad basada en inteligencia artificial, esta sección se
        actualizará antes de activarla para explicar, como mínimo: qué función específica usa IA; que sus
        respuestas pueden contener errores y deben verificarse antes de tomar decisiones importantes; que esa
        función actúa como apoyo y nunca constituye, por sí sola, asesoramiento financiero, contable, fiscal,
        jurídico o de inversión; que la responsabilidad de las decisiones tomadas con ayuda de esa función sigue
        siendo tuya; qué datos procesaría esa función y cómo; y qué proveedor externo de IA, si lo hubiera, estaría
        involucrado (nombrándolo explícitamente, nunca en términos genéricos). No afirmamos, porque no está
        confirmado, si un eventual proveedor usaría o no tus datos para entrenar sus propios modelos — ese dato se
        incluirá cuando corresponda, con la confirmación técnica correspondiente.
      </p>

      <h2>13. Modificaciones del servicio y de estos términos</h2>
      <p>
        Podemos mejorar, modificar o descontinuar funciones de Alarfly con el tiempo. Si modificamos estos Términos
        de forma relevante, actualizaremos la fecha de "Última actualización" al inicio de esta página.
      </p>

      <h2>14. Terminación</h2>
      <p>
        Puedes dejar de usar Alarfly en cualquier momento solicitando la baja de tu cuenta. Podemos terminar o
        suspender el acceso de una cuenta que incumpla gravemente estos Términos.
      </p>

      <h2>15. Resolución de disputas y arbitraje</h2>
      <div className="legal-pending">
        <p>
          <strong>Pendiente de confirmación del propietario de Alarfly — no se completa con datos inventados:</strong>
        </p>
        <p>
          Esta sección debe incluir una cláusula real de resolución de disputas (negociación previa, sometimiento a
          arbitraje, sede, institución o reglas aplicables, idioma, número de árbitros, carácter vinculante, y
          cuándo proceden medidas cautelares o acciones colectivas). No se puede redactar esa cláusula hoy porque el
          proyecto no tiene definida ninguna entidad legal operadora, país de constitución, domicilio ni mecanismo
          de resolución de disputas confirmado — inventar esos datos crearía una cláusula legal inválida o
          engañosa.
        </p>
        <p>Para completar esta sección, el propietario de Alarfly debe confirmar:</p>
        <ul>
          <li>Nombre legal y forma societaria de la entidad que opera Alarfly (ej. razón social, tipo de sociedad).</li>
          <li>País y, si aplica, estado/provincia de constitución y domicilio legal.</li>
          <li>Si las disputas se resolverán por arbitraje, ante qué institución y bajo qué reglamento (ej. una cámara de arbitraje específica).</li>
          <li>Sede/ciudad del arbitraje e idioma del procedimiento.</li>
          <li>Si el arbitraje será con árbitro único o un panel, y cómo se designa.</li>
        </ul>
        <p>
          Una vez confirmados estos datos, esta sección se completará con la cláusula real — nunca se excluirán
          derechos que la ley aplicable no permita excluir (ej. derechos del consumidor que sean irrenunciables).
        </p>
      </div>

      <h2>16. Ley aplicable</h2>
      <div className="legal-pending">
        <p>
          <strong>Pendiente de confirmación del propietario de Alarfly, mismo motivo que la sección anterior:</strong>{' '}
          la ley aplicable a estos Términos depende de la jurisdicción de la entidad operadora, que todavía no está
          definida en el proyecto. Se completará junto con la sección 15.
        </p>
      </div>
    </LegalLayout>
  );
}
