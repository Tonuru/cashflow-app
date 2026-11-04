// Il mio mese (Michele, stile «T1 · Come sul PC»): quanto rimane, categorie, voci del mese in due colonne.
// Per Tania la pagina è in tania.js.
import * as D from "../data.js";
import * as M from "../model.js";
import { h, C, monthNav, fill, sheet } from "../ui.js";
import { movimentoSheet, vociSheet, comuneSheet } from "../forms.js";
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
  const pc = M.pctText(rs, en);

  const top = h("div.page-top", {}, monthNav(y, m, (yy, mm) => { view.y = yy; view.m = mm; rerender(); }));

  // «T1 · Come sul PC»: fascia colorata con quanto rimane, la barra speso/rimane ed Entrato · Uscito · Rimane
  const spentPct = en > 0 ? Math.min(100, (t.uscite / en) * 100) : (t.uscite > 0 ? 100 : 0);
  const chip = (title, val) => h("div.mh-chip", {}, h("div", {}, title), h("b", {}, val));
  const hero = h("div.mhero" + (rs < -0.004 ? ".neg" : ""), { "data-keep": "" },
    h("div.mh-t", {}, `TI RIMANE · ${MODI[mode][2].toUpperCase()}`),
    h("div.mh-v", {}, M.fmtEur(rs, true)),
    h("div.mh-split", {}, h("i", { style: { width: `${spentPct.toFixed(1)}%` } })),
    h("div.mh-chips", {}, chip("Entrato", M.fmtEur(en)), chip("Uscito", M.fmtEur(t.uscite)),
      chip("Rimane", pc ? pc.replace(/ rimane$/, "") : "—")));
  const seg = h("div.seg.mseg", {}, ["Stipendio", "+ Investimenti", "Tutto"].map((name, i) =>
    h("button" + (i === mode ? ".on" : ""), { onclick: () => { setMode(i); rerender(); } }, name)));

  // dove sono andati: categorie con la barra (tocco = le voci della categoria)
  const cols = M.colors(D.categorie(y));
  const piv = M.categoryPivot(movs, y, m);
  const showVoci = (cat) => {
    const rows = M.filterMovs(movs, { year: y, month: m, tipo: M.T.USCITA, categoria: cat });
    vociSheet(cat, rows, { onTap: (x) => openMov(x, rerender) });
  };
  const maxCat = piv.length ? piv[0][1] : 0;
  const cats = h("div.card", { "data-keep": "" },
    h("div.card-title.row.between", {}, h("span", {}, "Dove sono andati"),
      h("span.muted.small", {}, piv.length ? "tocca per le voci" : "")),
    piv.length ? piv.map(([c, v, subs]) => {
      const col = cols[c] || "#9AA3AE";
      const sub = subs.filter(([x]) => x).slice(0, 3).map(([x, sv]) => `${x} ${M.fmtEur(sv).replace(",00 €", " €")}`).join(" · ");
      return h("button.mc-row", { onclick: () => showVoci(c) },
        h("i.mc-ic", { style: { background: col + "33", color: col } }, (c || "?").slice(0, 1).toUpperCase()),
        h("div.mc-mid", {}, h("div.mc-top", {}, h("span.mc-name", {}, c),
          h("span.mc-pct", {}, t.uscite ? `${Math.round((v / t.uscite) * 100)}%` : "")),
        h("div.mc-bar", {}, h("i", { style: { width: `${maxCat ? (v / maxCat) * 100 : 0}%`, background: col } })),
        sub ? h("div.mc-sub", {}, sub) : null),
        h("b.mc-v", {}, M.fmtEur(v)));
    }) : h("div.empty", {}, "Nessuna spesa in questo mese."));

  // voci del mese: entrate e spese in due colonne (Tutte · Spese · Entrate)
  const all = M.filterMovs(movs, { year: y, month: m }).slice()
    .sort((a, b) => String(b.data).localeCompare(String(a.data)));
  const filt = view.filt || "tutte";
  const rows = all.filter((x) => filt === "tutte" || (filt === "spese") === (x.tipo === M.T.USCITA));
  const vrow = (x) => {
    const spesa = x.tipo === M.T.USCITA;
    const comune = x.origine === M.ORIGINE_COMUNE;
    const v = Number(x.importo || 0);
    const cat = [x.categoria, x.sottocategoria].filter(Boolean).join(" · ");
    const amt = (spesa ? "−" : v < 0 ? "−" : "+") + M.fmtEur(Math.abs(v));
    const color = comune ? C.violet : spesa || v < 0 ? C.red : C.green;
    return h("button.mv-row" + (x._pending ? ".pending" : ""), { type: "button", onclick: () => openMov(x, rerender) },
      h("div.mv-main", {}, h("div.mv-t", {}, (x.descrizione || cat || x.tipo || "—") + (x.allegato ? " 📎" : "")),
        h("div.mv-s", {}, [M.fmtDate(x.data).slice(0, 5), spesa ? cat : x.tipo, comune ? "spesa comune" : ""]
          .filter(Boolean).join(" · "))),
      h("b.mv-in", { style: { color } }, spesa ? "" : amt),
      h("b.mv-out", { style: { color } }, spesa ? amt : ""));
  };
  const fbtn = (k, label) => h("button" + (filt === k ? ".on" : ""), { onclick: () => { view.filt = k; rerender(); } }, label);
  const voci = h("div.card", { "data-keep": "", id: "mvoci" },
    h("div.card-title.row.between", {}, h("span", {}, "Voci del mese"),
      h("div.mv-f", {}, fbtn("tutte", "Tutte"), fbtn("spese", "Spese"), fbtn("entrate", "Entrate"))),
    rows.length ? [h("div.mv-head", {}, h("span", {}, ""), h("span", {}, "Entrate"), h("span", {}, "Spese")),
      ...rows.map(vrow)] : h("div.empty", {}, "Nessuna voce."));

  const btns = h("div.mbtns", {},
    h("button.mb-spesa", { onclick: () => newMov(M.T.USCITA, rerender) }, "＋ Spesa"),
    h("button.mb-ent", { onclick: () => entrataMenu(rerender) }, "＋ Entrata"));

  // i riquadri partono aperti e si chiudono toccando il titolo (resta chiuso finché non lo riapri)
  const foldable = [[budgetCard(y, m), "budget"], [scadenzeCard(rerender), "scadenze"], [cats, "categorie"],
    [fisseCard("personal", y, m, rerender), "fisse"], [voci, "voci"]];
  for (const [card, name] of foldable) {
    if (!card) continue;
    delete card.dataset.keep;
    card.dataset.fold = name;
    card.dataset.start = "open";
  }
  fill(root, top, hero, seg, ...foldable.map(([c]) => c), btns);
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
