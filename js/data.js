/* Referenzdaten: typische α/β-Werte und Repopulationsparameter.
 * Richtwerte aus der Literatur (u. a. Joiner & van der Kogel, QUANTEC, START-Studien, Fowler).
 * Die Unsicherheiten sind teils erheblich – Werte immer klinisch prüfen. */
window.RADONC_DATA = {
  alphaBeta: [
    { group: 'Tumoren', items: [
      { name: 'Kopf-Hals-Plattenepithelkarzinom', ab: 10, range: '≈ 8–15' },
      { name: 'NSCLC', ab: 10, range: '≈ 8–10' },
      { name: 'Zervixkarzinom', ab: 10, range: '≈ 10' },
      { name: 'Ösophaguskarzinom', ab: 10, range: '≈ 5–10' },
      { name: 'Rektumkarzinom', ab: 5, range: '≈ 5' },
      { name: 'Blasenkarzinom', ab: 10, range: '≈ 10–13' },
      { name: 'Glioblastom / Gliom', ab: 10, range: '≈ 5–10' },
      { name: 'Hirnmetastasen', ab: 10, range: '≈ 10–12' },
      { name: 'Mammakarzinom', ab: 3.5, range: '≈ 3–4 (START)' },
      { name: 'Prostatakarzinom', ab: 1.5, range: '≈ 1,2–1,9' },
      { name: 'Melanom', ab: 2.5, range: '≈ 0,6–2,5' },
      { name: 'Weichteilsarkom', ab: 4, range: '≈ 0,4–5 (unsicher)' }
    ]},
    { group: 'Normalgewebe – spät', items: [
      { name: 'Rückenmark', ab: 2, range: '≈ 2 (QUANTEC)', limit: 50 },
      { name: 'Gehirn', ab: 2, range: '≈ 1–3', limit: 60 },
      { name: 'Hirnstamm', ab: 2, range: '≈ 2', limit: 54 },
      { name: 'N. opticus / Chiasma', ab: 2, range: '≈ 2', limit: 55 },
      { name: 'Plexus brachialis', ab: 2, range: '≈ 2', limit: 66 },
      { name: 'Lunge (Pneumonitis)', ab: 3, range: '≈ 3–4' },
      { name: 'Herz', ab: 2.5, range: '≈ 2–3' },
      { name: 'Rektum (spät)', ab: 3, range: '≈ 3–5' },
      { name: 'Harnblase (spät)', ab: 3, range: '≈ 3–5' },
      { name: 'Dünndarm (spät)', ab: 3, range: '≈ 3–4' },
      { name: 'Niere', ab: 2, range: '≈ 1,5–2,5' },
      { name: 'Leber', ab: 2.5, range: '≈ 2–3' },
      { name: 'Haut: Fibrose', ab: 1.7, range: '≈ 1,7' },
      { name: 'Haut: Teleangiektasien', ab: 2.8, range: '≈ 2,8' },
      { name: 'Brustgewebe (Fibrose, Ödem)', ab: 3.4, range: '≈ 3–4 (START)' },
      { name: 'Spät reagierend, allgemein', ab: 3, range: 'Konvention' }
    ]},
    { group: 'Normalgewebe – akut', items: [
      { name: 'Mukosa (Mukositis)', ab: 10, range: '≈ 8–15' },
      { name: 'Haut (akut, Erythem)', ab: 10, range: '≈ 8–12' },
      { name: 'Früh reagierend, allgemein', ab: 10, range: 'Konvention' }
    ]}
  ],

  /* Repopulation: Tk [d], Dprolif [EQD2-Gy/Tag] */
  repopulation: [
    { name: 'Benutzerdefiniert', tk: null, dp: null },
    { name: 'Kopf-Hals-PECA (RCR / Fowler): Tk 21 d, 0,9 Gy/d', tk: 21, dp: 0.9 },
    { name: 'Kopf-Hals-PECA (Withers 1988): Tk 28 d, 0,6 Gy/d', tk: 28, dp: 0.6 },
    { name: 'Kopf-Hals-PECA (Bentzen): Tk 21 d, 0,8 Gy/d', tk: 21, dp: 0.8 },
    { name: 'NSCLC: Tk 21 d, 0,45 Gy/d', tk: 21, dp: 0.45 },
    { name: 'Zervixkarzinom: Tk 21 d, 0,5 Gy/d', tk: 21, dp: 0.5 },
    { name: 'Keine relevante Repopulation (0 Gy/d)', tk: 0, dp: 0 }
  ],

  /* Reparaturhalbwertszeiten T½ [h] */
  halfTimes: [
    { name: 'Tumor / akut reagierend', t: 0.5, range: '≈ 0,5–1 h' },
    { name: 'Spät reagierend, allgemein', t: 1.5, range: '≈ 1–2 h' },
    { name: 'Rückenmark / ZNS (konservativ)', t: 4, range: '≈ 2–4 h (biexponentiell)' },
    { name: 'Lunge / Niere', t: 1.5, range: '≈ 1–2 h' }
  ],

  /* Erholungsmodelle für Re-Bestrahlung: Stützpunkte [Monate, % Erholung], linear interpoliert */
  recovery: [
    { name: 'Rückenmark – konservativ: 25 % nach 6 Mo., 50 % ab 12 Mo.', points: [[0, 0], [6, 25], [12, 50]] },
    { name: 'Rückenmark – keine Erholung < 6 Mo., dann 25 %, ab 12 Mo. 50 %', points: [[0, 0], [5.99, 0], [6, 25], [12, 50]] },
    { name: 'Keine Erholung annehmen', points: [[0, 0]] },
    { name: 'Benutzerdefiniert', points: null }
  ],

  /* LKB-Parameter: TD50 [Gy, EQD2], m, n */
  ntcp: [
    { name: 'Lunge – Pneumonitis ≥ Grad 2 (QUANTEC, Seppenwoolde)', td50: 30.8, m: 0.37, n: 0.99 },
    { name: 'Lunge – Pneumonitis (Burman 1991)', td50: 24.5, m: 0.18, n: 0.87 },
    { name: 'Rektum – spät ≥ Grad 2 (QUANTEC)', td50: 76.9, m: 0.13, n: 0.09 },
    { name: 'Rektum – Proktitis/Nekrose (Burman 1991)', td50: 80, m: 0.15, n: 0.12 },
    { name: 'Parotis – Xerostomie (QUANTEC, Deasy)', td50: 28.4, m: 0.18, n: 1 },
    { name: 'Leber – RILD (Dawson 2002)', td50: 39.8, m: 0.12, n: 0.97 },
    { name: 'Leber – RILD (Burman 1991)', td50: 40, m: 0.15, n: 0.32 },
    { name: 'Herz – Perikarditis (Burman 1991)', td50: 48, m: 0.10, n: 0.35 },
    { name: 'Ösophagus – Striktur/Perforation (Burman 1991)', td50: 68, m: 0.11, n: 0.06 },
    { name: 'Rückenmark – Myelopathie (Burman 1991)', td50: 66.5, m: 0.175, n: 0.05 },
    { name: 'Hirnstamm – Nekrose (Burman 1991)', td50: 65, m: 0.14, n: 0.16 },
    { name: 'N. opticus – Erblindung (Burman 1991)', td50: 65, m: 0.14, n: 0.25 },
    { name: 'Niere – Nephritis (Burman 1991)', td50: 28, m: 0.10, n: 0.70 },
    { name: 'Blase – Schrumpfblase (Burman 1991)', td50: 80, m: 0.11, n: 0.50 },
    { name: 'Femurkopf – Nekrose (Burman 1991)', td50: 65, m: 0.12, n: 0.25 }
  ],

  /* Toleranzen konventionell fraktioniert (≈ 1,8–2 Gy/Fx, entspricht EQD2), QUANTEC 2010 u. a. */
  constraints: [
    { organ: 'Gehirn', metric: 'Dmax', value: '< 60 Gy', risk: 'Nekrose < 3 %', src: 'QUANTEC' },
    { organ: 'Gehirn', metric: 'Dmax', value: '72 Gy', risk: 'Nekrose ≈ 5 %', src: 'QUANTEC' },
    { organ: 'Hirnstamm', metric: 'Dmax (gesamter HS)', value: '< 54 Gy', risk: 'Neuropathie/Nekrose < 5 %', src: 'QUANTEC' },
    { organ: 'Hirnstamm', metric: 'D1–10cc', value: '≤ 59 Gy', risk: '< 5 %', src: 'QUANTEC' },
    { organ: 'Hirnstamm', metric: 'Dmax (Punkt)', value: '< 64 Gy', risk: '< 5 %', src: 'QUANTEC' },
    { organ: 'N. opticus / Chiasma', metric: 'Dmax', value: '< 55 Gy', risk: 'Optikusneuropathie < 3 %', src: 'QUANTEC' },
    { organ: 'N. opticus / Chiasma', metric: 'Dmax', value: '55–60 Gy', risk: '3–7 %', src: 'QUANTEC' },
    { organ: 'Rückenmark', metric: 'Dmax', value: '50 Gy', risk: 'Myelopathie 0,2 %', src: 'QUANTEC' },
    { organ: 'Rückenmark', metric: 'Dmax', value: '60 Gy', risk: 'Myelopathie 6 %', src: 'QUANTEC' },
    { organ: 'Rückenmark', metric: 'Dmax', value: '69 Gy', risk: 'Myelopathie 50 %', src: 'QUANTEC' },
    { organ: 'Cochlea', metric: 'Dmean', value: '≤ 45 Gy', risk: 'Hörverlust < 30 %', src: 'QUANTEC' },
    { organ: 'Parotis (beide)', metric: 'Dmean', value: '< 25 Gy', risk: 'Xerostomie < 20 %', src: 'QUANTEC' },
    { organ: 'Parotis (eine)', metric: 'Dmean', value: '< 20 Gy', risk: 'Xerostomie < 20 %', src: 'QUANTEC' },
    { organ: 'Pharynxkonstriktoren', metric: 'Dmean', value: '< 50 Gy', risk: 'Dysphagie < 20 %', src: 'QUANTEC' },
    { organ: 'Larynx', metric: 'Dmax', value: '< 66 Gy', risk: 'Stimmstörung < 20 %', src: 'QUANTEC' },
    { organ: 'Larynx', metric: 'Dmean', value: '< 50 Gy', risk: 'Aspiration < 30 %', src: 'QUANTEC' },
    { organ: 'Larynx', metric: 'Dmean', value: '< 44 Gy', risk: 'Ödem < 20 %', src: 'QUANTEC' },
    { organ: 'Plexus brachialis', metric: 'Dmax', value: '< 66 Gy', risk: 'Plexopathie', src: 'RTOG' },
    { organ: 'Lunge (beidseits − GTV)', metric: 'V20', value: '≤ 30 %', risk: 'Pneumonitis < 20 %', src: 'QUANTEC' },
    { organ: 'Lunge (beidseits − GTV)', metric: 'Dmean (MLD)', value: '7 Gy / 13 Gy / 20 Gy', risk: 'Pneumonitis 5 / 10 / 20 %', src: 'QUANTEC' },
    { organ: 'Ösophagus', metric: 'Dmean', value: '< 34 Gy', risk: 'Ösophagitis ≥ Grad 3: 5–20 %', src: 'QUANTEC' },
    { organ: 'Herz', metric: 'V25', value: '< 10 %', risk: 'kardiale Mortalität < 1 % (15 J.)', src: 'QUANTEC' },
    { organ: 'Perikard', metric: 'Dmean / V30', value: '< 26 Gy / < 46 %', risk: 'Perikarditis < 15 %', src: 'QUANTEC' },
    { organ: 'Leber (normal, Metastasen)', metric: 'Dmean', value: '< 30–32 Gy', risk: 'RILD < 5 %', src: 'QUANTEC' },
    { organ: 'Leber (HCC, Child A)', metric: 'Dmean', value: '< 28 Gy', risk: 'RILD < 5 %', src: 'QUANTEC' },
    { organ: 'Nieren (beidseits)', metric: 'Dmean', value: '< 15–18 Gy', risk: 'Nierenfunktionsstörung < 5 %', src: 'QUANTEC' },
    { organ: 'Nieren (beidseits)', metric: 'V12 / V20 / V23 / V28', value: '< 55 / 32 / 30 / 20 %', risk: '< 5 %', src: 'QUANTEC' },
    { organ: 'Magen', metric: 'D100', value: '< 45 Gy', risk: 'Ulkus < 7 %', src: 'QUANTEC' },
    { organ: 'Dünndarm (einzelne Schlingen)', metric: 'V15', value: '< 120 cc', risk: 'Toxizität ≥ Grad 3 < 10 %', src: 'QUANTEC' },
    { organ: 'Dünndarm (Peritonealraum)', metric: 'V45', value: '< 195 cc', risk: 'Toxizität ≥ Grad 3 < 10 %', src: 'QUANTEC' },
    { organ: 'Rektum', metric: 'V50 / V60 / V65 / V70 / V75', value: '< 50 / 35 / 25 / 20 / 15 %', risk: 'spät ≥ Grad 2 < 15 %, ≥ Grad 3 < 10 %', src: 'QUANTEC' },
    { organ: 'Harnblase', metric: 'Dmax', value: '< 65 Gy', risk: 'spät ≥ Grad 3 < 6 %', src: 'QUANTEC' },
    { organ: 'Harnblase', metric: 'V65 / V70 / V75 / V80', value: '≤ 50 / 35 / 25 / 15 %', risk: 'spät ≥ Grad 3', src: 'QUANTEC (RTOG 0415)' },
    { organ: 'Bulbus penis', metric: 'Dmean (95 % Volumen)', value: '< 50 Gy', risk: 'erektile Dysfunktion < 35 %', src: 'QUANTEC' },
    { organ: 'Femurkopf', metric: 'V50', value: '< 5 %', risk: 'Nekrose', src: 'RTOG' }
  ],

  /* SBRT-Toleranzen (AAPM TG-101, Benedict 2010): [Volumen, D_vol, Dmax] für 1/3/5 Fx; ab = α/β für EQD2 */
  sbrt: [
    { organ: 'Rückenmark', vol: '0,35 cc', ab: 2, f1: [10, 14], f3: [18, 21.9], f5: [23, 30], end: 'Myelitis' },
    { organ: 'Rückenmark', vol: '1,2 cc', ab: 2, f1: [7, null], f3: [12.3, null], f5: [14.5, null], end: 'Myelitis' },
    { organ: 'Cauda equina', vol: '5 cc', ab: 2, f1: [14, 16], f3: [21.9, 24], f5: [30, 32], end: 'Neuritis' },
    { organ: 'Plexus sacralis', vol: '5 cc', ab: 2, f1: [14.4, 16], f3: [22.5, 24], f5: [30, 32], end: 'Neuropathie' },
    { organ: 'Plexus brachialis', vol: '3 cc', ab: 2, f1: [14, 17.5], f3: [20.4, 24], f5: [27, 30.5], end: 'Neuropathie' },
    { organ: 'Hirnstamm', vol: '0,5 cc', ab: 2, f1: [10, 15], f3: [18, 23.1], f5: [23, 31], end: 'Neuropathie' },
    { organ: 'Sehnerven / Chiasma', vol: '0,2 cc', ab: 2, f1: [8, 10], f3: [15.3, 17.4], f5: [23, 25], end: 'Optikusneuropathie' },
    { organ: 'Cochlea', vol: '–', ab: 3, f1: [null, 9], f3: [null, 17.1], f5: [null, 25], end: 'Hörverlust' },
    { organ: 'Ösophagus', vol: '5 cc', ab: 3, f1: [11.9, 15.4], f3: [17.7, 25.2], f5: [19.5, 35], end: 'Stenose/Fistel' },
    { organ: 'Herz / Perikard', vol: '15 cc', ab: 3, f1: [16, 22], f3: [24, 30], f5: [32, 38], end: 'Perikarditis' },
    { organ: 'Große Gefäße', vol: '10 cc', ab: 3, f1: [31, 37], f3: [39, 45], f5: [47, 53], end: 'Aneurysma' },
    { organ: 'Trachea / Hauptbronchus', vol: '4 cc', ab: 3, f1: [10.5, 20.2], f3: [15, 30], f5: [16.5, 40], end: 'Stenose/Fistel' },
    { organ: 'Rippe', vol: '1 cc', ab: 3, f1: [22, 30], f3: [28.8, 36.9], f5: [35, 43], end: 'Fraktur/Schmerz' },
    { organ: 'Haut', vol: '10 cc', ab: 3, f1: [23, 26], f3: [30, 33], f5: [36.5, 39.5], end: 'Ulzeration' },
    { organ: 'Magen', vol: '10 cc', ab: 3, f1: [11.2, 12.4], f3: [16.5, 22.2], f5: [18, 32], end: 'Ulkus/Fistel' },
    { organ: 'Duodenum', vol: '5 cc', ab: 3, f1: [11.2, 12.4], f3: [16.5, 22.2], f5: [18, 32], end: 'Ulkus' },
    { organ: 'Jejunum / Ileum', vol: '5 cc', ab: 3, f1: [11.9, 15.4], f3: [17.7, 25.2], f5: [19.5, 35], end: 'Enteritis/Obstruktion' },
    { organ: 'Kolon', vol: '20 cc', ab: 3, f1: [14.3, 18.4], f3: [24, 28.2], f5: [25, 38], end: 'Kolitis/Fistel' },
    { organ: 'Rektum', vol: '20 cc', ab: 3, f1: [14.3, 18.4], f3: [24, 28.2], f5: [25, 38], end: 'Proktitis/Fistel' },
    { organ: 'Harnblase', vol: '15 cc', ab: 3, f1: [11.4, 18.4], f3: [16.8, 28.2], f5: [18.3, 38], end: 'Zystitis/Fistel' },
    { organ: 'Lunge (gesamt) – kritisches Volumen', vol: '1500 cc (min.)', ab: 3, f1: [7, null], f3: [10.5, null], f5: [12.5, null], end: 'Lungenfunktion' },
    { organ: 'Lunge (gesamt) – kritisches Volumen', vol: '1000 cc (min.)', ab: 3, f1: [7.4, null], f3: [11.6, null], f5: [13.5, null], end: 'Pneumonitis' },
    { organ: 'Leber – kritisches Volumen', vol: '700 cc (min.)', ab: 2.5, f1: [9.1, null], f3: [19.2, null], f5: [21, null], end: 'Leberfunktion' },
    { organ: 'Nierenrinde – kritisches Volumen', vol: '200 cc (min.)', ab: 2, f1: [8.4, null], f3: [16, null], f5: [17.5, null], end: 'Nierenfunktion' }
  ]
};
