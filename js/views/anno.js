// Panoramica (Michele): fascia verde come «Il mio mese» e schede Mesi · Categorie · Entrate · Anni.
// Per Tania la pagina è in tania.js.
import * as D from "../data.js";
import * as M from "../model.js";
import { h, C, moneyColor, monthNav, bars, sheet, toast, busy, fill } from "../ui.js";
import { vociSheet } from "../forms.js";
import { MODI, setMode, view as meseView, openMov } from "./mese.js";
import * as Tania from "./tania.js";

export const view = { y: new Date().getFullYear(), inc13: true, incex: true, netM: false, netY: false, tab: "mesi" };
try { view.tab = sessionStorage.getItem("cf.ptab") || "mesi"; } catch { /* */ }

export function render(root, rerender, goMonth) {
  if (!D.isMichele()) { Tania.renderAnno(root, rerender, view, goMonth); return; }
  const y = view.y;
  const mich = D.isMichele();
  const mode = mich ? meseView.mode : 2;
  const movs = D.allMovs(y);
  const yt = M.yearTable(movs, y, view.inc13, view.incex);
  const tot = yt.totale;
  const ent = [tot.st, tot.st + tot.iv, tot.st + tot.iv + tot.ex];
  const rim = [tot.r1, tot.r2, tot.r3];
  const rv = rim[mode], en = ent[mode];
  const today = new Date();
  const nmesi = y < today.getFullYear() ? 12 : y === today.getFullYear() ? today.getMonth() + 1 : 0;

  const top = h("div.page-top", {}, monthNav(y, 1, (yy) => { view.y = yy; rerender(); }, { yearOnly: true }));

  // fascia verde come «Il mio mese» (A1): quanto rimane nell'anno, barra speso/rimane, Entrato · Uscito · Al mese
  const spentPct = en > 0 ? Math.min(100, (tot.sp / en) * 100) : (tot.sp > 0 ? 100 : 0);
  const chip = (title, val) => h("div.mh-chip", {}, h("div", {}, title), h("b", {}, val));
  const hero = h("div.mhero" + (rv < -0.004 ? ".neg" : ""), {},
    h("div.mh-t", {}, `NEL ${y} TI RIMANE · ${MODI[mode][2].toUpperCase()}`),
    h("div.mh-v", {}, M.fmtEur(rv, true)),
    h("div.mh-split", {}, h("i", { style: { width: `${spentPct.toFixed(1)}%` } })),
    h("div.mh-chips", {}, chip("Entrato", M.fmtEur(en)), chip("Uscito", M.fmtEur(tot.sp)),
      chip("Al mese", nmesi ? M.fmtEur(rv / nmesi, true) : "—")));
  const seg = h("div.seg.mseg", {}, ["Stipendio", "+ Investimenti", "Tutto"].map((name, i) =>
    h("button" + (i === mode ? ".on" : ""), { onclick: () => { setMode(i); rerender(); } }, name)));

  // schede (A3): Mesi · Categorie · Entrate · Anni
  const TABS = [["mesi", "Mesi"], ["categorie", "Categorie"], ["entrate", "Entrate"], ["anni", "Anni"]];
  const tab = TABS.some(([k]) => k === view.tab) ? view.tab : "mesi";
  const tabs = h("div.ptabs", {}, TABS.map(([k, label]) => h("button" + (k === tab ? ".on" : ""),
    { "data-ptab": k, onclick: () => { view.tab = k; try { sessionStorage.setItem("cf.ptab", k); } catch { /* */ } rerender(); } },
    label)));

  let body;
  if (tab === "mesi") {
    const entOf = (x) => [x.st, x.st + x.iv, x.st + x.iv + x.ex][mode];
    const rimOf = (x) => [x.r1, x.r2, x.r3][mode];
    const sel = y === today.getFullYear() ? today.getMonth() : -1;
    const chart = h("div.card", {}, h("div.card-title.row.between", {}, h("span", {}, "Mese per mese"),
      netToggle(view.netM, (v) => { view.netM = v; rerender(); })),
    bars(yt.months.map((x, i) => ({ label: M.MESI_BREVI[i][0], a: entOf(x), b: x.sp })),
      { net: view.netM, sel, onPick: (i) => goMonth(y, i + 1) }),
    h("div.legend", {}, "Tocca un mese per aprirlo"));
    // cifre tonde, così le quattro colonne stanno nello schermo del telefono
    const n0 = (v) => M.fmtEur(Math.round(v)).replace(",00 €", " €");
    const r0 = (v) => M.fmtEur(Math.round(v), true).replace(",00 €", " €");
    const line = (cls, name, a, b, c, onclick) => h("button.pt-row" + cls, { onclick },
      h("span.pt-m", {}, name), h("span.pt-in", {}, a), h("span.pt-out", {}, b), h("b.pt-r", { style: { color: c[1] } }, c[0]));
    const a = yt.annual;
    const aEnt = [a.st, a.st + a.iv, a.st + a.iv + a.ex][mode] || 0;
    const aRim = [a.r1, a.r2, a.r3][mode] || 0;
    const table = h("div.card", {},
      h("div.pt-head", {}, h("span", {}, "Mese"), h("span", {}, "Entrato"), h("span", {}, "Uscito"), h("span", {}, "Rimane")),
      yt.months.map((x, i) => x.has || i === sel
        ? line(i === sel ? ".sel" : "", M.MESI_BREVI[i], entOf(x) ? n0(entOf(x)) : "—", x.sp ? n0(x.sp) : "—",
          x.has ? [r0(rimOf(x)), moneyColor(rimOf(x))] : ["—", C.muted], () => goMonth(y, i + 1))
        : null),
      aEnt || aRim ? line(".annual", "13ª/14ª/extra", aEnt ? n0(aEnt) : "—", "",
        [r0(aRim), C.amber], () => { view.tab = "entrate"; rerender(); }) : null,
      line(".total", "Totale", n0(en), n0(tot.sp), [r0(rv), moneyColor(rv)], null),
      h("div.muted.small.center", { style: { marginTop: "6px" } }, "Tocca un mese per aprirlo"));
    body = [chart, table];
  } else if (tab === "categorie") {
    body = [catCard(movs, y, rerender)];
  } else if (tab === "entrate") {
    const prevT = M.yearTable(D.allMovs(y - 1), y - 1, true, true);
    const hasPrev = prevT.months.some((x) => x.has);
    const d = tot.sp - prevT.totale.sp;
    const conf = hasPrev ? h("div.card", {}, h("div.card-title", {}, `Rispetto al ${y - 1}`),
      h("div.row.between", {}, h("span", {}, "Spese"), h("b", { style: { color: d > 0 ? C.red : C.green } },
        `${d >= 0 ? "+" : "−"}${M.fmtEur(Math.abs(d))}`)),
      h("div.muted.small", {}, `${y - 1}: spese ${M.fmtEur(prevT.totale.sp)} · ${y}: ${M.fmtEur(tot.sp)}`)) : null;
    body = [annualCard(y, yt.an, movs, rerender), medieCard(movs, y), conf];
  } else {
    body = [yearsCard(mode, (yy) => { view.y = yy; rerender(); }, rerender)
      || h("div.card", {}, h("div.empty", {}, "Ancora un anno solo."))];
  }
  for (const c of body) if (c) c.dataset.keep = "";   // dentro le schede i riquadri restano aperti

  fill(root, top, hero, seg, tabs, ...body);
}

/** Categorie dell'anno a barre (come «Dove sono andati» in Il mio mese); tocco = le voci. */
function catCard(movs, y, rerender) {
  const cols = M.colors(D.categorie(y));
  const piv = M.categoryPivot(movs, y);
  const tot = piv.reduce((a, x) => a + x[1], 0);
  const max = piv.length ? piv[0][1] : 0;
  const show = (c) => vociSheet(`${c} · ${y}`, M.filterMovs(movs, { year: y, tipo: M.T.USCITA, categoria: c }),
    { onTap: (x) => openMov(x, rerender) });
  return h("div.card", {}, h("div.card-title.row.between", {}, h("span", {}, "Dove sono andati"),
    h("span.muted.small", {}, piv.length ? `${M.fmtEur(tot)} · tocca per le voci` : "")),
  piv.length ? piv.map(([c, v, subs]) => {
    const col = cols[c] || "#9AA3AE";
    const sub = subs.filter(([x]) => x).slice(0, 3).map(([x, sv]) => `${x} ${M.fmtEur(sv).replace(",00 €", " €")}`).join(" · ");
    return h("button.mc-row", { onclick: () => show(c) },
      h("i.mc-ic", { style: { background: col + "33", color: col } }, (c || "?").slice(0, 1).toUpperCase()),
      h("div.mc-mid", {}, h("div.mc-top", {}, h("span.mc-name", {}, c),
        h("span.mc-pct", {}, tot ? `${Math.round((v / tot) * 100)}%` : "")),
      h("div.mc-bar", {}, h("i", { style: { width: `${max ? (v / max) * 100 : 0}%`, background: col } })),
      sub ? h("div.mc-sub", {}, sub) : null),
      h("b.mc-v", {}, M.fmtEur(v)));
  }) : h("div.empty", {}, "Nessuna spesa."));
}

function netToggle(on, set) {
  return h("div.seg.small", {}, h("button" + (on ? "" : ".on"), { onclick: () => set(false) }, "Entrate/spese"),
    h("button" + (on ? ".on" : ""), { onclick: () => set(true) }, "Solo rimane"));
}

function annualCard(y, an, movs, rerender) {
  const base = M.yearTable(movs, y, false, false).totale;
  const t13 = an.tredicesima, t14 = an.quattordicesima, ex = an.extra;
  const box = (label, key, v) => h("button.abox", { onclick: () => editStip(y, label, an.righe[key], rerender) },
    h("div.stat-t", {}, label), h("div.stat-v", { style: { color: v ? C.amber : C.muted } }, v ? M.fmtEur(v) : "aggiungi"),
    h("div.stat-s", {}, "tocca per cambiare"));
  const toggle = (label, on, set) => h("button.chip" + (on ? ".on" : ""), { onclick: () => { set(!on); rerender(); } },
    (on ? "✓ " : "✕ ") + label);
  const cmpRows = [
    ["Somma dei mesi", [base.r1, base.r2, base.r3], "base"],
    ["+ Tredicesima", [t13, t13, t13], "add"],
    ["+ Quattordicesima", [t14, t14, t14], "add"],
    ["+ Extra dell'anno", [null, null, ex], "add"],
    ["= Totale dell'anno", [base.r1 + t13 + t14, base.r2 + t13 + t14, base.r3 + t13 + t14 + ex], "tot"],
  ];
  return h("div.card", {}, h("div.card-title", {}, "Entrate dell'anno (non mensili)"),
    h("div.muted.small.center", {}, "Non appartengono a un mese: si sommano solo ai totali dell'anno."),
    h("div.stats.two", {}, box("Tredicesima", "tredicesima", t13), box("Quattordicesima", "quattordicesima", t14)),
    h("div.sub-title", {}, "Extra dell'anno"),
    h("div.list", {}, an.extra_voci.map((m) => h("button.item", { onclick: () => openMov(m, rerender) },
      h("div.item-main", {}, h("div.item-title", {}, m.descrizione || "Extra")),
      h("div.item-amt", { style: { color: C.amber } }, "+" + M.fmtEur(m.importo)))),
    h("button.btn.wide", { onclick: () => addExtra(y, rerender) }, "＋ Aggiungi extra dell'anno")),
    h("div.sub-title", {}, "Nei totali dell'anno conta:"),
    h("div.row.gap.center", {}, toggle("13ª e 14ª", view.inc13, (v) => { view.inc13 = v; }),
      toggle("Extra dell'anno", view.incex, (v) => { view.incex = v; })),
    h("div.sub-title", {}, "Come si arriva al totale dell'anno"),
    h("div.tscroll", {}, h("table.ctable", {}, h("thead", {}, h("tr", {}, h("th", {}, ""), MODI.map(([, n]) => h("th", {}, n)))),
      h("tbody", {}, cmpRows.map(([name, vals, kind]) => h("tr.k-" + kind, {}, h("td", {}, name), vals.map((v) =>
        h("td", { style: { color: v == null ? C.muted : kind === "add" ? (v ? C.amber : C.muted) : moneyColor(v) } },
          v == null ? "non conta" : kind === "add" && !v ? "—" : M.fmtEur(v, true)))))))));
}

function amountSheet(title, cur, onSave, extra) {
  const s = sheet(title);
  const inp = h("input", { type: "text", inputmode: "decimal", value: cur ? String(cur).replace(".", ",") : "", placeholder: "0,00" });
  const err = h("div.form-err");
  const b = h("button.btn.primary", {}, "Salva");
  b.onclick = () => {
    const v = inp.value.trim() ? M.parseAmount(inp.value) : 0;
    if (v == null || v < 0) { err.textContent = "Importo non valido."; return; }
    const d = extra?.read?.();
    busy(b, onSave(v, d).then(() => { toast("Salvato ✓", "ok"); s.close(); }).catch((e) => { err.textContent = e.message; }));
  };
  fill(s.body, extra?.el || null, h("label.field", {}, h("span", {}, "Importo €"), inp), err, h("div.row.gap.actions", {}, b));
  setTimeout(() => inp.focus(), 300);
}

function editStip(y, cat, cur, rerender) {
  amountSheet(`${cat} ${y}`, cur?.importo, async (v) => {
    if (cur && !v) await D.deleteMov("personal", y, cur.id);
    else if (cur) { if (Math.abs(cur.importo - v) >= 0.005) await D.editMov("personal", y, cur.id, { importo: v }); }
    else if (v) await D.addMov("personal", { data: `${y}-12-31`, tipo: M.T.STIPENDIO, importo: v, categoria: cat,
      sottocategoria: "", descrizione: `${cat} ${y}`, metodo: "", note: "", origine: M.ORIGINE_ANNUALE });
    rerender();
  });
}

function addExtra(y, rerender) {
  const d = h("input", { type: "text", placeholder: "es. Regalo" });
  amountSheet(`Extra del ${y}`, null, async (v, descr) => {
    if (!v) return;
    await D.addMov("personal", { data: `${y}-12-31`, tipo: M.T.ENTRATA, importo: v, categoria: M.CAT_EXTRA_ANNO,
      sottocategoria: "", descrizione: descr || "Extra dell'anno", metodo: "", note: "", origine: M.ORIGINE_ANNUALE });
    rerender();
  }, { el: h("label.field", {}, h("span", {}, "Descrizione"), d), read: () => d.value.trim() });
}

function medieCard(movs, y) {
  const md = M.medieAnno(movs, y);
  const rows = [["Solo stipendio", "solo_stipendio"], ["Stip. + invest.", "senza_extra"], ["Stip. + inv. + extra", "totale"]];
  return h("div.card", {}, h("div.card-title", {}, "Medie mensili"),
    h("table.ctable", {}, h("thead", {}, h("tr", {}, h("th", {}, "Risparmio medio"), h("th", {}, "Media"), h("th", {}, "Con 13ª+14ª"))),
      h("tbody", {}, rows.map(([n, k], i) => h("tr", {}, h("td", { style: { fontWeight: i ? 400 : 700 } }, n),
        [k, k + "_con_13_14"].map((kk) => h("td", { style: { color: md.mesi_validi ? moneyColor(md[kk]) : C.muted } },
          md.mesi_validi ? M.fmtEur(md[kk], true) : "—")))))),
    h("div.muted.small.center", {}, md.mesi_validi ? `Calcolate sui ${md.mesi_validi} mesi con lo stipendio. «Con 13ª+14ª» aggiunge ${M.fmtEur(md.tredicesima_quattordicesima)} divisi su 12 mesi.`
      : "Nessuno stipendio inserito in questo anno."));
}

function yearsCard(mode, pick, rerender) {
  const ys = [...new Set([...D.years("personal"), ...D.years("comune")])].sort();
  if (!ys.length) return null;
  const series = ys.map((y) => {
    const t = M.yearTable(D.allMovs(y), y, view.inc13, view.incex).totale;
    return { label: String(y).slice(2), a: [t.st, t.st + t.iv, t.st + t.iv + t.ex][mode], b: t.sp, y };
  });
  return h("div.card", {}, h("div.card-title.row.between", {}, h("span", {}, "Anno per anno"),
    netToggle(view.netY, (v) => { view.netY = v; rerender(); })),
  bars(series, { net: view.netY, onPick: (i) => pick(series[i].y), height: 140 }),
  h("div.legend", {}, "Tocca un anno per aprirlo"));
}
