/* Oberfläche des LQ-Rechners. Benötigt window.LQ (lq.js) und window.RADONC_DATA (data.js). */
(function () {
  'use strict';

  const LQ = window.LQ;
  const DATA = window.RADONC_DATA;
  const $ = (id) => document.getElementById(id);
  const STORE_KEY = 'radonc-lq-v1';

  /* ---------- Zahlen ---------- */

  function parse(str) {
    if (str == null) return NaN;
    const s = String(str).trim().replace(/\s/g, '').replace(',', '.');
    if (s === '') return NaN;
    return Number(s);
  }

  function val(id) { return parse($(id).value); }

  /** Wert lesen und Feld bei Ungültigkeit markieren. */
  function req(id, { min = -Infinity, allowZero = true } = {}) {
    const el = $(id);
    const v = parse(el.value);
    const ok = isFinite(v) && v >= min && (allowZero || v !== 0);
    el.classList.toggle('invalid', !ok);
    return ok ? v : NaN;
  }

  function fmt(v, digits) {
    if (!isFinite(v)) return '–';
    digits = digits == null ? 2 : digits;
    return v.toLocaleString(window.I18N.locale, { minimumFractionDigits: digits, maximumFractionDigits: digits, useGrouping: false });
  }

  /** Zahl für ein Eingabefeld (max. 4 Nachkommastellen, ohne überflüssige Nullen). */
  function fmtInput(v) {
    if (!isFinite(v)) return '';
    const s = String(Math.round(v * 10000) / 10000);
    return window.I18N.lang === 'en' ? s : s.replace('.', ',');
  }

  function signed(v, digits) {
    if (!isFinite(v)) return '–';
    const s = fmt(Math.abs(v), digits);
    if (Math.abs(v) < Math.pow(10, -(digits == null ? 2 : digits)) / 2) return '±' + s;
    return (v > 0 ? '+' : '−') + s;
  }

  function esc(s) {
    return String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  }

  function metric(label, value, unit, opts) {
    opts = opts || {};
    return '<div class="metric' + (opts.main ? ' main' : '') + '"><div class="k">' + label + '</div>' +
      '<div class="v">' + value + (unit ? '<small>' + unit + '</small>' : '') + '</div>' +
      (opts.sub ? '<div class="sub">' + opts.sub + '</div>' : '') + '</div>';
  }

  function toast(msg) {
    const t = $('toast');
    t.textContent = msg;
    t.classList.add('show');
    clearTimeout(toast._t);
    toast._t = setTimeout(() => t.classList.remove('show'), 1800);
  }

  /* ---------- Voreinstellungen ---------- */

  function fillAbPresets() {
    document.querySelectorAll('select.ab-preset').forEach(sel => {
      const prev = sel.value;
      let html = '<option value="">' + tx('– Voreinstellung wählen –') + '</option>';
      DATA.alphaBeta.forEach((g, gi) => {
        html += '<optgroup label="' + esc(tx(g.group)) + '">';
        g.items.forEach((it, ii) => {
          html += '<option value="' + gi + '|' + ii + '">' + esc(tx(it.name)) + ' (' + fmtInput(it.ab) + ' Gy)</option>';
        });
        html += '</optgroup>';
      });
      sel.innerHTML = html;
      sel.value = prev;
    });
  }

  function abPreset(value) {
    if (!value) return null;
    const [gi, ii] = value.split('|').map(Number);
    return DATA.alphaBeta[gi] && DATA.alphaBeta[gi].items[ii];
  }

  function fillRepPresets() {
    document.querySelectorAll('select.rep-preset').forEach(sel => {
      const prev = sel.value;
      sel.innerHTML = DATA.repopulation.map((r, i) => '<option value="' + i + '">' + esc(tx(r.name)) + '</option>').join('');
      sel.value = prev || '1';
    });
  }

  function fillThPresets() {
    document.querySelectorAll('select.th-preset').forEach(sel => {
      const prev = sel.value;
      sel.innerHTML = '<option value="">' + tx('– Voreinstellung wählen –') + '</option>' +
        DATA.halfTimes.map((h, i) => '<option value="' + i + '">' + esc(tx(h.name)) + ' (' + fmtInput(h.t) + ' h)</option>').join('');
      sel.value = prev;
      if (sel.dataset.wired) return;
      sel.dataset.wired = '1';
      const target = $(sel.dataset.target);
      sel.addEventListener('change', () => {
        const h = DATA.halfTimes[+sel.value];
        if (sel.value !== '' && h) { target.value = fmtInput(h.t); target.dispatchEvent(new Event('input', { bubbles: true })); }
      });
      target.addEventListener('input', e => { if (e.isTrusted) sel.value = ''; });
    });
  }

  function wirePresets() {
    document.querySelectorAll('select.ab-preset[data-target]').forEach(sel => {
      const target = $(sel.dataset.target);
      sel.addEventListener('change', () => {
        const p = abPreset(sel.value);
        if (p && sel.dataset.limit && p.limit) $(sel.dataset.limit).value = fmtInput(p.limit);
        if (p) { target.value = fmtInput(p.ab); target.dispatchEvent(new Event('input', { bubbles: true })); }
      });
      target.addEventListener('input', (e) => {
        if (e.isTrusted) {
          const p = abPreset(sel.value);
          if (p && p.ab !== parse(target.value)) sel.value = '';
        }
      });
    });
    document.querySelectorAll('select.rep-preset').forEach(sel => {
      const tk = $(sel.dataset.tk), dp = $(sel.dataset.dp);
      sel.addEventListener('change', () => {
        const r = DATA.repopulation[+sel.value];
        if (r && r.tk != null) {
          tk.value = fmtInput(r.tk); dp.value = fmtInput(r.dp);
          tk.dispatchEvent(new Event('input', { bubbles: true }));
        }
      });
      [tk, dp].forEach(el => el.addEventListener('input', (e) => { if (e.isTrusted) sel.value = '0'; }));
    });
  }

  /* ======================================================================
   * Rechner
   * ==================================================================== */

  let calcOrder = ['n', 'd']; // zuletzt bearbeitete Felder; das dritte wird berechnet

  function calcComputedKey() {
    return ['d', 'n', 'D'].find(k => !calcOrder.includes(k));
  }

  function updateCalcTriplet() {
    const key = calcComputedKey();
    ['d', 'n', 'D'].forEach(k => $('c-' + k).classList.toggle('computed', k === key));
    const d = val('c-d'), n = val('c-n'), D = val('c-D');
    let v = NaN;
    if (key === 'D') v = d * n;
    else if (key === 'n') v = D / d;
    else v = D / n;
    $('c-' + key).value = isFinite(v) && v > 0 ? fmtInput(v) : '';
  }

  function calcTimeParams(n) {
    const enabled = $('c-time').checked;
    const fxw = val('c-fxw') || 5, fxd = $('c-bid').checked ? 2 : 1;
    const auto = LQ.overallTime(Math.ceil(n), fxw, fxd);
    $('c-T-hint').textContent = 'auto: ' + auto + ' d';
    const Tin = val('c-T');
    return {
      enabled,
      T: isFinite(Tin) ? Tin : auto,
      Tk: req('c-tk', { min: 0 }),
      dprolif: req('c-dp', { min: 0 })
    };
  }

  function renderCalc() {
    updateCalcTriplet();
    $('c-time-box').hidden = !$('c-time').checked;
    $('c-lql-box').hidden = !$('c-lql').checked;
    $('c-bid-box').hidden = !$('c-bid').checked;

    const d = req('c-d', { min: 0, allowZero: false });
    const n = req('c-n', { min: 0, allowZero: false });
    req('c-D', { min: 0, allowZero: false });
    const ab = req('c-ab', { min: 0, allowZero: false });
    const x = req('c-x', { min: 0 });
    const lql = $('c-lql').checked;
    const dT = lql ? req('c-dT', { min: 0, allowZero: false }) : NaN;
    const time = calcTimeParams(n);
    const bid = $('c-bid').checked;
    const repair = bid ? { pairs: Math.floor(n / 2), dt: req('c-dt', { min: 0 }), halfTime: req('c-th', { min: 0, allowZero: false }) } : null;

    const out = $('c-results'), msg = $('c-msg');
    if (![d, n, ab, x].every(isFinite) || (lql && !isFinite(dT)) || (time.enabled && !(isFinite(time.Tk) && isFinite(time.dprolif))) ||
        (bid && !(isFinite(repair.dt) && isFinite(repair.halfTime)))) {
      out.innerHTML = '<p class="note">' + tx('Bitte gültige positive Werte eingeben.') + '</p>';
      msg.innerHTML = ''; $('c-abtable').innerHTML = ''; $('c-plot').innerHTML = ''; $('c-legend').innerHTML = '';
      return;
    }

    const opts = { lql, dT };
    const r = LQ.evaluate({ d, n, ab, x, lql, dT, time, repair });

    let html = '';
    html += metric('EQD2', fmt(r.eqd2), 'Gy', { main: true, sub: 'α/β = ' + fmtInput(ab) + ' Gy' }) + '<!--unc-->';
    html += metric('BED', fmt(r.bed), 'Gy', { sub: 'Gy<sub>' + fmtInput(ab) + '</sub>' });
    if (x !== 2) html += metric('EQD' + fmtInput(x), fmt(r.eqdx), 'Gy');
    html += metric(tx('Gesamtdosis'), fmt(r.D), 'Gy', { sub: fmtInput(n) + ' × ' + fmtInput(d) + ' Gy' });
    html += metric(tx('Rel. Effektivität'), fmt(r.re, 3), '', { sub: 'BED / D' });
    if (time.enabled) {
      html += metric(tx('Zeitverlust'), fmt(r.loss / (1 + 2 / ab)), 'Gy EQD2', { sub: fmt(r.loss) + ' Gy BED · T = ' + fmtInput(time.T) + ' d' });
      html += metric(tx('EQD2 ohne Zeit'), fmt(r.eqd2NoTime), 'Gy');
    }
    if (repair) {
      html += metric(tx('Reparaturzuschlag'), fmt(r.repairExcess / (1 + 2 / ab)), 'Gy EQD2',
        { sub: tx('{0} Tage mit 2 Fx', repair.pairs) + ' · θ = ' + fmt(LQ.repairTheta(repair.dt, repair.halfTime), 3) });
    }
    const unc = renderCalcUncertainty({ d, n, ab, x, lql, dT, time, repair, r });
    out.innerHTML = html.replace('<!--unc-->', unc.metric);
    $('c-tornado').innerHTML = unc.tornado;

    const notes = [];
    if (repair && repair.dt < 6) notes.push(tx('Intervall < 6 h: deutlich unvollständige Reparatur – für ZNS/Rückenmark ≥ 8 h empfohlen.'));
    if (repair && n % 2 === 1) notes.push(tx('Ungerade Fraktionszahl: ein Tag mit nur einer Fraktion.'));
    if (Math.abs(n - Math.round(n)) > 1e-6) notes.push(tx('Die Fraktionszahl ist nicht ganzzahlig.'));
    if (!lql && d > 8) notes.push(tx('Einzeldosis > 8 Gy: Das LQ-Modell überschätzt hier vermutlich die Wirkung. LQ-L-Modell erwägen.'));
    if (lql && d > dT) notes.push(tx('LQ-L aktiv: Einzeldosis liegt über d<sub>T</sub> – linearer Ast wird verwendet.'));
    if (time.enabled && time.T <= time.Tk) notes.push(tx('T ≤ T<sub>k</sub>: keine Repopulationskorrektur.'));
    if (time.enabled && ab < 6) notes.push(tx('Zeitfaktor bei niedrigem α/β (spät reagierendes Gewebe) in der Regel nicht anwenden.'));
    msg.innerHTML = notes.map(t => '<div class="callout">' + t + '</div>').join('');

    // α/β-Tabelle
    const abs = [1.5, 2, 3, 3.5, 5, 10];
    if (!abs.some(a => Math.abs(a - ab) < 1e-9)) abs.push(ab);
    abs.sort((a, b) => a - b);
    let t = '<thead><tr><th>α/β [Gy]</th><th>BED [Gy]</th><th>EQD2 [Gy]</th></tr></thead><tbody>';
    abs.forEach(a => {
      const rr = LQ.evaluate({ d, n, ab: a, lql, dT, repair });
      t += '<tr' + (Math.abs(a - ab) < 1e-9 ? ' class="hl"' : '') + '><td>' + fmtInput(a) + '</td><td>' + fmt(rr.bed) + '</td><td>' + fmt(rr.eqd2) + '</td></tr>';
    });
    $('c-abtable').innerHTML = t + '</tbody>';
    if (time.enabled) $('c-abtable').innerHTML += '<caption class="note" style="caption-side:bottom;text-align:left">' + tx('Ohne Zeitfaktor.') + '</caption>';

    drawIsoPlot(d, n, ab, opts);
  }

  /* ---------- Unsicherheit ---------- */

  /** Literaturbereich aus einem Text wie „≈ 1,2–1,9“ lesen. */
  function rangeFromText(txt) {
    const m = /(\d+(?:[.,]\d+)?)\s*[–-]\s*(\d+(?:[.,]\d+)?)/.exec(txt || '');
    return m ? [parse(m[1]), parse(m[2])] : null;
  }

  function uncRange(idLo, idHi, defLo, defHi) {
    $(idLo).placeholder = 'auto ' + fmtInput(Math.round(defLo * 100) / 100);
    $(idHi).placeholder = 'auto ' + fmtInput(Math.round(defHi * 100) / 100);
    const lo = val(idLo), hi = val(idHi);
    const r = [isFinite(lo) ? lo : defLo, isFinite(hi) ? hi : defHi];
    return r[0] <= r[1] ? r : [r[1], r[0]];
  }

  const UNC_LABEL = { ab: 'α/β', Tk: 'T<sub>k</sub>', dprolif: 'D<sub>prolif</sub>', halfTime: 'T½', dT: 'd<sub>T</sub>' };

  /** Tornado-Diagramm: Einfluss jedes Parameters (allein variiert) auf den Zielwert. */
  function tornado(rg, ranges, unit) {
    if (!rg.sens.length) return '';
    const lo = rg.min, hi = rg.max, w = hi - lo || 1;
    const pos = v => ((v - lo) / w * 100).toFixed(2) + '%';
    return '<div class="tornado"><div class="lbl">' + tx('Einfluss der Parameter (jeweils allein variiert)') + '</div>' +
      rg.sens.map(s => {
        const a = Math.min(s.lo, s.hi), b = Math.max(s.lo, s.hi);
        return '<div class="tornado-row"><span>' + UNC_LABEL[s.key] + ' <span class="tornado-val">' + fmtInput(ranges[s.key][0]) + '–' + fmtInput(ranges[s.key][1]) + '</span></span>' +
          '<div class="tornado-track"><div class="tornado-bar" style="left:' + pos(a) + ';width:calc(' + pos(b) + ' - ' + pos(a) + ')"></div>' +
          '<div class="tornado-base" style="left:' + pos(rg.value) + '"></div></div>' +
          '<span class="tornado-val">' + fmt(a) + '–' + fmt(b) + ' ' + unit + '</span></div>';
      }).join('') + '</div>';
  }

  function renderCalcUncertainty(c) {
    const on = $('c-unc').checked;
    $('c-unc-box').hidden = !on;
    $('c-unc-time').hidden = !c.time.enabled;
    $('c-unc-bid').hidden = !c.repair;
    $('c-unc-lql').hidden = !c.lql;
    if (!on) return { metric: '', tornado: '' };
    const lit = abPreset($('c-preset').value);
    const litR = lit && Math.abs(lit.ab - c.ab) < 1e-9 ? rangeFromText(lit.range) : null;
    const ranges = { ab: uncRange('c-ablo', 'c-abhi', litR ? litR[0] : c.ab * 0.7, litR ? litR[1] : c.ab * 1.3) };
    const base = { ab: c.ab };
    if (c.time.enabled) {
      ranges.Tk = uncRange('c-tklo', 'c-tkhi', Math.max(0, c.time.Tk - 7), c.time.Tk + 7);
      ranges.dprolif = uncRange('c-dplo', 'c-dphi', Math.max(0, c.time.dprolif - 0.2), c.time.dprolif + 0.2);
      base.Tk = c.time.Tk; base.dprolif = c.time.dprolif;
    }
    if (c.repair) { ranges.halfTime = uncRange('c-thlo', 'c-thhi', c.repair.halfTime / 1.5, c.repair.halfTime * 1.5); base.halfTime = c.repair.halfTime; }
    if (c.lql) { ranges.dT = uncRange('c-dTlo', 'c-dThi', Math.max(0.5, c.dT - 2), c.dT + 2); base.dT = c.dT; }
    if (ranges.ab[0] <= 0) ranges.ab[0] = 0.1;
    const fn = q => LQ.evaluate({
      d: c.d, n: c.n, ab: q.ab, x: c.x, lql: c.lql, dT: q.dT,
      time: Object.assign({}, c.time, { Tk: q.Tk, dprolif: q.dprolif }),
      repair: c.repair ? Object.assign({}, c.repair, { halfTime: q.halfTime }) : null
    }).eqd2;
    const rg = LQ.rangeEval(fn, base, ranges);
    return {
      metric: metric(tx('EQD2-Bereich'), fmt(rg.min) + '–' + fmt(rg.max), 'Gy', { sub: signed(rg.min - rg.value) + ' / ' + signed(rg.max - rg.value) + ' Gy' }),
      tornado: tornado(rg, ranges, 'Gy')
    };
  }

  /* ---------- Isoeffekt-Plot (SVG) ---------- */

  function drawIsoPlot(d, n, ab, opts) {
    const svg = $('c-plot');
    const ab2 = parse($('c-ab2').value);
    const W = 560, H = 300, m = { l: 48, r: 14, t: 12, b: 38 };
    const xMax = Math.min(30, Math.max(10, Math.ceil(d * 1.5)));
    const xMin = 0.5;
    const curves = [{ ab, color: 'var(--curve-1)', label: 'α/β = ' + fmtInput(ab) + ' Gy' }];
    if (isFinite(ab2) && ab2 > 0 && Math.abs(ab2 - ab) > 1e-9) curves.push({ ab: ab2, color: 'var(--curve-2)', label: 'α/β = ' + fmtInput(ab2) + ' Gy' });

    const D0 = n * d;
    const pts = curves.map(c => {
      const bed = n * LQ.bedPerFraction(d, c.ab, opts);
      const arr = [];
      for (let i = 0; i <= 120; i++) {
        const x = xMin + (xMax - xMin) * i / 120;
        arr.push([x, LQ.nForBed(bed, x, c.ab, opts) * x]);
      }
      return arr;
    });
    let yMax = Math.max(D0 * 1.6, ...pts.map(a => a[a.length - 1][1]));
    yMax = Math.min(yMax, D0 * 2.5);
    const step = niceStep(yMax / 5);
    yMax = Math.ceil(yMax / step) * step;
    const sx = x => m.l + (x - 0) / xMax * (W - m.l - m.r);
    const sy = y => H - m.b - y / yMax * (H - m.t - m.b);

    let g = '<g class="grid">';
    for (let y = 0; y <= yMax + 1e-9; y += step) {
      g += '<line x1="' + m.l + '" x2="' + (W - m.r) + '" y1="' + sy(y) + '" y2="' + sy(y) + '"/>';
      g += '<text x="' + (m.l - 6) + '" y="' + (sy(y) + 4) + '" text-anchor="end">' + fmtInput(y) + '</text>';
    }
    const xs = niceStep(xMax / 8);
    for (let x = 0; x <= xMax + 1e-9; x += xs) {
      g += '<text x="' + sx(x) + '" y="' + (H - m.b + 16) + '" text-anchor="middle">' + fmtInput(x) + '</text>';
    }
    g += '</g>';
    g += '<line class="axis" x1="' + m.l + '" x2="' + m.l + '" y1="' + m.t + '" y2="' + (H - m.b) + '"/>';
    g += '<line class="axis" x1="' + m.l + '" x2="' + (W - m.r) + '" y1="' + (H - m.b) + '" y2="' + (H - m.b) + '"/>';
    g += '<text x="' + ((W + m.l) / 2) + '" y="' + (H - 4) + '" text-anchor="middle">' + tx('Einzeldosis [Gy]') + '</text>';
    g += '<text transform="translate(12 ' + ((H - m.b + m.t) / 2) + ') rotate(-90)" text-anchor="middle">' + tx('Isoeffektive Gesamtdosis [Gy]') + '</text>';
    g += '<defs><clipPath id="clip"><rect x="' + m.l + '" y="' + m.t + '" width="' + (W - m.l - m.r) + '" height="' + (H - m.t - m.b) + '"/></clipPath></defs>';
    pts.forEach((arr, i) => {
      const dAttr = arr.map((p, j) => (j ? 'L' : 'M') + sx(p[0]).toFixed(1) + ' ' + sy(p[1]).toFixed(1)).join(' ');
      g += '<path d="' + dAttr + '" fill="none" stroke="' + curves[i].color + '" stroke-width="2.2" clip-path="url(#clip)"/>';
    });
    if (opts.lql && opts.dT > 0 && opts.dT < xMax) {
      g += '<line x1="' + sx(opts.dT) + '" x2="' + sx(opts.dT) + '" y1="' + m.t + '" y2="' + (H - m.b) + '" stroke="var(--muted)" stroke-dasharray="4 4"/>';
      g += '<text x="' + (sx(opts.dT) + 4) + '" y="' + (m.t + 12) + '">d<tspan baseline-shift="sub" font-size="8">T</tspan></text>';
    }
    if (d <= xMax) {
      g += '<circle cx="' + sx(d) + '" cy="' + sy(D0) + '" r="5" fill="var(--surface)" stroke="var(--text)" stroke-width="2"/>';
      g += '<text x="' + (sx(d) + 8) + '" y="' + (sy(D0) - 8) + '" style="fill:var(--text)">' + fmtInput(n) + ' × ' + fmtInput(d) + ' Gy</text>';
    }
    svg.innerHTML = g;
    $('c-legend').innerHTML = curves.map(c => '<span><i style="background:' + c.color + '"></i>' + c.label + '</span>').join('');
  }

  function niceStep(raw) {
    const p = Math.pow(10, Math.floor(Math.log10(raw)));
    const f = raw / p;
    return (f <= 1 ? 1 : f <= 2 ? 2 : f <= 5 ? 5 : 10) * p;
  }

  /* ======================================================================
   * Summation
   * ==================================================================== */

  let series = [
    { label: tx('Serie') + ' 1', d: '2', n: '25', rec: '0' },
    { label: 'Boost', d: '3', n: '5', rec: '0' }
  ];
  let tissues = [
    { name: tx('Tumor'), ab: '10', th: '0,5', time: false, limit: '' },
    { name: tx('Spät reagierend'), ab: '3', th: '1,5', time: false, limit: '' }
  ];

  function renderSeriesTable() {
    if (!$('panel-sum')) return;
    const tb = $('s-series').querySelector('tbody');
    tb.innerHTML = series.map((s, i) => {
      const lab = '<td class="edit"><input type="text" data-i="' + i + '" data-k="label" value="' + esc(s.label) + '" style="min-width:140px"></td>';
      const rec = '<td class="edit"><input type="text" inputmode="decimal" data-i="' + i + '" data-k="rec" value="' + esc(s.rec || '') + '" style="width:70px"></td>';
      const del = '<td><button class="icon" data-del="' + i + '" title="' + tx('Serie entfernen') + '" aria-label="' + tx('Serie entfernen') + '">×</button></td>';
      if (s.type === 'brachy') {
        return '<tr>' + lab + '<td class="txt" colspan="2" style="white-space:normal;font-size:13px;color:var(--muted)">' + esc(s.desc || tx('Brachytherapie')) + '</td>' +
          '<td data-dcell="' + i + '"></td><td class="txt" style="text-align:center;color:var(--muted)">–</td>' + rec + del + '</tr>';
      }
      return '<tr>' + lab +
        '<td class="edit"><input type="text" inputmode="decimal" data-i="' + i + '" data-k="d" value="' + esc(s.d) + '" style="width:80px"></td>' +
        '<td class="edit"><input type="text" inputmode="decimal" data-i="' + i + '" data-k="n" value="' + esc(s.n) + '" style="width:70px"></td>' +
        '<td data-dcell="' + i + '"></td>' +
        '<td class="edit"><input type="text" inputmode="decimal" data-i="' + i + '" data-k="bid" value="' + esc(s.bid || '') + '" style="width:70px" placeholder="1×"></td>' +
        rec + del + '</tr>';
    }).join('');
  }

  function renderTissueTable() {
    if (!$('panel-sum')) return;
    const tb = $('s-tissues').querySelector('tbody');
    tb.innerHTML = tissues.map((t, i) =>
      '<tr>' +
      '<td class="edit"><input type="text" data-ti="' + i + '" data-k="name" value="' + esc(t.name) + '" style="min-width:140px"></td>' +
      '<td class="edit"><input type="text" inputmode="decimal" data-ti="' + i + '" data-k="ab" value="' + esc(t.ab) + '" style="width:70px"></td>' +
      '<td class="edit"><input type="text" inputmode="decimal" data-ti="' + i + '" data-k="th" value="' + esc(t.th != null ? t.th : '1,5') + '" style="width:70px"></td>' +
      '<td style="text-align:center"><input type="checkbox" data-ti="' + i + '" data-k="time"' + (t.time ? ' checked' : '') + '></td>' +
      '<td class="edit"><input type="text" inputmode="decimal" data-ti="' + i + '" data-k="limit" value="' + esc(t.limit) + '" style="width:80px" placeholder="–"></td>' +
      '<td><button class="icon" data-tdel="' + i + '" title="' + tx('Struktur entfernen') + '" aria-label="' + tx('Struktur entfernen') + '">×</button></td>' +
      '</tr>').join('');
  }

  function renderSum() {
    if (!$('panel-sum')) return;
    // Serien validieren
    const ser = series.map((s, i) => {
      const rec = parse(s.rec);
      const recOk = !s.rec || (isFinite(rec) && rec >= 0 && rec <= 100);
      const row = $('s-series').querySelectorAll('tbody tr')[i];
      if (row) row.querySelector('[data-k="rec"]').classList.toggle('invalid', !recOk);
      const recovery = (isFinite(rec) ? rec : 0) / 100;
      if (s.type === 'brachy') {
        const D = LQ.brachySegments(s.spec).reduce((a, g) => a + g.rate * g.duration, 0);
        if (row) row.querySelector('[data-dcell]').textContent = fmt(D);
        return recOk ? { type: 'brachy', label: s.label, spec: s.spec, recovery, n: 0, D } : null;
      }
      const d = parse(s.d), n = parse(s.n), bid = parse(s.bid);
      const ok = isFinite(d) && d > 0 && isFinite(n) && n > 0;
      const bidOk = !s.bid || (isFinite(bid) && bid > 0);
      if (row) {
        row.querySelector('[data-k="d"]').classList.toggle('invalid', !(isFinite(d) && d > 0));
        row.querySelector('[data-k="n"]').classList.toggle('invalid', !(isFinite(n) && n > 0));
        row.querySelector('[data-k="bid"]').classList.toggle('invalid', !bidOk);
        row.querySelector('[data-dcell]').textContent = ok ? fmt(d * n) : '–';
      }
      return ok && recOk && bidOk ? { label: s.label, d, n, D: d * n, interval: s.bid ? bid : 0, recovery } : null;
    });
    const valid = ser.filter(Boolean);
    const totalN = valid.reduce((a, s) => a + s.n, 0);
    const autoT = LQ.overallTime(Math.ceil(totalN), 5, 1);
    $('s-T-hint').textContent = 'auto: ' + autoT + ' d (' + Math.ceil(totalN) + ' Fx, ' + tx('5/Woche') + ')';
    const Tin = val('s-T');
    const time = { enabled: true, T: isFinite(Tin) ? Tin : autoT, Tk: req('s-tk', { min: 0 }), dprolif: req('s-dp', { min: 0 }) };

    const tis = tissues.map((t, i) => {
      const ab = parse(t.ab), lim = parse(t.limit), th = parse(t.th != null ? t.th : '1,5');
      const row = $('s-tissues').querySelectorAll('tbody tr')[i];
      if (row) {
        row.querySelector('[data-k="ab"]').classList.toggle('invalid', !(isFinite(ab) && ab > 0));
        row.querySelector('[data-k="th"]').classList.toggle('invalid', !(isFinite(th) && th > 0));
      }
      return isFinite(ab) && ab > 0 && isFinite(th) && th > 0 ? { name: t.name || (tx('Struktur') + ' ' + (i + 1)), ab, th, time: t.time, limit: lim } : null;
    }).filter(Boolean);

    const tbl = $('s-result');
    if (!valid.length || !tis.length) { tbl.innerHTML = '<tbody><tr><td class="txt">' + tx('Mindestens eine gültige Serie und Struktur angeben.') + '</td></tr></tbody>'; return; }

    const sums = tis.map(t => LQ.sumSeries(valid, t.ab, t.time && isFinite(time.Tk) && isFinite(time.dprolif) ? time : null, 2, t.th));
    let h = '<thead><tr><th>' + tx('Serie') + '</th><th>' + tx('D phys. [Gy]') + '</th>' + tis.map(t => '<th>' + esc(t.name) + '<br><span style="font-weight:400;text-transform:none">α/β ' + fmtInput(t.ab) + '</span></th>').join('') + '</tr></thead><tbody>';
    valid.forEach((s, i) => {
      const tags = (s.recovery ? ' <span class="tag">−' + fmtInput(s.recovery * 100) + ' %</span>' : '') +
        (s.interval ? ' <span class="tag">' + tx('2× tgl.') + '</span>' : '');
      h += '<tr><td class="txt">' + esc(s.label || (tx('Serie') + ' ' + (i + 1))) + tags + '</td><td>' + fmt(s.D) + '</td>' +
        sums.map(r => '<td>' + fmt(r.rows[i].eqd2Eff) + '</td>').join('') + '</tr>';
    });
    if (sums.some(r => r.loss > 0)) {
      h += '<tr><td class="txt">' + tx('Zeitkorrektur') + ' (T = ' + fmtInput(time.T) + ' d)</td><td></td>' +
        sums.map((r, j) => '<td>' + (r.loss > 0 ? '−' + fmt(r.loss / (1 + 2 / tis[j].ab)) : '') + '</td>').join('') + '</tr>';
    }
    h += '<tr class="total"><td class="txt">' + tx('Summe EQD2') + '</td><td>' + fmt(sums[0].D) + '</td>' + sums.map(r => '<td>' + fmt(r.eqd2) + '</td>').join('') + '</tr>';
    $('s-unc-box').hidden = !$('s-unc').checked;
    if ($('s-unc').checked) {
      const pa = req('s-unc-ab', { min: 0 }) / 100, ptk = req('s-unc-tk', { min: 0 }), pdp = req('s-unc-dp', { min: 0 }), pth = req('s-unc-th', { min: 1 });
      if ([pa, ptk, pdp, pth].every(isFinite)) {
        h += '<tr><td class="txt">' + tx('Bereich EQD2 (Unsicherheit)') + '</td><td></td>' + tis.map(tt => {
          const timeOn = tt.time && isFinite(time.Tk) && isFinite(time.dprolif);
          const ranges = { ab: [tt.ab * (1 - Math.min(pa, 0.95)), tt.ab * (1 + pa)], th: [tt.th / pth, tt.th * pth] };
          const base = { ab: tt.ab, th: tt.th, Tk: time.Tk, dp: time.dprolif };
          if (timeOn) { ranges.Tk = [Math.max(0, time.Tk - ptk), time.Tk + ptk]; ranges.dp = [Math.max(0, time.dprolif - pdp), time.dprolif + pdp]; }
          const rg = LQ.rangeEval(q => LQ.sumSeries(valid, q.ab, timeOn ? Object.assign({}, time, { Tk: q.Tk, dprolif: q.dp }) : null, 2, q.th).eqd2, base, ranges);
          return '<td>' + fmt(rg.min, 1) + '–' + fmt(rg.max, 1) + '</td>';
        }).join('') + '</tr>';
      }
    }
    h += '<tr><td class="txt">' + tx('Summe BED') + '</td><td></td>' + sums.map(r => '<td>' + fmt(r.bed) + '</td>').join('') + '</tr>';
    if (tis.some(t => isFinite(t.limit) && t.limit > 0)) {
      h += '<tr><td class="txt">' + tx('Limit / Ausschöpfung') + '</td><td></td>' + sums.map((r, j) => {
        const L = tis[j].limit;
        if (!(isFinite(L) && L > 0)) return '<td></td>';
        const p = r.eqd2 / L * 100;
        const cls = p > 100 ? 'bad' : p > 90 ? 'warn' : 'good';
        return '<td>' + fmt(L, 1) + ' <span class="tag ' + cls + '">' + fmt(p, 0) + ' %</span></td>';
      }).join('') + '</tr>';
    }
    tbl.innerHTML = h + '</tbody>';
  }

  /** Von anderen Tabs aufgerufen: neue Serie hinzufügen. */
  function addSeries(s) {
    series.push(s);
    renderSeriesTable(); renderSum(); save();
  }

  /* ======================================================================
   * Umrechnung
   * ==================================================================== */

  function renderIso() {
    if (!$('panel-iso')) return;
    const d1 = req('i-d', { min: 0, allowZero: false });
    const n1 = req('i-n', { min: 0, allowZero: false });
    const ab = req('i-ab', { min: 0, allowZero: false });
    const ab2 = req('i-ab2', { min: 0, allowZero: false });
    $('i-D').value = isFinite(d1 * n1) ? fmtInput(d1 * n1) : '';
    const out = $('i-out');
    if (![d1, n1, ab, ab2].every(isFinite)) { out.innerHTML = '<p class="note">' + tx('Bitte gültige Werte eingeben.') + '</p>'; $('i-table').innerHTML = ''; return; }

    const bed1 = n1 * d1 * (1 + d1 / ab);
    const eqd1 = bed1 / (1 + 2 / ab);
    const late1 = n1 * d1 * (1 + d1 / ab2) / (1 + 2 / ab2);

    const n2in = parse($('i-n2').value);
    const d2in = parse($('i-d2').value);
    let html = '';
    if (isFinite(n2in) && n2in > 0) {
      $('i-n2').classList.remove('invalid');
      const d2 = LQ.dForBed(bed1, n2in, ab);
      const late2 = n2in * d2 * (1 + d2 / ab2) / (1 + 2 / ab2);
      html += '<div class="results">' +
        metric(tx('Einzeldosis d₂'), fmt(d2), 'Gy', { main: true }) +
        metric(tx('Gesamtdosis D₂'), fmt(n2in * d2), 'Gy', { sub: fmtInput(n2in) + ' × ' + fmt(d2) + ' Gy' }) +
        metric(tx('EQD2 Ziel'), fmt(eqd1), 'Gy', { sub: 'α/β ' + fmtInput(ab) }) +
        metric(tx('EQD2 Vergleich'), fmt(late2), 'Gy', { sub: tx('vorher') + ' ' + fmt(late1) + ' (' + signed(late2 - late1) + ')' }) +
        '</div>';
    } else if (isFinite(d2in) && d2in > 0) {
      $('i-d2').classList.remove('invalid');
      const n2 = LQ.nForBed(bed1, d2in, ab);
      const D2 = LQ.isoeffectiveDose(n1 * d1, d1, d2in, ab);
      const nR = Math.max(1, Math.round(n2));
      const eqdR = nR * d2in * (1 + d2in / ab) / (1 + 2 / ab);
      const late2 = nR * d2in * (1 + d2in / ab2) / (1 + 2 / ab2);
      html += '<div class="results">' +
        metric(tx('Gesamtdosis D₂'), fmt(D2), 'Gy', { main: true, sub: tx('exakt isoeffektiv') }) +
        metric(tx('Fraktionen n₂'), fmt(n2), '', { sub: tx('gerundet') + ': ' + nR + ' Fx = ' + fmt(nR * d2in) + ' Gy' }) +
        metric(tx('EQD2 Ziel (gerundet)'), fmt(eqdR), 'Gy', { sub: tx('Soll') + ' ' + fmt(eqd1) + ' (' + signed(eqdR - eqd1) + ')' }) +
        metric(tx('EQD2 Vergleich (gerundet)'), fmt(late2), 'Gy', { sub: tx('vorher') + ' ' + fmt(late1) + ' (' + signed(late2 - late1) + ')' }) +
        '</div>';
    } else {
      html = '<p class="note">' + tx('Neue Einzeldosis oder Fraktionszahl eingeben.') + '</p>';
    }
    out.innerHTML = html;

    // Tabelle
    const tIn = parse($('i-target').value);
    const target = isFinite(tIn) && tIn > 0 ? tIn : eqd1;
    $('i-target').placeholder = tx('aus Ausgangsschema') + ': ' + fmt(eqd1);
    const ds = $('i-dlist').value.split(/[;\s]+/).map(parse).filter(v => isFinite(v) && v > 0);
    const rows = LQ.scheduleTable(target, ab, ab2, ds);
    let t = '<thead><tr><th>d [Gy]</th><th>' + tx('n exakt') + '</th><th>n</th><th>D [Gy]</th><th>' + tx('EQD2 Ziel') + '</th><th>' + tx('EQD2 Vergl.') + '</th></tr></thead><tbody>';
    rows.forEach(r => {
      const cur = Math.abs(r.d - d1) < 1e-9;
      t += '<tr' + (cur ? ' class="hl"' : '') + '><td>' + fmtInput(r.d) + '</td><td>' + fmt(r.n, 1) + '</td><td>' + r.nRounded + '</td><td>' + fmt(r.D) + '</td><td>' + fmt(r.eqd2Tumor) + '</td><td>' + fmt(r.eqd2Late) + '</td></tr>';
    });
    $('i-table').innerHTML = t + '</tbody>';
  }

  /* ======================================================================
   * Pausen
   * ==================================================================== */

  function renderGap() {
    if (!$('panel-gap')) return;
    const d = req('g-d', { min: 0, allowZero: false });
    const n = req('g-n', { min: 1 });
    const fxw = req('g-fxw', { min: 1 });
    const abT = req('g-abT', { min: 0, allowZero: false });
    const abL = req('g-abL', { min: 0, allowZero: false });
    const Tk = req('g-tk', { min: 0 });
    const dp = req('g-dp', { min: 0 });
    const del = req('g-del', { min: 0 });
    const miss = req('g-miss', { min: 0 });
    const out = $('g-out');
    if (![d, n, fxw, abT, abL, Tk, dp, del, miss].every(isFinite)) { out.innerHTML = '<p class="note">' + tx('Bitte gültige Werte eingeben.') + '</p>'; return; }
    if (del > n) { $('g-del').classList.add('invalid'); out.innerHTML = '<p class="note">' + tx('Es können nicht mehr Fraktionen appliziert sein als geplant.') + '</p>'; return; }

    const T0auto = LQ.overallTime(n, fxw, 1);
    $('g-T0-hint').textContent = 'auto: ' + T0auto + ' d';
    const T0in = val('g-T0');
    const T0 = isFinite(T0in) ? T0in : T0auto;
    const extAuto = LQ.overallTime(n + miss, fxw, 1) - LQ.overallTime(n, fxw, 1);
    $('g-ext-hint').textContent = 'auto: ' + extAuto + ' d';
    const extIn = val('g-ext');
    const ext = isFinite(extIn) ? extIn : extAuto;
    const remIn = val('g-rem');
    const remaining = isFinite(remIn) && remIn > 0 ? Math.min(Math.round(remIn), n - del) : null;

    const repair = { dt: req('g-dt', { min: 0 }), halfTimeT: req('g-thT', { min: 0, allowZero: false }), halfTimeL: req('g-thL', { min: 0, allowZero: false }) };
    const repairOk = [repair.dt, repair.halfTimeT, repair.halfTimeL].every(isFinite);
    const g = LQ.gapCompensation({ d, n, abT, abL, Tk, dprolif: dp, delivered: del, extension: ext, fxPerWeek: fxw, T0, remainingFx: remaining,
      missed: miss, repair: repairOk ? repair : null });
    const P = g.plan;

    function dl(o) {
      return '<dl>' +
        '<dt>' + tx('Gesamtzeit') + '</dt><dd>' + fmtInput(o.T) + ' d' + (o.T !== P.T ? ' (' + signed(o.T - P.T, 0) + ')' : '') + '</dd>' +
        '<dt>' + tx('EQD2 Tumor') + '</dt><dd>' + fmt(o.eqd2T) + ' <span class="' + (o.eqd2T < P.eqd2T - 0.05 ? 'pos' : '') + '">(' + signed(o.eqd2T - P.eqd2T) + ')</span></dd>' +
        '<dt>' + tx('EQD2 spät') + ' (α/β ' + fmtInput(abL) + ')</dt><dd>' + fmt(o.eqd2L) + ' <span class="' + (o.eqd2L > P.eqd2L + 0.05 ? 'pos' : '') + '">(' + signed(o.eqd2L - P.eqd2L) + ')</span></dd>' +
        '</dl>';
    }

    let h = '';
    h += '<div class="results" style="margin-bottom:14px">' +
      metric(tx('Plan EQD2 Tumor'), fmt(P.eqd2T), 'Gy', { main: true, sub: tx('zeitkorrigiert') + ', T = ' + fmtInput(P.T) + ' d' }) +
      metric(tx('Plan EQD2 spät'), fmt(P.eqd2L), 'Gy', { sub: 'α/β ' + fmtInput(abL) }) +
      metric(tx('Defizit ohne Ausgleich'), fmt(g.none.deficitEqd2), 'Gy EQD2', { sub: 'K = ' + fmt(g.K) + ' Gy BED/d' }) +
      '</div>';

    if (ext <= 0 || dp === 0 || T0 + ext <= Tk) {
      h += '<div class="callout info">' + tx('Unter den gewählten Parametern entsteht durch die Verlängerung kein Repopulationsdefizit') +
        (T0 + ext <= Tk ? ' (' + tx('Behandlungsende vor T<sub>k</sub>') + ')' : '') + '. ' + tx('Die ausgefallenen Fraktionen können angehängt werden.') + '</div>';
    }

    h += '<div class="options">';
    h += '<div class="option best"><h4>' + tx('A · Gesamtzeit einhalten') + ' <span class="tag good">' + tx('bevorzugt') + '</span></h4>' +
      '<p>' + tx('{0} ausgefallene Fx zusätzlich am Wochenende oder als 2. Fraktion am Tag (≥ 6 h Abstand) innerhalb der geplanten Zeit nachholen. Einzeldosis {1} Gy unverändert.', fmtInput(miss), fmtInput(d)) + '</p>' +
      '<div class="lbl" style="margin:6px 0 2px">' + tx('am Wochenende/Feiertag') + '</div>' + dl(g.keepTime) +
      (g.keepTimeBid ? '<div class="lbl" style="margin:8px 0 2px">' + tx('als 2× täglich (Δt {0} h, unvollst. Reparatur)', fmtInput(repair.dt)) + '</div>' + dl(g.keepTimeBid) : '') +
      '</div>';

    if (g.hypo) {
      const o = g.hypo;
      h += '<div class="option"><h4>' + tx('B · Einzeldosis erhöhen') + '</h4>' +
        '<p>' + tx('Die {0} nachfolgenden Fx mit <strong>{1} Gy</strong> statt {2} Gy; Ende um {3} d verschoben. Gesamtdosis {4} Gy.', o.remaining, fmt(o.dNew), fmtInput(d), fmtInput(ext), fmt(o.D)) + '</p>' +
        dl(o) + '</div>';
    }

    h += '<div class="option"><h4>' + tx('C · Zusatzfraktionen anhängen') + '</h4>' +
      '<p>' + (g.addFx.extraFx ? tx('<strong>{0} zusätzliche Fx</strong> à {1} Gy (Gesamt {2} Gy). Jede weitere Fx verlängert die Behandlung erneut.', g.addFx.extraFx, fmtInput(d), fmt((n + g.addFx.extraFx) * d)) : tx('Keine zusätzlichen Fraktionen nötig.')) + '</p>' +
      dl(g.addFx) + '</div>';

    h += '<div class="option"><h4>' + tx('D · Ohne Kompensation') + '</h4>' +
      '<p>' + tx('Ausgefallene Fx werden einfach angehängt (Ende +{0} d).', fmtInput(ext)) + '</p>' +
      dl(g.none) + '</div>';
    h += '</div>';

    if (g.hypo && g.hypo.eqd2L - P.eqd2L > 1) {
      h += '<div class="callout">' + tx('Option B erhöht die EQD2 im spät reagierenden Gewebe um {0} Gy. Toleranzdosen der relevanten Risikoorgane prüfen; ggf. Kompensation auf mehr Fraktionen verteilen oder mit Option A kombinieren.', fmt(g.hypo.eqd2L - P.eqd2L)) + '</div>';
    }
    out.innerHTML = h;
  }

  /* ======================================================================
   * Referenztabelle
   * ==================================================================== */

  function renderRef() {
    let h = '<thead><tr><th>' + tx('Gewebe') + '</th><th>α/β [Gy]</th><th>' + tx('Bereich') + '</th></tr></thead><tbody>';
    DATA.alphaBeta.forEach((g, gi) => {
      h += '<tr><td class="txt" colspan="3" style="font-weight:600;padding-top:14px">' + esc(tx(g.group)) + '</td></tr>';
      g.items.forEach((it, ii) => {
        h += '<tr data-ref="' + gi + '|' + ii + '" style="cursor:pointer" title="' + tx('In den Rechner übernehmen') + '"><td class="txt">' + esc(tx(it.name)) + '</td><td>' + fmtInput(it.ab) + '</td><td class="txt" style="text-align:right">' + esc(tx(it.range)) + '</td></tr>';
      });
    });
    $('r-abtable').innerHTML = h + '</tbody>';
  }

  function wireRef() {
    $('r-abtable').addEventListener('click', e => {
      const tr = e.target.closest('tr[data-ref]');
      if (!tr) return;
      $('c-preset').value = tr.dataset.ref;
      $('c-preset').dispatchEvent(new Event('change'));
      showTab('calc');
      toast(tx('α/β übernommen'));
    });
  }

  /* ======================================================================
   * Zustand: Speichern, Teilen, Tabs, Theme
   * ==================================================================== */

  function collectState(forShare) {
    const fields = {};
    document.querySelectorAll('main input[id], main select[id]').forEach(el => {
      if (el.readOnly || el.type === 'file' || el.dataset.nopersist != null) return;
      fields[el.id] = el.type === 'checkbox' ? el.checked : el.value;
    });
    const tab = document.querySelector('nav.tabs [aria-selected="true"]').dataset.tab;
    const ext = {};
    modules.forEach(m => { if (m.getState) ext[m.name] = m.getState(!!forShare); });
    return { v: 1, fields, series, tissues, calcOrder, tab, ext };
  }

  function applyState(st) {
    if (!st || st.v !== 1) return;
    Object.entries(st.fields || {}).forEach(([id, v]) => {
      const el = $(id);
      if (!el || el.type === 'file') return;
      if (el.type === 'checkbox') el.checked = !!v; else el.value = v;
    });
    if (Array.isArray(st.series)) series = st.series;
    if (Array.isArray(st.tissues)) tissues = st.tissues;
    if (Array.isArray(st.calcOrder) && st.calcOrder.length === 2) calcOrder = st.calcOrder;
    if (st.ext) modules.forEach(m => { if (m.setState && st.ext[m.name] != null) m.setState(st.ext[m.name]); });
    if (st.tab && document.querySelector('nav.tabs [data-tab="' + st.tab + '"]')) showTab(st.tab, true);
  }

  function encodeState(st) {
    return btoa(unescape(encodeURIComponent(JSON.stringify(st)))).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
  }
  function decodeState(s) {
    s = s.replace(/-/g, '+').replace(/_/g, '/');
    return JSON.parse(decodeURIComponent(escape(atob(s))));
  }

  let saveTimer;
  function save() {
    clearTimeout(saveTimer);
    saveTimer = setTimeout(() => {
      try { localStorage.setItem(STORE_KEY, JSON.stringify(collectState())); } catch (e) { /* Speicher nicht verfügbar */ }
    }, 300);
  }

  function load() {
    const m = location.hash.match(/^#s=(.+)$/);
    if (m) {
      try { applyState(decodeState(m[1])); history.replaceState(null, '', location.pathname + location.search); return; } catch (e) { /* ungültiger Link */ }
    }
    try { applyState(JSON.parse(localStorage.getItem(STORE_KEY))); } catch (e) { /* nichts gespeichert */ }
  }

  function showTab(name, silent) {
    document.querySelectorAll('nav.tabs button').forEach(b => b.setAttribute('aria-selected', String(b.dataset.tab === name)));
    document.querySelectorAll('section.panel').forEach(p => p.classList.toggle('active', p.id === 'panel-' + name));
    if (!silent) save();
  }

  function initTheme() {
    let t = null;
    try { t = localStorage.getItem(STORE_KEY + '-theme'); } catch (e) { /* */ }
    if (t) document.documentElement.dataset.theme = t;
    $('btn-theme').addEventListener('click', () => {
      const cur = document.documentElement.dataset.theme ||
        (matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light');
      const next = cur === 'dark' ? 'light' : 'dark';
      document.documentElement.dataset.theme = next;
      try { localStorage.setItem(STORE_KEY + '-theme', next); } catch (e) { /* */ }
    });
  }

  function initLang() {
    const btn = $('btn-lang');
    const label = () => { btn.textContent = window.I18N.lang === 'en' ? 'DE' : 'EN'; btn.title = window.I18N.lang === 'en' ? 'Auf Deutsch umschalten' : 'Switch to English'; };
    window.I18N.apply();
    label();
    btn.addEventListener('click', () => {
      window.I18N.setLang(window.I18N.lang === 'en' ? 'de' : 'en');
      window.I18N.apply();
      label();
      series.forEach(s => { s.label = window.I18N.retranslate(s.label); });
      tissues.forEach(t => { t.name = window.I18N.retranslate(t.name); });
      fillAbPresets(); fillRepPresets(); fillThPresets();
      modules.forEach(m => m.relabel && m.relabel());
      renderRef(); renderSeriesTable(); renderTissueTable();
      renderAll();
    });
  }

  function renderAll() {
    renderCalc();
    renderSum();
    renderIso();
    renderGap();
    modules.forEach(m => m.render && m.render());
  }

  /* ---------- Initialisierung ---------- */

  function init() {
    fillAbPresets();
    fillRepPresets();
    fillThPresets();
    modules.forEach(m => m.setup && m.setup());
    wirePresets();
    renderRef();
    wireRef();
    initTheme();
    initLang();
    load();
    series.forEach(s => { s.label = window.I18N.retranslate(s.label); });
    tissues.forEach(t => { t.name = window.I18N.retranslate(t.name); });
    renderSeriesTable();
    renderTissueTable();

    // Rechner
    ['d', 'n', 'D'].forEach(k => $('c-' + k).addEventListener('input', () => {
      calcOrder = [k].concat(calcOrder.filter(x => x !== k)).slice(0, 2);
    }));
    $('panel-calc').addEventListener('input', () => { renderCalc(); save(); });
    $('panel-calc').addEventListener('change', () => { renderCalc(); save(); });

    // Summation (fehlt in der Basis-Webversion)
    if ($('panel-sum')) {
    $('s-series').addEventListener('input', e => {
      const i = e.target.dataset.i;
      if (i == null) return;
      series[+i][e.target.dataset.k] = e.target.value;
      renderSum(); save();
    });
    $('s-series').addEventListener('click', e => {
      const b = e.target.closest('[data-del]');
      if (!b) return;
      series.splice(+b.dataset.del, 1);
      renderSeriesTable(); renderSum(); save();
    });
    $('s-add').addEventListener('click', () => {
      series.push({ label: tx('Serie') + ' ' + (series.length + 1), d: '2', n: '5', bid: '', rec: '0' });
      renderSeriesTable(); renderSum(); save();
    });
    $('s-add-brachy').addEventListener('click', () => {
      series.push({ label: 'HDR-Brachy', d: '7', n: '4', bid: '', rec: '0' });
      renderSeriesTable(); renderSum(); save();
    });
    $('s-tissues').addEventListener('input', e => {
      const i = e.target.dataset.ti;
      if (i == null) return;
      tissues[+i][e.target.dataset.k] = e.target.type === 'checkbox' ? e.target.checked : e.target.value;
      renderSum(); save();
    });
    $('s-tissues').addEventListener('click', e => {
      const b = e.target.closest('[data-tdel]');
      if (!b) return;
      tissues.splice(+b.dataset.tdel, 1);
      renderTissueTable(); renderSum(); save();
    });
    $('s-tadd').addEventListener('click', () => {
      tissues.push({ name: tx('Struktur') + ' ' + (tissues.length + 1), ab: '3', th: '1,5', time: false, limit: '' });
      renderTissueTable(); renderSum(); save();
    });
    $('s-tpreset').addEventListener('change', e => {
      const p = abPreset(e.target.value);
      if (!p) return;
      tissues.push({ name: tx(p.name), ab: fmtInput(p.ab), th: p.ab >= 6 ? '0,5' : (/Rückenmark|Gehirn|Hirnstamm|opticus|Plexus/.test(p.name) ? '4' : '1,5'), time: false, limit: p.limit ? fmtInput(p.limit) : '' });
      e.target.value = '';
      renderTissueTable(); renderSum(); save();
    });
    ['s-T', 's-tk', 's-dp', 's-rep', 's-unc', 's-unc-ab', 's-unc-tk', 's-unc-dp', 's-unc-th'].forEach(id => ['input', 'change'].forEach(ev => $(id).addEventListener(ev, () => { renderSum(); save(); })));
    $('s-rep').addEventListener('change', () => { renderSum(); save(); });
    }

    // Umrechnung
    $('i-n2').addEventListener('input', () => { if ($('i-n2').value.trim()) $('i-d2').value = ''; });
    $('i-d2').addEventListener('input', () => { if ($('i-d2').value.trim()) $('i-n2').value = ''; });
    $('panel-iso').addEventListener('input', () => { renderIso(); save(); });
    $('panel-iso').addEventListener('change', () => { renderIso(); save(); });

    // Pausen
    if ($('panel-gap')) {
      $('panel-gap').addEventListener('input', () => { renderGap(); save(); });
      $('panel-gap').addEventListener('change', () => { renderGap(); save(); });
    }

    // Tabs & Aktionen
    document.querySelectorAll('nav.tabs button').forEach(b => b.addEventListener('click', () => showTab(b.dataset.tab)));
    $('btn-print').addEventListener('click', () => window.print());
    $('btn-reset').addEventListener('click', () => {
      if (!confirm(tx('Alle Eingaben auf die Standardwerte zurücksetzen?'))) return;
      clearTimeout(saveTimer);
      try { localStorage.removeItem(STORE_KEY); } catch (e) { /* */ }
      location.reload();
    });
    $('btn-share').addEventListener('click', () => {
      const url = location.origin + location.pathname + '#s=' + encodeState(collectState(true));
      const done = () => toast(tx('Link mit allen Eingaben kopiert'));
      if (navigator.clipboard && window.isSecureContext) {
        navigator.clipboard.writeText(url).then(done, () => prompt(tx('Link kopieren:'), url));
      } else {
        prompt(tx('Link kopieren:'), url);
      }
    });

    renderAll();
  }

  /* ---------- Schnittstelle für Zusatzmodule (app-ext.js) ---------- */

  const modules = [];

  /** Liniendiagramm als SVG. o: { xMin, xMax, yMin, yMax, xLabel, yLabel, series: [{pts, color, dash}], markers, vlines, W, H } */
  function linePlot(svg, o) {
    const W = o.W || 560, H = o.H || 300, m = { l: 50, r: 14, t: 12, b: 38 };
    const xMin = o.xMin || 0, yMin = o.yMin || 0;
    const xMax = o.xMax, yMax = o.yMax;
    const sx = x => m.l + (x - xMin) / (xMax - xMin) * (W - m.l - m.r);
    const sy = y => H - m.b - (y - yMin) / (yMax - yMin) * (H - m.t - m.b);
    const ys = o.yStep || niceStep((yMax - yMin) / 5), xs = o.xStep || niceStep((xMax - xMin) / 8);
    const yf = o.yFmt || fmtInput;
    let g = '<g class="grid">';
    for (let y = yMin; y <= yMax + 1e-9; y += ys) {
      g += '<line x1="' + m.l + '" x2="' + (W - m.r) + '" y1="' + sy(y) + '" y2="' + sy(y) + '"/>';
      g += '<text x="' + (m.l - 6) + '" y="' + (sy(y) + 4) + '" text-anchor="end">' + yf(Math.round(y * 1e6) / 1e6) + '</text>';
    }
    for (let x = Math.ceil(xMin / xs) * xs; x <= xMax + 1e-9; x += xs) {
      g += '<text x="' + sx(x) + '" y="' + (H - m.b + 16) + '" text-anchor="middle">' + fmtInput(Math.round(x * 1e6) / 1e6) + '</text>';
    }
    g += '</g>';
    g += '<line class="axis" x1="' + m.l + '" x2="' + m.l + '" y1="' + m.t + '" y2="' + (H - m.b) + '"/>';
    g += '<line class="axis" x1="' + m.l + '" x2="' + (W - m.r) + '" y1="' + (H - m.b) + '" y2="' + (H - m.b) + '"/>';
    g += '<text x="' + ((W + m.l) / 2) + '" y="' + (H - 4) + '" text-anchor="middle">' + o.xLabel + '</text>';
    g += '<text transform="translate(12 ' + ((H - m.b + m.t) / 2) + ') rotate(-90)" text-anchor="middle">' + o.yLabel + '</text>';
    const cid = 'clip-' + svg.id;
    g += '<defs><clipPath id="' + cid + '"><rect x="' + m.l + '" y="' + m.t + '" width="' + (W - m.l - m.r) + '" height="' + (H - m.t - m.b) + '"/></clipPath></defs>';
    (o.vlines || []).forEach(v => {
      if (v.x < xMin || v.x > xMax) return;
      g += '<line x1="' + sx(v.x) + '" x2="' + sx(v.x) + '" y1="' + m.t + '" y2="' + (H - m.b) + '" stroke="var(--muted)" stroke-dasharray="4 4"/>';
      if (v.label) g += '<text x="' + (sx(v.x) + 4) + '" y="' + (m.t + 12) + '">' + v.label + '</text>';
    });
    (o.series || []).forEach(s => {
      if (!s.pts.length) return;
      const dAttr = s.pts.map((p, j) => (j ? 'L' : 'M') + sx(p[0]).toFixed(1) + ' ' + sy(p[1]).toFixed(1)).join(' ');
      g += '<path d="' + dAttr + '" fill="none" stroke="' + s.color + '" stroke-width="' + (s.width || 2.2) + '"' + (s.dash ? ' stroke-dasharray="' + s.dash + '"' : '') + ' clip-path="url(#' + cid + ')"/>';
    });
    (o.markers || []).forEach(k => {
      if (!(k.x >= xMin && k.x <= xMax && k.y >= yMin && k.y <= yMax)) return;
      g += '<circle cx="' + sx(k.x) + '" cy="' + sy(k.y) + '" r="5" fill="var(--surface)" stroke="' + (k.color || 'var(--text)') + '" stroke-width="2"/>';
      if (k.label) g += '<text x="' + (sx(k.x) + 8) + '" y="' + (sy(k.y) - 8) + '" style="fill:var(--text)">' + k.label + '</text>';
    });
    svg.innerHTML = g;
  }

  window.RO = {
    register: m => modules.push(m),
    $, parse, val, req, fmt, fmtInput, signed, esc, metric, toast, niceStep, linePlot,
    save: () => save(), showTab: (t) => showTab(t), addSeries: (s) => addSeries(s),
    abPreset
  };

  document.addEventListener('DOMContentLoaded', init);
})();
