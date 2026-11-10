// Pezzi della nuova grafica condivisi da Michele e Tania: fascia verde («T1 · Come sul PC»), categorie a barre,
// voci del mese in due colonne, schede della Panoramica, riquadri che partono aperti.
import * as D from "../data.js";
import * as M from "../model.js";
import { h, C, moneyColor, bars } from "../ui.js";
import { vociSheet } from "../forms.js";

/** Fascia colorata: titolo, cifra grande, barra speso/rimane e tre riquadri [titolo, valore]. */
export function moneyHero(title, value, entrate, spese, chips) {
  const spentPct = entrate > 0 ? Math.min(100, (spese / entrate) * 100) : (spese > 0 ? 100 : 0);
  return h("div.mhero" + (value < -0.004 ? ".neg" : ""), { "data-keep": "" },
    h("div.mh-t", {}, title.toUpperCase()),
    h("div.mh-v", {}, M.fmtEur(value, true)),
    h("div.mh-split", {}, h("i", { style: { width: `${spentPct.toFixed(1)}%` } })),
    h("div.mh-chips", {}, chips.map(([t, v]) => h("div.mh-chip", {}, h("div", {}, t), h("b", {}, v)))));
}

export const pctShort = (v, ent) => { const p = M.pctText(v, ent); return p ? p.replace(/ rimane$/, "") : "—"; };

/** «Dove sono andati»: categorie con la barra (tocco = le voci della categoria). movs = solo le spese da contare. */
export function catsCard(movs, y, m, rerender, openMov, { title = "Dove sono andati", empty } = {}) {
  const cols = M.colors(D.categorie(y));
  const piv = M.categoryPivot(movs, y, m ?? undefined);
  const tot = piv.reduce((a, x) => a + x[1], 0);
  const show = (cat) => vociSheet(m ? cat : `${cat} · ${y}`,
    M.filterMovs(movs, { year: y, month: m ?? undefined, tipo: M.T.USCITA, categoria: cat }),
    { onTap: (x) => openMov(x, rerender) });
  const max = piv.length ? piv[0][1] : 0;
  return h("div.card", {},
    h("div.card-title.row.between", {}, h("span", {}, title),
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
    }) : h("div.empty", {}, empty || (m ? "Nessuna spesa in questo mese." : "Nessuna spesa in questo anno.")));
}

/** Etichetta gialla «da ripagare» / verde «ripagata» per la mia quota di una spesa comune pagata dall'altro. */
export function rpTag(x) {
  const t = M.ripagaTag(x);
  return t ? h("span.rp-tag." + t.cls, {}, t.text) : null;
}

/** «Voci del mese»: entrate e spese in due colonne, con Tutte · Spese · Entrate. */
export function vociCard(all, view, rerender, openMov) {
  const sorted = all.slice().sort((a, b) => String(b.data).localeCompare(String(a.data)));
  const filt = view.filt || "tutte";
  const rows = sorted.filter((x) => filt === "tutte" || (filt === "spese") === ((x.tipo || M.T.USCITA) === M.T.USCITA));
  const vrow = (x) => {
    const spesa = (x.tipo || M.T.USCITA) === M.T.USCITA;
    const comune = x.origine === M.ORIGINE_COMUNE;
    const v = Number(x.importo || 0);
    // le sedute hanno il paziente nella specifica: nascosto se i nomi sono nascosti
    const sub = M.isProfIncome(x) ? D.pazName(x.sottocategoria) : x.sottocategoria;
    const cat = [x.categoria, sub].filter(Boolean).join(" · ");
    const amt = (spesa ? "−" : v < 0 ? "−" : "+") + M.fmtEur(Math.abs(v));
    const color = comune ? C.violet : spesa || v < 0 ? C.red : C.green;
    return h("button.mv-row" + (x._pending ? ".pending" : ""), { type: "button", onclick: () => openMov(x, rerender) },
      h("div.mv-main", {}, h("div.mv-t", {}, (x.descrizione || cat || x.tipo || "—") + (x.allegato ? " 📎" : "")),
        h("div.mv-s", {}, [M.fmtDate(x.data).slice(0, 5), cat || x.tipo, comune ? "spesa comune" : ""]
          .filter(Boolean).join(" · ")),
        M.ripagaTag(x) ? h("div.rp-line", {}, rpTag(x)) : null),
      h("b.mv-in", { style: { color } }, spesa ? "" : amt),
      h("b.mv-out", { style: { color } }, spesa ? amt : ""));
  };
  const fbtn = (k, label) => h("button" + (filt === k ? ".on" : ""), { onclick: () => { view.filt = k; rerender(); } }, label);
  return h("div.card", { id: "mvoci" },
    h("div.card-title.row.between", {}, h("span", {}, "Voci del mese"),
      h("div.mv-f", {}, fbtn("tutte", "Tutte"), fbtn("spese", "Spese"), fbtn("entrate", "Entrate"))),
    rows.length ? [h("div.mv-head", {}, h("span", {}, ""), h("span", {}, "Entrate"), h("span", {}, "Spese")),
      ...rows.map(vrow)] : h("div.empty", {}, "Nessuna voce."));
}

/** I riquadri partono aperti e si chiudono toccando il titolo (restano chiusi finché non li riapri). */
export function openFolds(pairs) {
  for (const [card, name] of pairs) {
    if (!card) continue;
    delete card.dataset.keep;
    card.dataset.fold = name;
    card.dataset.start = "open";
  }
  return pairs.map(([c]) => c);
}

/** Riquadro sempre aperto (senza chiusura al tocco del titolo). */
export function keepOpen(card) { if (card) card.dataset.keep = ""; return card; }

/** Schede della Panoramica: TABS = [[chiave, testo]]; ritorna [elemento, scheda scelta]. */
export function pageTabs(tabs, view, rerender) {
  const cur = tabs.some(([k]) => k === view.tab) ? view.tab : tabs[0][0];
  const el = h("div.ptabs", {}, tabs.map(([k, label]) => h("button" + (k === cur ? ".on" : ""),
    { "data-ptab": k, onclick: () => { view.tab = k; try { sessionStorage.setItem("cf.ptab", k); } catch { /* */ } rerender(); } },
    label)));
  return [el, cur];
}

/** Tabella stretta dei mesi: rows = [{name, ent, spe, rim, has, sel, cls, onclick}]; cifre tonde all'euro. */
export function monthsTable(rows, total) {
  const n0 = (v) => M.fmtEur(Math.round(v)).replace(",00 €", " €");
  const r0 = (v) => M.fmtEur(Math.round(v), true).replace(",00 €", " €");
  const line = (r) => h("button.pt-row" + (r.sel ? ".sel" : "") + (r.cls || ""), { onclick: r.onclick || null },
    h("span.pt-m", {}, r.name), h("span.pt-in", {}, r.ent ? n0(r.ent) : r.ent === "" ? "" : "—"),
    h("span.pt-out", {}, r.spe ? n0(r.spe) : r.spe === "" ? "" : "—"),
    h("b.pt-r", { style: { color: r.has ? (r.color || moneyColor(r.rim)) : C.muted } }, r.has ? r0(r.rim) : "—"));
  return h("div.card", {},
    h("div.pt-head", {}, h("span", {}, "Mese"), h("span", {}, "Entrato"), h("span", {}, "Uscito"), h("span", {}, "Rimane")),
    rows.map(line),
    line({ name: "Totale", ent: total.ent, spe: total.spe, rim: total.rim, has: true, cls: ".total" }),
    h("div.muted.small.center", { style: { marginTop: "6px" } }, "Tocca un mese per aprirlo"));
}

export const YEARS_WINDOW = 6;      // anni nel grafico: quello scelto e i cinque prima

/** «Anno per anno» con l'anno da scegliere (frecce o tocco su una barra), come sul PC: nel grafico l'anno scelto e
 *  i cinque prima, sotto i conti di quell'anno e il confronto con l'anno prima.
 *  series = [{y, a: entrate, b: spese}] (tutti gli anni, in ordine); opts: {net, onNet, onOpen}. */
export function yearsPicker(series, selYear, onSel, { net = false, onNet, onOpen } = {}) {
  if (!series.length) return null;
  const ys = series.map((s) => s.y);
  const sel = ys.includes(selYear) ? selYear : ys[ys.length - 1];
  const k = ys.indexOf(sel);
  const shown = series.slice(Math.max(0, k - YEARS_WINDOW + 1), k + 1);
  const cur = series[k], prev = k > 0 ? series[k - 1] : null;
  const r = cur.a - cur.b;
  const nav = h("div.yp-nav", {},
    h("button.yp-a", { disabled: k === 0, onclick: () => onSel(ys[k - 1]), "aria-label": "Anno prima" }, "‹"),
    h("b.yp-y", {}, String(sel)),
    h("button.yp-a", { disabled: k === ys.length - 1, onclick: () => onSel(ys[k + 1]), "aria-label": "Anno dopo" }, "›"));
  const d = prev ? r - (prev.a - prev.b) : null;
  return h("div.card", { id: "anni" },
    h("div.card-title.row.between", {}, h("span", {}, "Anno per anno"), nav),
    onNet ? h("div.seg.small", { style: { marginBottom: "6px" } },
      h("button" + (net ? "" : ".on"), { onclick: () => onNet(false) }, "Entrate/spese"),
      h("button" + (net ? ".on" : ""), { onclick: () => onNet(true) }, "Solo rimane")) : null,
    bars(shown.map((s) => ({ label: String(s.y), a: s.a, b: s.b })), { net, sel: shown.indexOf(cur), height: 140,
      onPick: (i) => onSel(shown[i].y) }),
    h("div.legend", {}, "Tocca un anno per sceglierlo"),
    h("div.yp-sum", {},
      h("div.row.between", {}, h("span", {}, "Entrate"), h("b", { style: { color: C.green } }, M.fmtEur(cur.a))),
      h("div.row.between", {}, h("span", {}, "Spese"), h("b", { style: { color: C.red } }, M.fmtEur(cur.b))),
      h("div.row.between", {}, h("b", {}, `Rimane nel ${sel}`), h("b", { style: { color: moneyColor(r) } }, M.fmtEur(r, true))),
      prev ? h("div.row.between.muted.small", {}, h("span", {}, `Rispetto al ${prev.y}`),
        h("b", { style: { color: moneyColor(d) } }, M.fmtEur(d, true))) : null),
    onOpen ? h("button.btn.yp-open", { onclick: () => onOpen(sel) }, `Apri la Panoramica del ${sel}`) : null);
}
