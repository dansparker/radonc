/* Editionen:
 *  - full : alle Funktionen (Entwicklung, private Version)
 *  - basic: öffentliche Webversion (Pro-Reiter werden beim Build entfernt, Hinweis auf die App)
 *  - app  : Android-App; Pro-Reiter sind ohne Kauf gesperrt. Schnittstelle window.RoApp (Java-Bridge).
 */
(function () {
  'use strict';

  const tx = window.I18N.tx;
  const bridge = window.RoApp || null;
  const mode = bridge ? 'app' : (document.documentElement.dataset.edition || 'full');
  const PLAY_URL = 'https://play.google.com/store/apps/details?id=at.radonc.lqrechner';
  let pro = mode === 'full';
  let price = '';

  const FEATURES = [
    'Summation beliebig vieler Serien und Strukturen',
    'Re-Bestrahlung mit mehreren Vorbestrahlungen',
    'Pausenkompensation mit Kalenderplanung',
    'Toleranzdatenbank (QUANTEC, TG-101)',
    'LDR/PDR/HDR-Brachytherapie',
    'DVH → EQD2 und TCP/NTCP'
  ];

  function esc(s) { return String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c])); }

  function paywallHtml() {
    return '<div class="paywall-inner"><div class="paywall-badge">PRO</div>' +
      '<h2 class="paywall-title">' + tx('Pro-Funktion') + '</h2>' +
      '<p>' + tx('Dieser Bereich ist Teil von LQ-Rechner Pro. Einmal kaufen, dauerhaft freigeschaltet – ohne Abo, ohne Konto, alle Daten bleiben auf dem Gerät.') + '</p>' +
      '<ul>' + FEATURES.map(f => '<li>' + esc(tx(f)) + '</li>').join('') + '</ul>' +
      '<div class="paywall-actions">' +
      '<button class="btn primary" data-pw="buy">' + tx('Pro freischalten') + (price ? ' – ' + esc(price) : '') + '</button>' +
      '<button class="btn" data-pw="restore">' + tx('Kauf wiederherstellen') + '</button>' +
      (bridge && bridge.isDebug && bridge.isDebug() ? '<button class="btn" data-pw="debug">' + tx('Test: Pro umschalten (nur Debug-Build)') + '</button>' : '') +
      '</div><p class="note">' + tx('Lehr- und Ausbildungswerkzeug. Nicht für Therapieentscheidungen bestimmt.') + '</p></div>';
  }

  function render() {
    document.body.classList.toggle('locked', !pro);
    document.querySelectorAll('nav.tabs [data-pro]').forEach(b => b.classList.toggle('pro-locked', !pro));
    document.querySelectorAll('section.panel[data-pro]').forEach(sec => {
      let pw = sec.querySelector(':scope > .paywall');
      if (!pw) { pw = document.createElement('div'); pw.className = 'paywall'; pw.dataset.i18nSkip = ''; sec.prepend(pw); }
      pw.innerHTML = pro ? '' : paywallHtml();
    });
  }

  function onClick(e) {
    const b = e.target.closest('[data-pw]');
    if (!b || !bridge) return;
    const a = b.dataset.pw;
    if (a === 'buy') bridge.buyPro();
    else if (a === 'restore') bridge.restore();
    else if (a === 'debug') bridge.debugTogglePro();
  }

  function basicBanner() {
    const nav = document.querySelector('nav.tabs');
    const el = document.createElement('div');
    el.className = 'promo';
    el.dataset.i18nSkip = '';
    const fill = () => {
      el.innerHTML = '<span><strong>' + tx('LQ-Rechner Pro für Android') + ':</strong> ' + tx('Summation, Re-Bestrahlung, Pausenplanung, Toleranzen, Brachytherapie, DVH und TCP/NTCP.') + '</span>' +
        '<a class="btn small primary" href="' + PLAY_URL + '" target="_blank" rel="noopener">Google Play</a>';
    };
    fill();
    nav.parentNode.insertBefore(el, nav.nextSibling);
    document.getElementById('btn-lang').addEventListener('click', () => setTimeout(fill, 0));
  }

  function init() {
    document.documentElement.dataset.edition = mode;
    if (mode === 'basic') { basicBanner(); return; }
    if (mode !== 'app') return;

    // App: Pro-Status, Preis, Drucken/Teilen über die Bridge
    pro = !!bridge.isPro();
    price = bridge.getPrice() || '';
    window.RO_onPro = v => { pro = !!v; render(); };
    window.RO_onPrice = p => { price = p || ''; render(); };
    window.RO_toast = m => window.RO && window.RO.toast(tx(m));
    window.print = () => bridge.print(document.title);
    const share = document.getElementById('btn-share');
    if (share) share.hidden = true;
    document.addEventListener('click', onClick);
    document.getElementById('btn-lang').addEventListener('click', () => setTimeout(render, 0));
    render();
  }

  document.addEventListener('DOMContentLoaded', init);
})();
