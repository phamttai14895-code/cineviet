import { useEffect, useRef } from 'react';
import { usePublicSettings } from '../context/PublicSettingsContext';

/**
 * Google Tag Manager: Container ID lấy từ cài đặt admin (gtm_container_id).
 * Chèn script vào <head> (vị trí cao nhất) và noscript ngay sau <body>.
 */
function getGtmScript(id) {
  return `(function(w,d,s,l,i){w[l]=w[l]||[];w[l].push({'gtm.start':
new Date().getTime(),event:'gtm.js'});var f=d.getElementsByTagName(s)[0],
j=d.createElement(s),dl=l!='dataLayer'?'&l='+l:'';j.async=true;j.src=
'https://www.googletagmanager.com/gtm.js?id='+i+dl;f.parentNode.insertBefore(j,f);
})(window,document,'script','dataLayer','${id}');`;
}

export default function GoogleTagManager() {
  const settings = usePublicSettings();
  const injected = useRef(false);

  const gtmId = (settings?.gtm_container_id || '').trim();
  const validId = gtmId && /^GTM-[A-Z0-9]+$/i.test(gtmId);

  useEffect(() => {
    if (!validId || typeof document === 'undefined' || injected.current) return;
    injected.current = true;

    // 1. Script trong <head> — chèn ở vị trí cao nhất (prepend)
    const script = document.createElement('script');
    script.textContent = getGtmScript(gtmId);
    document.head.insertBefore(script, document.head.firstChild);

    // 2. Noscript ngay sau <body>
    const noscript = document.createElement('noscript');
    const iframe = document.createElement('iframe');
    iframe.src = `https://www.googletagmanager.com/ns.html?id=${gtmId}`;
    iframe.height = '0';
    iframe.width = '0';
    iframe.style.display = 'none';
    iframe.style.visibility = 'hidden';
    noscript.appendChild(iframe);
    document.body.insertBefore(noscript, document.body.firstChild);
  }, [validId, gtmId]);

  return null;
}
