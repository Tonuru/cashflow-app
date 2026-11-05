// Versione Tania (libera professione): mese per mese e panoramica dell'anno, come sul PC
// (cashflow/ui/pages/tania.py). Sedute per paziente, tasse e contributi ENPAP con gli indici dell'anno,
// stipendio dalla professione = netto del mese prima, Educativa, Altri ingressi, Spese.
import * as D from "../data.js";
import * as M from "../model.js";
import { h, C, moneyColor, monthNav, bars, sheet, toast, busy, fill, dateField } from "../ui.js";
import { movimentoSheet, vociSheet, addedList } from "../forms.js";
import { moneyHero, pctShort, catsCard, vociCard, openFolds, pageTabs, monthsTable } from "./parts.js";
import { fisseCard, budgetCard, scadenzeCard } from "./mensile.js";
import { seduteCard, sogliaCard, tasseCard } from "./funzioni.js";
import { semaforoLine } from "../semafori.js";

const eduMonths = new Set();   // mesi in cui Tania ha acceso l'Educativa (solo finché l'app è aperta)
const nextMonth = (y, m) => (m === 12 ? [y + 1, 1] : [y, m + 1]);
const prevMonth = (y, m) => (m === 1 ? [y - 1, 12] : [y, m - 1]);
const pct = (v) => `${(v * 100).toFixed(1).replace(/\.0$/, "").replace(".", ",")}%`;
const lower = (i) => M.MESI[i - 1].toLowerCase();

/** Tabella a due colonne (voce / importo) con righe di totale evidenziate. */
function conti(rows) {
  return h("div.conti", {}, rows.map(([name, sub, v, opt = {}]) => h("div.conto" + (opt.tot ? ".tot" : ""), {},
    h("div", {}, h("div.conto-n", {}, name), sub ? h("div.conto-s", {}, sub) : null),
    h("div.conto-v", { style: { color: opt.color || (opt.sign ? moneyColor(v) : v ? C.text : C.muted) } },
      M.fmtEur(v, !!opt.sign)))));
}

// ---------------------------------------------------------------- mese per mese
export function renderMese(root, rerender, view) {
  const { y, m } = view;
  const t = D.taniaMonth(y, m);
  const p = t.prof;
  const ind = D.indici(y);
  const movs = D.allMovs(y);
  const inMonth = (pred) => movs.filter((x) => M.inMonth(x.data, y, m) && !M.isAnnual(x) && pred(x))
    .sort((a, b) => (b.data || "").localeCompare(a.data || ""));
  const [ny, nm] = nextMonth(y, m), [py, pm] = prevMonth(y, m);

  const top = h("div.page-top", {}, monthNav(y, m, (yy, mm) => { view.y = yy; view.m = mm; rerender(); }));
  // «T1 · Come sul PC»: fascia verde con quanto rimane ed Entrato · Uscito · Rimane
  const hero = moneyHero("Ti rimane · entrate − spese", t.rimane, t.entrate, t.spese,
    [["Entrato", M.fmtEur(t.entrate)], ["Uscito", M.fmtEur(t.spese)], ["Rimane", pctShort(t.rimane, t.entrate)]]);
  // pazienti del mese (la griglia del vecchio file)
  const paz = M.pazienti(movs, y, m);
  const importi = (rows) => {
    const v = rows.map((r) => Number(r.importo || 0));
    return v.every((x) => Math.abs(x - v[0]) < 0.005) ? `${v.length} × ${M.fmtEur(v[0])}`
      : v.map((x) => M.fmtEur(x).replace(" €", "")).join(" · ") + " €";
  };
  const nSed = paz.reduce((a, [, rows]) => a + rows.length, 0);
  const pazCard = h("div.card", { "data-fold": "pazienti" },
    h("div.card-title.row.between", {}, h("span", {}, "Pazienti del mese"),
      h("span.big-green", {}, paz.length ? `${paz.length} · ${nSed} sedute` : "")),
    h("label.check.paz-eye", { onclick: (e) => e.stopPropagation() },
      h("input", { type: "checkbox", checked: D.showPaz(), onchange: (e) => D.setShowPaz(e.target.checked) }),
      " 👁 Mostra i nomi dei pazienti"),
    paz.length ? h("div.list", {}, paz.map(([name, rows, tot]) => h("button.item.paz", { type: "button",
      onclick: () => vociSheet(`${D.pazName(name)} · ${M.MESI[m - 1]}`, rows, { onTap: (x) => openTania(x, rerender) }) },
    h("div.item-main", {}, h("div.item-title", {}, D.pazName(name)), h("div.item-sub", {}, importi(rows))),
    h("div.item-amt", { style: { color: C.green } }, M.fmtEur(tot)))),
    h("div.paz-tot", {}, h("span", {}, `Totale (${paz.length} pazienti, ${nSed} sedute)`),
      h("b", { style: { color: C.green } }, M.fmtEur(p.incasso))))
      : h("div.empty", {}, "Nessuna seduta in questo mese."),
    h("button.btn.primary.wide", { onclick: () => sedutaSheet(defaultDate(view), "", rerender) }, "＋ Aggiungi seduta"),
    h("div.muted.small.center", {}, "Tocca un paziente per vedere le sue sedute."));

  const contiCard = h("div.card", { "data-fold": "conti" },
    h("div.card-title", {}, "Conti della libera professione"),
    conti([
      ["Incasso lordo", `${p.sedute} sedute`, p.incasso, { color: C.green }],
      ["− Contributo soggettivo ENPAP", `incasso × ${pct(ind.coef)} × ${pct(ind.sogg)}`, -p.soggettivo, { color: C.red }],
      ["− Contributo integrativo ENPAP", `incasso × ${pct(ind.integr)}`, -p.integrativo, { color: C.red }],
      ["− Imposta", `incasso × ${pct(ind.coef)} × ${pct(ind.aliq)}`, -p.imposta, { color: C.red }],
      ["= Netto da tasse", `tasse in tutto ${M.fmtEur(p.tasse)}`, p.netto_tasse, { tot: true, sign: true }],
      ["− Spese professionali", "studio, Fiscozen, Guida Psi…", -p.spese_prof, { color: C.red }],
      ["= Netto della professione", "", p.netto, { tot: true, sign: true }],
    ]),
    h("div.muted.small", {}, `Diventa lo stipendio di ${lower(nm)} ${ny}: ${M.fmtEur(Math.max(0, p.netto))}`
      + (p.netto < 0 ? " (il netto è negativo: niente stipendio)" : "") + `. Indici del ${y}: si cambiano dal PC.`));

  // Educativa: spenta di base, si accende mese per mese (o è stata tolta per sempre dal PC)
  const removed = D.eduRemoved();
  const eduRows = inMonth((x) => x.tipo === M.T.STIPENDIO);
  const key = `${y}-${m}`;
  const showEdu = !removed && (eduRows.length > 0 || eduMonths.has(key));
  const eduChip = removed ? null : h("button.chip" + (showEdu ? ".on" : ""), {
    disabled: eduRows.length > 0,
    onclick: () => { if (eduMonths.has(key)) eduMonths.delete(key); else eduMonths.add(key); rerender(); },
  }, (showEdu ? "✓ " : "") + "Educativa in questo mese");
  const newMov = (tipo, categoria) => () => movimentoSheet({ tipo, data: defaultDate(view), categoria }, { onDone: rerender });
  const addSeduta = () => sedutaSheet(defaultDate(view), "", rerender);
  const addEdu = () => { eduMonths.add(key); newMov(M.T.STIPENDIO, M.CAT_EDUCATIVA)(); };

  // «Il mese»: i riquadri delle entrate e della professione (come sul PC), tocco = le voci, ＋ = aggiungi
  const sedRows = inMonth(M.isProfIncome), profRows = inMonth(M.isProfCost);
  const altRows = inMonth((x) => x.tipo === M.T.ENTRATA && !M.isProfIncome(x));
  const tile = (icon, bg, name, sub, v, color, rows, add, title) => h("div.tt-row", {},
    h("button.tt-main", { onclick: rows ? () => vociSheet(title || name, rows, { onTap: (x) => openTania(x, rerender) }) : null },
      h("i.tt-ic", { style: { background: bg } }, icon),
      h("div.tt-mid", {}, h("div.tt-n", {}, name), sub ? h("div.tt-s", {}, sub) : null),
      h("b.tt-v", { style: { color: v ? color : C.muted } }, M.fmtEur(v))),
    add ? h("button.tt-add", { onclick: add, "aria-label": `Aggiungi: ${name}` }, "＋") : null);
  const npaz = new Set(sedRows.map((x) => x.sottocategoria || "")).size;
  const tiles = h("div.card", {}, h("div.card-title", {}, `${M.MESI[m - 1]} in breve`),
    tile("🧠", "#173326", "Sedute", sedRows.length ? `${p.sedute} sedute · ${npaz} pazient${npaz === 1 ? "e" : "i"}` : "nessuna seduta",
      p.incasso, C.green, sedRows, addSeduta),
    tile("💼", "#3A1E22", "Spese professionali", "studio, Fiscozen, Guida Psi…", p.spese_prof, C.red, profRows,
      newMov(M.T.USCITA, M.CAT_SPESE_PROF)),
    tile("💰", "#1E2D4A", "Stipendio dalla professione", `netto di ${lower(pm)} ${py}`, t.stip_prof, C.green, null, null),
    showEdu || t.educativa ? tile("🏫", "#2A1F3D", "Educativa", "", t.educativa, C.green, eduRows, addEdu) : null,
    tile("💶", "#3A2E14", "Altri ingressi", "famiglia, tredicesima, NASpI…", t.altri, C.green, altRows, newMov(M.T.ENTRATA)),
    eduChip ? h("div.center", { style: { marginTop: "8px" } }, eduChip) : null);

  const spMovs = M.personalSpese(movs);
  const cats = catsCard(spMovs, y, m, rerender, openTania);
  const voci = vociCard(M.filterMovs(movs, { year: y, month: m }), view, rerender, openTania);
  const btns = h("div.mbtns", {},
    h("button.mb-sed", { onclick: addSeduta }, "＋ Seduta"),
    h("button.mb-spesa", { onclick: newMov(M.T.USCITA) }, "＋ Spesa"),
    h("button.mb-ent", { onclick: () => entrataMenu(removed, addEdu, newMov(M.T.ENTRATA), newMov(M.T.USCITA, M.CAT_SPESE_PROF)) },
      "＋ Entrata"));
  const sed = seduteCard(rerender);
  if (sed) sed.dataset.keep = "";
  fill(root, top, hero, sed, ...openFolds([[budgetCard(y, m), "budget"], [scadenzeCard(rerender), "scadenze"],
    [tiles, "inbreve"], [pazCard, "pazienti"], [contiCard, "conti"], [cats, "categorie"],
    [fisseCard("personal", y, m, rerender), "fisse"], [voci, "voci"]]), btns);
}

function entrataMenu(removed, addEdu, addAltri, addProf) {
  const s = sheet("Aggiungi");
  const pick = (fn) => () => { s.close(); fn(); };
  fill(s.body, h("div.ent-pick", {},
    removed ? null : h("button.btn", { onclick: pick(addEdu) }, "🏫 Educativa"),
    h("button.btn", { onclick: pick(addAltri) }, "💶 Altri ingressi"),
    h("button.btn", { onclick: pick(addProf) }, "💼 Spesa professionale")),
  h("p.muted.small.center", {}, "Le sedute si aggiungono con «＋ Seduta»."));
}

function defaultDate(view) {
  const t = M.todayIso();
  return Number(t.slice(0, 4)) === view.y && Number(t.slice(5, 7)) === view.m ? t
    : `${view.y}-${String(view.m).padStart(2, "0")}-01`;
}

function openTania(x, rerender) {
  // le spese comuni si aprono dalla scheda Comuni; le altre voci si modificano qui
  if (x.origine === M.ORIGINE_COMUNE) { toast("Spesa comune: si modifica dalla scheda Comuni"); return; }
  movimentoSheet(x, { onDone: rerender });
}

/** Nuove sedute: paziente (anche nuovo), data, importo (proposto quello dell'ultima seduta del paziente). */
export function sedutaSheet(data, paziente, rerender) {
  const s = sheet("Aggiungi sedute");
  const all = D.allMovsEveryYear().filter(M.isProfIncome)
    .sort((a, b) => (b.data + (b.inserito || "")).localeCompare(a.data + (a.inserito || "")));
  const lastFee = new Map();
  for (const m of all) if (m.sottocategoria && !lastFee.has(m.sottocategoria)) lastFee.set(m.sottocategoria, Number(m.importo || 0));
  // nomi nascosti: nell'elenco «Paziente N», ma la seduta si salva col nome vero
  const alias = new Map([...lastFee.keys()].filter((p) => D.pazName(p) !== p).map((p) => [D.pazName(p), p]));
  const real = (t) => { t = (t || "").trim(); return alias.get(t) || t; };
  const pazName = (p) => D.pazName(p);
  const fPaz = h("input", { type: "text", list: "dl-paz", autocomplete: "off", value: paziente ? D.pazName(paziente) : "",
    placeholder: "Nome o iniziali (anche nuovo)" });
  const fData = dateField(data);
  const fImp = h("input", { type: "text", inputmode: "decimal", placeholder: "0,00", autocomplete: "off" });
  const setFee = () => { const f = lastFee.get(real(fPaz.value)); if (f) fImp.value = String(f).replace(".", ","); };
  fPaz.addEventListener("change", setFee);
  fPaz.addEventListener("input", setFee);
  setFee();
  const err = h("div.form-err");
  const added = addedList("personal");
  const unpaidOn = D.feature("sedute_attive");
  const fUnpaid = h("input", { type: "checkbox" });
  const add = async (close) => {
    const paz = real(fPaz.value), imp = M.parseAmount(fImp.value);
    if (!paz) { err.textContent = "Scrivi il paziente (nome o iniziali)."; return; }
    if (imp == null || imp <= 0) { err.textContent = "Scrivi l'importo della seduta (es. 45)."; return; }
    if (!fData.value) { err.textContent = "Scegli la data."; return; }
    err.textContent = "";
    const full = await D.addMov("personal", { data: fData.value, tipo: M.T.ENTRATA, importo: imp, categoria: M.CAT_PROFESSIONE,
      sottocategoria: paz, descrizione: "Seduta", metodo: "", note: "", origine: "iPhone",
      ...(unpaidOn && fUnpaid.checked ? { incasso: "no" } : {}) });
    lastFee.set(paz, imp);
    added.add(full, { title: pazName(paz), sub: M.fmtDate(full.data).slice(0, 5) + (full.incasso === "no" ? " · da incassare" : ""),
      color: C.green });
    toast("Seduta salvata ✓", "ok");
    rerender();
    if (close) s.close(); else { fPaz.value = ""; fImp.value = ""; fPaz.focus(); }
  };
  const bMore = h("button.btn", { type: "button" }, "Salva e aggiungi altra");
  bMore.onclick = () => busy(bMore, add(false));
  const bSave = h("button.btn.primary", { type: "button" }, "Salva");
  bSave.onclick = () => busy(bSave, add(true));
  const names = [...lastFee.keys()].map((p) => D.pazName(p)).sort((a, b) => a.toLowerCase().localeCompare(b.toLowerCase()));
  fill(s.body, semaforoLine("personal"),
    h("label.field", {}, h("span", {}, "Paziente"), fPaz, h("datalist", { id: "dl-paz" }, names.map((n) => h("option", { value: n })))),
    h("div.grid2", {}, h("div.field", {}, h("span", {}, "Data"), fData), h("label.field", {}, h("span", {}, "Importo €"), fImp)),
    unpaidOn ? h("label.check", {}, fUnpaid, " Non ancora pagata (da incassare)") : null,
    err, h("div.row.gap.actions", {}, bMore, bSave), added.el);
  setTimeout(() => (paziente ? fImp : fPaz).focus(), 300);
}

// ---------------------------------------------------------------- panoramica dell'anno
export function renderAnno(root, rerender, view, goMonth) {
  const y = view.y;
  const months = Array.from({ length: 12 }, (_, i) => D.taniaMonth(y, i + 1));
  const today = new Date();
  const sel = y === today.getFullYear() ? today.getMonth() : -1;
  const tot = { inc: 0, tax: 0, spp: 0, net: 0, edu: 0, stp: 0, alt: 0, ent: 0, spe: 0, rim: 0 };
  let prog = 0;
  const rowsData = months.map((t, i) => {
    const p = t.prof;
    const v = { inc: p.incasso, tax: p.tasse, spp: p.spese_prof, net: p.netto, edu: t.educativa, stp: t.stip_prof,
      alt: t.altri, ent: t.entrate, spe: t.spese, rim: t.rimane };
    const has = !!(p.incasso || p.spese_prof || t.entrate || t.spese);
    for (const k in tot) tot[k] += v[k];
    if (has) prog += t.rimane;
    const past = y < today.getFullYear() || (y === today.getFullYear() && i <= today.getMonth());
    return { ...v, prog, has, past };
  });
  const ind = D.indici(y);

  const top = h("div.page-top", {}, monthNav(y, 1, (yy) => { view.y = yy; rerender(); }, { yearOnly: true }));
  const nmesi = y < today.getFullYear() ? 12 : y === today.getFullYear() ? today.getMonth() + 1 : 0;
  // fascia verde come «Mese per mese» (A1) e schede (A3)
  const hero = moneyHero(`Nel ${y} ti rimane · entrate − spese`, tot.rim, tot.ent, tot.spe,
    [["Entrato", M.fmtEur(tot.ent)], ["Uscito", M.fmtEur(tot.spe)], ["Al mese", nmesi ? M.fmtEur(tot.rim / nmesi, true) : "—"]]);
  const [tabs, tab] = pageTabs([["mesi", "Mesi"], ["professione", "Professione"], ["categorie", "Categorie"], ["anni", "Anni"]],
    view, rerender);

  let body;
  if (tab === "mesi") {
    const chart = h("div.card", {}, h("div.card-title", {}, "Mese per mese"),
      bars(months.map((t, i) => ({ label: M.MESI_BREVI[i][0], a: t.entrate, b: t.spese })), { sel, onPick: (i) => goMonth(y, i + 1) }),
      h("div.legend", {}, h("i", { style: { color: C.green } }, "■ "), "Entrate", h("i", { style: { color: C.red } }, "  ■ "),
        "Spese — tocca un mese per aprirlo"));
    const rows = months.map((t, i) => (rowsData[i].has || i === sel
      ? { name: M.MESI_BREVI[i], ent: t.entrate, spe: t.spese, rim: t.rimane, has: rowsData[i].has, sel: i === sel,
        onclick: () => goMonth(y, i + 1) } : null)).filter(Boolean);
    body = [chart, monthsTable(rows, { ent: tot.ent, spe: tot.spe, rim: tot.rim })];
  } else if (tab === "professione") {
    const riep = h("div.card", {}, h("div.card-title", {}, `Libera professione ${y}`),
      conti([
        ["Incasso lordo", "tutte le sedute dell'anno", tot.inc, { color: C.green }],
        ["− Tasse e contributi", `coeff. ${pct(ind.coef)} · ENPAP ${pct(ind.sogg)} + ${pct(ind.integr)} · imposta ${pct(ind.aliq)}`,
          -tot.tax, { color: C.red }],
        ["− Spese professionali", "", -tot.spp, { color: C.red }],
        ["= Netto della professione", "", tot.net, { tot: true, sign: true }],
      ]),
      h("div.card-title", { style: { marginTop: "12px" } }, "Entrate dell'anno"),
      conti([
        ...(D.eduRemoved() ? [] : [["Educativa", "", tot.edu, { color: tot.edu ? C.green : C.muted }]]),
        ["Stipendio dalla professione", "il netto del mese prima", tot.stp, { color: tot.stp ? C.green : C.muted }],
        ["Altri ingressi", "", tot.alt, { color: tot.alt ? C.green : C.muted }],
        ["Totale", "", tot.ent, { tot: true, color: C.green }],
      ]));
    const indCard = h("div.card", {}, h("div.card-title", {}, `Indici di tasse e contributi ${y}`),
      h("div.conti", {}, M.INDICI.map(([k, label]) => h("div.conto", {}, h("div.conto-n", {}, label),
        h("div.conto-v", {}, pct(ind[k]))))),
      h("div.muted.small", {}, "Si cambiano dal PC: Impostazioni → Lavoro ed educativa."));
    body = [riep, sogliaCard(y), tasseCard(y, rerender), indCard];
  } else if (tab === "categorie") {
    body = [catsCard(M.personalSpese(D.allMovs(y)), y, null, rerender, openTania)];
  } else {
    const ys = [...new Set([...D.years("personal"), ...D.years("comune")])].sort();
    const series = ys.map((yy) => {
      let a = 0, b = 0;
      for (let i = 1; i <= 12; i++) { const t = D.taniaMonth(yy, i); a += t.entrate; b += t.spese; }
      return { label: String(yy).slice(2), a, b, y: yy };
    });
    body = [h("div.card", {}, h("div.card-title", {}, "Anno per anno"),
      series.length > 1 ? bars(series, { onPick: (i) => { view.y = series[i].y; view.tab = "mesi"; rerender(); }, height: 140 })
        : h("div.empty", {}, "Ancora un anno solo."),
      h("div.legend", {}, "Entrate e spese di ogni anno — tocca un anno per aprirlo"))];
  }
  for (const c of body) if (c) c.dataset.keep = "";   // dentro le schede i riquadri restano aperti
  fill(root, top, hero, tabs, ...body);
}
