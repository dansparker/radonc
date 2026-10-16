/* Mehrsprachigkeit (Deutsch/Englisch).
 * Quelltexte sind deutsch; window.I18N_EN (lang-en.js) bildet deutsche Texte auf englische ab.
 * - tx(text, ...args): dynamische Texte, Platzhalter {0}, {1}, …
 * - apply(): übersetzt statische Textknoten und Attribute der Seite (Original bleibt gespeichert). */
(function () {
  'use strict';

  const KEY = 'radonc-lq-lang';
  const ATTRS = ['placeholder', 'title', 'aria-label'];
  const origText = new WeakMap();
  const origAttr = new WeakMap();

  function detect() {
    const m = /[?&]lang=(de|en)\b/.exec(location.search);
    if (m) return m[1];
    try { const s = localStorage.getItem(KEY); if (s === 'de' || s === 'en') return s; } catch (e) { /* */ }
    return /^de\b/i.test(navigator.language || 'de') ? 'de' : 'en';
  }

  let lang = detect();
  const dict = () => (lang === 'en' ? window.I18N_EN || {} : {});

  function norm(s) { return s.replace(/\s+/g, ' ').trim(); }

  function tx(s) {
    let r = s;
    if (lang === 'en') {
      const e = dict()[s];
      if (e != null) r = e;
    }
    for (let i = 1; i < arguments.length; i++) r = r.split('{' + (i - 1) + '}').join(arguments[i]);
    return r;
  }

  function translateText(node) {
    if (!origText.has(node)) origText.set(node, node.nodeValue);
    const orig = origText.get(node);
    const key = norm(orig);
    if (!key) return;
    const e = lang === 'en' ? dict()[key] : null;
    const lead = /^\s*/.exec(orig)[0], trail = /\s*$/.exec(orig)[0];
    node.nodeValue = e != null ? lead + e + trail : orig;
  }

  function translateAttrs(el) {
    let o = origAttr.get(el);
    if (!o) {
      o = {};
      ATTRS.forEach(a => { if (el.hasAttribute(a)) o[a] = el.getAttribute(a); });
      origAttr.set(el, o);
    }
    Object.keys(o).forEach(a => {
      const e = lang === 'en' ? dict()[norm(o[a])] : null;
      el.setAttribute(a, e != null ? e : o[a]);
    });
  }

  /** Statische Inhalte übersetzen. Elemente mit data-i18n-skip werden ausgelassen. */
  function apply(root) {
    root = root || document.body;
    const w = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, {
      acceptNode(n) {
        const p = n.parentElement;
        if (!p || p.closest('script, style, textarea, [data-i18n-skip]')) return NodeFilter.FILTER_REJECT;
        return NodeFilter.FILTER_ACCEPT;
      }
    });
    const nodes = [];
    while (w.nextNode()) nodes.push(w.currentNode);
    nodes.forEach(translateText);
    root.querySelectorAll('[' + ATTRS.join('],[') + ']').forEach(translateAttrs);
    document.documentElement.lang = lang;
    const title = document.querySelector('title');
    if (title) { if (!title.dataset.de) title.dataset.de = title.textContent; title.textContent = tx(title.dataset.de); }
    const desc = document.querySelector('meta[name="description"]');
    if (desc) { if (!desc.dataset.de) desc.dataset.de = desc.content; desc.content = tx(desc.dataset.de); }
  }

  /** Text aus der jeweils anderen Sprache in die aktuelle übertragen (für vorbelegte Bezeichnungen). */
  function retranslate(s) {
    if (s == null) return s;
    const m = /^(.*?)(\s+\d+)$/.exec(s);
    if (m) return retranslate(m[1]) + m[2];
    const en = window.I18N_EN || {};
    let key = null;
    if (Object.prototype.hasOwnProperty.call(en, s)) key = s;
    else for (const k in en) { if (en[k] === s) { key = k; break; } }
    return key ? tx(key) : s;
  }

  function setLang(l) {
    lang = l === 'en' ? 'en' : 'de';
    try { localStorage.setItem(KEY, lang); } catch (e) { /* */ }
  }

  window.I18N = {
    tx, apply, setLang, retranslate,
    get lang() { return lang; },
    get locale() { return lang === 'en' ? 'en-GB' : 'de-DE'; }
  };
  window.tx = tx;
})();
