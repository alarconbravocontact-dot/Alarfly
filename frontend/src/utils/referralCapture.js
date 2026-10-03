// Captura del ?ref= de un enlace de afiliado — ver
// LANDING_MASTER_STRATEGY.md y AFFILIATE_SYSTEM_FINAL.md para el
// razonamiento completo. Reglas documentadas explícitamente (el
// backend las trata como mejor-esfuerzo, nunca bloquean el registro):
// - "Múltiples enlaces": el ÚLTIMO código visto siempre pisa al
//   anterior (last-touch) — nunca se acumulan ni se compara.
// - "Abandona el registro y vuelve": se guarda con fecha, con una
//   ventana de 30 días — pasado ese plazo, se trata como si nunca se
//   hubiera visto (no se envía al backend).
const STORAGE_KEY = 'alarfly_referral_code';
const WINDOW_DAYS = 30;

export function captureReferralFromUrl(search) {
  const params = new URLSearchParams(search);
  const code = params.get('ref');
  if (!code) return;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ code: code.trim().toUpperCase(), capturedAt: Date.now() }));
  } catch {
    // localStorage puede fallar (modo privado/cuota) — no es crítico,
    // el registro sigue funcionando igual, solo sin atribución.
  }
}

export function getStoredReferralCode() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const { code, capturedAt } = JSON.parse(raw);
    const ageDays = (Date.now() - capturedAt) / (1000 * 60 * 60 * 24);
    if (ageDays > WINDOW_DAYS) return null;
    return code || null;
  } catch {
    return null;
  }
}
