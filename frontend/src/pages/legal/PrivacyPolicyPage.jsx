import { Link } from 'react-router-dom';
import Seo from '../../core/ui/Seo';
import LegalLayout from './LegalLayout';

// Cierre Web/SEO: cada práctica descrita acá fue verificada contra el
// código real antes de escribirse (ver WEB_SEO_PERFORMANCE_FINAL.md,
// sección "Auditoría previa a los legales") — nunca se inventó un
// proveedor, una cookie, un plazo de retención o una certificación.
// Donde el proyecto todavía no tiene un dato real (ej. el correo de
// contacto para solicitudes de privacidad), se deja marcado
// explícitamente para que el propietario lo complete, en vez de
// inventarlo.
export default function PrivacyPolicyPage() {
  return (
    <LegalLayout title="Política de Privacidad — Alarfly" updatedAt="3 de octubre de 2026">
      <Seo
        title="Política de Privacidad"
        description="Cómo Alarfly recopila, usa y protege los datos de tu cuenta y tu empresa."
        path="/privacidad"
      />

      <p>
        Esta política explica, en lenguaje simple, qué datos recopila Alarfly, para qué los usa, y qué puedes hacer
        para acceder a ellos, corregirlos o pedir que se eliminen. Describe únicamente prácticas que existen de
        verdad en el producto hoy — si algo cambia, esta página se actualiza.
      </p>

      <h2>1. Qué datos recopilamos</h2>
      <p>Según cómo uses Alarfly, podemos recopilar:</p>
      <ul>
        <li>
          <strong>Datos de tu cuenta</strong>: nombre, correo electrónico, teléfono (opcional), contraseña (guardada
          siempre cifrada, nunca en texto plano) y, si activas la verificación en dos pasos, el secreto necesario
          para generarla (guardado cifrado, no en texto plano).
        </li>
        <li>
          <strong>Datos de tu empresa</strong>: nombre de la empresa, RIF/identificación fiscal y demás datos del
          perfil de empresa que tú mismo ingreses.
        </li>
        <li>
          <strong>Datos operativos y financieros que tú introduces</strong>: tus ventas, compras, inventario,
          clientes, proveedores, asientos contables y cualquier otro dato que registres al usar el producto. Estos
          datos pertenecen a tu empresa y quedan aislados de cualquier otra empresa que use Alarfly — ninguna otra
          cuenta puede verlos.
        </li>
        <li>
          <strong>Datos de sesión y seguridad</strong>: cuándo inicias sesión, desde qué dispositivo (según lo
          reporte tu navegador) y un registro de auditoría de las acciones sensibles que realizas (quién hizo qué y
          cuándo), para que tú mismo puedas revisar tu propia actividad.
        </li>
        <li>
          <strong>Si nos escribes por el formulario de contacto</strong>: tu nombre, correo, el asunto y el mensaje
          que escribas, y la dirección IP desde la que se envió (solo para evitar envíos automatizados repetidos,
          nunca se muestra a nadie).
        </li>
        <li>
          <strong>Si te unes al programa de afiliados</strong>: nombre, correo, teléfono (opcional) y el registro de
          qué empresas se registraron con tu enlace, para calcular tus comisiones.
        </li>
      </ul>

      <h2>2. Qué NO usamos</h2>
      <p>
        Alarfly no usa cookies de seguimiento ni de publicidad. Usa únicamente{' '}
        <code>localStorage</code> del navegador (una capacidad estándar del navegador, distinta de una cookie) para
        mantener tu sesión iniciada y recordar tus preferencias de visualización (tema, moneda) en ese mismo
        dispositivo — nada de eso se comparte con terceros ni se usa para rastrearte fuera de Alarfly. Tampoco
        integramos herramientas de analítica de terceros (como Google Analytics) ni píxeles de publicidad.
      </p>

      <h2>3. Para qué usamos tus datos</h2>
      <ul>
        <li>Para operar tu cuenta y las funciones del producto que usas (ventas, contabilidad, inventario, etc.).</li>
        <li>Para mantener tu sesión segura y permitirte cerrar sesiones activas en otros dispositivos.</li>
        <li>Para calcular y pagar comisiones, si participas en el programa de afiliados.</li>
        <li>Para responder los mensajes que nos envíes por el formulario de contacto.</li>
      </ul>
      <p>No usamos tus datos para entrenar modelos de inteligencia artificial — Alarfly no integra IA hoy (ver nuestros Términos y Condiciones, sección de Inteligencia Artificial).</p>

      <h2>4. Con quién compartimos tus datos</h2>
      <p>
        Hoy, Alarfly no integra ningún proveedor externo de analítica, publicidad, pasarela de pago ni inteligencia
        artificial que reciba tus datos. Tus datos se guardan en nuestra base de datos y no se transfieren a
        terceros ni a otro país con fines distintos a operar el servicio que contrataste. Si en el futuro
        incorporamos un proveedor externo que procese datos en tu nombre, esta política se actualizará para
        nombrarlo explícitamente antes de que eso ocurra.
      </p>

      <h2>5. Seguridad</h2>
      <ul>
        <li>Las contraseñas se guardan cifradas (nunca en texto plano).</li>
        <li>Puedes activar verificación en dos pasos; el secreto correspondiente se guarda cifrado.</li>
        <li>Cada sesión iniciada queda registrada y puedes cerrarla de forma remota desde Mi Cuenta.</li>
        <li>El acceso a cada módulo se controla por rol, y las acciones sensibles quedan auditadas.</li>
        <li>Los datos de cada empresa están aislados de los de cualquier otra empresa en la plataforma.</li>
      </ul>

      <h2>6. Cuánto tiempo guardamos tus datos</h2>
      <p>
        Guardamos tus datos mientras tu cuenta esté activa. Si solicitas la baja de tu cuenta (disponible desde Mi
        Cuenta &gt; Zona de riesgo), tu solicitud será revisada por el Administrador de tu empresa antes de
        desactivarse — la baja nunca borra tu historial financiero de inmediato, ya que tu empresa puede necesitarlo
        para sus propias obligaciones contables y fiscales. No tenemos definido hoy un plazo automático de borrado
        físico de datos tras una baja; si lo definimos, esta política se actualizará con el plazo exacto.
      </p>

      <h2>7. Tus derechos</h2>
      <p>Desde tu cuenta puedes, en cualquier momento:</p>
      <ul>
        <li>Ver y editar tus datos personales (Mi Cuenta &gt; Perfil).</li>
        <li>Ver exactamente qué permisos y qué rol tienes (Mi Cuenta &gt; Rol y permisos).</li>
        <li>Revisar tu propio historial de actividad y exportarlo en JSON o CSV (Mi Cuenta &gt; Actividad).</li>
        <li>Cerrar cualquier sesión activa en otro dispositivo (Mi Cuenta &gt; Seguridad).</li>
        <li>Solicitar la baja de tu cuenta (Mi Cuenta &gt; Zona de riesgo).</li>
      </ul>
      <p>
        Para cualquier otra solicitud relacionada con tus datos (por ejemplo, pedir una copia completa o una
        corrección que no puedas hacer tú mismo desde la aplicación), puedes escribirnos desde nuestro{' '}
        <Link to="/contacto">formulario de contacto</Link>.
      </p>

      <div className="legal-pending">
        <p>
          <strong>Pendiente de confirmación del propietario de Alarfly:</strong> esta página todavía no incluye un
          correo electrónico dedicado para solicitudes de privacidad (acceso, rectificación, eliminación), ni la
          identidad legal completa del operador del servicio (razón social, domicilio). Se recomienda completar
          estos datos antes de la publicación final — ver también la sección de Ley Aplicable y Resolución de
          Disputas en los Términos y Condiciones.
        </p>
      </div>

      <h2>8. Menores de edad</h2>
      <p>Alarfly está dirigido a empresas y profesionales, no a menores de edad. No solicitamos intencionalmente datos de menores.</p>

      <h2>9. Cambios a esta política</h2>
      <p>
        Si actualizamos esta política de forma relevante, lo indicaremos cambiando la fecha de "Última
        actualización" al inicio de esta página.
      </p>
    </LegalLayout>
  );
}
