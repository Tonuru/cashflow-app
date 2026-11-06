// Investimenti (solo Michele): il file dell'app Investimenti, SOLO DA GUARDARE.
// Lo legge il PC (senza modificarlo) e lo mette nella copia per il telefono: il riepilogo (scadenze, conti, BTP e buoni, incassi), con i risultati delle
// formule così come sono salvati nel file. Da qui non si cambia niente: per modificare si usa l'app Investimenti sul PC.
import * as D from "../data.js";
import * as M from "../model.js";
import { h, C, fill, bars } from "../ui.js";
import { patrimonioCard } from "./funzioni.js";
import { view as meseView } from "./mese.js";
import { view as annoView, yearSeries } from "./anno.js";
import { yearsPicker } from "./parts.js";

const K_LINK = "cf.investLink";
export const view = { y: new Date().getFullYear() };

export const data = () => D.copia()?.investimenti || null;
export const available = () => D.isMichele() && !!data();

const nn = (n, one, many) => `${n} ${n === 1 ? one : many}`;
const eur0 = (v) => M.fmtEur(v).replace(/,\d\d €$/, " €");
const pct = (v) => (v == null ? "" : `${(v * 100).toFixed(2).replace(".", ",")}%`);
const dIso = (iso) => M.fmtDate(String(iso).slice(0, 10));
const when = (iso) => {
  const d = new Date(iso);
  if (isNaN(d)) return "";
  const p = (n) => String(n).padStart(2, "0");
  return `${p(d.getDate())}/${p(d.getMonth() + 1)}/${d.getFullYear()} alle ${p(d.getHours())}:${p(d.getMinutes())}`;
};
const daysTo = (iso) => Math.round((Date.parse(iso + "T00:00:00Z") - Date.parse(M.todayIso() + "T00:00:00Z")) / 864e5);
function quando(iso) {
  const n = daysTo(iso);
  if (n <= 0) return "oggi";
  if (n === 1) return "domani";
  if (n < 60) return `tra ${n} giorni`;
  const mesi = Math.round(n / 30.4);
  return mesi < 24 ? `tra ${mesi} mesi` : `tra ${(n / 365.25).toFixed(1).replace(".", ",")} anni`;
}
const sblocchi = (sc, giorni) => sc.filter((s) => daysTo(s.data) <= giorni).reduce((a, s) => a + (s.finale || s.importo || 0), 0);

/** Totale per la riga in «Dettagli». */
export function summary() {
  const d = data();
  const p = d?.pilastri || {};
  if (!d || d.errore) return { text: d?.errore ? "da controllare" : "", sub: d?.errore || "" };
  const tot = p.totale ?? ["liquidita", "btp", "buoni", "extra"].reduce((a, k) => a + (p[k] || 0), 0);
  const next = (d.scadenze || [])[0];
  return { text: eur0(tot), sub: next ? `prossima scadenza ${dIso(next.data).slice(0, 5)} · ${next.tipo}` : "solo da guardare" };
}

function tile(t, v, s, color) {
  return h("div.stat", {}, h("div.stat-t", {}, t), h("div.stat-v", { style: color ? { color } : {} }, v), s ? h("div.stat-s", {}, s) : null);
}

export function render(root, rerender, go) {
  const d = data();
  if (!d) {
    fill(root, h("div.card.center", { "data-keep": "" }, h("p.muted", {}, "Nessun dato degli investimenti. Sul PC controlla in "
      + "Impostazioni il «File Excel degli investimenti»: alla prossima sincronizzazione compare qui.")));
    return;
  }
  const head = h("div.card.iv-head", { "data-keep": "" },
    h("div.row.between", {}, h("b", {}, "🔒 Solo da guardare"), h("span.iv-file", {}, d.file || "")),
    h("div.small.muted", {}, d.modificato ? `File salvato il ${when(d.modificato)} · letto dal PC il ${when(d.letto)}.` : ""),
    h("div.small.muted", {}, "Per modificare usa l'app Investimenti sul PC (in Cashflow: Patrimonio → «Modifica in Investimenti»)."));
  if (d.errore) {
    fill(root, head, h("div.card", { "data-keep": "" }, h("p", { style: { color: C.amber } }, `⚠️ ${d.errore}`)));
    return;
  }
  const p = d.pilastri || {};
  const tot = p.totale ?? ["liquidita", "btp", "buoni", "extra"].reduce((a, k) => a + (p[k] || 0), 0);
  const big = h("div.card.iv-big", { "data-keep": "" },
    h("div.iv-tot-t", {}, "TOTALE"), h("div.iv-tot", {}, M.fmtEur(tot)),
    p.totale_no_extra != null ? h("div.small.muted", {}, `senza extra ${M.fmtEur(p.totale_no_extra)}`) : null,
    h("div.stats.iv-stats", {},
      tile("Liquidità", eur0(p.liquidita || 0), nn((d.conti || []).length, "conto", "conti")),
      tile("BTP", eur0(p.btp || 0), nn(d.btp?.n || 0, "titolo", "titoli")),
      tile("Buoni", eur0(p.buoni || 0), nn(d.buoni?.n || 0, "buono", "buoni")),
      tile("Extra", eur0(p.extra || 0), "")));

  // prossime scadenze
  const sc = d.scadenze || [];
  const scad = h("div.card", { "data-fold": "iv-scad" }, h("div.card-title", {}, "⏳ Prossime scadenze"),
    sc.length ? [
      h("div.iv-sum", {}, "Nei prossimi 3 mesi si sbloccano ", h("b", { style: { color: C.green } }, eur0(sblocchi(sc, 92))),
        ", entro un anno ", h("b", {}, eur0(sblocchi(sc, 366))), "."),
      h("div.iv-list", {}, sc.slice(0, 8).map((s) => h("div.iv-row", {},
        h("div.iv-l", {}, h("b", {}, `${s.tipo} · ${s.nome}`), h("div.small.muted", {}, `${dIso(s.data)} · ${quando(s.data)}`)),
        h("div.iv-r", {}, h("b", { style: { color: C.green } }, eur0(s.finale || s.importo)),
          h("div.small.muted", {}, `investiti ${eur0(s.importo)}`))))),
      sc.length > 8 ? h("div.small.muted.center", {}, `… e altre ${sc.length - 8} (tutte nell'app Investimenti sul PC)`) : null]
      : h("div.empty", {}, "Nessun buono o BTP in scadenza."));

  // conti correnti
  const cs = d.conti || [];
  const ci = d.conti_info || {};
  const intAnno = cs.reduce((a, c) => a + (c.interesse_anno || 0), 0);
  const conti = h("div.card", { "data-fold": "iv-conti" }, h("div.card-title", {}, "🏦 Conti correnti"),
    h("div.iv-list", {}, cs.map((c) => h("div.iv-row", {},
      h("div.iv-l", {}, h("b", {}, c.banca), h("div.small.muted", {}, c.netto != null ? `interesse netto ${pct(c.netto)}` : "")),
      h("div.iv-r", {}, h("b", {}, eur0(c.saldo)),
        h("div.small", { style: { color: (c.interesse_anno || 0) >= 0 ? C.green : C.red } },
          `${(c.interesse_anno || 0) >= 0 ? "+" : "−"}${eur0(Math.abs(c.interesse_anno || 0))} in un anno`))))),
    h("div.iv-sum", {}, "Interessi in un anno, tutti i conti: ", h("b", { style: { color: intAnno >= 0 ? C.green : C.red } }, eur0(intAnno)),
      ci.soglia != null ? [h("br"), `Soglia ${eur0(ci.soglia)}: `, ci.mancanti > 0
        ? h("b", { style: { color: C.amber } }, `mancano ${eur0(ci.mancanti)}`) : h("b", { style: { color: C.green } }, "raggiunta ✅")] : null));

  // BTP e buoni
  const b = d.btp || {}, bu = d.buoni || {};
  const tit = h("div.card", { "data-fold": "iv-tit" }, h("div.card-title", {}, "📜 BTP e buoni postali"),
    b.n ? h("div.iv-box", {}, h("b", {}, `BTP (${b.n})`,
      b.scaduti ? h("span.small.muted", {}, ` · ${nn(b.scaduti, "già scaduto", "già scaduti")} non contat${b.scaduti === 1 ? "o" : "i"}`) : ""),
      h("div.iv-kv", {}, h("span", {}, "Investiti"), h("b", {}, eur0(b.spesa))),
      h("div.iv-kv", {}, h("span", {}, "Valore di mercato"), h("b", {}, eur0(b.mercato))),
      h("div.iv-kv", {}, h("span", {}, "A scadenza"), h("b", {}, eur0(b.finale))),
      h("div.iv-kv", {}, h("span", {}, "Guadagno netto"), h("b", { style: { color: C.green } }, "+" + eur0(b.guadagno_netto)))) : null,
    bu.n ? h("div.iv-box", {}, h("b", {}, `Buoni postali (${bu.n})`,
      bu.scaduti ? h("span.small.muted", {}, ` · ${nn(bu.scaduti, "già scaduto", "già scaduti")} non contat${bu.scaduti === 1 ? "o" : "i"}`) : ""),
      h("div.iv-kv", {}, h("span", {}, "Investiti"), h("b", {}, eur0(bu.importo))),
      h("div.iv-kv", {}, h("span", {}, "A scadenza, netti"), h("b", {}, eur0(bu.finale_netto))),
      h("div.iv-kv", {}, h("span", {}, "Guadagno netto"), h("b", { style: { color: C.green } }, "+" + eur0(bu.guadagno_netto)))) : null,
    !b.n && !bu.n ? h("div.empty", {}, "Nessun BTP o buono nel file.") : null);

  // incassi
  const inc = d.incassi || {};
  const incassi = inc.anno ? h("div.card", { "data-fold": "iv-inc" }, h("div.card-title", {}, `💶 Incassi ${inc.anno}`),
    h("div.stats", {}, tile("Nell'anno", eur0(inc.totale_anno), "", C.green), tile("Questo mese", eur0(inc.totale_mese), ""),
      tile("Media al mese", eur0(inc.media_mese), "")),
    (inc.per_banca || []).length ? h("div.iv-sum", {}, (inc.per_banca || []).slice(0, 5).map(([bk, v], i) =>
      [i ? " · " : "", `${bk} `, h("b", {}, eur0(v))])) : null,
    (inc.ultimi || []).length ? h("div.iv-list", {}, inc.ultimi.map((x) => h("div.iv-row", {},
      h("div.iv-l", {}, h("b", {}, x.info || x.banca), h("div.small.muted", {}, `${dIso(x.data)} · ${x.banca}`)),
      h("div.iv-r", {}, h("b", { style: { color: x.importo >= 0 ? C.green : C.red } },
        (x.importo >= 0 ? "+" : "−") + M.fmtEur(Math.abs(x.importo))))))) : null) : null;

  // come sul PC: incassi degli investimenti mese per mese dell'anno scelto e, sotto, «Anno per anno» (che sceglie l'anno)
  const y = view.y;
  const movs = D.allMovs(y);
  const vals = Array.from({ length: 12 }, (_, i) => M.monthTotals(movs, y, i + 1).per_tipo[M.T.INVESTIMENTO] || 0);
  const incTot = vals.reduce((a, v) => a + v, 0);
  const today = new Date();
  const nm = y === today.getFullYear() ? today.getMonth() + 1 : y < today.getFullYear() ? 12 : 0;
  const best = vals.some(Boolean) ? vals.indexOf(Math.max(...vals)) : -1;
  const openMonth = (i) => { meseView.y = y; meseView.m = i + 1; go?.("mese"); };
  const mesi = h("div.card", { "data-keep": "", id: "iv-mesi" },
    h("div.card-title", {}, `💶 Incassi mese per mese · ${y}`),
    h("div.row.between", {}, h("div.big-val", { style: { color: incTot >= 0 ? C.green : C.red } }, M.fmtEur(incTot, true)),
      h("div.small.muted", { style: { textAlign: "right" } }, nm ? `media ${M.fmtEur(incTot / nm, true)} al mese` : "",
        best >= 0 && vals[best] > 0 ? h("div", {}, `migliore: ${M.MESI[best].toLowerCase()} ${M.fmtEur(vals[best], true)}`) : null)),
    bars(vals.map((v, i) => ({ label: M.MESI_BREVI[i][0], a: v, b: 0 })), { net: true, sel: y === today.getFullYear() ? today.getMonth() : -1,
      onPick: openMonth, height: 150 }),
    h("div.legend", {}, h("i", { style: { color: C.green } }, "■ "), "incassi", h("i", { style: { color: C.red } }, "  ■ "),
      "bolli e costi — tocca un mese per aprirlo"));
  const anni = yearsPicker(yearSeries(meseView.mode), y, (yy) => { view.y = yy; rerender(); },
    { net: annoView.netY, onNet: (v) => { annoView.netY = v; rerender(); },
      onOpen: (yy) => { annoView.y = yy; annoView.ysel = yy; annoView.tab = "mesi"; go?.("anno"); } });
  if (anni) anni.dataset.keep = "";

  // lo storico del patrimonio mese per mese sta qui (prima era in Panoramica), come sul PC
  const storia = patrimonioCard();
  if (storia) storia.dataset.keep = "";
  // (niente più «Il file, foglio per foglio», come sul PC)
  fill(root, head, big, mesi, anni, storia, scad, incassi, conti, tit, linkCard(rerender));
}


/** Facoltativo: il link del file su OneDrive, per aprirlo nell'app Excel (lì però si potrebbe anche modificare). */
function linkCard(rerender) {
  let link = "";
  try { link = localStorage.getItem(K_LINK) || ""; } catch { /* niente memoria: si mostra solo il campo */ }
  if (link) {
    return h("div.card", { "data-fold": "iv-link" }, h("div.card-title", {}, "📗 Il file vero, aggiornato"),
      h("div.small.muted", {}, "Si apre nell'app Excel o OneDrive del telefono. Attenzione: lì il file si può anche "
        + "modificare, quindi non toccare niente mentre l'app Investimenti è aperta sul PC."),
      h("div.row.gap", {}, h("a.btn.primary", { href: link, target: "_blank", rel: "noopener" }, "Apri in Excel"),
        h("button.btn", { onclick: () => { try { localStorage.removeItem(K_LINK); } catch { /* */ } rerender(); } }, "Togli il link")));
  }
  const inp = h("input", { type: "url", placeholder: "https://1drv.ms/…", autocomplete: "off" });
  return h("div.card", { "data-fold": "iv-link" }, h("div.card-title", {}, "📗 Il file vero, aggiornato (facoltativo)"),
    h("div.small.muted", {}, "Se vuoi aprire anche il file vivo: nell'app OneDrive tieni premuto il file → «Copia collegamento» "
      + "(lascia il collegamento solo a te, non a «chiunque») e incollalo qui. Resta solo su questo telefono."),
    inp, h("button.btn.wide", { onclick: () => {
      const v = inp.value.trim();
      if (!/^https:\/\//.test(v)) { inp.focus(); return; }
      try { localStorage.setItem(K_LINK, v); } catch { /* */ }
      rerender();
    } }, "Salva il link"));
}
