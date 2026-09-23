import { useLocation } from 'react-router-dom';
import Breadcrumb from './Breadcrumb';

// Miga de pan de cabecera para cualquier módulo con pestañas
// (Contabilidad, Tesorería, FP&A, etc.): arma "Panel principal ›
// <Módulo> › <Pestaña actual>" a partir de la MISMA lista `tabs` que
// el módulo ya usa para pintar su propia navegación (`const TABS =
// [...]` en cada Layout), así nunca se puede desincronizar de las
// pestañas reales — no es una ruta declarada aparte.
export default function ModuleBreadcrumb({ moduleLabel, tabs }) {
  const location = useLocation();
  const currentTab = tabs.find((t) => location.pathname === t.to || location.pathname.startsWith(`${t.to}/`));

  const items = [{ label: 'Panel principal', to: '/' }];
  if (tabs.length > 1 && currentTab && currentTab.to !== tabs[0].to) {
    items.push({ label: moduleLabel, to: tabs[0].to });
    items.push({ label: currentTab.label });
  } else {
    items.push({ label: moduleLabel });
  }
  return <Breadcrumb items={items} />;
}
