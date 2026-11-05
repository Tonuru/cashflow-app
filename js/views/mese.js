// Il mio mese (Michele, stile «T1 · Come sul PC»): quanto rimane, categorie, voci del mese in due colonne.
// Per Tania la pagina è in tania.js.
import * as D from "../data.js";
import * as M from "../model.js";
import { h, monthNav, fill, sheet } from "../ui.js";
import { movimentoSheet, comuneSheet } from "../forms.js";
import { moneyHero, pctShort, catsCard, vociCard, openFolds } from "./parts.js";
import * as Tania from "./tania.js";
import { fisseCard, budgetCard, scadenzeCard } from "./mensile.js";

export const MODI = [
  ["Stipendio", "Rimane", "stipendio − spese"],
  ["Stipendio + investimenti", "Rimane con invest.", "stipendio + investimenti − spese"],
  ["Stipendio + invest. + extra", "Rimane con tutto", "tutte le entrate − spese"],
];
export const view = { y: new Date().getFullYear(), m: new Date().getMonth() + 1, mode: 0, open: {} };
try { view.mode = Number(localStorage.getItem("cf.mode") || 0) % 3; } catch { /* */ }
export function setMode(i) { view.mode = (i + 3) % 3; try { localStorage.setItem("cf.mode", view.mode); } catch { /* */ } }

export function render(root, rerender) {
  if (!D.isMichele()) { Tania.renderMese(root, rerender, view); return; }
  const { y, m } = view;
  const mode = view.mode;
  const movs = D.allMovs(y);
  const t = M.monthTotals(movs, y, m);
  const pt = t.per_tipo;
  const st = pt[M.T.STIPENDIO] || 0, iv = pt[M.T.INVESTIMENTO] || 0, ex = pt[M.T.ENTRATA] || 0;
  const r = M.rimanenti(t);
  const ent = [st, st + iv, st + iv + ex];
  const rim = [r.solo_stipendio, r.senza_extra, r.totale];
  const rs = rim[mode], en = ent[mode];

  const top = h("div.page-top", {}, monthNav(y, m, (yy, mm) => { view.y = yy; view.m = mm; rerender(); }));

  // «T1 · Come sul PC»: fascia colorata con quanto rimane, la barra speso/rimane ed Entrato · Uscito · Rimane
  const hero = moneyHero(`Ti rimane · ${MODI[mode][2]}`, rs, en, t.uscite,
    [["Entrato", M.fmtEur(en)], ["Uscito", M.fmtEur(t.uscite)], ["Rimane", pctShort(rs, en)]]);
  const seg = h("div.seg.mseg", {}, ["Stipendio", "+ Investimenti", "Tutto"].map((name, i) =>
    h("button" + (i === mode ? ".on" : ""), { onclick: () => { setMode(i); rerender(); } }, name)));
  const cats = catsCard(movs, y, m, rerender, openMov);
  const voci = vociCard(M.filterMovs(movs, { year: y, month: m }), view, rerender, openMov);
  const btns = h("div.mbtns", {},
    h("button.mb-spesa", { onclick: () => newMov(M.T.USCITA, rerender) }, "＋ Spesa"),
    h("button.mb-ent", { onclick: () => entrataMenu(rerender) }, "＋ Entrata"));
  fill(root, top, hero, seg, ...openFolds([[budgetCard(y, m), "budget"], [scadenzeCard(rerender), "scadenze"],
    [cats, "categorie"], [fisseCard("personal", y, m, rerender), "fisse"], [voci, "voci"]]), btns);
}

function entrataMenu(rerender) {
  const s = sheet("Nuova entrata");
  const pick = (tipo) => { s.close(); newMov(tipo, rerender); };
  fill(s.body, h("div.ent-pick", {},
    h("button.btn", { onclick: () => pick(M.T.STIPENDIO) }, "💼 Stipendio"),
    h("button.btn", { onclick: () => pick(M.T.ENTRATA) }, "💶 Entrata extra")),
  h("p.muted.small.center", {}, "Gli investimenti arrivano da soli dal file Investimenti."));
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
