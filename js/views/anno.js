// Panoramica dell'anno: tabella mese per mese, entrate non mensili (13ª, 14ª, extra), grafici, medie.
import * as D from "../data.js";
import * as M from "../model.js";
import { h, C, moneyColor, monthNav, donut, bars, dots, sheet, toast, busy, fill } from "../ui.js";
import { vociSheet } from "../forms.js";
import { MODI, setMode, view as meseView, openMov } from "./mese.js";
import * as Tania from "./tania.js";

export const view = { y: new Date().getFullYear(), inc13: true, incex: true, netM: false, netY: false };

// colonne della tabella: [titolo, spiegazione, chiave, gruppo, tipo]
const COLS = [
  ["Stip.", "Stipendio del mese (compresi tredicesima, quattordicesima e premi).", "st", 0, "in"],
  ["Spese", "Tutte le spese del mese.", "sp", 0, "out"],
  ["Rimane", "Rimane dallo stipendio NEL MESE = Stipendio − Spese.", "r1", 0, "rim"],
  ["Σ Rim.", "Progressivo di «Rimane»: somma dall'inizio dell'anno fino a quel mese.", "p1", 0, "prog"],
  ["Invest.", "Incassi degli investimenti (interessi, cedole; i bolli sono negativi).", "iv", 1, "in2"],
  ["Rim. +inv", "Rimane con gli investimenti NEL MESE = Stipendio + Investimenti − Spese.", "r2", 1, "rim"],
  ["Σ +inv", "Progressivo di «Rim. +inv».", "p2", 1, "prog"],
  ["Extra", "Entrate extra: regali, rimborsi, vendite.", "ex", 2, "in2"],
  ["Rim. tot", "Rimane con tutte le entrate NEL MESE.", "r3", 2, "rim"],
  ["Σ tot", "Progressivo di «Rim. tot».", "p3", 2, "prog"],
];

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
  const pc = M.pctText(rv, en);
  const hero = h("div.hero" + (rv > 0.004 ? ".pos" : rv < -0.004 ? ".neg" : ""), {},
    mich ? h("button.nav.small", { onclick: () => { setMode(mode - 1); rerender(); } }, "‹") : null,
    h("div.hero-mid", {}, h("div.hero-title", {}, `${mich ? MODI[mode][1] : "Rimane"} · ${y}`),
      h("div.hero-val", { style: { color: moneyColor(rv) } }, M.fmtEur(rv, true)),
      h("div.hero-sub", {}, pc ? h("b", { style: { color: moneyColor(rv) } }, pc) : null, mich ? dots(3, mode) : null),
      h("div.hero-cap", {}, mich ? MODI[mode][2] : "entrate − spese")),
    mich ? h("button.nav.small", { onclick: () => { setMode(mode + 1); rerender(); } }, "›") : null);

  const prevT = M.yearTable(D.allMovs(y - 1), y - 1, true, true);
  const hasPrev = prevT.months.some((x) => x.has);
  const stats = h("div.stats.two", {},
    h("div.stat", {}, h("div.stat-t", {}, `${mich ? MODI[mode][0] : "Entrate"} · anno`), h("div.stat-v", { style: { color: C.green } }, M.fmtEur(en))),
    h("div.stat", {}, h("div.stat-t", {}, "Spese · anno"), h("div.stat-v", { style: { color: C.red } }, M.fmtEur(tot.sp))),
    h("div.stat", {}, h("div.stat-t", {}, "Media al mese"),
      nmesi ? [h("div.stat-v", {}, M.fmtEur(tot.sp / nmesi)), h("div.stat-s", {}, `spese · rimane ${M.fmtEur(rv / nmesi, true)}`)]
        : h("div.stat-v", {}, "—")),
    h("div.stat", {}, h("div.stat-t", {}, `Spese rispetto al ${y - 1}`),
      hasPrev ? [h("div.stat-v", { style: { color: tot.sp - prevT.totale.sp > 0 ? C.red : C.green } },
        (tot.sp - prevT.totale.sp >= 0 ? "+" : "−") + M.fmtEur(Math.abs(tot.sp - prevT.totale.sp))),
      h("div.stat-s", {}, `${y - 1}: spese ${M.fmtEur(prevT.totale.sp)}`)] : h("div.stat-v", {}, "—")));

  // grafico mese per mese
  const entOf = (x) => [x.st, x.st + x.iv, x.st + x.iv + x.ex][mode];
  const sel = y === today.getFullYear() ? today.getMonth() : -1;
  const chart = h("div.card", {}, h("div.card-title.row.between", {}, h("span", {}, "Mese per mese"),
    netToggle(view.netM, (v) => { view.netM = v; rerender(); })),
  bars(yt.months.map((x, i) => ({ label: M.MESI_BREVI[i][0], a: entOf(x), b: x.sp })),
    { net: view.netM, sel, onPick: (i) => goMonth(y, i + 1) }),
  h("div.legend", {}, view.netM ? `${mich ? MODI[mode][1] : "Rimane"} di ogni mese (verde guadagno, rosso perdita) — tocca un mese per aprirlo`
    : [h("i", { style: { color: C.green } }, "■ "), mich ? MODI[mode][0] : "Entrate", h("i", { style: { color: C.red } }, "  ■ "), "Spese — tocca un mese per aprirlo"]));

  // tabella dell'anno
  const th = h("tr", {}, h("th.sticky", {}, "Mese"), COLS.map(([t, tip, , g]) =>
    h("th.g" + g, { onclick: () => toast(`${t}: ${tip}`) }, t, h("sup", {}, " ⓘ"))));
  const fmtCell = (v, kind, show) => {
    if (kind === "rim" || kind === "prog") return show ? [M.fmtEur(v, true), moneyColor(v)] : ["—", C.muted];
    if (!v) return ["—", C.muted];
    return [M.fmtEur(v), kind === "in" ? C.green : kind === "out" ? C.red : "#7FC8A0"];
  };
  const rows = yt.months.map((x, i) => h("tr" + (i === sel ? ".sel" : ""), { onclick: () => goMonth(y, i + 1) },
    h("td.sticky", {}, M.MESI_BREVI[i]),
    COLS.map(([, , k, g, kind]) => {
      const [txt, col] = fmtCell(x[k], kind, x.has || (kind === "prog" && x.past));
      return h(`td.g${g}${kind === "prog" ? ".p" : ""}`, { style: { color: col, fontWeight: kind === "rim" ? 700 : 400 } }, txt);
    })));
  const a = yt.annual;
  const excl = [["13ª/14ª", view.inc13], ["extra", view.incex]].filter(([, on]) => !on).map(([n]) => n);
  rows.push(h("tr.annual", {}, h("td.sticky", {}, "13ª/14ª/extra" + (excl.length ? " ✕" : "")),
    COLS.map(([, , k, g, kind]) => {
      const v = a[k] || 0;
      const rk = kind === "rim" || kind === "prog";
      return h(`td.g${g}${kind === "prog" ? ".p" : ""}`, { style: { color: v ? (rk ? moneyColor(v) : C.amber) : C.muted } },
        v || (rk && a.has) ? M.fmtEur(v, rk) : "—");
    })));
  rows.push(h("tr.total", {}, h("td.sticky", {}, "Totale"), COLS.map(([, , k, g, kind]) => {
    if (kind === "prog") return h(`td.g${g}.p`, {}, "");
    const v = tot[k] || 0;
    return h(`td.g${g}`, { style: { color: kind === "rim" ? moneyColor(v) : C.text } }, M.fmtEur(v, kind === "rim"));
  })));
  const table = h("div.card", {}, h("div.card-title", {}, "Tabella dell'anno"),
    h("div.muted.small.center", {}, "Scorri di lato · tocca un titolo per la spiegazione, un mese per aprirlo"),
    h("div.tscroll", {}, h("table.ytable", {}, h("thead", {}, th), h("tbody", {}, rows))));

  fill(root, top, hero, stats, chart, table, annualCard(y, yt.an, movs, rerender), medieCard(movs, y),
    pivotCard(movs, y, rerender), yearsCard(mode, (yy) => { view.y = yy; rerender(); }, rerender));
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

function pivotCard(movs, y, rerender) {
  const cols = M.colors(D.categorie(y));
  const piv = M.categoryPivot(movs, y);
  const tot = piv.reduce((a, x) => a + x[1], 0);
  const show = (c, s) => vociSheet(s != null ? `${c} · ${s || "senza specifica"}` : `${c} · ${y}`,
    M.filterMovs(movs, { year: y, tipo: M.T.USCITA, categoria: c, sotto: s }), { onTap: (x) => openMov(x, rerender) });
  return h("div.card", {}, h("div.card-title.center", {}, "Spese per categoria e specifica"),
    piv.length ? h("div.donut-wrap", {}, donut(piv.map(([c, v]) => ({ name: c, value: v, color: cols[c] || "#9AA3AE", onclick: () => show(c) })),
      tot, { center: M.fmtEur(tot) })) : h("div.empty", {}, "Nessuna spesa."),
    h("div.pivot", {}, piv.map(([c, v, subs]) => h("div.pv", {},
      h("button.pv-cat", { onclick: () => show(c) }, h("i.sw", { style: { background: cols[c] || "#9AA3AE" } }),
        h("span.pv-name", {}, c), h("span.pv-pct", {}, tot ? `${Math.round((v / tot) * 100)}%` : ""), h("span.pv-v", {}, M.fmtEur(v))),
      subs.filter(([s]) => s || subs.length > 1).map(([s, sv]) => h("button.pv-sub", { onclick: () => show(c, s) },
        h("span.pv-name", {}, s || "senza specifica"), h("span.pv-v", {}, M.fmtEur(sv))))))));
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
