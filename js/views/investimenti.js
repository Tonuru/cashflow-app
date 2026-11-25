// Patrimonio (solo Michele) stile «B · Quattro pilastri», come sul PC: il file dell'app Investimenti, SOLO DA GUARDARE.
// Lo legge il PC (senza modificarlo) e lo mette nella copia per il telefono: il riepilogo (scadenze, conti, BTP e buoni, incassi), con i risultati delle
// formule così come sono salvati nel file. Da qui non si cambia niente: per modificare si usa l'app Investimenti sul PC.
import * as D from "../data.js";
import * as M from "../model.js";
import { h, C, fill, bars } from "../ui.js";
import { patrimonioCard } from "./funzioni.js";
import { view as meseView } from "./mese.js";

const K_LINK = "cf.investLink";
export const view = { y: new Date().getFullYear(), extra: false };     // extra: pulsante «Extra», spento a ogni apertura

export const data = () => D.copia()?.investimenti || null;
export const available = () => D.isMichele() && !!data();

const eur0 = (v) => M.fmtEur(v).replace(/,\d\d €$/, " €");
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

// i quattro pilastri dell'app Investimenti: chiave, nome e colore (gli stessi del PC, ui/pilastri.py)
const PILASTRI = [["liquidita", "1° Liquidità", "#0ea5e9"], ["fondo", "2° Fondo di emergenza", "#f59e0b"],
  ["spese", "3° Spese previste", "#94a3b8"], ["lungo", "4° Lungo periodo", "#8b5cf6"]];
const SOTTO = [["btp", "BTP"], ["buoni", "Buoni"], ["extra", "Extra"], ["azionario", "Azionario"]];
const MAX_RIGHE = 5;

/** I pilastri della copia, nella forma del PC 2.26.3: pilastri e totale SENZA gli Extra, gli Extra a parte e
 *  «totale_extra» con loro (copie di PC più vecchi portate alla stessa forma). Con il pulsante «Extra» acceso gli
 *  Extra entrano nel 4° e nel totale. */
function pilastriDi(d, conExtra) {
  const p = { ...(d.pilastri || {}) };
  if (p.extra_tot != null) {                       // copia del PC 2.26.2
    if (p.includi_extra) { p.lungo -= p.extra_tot; p.totale -= p.extra_tot; }
    p.extra = p.extra_tot;
  }
  if (p.lungo == null) p.lungo = (p.btp || 0) + (p.buoni || 0) + (p.azionario || 0);
  if (p.totale_extra == null) p.totale_extra = (p.totale || 0) + (p.extra || 0);
  p.totale_no_extra = p.totale;
  if (conExtra && p.extra) { p.lungo += p.extra; p.totale = p.totale_extra; }
  return p;
}

/** Righe [nome, importo] e nota di un pilastro, dai dati del file Investimenti: come dettagli() sul PC. */
function dettaglio(k, d, p, conExtra) {
  const voci = (d.voci || {})[k] || [];
  if (k === "liquidita") {
    const cs = d.conti || [], ci = d.conti_info || {};
    const ia = cs.reduce((a, c) => a + (c.interesse_anno || 0), 0);
    const nota = [cs.length ? ["Interessi dei conti in un anno: ", h("b", { style: { color: ia >= 0 ? C.green : C.red } }, M.fmtEur(ia, true))] : null,
      ci.soglia != null ? [h("br"), `Soglia ${eur0(ci.soglia)}: `, ci.mancanti > 0
        ? h("b", { style: { color: C.amber } }, `mancano ${eur0(ci.mancanti)}`) : "raggiunta ✅"] : null];
    return [voci.map((x) => [x.nome, x.valore]), cs.length || ci.soglia != null ? nota : null];
  }
  if (k === "fondo") {
    const ci = d.conti_info || {};
    return [voci.map((x) => [x.nome, x.valore]), ci.soglia_fondo != null ? [`Soglia ${eur0(ci.soglia_fondo)}: `, ci.mancanti_fondo > 0
      ? h("b", { style: { color: C.amber } }, `mancano ${eur0(ci.mancanti_fondo)}`) : "raggiunta ✅"] : null];
  }
  if (k === "spese") return [voci.map((x) => [x.nome, x.valore]), null];
  return [SOTTO.filter(([kk]) => p[kk] && (kk !== "extra" || conExtra)).map(([kk, n]) => [n, p[kk]]),
    !p.extra ? null : conExtra ? ["Senza gli Extra il totale è ", h("b", {}, M.fmtEur(p.totale_no_extra))]
      : ["Extra ", h("b", {}, M.fmtEur(p.extra)), " nascosti: «＋ Mostra Extra» in alto li aggiunge qui e nel totale (",
        h("b", {}, M.fmtEur(p.totale_extra)), ")"]];
}

const ICONE = { liquidita: "💶", fondo: "🛡️", spese: "📅", lungo: "📈" };

/** Un pilastro come i riquadri delle entrate sul PC (stile «A · come Il mio mese»): bordo colorato a sinistra,
 *  icona e nome, la sua parte del totale, la cifra nel colore del pilastro e il dettaglio. */
function pilastro(k, n, col, v, tot, d, p, conExtra) {
  const [righe, nota] = dettaglio(k, d, p, conExtra);
  const perc = tot > 0 ? Math.round(v / tot * 100) : 0;
  return h("div.card.pil", { id: `pil-${k}`, style: { borderLeftColor: col, "--c": col } },
    h("div.pil-h", {}, h("i.pil-ic", {}, ICONE[k] || "•"), h("b.pil-n", {}, n), h("span.pil-pct", {}, `${perc}%`)),
    h("div.pil-v", { style: { color: col } }, M.fmtEur(v)),
    h("div.pil-bar", {}, h("i", { style: { width: `${perc}%`, background: col } })),
    !righe.length ? h("div.small.muted", {}, "Nessuna voce in questo pilastro") : null,
    righe.slice(0, MAX_RIGHE).map(([nome, imp]) => h("div.pil-row", {}, h("span", {}, nome), h("b", {}, M.fmtEur(imp)))),
    righe.length > MAX_RIGHE ? h("div.small.muted", {}, `e altri ${righe.length - MAX_RIGHE}`) : null,
    nota ? h("div.pil-note", {}, nota) : null);
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
  // stile «B · Quattro pilastri» con l'aspetto «A · come Il mio mese», come sul PC: banner colorato con il totale e
  // la barra dei pilastri, poi un riquadro per pilastro
  const p = pilastriDi(d, view.extra);
  const tot = p.totale ?? PILASTRI.reduce((a, [k]) => a + (p[k] || 0), 0);
  const inc0 = d.incassi || {};
  const chip = (t, v) => h("div.mh-chip", {}, h("div", {}, t), h("b", {}, v));
  const big = h("div.mhero.iv-big", { "data-keep": "" },
    h("div.mh-t", {}, "INVESTIMENTI OGGI"), h("div.mh-v.iv-tot", {}, M.fmtEur(tot)),
    h("div.iv-sub", {}, view.extra ? "con gli Extra" : "senza gli Extra"),
    h("div.pil-stack", {}, PILASTRI.map(([k, , col]) => h("i", { style: { width: `${tot > 0 ? (p[k] || 0) / tot * 100 : 0}%`, background: col } }))),
    h("div.pil-leg", {}, PILASTRI.map(([, n, col]) => h("span", {}, h("i", { style: { background: col } }), n))),
    p.extra ? h("button.btn.pil-extra" + (view.extra ? ".on" : ""), { type: "button",
      onclick: () => { view.extra = !view.extra; rerender(); } }, view.extra ? "－ Nascondi Extra" : "＋ Mostra Extra") : null,
    inc0.anno ? h("div.mh-chips.iv-chips", {}, chip(`Incassi ${inc0.anno}`, M.fmtEur(inc0.totale_anno, true)),
      chip("Media al mese", M.fmtEur(inc0.media_mese, true)), chip("Extra", M.fmtEur(p.extra || 0))) : null);
  const pil = h("div.pil-grid", { "data-keep": "" }, PILASTRI.map(([k, n, col]) => pilastro(k, n, col, p[k] || 0, tot, d, p, view.extra)));

  // prossime scadenze
  const sc = d.scadenze || [];
  const scad = h("div.card", { "data-fold": "iv-scad" }, h("div.card-title", {}, "⏳ Prossime scadenze"),
    sc.length ? [
      h("div.iv-sum", {}, "Nei prossimi 3 mesi si sbloccano ", h("b", { style: { color: C.green } }, eur0(sblocchi(sc, 92))),
        ", entro un anno ", h("b", {}, eur0(sblocchi(sc, 366))), ".",
        d.btp?.n ? [h("br"), `BTP: a scadenza ${eur0(d.btp.finale)}, guadagno netto `,
          h("b", { style: { color: C.green } }, "+" + eur0(d.btp.guadagno_netto))] : null,
        d.buoni?.n ? [h("br"), `Buoni: a scadenza netti ${eur0(d.buoni.finale_netto)}, guadagno netto `,
          h("b", { style: { color: C.green } }, "+" + eur0(d.buoni.guadagno_netto))] : null),
      h("div.iv-list", {}, sc.slice(0, 8).map((s) => h("div.iv-row", {},
        h("span.pil-pill" + (daysTo(s.data) <= 30 ? ".near" : s.tipo === "BTP" ? ".btp" : ".buono"), {}, quando(s.data)),
        h("div.iv-l", { style: { flex: 1 } }, h("b", {}, `${s.tipo} · ${s.nome}`), h("div.small.muted", {}, dIso(s.data))),
        h("div.iv-r", {}, h("b", { style: { color: C.green } }, eur0(s.finale || s.importo)),
          h("div.small.muted", {}, `investiti ${eur0(s.importo)}`))))),
      sc.length > 8 ? h("div.small.muted.center", {}, `… e altre ${sc.length - 8} (tutte nell'app Investimenti sul PC)`) : null]
      : h("div.empty", {}, "Nessun buono o BTP in scadenza."));

  // tutti gli strumenti di adesso (conti, buoni, BTP), divisi per tipo, come sul PC
  const TIPI = [["Conto corrente", "Conti correnti"], ["Buono postale", "Buoni postali"], ["BTP", "BTP e obbligazioni"]];
  const st = d.strumenti || [];
  const strumenti = st.length ? h("div.card", { id: "iv-stru", "data-fold": "iv-stru" }, h("div.card-title", {}, "🧾 I miei strumenti"),
    TIPI.map(([t, nome]) => {
      const xs = st.filter((x) => x.tipo === t).sort((a, b) => b.valore - a.valore);
      if (!xs.length) return null;
      return [h("div.stru-h", {}, h("span", {}, `${nome} · ${xs.length}`), h("b", {}, eur0(xs.reduce((a, x) => a + x.valore, 0)))),
        h("div.iv-list", {}, xs.map((x) => h("div.iv-row", {},
          h("div.iv-l", {}, h("b", {}, x.nome), h("div.small.muted", {}, x.pilastro + (x.scadenza ? ` · scade ${dIso(x.scadenza)}` : ""))),
          h("div.iv-r", {}, h("b", {}, M.fmtEur(x.valore)),
            x.rende ? h("div.small", { style: { color: x.rende >= 0 ? C.green : C.red } },
              `${M.fmtEur(x.rende, true)} ${t === "Conto corrente" ? "l'anno" : "a scadenza"}`) : null))))];
    })) : null;

  // incassi
  const inc = d.incassi || {};
  const incassi = inc.anno ? h("div.card", { "data-fold": "iv-inc" }, h("div.card-title", {}, `💶 Elenco degli incassi ${inc.anno}`),
    h("div.stats", {}, tile("Nell'anno", eur0(inc.totale_anno), "", C.green), tile("Questo mese", eur0(inc.totale_mese), ""),
      tile("Media al mese", eur0(inc.media_mese), "")),
    (inc.per_banca || []).length ? h("div.iv-sum", {}, (inc.per_banca || []).slice(0, 5).map(([bk, v], i) =>
      [i ? " · " : "", `${bk} `, h("b", {}, eur0(v))])) : null,
    (inc.ultimi || []).length ? h("div.iv-list", {}, inc.ultimi.slice(0, 4).map((x) => h("div.iv-row", {},
      h("div.iv-l", {}, h("b", {}, x.info || x.banca), h("div.small.muted", {}, `${dIso(x.data)} · ${x.banca}`)),
      h("div.iv-r", {}, h("b", { style: { color: x.importo >= 0 ? C.green : C.red } },
        (x.importo >= 0 ? "+" : "−") + M.fmtEur(Math.abs(x.importo))))))) : null) : null;

  // come sul PC: incassi degli investimenti mese per mese, l'anno con le frecce ‹ › («Anno per anno» tolto: i numeri
  // dell'anno stanno in Panoramica, sotto «Mese per mese»)
  const y = view.y;
  const movs = D.allMovs(y);
  const vals = Array.from({ length: 12 }, (_, i) => M.monthTotals(movs, y, i + 1).per_tipo[M.T.INVESTIMENTO] || 0);
  const incTot = vals.reduce((a, v) => a + v, 0);
  const today = new Date();
  const nm = y === today.getFullYear() ? today.getMonth() + 1 : y < today.getFullYear() ? 12 : 0;
  const best = vals.some(Boolean) ? vals.indexOf(Math.max(...vals)) : -1;
  const openMonth = (i) => { meseView.y = y; meseView.m = i + 1; go?.("mese"); };
  const mesi = h("div.card", { "data-keep": "", id: "iv-mesi" },
    h("div.card-title.row.between", {}, h("span", {}, `💶 Incassi mese per mese · ${y}`),
      h("span.iv-yr", {}, h("button.btn", { type: "button", id: "iv-prev", onclick: () => { view.y = y - 1; rerender(); } }, "‹"),
        h("button.btn", { type: "button", id: "iv-next", disabled: y >= today.getFullYear(),
          onclick: () => { view.y = y + 1; rerender(); } }, "›"))),
    h("div.row.between", {}, h("div.big-val", { style: { color: incTot >= 0 ? C.green : C.red } }, M.fmtEur(incTot, true)),
      h("div.small.muted", { style: { textAlign: "right" } }, nm ? `media ${M.fmtEur(incTot / nm, true)} al mese` : "",
        best >= 0 && vals[best] > 0 ? h("div", {}, `migliore: ${M.MESI[best].toLowerCase()} ${M.fmtEur(vals[best], true)}`) : null)),
    bars(vals.map((v, i) => ({ label: M.MESI_BREVI[i][0], a: v, b: 0 })), { net: true, sel: y === today.getFullYear() ? today.getMonth() : -1,
      onPick: openMonth, height: 150 }),
    h("div.legend", {}, h("i", { style: { color: C.green } }, "■ "), "incassi", h("i", { style: { color: C.red } }, "  ■ "),
      "bolli e costi — tocca un mese per aprirlo"));

  // lo storico del patrimonio mese per mese sta qui (prima era in Panoramica), come sul PC
  const storia = patrimonioCard(view.extra);
  if (storia) storia.dataset.keep = "";
  // (niente più «Il file, foglio per foglio», come sul PC)
  if (strumenti) strumenti.dataset.keep = "";
  fill(root, big, pil, strumenti, mesi, scad, head, incassi, storia, linkCard(rerender));
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
