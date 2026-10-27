// «Dettagli»: le pagine complete (mese, panoramica, conto comune, eventi, obiettivi, scadenze, cosa è cambiato),
// ognuna con un numero già visibile, così spesso non serve aprirla.
import * as D from "../data.js";
import * as M from "../model.js";
import { h, C, fill, monthNav } from "../ui.js";
import { vociSheet } from "../forms.js";
import * as Mese from "./mese.js";
import { comuneSummary } from "./home.js";
import { obiettiviCard, obiettiviStati } from "./funzioni.js";
import { scadenzeCard } from "./mensile.js";

const ymNow = () => { const t = M.todayIso(); return [Number(t.slice(0, 4)), Number(t.slice(5, 7))]; };
const prevYm = () => { const [y, m] = ymNow(); return m === 1 ? [y - 1, 12] : [y, m - 1]; };

export const PAGES = {
  mese: "Mese per mese", anno: "Panoramica", comuni: "Conto comune", eventi: "Eventi", obiettivi: "Obiettivi",
  scadenze: "Scadenze", cambiato: "Cosa è cambiato",
};

function row(id, icon, bg, title, sub, val, color, go) {
  return h("button.d-row", { "data-go": id, onclick: () => go(id) },
    h("div.d-ic", { style: { background: bg } }, icon),
    h("div.d-mid", {}, h("div.d-t", {}, title), sub ? h("div.d-s", {}, sub) : null),
    val ? h("b.d-v", { style: { color: color || C.text } }, val) : null, h("span.d-chev", {}, "›"));
}
const group = (title, ...rows) => h("div.d-group", {}, h("div.d-gt", {}, title), h("div.d-card", {}, rows.filter(Boolean)));

function yearRimane(y) {
  if (!D.isMichele()) {
    let r = 0;
    for (let m = 1; m <= 12; m++) r += D.taniaMonth(y, m).rimane;
    return r;
  }
  const movs = D.allMovs(y);
  let r = 0;
  for (let m = 1; m <= 12; m++) r += M.rimanenti(M.monthTotals(movs, y, m)).totale;
  return r;
}

export function render(root, rerender, go) {
  const [y, m] = ymNow();
  const [py, pm] = prevYm();
  const cam = M.cambiamenti(D.allMovsEveryYear(), py, pm);
  const nCam = M.cambiamentiRighe(cam, 20).length;
  const cs = comuneSummary();
  const evs = M.eventiElenco(D.allMovsEveryYear());
  const obs = obiettiviStati("personal").concat(obiettiviStati("comune"));
  const sc = (D.scadenze() || []).filter((x) => x.attiva !== false && x.data).sort((a, b) => a.data.localeCompare(b.data));
  const due = M.scadenzeDue(D.scadenze());
  const yr = yearRimane(y);
  const other = D.profile().altra_persona || D.comuneInfo()?.persona_b || "";
  fill(root,
    h("div.d-head", {}, h("b", {}, "Dettagli"), h("div.muted.small", {}, "tutto il resto, quando serve")),
    group("I MIEI CONTI",
      row("mese", "🗓️", "#1E2D4A", "Mese per mese", D.isMichele() ? "voci, categorie, spese fisse" : "sedute, entrate, spese",
        M.MESI[m - 1].toLowerCase(), null, go),
      row("anno", "📊", "#16352A", "Panoramica dell'anno", D.isMichele() ? "grafico, tabella dei mesi" : "tasse, soglia, mesi",
        M.fmtEur(yr, true).replace(",00 €", " €"), yr >= 0 ? C.green : C.red, go),
      row("cambiato", "🔎", "#3A2E14", "Cosa è cambiato",
        nCam ? `${nCam} ${nCam === 1 ? "novità" : "novità"} a ${M.MESI[pm - 1].toLowerCase()}` : `niente di particolare a ${M.MESI[pm - 1].toLowerCase()}`,
        null, null, go)),
    cs ? group(other ? `INSIEME A ${other.toUpperCase()}` : "CONTO COMUNE",
      row("comuni", "🤝", "#2A1E44", "Conto comune", "voci, rimborsi, chiudi il mese", cs.text, cs.color, go)) : null,
    group("ALTRO",
      row("eventi", "🎒", "#1E2D4A", "Eventi", evs.length ? evs.slice(0, 2).map((e) => e.nome).join(" · ") : "nessuna etichetta usata",
        evs.length ? M.fmtEur(evs[0].spese).replace(",00 €", " €") : null, null, go),
      row("obiettivi", "🐷", "#16352A", "Obiettivi",
        obs.length ? obs.slice(0, 2).map(({ o, st }) => `${o.nome}${st.obiettivo ? ` ${st.pct.toFixed(0)}%` : ""}`).join(" · ")
          : "nessun obiettivo attivo", null, null, go),
      row("scadenze", "⏰", "#3A2E14", "Scadenze",
        sc.length ? `${sc[0].nome} · ${M.fmtDate(sc[0].data).slice(0, 5)}` : "nessuna scadenza",
        due.length ? String(due.length) : null, C.amber, go)));
}

// ---------------------------------------------------------------- pagine piccole
export const cambiView = { y: prevYm()[0], m: prevYm()[1] };

export function renderPage(id, root, rerender, go) {
  if (id === "eventi") return eventi(root, rerender);
  if (id === "obiettivi") return obiettivi(root, rerender);
  if (id === "scadenze") return scadenze(root, rerender);
  if (id === "cambiato") return cambiato(root, rerender);
  return null;
}

function eventi(root, rerender) {
  const evs = M.eventiElenco(D.allMovsEveryYear());
  const cols = M.colors(D.categorie(new Date().getFullYear()));
  fill(root, evs.length ? evs.map((e) => h("button.card.ev", { "data-keep": "", onclick: () => vociSheet(`🏷 ${e.nome}`, e.voci,
    { onTap: (x) => Mese.openMov(x, rerender) }) },
  h("div.row.between", {}, h("b", {}, `🏷 ${e.nome}`), h("b", { style: { color: C.red } }, M.fmtEur(e.spese))),
  h("div.small.muted", {}, `${M.fmtDate(e.dal)}${e.al !== e.dal ? " – " + M.fmtDate(e.al) : ""} · ${e.n} voci`),
  h("div.ev-cats", {}, e.categorie.slice(0, 4).map(([c, v]) => h("span.ev-cat", {},
    h("i", { style: { background: cols[c] || "#9AA3AE" } }), `${c} ${M.fmtEur(v).replace(",00 €", " €")}`)))))
    : h("div.card.center", { "data-keep": "" }, h("p.muted", {}, "Nessun evento. Quando aggiungi una spesa scrivi un'etichetta "
      + "(es. «Viaggio Lisbona»): le spese con la stessa etichetta si sommano qui, anche se sono in mesi diversi.")));
}

function obiettivi(root, rerender) {
  const a = obiettiviCard("personal", rerender), b = obiettiviCard("comune", rerender);
  for (const c of [a, b]) if (c) c.dataset.keep = "";
  fill(root, a, b, !a && !b ? h("div.card.center", { "data-keep": "" }, h("p.muted", {},
    "Nessun obiettivo attivo. Gli obiettivi si creano dal PC (Panoramica → Obiettivi → Gestisci).")) : null);
}

function scadenze(root, rerender) {
  const due = scadenzeCard(rerender);
  const all = (D.scadenze() || []).filter((x) => x.attiva !== false && x.data).sort((a, b) => a.data.localeCompare(b.data));
  fill(root, due,
    h("div.card", { "data-keep": "" }, h("div.card-title", {}, "Tutte le scadenze"),
      all.length ? h("div.fx-list", {}, all.map((x) => h("div.fx-row", {},
        h("div.fx-name", {}, h("b", {}, x.nome), x.categoria ? h("div.small.muted", {}, x.categoria) : null),
        h("div", {}, h("div", {}, M.fmtDate(x.data)), x.importo ? h("div.small.muted", {}, M.fmtEur(x.importo)) : null))))
        : h("div.empty", {}, "Nessuna scadenza. Si aggiungono dal PC (Impostazioni → Scadenze).")));
}

function cambiato(root, rerender) {
  const { y, m } = cambiView;
  const res = M.cambiamenti(D.allMovsEveryYear(), y, m);
  const rr = M.cambiamentiRighe(res, 20);
  const ic = { up: ["▲", C.red], down: ["▼", C.green], price: ["€", C.amber], new: ["＋", "#7FAEFF"], gone: ["✕", C.muted] };
  fill(root,
    h("div.page-top", {}, monthNav(y, m, (yy, mm) => { cambiView.y = yy; cambiView.m = mm; rerender(); })),
    h("div.card", { "data-keep": "" }, h("div.card-title", {}, `🔎 ${M.MESI[m - 1]} ${y}`),
      h("div.small.muted", {}, M.cambiamentiRiassunto(res)),
      rr.length ? h("div.cam-list", {}, rr.map(([k, t]) => h("div.cam-row", {},
        h("b.cam-ic", { style: { color: ic[k][1] } }, ic[k][0]), h("span", {}, t))))
        : h("div.empty", {}, res.mesi_confronto ? "Niente di particolare da segnalare." : "")));
}
