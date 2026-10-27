// Home: a colpo d'occhio come va il mese, il conto comune, cosa arriva, le ultime voci e i due pulsanti per
// aggiungere (spesa mia / spesa comune). Tutto il resto sta in «Dettagli».
import * as D from "../data.js";
import * as M from "../model.js";
import { h, C, fill } from "../ui.js";
import { quickAdd } from "../quick.js";
import { semaforiDots } from "../semafori.js";
import * as Mese from "./mese.js";
import { obiettiviStati } from "./funzioni.js";

const ymNow = () => { const t = M.todayIso(); return [Number(t.slice(0, 4)), Number(t.slice(5, 7))]; };
const daysTo = (iso) => Math.round((Date.parse(iso + "T00:00:00Z") - Date.parse(M.todayIso() + "T00:00:00Z")) / 864e5);
const bar = (pct, color, track = "rgba(0,0,0,.3)", hgt = 6) => h("div.hbar", { style: { height: hgt + "px", background: track } },
  h("i", { style: { width: `${Math.max(0, Math.min(100, pct))}%`, background: color } }));

/** Quanto rimane nel mese (come in «Mese per mese»: per Michele conta come hai scelto lì). */
export function monthSummary(y, m) {
  if (!D.isMichele()) {
    const t = D.taniaMonth(y, m);
    return { rimane: t.rimane, entrate: t.entrate, spese: t.spese, label: "rimane" };
  }
  const t = M.monthTotals(D.allMovs(y), y, m);
  const pt = t.per_tipo;
  const st = pt[M.T.STIPENDIO] || 0, iv = pt[M.T.INVESTIMENTO] || 0, ex = pt[M.T.ENTRATA] || 0;
  const r = M.rimanenti(t);
  const mode = Mese.view.mode;
  return { rimane: [r.solo_stipendio, r.senza_extra, r.totale][mode], entrate: [st, st + iv, st + iv + ex][mode],
    spese: t.uscite, label: Mese.MODI[mode][1].toLowerCase() };
}

/** Conto comune: chi deve a chi (dal file dell'anno, come la pagina Spese comuni). */
export function comuneSummary() {
  const info = D.comuneInfo();
  if (!info) return null;
  const [y] = ymNow();
  const s = M.comuneSaldo(D.comuneMovs(y), info.persona_a, info.persona_b);
  const me = D.meInComune();
  if (!s.debitore) return { text: "siete in pari", sub: "✓ niente da rimborsare", color: C.green };
  if (s.debitore === me) return { text: `devi ${M.fmtEur(s.importo)}`, sub: `a ${s.creditore}`, color: C.amber };
  return { text: `ti deve ${M.fmtEur(s.importo)}`, sub: s.debitore, color: C.green };
}

/** Cosa arriva: la scadenza più vicina, oppure le spese fisse del mese ancora da inserire. */
export function inArrivo() {
  const [y, m] = ymNow();
  const sc = (D.scadenze() || []).filter((x) => x.attiva !== false && x.data).map((x) => [x, daysTo(x.data)])
    .sort((a, b) => a[1] - b[1]);
  const near = sc.find(([, left]) => left <= 30);
  if (near) {
    const [x, left] = near;
    return { title: "IN ARRIVO", text: x.nome, sub: M.whenText(left), color: left <= 7 ? C.amber : C.text, go: "scadenze" };
  }
  const fisse = M.fisseMonth(D.fisse("personal"), D.personalMovs(y), y, m).filter((r) => !r.voce && r.fissa.attiva !== false);
  if (fisse.length) {
    return { title: "SPESE FISSE", text: `${fisse.length} da inserire`, sub: fisse.slice(0, 2).map((r) => r.fissa.nome).join(", "),
      color: C.amber, go: "mese" };
  }
  if (sc.length) {
    const [x, left] = sc[0];
    return { title: "IN ARRIVO", text: x.nome, sub: left >= 0 ? `il ${M.fmtDate(x.data).slice(0, 5)}` : M.whenText(left),
      color: C.text, go: "scadenze" };
  }
  return { title: "IN ARRIVO", text: "niente", sub: "nessuna scadenza vicina", color: C.green, go: "scadenze" };
}

export function render(root, rerender, go) {
  const [y, m] = ymNow();
  const p = D.profile();
  const ms = monthSummary(y, m);
  const b = D.budget();
  const bst = b ? M.budgetStatus(D.monthSpese(y, m), b) : null;
  const bcol = bst ? (bst.step >= 100 ? C.red : bst.step >= 80 ? C.amber : "#5BF0A8") : "#5BF0A8";
  const hello = h("div.h-hello", {},
    h("div.h-avatar", {}, (p.utente || "?").slice(0, 1).toUpperCase()),
    h("b", {}, p.utente ? `Ciao ${p.utente}` : "Ciao"), h("div", { style: { flex: "1" } }), semaforiDots());

  const aur = h("button.h-aur", { onclick: () => go("mese"), "aria-label": "Apri il mese" },
    h("div.h-aur-t", {}, `${M.MESI[m - 1].toUpperCase()} · ${ms.label.toUpperCase()}`),
    h("div.h-aur-v", {}, M.fmtEur(ms.rimane, true).replace(",00 €", " €")),
    bst ? [h("div.h-aur-row", {}, h("span", {}, `budget usato ${bst.pct.toFixed(0)}%`),
      h("span", {}, bst.resto >= 0 ? h("span", {}, "restano ", h("b", {}, M.fmtEur(bst.resto))) : h("b", {}, `sforato di ${M.fmtEur(-bst.resto)}`))),
    bar(bst.pct, bcol)]
      : [h("div.h-aur-row", {}, h("span", {}, `entrate ${M.fmtEur(ms.entrate)}`), h("span", {}, `spese ${M.fmtEur(ms.spese)}`)),
        bar(ms.entrate > 0 ? (ms.spese / ms.entrate) * 100 : 0, ms.spese > ms.entrate ? C.red : "#5BF0A8")]);

  const cs = comuneSummary();
  const arr = inArrivo();
  const tile = (title, text, sub, color, onclick) => h("button.h-tile", { onclick },
    h("div.h-tile-t", {}, title), h("div.h-tile-v", { style: { color } }, text), h("div.h-tile-s", {}, sub));
  const tiles = h("div.h-tiles", {},
    cs ? tile("CONTO COMUNE", cs.text, cs.sub, cs.color, () => go("comuni")) : null,
    tile(arr.title, arr.text, arr.sub, arr.color, () => go(arr.go)));

  // ultime voci (tue e la tua parte delle comuni), le più recenti
  const movs = D.allMovs(y).concat(m <= 2 ? D.allMovs(y - 1) : [])
    .filter((x) => x.tipo !== M.T.INVESTIMENTO && x.origine !== M.ORIGINE_INVESTIMENTI && x.data <= M.todayIso());
  movs.sort((a, b2) => (b2.data || "").localeCompare(a.data || "") || (b2.inserito || "").localeCompare(a.inserito || ""));
  const last = movs.slice(0, 3);
  const voce = (x) => {
    const out = x.tipo === M.T.USCITA;
    const com = x.origine === M.ORIGINE_COMUNE;
    const when = x.data === M.todayIso() ? "oggi" : M.fmtDate(x.data).slice(0, 5);
    return h("button.h-voce" + (x._pending ? ".pending" : ""), { onclick: () => Mese.openMov(x, rerender) },
      h("i.h-voce-ic", { style: { background: com ? "#2C2140" : out ? "#1C3527" : "#1C2B48" } }),
      h("div.h-voce-m", {}, h("div.h-voce-n", {}, (x.descrizione || x.categoria || "—") + (x.allegato ? " 📎" : "")),
        h("div.h-voce-s", {}, [com ? "comune · tua parte" : x.categoria, when].filter(Boolean).join(" · "))),
      h("b", { style: { color: out ? "#FF7A7A" : "#4BE39A" } }, (out ? "−" : "+") + M.fmtEur(x.importo).replace(" €", "")));
  };
  const lastCard = h("div.h-sec", {},
    h("div.h-sec-head", {}, h("b", {}, "ULTIME VOCI"), h("button.h-link", { onclick: () => go("mese") }, "Tutte ›")),
    h("div.h-card", {}, last.length ? last.map(voce) : h("div.empty", {}, "Nessuna voce in questo mese.")));

  // obiettivo più avanti (se gli obiettivi sono accesi)
  const obs = obiettiviStati("personal").filter((x) => x.st.obiettivo).sort((a, b2) => b2.st.pct - a.st.pct);
  const goal = obs.length ? h("button.h-goal", { onclick: () => go("obiettivi") },
    h("div.h-goal-row", {}, h("b", {}, `🐷 ${obs[0].o.nome}`),
      h("span", {}, `${M.fmtEur(obs[0].st.risparmiato).replace(",00 €", "")} di ${M.fmtEur(obs[0].st.obiettivo).replace(",00 €", " €")} · ${obs[0].st.pct.toFixed(0)}%`)),
    bar(obs[0].st.pct, "#5BF0A8", "#232B37", 7)) : null;

  const add = h("div.h-add", {},
    h("button.h-add-me", { onclick: () => quickAdd("personal", { onDone: rerender }) }, "＋ Spesa mia"),
    D.comuneInfo() ? h("button.h-add-com", { onclick: () => quickAdd("comune", { onDone: rerender }) }, "＋ Spesa comune") : null);

  fill(root, hello, aur, tiles, lastCard, goal, add);
}
