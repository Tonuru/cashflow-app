// Riquadri del mese condivisi da Michele, Tania e Comuni: spese fisse, budget del mese, scadenze.
import * as D from "../data.js";
import * as M from "../model.js";
import { h, C, toast, busy, fill } from "../ui.js";
import { movimentoSheet } from "../forms.js";

function amountInput(v) {
  return h("input.fx-amt", { type: "text", inputmode: "decimal", placeholder: "importo", autocomplete: "off",
    value: v != null && v !== "" ? String(v).replace(".", ",") : "" });
}

/** Spese fisse del mese: compilate ✓ e da compilare (anche vuote se quel mese non ci sono). */
export function fisseCard(kind, y, m, rerender) {
  const comune = kind === "comune";
  const info = comune ? D.comuneInfo() : null;
  const movs = comune ? D.years("comune").flatMap((yy) => D.comuneMovs(yy)) : D.allMovsEveryYear().filter((x) => x.origine !== M.ORIGINE_COMUNE);
  const rows = M.fisseMonth(D.fisse(kind), movs, y, m, comune, Number(info?.quota_a ?? 50), comune ? D.payerDefault() : "");
  if (!rows.length) return null;
  const done = rows.filter((r) => r.voce);
  const tot = rows.reduce((a, r) => a + r.voci.reduce((b, v) => b + Number(v.importo || 0), 0), 0);
  const list = h("div.fx-list", {}, rows.map((r) => fissaRow(r, comune, info, y, m, rerender)));
  return h("div.card", { "data-fold": comune ? "fisse-comuni" : "fisse" },
    h("div.card-title.row.between", {}, h("span", {}, "📌 Spese fisse"),
      h("span.fx-count", {}, `${done.length}/${rows.length} · ${M.fmtEur(tot)}`)),
    h("div.muted.small", {}, "Se una voce quel mese non c'è, lasciala vuota. Le voci si gestiscono dal PC."),
    list);
}

function fissaRow(r, comune, info, y, m, rerender) {
  const f = r.fissa, p = r.proposta;
  if (r.voce) {
    const v = r.voce;
    const sub = comune ? ` · ${v.pagato_da} · ${Number(v.quota_a || 0).toFixed(0)}/${Number(v.quota_b || 0).toFixed(0)}` : "";
    return h("div.fx-row.done" + (v._pending ? ".pending" : ""), {},
      h("div.fx-name", {}, h("b", {}, f.nome), h("div.small.muted", {}, `${M.fmtDate(v.data).slice(0, 5)}${sub}`)),
      h("div.fx-ok", {}, "✓ " + M.fmtEur(r.voci.reduce((a, x) => a + Number(x.importo || 0), 0))));
  }
  const amt = amountInput(p.importo);
  let payer = null, qa = null;
  const extra = [];
  if (comune) {
    payer = h("select.fx-sel", {}, [info.persona_a, info.persona_b].map((n) => h("option", { value: n }, n)));
    payer.value = p.pagato_da || info.persona_a;
    qa = h("select.fx-sel", {}, [...new Set([p.quota_a, 50, 60, 40, 70, 30, 100, 0])].map((q) =>
      h("option", { value: q }, `${q}/${100 - q}`)));
    qa.value = String(p.quota_a);
    extra.push(h("div.fx-extra", {}, h("span.small.muted", {}, "paga"), payer,
      h("span.small.muted", {}, `${info.persona_a}/${info.persona_b}`), qa));
  }
  const b = h("button.btn.primary.small-btn", { type: "button" }, "Inserisci");
  b.onclick = () => busy(b, (async () => {
    const v = M.parseAmount(amt.value);
    if (v == null || v <= 0) { amt.focus(); toast("Scrivi l'importo (es. 12,50).", "error"); return; }
    const row = comune ? M.fissaRow(f, y, m, v, true, payer.value, Number(qa.value)) : M.fissaRow(f, y, m, v);
    await D.addMov(comune ? "comune" : "personal", row);
    toast(`${f.nome} inserita ✓`, "ok");
    rerender();
  })(), "…");
  return h("div.fx-row", {},
    h("div.fx-name", {}, h("b", {}, f.nome), f.categoria ? h("div.small.muted", {}, f.categoria) : null),
    h("div.fx-in", {}, amt, b), ...extra);
}

/** Budget del mese (se attivo nelle Impostazioni del PC). */
export function budgetCard(y, m) {
  const b = D.budget();
  if (!b) return null;
  const st = M.budgetStatus(D.monthSpese(y, m), b);
  const col = st.step >= 100 ? C.red : st.step >= 70 ? C.amber : C.green;
  return h("div.card", { "data-keep": "" }, h("div.card-title.row.between", {}, h("span", {}, "🎯 Budget del mese"),
    h("b", { style: { color: col } }, `${st.pct.toFixed(0)}%`)),
  h("div.bbar", {}, h("i", { style: { width: `${Math.min(100, st.pct)}%`, background: col } })),
  h("div.small.muted", {}, `Speso ${M.fmtEur(st.spese)} su ${M.fmtEur(st.budget)} · `
    + (st.resto < 0 ? `${M.fmtEur(-st.resto)} oltre` : `restano ${M.fmtEur(st.resto)}`)));
}

/** Scadenze in arrivo, con «Inserisci la spesa» (se impostato sul PC) e «Fatto». */
export function scadenzeCard(rerender) {
  const items = M.scadenzeDue(D.scadenze());
  if (!items.length) return null;
  const propose = (D.personalInfo().scadenze_azione || "avviso") === "proposta";
  return h("div.card", { "data-keep": "" }, h("div.card-title", {}, `⏰ Scadenze (${items.length})`),
    h("div.fx-list", {}, items.map(([x, left]) => {
      const done = () => { D.doneScadenza(x); toast("Segnata ✓", "ok"); rerender(); };
      return h("div.fx-row", {},
        h("div.fx-name", {}, h("b", {}, x.nome), h("div.small", { style: { color: left < 0 ? C.red : C.amber } },
          `${M.fmtDate(x.data)} · ${M.whenText(left)}${x.importo ? " · " + M.fmtEur(x.importo) : ""}`)),
        h("div.fx-in", {},
          propose ? h("button.btn.primary.small-btn", { type: "button", onclick: () => movimentoSheet(
            { tipo: M.T.USCITA, data: x.data, importo: x.importo ?? "", categoria: x.categoria || "", descrizione: x.nome },
            { onDone: done }) }, "Inserisci") : null,
          h("button.btn.small-btn", { type: "button", onclick: done }, "Fatto")));
    })),
    h("div.small.muted", {}, "«Fatto» sposta la scadenza al periodo dopo."));
}

/** All'apertura: avviso del budget (a gradini) e delle scadenze. */
export function notices() {
  const out = [];
  const b = D.budget();
  if (b) {
    const t = new Date();
    const st = M.budgetStatus(D.monthSpese(t.getFullYear(), t.getMonth() + 1), b);
    const key = `${t.getFullYear()}-${t.getMonth() + 1}`;
    let seen = {};
    try { seen = JSON.parse(localStorage.getItem("cf.budgetSeen") || "{}"); } catch { /* */ }
    if (st.step > (seen[key] || 0)) {
      out.push([st.step >= 100 ? `🚨 Budget del mese superato: ${M.fmtEur(st.spese)} su ${M.fmtEur(st.budget)}`
        : `🎯 Hai usato il ${st.pct.toFixed(0)}% del budget del mese (restano ${M.fmtEur(st.resto)})`, st.step >= 100 ? "error" : "warn"]);
    }
    try { localStorage.setItem("cf.budgetSeen", JSON.stringify({ [key]: st.step })); } catch { /* */ }
  }
  const due = M.scadenzeDue(D.scadenze());
  if (due.length) out.push(["⏰ " + due.slice(0, 3).map(([x, l]) => `${x.nome}: ${M.whenText(l)}`).join(" · "), "warn"]);
  return out;
}

void fill;
