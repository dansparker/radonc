/*!
 * lq.js – Rechenkern für das linear-quadratische (LQ) Modell in der Radioonkologie.
 *
 * Reine Funktionen ohne DOM-Abhängigkeit. Läuft im Browser (window.LQ) und in Node (module.exports).
 *
 * Konventionen:
 *   d   – Einzeldosis pro Fraktion [Gy]
 *   n   – Anzahl Fraktionen
 *   D   – Gesamtdosis = n·d [Gy]
 *   ab  – α/β-Verhältnis [Gy]
 *   T   – Gesamtbehandlungszeit [Tage], gezählt vom ersten bis zum letzten Bestrahlungstag
 *   Tk  – Kickoff-Zeit (Beginn der akzelerierten Repopulierung) [Tage]
 *   Dprolif – Repopulationsausgleich in EQD2-Gy pro Tag nach Tk
 *
 * Formeln:
 *   BED   = n·d·(1 + d/ab) − K·max(0, T − Tk),   K = Dprolif·(1 + 2/ab)  (BED-Gy/Tag)
 *   EQDx  = BED / (1 + x/ab)
 *   LQ-L (Astrahan 2008), für d > dT:
 *     BED/Fraktion = dT·(1 + dT/ab) + (1 + 2·dT/ab)·(d − dT)
 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.LQ = factory();
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  const LN2 = Math.log(2);

  function assertPositive(name, v) {
    if (!(typeof v === 'number' && isFinite(v) && v > 0)) {
      throw new RangeError(name + ' muss eine positive Zahl sein');
    }
  }

  /** BED einer Fraktion (ohne Zeitfaktor). Optional LQ-L oberhalb der Transitionsdosis dT. */
  function bedPerFraction(d, ab, opts) {
    assertPositive('α/β', ab);
    if (d < 0) throw new RangeError('Einzeldosis darf nicht negativ sein');
    const dT = opts && opts.lql && opts.dT > 0 ? opts.dT : null;
    if (dT !== null && d > dT) {
      return dT * (1 + dT / ab) + (1 + 2 * dT / ab) * (d - dT);
    }
    return d * (1 + d / ab);
  }

  /** Repopulationsverlust in BED-Gy/Tag aus Dprolif (EQD2-Gy/Tag). */
  function kFromDprolif(dprolif, ab) {
    return dprolif * (1 + 2 / ab);
  }

  /** Repopulationsverlust in BED-Gy/Tag aus α und potentieller Verdopplungszeit Tpot. */
  function kFromTpot(alpha, tpot) {
    assertPositive('α', alpha);
    assertPositive('Tpot', tpot);
    return LN2 / (alpha * tpot);
  }

  /** BED-Abzug durch Repopulierung. time = { T, Tk, dprolif } */
  function repopulationLoss(ab, time) {
    if (!time || !time.enabled) return 0;
    const over = Math.max(0, time.T - time.Tk);
    return kFromDprolif(time.dprolif, ab) * over;
  }

  /* ---------- Unvollständige Reparatur (max. 2 Fraktionen pro Tag) ---------- */

  /** Anteil des nicht reparierten Subletalschadens nach Δt Stunden (Thames: h₂ = θ = e^(−μΔt)). */
  function repairTheta(dtHours, halfTimeHours) {
    if (!(halfTimeHours > 0) || !(dtHours >= 0)) return 0;
    return Math.exp(-LN2 * dtHours / halfTimeHours);
  }

  /** Zusätzliche BED durch unvollständige Reparatur bei `pairs` Tagen mit 2 Fraktionen à d. */
  function incompleteRepairExcess(d, pairs, ab, theta) {
    return pairs * 2 * theta * d * d / ab;
  }

  /* ---------- Protrahierte Bestrahlung (LDR/PDR) – Lea-Catcheside-Integral ---------- */

  function selfTerm(mu, T) {
    const x = mu * T;
    if (x < 1e-4) return T * T * (0.5 - x / 6 + x * x / 24);
    return (x + Math.expm1(-x)) / (mu * mu);
  }

  /**
   * BED für eine Folge von Segmenten konstanter Dosisleistung (exakte Lösung, Dale/Thames).
   * segs: [{ start [h], duration [h], rate [Gy/h] }], nicht überlappend.
   * Akute Fraktionen: duration → 0. Ohne Reparaturzeit (halfTime = ∞) → reines LQ.
   */
  function bedFromSegments(segs, ab, halfTimeHours) {
    assertPositive('α/β', ab);
    const s = segs.slice().sort((a, b) => a.start - b.start);
    const mu = halfTimeHours > 0 && isFinite(halfTimeHours) ? LN2 / halfTimeHours : 0;
    let D = 0, S = 0;
    for (let i = 0; i < s.length; i++) {
      const Ti = s[i].duration, Ri = s[i].rate;
      const Di = Ri * Ti;
      D += Di;
      if (mu === 0) {
        S += Di * Di / 2;
        for (let j = 0; j < i; j++) S += Di * s[j].rate * s[j].duration;
        continue;
      }
      S += Ri * Ri * selfTerm(mu, Ti);
      const fi = Ti > 0 ? -Math.expm1(-mu * Ti) / (mu * Ti) : 1; // Abklingfaktor relativ zur Dosis
      for (let j = 0; j < i; j++) {
        const Tj = s[j].duration;
        const fj = Tj > 0 ? -Math.expm1(-mu * Tj) / (mu * Tj) : 1;
        const gap = Math.max(0, s[i].start - (s[j].start + Tj));
        S += Di * (s[j].rate * Tj) * fi * fj * Math.exp(-mu * gap);
      }
    }
    return { D, bed: D + 2 * S / ab };
  }

  /**
   * Segmente für Brachytherapie-Schemata.
   * spec.mode = 'ldr': { rate [Gy/h], hours }
   *           = 'pdr': { pulseDose, pulses, period [h], pulseMin }
   *           = 'hdr': { d, fxPerApp (1|2), interval [h], fxMin? }
   * gemeinsam: apps (Applikationen), appGapDays (Abstand), scale (Dosisanteil am Punkt, 1 = 100 %)
   */
  function brachySegments(spec) {
    const apps = Math.max(1, Math.round(spec.apps || 1));
    const gapH = (spec.appGapDays || 0) * 24;
    const k = spec.scale != null ? spec.scale : 1;
    const segs = [];
    for (let a = 0; a < apps; a++) {
      let t0 = 0;
      if (spec.mode === 'ldr') {
        segs.push({ start: 0, duration: spec.hours, rate: spec.rate * k });
        t0 = spec.hours;
      } else if (spec.mode === 'pdr') {
        const dur = (spec.pulseMin || 10) / 60;
        for (let p = 0; p < spec.pulses; p++) segs.push({ start: p * spec.period, duration: dur, rate: spec.pulseDose * k / dur });
        t0 = (spec.pulses - 1) * spec.period + dur;
      } else {
        const dur = (spec.fxMin || 10) / 60;
        const m = Math.min(2, Math.max(1, Math.round(spec.fxPerApp || 1)));
        for (let p = 0; p < m; p++) segs.push({ start: p * (spec.interval || 6), duration: dur, rate: spec.d * k / dur });
        t0 = (m - 1) * (spec.interval || 6) + dur;
      }
      // Applikationen hintereinander: Abstand = Beginn zu Beginn (mind. Ende der vorherigen)
      const offset = a * Math.max(gapH, t0);
      if (a > 0) {
        const per = spec.mode === 'pdr' ? spec.pulses : spec.mode === 'ldr' ? 1 : Math.min(2, Math.max(1, Math.round(spec.fxPerApp || 1)));
        for (let q = segs.length - per; q < segs.length; q++) segs[q].start += offset;
      }
    }
    return segs;
  }

  /** Brachytherapie auswerten: BED/EQD2 mit und ohne Reparaturkorrektur. */
  function evaluateBrachy(spec, ab, halfTimeHours) {
    const segs = brachySegments(spec);
    const r = bedFromSegments(segs, ab, halfTimeHours);
    const acute = bedFromSegments(segs, ab, Infinity);
    return {
      D: r.D,
      bed: r.bed,
      eqd2: r.bed / (1 + 2 / ab),
      bedAcute: acute.bed,
      g: r.D > 0 ? (r.bed - r.D) * ab / (r.D * r.D) : 0, // Lea-Catcheside-Faktor (gesamt)
      segments: segs.length
    };
  }

  /* ---------- Re-Bestrahlung ---------- */

  /** Erholungsanteil [0..1] aus stückweise linearer Kurve [[Monate, %], …] (Plateau nach letztem Punkt). */
  function recoveryFromCurve(months, points) {
    if (!points || !points.length || !(months >= 0)) return 0;
    const p = points.slice().sort((a, b) => a[0] - b[0]);
    if (months <= p[0][0]) return p[0][1] / 100;
    for (let i = 1; i < p.length; i++) {
      if (months <= p[i][0]) {
        const f = (months - p[i - 1][0]) / (p[i][0] - p[i - 1][0]);
        return (p[i - 1][1] + f * (p[i][1] - p[i - 1][1])) / 100;
      }
    }
    return p[p.length - 1][1] / 100;
  }

  /**
   * Re-Bestrahlung eines Risikoorgans mit einer oder mehreren Vorbestrahlungen.
   * p: { priors: [{ d, n, recovery (0..1) }] | prior: {d, n} + recovery,
   *      ab, limitEqd2, next: {d, n} }
   */
  function reirradiation(p) {
    const { ab } = p;
    const priors = p.priors || [Object.assign({}, p.prior, { recovery: p.recovery || 0 })];
    const courses = priors.map(c => {
      const bed = c.n * c.d * (1 + c.d / ab);
      const eqd2 = bed / (1 + 2 / ab);
      return { bed, eqd2, recovery: c.recovery || 0, effEqd2: eqd2 * (1 - (c.recovery || 0)) };
    });
    const priorBed = courses.reduce((a, c) => a + c.bed, 0);
    const priorEqd2 = courses.reduce((a, c) => a + c.eqd2, 0);
    const effPriorEqd2 = courses.reduce((a, c) => a + c.effEqd2, 0);
    const budget = p.limitEqd2 - effPriorEqd2;
    const res = { courses, priorBed, priorEqd2, effPriorEqd2, budget };
    if (p.next) {
      const nb = p.next.n * p.next.d * (1 + p.next.d / ab);
      res.nextBed = nb;
      res.nextEqd2 = nb / (1 + 2 / ab);
      res.cumEqd2 = priorEqd2 + res.nextEqd2;
      res.cumEffEqd2 = effPriorEqd2 + res.nextEqd2;
      res.cumBed = priorBed + nb;
      const budgetBed = Math.max(0, budget) * (1 + 2 / ab);
      res.maxN = p.next.d > 0 ? budgetBed / (p.next.d * (1 + p.next.d / ab)) : NaN;
      res.maxD = p.next.n > 0 ? dForBed(budgetBed, p.next.n, ab) : NaN;
    }
    return res;
  }

  /** Nieder et al. 2006 (Rückenmark, α/β = 2): geringes Risiko, wenn alle drei Kriterien erfüllt sind. */
  function niederCheck(priorBed2, nextBed2, intervalMonths) {
    return niederCheckMulti([priorBed2, nextBed2], [intervalMonths]);
  }

  /** Nieder-Kriterien für beliebig viele Serien: BED₂ je Serie, Intervalle zwischen aufeinanderfolgenden Serien [Monate]. */
  function niederCheckMulti(beds, gaps) {
    return {
      cumulative: beds.reduce((a, b) => a + b, 0) <= 135.5,
      course: Math.max.apply(null, beds) <= 98,
      interval: gaps.every(g => g >= 6)
    };
  }

  /* ---------- Unsicherheit ---------- */

  /**
   * Wertebereich von fn über Parameterintervalle (Gittersuche, inkl. Eckpunkte).
   * base: Parameterobjekt; ranges: { key: [lo, hi] }. Liefert { value, min, max, sens: [{key, lo, hi}] }.
   * sens: Wert von fn, wenn nur dieser Parameter auf lo bzw. hi gesetzt wird (Tornado-Diagramm).
   */
  function rangeEval(fn, base, ranges, steps) {
    const keys = Object.keys(ranges).filter(k => {
      const r = ranges[k];
      return r && isFinite(r[0]) && isFinite(r[1]) && r[0] !== r[1];
    });
    const value = fn(base);
    let min = value, max = value;
    const k = keys.length;
    steps = steps || (k <= 2 ? 9 : k <= 3 ? 7 : 5);
    const total = Math.pow(steps, k);
    for (let i = 0; i < total; i++) {
      const q = Object.assign({}, base);
      let rest = i;
      for (let j = 0; j < k; j++) {
        const r = ranges[keys[j]], s = rest % steps;
        rest = Math.floor(rest / steps);
        q[keys[j]] = r[0] + (r[1] - r[0]) * s / (steps - 1);
      }
      const v = fn(q);
      if (isFinite(v)) { if (v < min) min = v; if (v > max) max = v; }
    }
    const sens = keys.map(key => {
      const lo = fn(Object.assign({}, base, { [key]: ranges[key][0] }));
      const hi = fn(Object.assign({}, base, { [key]: ranges[key][1] }));
      return { key, lo, hi, span: Math.abs(hi - lo) };
    }).sort((a, b) => b.span - a.span);
    return { value, min, max, sens };
  }

  /**
   * Vollständige Auswertung eines Schemas.
   * @param {object} p { d, n, ab, x?, lql?, dT?, time?: {enabled, T, Tk, dprolif},
   *                     repair?: {pairs, dt [h], halfTime [h]} }
   */
  function evaluate(p) {
    const { d, n, ab } = p;
    assertPositive('α/β', ab);
    let bedNoTime = n * bedPerFraction(d, ab, p);
    let repairExcess = 0;
    if (p.repair && p.repair.pairs > 0) {
      repairExcess = incompleteRepairExcess(d, p.repair.pairs, ab, repairTheta(p.repair.dt, p.repair.halfTime));
      bedNoTime += repairExcess;
    }
    const loss = repopulationLoss(ab, p.time);
    const bed = bedNoTime - loss;
    const x = p.x != null ? p.x : 2;
    return {
      D: n * d,
      bedNoTime,
      repairExcess,
      loss,
      bed,
      eqd2: bed / (1 + 2 / ab),
      eqdx: bed / (1 + x / ab),
      eqd2NoTime: bedNoTime / (1 + 2 / ab),
      re: bed / (n * d) // relative Effektivität
    };
  }

  /** EQDx aus BED. */
  function eqdFromBed(bed, ab, x) {
    return bed / (1 + x / ab);
  }

  /** BED aus EQDx. */
  function bedFromEqd(eqd, ab, x) {
    return eqd * (1 + x / ab);
  }

  /** Einzeldosis d, die mit n Fraktionen die Ziel-BED (ohne Zeitfaktor, LQ) ergibt. */
  function dForBed(bed, n, ab) {
    assertPositive('n', n);
    if (bed <= 0) return 0;
    // d²/ab + d − bed/n = 0
    return (ab / 2) * (-1 + Math.sqrt(1 + (4 * bed) / (n * ab)));
  }

  /** Einzeldosis d für Ziel-BED, mit optionalem LQ-L. */
  function dForBedGeneral(bed, n, ab, opts) {
    const dLQ = dForBed(bed, n, ab);
    if (!(opts && opts.lql && opts.dT > 0) || dLQ <= opts.dT) return dLQ;
    // linearer Ast: bed/n = b0 + s·(d − dT)
    const dT = opts.dT;
    const b0 = dT * (1 + dT / ab);
    const s = 1 + 2 * dT / ab;
    return dT + (bed / n - b0) / s;
  }

  /** (Reelle) Fraktionszahl n, die mit Einzeldosis d die Ziel-BED (ohne Zeitfaktor) ergibt. */
  function nForBed(bed, d, ab, opts) {
    const per = bedPerFraction(d, ab, opts);
    if (per <= 0) return Infinity;
    return bed / per;
  }

  /** Isoeffektive Gesamtdosis bei neuer Einzeldosis d2 (Withers-Formel, ohne Zeitfaktor). */
  function isoeffectiveDose(D1, d1, d2, ab) {
    return D1 * (ab + d1) / (ab + d2);
  }

  /**
   * Gesamtbehandlungszeit T (Tage zwischen erster und letzter Fraktion)
   * bei fxPerWeek Fraktionen pro Woche (an aufeinanderfolgenden Werktagen, Start Montag)
   * und fxPerDay Fraktionen pro Behandlungstag.
   */
  function overallTime(n, fxPerWeek, fxPerDay) {
    fxPerWeek = fxPerWeek || 5;
    fxPerDay = fxPerDay || 1;
    if (n <= 0) return 0;
    const treatDays = Math.ceil(n / fxPerDay);
    const k = treatDays - 1; // Index des letzten Behandlungstags
    if (fxPerWeek >= 7) return k;
    return Math.floor(k / fxPerWeek) * 7 + (k % fxPerWeek);
  }

  /** BED einer Serie: perkutan (d, n, optional 2× tgl. mit Intervall) oder Brachytherapie (spec). */
  function seriesBed(s, ab, halfTime) {
    if (s.type === 'brachy') {
      const r = bedFromSegments(brachySegments(s.spec), ab, halfTime);
      return { D: r.D, bed: r.bed };
    }
    let bed = s.n * bedPerFraction(s.d, ab, s);
    if (s.interval > 0 && halfTime > 0) {
      bed += incompleteRepairExcess(s.d, Math.floor(s.n / 2), ab, repairTheta(s.interval, halfTime));
    }
    return { D: s.n * s.d, bed };
  }

  /**
   * Summation mehrerer Serien für ein Gewebe (ein α/β).
   * series: [{ d, n, interval? [h, 2× tgl.], recovery? (0..1), lql?, dT? } | { type: 'brachy', spec, recovery? }]
   * time: optionaler Zeitfaktor auf die Summe (nur sinnvoll für zusammenhängende Kurse, z. B. Boost).
   * halfTime: Reparaturhalbwertszeit des Gewebes [h] (für 2× tgl. und Brachytherapie).
   */
  function sumSeries(series, ab, time, x, halfTime) {
    x = x != null ? x : 2;
    halfTime = halfTime != null ? halfTime : 1.5;
    let bedSum = 0, physSum = 0;
    const rows = series.map(s => {
      const sb = seriesBed(s, ab, halfTime);
      const bed = sb.bed;
      const f = 1 - (s.recovery || 0);
      const bedEff = bed * f;
      bedSum += bedEff;
      physSum += sb.D;
      return {
        D: sb.D,
        bed,
        bedEff,
        eqd2: bed / (1 + 2 / ab),
        eqd2Eff: bedEff / (1 + 2 / ab)
      };
    });
    const loss = repopulationLoss(ab, time);
    const bed = bedSum - loss;
    return {
      rows,
      D: physSum,
      bedNoTime: bedSum,
      loss,
      bed,
      eqd2: bed / (1 + 2 / ab),
      eqdx: bed / (1 + x / ab)
    };
  }

  /**
   * Pausenkompensation.
   * p: {
   *   d, n                – geplantes Schema
   *   abT, abL            – α/β Tumor / spät reagierendes Normalgewebe
   *   Tk, dprolif         – Repopulation (Tumor)
   *   fxPerWeek           – Fraktionen pro Woche
   *   delivered           – vor der Pause applizierte Fraktionen
   *   extension           – Verlängerung der Gesamtbehandlungszeit durch die Pause [Tage]
   *   remainingFx?        – (Option C) Anzahl verbleibender Fraktionen, auf die kompensiert wird
   * }
   * Liefert Referenz (Plan), Ergebnis ohne Kompensation und Kompensationsoptionen.
   */
  function gapCompensation(p) {
    const { d, n, abT, abL, Tk, dprolif, delivered, extension } = p;
    const fxw = p.fxPerWeek || 5;
    const T0 = p.T0 != null ? p.T0 : overallTime(n, fxw, 1);
    const Kt = kFromDprolif(dprolif, abT);
    const loss = T => Kt * Math.max(0, T - Tk);
    const late = (bed) => bed / (1 + 2 / abL);

    const planBedT = n * d * (1 + d / abT) - loss(T0);
    const planBedL = n * d * (1 + d / abL);
    const plan = { T: T0, bedT: planBedT, eqd2T: planBedT / (1 + 2 / abT), bedL: planBedL, eqd2L: late(planBedL) };

    // A) Keine Kompensation: gleiches Schema, Zeit um 'extension' verlängert
    const T1 = T0 + extension;
    const aBedT = n * d * (1 + d / abT) - loss(T1);
    const none = {
      T: T1, bedT: aBedT, eqd2T: aBedT / (1 + 2 / abT), bedL: planBedL, eqd2L: late(planBedL),
      deficitEqd2: (planBedT - aBedT) / (1 + 2 / abT)
    };

    // B) Gleiche Einzeldosis, zusätzliche Fraktionen am Ende (jede verlängert T weiter)
    let extra = 0, TB = T1;
    for (let i = 0; i < 200; i++) {
      TB = T1 + (extra > 0 ? overallTime(n + extra, fxw, 1) - overallTime(n, fxw, 1) : 0);
      const b = (n + extra) * d * (1 + d / abT) - loss(TB);
      if (b >= planBedT - 1e-9) break;
      extra++;
    }
    const bBedT = (n + extra) * d * (1 + d / abT) - loss(TB);
    const bBedL = (n + extra) * d * (1 + d / abL);
    const addFx = {
      extraFx: extra, T: TB, bedT: bBedT, eqd2T: bBedT / (1 + 2 / abT),
      bedL: bBedL, eqd2L: late(bBedL)
    };

    // C) Erhöhte Einzeldosis für die verbleibenden Fraktionen, Zeit = T1
    const remaining = p.remainingFx != null ? Math.min(p.remainingFx, n - delivered) : n - delivered;
    const unchanged = n - delivered - remaining; // Fraktionen nach der Pause mit alter Dosis
    let hypo = null;
    if (remaining > 0) {
      const target = planBedT + loss(T1) - (delivered + unchanged) * d * (1 + d / abT);
      const dNew = dForBed(target, remaining, abT);
      const bedL = (delivered + unchanged) * d * (1 + d / abL) + remaining * dNew * (1 + dNew / abL);
      const bedT = (delivered + unchanged) * d * (1 + d / abT) + remaining * dNew * (1 + dNew / abT) - loss(T1);
      hypo = {
        remaining, dNew, T: T1, D: (delivered + unchanged) * d + remaining * dNew,
        bedT, eqd2T: bedT / (1 + 2 / abT), bedL, eqd2L: late(bedL)
      };
    }

    // D) Ursprüngliche Gesamtzeit einhalten (Wochenende / 2×tgl. mit ≥ 6 h Abstand)
    const keepTime = {
      T: T0, bedT: planBedT, eqd2T: plan.eqd2T, bedL: planBedL, eqd2L: plan.eqd2L
    };
    // Variante 2× täglich: jede nachgeholte Fraktion bildet ein Paar mit unvollständiger Reparatur
    let keepTimeBid = null;
    if (p.repair && p.missed > 0) {
      const pairs = p.missed;
      const exT = incompleteRepairExcess(d, pairs, abT, repairTheta(p.repair.dt, p.repair.halfTimeT));
      const exL = incompleteRepairExcess(d, pairs, abL, repairTheta(p.repair.dt, p.repair.halfTimeL));
      keepTimeBid = {
        pairs, T: T0, bedT: planBedT + exT, eqd2T: (planBedT + exT) / (1 + 2 / abT),
        bedL: planBedL + exL, eqd2L: late(planBedL + exL)
      };
    }

    return { plan, none, addFx, hypo, keepTime, keepTimeBid, K: Kt };
  }

  /** Schemata, die eine Ziel-EQD2 (Tumor) erreichen – für Tabellen/Vorschläge. */
  function scheduleTable(targetEqd2, ab, abLate, ds) {
    const bed = bedFromEqd(targetEqd2, ab, 2);
    return ds.map(d => {
      const n = nForBed(bed, d, ab);
      const nR = Math.max(1, Math.round(n));
      const bedL = nR * d * (1 + d / abLate);
      return { d, n, nRounded: nR, D: nR * d, eqd2Tumor: nR * d * (1 + d / ab) / (1 + 2 / ab), eqd2Late: bedL / (1 + 2 / abLate) };
    });
  }

  return {
    LN2,
    bedPerFraction,
    kFromDprolif,
    kFromTpot,
    repopulationLoss,
    evaluate,
    repairTheta,
    incompleteRepairExcess,
    bedFromSegments,
    brachySegments,
    evaluateBrachy,
    recoveryFromCurve,
    reirradiation,
    niederCheck,
    niederCheckMulti,
    rangeEval,
    seriesBed,
    eqdFromBed,
    bedFromEqd,
    dForBed,
    dForBedGeneral,
    nForBed,
    isoeffectiveDose,
    overallTime,
    sumSeries,
    gapCompensation,
    scheduleTable
  };
});
