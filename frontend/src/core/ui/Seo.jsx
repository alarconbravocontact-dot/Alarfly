import { useEffect } from 'react';

const SITE_NAME = 'Alarfly';
const DEFAULT_DESCRIPTION =
  'Alarfly — gestión financiera integral para pymes: ventas, compras, inventario, contabilidad y flujo de caja conectados en un solo lugar.';

function setMetaByName(name, content) {
  if (!content) return;
  let el = document.querySelector(`meta[name="${name}"]`);
  if (!el) {
    el = document.createElement('meta');
    el.setAttribute('name', name);
    document.head.appendChild(el);
  }
  el.setAttribute('content', content);
}

function setMetaByProperty(property, content) {
  if (!content) return;
  let el = document.querySelector(`meta[property="${property}"]`);
  if (!el) {
    el = document.createElement('meta');
    el.setAttribute('property', property);
    document.head.appendChild(el);
  }
  el.setAttribute('content', content);
}

function setCanonical(href) {
  let el = document.querySelector('link[rel="canonical"]');
  if (!el) {
    el = document.createElement('link');
    el.setAttribute('rel', 'canonical');
    document.head.appendChild(el);
  }
  el.setAttribute('href', href);
}

function setJsonLd(id, data) {
  let el = document.getElementById(id);
  if (!data) {
    if (el) el.remove();
    return;
  }
  if (!el) {
    el = document.createElement('script');
    el.type = 'application/ld+json';
    el.id = id;
    document.head.appendChild(el);
  }
  el.textContent = JSON.stringify(data);
}

// Metadata por ruta para una SPA sin render en servidor: no existe
// ningún mecanismo real de SEO con "páginas" separadas en este
// proyecto (una sola `index.html`, React Router del lado del
// cliente) — esto es lo más honesto que se puede hacer sin introducir
// un servidor de render (fuera de alcance, no pedido). Google y Bing
// ya ejecutan JavaScript para indexar, así que el título/descripción/
// canonical que este componente deja en el `<head>` sí se ven
// reflejados en el resultado de búsqueda real — no es decorativo.
// `noIndex` se usa en páginas que existen pero no deben indexarse
// (ej. la 404).
export default function Seo({ title, description = DEFAULT_DESCRIPTION, path, noIndex = false, jsonLd = null }) {
  useEffect(() => {
    const fullTitle = title ? `${title} — ${SITE_NAME}` : SITE_NAME;
    document.title = fullTitle;

    setMetaByName('description', description);
    setMetaByName('robots', noIndex ? 'noindex, nofollow' : 'index, follow');

    setMetaByProperty('og:title', fullTitle);
    setMetaByProperty('og:description', description);
    setMetaByProperty('og:type', 'website');

    if (path) {
      const canonical = `${window.location.origin}${path}`;
      setCanonical(canonical);
      setMetaByProperty('og:url', canonical);
    }

    setJsonLd('seo-jsonld', jsonLd);

    return () => {
      // Al desmontar, se deja el <head> en el estado por defecto
      // (index.html) para que la siguiente página no herede metadata
      // vieja si tarda un instante en montar la suya propia.
      document.title = `${SITE_NAME} — Gestión financiera integral para pymes`;
      setMetaByName('robots', 'index, follow');
      setJsonLd('seo-jsonld', null);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [title, description, path, noIndex, jsonLd]);

  return null;
}
