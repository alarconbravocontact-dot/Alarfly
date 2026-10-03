import { useCallback, useEffect, useState } from 'react';
import { affiliateSelfApi } from '../../api/affiliates';
import { AffiliateApiError } from '../../api/affiliateAuth';
import { useToast } from '../../context/ToastContext';
import StatCard from '../../components/StatCard';
import StatusSeal from '../../core/ui/StatusSeal';
import EmptyState from '../../core/ui/EmptyState';
import Icon from '../../core/ui/Icon';
import { formatCurrency, formatDate } from '../../utils/format';
import './AffiliateDashboardPage.css';
import { COMMISSION_STATUS_LABELS, COMMISSION_STATUS_TONE } from './affiliateStatusLabels';

// Tablero del propio afiliado (sección 5/6 del pedido): enlace de
// referido con copiar/compartir, totales de comisiones por estado,
// referidos reales y su historial de comisiones — todo leído de los
// mismos endpoints reales, nunca un número inventado.
//
// Bug real encontrado con Playwright durante la verificación de esta
// pieza: el backend intentaba armar la URL completa del enlace a
// partir del header `Origin` de la petición, pero detrás del proxy de
// desarrollo de Vite ese header no llega intacto — el enlace generado
// apuntaba al propio backend (puerto 3000) en vez del frontend (5173),
// rompiendo el flujo completo de principio a fin. Se corrigió
// devolviendo del backend SOLO el código (`GET /affiliates/me/link` →
// `{code}`) y armando la URL completa acá, con `window.location.origin`
// — el único origen que el navegador conoce con certeza siempre.
function buildReferralUrl(code) {
  if (!code) return '';
  return `${window.location.origin}/registro?ref=${code}`;
}

export default function AffiliateDashboardPage() {
  const { showToast } = useToast();
  const [link, setLink] = useState(null);
  const [summary, setSummary] = useState(null);
  const [referrals, setReferrals] = useState([]);
  const [commissions, setCommissions] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState('');

  const load = useCallback(async () => {
    setIsLoading(true);
    setLoadError('');
    try {
      const [linkData, summaryData, referralsData, commissionsData] = await Promise.all([
        affiliateSelfApi.getLink(),
        affiliateSelfApi.getSummary(),
        affiliateSelfApi.listReferrals(),
        affiliateSelfApi.listCommissions(),
      ]);
      setLink(linkData);
      setSummary(summaryData);
      setReferrals(referralsData);
      setCommissions(commissionsData);
    } catch (err) {
      setLoadError(err instanceof AffiliateApiError ? err.message : 'No se pudo cargar tu tablero de afiliado.');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  async function copyLink() {
    if (!link) return;
    try {
      await navigator.clipboard.writeText(buildReferralUrl(link.code));
      showToast({ message: 'Enlace copiado al portapapeles.' });
    } catch {
      window.prompt('Copia tu enlace:', buildReferralUrl(link.code));
    }
  }

  async function shareLink() {
    if (!link) return;
    // Mejora progresiva (punto 6 del pedido): si el navegador soporta
    // Web Share API, se usa; si no, siempre queda la alternativa de
    // copiar (el botón de arriba), nunca es el único camino.
    if (navigator.share) {
      try {
        await navigator.share({ title: 'Alarfly', text: 'Controla las finanzas de tu negocio con Alarfly', url: buildReferralUrl(link.code) });
      } catch {
        // el usuario canceló el share nativo — no es un error que mostrar
      }
    } else {
      copyLink();
    }
  }

  if (isLoading) {
    return <p className="page-subtitle">Cargando tu tablero…</p>;
  }

  if (loadError) {
    return (
      <p className="login-error" role="alert">
        {loadError}
      </p>
    );
  }

  return (
    <div className="page">
      <div className="page-header">
        <h1>Tu enlace de afiliado</h1>
        <p className="page-subtitle">Compártelo — cada empresa que se registre con él queda atribuida a ti.</p>
      </div>

      <div className="affiliate-link-card">
        <code className="affiliate-link-text">{buildReferralUrl(link?.code)}</code>
        <div className="btn-row">
          <button type="button" className="btn btn-primary btn-small" onClick={copyLink}>
            <Icon name="copy" size={16} /> Copiar enlace
          </button>
          <button type="button" className="btn btn-ghost btn-small" onClick={shareLink}>
            <Icon name="share" size={16} /> Compartir
          </button>
        </div>
        <p className="affiliate-link-code">Tu código: {link?.code}</p>
      </div>

      <div className="stat-card-grid">
        <StatCard label="Referidos" value={summary?.referralsCount ?? 0} />
        <StatCard label="Conversiones" value={summary?.conversionsCount ?? 0} />
        <StatCard
          label="Comisiones pendientes"
          value={formatCurrency(summary?.commissionTotals?.PENDING ?? 0, summary?.currency)}
          tone="neutral"
        />
        <StatCard
          label="Ganado en total"
          value={formatCurrency(summary?.lifetimeEarned ?? 0, summary?.currency)}
          tone="positive"
          hint="Suma de todo lo no cancelado, pagado o no"
        />
      </div>

      <h2 className="affiliate-section-title">Tus referidos</h2>
      {referrals.length === 0 ? (
        <EmptyState icon="◷" message="Todavía no tienes ningún referido. Comparte tu enlace para empezar." />
      ) : (
        <table className="data-table">
          <thead>
            <tr>
              <th>Empresa</th>
              <th>Fecha</th>
              <th>Comisiones</th>
            </tr>
          </thead>
          <tbody>
            {referrals.map((r) => (
              <tr key={r.id}>
                <td>{r.referredCompany?.name}</td>
                <td>{formatDate(new Date(r.attributedAt))}</td>
                <td>
                  {r.commissions.map((c) => (
                    <StatusSeal key={c.id} tone={COMMISSION_STATUS_TONE[c.status]} label={COMMISSION_STATUS_LABELS[c.status]} />
                  ))}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      <h2 className="affiliate-section-title">Historial de comisiones</h2>
      {commissions.length === 0 ? (
        <EmptyState icon="○" message="Todavía no tienes comisiones generadas." />
      ) : (
        <table className="data-table">
          <thead>
            <tr>
              <th>Fecha</th>
              <th>Empresa referida</th>
              <th className="num">Monto</th>
              <th>Estado</th>
            </tr>
          </thead>
          <tbody>
            {commissions.map((c) => (
              <tr key={c.id}>
                <td>{formatDate(new Date(c.createdAt))}</td>
                <td>{c.referral?.referredCompany?.name}</td>
                <td className="num">{formatCurrency(c.amount, c.currency)}</td>
                <td>
                  <StatusSeal tone={COMMISSION_STATUS_TONE[c.status]} label={COMMISSION_STATUS_LABELS[c.status]} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}
