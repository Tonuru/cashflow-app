// Spese comuni: saldo globale fisso in alto, poi il mese scelto (o tutto l'anno).
import * as D from "../data.js";
import * as M from "../model.js";
import { h, C, moneyColor, monthNav, fill } from "../ui.js";
import { comuneSheet } from "../forms.js";

export const view = { y: new Date().getFullYear(), m: new Date().getMonth() + 1, all: false, q: "" };

export function render(root, rerender) {
  const info = D.comuneInfo();
  if (!info) {
    fill(root, h("div.card.center", {}, h("div.card-title", {}, "Spese comuni"),
      h("p.muted", {}, "Nella copia arrivata dal PC non ci sono spese comuni (sul PC non è impostata la cartella comune, "
        + "oppure il PC non ha ancora sincronizzato).")));
    return;
  }
  const { y, m } = view;
  const pa = info.persona_a, pb = info.persona_b;
  const movs = D.comuneMovs(y);
  const s = M.comuneSaldo(movs, pa, pb);
  const banner = s.debitore
    ? h("div.banner.amber", {}, `⚖️ ${s.debitore} deve ${M.fmtEur(s.importo)} a ${s.creditore}`)
    : h("div.banner.green", {}, "✅ Siete in pari");
  const bRimb = h("button.btn.primary.small-btn", { disabled: !s.debitore,
    onclick: () => comuneSheet({}, { rimborso: [s.debitore, s.importo], onDone: rerender }) }, "Registra rimborso");
  const saldoCards = h("div.stats.two", {}, [pa, pb].map((p) => h("div.stat", {},
    h("div.stat-t", {}, `Saldo totale di ${p}`),
    h("div.stat-v", { style: { color: moneyColor(s.saldo[p]) } }, M.fmtEur(s.saldo[p], true)),
    h("div.stat-s", {}, `pagato ${M.fmtEur(s.pagato[p])} · quota ${M.fmtEur(s.quota[p])}`))));
  // resoconto globale: la riga del saldo resta fissa in alto mentre scorri
  const global = [h("div.sticky-top", {}, h("div.row.gap", {}, banner, bRimb)),
    h("div.card", { "data-keep": "" }, h("div.card-title.center", {}, `Resoconto globale ${y}`), saldoCards)];

  const key = D.myKey();
  const meseTot = movs.filter((x) => x.tipo === M.T.SPESA && M.inMonth(x.data, y, m)).reduce((a, x) => a + x.importo, 0);
  const nav = h("div.page-top", {}, monthNav(y, m, (yy, mm) => { view.y = yy; view.m = mm; view.all = false; rerender(); }),
    h("button.chip" + (view.all ? ".on" : ""), { onclick: () => { view.all = !view.all; rerender(); } },
      (view.all ? "✓ " : "") + "Tutto l'anno"));
  const monthCards = h("div.stats.two", {},
    h("div.stat", {}, h("div.stat-t", {}, "Spese comuni del mese"), h("div.stat-v", {}, M.fmtEur(meseTot)),
      h("div.stat-s", {}, `${M.MESI[m - 1]} ${y}`)),
    h("div.stat", {}, h("div.stat-t", {}, "Mia quota del mese"),
      key ? h("div.stat-v", { style: { color: C.accent } }, M.fmtEur(M.comuneQuotaMonth(movs, key, y, m)))
        : h("div.stat-s", {}, `Il tuo nome (${D.profile().utente}) non è tra le persone del file comune`)));

  const q = h("input.search", { type: "search", placeholder: "Cerca…", value: view.q,
    oninput: (e) => { view.q = e.target.value; drawList(); } });
  const listBox = h("div");
  const drawList = () => {
    const rows = M.filterMovs(movs, { year: y, month: view.all ? null : m, text: view.q });
    const spese = rows.filter((x) => x.tipo === M.T.SPESA).reduce((a, x) => a + x.importo, 0);
    fill(listBox, h("div.muted.small.center", {}, `${rows.length} voci · spese ${M.fmtEur(spese)}`),
      h("div.list", {}, rows.length ? rows.map((x) => comuneRow(x, pa, pb, key, () => comuneSheet(x, { onDone: rerender })))
        : h("div.empty", {}, "Nessuna voce.")));
  };
  drawList();
  const list = h("div.card", { "data-fold": "voci" }, h("div.card-title", {}, view.all ? `Voci di tutto il ${y}` : `Voci di ${M.MESI[m - 1].toLowerCase()} ${y}`),
    q, listBox);

  fill(root, global, nav, monthCards,
    h("button.btn.primary.wide.big", { onclick: () => comuneSheet({ data: defaultDate() }, { onDone: rerender }) }, "＋ Aggiungi spesa comune"),
    list, helpCard(),
    h("button.fab", { onclick: () => comuneSheet({ data: defaultDate() }, { onDone: rerender }), "aria-label": "Aggiungi spesa comune" }, "＋"));
}

function defaultDate() {
  const t = M.todayIso();
  return Number(t.slice(0, 4)) === view.y && Number(t.slice(5, 7)) === view.m ? t : `${view.y}-${String(view.m).padStart(2, "0")}-01`;
}

// Come vengono contate le spese comuni (stesso testo dell'app sul PC)
const HELP = `SPESA COMUNE
Chi paga la spesa vede SUBITO la sua quota nelle spese del mese (es. Michele paga 10 € divisi 50/50: Michele vede 5 € quel giorno).
L'altra persona vede la sua quota SOLO QUANDO L'HA RIPAGATA (con un rimborso), nel giorno del rimborso e con la categoria della spesa.

PRESTITO (anticipo)
Chi presta NON ha nessuna spesa: i soldi gli torneranno indietro.
Chi riceve il prestito vede la spesa (categoria «Prestiti restituiti», con il «per cosa») solo QUANDO RESTITUISCE i soldi.

RIMBORSO
Sono i soldi che uno dà all'altro per pareggiare. Coprono i debiti partendo dal più vecchio; ogni spesa o prestito
compare nelle spese del mese quando è coperto per intero.
Se uno dà più del dovuto, la differenza diventa un credito: quando torna indietro non conta come spesa per nessuno.

COMPENSAZIONE
Se tutti e due vi dovete dei soldi, i debiti si compensano da soli (vale come pagato).
Esempio: Michele presta 10 € a Tania; poi Tania paga una spesa di 40 € divisa 20 e 20.
· Tania vede subito i suoi 20 € e anche i 10 € del prestito (compensati con i 20 € che Michele le deve).
· Michele non vede niente finché non dà a Tania i 10 € che restano: allora vede i suoi 20 €.

IL SALDO in alto dice sempre chi deve quanto a chi, contando spese, prestiti e rimborsi.
«Registra rimborso» prepara il rimborso giusto per pareggiare.`;
function helpCard() {
  return h("div.card", { "data-fold": "help" }, h("div.card-title", {}, "ⓘ Come funziona"),
    h("div.help-text", {}, HELP.split("\n\n").map((par) => {
      const [head, ...rest] = par.split("\n");
      return h("p", {}, h("b", {}, head), rest.join(" "));
    })));
}

function comuneRow(x, pa, pb, key, onTap) {
  const rimb = x.tipo === M.T.RIMBORSO;
  const prest = x.tipo === M.T_PRESTITO;
  const mine = key && !rimb && !prest ? (x.importo * Number(x[key] || 0)) / 100 : null;
  const to = x.pagato_da === pa ? pb : pa;
  const sub = rimb ? `${M.fmtDate(x.data).slice(0, 5)} · rimborso: ${x.pagato_da} dà i soldi a ${to}`
    : prest ? `${M.fmtDate(x.data).slice(0, 5)} · prestito: ${x.pagato_da} presta a ${to}${x.categoria ? " · per " + x.categoria : ""}`
    : `${M.fmtDate(x.data).slice(0, 5)} · ${x.categoria || "—"} · pagato da ${x.pagato_da || "?"} · ${pa} ${Number(x.quota_a ?? 0)}% / ${pb} ${Number(x.quota_b ?? 0)}%`;
  return h("button.item" + (x._pending ? ".pending" : ""), { type: "button", onclick: onTap },
    h("div.item-main", {}, h("div.item-title", {}, x.descrizione || (rimb ? "Rimborso" : prest ? "Prestito" : x.categoria || "—")),
      h("div.item-sub", {}, sub)),
    h("div.item-amt", {}, h("div", { style: { color: rimb ? C.accent : prest ? C.amber : C.text } }, M.fmtEur(x.importo)),
      mine != null ? h("div.item-mine", {}, `mia ${M.fmtEur(mine)}`) : null));
}
