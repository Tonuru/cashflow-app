// Mese per mese: rimanenze, entrate, spese per categoria, elenchi delle voci.
import * as D from "../data.js";
import * as M from "../model.js";
import { h, C, moneyColor, monthNav, donut, dots, fill } from "../ui.js";
import { movimentoSheet, vociSheet, movRow, comuneSheet } from "../forms.js";

export const MODI = [
  ["Stipendio", "Rimane", "stipendio − spese"],
  ["Stipendio + investimenti", "Rimane +inv", "stipendio + investimenti − spese"],
  ["Stipendio + invest. + extra", "Rimane tot", "tutte le entrate − spese"],
];
export const view = { y: new Date().getFullYear(), m: new Date().getMonth() + 1, mode: 0, open: {} };
try { view.mode = Number(localStorage.getItem("cf.mode") || 0) % 3; } catch { /* */ }
export function setMode(i) { view.mode = (i + 3) % 3; try { localStorage.setItem("cf.mode", view.mode); } catch { /* */ } }

export function render(root, rerender) {
  const { y, m } = view;
  const mich = D.isMichele();
  const mode = mich ? view.mode : 2;
  const movs = D.allMovs(y);
  const t = M.monthTotals(movs, y, m);
  const pt = t.per_tipo;
  const st = pt[M.T.STIPENDIO] || 0, iv = pt[M.T.INVESTIMENTO] || 0, ex = pt[M.T.ENTRATA] || 0;
  const r = M.rimanenti(t);
  const ent = [st, st + iv, st + iv + ex];
  const rim = [r.solo_stipendio, r.senza_extra, r.totale];
  const rs = rim[mode], en = ent[mode];
  const pc = M.pctText(rs, en);

  const top = h("div.page-top", {}, monthNav(y, m, (yy, mm) => { view.y = yy; view.m = mm; rerender(); }));

  // riquadro principale: rimane (verde/rosso) con le frecce per cambiare cosa conta
  const hero = h("div.hero" + (rs > 0.004 ? ".pos" : rs < -0.004 ? ".neg" : ""), {},
    mich ? h("button.nav.small", { onclick: () => { setMode(mode - 1); rerender(); } }, "‹") : null,
    h("div.hero-mid", {},
      h("div.hero-title", {}, mich ? MODI[mode][1] : "Rimane"),
      h("div.hero-val", { style: { color: moneyColor(rs) } }, M.fmtEur(rs, true)),
      h("div.hero-sub", {}, pc ? h("b", { style: { color: moneyColor(rs) } }, pc) : null, mich ? dots(3, mode) : null),
      h("div.hero-cap", {}, mich ? MODI[mode][2] : "entrate − spese")),
    mich ? h("button.nav.small", { onclick: () => { setMode(mode + 1); rerender(); } }, "›") : null);

  const three = mich ? h("div.three", {}, MODI.map(([, name], i) => h("button.mini" + (i === mode ? ".on" : ""),
    { onclick: () => { setMode(i); rerender(); } },
    h("div.mini-t", {}, name), h("div.mini-v", { style: { color: moneyColor(rim[i]) } }, M.fmtEur(rim[i], true)),
    h("div.mini-p", {}, M.pctText(rim[i], ent[i]))))) : null;

  const stat = (title, v, color, onclick) => h("button.stat", { onclick },
    h("div.stat-t", {}, title), h("div.stat-v", { style: { color } }, M.fmtEur(v)));
  const entrate = h("div.card", { "data-keep": "" }, h("div.card-title", {}, "Entrate del mese"),
    h("div.stats" + (mich ? "" : ".two"), {},
      mich ? stat("Stipendio", st, C.green, () => jump("sec-stip", rerender)) : null,
      stat(mich ? "Extra" : "Entrate", ex, C.green, () => jump("sec-extra", rerender)),
      mich ? stat("Investimenti", iv, iv >= 0 ? C.green : C.red, () => jump("sec-inv", rerender)) : null));

  // spese per categoria: ciambella + elenco con le sottocategorie (tocco = voci)
  const cols = M.colors(D.categorie(y));
  const piv = M.categoryPivot(movs, y, m);
  const showVoci = (cat, sub) => {
    const rows = M.filterMovs(movs, { year: y, month: m, tipo: M.T.USCITA, categoria: cat, sotto: sub });
    vociSheet(sub != null ? `${cat} · ${sub || "senza specifica"}` : cat, rows, { onTap: (x) => openMov(x, rerender) });
  };
  const spese = h("div.card", {},
    h("div.card-title.row.between", {}, h("span", {}, "Spese del mese"),
      h("span.big-red", {}, M.fmtEur(t.uscite))),
    piv.length ? h("div.donut-wrap", {}, donut(piv.map(([c, v]) => ({ name: c, value: v, color: cols[c] || "#9AA3AE",
      onclick: () => showVoci(c) })), t.uscite, { center: M.fmtEur(t.uscite) })) : h("div.empty", {}, "Nessuna spesa in questo mese."),
    h("div.pivot", {}, piv.map(([c, v, subs]) => h("div.pv", {},
      h("button.pv-cat", { onclick: () => showVoci(c) },
        h("i.sw", { style: { background: cols[c] || "#9AA3AE" } }), h("span.pv-name", {}, c),
        h("span.pv-pct", {}, t.uscite ? `${Math.round((v / t.uscite) * 100)}%` : ""), h("span.pv-v", {}, M.fmtEur(v))),
      subs.filter(([s]) => s || subs.length > 1).map(([s, sv]) => h("button.pv-sub", { onclick: () => showVoci(c, s) },
        h("span.pv-name", {}, s || "senza specifica"), h("span.pv-v", {}, M.fmtEur(sv))))))));

  const section = (id, title, tipo, rows, color, { readonly = false, sign = "+" } = {}) => {
    const tot = rows.reduce((a, x) => a + Number(x.importo || 0), 0);
    const key = id;
    const open = view.open[key] ?? false;
    const body = open ? h("div.list", {}, rows.length ? rows.map((x) => movRow(x, { sign,
      onTap: readonly ? null : (z) => openMov(z, rerender) })) : h("div.empty", {}, "Nessuna voce.")) : null;
    return h("div.card", { id }, h("div.sec-head", {},
      h("button.sec-toggle", { onclick: () => { view.open[key] = !open; rerender(); } },
        h("span.chev", {}, open ? "▾" : "▸"), h("span", {}, title),
        h("span.count", {}, `${rows.length}`)),
      h("span.sec-tot", { style: { color } }, M.fmtEur(tot)),
      readonly ? null : h("button.add", { onclick: () => newMov(tipo, rerender) }, "＋")),
    readonly ? h("div.muted.small", {}, "Presi dal file Investimenti (si aggiornano dall'app sul PC).") : null, body);
  };
  const list = (tipo) => M.filterMovs(movs, { year: y, month: m, tipo });

  fill(root, top, hero, three, entrate, spese,
    section("sec-spese", "Spese", M.T.USCITA, list(M.T.USCITA), C.red, { sign: "−" }),
    mich ? section("sec-stip", "Stipendio", M.T.STIPENDIO, list(M.T.STIPENDIO), C.green) : null,
    section("sec-extra", mich ? "Entrate extra" : "Entrate", M.T.ENTRATA, list(M.T.ENTRATA), C.green),
    mich ? section("sec-inv", "Investimenti", M.T.INVESTIMENTO, list(M.T.INVESTIMENTO), C.green, { readonly: true }) : null,
    h("button.fab", { onclick: () => newMov(M.T.USCITA, rerender), "aria-label": "Aggiungi spesa" }, "＋"));
}

function jump(id, rerender) {
  view.open[id] = true;
  rerender();
  document.getElementById(id)?.scrollIntoView({ behavior: "smooth", block: "start" });
}

function newMov(tipo, rerender) {
  const t = M.todayIso();
  const sameMonth = Number(t.slice(0, 4)) === view.y && Number(t.slice(5, 7)) === view.m;
  const data = sameMonth ? t : `${view.y}-${String(view.m).padStart(2, "0")}-01`;
  movimentoSheet({ tipo, data }, { onDone: rerender });
}

export function openMov(x, rerender) {
  if (x.origine === M.ORIGINE_COMUNE) {
    const id = x.id.slice(4);
    const y = Number(x.data.slice(0, 4));
    const row = D.comuneMovs(y).find((m) => m.id === id);
    if (row) comuneSheet(row, { onDone: rerender });
    return;
  }
  if (x.origine === M.ORIGINE_INVESTIMENTI || x.tipo === M.T.INVESTIMENTO) return;
  movimentoSheet(x, { onDone: rerender });
}
