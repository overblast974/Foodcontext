/* Kalori Péi — suivi calorique cuisine réunionnaise (PWA, 100 % local). */
"use strict";

/* ================= Stockage local ================= */
const Store = {
  get(key, fallback) {
    try { const v = localStorage.getItem(key); return v ? JSON.parse(v) : fallback; }
    catch { return fallback; }
  },
  set(key, val) { localStorage.setItem(key, JSON.stringify(val)); },
};

const state = {
  settings: Store.get("fc_settings", {
    mode: "manual",
    targets: { kcal: 2000, prot: 90, carb: 230, fat: 70 },
    profile: { sex: "h", age: 35, kg: 75, cm: 175, pal: 1.375, goal: 0, protMode: "anses" },
  }),
  journal: Store.get("fc_journal", {}),       // { "YYYY-MM-DD": [meal, ...] }
  customFoods: Store.get("fc_customFoods", []),
  photos: Store.get("fc_photos", {}),          // { foodId: dataURL }
  weights: Store.get("fc_weights", {}),        // { "YYYY-MM-DD": kg }
  currentMeal: [],                              // [{foodId, qty}]
  activeCat: "all",
  dayOffset: 0,
  weekOffset: 0,
  sportTab: "poids",                            // "poids" | "macros"
};

function saveJournal() { Store.set("fc_journal", state.journal); }
function saveSettings() { Store.set("fc_settings", state.settings); }
function saveCustomFoods() { Store.set("fc_customFoods", state.customFoods); }
function savePhotos() { Store.set("fc_photos", state.photos); }
function saveWeights() { Store.set("fc_weights", state.weights); }

function allFoods() { return FOODS.concat(state.customFoods); }
function foodById(id) { return allFoods().find(f => f.id === id); }
/* Aliment de repli si un aliment personnalisé référencé par le journal ou le
   plat en cours a été supprimé : évite de planter le rendu des vues. */
const FOOD_INCONNU = { id: "", cat: "perso", emoji: "❓", name: "Aliment supprimé", portion: "", kcal: 0 };
function foodOrUnknown(id) { return foodById(id) || FOOD_INCONNU; }

/* ================= Dates ================= */
function dKey(d) {
  return d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0") + "-" + String(d.getDate()).padStart(2, "0");
}
function todayKey(offset = 0) {
  const d = new Date(); d.setDate(d.getDate() + offset); return dKey(d);
}
function mondayOf(d) {
  const x = new Date(d); const day = (x.getDay() + 6) % 7; x.setDate(x.getDate() - day); return x;
}
const FMT_DAY = new Intl.DateTimeFormat("fr-FR", { weekday: "long", day: "numeric", month: "long" });
const FMT_SHORT = new Intl.DateTimeFormat("fr-FR", { weekday: "short", day: "numeric", month: "short" });

function mealTypeForNow() {
  const h = new Date().getHours();
  if (h < 10) return "Petit-déjeuner";
  if (h < 15) return "Déjeuner";
  if (h < 18) return "Collation";
  return "Dîner";
}

/* ================= Calculs nutrition ================= */
function emptyTotals() {
  const t = {}; NUTRIENT_KEYS.forEach(k => t[k] = 0); return t;
}
function addToTotals(totals, food, qty) {
  NUTRIENT_KEYS.forEach(k => { totals[k] += (food[k] || 0) * qty; });
}
function mealTotals(items) {
  const t = emptyTotals();
  items.forEach(it => { const f = foodById(it.foodId); if (f) addToTotals(t, f, it.qty); });
  return t;
}
function dayTotals(dateKey) {
  const t = emptyTotals();
  (state.journal[dateKey] || []).forEach(m => {
    const mt = mealTotals(m.items);
    NUTRIENT_KEYS.forEach(k => t[k] += mt[k]);
  });
  return t;
}

/*
 * Calcul des besoins énergétiques — méthode de référence :
 *  - Métabolisme de base : équation de Mifflin-St Jeor (1990), recommandée
 *    par l'Academy of Nutrition and Dietetics pour sa précision chez l'adulte.
 *      Homme : MB = 10×poids(kg) + 6,25×taille(cm) − 5×âge + 5
 *      Femme : MB = 10×poids(kg) + 6,25×taille(cm) − 5×âge − 161
 *  - Dépense totale = MB × NAP (niveau d'activité physique, FAO/OMS).
 *  - Répartition des macronutriments :
 *      • Mode « ANSES 2021 » (par défaut) : protéines 15 % de l'AET,
 *        lipides 35-40 % (on retient 37,5 %), glucides le reste (~47,5 %).
 *      • Mode « Sportif (prise de muscle) » : protéines fixées au poids de corps
 *        (1,8 g/kg, fourchette haute des recommandations de l'ISSN/EFSA pour la
 *        prise de masse), lipides 30 % de l'AET, glucides le reste (le carburant
 *        de l'entraînement). Les protéines sont plafonnées à 35 % de l'AET pour
 *        rester physiologiques même chez les profils très légers/hypocaloriques.
 *    1 g protéines = 4 kcal ; 1 g glucides = 4 kcal ; 1 g lipides = 9 kcal.
 */
function computeTargets(p) {
  const bmr = 10 * p.kg + 6.25 * p.cm - 5 * p.age + (p.sex === "h" ? 5 : -161);
  const tdee = bmr * p.pal + Number(p.goal);
  // Plancher de sécurité différencié (AND/ANSES) : 1500 kcal homme, 1200 kcal femme.
  const kcal = Math.max(p.sex === "h" ? 1500 : 1200, Math.round(tdee));
  if (p.protMode === "sport") {
    const protMax = Math.floor(kcal * 0.35 / 4);
    const prot = Math.min(Math.round(1.8 * p.kg), protMax);
    const fat = Math.round(kcal * 0.30 / 9);
    const carb = Math.max(0, Math.round((kcal - prot * 4 - fat * 9) / 4));
    return { kcal, prot, fat, carb };
  }
  return {
    kcal,
    prot: Math.round(kcal * 0.15 / 4),
    fat: Math.round(kcal * 0.375 / 9),
    carb: Math.round(kcal * 0.475 / 4),
  };
}
function activeTargets() {
  return state.settings.mode === "calc"
    ? computeTargets(state.settings.profile)
    : state.settings.targets;
}

function fmt(n, dec = 0) {
  // Number(n) || 0 : protège contre undefined/NaN (ex. données importées incomplètes).
  return (Number(n) || 0).toLocaleString("fr-FR", { minimumFractionDigits: dec, maximumFractionDigits: dec });
}

/* Échappe le HTML des chaînes saisies par l'utilisateur (aliments personnalisés,
   données importées) avant toute injection via innerHTML — protection XSS. */
function esc(s) {
  return String(s ?? "").replace(/[&<>"']/g, c => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;",
  }[c]));
}

/* ================= Vues ================= */
const $ = sel => document.querySelector(sel);
const views = ["saisie", "jour", "semaine", "sport", "reglages"];

function showView(name) {
  views.forEach(v => {
    $("#view-" + v).hidden = v !== name;
    $("#nav-" + v).classList.toggle("active", v === name);
  });
  // Chaque vue repart du haut (sinon on hérite du défilement de la vue précédente).
  window.scrollTo(0, 0);
  if (name === "saisie") renderSaisie();
  if (name === "jour") renderJour();
  if (name === "semaine") renderSemaine();
  if (name === "sport") renderSport();
  if (name === "reglages") renderReglages();
}

/* ---------- Vue Saisie : vignettes + plat en cours ---------- */
function tileHTML(f) {
  const inMeal = state.currentMeal.find(it => it.foodId === f.id);
  const photo = state.photos[f.id];
  const visual = photo
    ? `<span class="tile-img" style="background-image:url('${photo}')"></span>`
    : `<span class="tile-emoji">${esc(f.emoji)}</span>`;
  const cat = FOOD_CATEGORIES.find(c => c.id === f.cat);
  // .bump : rejoue l'animation du badge uniquement sur la vignette qui vient
  // d'être touchée (la grille est re-rendue entièrement à chaque appui).
  const bump = state._bump === f.id ? " bump" : "";
  return `<button class="tile ${inMeal ? "selected" : ""}" data-food="${esc(f.id)}"
            style="--cat:${cat ? cat.color : "#888"}">
      ${visual}
      ${inMeal ? `<span class="tile-qty${bump}">×${fmt(inMeal.qty, inMeal.qty % 1 ? 1 : 0)}</span>` : ""}
      <span class="tile-name">${esc(f.name)}</span>
      <span class="tile-info">${esc(f.portion)}</span>
      <span class="tile-kcal">${fmt(f.kcal)} kcal</span>
    </button>`;
}

function renderSaisie() {
  const cats = [{ id: "all", label: "Tout", color: "#555" }]
    .concat(FOOD_CATEGORIES.filter(c => c.id !== "perso" || state.customFoods.length));
  $("#cat-bar").innerHTML = cats.map(c =>
    `<button class="cat-chip ${state.activeCat === c.id ? "active" : ""}" data-cat="${c.id}"
       style="--cat:${c.color}">${c.label}</button>`).join("");

  const search = ($("#food-search").value || "").toLowerCase().trim();
  let foods = allFoods();
  if (state.activeCat !== "all") foods = foods.filter(f => f.cat === state.activeCat);
  if (search) foods = foods.filter(f => f.name.toLowerCase().includes(search));
  $("#tile-grid").innerHTML = foods.map(tileHTML).join("") +
    `<button class="tile tile-add" id="tile-add-custom">
       <span class="tile-emoji">➕</span><span class="tile-name">Ajouter un aliment</span>
       <span class="tile-info">personnalisé</span></button>`;

  renderTray();
}

function renderTray() {
  const tray = $("#meal-tray");
  if (!state.currentMeal.length) {
    tray.innerHTML = `<p class="tray-empty">Appuyez sur les vignettes pour composer votre plat.<br>
      <small>1 appui = 1 dose · ré-appuyez pour augmenter · ajustez ci-dessous.</small></p>`;
    $("#meal-summary").innerHTML = "";
    $("#validate-meal").disabled = true;
    return;
  }
  tray.innerHTML = state.currentMeal.map(it => {
    const f = foodOrUnknown(it.foodId);
    // .enter : anime seulement la ligne qui vient d'être ajoutée/modifiée.
    const enter = state._bump === it.foodId ? " enter" : "";
    return `<div class="tray-item${enter}">
        <span class="tray-emoji">${esc(f.emoji)}</span>
        <span class="tray-name">${esc(f.name)}<small>${esc(f.portion)}</small></span>
        <span class="tray-ctrl">
          <button class="qty-btn" data-act="minus" data-food="${esc(it.foodId)}" aria-label="Réduire la quantité de ${esc(f.name)}">−</button>
          <span class="tray-qty">${fmt(it.qty, it.qty % 1 ? 1 : 0)}</span>
          <button class="qty-btn" data-act="plus" data-food="${esc(it.foodId)}" aria-label="Augmenter la quantité de ${esc(f.name)}">+</button>
          <button class="qty-btn del" data-act="del" data-food="${esc(it.foodId)}" aria-label="Retirer ${esc(f.name)} du plat">✕</button>
        </span>
        <span class="tray-kcal">${fmt(f.kcal * it.qty)} kcal</span>
      </div>`;
  }).join("");

  const t = mealTotals(state.currentMeal);
  $("#meal-summary").innerHTML = `
    <div class="macros-line">
      <span class="kcal-big">${fmt(t.kcal)} kcal</span>
      <span class="macro p">P ${fmt(t.prot)} g</span>
      <span class="macro g">G ${fmt(t.carb)} g</span>
      <span class="macro l">L ${fmt(t.fat)} g</span>
    </div>`;
  $("#validate-meal").disabled = false;
}

function tapTile(foodId) {
  const it = state.currentMeal.find(i => i.foodId === foodId);
  if (it) it.qty += 1; else state.currentMeal.push({ foodId, qty: 1 });
  if (navigator.vibrate) navigator.vibrate(15);
  // Marque l'aliment touché le temps d'un rendu : déclenche les micro-animations
  // (badge ×N qui "pop", ligne du plateau qui glisse), puis on efface le marqueur
  // pour que les rendus suivants (recherche, filtre…) ne rejouent rien.
  state._bump = foodId;
  renderSaisie();
  state._bump = null;
}
function adjustQty(foodId, act) {
  const idx = state.currentMeal.findIndex(i => i.foodId === foodId);
  if (idx < 0) return;
  const it = state.currentMeal[idx];
  if (act === "plus") it.qty = Math.round((it.qty + 0.5) * 2) / 2;
  if (act === "minus") it.qty = Math.round((it.qty - 0.5) * 2) / 2;
  if (act === "del" || it.qty <= 0) state.currentMeal.splice(idx, 1);
  if (act === "plus" || act === "minus") state._bump = foodId;
  renderSaisie();
  state._bump = null;
}

function validateMeal() {
  if (!state.currentMeal.length) return;
  const type = $("#meal-type").value || mealTypeForNow();
  const key = todayKey();
  if (!state.journal[key]) state.journal[key] = [];
  state.journal[key].push({
    id: Date.now(), type,
    time: new Date().toTimeString().slice(0, 5),
    items: state.currentMeal.map(i => ({ ...i })),
  });
  saveJournal();
  // Premier repas validé : l'aide de bienvenue n'est plus nécessaire.
  const hint = $("#first-hint");
  if (hint && !hint.hidden) { hint.hidden = true; Store.set("fc_hintSeen", true); }
  showMealReport(state.currentMeal, type);
  state.currentMeal = [];
  renderSaisie();
}

/* ---------- Compte rendu du plat (modale) ---------- */
function nutrientTable(t, compareTargets) {
  const rows = NUTRIENT_KEYS.map(k => {
    const def = NUTRIENT_LABELS[k];
    const dec = ["ca", "fe", "mg", "k", "vitc", "kcal"].includes(k) ? 0 : 1;
    let pct = "";
    if (compareTargets && compareTargets[k]) {
      pct = `<td class="pct">${fmt(t[k] / compareTargets[k] * 100)} %</td>`;
    } else if (compareTargets) pct = "<td></td>";
    return `<tr class="${k === "sugar" || k === "sat" ? "sub" : ""}">
        <td>${def.label}</td><td class="num">${fmt(t[k], dec)} ${def.unit}</td>${pct}</tr>`;
  }).join("");
  const head = compareTargets ? "<tr><th></th><th>Total</th><th>% objectif</th></tr>" : "";
  return `<table class="nutri-table">${head}${rows}</table>`;
}

function showMealReport(items, type) {
  const t = mealTotals(items);
  const list = items.map(it => {
    const f = foodOrUnknown(it.foodId);
    return `<li>${esc(f.emoji)} ${esc(f.name)} <b>×${fmt(it.qty, it.qty % 1 ? 1 : 0)}</b> — ${fmt(f.kcal * it.qty)} kcal</li>`;
  }).join("");
  openModal(`
    <h2>✅ ${esc(type)} enregistré</h2>
    <ul class="meal-list">${list}</ul>
    <div class="macros-line center">
      <span class="kcal-big">${fmt(t.kcal)} kcal</span>
      <span class="macro p">P ${fmt(t.prot)} g</span>
      <span class="macro g">G ${fmt(t.carb)} g</span>
      <span class="macro l">L ${fmt(t.fat)} g</span>
    </div>
    <details open><summary>Macro & micronutriments du plat</summary>${nutrientTable(t)}</details>
    <button class="btn primary" onclick="closeModal()">OK</button>`);
}

/* ---------- Vue Jour ---------- */
function progressBar(label, val, target, unit, cls) {
  const pct = target ? Math.min(130, val / target * 100) : 0;
  return `<div class="pbar ${cls}">
      <div class="pbar-head"><span>${label}</span>
        <span>${fmt(val)} / ${fmt(target)} ${unit}</span></div>
      <div class="pbar-track"><div class="pbar-fill ${pct > 105 ? "over" : ""}" style="width:${Math.min(100, pct)}%"></div></div>
    </div>`;
}

function renderJour() {
  const key = todayKey(state.dayOffset);
  const d = new Date(key + "T12:00:00");
  $("#jour-date").textContent = FMT_DAY.format(d);
  $("#jour-next").disabled = state.dayOffset >= 0;

  const t = dayTotals(key);
  const tg = activeTargets();
  $("#jour-progress").innerHTML =
    progressBar("Calories", t.kcal, tg.kcal, "kcal", "c") +
    progressBar("Protéines", t.prot, tg.prot, "g", "p") +
    progressBar("Glucides", t.carb, tg.carb, "g", "g") +
    progressBar("Lipides", t.fat, tg.fat, "g", "l");

  const meals = state.journal[key] || [];
  $("#jour-meals").innerHTML = meals.length ? meals.map(m => {
    const mt = mealTotals(m.items);
    const list = m.items.map(it => {
      const f = foodOrUnknown(it.foodId);
      return `<li>${esc(f.emoji)} ${esc(f.name)} ×${fmt(it.qty, it.qty % 1 ? 1 : 0)}</li>`;
    }).join("");
    return `<div class="meal-card">
        <div class="meal-card-head">
          <b>${esc(m.type)}</b> <small>${esc(m.time)}</small>
          <span class="meal-kcal">${fmt(mt.kcal)} kcal</span>
          <button class="qty-btn del" data-delmeal="${m.id}" title="Supprimer" aria-label="Supprimer ce repas (${esc(m.type)})">✕</button>
        </div>
        <ul>${list}</ul>
        <small class="macros-mini">P ${fmt(mt.prot)} g · G ${fmt(mt.carb)} g · L ${fmt(mt.fat)} g</small>
      </div>`;
  }).join("") : `<div class="empty-state"><span class="emoji">🍽️</span>
      <b>Aucun repas enregistré ce jour.</b><br>
      Ouvrez l'onglet <b>Saisie</b> et touchez les vignettes pour composer votre plat.</div>`;

  $("#jour-detail").innerHTML = meals.length
    ? `<details><summary>Bilan détaillé du jour (macro + micro)</summary>${nutrientTable(t, { kcal: tg.kcal, prot: tg.prot, carb: tg.carb, fat: tg.fat })}</details>`
    : "";
}

/* ---------- Vue Semaine ---------- */
function renderSemaine() {
  const monday = mondayOf(new Date());
  monday.setDate(monday.getDate() + state.weekOffset * 7);
  const days = [];
  for (let i = 0; i < 7; i++) {
    const d = new Date(monday); d.setDate(d.getDate() + i);
    days.push(d);
  }
  const sunday = days[6];
  $("#semaine-range").textContent =
    `Semaine du ${FMT_SHORT.format(monday)} au ${FMT_SHORT.format(sunday)}`;
  $("#semaine-next").disabled = state.weekOffset >= 0;

  const tg = activeTargets();
  const weekT = emptyTotals();
  let daysWithData = 0;

  const dayBlocks = days.map(d => {
    const key = dKey(d);
    const meals = state.journal[key] || [];
    const t = dayTotals(key);
    if (meals.length) { daysWithData++; NUTRIENT_KEYS.forEach(k => weekT[k] += t[k]); }
    const pct = tg.kcal ? Math.round(t.kcal / tg.kcal * 100) : 0;
    const mealLines = meals.map(m => {
      const mt = mealTotals(m.items);
      const names = m.items.map(it => {
        const f = foodOrUnknown(it.foodId);
        return `${esc(f.name)} ×${fmt(it.qty, it.qty % 1 ? 1 : 0)}`;
      }).join(", ");
      return `<li><b>${esc(m.type)}</b> (${esc(m.time)}) — ${names} <i>${fmt(mt.kcal)} kcal</i></li>`;
    }).join("");
    return `<div class="week-day ${meals.length ? "" : "empty"}">
        <div class="week-day-head">
          <b>${FMT_SHORT.format(d)}</b>
          <span>${meals.length ? fmt(t.kcal) + " kcal · " + pct + " % obj." : "Aucun repas saisi"}</span>
        </div>
        ${meals.length ? `<div class="day-bar" role="img" aria-label="${pct} % de l'objectif calorique">
          <div class="day-bar-fill ${pct > 105 ? "over" : ""}" style="width:${Math.min(100, pct)}%"></div></div>
        <small class="macros-mini">P ${fmt(t.prot)} g · G ${fmt(t.carb)} g · L ${fmt(t.fat)} g · Sel ${fmt(t.salt, 1)} g · Fibres ${fmt(t.fibre)} g</small>
        <ul>${mealLines}</ul>` : ""}
      </div>`;
  }).join("");

  const avg = {};
  NUTRIENT_KEYS.forEach(k => avg[k] = daysWithData ? weekT[k] / daysWithData : 0);

  $("#semaine-content").innerHTML = `
    <div class="card">
      <h3>Moyennes journalières (${daysWithData} jour${daysWithData > 1 ? "s" : ""} renseigné${daysWithData > 1 ? "s" : ""})</h3>
      <div class="macros-line center">
        <span class="kcal-big">${fmt(avg.kcal)} kcal/j</span>
        <span class="macro p">P ${fmt(avg.prot)} g</span>
        <span class="macro g">G ${fmt(avg.carb)} g</span>
        <span class="macro l">L ${fmt(avg.fat)} g</span>
      </div>
      <small>Objectifs : ${fmt(tg.kcal)} kcal · P ${fmt(tg.prot)} g · G ${fmt(tg.carb)} g · L ${fmt(tg.fat)} g</small>
      <details><summary>Détail moyen / jour (micro inclus)</summary>
        ${nutrientTable(avg, { kcal: tg.kcal, prot: tg.prot, carb: tg.carb, fat: tg.fat })}</details>
    </div>
    ${dayBlocks}`;

  // En-tête du PDF imprimé (document remis au/à la diététicien(ne)).
  $("#print-header").innerHTML = `
    <h1>Kalori Péi — Bilan hebdomadaire</h1>
    <p class="print-sub">Suivi alimentaire · cuisine réunionnaise · valeurs estimées (table CIQUAL/ANSES)</p>
    <p class="print-meta">
       <b>Semaine du ${FMT_SHORT.format(monday)} au ${FMT_SHORT.format(sunday)}</b> —
       document généré le ${new Date().toLocaleDateString("fr-FR")}<br>
       Objectifs journaliers : ${fmt(tg.kcal)} kcal · Protéines ${fmt(tg.prot)} g ·
       Glucides ${fmt(tg.carb)} g · Lipides ${fmt(tg.fat)} g</p>`;
}

/* ---------- Vue Sport : suivi du poids & macros par kg ---------- */
function weightKeysSorted() { return Object.keys(state.weights).sort(); }
function latestWeight() {
  const ks = weightKeysSorted();
  if (ks.length) return state.weights[ks[ks.length - 1]];
  return Number(state.settings.profile.kg) || 0;
}

/* Moyenne des apports sur les n derniers jours réellement renseignés. */
function avgIntake(nDays) {
  const t = emptyTotals();
  let days = 0;
  for (let i = 0; i < nDays; i++) {
    const key = todayKey(-i);
    if ((state.journal[key] || []).length) {
      days++;
      const dt = dayTotals(key);
      NUTRIENT_KEYS.forEach(k => t[k] += dt[k]);
    }
  }
  const avg = {};
  NUTRIENT_KEYS.forEach(k => avg[k] = days ? t[k] / days : 0);
  return { avg, days };
}

/* Graphe d'évolution du poids (SVG, sans dépendance). */
function weightGraphSVG() {
  const ks = weightKeysSorted();
  if (!ks.length) return "";
  const pts = ks.map(k => ({ w: state.weights[k], t: new Date(k + "T12:00:00").getTime() }));
  const W = 320, H = 140, padL = 6, padR = 6, padT = 12, padB = 22;
  const ws = pts.map(p => p.w);
  let min = Math.min(...ws), max = Math.max(...ws);
  if (max - min < 1) { min -= 1; max += 1; } // étale l'axe si poids quasi constant
  const t0 = pts[0].t, t1 = pts[pts.length - 1].t, span = (t1 - t0) || 1;
  const single = pts.length === 1;
  const x = p => single ? W / 2 : padL + (W - padL - padR) * ((p.t - t0) / span);
  const y = w => padT + (H - padT - padB) * (1 - (w - min) / (max - min));
  const coords = pts.map(p => `${x(p).toFixed(1)},${y(p.w).toFixed(1)}`);
  const baseY = (H - padB).toFixed(1);
  const area = single ? "" :
    `<path class="wgraph-area" d="M${coords[0].split(",")[0]},${baseY} L${coords.join(" L")} L${x(pts[pts.length - 1])},${baseY} Z"/>`;
  const line = single ? "" : `<polyline class="wgraph-line" points="${coords.join(" ")}"/>`;
  const dots = pts.map(p => `<circle class="wgraph-dot" cx="${x(p).toFixed(1)}" cy="${y(p.w).toFixed(1)}" r="${single ? 4 : 2.6}"/>`).join("");
  const fmtDate = t => new Date(t).toLocaleDateString("fr-FR", { day: "numeric", month: "short" });
  return `<svg class="wgraph" viewBox="0 0 ${W} ${H}" role="img" aria-label="Évolution du poids">
      <line class="wgraph-grid" x1="${padL}" y1="${padT}" x2="${W - padR}" y2="${padT}"/>
      <line class="wgraph-grid" x1="${padL}" y1="${H - padB}" x2="${W - padR}" y2="${H - padB}"/>
      <text class="wgraph-txt" x="${padL}" y="${padT - 3}">${fmt(max, 1)} kg</text>
      <text class="wgraph-txt" x="${padL}" y="${H - padB + 12}">${fmt(min, 1)} kg</text>
      ${area}${line}${dots}
      <text class="wgraph-txt" x="${padL}" y="${H - 4}">${fmtDate(t0)}</text>
      <text class="wgraph-txt" x="${W - padR}" y="${H - 4}" text-anchor="end">${fmtDate(t1)}</text>
    </svg>`;
}

function renderPoids() {
  const ks = weightKeysSorted();
  const last = latestWeight();
  const goalDir = Number(state.settings.profile.goal) > 0 ? "prise de masse"
    : Number(state.settings.profile.goal) < 0 ? "perte de poids" : "maintien";

  let stats = "";
  if (ks.length >= 2) {
    const first = state.weights[ks[0]], cur = state.weights[ks[ks.length - 1]];
    const delta = cur - first;
    const dayspan = (new Date(ks[ks.length - 1]) - new Date(ks[0])) / 86400000;
    const perWeek = dayspan > 0 ? delta / (dayspan / 7) : 0;
    stats = `<div class="stat-row">
        <div class="stat"><b>${fmt(cur, 1)}</b><small>poids actuel (kg)</small></div>
        <div class="stat ${delta < 0 ? "neg" : ""}"><b>${delta >= 0 ? "+" : ""}${fmt(delta, 1)}</b><small>depuis le début (kg)</small></div>
        <div class="stat ${perWeek < 0 ? "neg" : ""}"><b>${perWeek >= 0 ? "+" : ""}${fmt(perWeek, 2)}</b><small>par semaine (kg)</small></div>
      </div>
      <p class="mk-legend">Objectif réglé : <b>${goalDir}</b>. Repère d'une progression
      maîtrisée : ± 0,25 à 0,5 kg/semaine (au-delà, la prise se fait davantage en gras
      et la perte risque d'entamer le muscle).</p>`;
  } else if (ks.length === 1) {
    stats = `<div class="stat-row"><div class="stat"><b>${fmt(last, 1)}</b><small>poids enregistré (kg)</small></div></div>
      <p class="mk-legend">Enregistrez votre poids régulièrement (1×/semaine, à jeun) pour
      voir la courbe et le rythme apparaître.</p>`;
  }

  const value = ks.length ? "" : (Number(state.settings.profile.kg) || "");
  const content = `
    <div class="card">
      <h2>⚖️ Mon poids</h2>
      <div class="weight-form">
        <label>Poids du jour (kg)
          <input id="weight-input" type="number" min="25" max="350" step="0.1"
                 inputmode="decimal" value="${value}" placeholder="${fmt(last, 1)}">
        </label>
        <button id="weight-save" class="btn primary">Enregistrer</button>
      </div>
      ${ks.length ? weightGraphSVG() + stats : `<div class="empty-state"><span class="emoji">⚖️</span>
        <b>Aucun poids enregistré.</b><br>Saisissez votre poids ci-dessus pour démarrer le suivi.</div>`}
    </div>`;
  $("#sport-content").innerHTML = content;
  const inp = $("#weight-input"), btn = $("#weight-save");
  const save = () => saveTodayWeight(inp.value);
  btn.addEventListener("click", save);
  inp.addEventListener("keydown", e => { if (e.key === "Enter") save(); });
}

function saveTodayWeight(val) {
  const w = Number(val);
  if (!w || w < 25 || w > 350) { alert("Entrez un poids valide (25–350 kg)."); return; }
  const rounded = Math.round(w * 10) / 10;
  state.weights[todayKey()] = rounded;
  saveWeights();
  // On garde le profil à jour : les macros/kg et les objectifs auto suivent le poids réel.
  state.settings.profile.kg = rounded;
  saveSettings();
  renderSport();
}

/* Une ligne « g/kg » avec sa zone recommandée et son statut. */
function macroKgRow(label, cls, val, lo, hi) {
  const maxS = Math.max(hi, val) * 1.25 || 1;
  const pc = v => Math.max(0, Math.min(100, v / maxS * 100));
  let status = "Optimal", scls = "ok";
  if (val < lo) { status = "Faible"; scls = "low"; }
  else if (val > hi) { status = "Élevé"; scls = "high"; }
  return `<div class="mk-row">
      <div class="mk-head"><span class="macro ${cls}">${label}</span>
        <span>${fmt(val, 2)} g/kg</span>
        <span class="mk-status ${scls}">${status}</span></div>
      <div class="mk-track">
        <div class="mk-zone" style="left:${pc(lo)}%;width:${pc(hi) - pc(lo)}%"></div>
        <div class="mk-marker" style="left:${pc(val)}%"></div>
      </div>
      <div class="mk-legend">Recommandé sportif : ${fmt(lo, 1)}–${fmt(hi, 1)} g/kg</div>
    </div>`;
}

function renderMacrosKg() {
  const kg = latestWeight();
  if (!kg) {
    $("#sport-content").innerHTML = `<div class="empty-state"><span class="emoji">⚖️</span>
      <b>Renseignez d'abord votre poids</b><br>(onglet « Poids ») pour calculer vos
      apports par kilo de poids de corps.</div>`;
    return;
  }
  const { avg, days } = avgIntake(7);
  if (!days) {
    $("#sport-content").innerHTML = `<div class="empty-state"><span class="emoji">🍽️</span>
      <b>Aucun repas saisi ces 7 derniers jours.</b><br>Composez vos plats dans l'onglet
      Saisie pour voir vos apports par kilo.</div>`;
    return;
  }
  const protKg = avg.prot / kg, carbKg = avg.carb / kg, fatKg = avg.fat / kg;
  $("#sport-content").innerHTML = `
    <div class="card">
      <h2>🍗 Apports par kg de poids</h2>
      <p class="mk-legend">Moyenne des <b>${days} jour${days > 1 ? "s" : ""}</b> renseigné${days > 1 ? "s" : ""}
        sur les 7 derniers, rapportée à <b>${fmt(kg, 1)} kg</b> de poids de corps.</p>
      ${macroKgRow("Protéines", "p", protKg, 1.6, 2.2)}
      ${macroKgRow("Glucides", "g", carbKg, 3, 6)}
      ${macroKgRow("Lipides", "l", fatKg, 0.8, 1.2)}
      <p class="mk-legend">Repères pour la prise de muscle (consensus ISSN 2017 / EFSA) :
        protéines <b>1,6–2,2 g/kg</b>, glucides <b>3–6 g/kg</b> (plus si entraînement
        volumineux), lipides ≥ <b>0,8 g/kg</b> (santé hormonale). À individualiser avec
        votre diététicien(ne).</p>
    </div>
    <div class="card">
      <h3>Apports moyens / jour (${days} j)</h3>
      <div class="macros-line center">
        <span class="kcal-big">${fmt(avg.kcal)} kcal</span>
        <span class="macro p">P ${fmt(avg.prot)} g</span>
        <span class="macro g">G ${fmt(avg.carb)} g</span>
        <span class="macro l">L ${fmt(avg.fat)} g</span>
      </div>
    </div>`;
}

function renderSport() {
  $("#sport-tab-poids").classList.toggle("active", state.sportTab === "poids");
  $("#sport-tab-macros").classList.toggle("active", state.sportTab === "macros");
  if (state.sportTab === "macros") renderMacrosKg();
  else renderPoids();
}

/* ---------- Vue Réglages ---------- */
function renderReglages() {
  const s = state.settings;
  $("#mode-manual").checked = s.mode === "manual";
  $("#mode-calc").checked = s.mode === "calc";
  $("#manual-form").hidden = s.mode !== "manual";
  $("#calc-form").hidden = s.mode !== "calc";

  $("#t-kcal").value = s.targets.kcal; $("#t-prot").value = s.targets.prot;
  $("#t-carb").value = s.targets.carb; $("#t-fat").value = s.targets.fat;

  const p = s.profile;
  $("#p-sex").value = p.sex; $("#p-age").value = p.age; $("#p-kg").value = p.kg;
  $("#p-cm").value = p.cm; $("#p-pal").value = p.pal; $("#p-goal").value = p.goal;
  $("#p-protmode").value = p.protMode || "anses";

  if (s.mode === "calc") {
    const t = computeTargets(p);
    const sport = (p.protMode || "anses") === "sport";
    const reparti = sport
      ? `répartition sportive (protéines ${fmt(t.prot)} g ≈ 1,8 g/kg de poids,
         lipides 30 %, glucides le reste pour l'entraînement)`
      : `répartition ANSES 2021 (protéines 15 %, lipides 37,5 %,
         glucides 47,5 % de l'apport énergétique)`;
    $("#calc-result").innerHTML =
      `<b>Objectifs calculés :</b> ${fmt(t.kcal)} kcal/j — Protéines ${fmt(t.prot)} g ·
       Glucides ${fmt(t.carb)} g · Lipides ${fmt(t.fat)} g
       <br><small>Méthode : métabolisme de base Mifflin-St Jeor (1990) × niveau
       d'activité (FAO/OMS), ${reparti}. ⚠️ Ces formules valent pour un
       adulte en bonne santé : en cas de perte de poids encadrée, de plus de
       65 ans ou de pathologie, les besoins (notamment en protéines) diffèrent —
       utilisez la saisie manuelle avec les valeurs de votre diététicien(ne),
       qui restent prioritaires.</small>`;
  } else $("#calc-result").innerHTML = "";
}

function bindReglages() {
  $("#mode-manual").addEventListener("change", () => { state.settings.mode = "manual"; saveSettings(); renderReglages(); });
  $("#mode-calc").addEventListener("change", () => { state.settings.mode = "calc"; saveSettings(); renderReglages(); });
  ["kcal", "prot", "carb", "fat"].forEach(k => {
    $("#t-" + k).addEventListener("change", e => {
      state.settings.targets[k] = Number(e.target.value) || 0; saveSettings();
    });
  });
  [["sex", "p-sex"], ["age", "p-age"], ["kg", "p-kg"], ["cm", "p-cm"], ["pal", "p-pal"], ["goal", "p-goal"], ["protMode", "p-protmode"]]
    .forEach(([k, id]) => {
      $("#" + id).addEventListener("change", e => {
        // sex et protMode sont des chaînes ; les autres champs sont numériques.
        state.settings.profile[k] = (k === "sex" || k === "protMode") ? e.target.value : Number(e.target.value);
        saveSettings(); renderReglages();
      });
    });

  $("#export-data").addEventListener("click", () => {
    const blob = new Blob([JSON.stringify({
      settings: state.settings, journal: state.journal,
      customFoods: state.customFoods, weights: state.weights,
    }, null, 2)], { type: "application/json" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = "kalori-pei-sauvegarde-" + todayKey() + ".json";
    a.click();
  });
  $("#import-data").addEventListener("change", e => {
    const file = e.target.files[0]; if (!file) return;
    file.text().then(txt => {
      const data = JSON.parse(txt);
      if (data.journal) { state.journal = data.journal; saveJournal(); }
      if (data.settings) { state.settings = data.settings; saveSettings(); }
      if (data.customFoods) { state.customFoods = data.customFoods; saveCustomFoods(); }
      if (data.weights) { state.weights = data.weights; saveWeights(); }
      alert("Données importées ✅"); renderReglages();
    }).catch(() => alert("Fichier invalide"));
  });
  $("#reset-data").addEventListener("click", () => {
    if (confirm("Effacer TOUT l'historique de repas ? (les réglages sont conservés)")) {
      state.journal = {}; saveJournal(); alert("Historique effacé");
    }
  });
}

/* ---------- Aliment personnalisé & photos ---------- */
function openCustomFoodForm() {
  openModal(`
    <h2>➕ Nouvel aliment</h2>
    <form id="custom-food-form" class="form-grid">
      <label>Nom <input name="name" required placeholder="Ex : Cari bichiques"></label>
      <label>Émoji <input name="emoji" value="🍽️" maxlength="4"></label>
      <label>Portion <input name="portion" required placeholder="Ex : 1 assiette (200 g)"></label>
      <label>Calories (kcal) <input name="kcal" type="number" step="1" required></label>
      <label>Protéines (g) <input name="prot" type="number" step="0.1" value="0"></label>
      <label>Glucides (g) <input name="carb" type="number" step="0.1" value="0"></label>
      <label>Lipides (g) <input name="fat" type="number" step="0.1" value="0"></label>
      <label>Photo (optionnel) <input name="photo" type="file" accept="image/*" capture="environment"></label>
      <button class="btn primary" type="submit">Enregistrer</button>
      <button class="btn" type="button" onclick="closeModal()">Annuler</button>
    </form>`);
  $("#custom-food-form").addEventListener("submit", async e => {
    e.preventDefault();
    const fd = new FormData(e.target);
    const id = "perso_" + Date.now();
    const food = { id, cat: "perso", emoji: fd.get("emoji") || "🍽️", name: fd.get("name"), portion: fd.get("portion") };
    ["kcal", "prot", "carb", "fat"].forEach(k => food[k] = Number(fd.get(k)) || 0);
    ["fibre", "sugar", "sat", "salt", "ca", "fe", "mg", "k", "vitc"].forEach(k => food[k] = 0);
    const photo = fd.get("photo");
    if (photo && photo.size) {
      try { state.photos[id] = await resizeImage(photo, 256); savePhotos(); } catch { /* photo ignorée */ }
    }
    state.customFoods.push(food); saveCustomFoods();
    closeModal(); renderSaisie();
  });
}

function openFoodPhotoForm(foodId) {
  const f = foodById(foodId);
  if (!f) return;
  openModal(`
    <h2>${esc(f.emoji)} ${esc(f.name)}</h2>
    <p>${esc(f.portion)} — ${fmt(f.kcal)} kcal / dose</p>
    ${nutrientTable(f)}
    <label class="btn">📷 ${state.photos[foodId] ? "Changer la" : "Ajouter une"} photo
      <input id="photo-input" type="file" accept="image/*" capture="environment" hidden></label>
    ${state.photos[foodId] ? `<button class="btn" id="photo-del">Retirer la photo</button>` : ""}
    ${f.cat === "perso" ? `<button class="btn danger" id="food-del">Supprimer cet aliment</button>` : ""}
    <button class="btn primary" onclick="closeModal()">Fermer</button>`);
  $("#photo-input").addEventListener("change", async e => {
    const file = e.target.files[0]; if (!file) return;
    try {
      state.photos[foodId] = await resizeImage(file, 256);
      savePhotos(); closeModal(); renderSaisie();
    } catch { alert("Impossible de charger la photo"); }
  });
  const del = $("#photo-del");
  if (del) del.addEventListener("click", () => {
    delete state.photos[foodId]; savePhotos(); closeModal(); renderSaisie();
  });
  const fdel = $("#food-del");
  if (fdel) fdel.addEventListener("click", () => {
    if (!confirm("Supprimer « " + f.name + " » ?")) return;
    state.customFoods = state.customFoods.filter(x => x.id !== foodId);
    delete state.photos[foodId];
    // On le retire aussi du plat en cours pour ne pas garder une référence morte.
    state.currentMeal = state.currentMeal.filter(i => i.foodId !== foodId);
    saveCustomFoods(); savePhotos(); closeModal(); renderSaisie();
  });
}

function resizeImage(file, size) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      const c = document.createElement("canvas");
      const ratio = Math.max(size / img.width, size / img.height);
      c.width = size; c.height = size;
      const w = img.width * ratio, h = img.height * ratio;
      c.getContext("2d").drawImage(img, (size - w) / 2, (size - h) / 2, w, h);
      resolve(c.toDataURL("image/jpeg", 0.7));
    };
    img.onerror = reject;
    img.src = URL.createObjectURL(file);
  });
}

/* ---------- Modale ---------- */
function openModal(html) {
  $("#modal-content").innerHTML = html;
  $("#modal").hidden = false;
}
function closeModal() { $("#modal").hidden = true; }

/* ================= Événements ================= */
let pressTimer = null;
function bindEvents() {
  views.forEach(v => $("#nav-" + v).addEventListener("click", () => showView(v)));

  $("#cat-bar").addEventListener("click", e => {
    const chip = e.target.closest("[data-cat]");
    if (chip) { state.activeCat = chip.dataset.cat; renderSaisie(); }
  });
  $("#food-search").addEventListener("input", renderSaisie);

  // Appui court = ajouter une dose ; appui long (500 ms) = fiche aliment / photo.
  const grid = $("#tile-grid");
  grid.addEventListener("pointerdown", e => {
    const tile = e.target.closest("[data-food]");
    if (!tile) return;
    clearTimeout(pressTimer); // sécurité multi-touch : ne pas perdre un minuteur en cours
    pressTimer = setTimeout(() => {
      pressTimer = null;
      openFoodPhotoForm(tile.dataset.food);
    }, 500);
  });
  ["pointerup", "pointerleave", "pointercancel"].forEach(ev =>
    grid.addEventListener(ev, e => {
      if (ev === "pointerup" && pressTimer) {
        const tile = e.target.closest("[data-food]");
        if (tile) tapTile(tile.dataset.food);
      }
      clearTimeout(pressTimer); pressTimer = null;
    }));
  grid.addEventListener("click", e => {
    if (e.target.closest("#tile-add-custom")) openCustomFoodForm();
  });

  $("#meal-tray").addEventListener("click", e => {
    const btn = e.target.closest("[data-act]");
    if (btn) adjustQty(btn.dataset.food, btn.dataset.act);
  });
  $("#validate-meal").addEventListener("click", validateMeal);
  $("#clear-meal").addEventListener("click", () => { state.currentMeal = []; renderSaisie(); });

  $("#jour-prev").addEventListener("click", () => { state.dayOffset--; renderJour(); });
  $("#jour-next").addEventListener("click", () => { state.dayOffset++; renderJour(); });
  $("#jour-meals").addEventListener("click", e => {
    const btn = e.target.closest("[data-delmeal]");
    if (!btn) return;
    const key = todayKey(state.dayOffset);
    if (confirm("Supprimer ce repas ?")) {
      state.journal[key] = (state.journal[key] || []).filter(m => m.id !== Number(btn.dataset.delmeal));
      saveJournal(); renderJour();
    }
  });

  $("#sport-tab-poids").addEventListener("click", () => { state.sportTab = "poids"; renderSport(); });
  $("#sport-tab-macros").addEventListener("click", () => { state.sportTab = "macros"; renderSport(); });

  $("#semaine-prev").addEventListener("click", () => { state.weekOffset--; renderSemaine(); });
  $("#semaine-next").addEventListener("click", () => { state.weekOffset++; renderSemaine(); });
  $("#download-pdf").addEventListener("click", () => {
    // Ouvre tous les détails pour qu'ils figurent dans le PDF.
    document.querySelectorAll("#view-semaine details").forEach(d => d.open = true);
    window.print();
  });

  $("#modal").addEventListener("click", e => { if (e.target.id === "modal") closeModal(); });

  bindReglages();
}

/* ---------- Aide au premier lancement ---------- */
function initFirstHint() {
  const banner = $("#first-hint");
  if (!banner) return;
  // Affiché tant qu'aucun repas n'a été validé et que l'aide n'a pas été fermée.
  const seen = Store.get("fc_hintSeen", false);
  if (!seen && !Object.keys(state.journal).length) banner.hidden = false;
  $("#first-hint-close").addEventListener("click", () => {
    banner.hidden = true;
    Store.set("fc_hintSeen", true);
  });
}

/* ================= Init ================= */
document.addEventListener("DOMContentLoaded", () => {
  $("#meal-type").value = mealTypeForNow();
  bindEvents();
  initFirstHint();
  showView("saisie");
  if ("serviceWorker" in navigator) {
    navigator.serviceWorker.register("./sw.js").catch(() => { /* hors PWA */ });
  }
});
