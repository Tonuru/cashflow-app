// Funzioni accese dalle Impostazioni del PC: obiettivi di risparmio, chiudi il mese, patrimonio e previsione di
// fine anno (Michele), tasse da mettere da parte, soglia del forfettario, sedute da incassare (Tania).
import * as D from "../data.js";
import * as M from "../model.js";
import { h, C, toast, busy, sheet, fill, moneyColor } from "../ui.js";
import { semaforoLine } from "../semafori.js";

const amountInput = (ph = "importo") => h("input", { type: "text", inputmode: "decimal", placeholder: ph, autocomplete: "off" });
const bar = (v, max, col) => h("div.bbar", {}, h("i", { style: { width: `${max > 0 ? Math.min(100, (v / max) * 100) : 0}%`, background: col } }));
const ymOf = (iso) => [Number(iso.slice(0, 4)), Number(iso.slice(5, 7))];

// ---------------------------------------------------------------- obiettivi di risparmio
function rimaneMap(start) {
  const out = {};
  const [ty, tm] = ymOf(M.todayIso());
  let [y, m] = ymOf(start);
  while (y < ty || (y === ty && m < tm)) {
    out[M.ymKey(y, m)] = D.isMichele() ? M.rimanenti(M.monthTotals(D.allMovs(y), y, m)).totale : D.taniaMonth(y, m).rimane;
    if (m === 12) { y++; m = 1; } else m++;
  }
  return out;
}

const modoText = (o) => o.modo === "fisso" ? `${M.fmtEur(o.valore)} al mese`
  : o.modo === "percentuale" ? `${Number(o.valore || 0).toFixed(0)}% di quello che rimane ogni mese` : "versamenti a mano";

export function obiettiviCard(kind, rerender) {
  const comune = kind === "comune";
  if (comune && !D.comuneInfo()) return null;
  if (!D.feature("obiettivi_attivi", comune)) return null;
  const items = D.lista(kind, "obiettivi").filter((o) => o.attiva !== false);
  if (!items.length) return null;
  const vers = D.lista(kind, "versamenti");
  const starts = items.filter((o) => o.modo === "percentuale" && o.dal).map((o) => o.dal).sort();
  const rim = starts.length && !comune ? rimaneMap(starts[0]) : {};
  return h("div.card", { "data-fold": comune ? "obiettivi-comuni" : "obiettivi" },
    h("div.card-title", {}, comune ? "🐷 Obiettivi comuni" : "🐷 Obiettivi di risparmio"),
    h("div.fx-list", {}, items.map((o) => {
      const st = M.obiettivoStato(o, vers, rim);
      const col = st.in_tempo ? C.green : st.in_tempo === false ? C.amber : C.muted || "#888";
      const bits = [modoText(o)];
      if (st.obiettivo && !st.raggiunto) {
        bits.push(`mancano ${M.fmtEur(st.manca)}`);
        if (st.al_mese != null && o.entro) bits.push(`entro ${M.fmtDate(o.entro)}: ${M.fmtEur(st.al_mese)} al mese`);
      }
      return h("div.ob-row", {},
        h("div.row.between", {}, h("b", {}, o.nome),
          h("span", {}, `${M.fmtEur(st.risparmiato)}${st.obiettivo ? ` · ${st.pct.toFixed(0)}%` : ""}`)),
        st.obiettivo ? bar(st.risparmiato, st.obiettivo, C.green) : null,
        h("div.small.muted", {}, bits.join(" · ")),
        h("div.row.between", {}, h("span.small", { style: { color: col } }, M.previsioneText(st)),
          h("button.btn.small-btn.primary", { type: "button", onclick: () => versaSheet(kind, o, rerender) }, "＋ Versa")));
    })),
    h("div.muted.small", {}, "I versamenti non sono spese: contano solo per l'obiettivo. Gli obiettivi si creano dal PC."));
}

function versaSheet(kind, o, rerender) {
  const s = sheet(`Versamento · ${o.nome}`);
  const fData = h("input", { type: "date", value: M.todayIso() });
  const fImp = amountInput("es. 100");
  const fPrel = h("input", { type: "checkbox" });
  const fNote = h("input", { type: "text", placeholder: "facoltativa" });
  const err = h("div.form-err");
  const b = h("button.btn.primary.wide", { type: "button" }, "Salva");
  b.onclick = () => busy(b, (async () => {
    const v = M.parseAmount(fImp.value);
    if (!v) { err.textContent = "Scrivi l'importo."; return; }
    D.addItem(kind, "versamenti", { data: fData.value || M.todayIso(), obiettivo: o.id, nome: o.nome,
      importo: fPrel.checked ? -Math.abs(v) : Math.abs(v), chi: kind === "comune" ? D.meInComune() : "", note: fNote.value.trim() });
    toast("Versamento salvato ✓", "ok");
    s.close();
    rerender();
  })());
  fill(s.body, semaforoLine(kind),
    h("div.grid2", {}, h("label.field", {}, h("span", {}, "Data"), fData), h("label.field", {}, h("span", {}, "Importo €"), fImp)),
    h("label.check", {}, fPrel, " È un prelievo (soldi tolti dall'obiettivo)"),
    h("label.field", {}, h("span", {}, "Nota"), fNote), err, b);
  setTimeout(() => fImp.focus(), 300);
}

// ---------------------------------------------------------------- chiudi il mese (conto comune)
const prevMonth = () => { const [y, m] = ymOf(M.todayIso()); return m === 1 ? [y - 1, 12] : [y, m - 1]; };

/** Il riepilogo del mese finito: in evidenza nei primi giorni del mese nuovo, finché non lo chiudi. */
export function chiudiMeseCard(rerender) {
  const info = D.comuneInfo();
  if (!info || !D.feature("chiudi_mese_attivo", true)) return null;
  const [y, m] = prevMonth();
  const key = `cf.meseChiuso`;
  let seen = "";
  try { seen = localStorage.getItem(key) || ""; } catch { /* */ }
  if (seen === M.ymKey(y, m)) return null;
  const movs = D.years("comune").flatMap((yy) => D.comuneMovs(yy));
  const r = M.chiudiMese(movs, info.persona_a, info.persona_b, y, m);
  if (!r.n) return null;
  const close = () => { try { localStorage.setItem(key, M.ymKey(y, m)); } catch { /* */ } rerender(); };
  const now = r.saldo_ora;
  const bR = now.debitore ? h("button.btn.primary.wide", { type: "button" },
    `Registra il rimborso: ${now.debitore} dà ${M.fmtEur(now.importo)} a ${now.creditore}`) : null;
  if (bR) {
    bR.onclick = () => busy(bR, (async () => {
      await D.addMov("comune", M.rimborsoRow(now, M.todayIso(), `Chiusura di ${M.MESI[m - 1].toLowerCase()} ${y}`));
      toast("Rimborso registrato ✓", "ok");
      close();
    })());
  }
  return h("div.card.hl", { "data-keep": "" },
    h("div.card-title.row.between", {}, h("span", {}, `📅 ${M.MESI[m - 1]} ${y} è finito`),
      h("button.icon-btn", { type: "button", onclick: close, "aria-label": "Chiudi" }, "✕")),
    h("div", {}, `Spese comuni ${M.fmtEur(r.totale)} (${r.n} voci)`),
    [info.persona_a, info.persona_b].map((p) => h("div.small", {}, `${p}: ha pagato ${M.fmtEur(r.pagato[p])} · la sua parte ${M.fmtEur(r.quota[p])}`)),
    h("div", { style: { margin: "6px 0", color: now.debitore ? C.amber : C.green } },
      now.debitore ? `⚖️ Adesso ${now.debitore} deve ${M.fmtEur(now.importo)} a ${now.creditore}` : "✅ Siete in pari"),
    bR, semaforoLine("comune"));
}

// ---------------------------------------------------------------- patrimonio e previsione (Michele)
export function patrimonioCard() {
  if (!D.isMichele() || !D.feature("patrimonio_attivo")) return null;
  const rows = M.patrimonioStoria(D.lista("personal", "patrimonio"));
  if (!rows.length) return null;
  const last = rows[rows.length - 1];
  const shown = rows.slice(-12);
  const max = Math.max(...shown.map((r) => Number(r.totale || 0)), 1);
  return h("div.card", { "data-fold": "patrimonio" }, h("div.card-title", {}, "🏦 Patrimonio (investimenti)"),
    h("div.big-val", {}, M.fmtEur(last.totale)),
    h("div.small.muted", {}, `${M.MESI[Number(last.data.slice(5, 7)) - 1]} ${last.data.slice(0, 4)}`
      + (last.variazione != null ? ` · ${M.fmtEur(last.variazione, true)} sul mese prima` : "")),
    h("div.small", {}, `liquidità ${M.fmtEur(last.liquidita)} · BTP ${M.fmtEur(last.btp)} · buoni ${M.fmtEur(last.buoni)}`
      + ` · extra ${M.fmtEur(last.extra)}`),
    h("div.fx-list", {}, shown.slice().reverse().map((r) => h("div.pt-row", {},
      h("span.pt-m", {}, `${M.MESI_BREVI[Number(r.data.slice(5, 7)) - 1]} ${r.data.slice(2, 4)}`),
      h("div.pt-bar", {}, h("i", { style: { width: `${(Number(r.totale || 0) / max) * 100}%` } })),
      h("span.pt-v", {}, M.fmtEur(r.totale))))),
    h("div.muted.small", {}, "Solo gli investimenti, letti dal file Investimenti dal PC (un valore al mese)."));
}

export function previsioneCard() {
  if (!D.isMichele() || !D.feature("previsione_attiva")) return null;
  const y = new Date().getFullYear();
  const p = M.previsioneAnno(D.allMovsEveryYear(), y, D.fisse("personal"), D.scadenze());
  const bits = [`finora ${M.fmtEur(p.finora, true)}`, `nei ${p.mesi_stimati} mesi che mancano circa ${M.fmtEur(p.resto, true)}`,
    `media dell'anno ${M.fmtEur(p.media, true)} al mese`];
  if (p.fisse_mese) bits.push(`spese fisse ${M.fmtEur(p.fisse_mese)} al mese`);
  if (p.scadenze.length) bits.push("scadenze " + p.scadenze.map((s) => `${s.nome} ${M.fmtEur(s.importo)}`).join(", "));
  for (const [cat, tr] of Object.entries(p.tredicesime)) if (!tr.arrivata && tr.importo) bits.push(`${cat.toLowerCase()} prevista ${M.fmtEur(tr.importo)}`);
  const rows = M.patrimonioStoria(D.lista("personal", "patrimonio"));
  const last = rows.length && D.feature("patrimonio_attivo") ? Number(rows[rows.length - 1].totale || 0) : null;
  return h("div.card", { "data-fold": "previsione" }, h("div.card-title", {}, `🔮 Previsione di fine ${y}`),
    h("div.big-val", { style: { color: moneyColor(p.fine_anno) } }, M.fmtEur(p.fine_anno, true)),
    h("div.small.muted", {}, bits.join(" · ") + "."),
    last != null ? h("div.small", {}, `Patrimonio a fine anno se metti da parte quello che rimane: `, h("b", {}, M.fmtEur(last + p.resto))) : null);
}

// ---------------------------------------------------------------- Tania: tasse, soglia, sedute da incassare
const allTania = () => D.allMovsEveryYear();

export function tasseCard(y, rerender) {
  if (D.isMichele() || !D.feature("tasse_attivo")) return null;
  const t = M.tasseAnno(allTania(), y, D.indici, D.lista("personal", "tasse_scadenze"), D.lista("personal", "tasse_versate"),
    D.settingOf("tasse_metodo"), Number(D.settingOf("tasse_perc") || 0));
  return h("div.card", { "data-fold": "tasse" }, h("div.card-title", {}, `🧾 Tasse da mettere da parte · ${y}`),
    h("div.stats.two", {},
      h("div.stat", {}, h("div.stat-t", {}, "Da parte"), h("div.stat-v", {}, M.fmtEur(t.accantonato))),
      h("div.stat", {}, h("div.stat-t", {}, "Pagato"), h("div.stat-v", {}, M.fmtEur(t.pagato)),
        h("div.stat-s", {}, t.da_parte >= 0 ? `restano ${M.fmtEur(t.da_parte)}` : `${M.fmtEur(-t.da_parte)} oltre`))),
    t.scadenze.length ? h("div.fx-list", {}, t.scadenze.map((x) => h("div.fx-row", {},
      h("div.fx-name", {}, h("b", {}, x.scadenza.nome), h("div.small", { style: { color: x.fatto ? C.green : x.giorni < 0 ? C.red : C.amber } },
        `${M.fmtDate(x.data)} · previsto ${M.fmtEur(x.previsto)}` + (x.fatto ? ` · ✓ pagata` : x.giorni != null ? ` · ${M.whenText(x.giorni)}` : ""))),
      x.fatto ? null : h("button.btn.small-btn", { type: "button", onclick: () => tassaSheet(x, rerender) }, "Pagata"))))
      : h("div.muted.small", {}, "Le scadenze (saldo, acconti, ENPAP) si impostano dal PC."),
    t.scadenze.length ? h("div.small.muted", {}, `Scadenze dell'anno ${M.fmtEur(t.previsto)} · mancano ${M.fmtEur(t.mancante)}`) : null);
}

function tassaSheet(x, rerender) {
  const s = sheet(`Pagata · ${x.scadenza.nome}`);
  const fData = h("input", { type: "date", value: M.todayIso() });
  const fImp = amountInput();
  const rest = Math.max(0, x.previsto - x.pagato);
  if (rest) fImp.value = String(rest.toFixed(2)).replace(".", ",");
  const fNote = h("input", { type: "text", placeholder: "es. F24, MAV ENPAP" });
  const err = h("div.form-err");
  const b = h("button.btn.primary.wide", { type: "button" }, "Salva");
  b.onclick = () => busy(b, (async () => {
    const v = M.parseAmount(fImp.value);
    if (!v || v <= 0) { err.textContent = "Scrivi l'importo pagato."; return; }
    D.addItem("personal", "tasse_versate", { data: fData.value || M.todayIso(), voce: x.scadenza.id, nome: x.scadenza.nome,
      importo: v, note: fNote.value.trim() });
    toast("Pagamento salvato ✓", "ok");
    s.close();
    rerender();
  })());
  fill(s.body, semaforoLine("personal"),
    h("div.grid2", {}, h("label.field", {}, h("span", {}, "Data"), fData), h("label.field", {}, h("span", {}, "Importo €"), fImp)),
    h("label.field", {}, h("span", {}, "Nota"), fNote), err, b);
}

export function sogliaStatus(y = new Date().getFullYear()) {
  if (D.isMichele() || !D.feature("soglia_attiva")) return null;
  return M.soglia(allTania(), y, D.settingOf("soglia_categorie"), Number(D.settingOf("soglia_importo") || 0), D.settingOf("sedute_mese"));
}

export function sogliaCard(y) {
  const st = sogliaStatus(y);
  if (!st) return null;
  const col = st.step >= 100 || st.supera ? C.red : st.step >= 80 ? C.amber : C.green;
  return h("div.card", { "data-fold": "soglia" }, h("div.card-title.row.between", {}, h("span", {}, "📏 Soglia del forfettario"),
    h("b", { style: { color: col } }, `${st.pct.toFixed(0)}%`)),
  bar(st.ricavi, st.limite, col), h("div.small", { style: { color: st.supera ? C.red : "" } }, M.sogliaText(st)));
}

export function seduteCard(rerender) {
  if (D.isMichele() || !D.feature("sedute_attive")) return null;
  const items = M.daIncassare(allTania(), M.todayIso(), Number(D.settingOf("sedute_giorni") || 30));
  if (!items.length) return null;
  return h("div.card", { "data-keep": "" }, h("div.card-title", {}, `⏳ Sedute da incassare (${items.reduce((a, x) => a + x.sedute.length, 0)})`),
    h("div.fx-list", {}, items.map((x) => h("div.fx-row", {},
      h("div.fx-name", {}, h("b", {}, x.paziente), h("div.small", { style: { color: x.ritardo ? C.red : C.amber } },
        `${x.sedute.length} sedut${x.sedute.length === 1 ? "a" : "e"} · ${M.fmtEur(x.totale)} · la più vecchia di ${x.giorni} giorni fa`)),
      h("button.btn.primary.small-btn", { type: "button", onclick: () => pagateSheet(x, rerender) }, x.sedute.length === 1 ? "Pagata" : "Pagate")))));
}

function pagateSheet(x, rerender) {
  const s = sheet(`Sedute pagate · ${x.paziente}`);
  const checks = x.sedute.map((m) => ({ m, el: h("input", { type: "checkbox", checked: true }) }));
  const fData = h("input", { type: "date", value: M.todayIso() });
  const b = h("button.btn.primary.wide", { type: "button" }, "Segna pagate");
  b.onclick = () => busy(b, (async () => {
    const rows = checks.filter((c) => c.el.checked).map((c) => c.m);
    if (!rows.length) { toast("Scegli almeno una seduta.", "error"); return; }
    await D.paySedute(rows, fData.value || M.todayIso());
    toast(`${rows.length === 1 ? "Seduta segnata pagata" : rows.length + " sedute segnate pagate"} ✓`, "ok");
    s.close();
    rerender();
  })());
  fill(s.body, semaforoLine("personal"), h("div.muted.small", {}, "Quali sedute ti ha pagato?"),
    h("div.list", {}, checks.map(({ m, el }) => h("label.check", {}, el, ` ${M.fmtDate(m.data)} · ${M.fmtEur(m.importo)}`))),
    h("label.field", {}, h("span", {}, "Pagate il"), fData), b);
}

/** Avvisi all'apertura: soglia del forfettario (una volta per gradino) e sedute da incassare da tempo. */
export function noticesFunzioni() {
  const out = [];
  const st = sogliaStatus();
  if (st) {
    const lvl = st.step + (st.supera ? 1 : 0);
    let seen = 0;
    try { seen = Number(localStorage.getItem(`cf.soglia.${new Date().getFullYear()}`) || 0); } catch { /* */ }
    if (lvl > seen) {
      out.push(["📏 " + M.sogliaText(st), st.supera || st.step >= 100 ? "error" : "warn"]);
      try { localStorage.setItem(`cf.soglia.${new Date().getFullYear()}`, String(lvl)); } catch { /* */ }
    }
  }
  if (!D.isMichele() && D.feature("sedute_attive")) {
    const late = M.daIncassare(allTania(), M.todayIso(), Number(D.settingOf("sedute_giorni") || 30)).filter((x) => x.ritardo);
    if (late.length) out.push(["⏳ Sedute da incassare: " + late.slice(0, 3).map((x) => `${x.paziente} (${x.giorni} gg)`).join(", "), "warn"]);
  }
  return out;
}
