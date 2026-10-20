// Versione Tania (libera professione): mese per mese e panoramica dell'anno, come sul PC
// (cashflow/ui/pages/tania.py). Sedute per paziente, tasse e contributi ENPAP con gli indici dell'anno,
// stipendio dalla professione = netto del mese prima, Educativa, Altri ingressi, Spese.
import * as D from "../data.js";
import * as M from "../model.js";
import { h, C, moneyColor, monthNav, donut, bars, sheet, toast, busy, fill } from "../ui.js";
import { movimentoSheet, vociSheet, movRow } from "../forms.js";

const eduMonths = new Set();   // mesi in cui Tania ha acceso l'Educativa (solo finché l'app è aperta)
const nextMonth = (y, m) => (m === 12 ? [y + 1, 1] : [y, m + 1]);
const prevMonth = (y, m) => (m === 1 ? [y - 1, 12] : [y, m - 1]);
const pct = (v) => `${(v * 100).toFixed(1).replace(/\.0$/, "").replace(".", ",")}%`;
const lower = (i) => M.MESI[i - 1].toLowerCase();

function heroBox(title, v, entrate, cap) {
  const pc = M.pctText(v, entrate);
  return h("div.hero" + (v > 0.004 ? ".pos" : v < -0.004 ? ".neg" : ""), {},
    h("div.hero-mid", {}, h("div.hero-title", {}, title),
      h("div.hero-val", { style: { color: moneyColor(v) } }, M.fmtEur(v, true)),
      h("div.hero-sub", {}, pc ? h("b", { style: { color: moneyColor(v) } }, pc) : null),
      h("div.hero-cap", {}, cap)));
}
const stat = (t, v, color, sub, onclick) => h(onclick ? "button.stat" : "div.stat", { onclick },
  h("div.stat-t", {}, t), h("div.stat-v", { style: { color } }, v), sub ? h("div.stat-s", {}, sub) : null);

/** Tabella a due colonne (voce / importo) con righe di totale evidenziate. */
function conti(rows) {
  return h("div.conti", {}, rows.map(([name, sub, v, opt = {}]) => h("div.conto" + (opt.tot ? ".tot" : ""), {},
    h("div", {}, h("div.conto-n", {}, name), sub ? h("div.conto-s", {}, sub) : null),
    h("div.conto-v", { style: { color: opt.color || (opt.sign ? moneyColor(v) : v ? C.text : C.muted) } },
      M.fmtEur(v, !!opt.sign)))));
}

function pivotBlock(movs, y, m, total, rerender, emptyText) {
  const cols = M.colors(D.categorie(y));
  const piv = M.categoryPivot(movs, y, m);
  const show = (c, s) => vociSheet(s != null ? `${c} · ${s || "senza specifica"}` : c,
    M.filterMovs(movs, { year: y, month: m, tipo: M.T.USCITA, categoria: c, sotto: s }),
    { onTap: (x) => openTania(x, rerender) });
  if (!piv.length) return [h("div.empty", {}, emptyText)];
  return [h("div.donut-wrap", {}, donut(piv.map(([c, v]) => ({ name: c, value: v, color: cols[c] || "#9AA3AE",
    onclick: () => show(c) })), total, { center: M.fmtEur(total) })),
  h("div.pivot", {}, piv.map(([c, v, subs]) => h("div.pv", {},
    h("button.pv-cat", { onclick: () => show(c) }, h("i.sw", { style: { background: cols[c] || "#9AA3AE" } }),
      h("span.pv-name", {}, c), h("span.pv-pct", {}, total ? `${Math.round((v / total) * 100)}%` : ""),
      h("span.pv-v", {}, M.fmtEur(v))),
    subs.filter(([s]) => s || subs.length > 1).map(([s, sv]) => h("button.pv-sub", { onclick: () => show(c, s) },
      h("span.pv-name", {}, s || "senza specifica"), h("span.pv-v", {}, M.fmtEur(sv)))))))];
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
  const hero = heroBox("Rimane", t.rimane, t.entrate, "entrate − spese");
  const stats = h("div.stats.two", {},
    stat("Entrate del mese", M.fmtEur(t.entrate), C.green, `${M.MESI[m - 1]} ${y}`),
    stat("Spese", M.fmtEur(t.spese), C.red, "senza le spese della professione"),
    stat("Incasso professione", M.fmtEur(p.incasso), C.green, `${p.sedute} sedute · tasse ${M.fmtEur(p.tasse)}`,
      () => jump("sec-sedute", view, rerender)),
    stat("Netto professione", M.fmtEur(p.netto, true), moneyColor(p.netto), `stipendio di ${lower(nm)}`));

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
    paz.length ? h("div.list", {}, paz.map(([name, rows, tot]) => h("button.item.paz", { type: "button",
      onclick: () => vociSheet(`${name} · ${M.MESI[m - 1]}`, rows, { onTap: (x) => openTania(x, rerender) }) },
    h("div.item-main", {}, h("div.item-title", {}, name), h("div.item-sub", {}, importi(rows))),
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
  const entCard = h("div.card", { "data-fold": "entrate" }, h("div.card-title", {}, "Entrate del mese"),
    conti([
      ...(showEdu || t.educativa ? [["Educativa", "", t.educativa, { color: t.educativa ? C.green : C.muted }]] : []),
      ["Stipendio dalla professione", `netto della professione di ${lower(pm)} ${py}`, t.stip_prof,
        { color: t.stip_prof ? C.green : C.muted }],
      ["Altri ingressi", "famiglia, tredicesima, NASpI, altro", t.altri, { color: t.altri ? C.green : C.muted }],
      ["Totale", "", t.entrate, { tot: true, color: C.green }],
    ]),
    eduChip ? h("div.center", {}, eduChip) : null,
    h("div.muted.small", {}, `Totale = ${showEdu ? "Educativa + " : ""}Stipendio dalla professione + Altri ingressi.`));

  const spMovs = M.personalSpese(movs);
  const speseCard = h("div.card", { "data-fold": "spese-mese" },
    h("div.card-title.row.between", {}, h("span", {}, "Spese del mese"), h("span.big-red", {}, M.fmtEur(t.spese))),
    ...pivotBlock(spMovs, y, m, t.spese, rerender, "Nessuna spesa in questo mese."));

  const section = (id, title, rows, color, add, sign = "+") => {
    const tot = rows.reduce((a, x) => a + Number(x.importo || 0), 0);
    const open = view.open[id] ?? false;
    return h("div.card", { id }, h("div.sec-head", {},
      h("button.sec-toggle", { onclick: () => { view.open[id] = !open; rerender(); } },
        h("span.chev", {}, open ? "▾" : "▸"), h("span", {}, title), h("span.count", {}, `${rows.length}`)),
      h("span.sec-tot", { style: { color } }, M.fmtEur(tot)),
      h("button.add", { onclick: add }, "＋")),
    open ? h("div.list", {}, rows.length ? rows.map((x) => movRow(x, { sign, onTap: (z) => openTania(z, rerender) }))
      : h("div.empty", {}, "Nessuna voce.")) : null);
  };
  const newMov = (tipo, categoria) => () => movimentoSheet({ tipo, data: defaultDate(view), categoria }, { onDone: rerender });

  fill(root, top, hero, stats,
    h("div.group-title", {}, "🧠 Libera professione"), pazCard, contiCard,
    section("sec-sedute", "Sedute", inMonth(M.isProfIncome), C.green, () => sedutaSheet(defaultDate(view), "", rerender)),
    section("sec-prof", "Spese professionali", inMonth(M.isProfCost), C.red, newMov(M.T.USCITA, M.CAT_SPESE_PROF), "−"),
    h("div.group-title", {}, "💶 Entrate"), entCard,
    showEdu ? section("sec-edu", "Educativa", eduRows, C.green, newMov(M.T.STIPENDIO, M.CAT_EDUCATIVA)) : null,
    section("sec-altri", "Altri ingressi", inMonth((x) => x.tipo === M.T.ENTRATA && !M.isProfIncome(x)), C.green,
      newMov(M.T.ENTRATA)),
    h("div.group-title", {}, "🛒 Spese"), speseCard,
    section("sec-spese", "Spese", inMonth((x) => (x.tipo || M.T.USCITA) === M.T.USCITA && !M.isProfCost(x)), C.red,
      newMov(M.T.USCITA), "−"),
    h("button.fab", { onclick: newMov(M.T.USCITA), "aria-label": "Aggiungi spesa" }, "＋"));
}

function jump(id, view, rerender) {
  view.open[id] = true;
  rerender();
  document.getElementById(id)?.scrollIntoView({ behavior: "smooth", block: "start" });
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
  const fPaz = h("input", { type: "text", list: "dl-paz", autocomplete: "off", value: paziente || "",
    placeholder: "Nome o iniziali (anche nuovo)" });
  const fData = h("input", { type: "date", value: data });
  const fImp = h("input", { type: "text", inputmode: "decimal", placeholder: "0,00", autocomplete: "off" });
  const setFee = () => { const f = lastFee.get(fPaz.value.trim()); if (f) fImp.value = String(f).replace(".", ","); };
  fPaz.addEventListener("change", setFee);
  fPaz.addEventListener("input", setFee);
  setFee();
  const err = h("div.form-err");
  const done = h("div.list");
  const add = async (close) => {
    const paz = fPaz.value.trim(), imp = M.parseAmount(fImp.value);
    if (!paz) { err.textContent = "Scrivi il paziente (nome o iniziali)."; return; }
    if (imp == null || imp <= 0) { err.textContent = "Scrivi l'importo della seduta (es. 45)."; return; }
    if (!fData.value) { err.textContent = "Scegli la data."; return; }
    err.textContent = "";
    await D.addMov("personal", { data: fData.value, tipo: M.T.ENTRATA, importo: imp, categoria: M.CAT_PROFESSIONE,
      sottocategoria: paz, descrizione: "Seduta", metodo: "", note: "", origine: "iPhone" });
    lastFee.set(paz, imp);
    done.append(h("div.done-row", {}, `✓ ${M.fmtDate(fData.value).slice(0, 5)} · ${paz} · ${M.fmtEur(imp)}`));
    toast("Seduta salvata ✓", "ok");
    rerender();
    if (close) s.close(); else { fPaz.value = ""; fImp.value = ""; fPaz.focus(); }
  };
  const bMore = h("button.btn", { type: "button" }, "Salva e aggiungi altra");
  bMore.onclick = () => busy(bMore, add(false));
  const bSave = h("button.btn.primary", { type: "button" }, "Salva");
  bSave.onclick = () => busy(bSave, add(true));
  const names = [...lastFee.keys()].sort((a, b) => a.toLowerCase().localeCompare(b.toLowerCase()));
  fill(s.body,
    h("label.field", {}, h("span", {}, "Paziente"), fPaz, h("datalist", { id: "dl-paz" }, names.map((n) => h("option", { value: n })))),
    h("div.grid2", {}, h("label.field", {}, h("span", {}, "Data"), fData), h("label.field", {}, h("span", {}, "Importo €"), fImp)),
    err, done, h("div.row.gap.actions", {}, bMore, bSave));
  setTimeout(() => (paziente ? fImp : fPaz).focus(), 300);
}

// ---------------------------------------------------------------- panoramica dell'anno
const COLS = [
  ["Incasso", "Incasso lordo della libera professione (sedute).", "inc", "in"],
  ["Tasse", "Contributo soggettivo + integrativo ENPAP + imposta, con gli indici dell'anno.", "tax", "out"],
  ["Sp. prof.", "Spese della professione (studio, Fiscozen, Guida Psi…).", "spp", "out"],
  ["Netto prof.", "Incasso − tasse − spese professionali: diventa lo stipendio del mese dopo.", "net", "rim"],
  ["Educativa", "Stipendio da educatrice.", "edu", "in"],
  ["Stip. prof.", "Stipendio dalla professione = netto professione del mese prima (mai negativo).", "stp", "in"],
  ["Altri", "Altri ingressi: famiglia, tredicesima, NASpI…", "alt", "in"],
  ["Entrate", "Educativa + Stip. prof. + Altri.", "ent", "in"],
  ["Spese", "Spese personali (senza le spese professionali).", "spe", "out"],
  ["Rimane", "Entrate − Spese.", "rim", "rim"],
  ["Σ Rimane", "Somma di «Rimane» dall'inizio dell'anno.", "prog", "prog"],
];

export function renderAnno(root, rerender, view, goMonth) {
  const y = view.y;
  const months = Array.from({ length: 12 }, (_, i) => D.taniaMonth(y, i + 1));
  const today = new Date();
  const sel = y === today.getFullYear() ? today.getMonth() : -1;
  const cols = D.eduRemoved() ? COLS.filter((c) => c[2] !== "edu") : COLS;
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
  const hero = heroBox(`Rimane · ${y}`, tot.rim, tot.ent, "entrate − spese");
  const stats = h("div.stats.two", {},
    stat("Incasso professione · anno", M.fmtEur(tot.inc), C.green, `netto professione ${M.fmtEur(tot.net, true)}`),
    stat("Tasse e contributi · anno", M.fmtEur(tot.tax), C.red,
      `coeff. ${pct(ind.coef)} · ENPAP ${pct(ind.sogg)} + ${pct(ind.integr)} · imposta ${pct(ind.aliq)}`),
    stat("Entrate · anno", M.fmtEur(tot.ent), C.green, String(y)),
    stat("Spese · anno", M.fmtEur(tot.spe), C.red, String(y)));

  const fmtCell = (v, kind, r) => {
    if (kind === "prog") return r.has || r.past ? [M.fmtEur(v, true), moneyColor(v)] : ["—", C.muted];
    if (kind === "rim") return r.has ? [M.fmtEur(v, true), moneyColor(v)] : ["—", C.muted];
    return v ? [M.fmtEur(v), kind === "in" ? C.green : C.red] : ["—", C.muted];
  };
  const th = h("tr", {}, h("th.sticky", {}, "Mese"), cols.map(([t, tip]) =>
    h("th.g0", { onclick: () => toast(`${t}: ${tip}`) }, t, h("sup", {}, " ⓘ"))));
  const body = rowsData.map((r, i) => h("tr" + (i === sel ? ".sel" : ""), { onclick: () => goMonth(y, i + 1) },
    h("td.sticky", {}, M.MESI_BREVI[i]),
    cols.map(([, , k, kind]) => {
      const [txt, col] = fmtCell(r[k], kind, r);
      return h("td.g0" + (kind === "prog" ? ".p" : ""), { style: { color: col, fontWeight: kind === "rim" ? 700 : 400 } }, txt);
    })));
  body.push(h("tr.total", {}, h("td.sticky", {}, "Totale"), cols.map(([, , k, kind]) => {
    if (kind === "prog") return h("td.g0.p", {}, "");
    const v = tot[k];
    return h("td.g0", { style: { color: kind === "rim" ? moneyColor(v) : C.text } }, M.fmtEur(v, kind === "rim"));
  })));
  const table = h("div.card", { "data-fold": "tabella" }, h("div.card-title", {}, "Tabella dell'anno"),
    h("div.muted.small.center", {}, "Scorri di lato · tocca un titolo per la spiegazione, un mese per aprirlo"),
    h("div.tscroll", {}, h("table.ytable", {}, h("thead", {}, th), h("tbody", {}, body))));

  const chart = h("div.card", { "data-fold": "grafico" }, h("div.card-title", {}, "Entrate e spese mese per mese"),
    bars(months.map((t, i) => ({ label: M.MESI_BREVI[i][0], a: t.entrate, b: t.spese })), { sel, onPick: (i) => goMonth(y, i + 1) }),
    h("div.legend", {}, h("i", { style: { color: C.green } }, "■ "), "Entrate", h("i", { style: { color: C.red } }, "  ■ "),
      "Spese — tocca un mese per aprirlo"));

  const movs = M.personalSpese(D.allMovs(y));
  const cat = h("div.card", { "data-fold": "categorie" }, h("div.card-title", {}, "Spese per categoria e specifica"),
    ...pivotBlock(movs, y, null, tot.spe, rerender, "Nessuna spesa in questo anno."));

  const indCard = h("div.card", { "data-fold": "indici" }, h("div.card-title", {}, `Indici di tasse e contributi ${y}`),
    h("div.conti", {}, M.INDICI.map(([k, label]) => h("div.conto", {}, h("div.conto-n", {}, label),
      h("div.conto-v", {}, pct(ind[k]))))),
    h("div.muted.small", {}, "Come nel foglio Home del vecchio file. Si cambiano dal PC: Impostazioni → Tasse e contributi della libera professione."));

  fill(root, top, hero, stats, table, chart, cat, indCard);
}
