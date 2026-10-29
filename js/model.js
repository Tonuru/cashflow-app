// Calcoli e formati: porting fedele di cashflow/core (calc.py, util.py). I dati arrivano già letti dal PC.
// Le date sono stringhe "AAAA-MM-GG", le date con ora "AAAA-MM-GGTHH:MM:SS".

export const T = {
  USCITA: "Uscita", ENTRATA: "Entrata", STIPENDIO: "Stipendio", INVESTIMENTO: "Investimento",
  SPESA: "Spesa", RIMBORSO: "Rimborso",
};
export const TIPI_ENTRATA = [T.STIPENDIO, T.ENTRATA, T.INVESTIMENTO];
export const ORIGINE_ANNUALE = "Annuale";
export const ORIGINE_INVESTIMENTI = "Investimenti";
export const ORIGINE_COMUNE = "Comune";
export const CAT_EXTRA_ANNO = "Extra dell'anno";
export const CAT_SPESE_COMUNI = "Spese comuni";
export const EXTRA_STIPENDIO = ["Tredicesima", "Quattordicesima"];
export const MESI = ["Gennaio", "Febbraio", "Marzo", "Aprile", "Maggio", "Giugno", "Luglio", "Agosto",
  "Settembre", "Ottobre", "Novembre", "Dicembre"];
export const MESI_BREVI = ["Gen", "Feb", "Mar", "Apr", "Mag", "Giu", "Lug", "Ago", "Set", "Ott", "Nov", "Dic"];

export const DEFAULT_METODI = ["Carta di debito", "Carta di credito", "Contanti", "Bonifico", "Satispay", "PayPal",
  "Addebito diretto"];

// ------------------------------------------------------------------ util.py
export const pyRound2 = (x) => Number(Number(x).toFixed(2));
const pad = (n, w = 2) => String(n).padStart(w, "0");
export const isoDate = (d) => `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}`;
const EPOCH = Date.UTC(1899, 11, 30);

export function serialToIso(v, withTime = false) {
  const ms = EPOCH + Math.round(Number(v) * 86400000);
  const d = new Date(ms);
  if (isNaN(d)) return null;
  if (!withTime) return isoDate(d);
  return `${isoDate(d)}T${pad(d.getUTCHours())}:${pad(d.getUTCMinutes())}:${pad(d.getUTCSeconds())}`;
}
export function isoToSerial(iso) {
  const [d, t] = String(iso).split("T");
  const [y, m, dd] = d.split("-").map(Number);
  let ms = Date.UTC(y, m - 1, dd);
  if (t) { const [h, mi, s] = t.split(":").map(Number); ms += ((h * 60 + mi) * 60 + (s || 0)) * 1000; }
  return (ms - EPOCH) / 86400000;
}

function validYmd(y, m, d) {
  const dt = new Date(Date.UTC(y, m - 1, d));
  return dt.getUTCFullYear() === y && dt.getUTCMonth() === m - 1 && dt.getUTCDate() === d ? isoDate(dt) : null;
}

export function parseDate(v) {
  if (v == null || v === "" || typeof v === "boolean") return null;
  if (typeof v === "number") return serialToIso(Math.floor(v));
  const s = String(v).trim();
  let m;
  if ((m = s.match(/^(\d{1,2})[/.-](\d{1,2})[/.-](\d{4})$/))) return validYmd(+m[3], +m[2], +m[1]);
  if ((m = s.match(/^(\d{4})-(\d{1,2})-(\d{1,2})(?:[ T]\d{1,2}:\d{2}(?::\d{2})?)?$/))) return validYmd(+m[1], +m[2], +m[3]);
  if ((m = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{2})$/))) {
    const yy = +m[3];
    return validYmd(yy < 69 ? 2000 + yy : 1900 + yy, +m[2], +m[1]);
  }
  return null;
}

export function parseDatetime(v) {
  if (v == null || v === "" || typeof v === "boolean") return null;
  if (typeof v === "number") return serialToIso(v, true);
  const s = String(v).trim();
  let m;
  if ((m = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4}) (\d{1,2}):(\d{2})(?::(\d{2}))?$/))) {
    const d = validYmd(+m[3], +m[2], +m[1]);
    return d ? `${d}T${pad(+m[4])}:${m[5]}:${pad(+(m[6] || 0))}` : null;
  }
  if ((m = s.match(/^(\d{4})-(\d{2})-(\d{2})[ T](\d{2}):(\d{2}):(\d{2})$/))) {
    const d = validYmd(+m[1], +m[2], +m[3]);
    return d ? `${d}T${m[4]}:${m[5]}:${m[6]}` : null;
  }
  const d = parseDate(s);
  return d ? `${d}T00:00:00` : null;
}

export function parseAmount(v) {
  if (v == null || v === "" || typeof v === "boolean") return null;
  if (typeof v === "number") return isFinite(v) ? pyRound2(v) : null;
  let s = String(v).trim().replace(/€/g, "").replace(/[  ]/g, "");
  if (!s) return null;
  if (s.includes(",")) s = s.replace(/\./g, "").replace(",", ".");
  if (!/^[-+]?\d+(\.\d+)?$/.test(s)) return null;
  return pyRound2(parseFloat(s));
}

export const clean = (v) => (v == null ? "" : String(v).trim());

export function fmtEur(x, sign = false) {
  if (x == null) return "";
  const v = pyRound2(x);
  const [i, d] = Math.abs(v).toFixed(2).split(".");
  let s = i.replace(/\B(?=(\d{3})+(?!\d))/g, ".") + "," + d;
  if (v < 0) s = "-" + s;
  else if (sign && v > 0) s = "+" + s;
  return s + " €";
}
export function fmtDate(iso) {
  if (!iso) return "";
  const [d, t] = iso.split("T");
  const [y, m, dd] = d.split("-");
  return `${dd}/${m}/${y}` + (t ? " " + t.slice(0, 5) : "");
}
export function nowIso() {
  const d = new Date();
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
}
export const todayIso = () => nowIso().slice(0, 10);
export function newId() {
  const b = new Uint8Array(5);
  crypto.getRandomValues(b);
  return Array.from(b, (x) => x.toString(16).padStart(2, "0")).join("");
}
export function splitSubs(v) {
  const out = [];
  for (let x of String(v ?? "").replace(/,/g, ";").split(";")) {
    x = x.trim();
    if (x && !out.some((o) => o.toLowerCase() === x.toLowerCase())) out.push(x);
  }
  return out;
}

// ------------------------------------------------------------------ calc.py
const ym = (iso) => (iso ? [Number(iso.slice(0, 4)), Number(iso.slice(5, 7))] : [0, 0]);
export const inMonth = (iso, y, m) => { const [a, b] = ym(iso); return a === y && b === m; };
export const inYear = (iso, y) => !!iso && Number(iso.slice(0, 4)) === y;
export const isAnnual = (m) => m.origine === ORIGINE_ANNUALE;
export const isEntrata = (m) => TIPI_ENTRATA.includes(m.tipo || T.USCITA);

export function monthTotals(movs, y, mo) {
  let ent = 0, usc = 0, n = 0;
  const uscCat = {}, entCat = {}, perTipo = {};
  for (const m of movs) {
    if (!inMonth(m.data, y, mo) || isAnnual(m)) continue;
    n++;
    const v = Number(m.importo || 0);
    const cat = m.categoria || "Senza categoria";
    const tipo = m.tipo || T.USCITA;
    perTipo[tipo] = (perTipo[tipo] || 0) + v;
    if (TIPI_ENTRATA.includes(tipo)) { ent += v; entCat[cat] = (entCat[cat] || 0) + v; }
    else { usc += v; uscCat[cat] = (uscCat[cat] || 0) + v; }
  }
  for (const k in perTipo) perTipo[k] = pyRound2(perTipo[k]);
  return { entrate: pyRound2(ent), uscite: pyRound2(usc), saldo: pyRound2(ent - usc), uscite_cat: uscCat,
    entrate_cat: entCat, n, per_tipo: perTipo };
}

export function rimanenti(t) {
  const pt = t.per_tipo;
  const st = pt[T.STIPENDIO] || 0, inv = pt[T.INVESTIMENTO] || 0, ex = pt[T.ENTRATA] || 0, usc = t.uscite;
  return { totale: pyRound2(st + inv + ex - usc), senza_extra: pyRound2(st + inv - usc), solo_stipendio: pyRound2(st - usc) };
}

export function categoryPivot(movs, y, mo = null, tipo = T.USCITA) {
  const cats = new Map();
  for (const m of movs) {
    if ((m.tipo || T.USCITA) !== tipo || !inYear(m.data, y)) continue;
    if (mo && ym(m.data)[1] !== mo) continue;
    const c = m.categoria || "Senza categoria";
    if (!cats.has(c)) cats.set(c, new Map());
    const subs = cats.get(c);
    const s = m.sottocategoria || "";
    subs.set(s, (subs.get(s) || 0) + Number(m.importo || 0));
  }
  const out = [];
  for (const [c, subs] of cats) {
    const items = [...subs].map(([s, v]) => [s, pyRound2(v)]).sort((a, b) => b[1] - a[1]);
    out.push([c, pyRound2([...subs.values()].reduce((a, b) => a + b, 0)), items]);
  }
  return out.sort((a, b) => b[1] - a[1]);
}

export function annual(movs, y) {
  const out = { tredicesima: 0, quattordicesima: 0, extra: 0, extra_voci: [], righe: {} };
  for (const m of movs) {
    if (!isAnnual(m) || !inYear(m.data, y)) continue;
    const v = Number(m.importo || 0);
    const cat = m.categoria || "";
    if (m.tipo === T.STIPENDIO && EXTRA_STIPENDIO.includes(cat)) {
      const k = cat === "Tredicesima" ? "tredicesima" : "quattordicesima";
      out[k] += v;
      out.righe[k] = m;
    } else { out.extra += v; out.extra_voci.push(m); }
  }
  out.stipendio = pyRound2(out.tredicesima + out.quattordicesima);
  out.extra = pyRound2(out.extra);
  return out;
}

export function medieAnno(movs, y) {
  let n = 0;
  const rest = { solo_stipendio: 0, senza_extra: 0, totale: 0 };
  const cols = { stipendio: 0, spese: 0, investimenti: 0, extra: 0 };
  const mesi = [];
  let extraStip = 0;
  for (let mo = 1; mo <= 12; mo++) {
    const t = monthTotals(movs, y, mo);
    const extra = movs.filter((m) => m.tipo === T.STIPENDIO && EXTRA_STIPENDIO.includes(m.categoria)
      && inMonth(m.data, y, mo) && !isAnnual(m)).reduce((a, m) => a + Number(m.importo || 0), 0);
    extraStip += extra;
    const stip = (t.per_tipo[T.STIPENDIO] || 0) - extra;
    if (stip <= 0) continue;
    n++;
    mesi.push(mo);
    const r = rimanenti(t);
    for (const k in rest) rest[k] += r[k] - extra;
    cols.stipendio += stip; cols.spese += t.uscite;
    cols.investimenti += t.per_tipo[T.INVESTIMENTO] || 0; cols.extra += t.per_tipo[T.ENTRATA] || 0;
  }
  const an = annual(movs, y);
  extraStip += an.tredicesima + an.quattordicesima;
  const out = { mesi_validi: n, mesi, tredicesima_quattordicesima: pyRound2(extraStip),
    colonne: Object.fromEntries(Object.entries(cols).map(([k, v]) => [k, n ? pyRound2(v / n) : 0])) };
  for (const k in rest) {
    const media = n ? rest[k] / n : 0;
    out[k] = pyRound2(media);
    out[k + "_con_13_14"] = pyRound2(media + extraStip / 12);
  }
  return out;
}

export function subcategories(categorie, movs, tipo, categoria) {
  const out = [], seen = new Set();
  const cat = categorie.find((c) => (c.tipo || tipo) === tipo && c.categoria === categoria);
  for (const s of cat?.sottocategorie || []) if (!seen.has(s.toLowerCase())) { seen.add(s.toLowerCase()); out.push(s); }
  const used = new Map();
  for (const m of movs) {
    if ((m.tipo || T.USCITA) === tipo && m.categoria === categoria && m.sottocategoria) {
      used.set(m.sottocategoria, (used.get(m.sottocategoria) || 0) + 1);
    }
  }
  for (const [s] of [...used].sort((a, b) => b[1] - a[1])) {
    if (!seen.has(s.toLowerCase())) { seen.add(s.toLowerCase()); out.push(s); }
  }
  return out;
}

export function colors(categorie) {
  const out = {};
  for (const c of categorie) out[c.categoria] = c.colore || "#9AA3AE";
  if (!(CAT_SPESE_COMUNI in out)) out[CAT_SPESE_COMUNI] = "#C77DFF";
  if (!(CAT_PRESTITI in out)) out[CAT_PRESTITI] = "#E8A0FF";
  return out;
}

export function comuneSaldo(movs, pa, pb) {
  const pagato = { [pa]: 0, [pb]: 0 }, quota = { [pa]: 0, [pb]: 0 }, rimb = { [pa]: 0, [pb]: 0 };
  for (const m of movs) {
    const v = Number(m.importo || 0);
    const who = m.pagato_da;
    if (m.tipo === T.RIMBORSO) { if (who in rimb) rimb[who] += v; continue; }
    if (who in pagato) pagato[who] += v;
    quota[pa] += (v * Number(m.quota_a || 0)) / 100;
    quota[pb] += (v * Number(m.quota_b || 0)) / 100;
  }
  const sa = pagato[pa] - quota[pa] + rimb[pa] - rimb[pb];
  const sb = pagato[pb] - quota[pb] + rimb[pb] - rimb[pa];
  let debitore = null, creditore = null, importo = 0;
  if (Math.abs(sa) >= 0.005) {
    if (sa > 0) [debitore, creditore, importo] = [pb, pa, sa];
    else [debitore, creditore, importo] = [pa, pb, -sa];
  }
  return { pagato, quota, rimborsi: rimb, saldo: { [pa]: pyRound2(sa), [pb]: pyRound2(sb) }, debitore, creditore,
    importo: pyRound2(importo) };
}

export function comuneQuotaMonth(movs, key, y, mo) {
  let tot = 0;
  for (const m of movs) {
    if (m.tipo !== T.SPESA || !inMonth(m.data, y, mo)) continue;
    tot += (Number(m.importo || 0) * Number(m[key] || 0)) / 100;
  }
  return pyRound2(tot);
}

export function myQuotaKey(comuneInfo, utente) {
  if (!comuneInfo) return null;
  if (utente === comuneInfo.persona_a) return "quota_a";
  if (utente === comuneInfo.persona_b) return "quota_b";
  return null;
}

/** La mia quota di ogni spesa comune come spesa personale "virtuale" (come state.comune_quota_rows). */
export const T_PRESTITO = "Prestito";
export const CAT_PRESTITI = "Prestiti restituiti";

/** Spese comuni (e prestiti) nelle spese del mese di `me` — stessa logica di calc.comune_personal_rows:
 *  chi paga la spesa vede subito la sua quota; l'altro la vede quando l'ha ripagata (rimborso o compensazione);
 *  il prestito conta solo per chi lo riceve, quando lo restituisce; i debiti si coprono dal più vecchio. */
export function comunePersonalRows(movs, me, pa, pb) {
  if (me !== pa && me !== pb) return [];
  const other = { [pa]: pb, [pb]: pa };
  const debts = { [pa]: [], [pb]: [] };
  const out = [];
  const eur = (v) => `${v.toFixed(2)} €`.replace(".", ",");
  const emit = (person, it, when) => {
    if (person !== me || it.neutral) return;
    const src = it.src;
    const prest = src.tipo === T_PRESTITO;
    const imp = Number(src.importo || 0);
    let note;
    if (prest) note = `prestito di ${eur(imp)} da ${src.pagato_da}, restituito`;
    else {
      const q = Number(src[me === pa ? "quota_a" : "quota_b"] || 0);
      note = `quota ${q.toFixed(0)}% di ${eur(imp)} · pagato da ${src.pagato_da || "?"}`;
      if (when !== src.data) note += ` il ${fmtDate(src.data)}, ripagata`;
    }
    out.push({ id: `com:${src.id}`, data: when, tipo: T.USCITA, importo: pyRound2(it.amount),
      categoria: prest ? CAT_PRESTITI : CAT_SPESE_COMUNI, sottocategoria: src.categoria || "",
      descrizione: src.descrizione || "", metodo: "", note, origine: ORIGINE_COMUNE,
      etichetta: src.etichetta || "", allegato: src.allegato || "", comune_sub: src.sottocategoria || "" });
  };
  const pay = (person, amount, when) => {
    for (const it of debts[person]) {
      if (amount <= 0.004) break;
      if (it.rest <= 0.004) continue;
      const c = Math.min(it.rest, amount);
      it.rest -= c;
      amount -= c;
      if (it.rest <= 0.004) emit(person, it, when);
    }
    debts[person] = debts[person].filter((it) => it.rest > 0.004);
    if (amount > 0.004) debts[other[person]].push({ src: {}, amount, rest: amount, neutral: true });
  };
  const open = (p) => debts[p].reduce((a, it) => a + it.rest, 0);
  const evs = movs.filter((m) => m.data && Number(m.importo || 0) > 0)
    .sort((a, b) => (a.data + (a.inserito || "") + String(a.id || "")).localeCompare(b.data + (b.inserito || "") + String(b.id || "")));
  for (const m of evs) {
    const imp = Number(m.importo || 0), payer = m.pagato_da;
    if (payer !== pa && payer !== pb) continue;
    if (m.tipo === T.RIMBORSO) pay(payer, imp, m.data);
    else if (m.tipo === T_PRESTITO) debts[other[payer]].push({ src: m, amount: imp, rest: imp });
    else {
      for (const [person, key] of [[pa, "quota_a"], [pb, "quota_b"]]) {
        const q = pyRound2((imp * Number(m[key] || 0)) / 100);
        if (q <= 0) continue;
        const it = { src: m, amount: q, rest: q };
        if (person === payer) emit(person, it, m.data); else debts[person].push(it);
      }
    }
    const o = Math.min(open(pa), open(pb));
    if (o > 0.004) { pay(pa, o, m.data); pay(pb, o, m.data); }
  }
  return out;
}

export function filterMovs(movs, { year, month, tipo, categoria, sotto, text, withAnnual = false } = {}) {
  const q = (text || "").trim().toLowerCase();
  const out = movs.filter((m) => {
    if (isAnnual(m) && !withAnnual) return false;
    if (year && !inYear(m.data, year)) return false;
    if (month && ym(m.data)[1] !== month) return false;
    if (tipo && (m.tipo || T.USCITA) !== tipo) return false;
    if (categoria != null && (m.categoria || "Senza categoria") !== categoria) return false;
    if (sotto != null && (m.sottocategoria || "") !== sotto) return false;
    if (q) {
      const hay = ["descrizione", "categoria", "sottocategoria", "note", "metodo", "pagato_da"]
        .map((k) => m[k] || "").join(" ").toLowerCase();
      if (!hay.includes(q)) return false;
    }
    return true;
  });
  return out.sort((a, b) => ((b.data || "") + (b.inserito || "")).localeCompare((a.data || "") + (a.inserito || "")));
}

export function suggestions(movs, field, categoria = null, limit = 30) {
  const count = new Map();
  for (const m of movs) {
    if (categoria && m.categoria !== categoria) continue;
    const v = (m[field] || "").trim();
    if (v) count.set(v, (count.get(v) || 0) + 1);
  }
  return [...count].sort((a, b) => b[1] - a[1]).slice(0, limit).map(([k]) => k);
}

export function pctText(rimane, entrate) {
  if (!entrate || entrate <= 0) return "";
  return `${((rimane / entrate) * 100).toFixed(0)}% rimane`;
}

/** Righe della tabella dell'anno (Panoramica). inc13/incex: entrate dell'anno incluse nei totali. */
export function yearTable(movs, y, inc13 = true, incex = true, today = todayIso()) {
  const [ty, tm] = ym(today);
  const months = [];
  const prog = [0, 0, 0];
  const tot = { st: 0, sp: 0, r1: 0, iv: 0, r2: 0, ex: 0, r3: 0 };
  for (let i = 0; i < 12; i++) {
    const x = monthTotals(movs, y, i + 1);
    const pt = x.per_tipo, r = rimanenti(x);
    const v = { st: pt[T.STIPENDIO] || 0, sp: x.uscite, r1: r.solo_stipendio, iv: pt[T.INVESTIMENTO] || 0,
      r2: r.senza_extra, ex: pt[T.ENTRATA] || 0, r3: r.totale };
    const has = x.n > 0;
    const past = y < ty || (y === ty && i + 1 <= tm);
    if (has) { prog[0] += v.r1; prog[1] += v.r2; prog[2] += v.r3; }
    Object.assign(v, { p1: prog[0], p2: prog[1], p3: prog[2], has, past, mese: i + 1 });
    for (const k in tot) tot[k] += v[k];
    months.push(v);
  }
  const an = annual(movs, y);
  const aSt = inc13 ? an.stipendio : 0, aEx = incex ? an.extra : 0;
  const ann = { st: aSt, sp: 0, r1: aSt, p1: prog[0] + aSt, iv: 0, r2: aSt, p2: prog[1] + aSt, ex: aEx,
    r3: aSt + aEx, p3: prog[2] + aSt + aEx, has: !!(aSt || aEx) };
  for (const k of ["st", "r1", "r2", "ex", "r3"]) tot[k] += ann[k];
  return { months, annual: ann, totale: tot, an };
}

// ---------------------------------------------------------------- versione Tania (libera professione)
// Stessi calcoli di cashflow/core/calc.py (professione, stipendio_professione, tania_month, pazienti).
export const CAT_PROFESSIONE = "Libera professione";
export const CAT_SPESE_PROF = "Spese professionali";
export const CAT_EDUCATIVA = "Educativa";
export const INDICI = [
  ["coef", "Coefficiente di redditività", 0.78],
  ["sogg", "Contributo soggettivo ENPAP", 0.10],
  ["integr", "Contributo integrativo ENPAP", 0.02],
  ["aliq", "Aliquota imposta", 0.05],
];
export const INDICI_DEFAULT = Object.fromEntries(INDICI.map(([k, , v]) => [k, v]));
export const isProfIncome = (m) => (m.tipo || T.USCITA) === T.ENTRATA && m.categoria === CAT_PROFESSIONE;
export const isProfCost = (m) => (m.tipo || T.USCITA) === T.USCITA && m.categoria === CAT_SPESE_PROF;
const prevMonth = (y, m) => (m === 1 ? [y - 1, 12] : [y, m - 1]);

/** Data in cui conta una seduta (vedi calc.prof_date): pagata dopo → il giorno del pagamento, se si conta così. */
export function profDate(m, mode) {
  const inc = m.incasso;
  if (!inc || mode === "seduta") return m.data;
  if (inc === "no") return null;
  return /^\d{4}-\d{2}-\d{2}/.test(inc) ? inc.slice(0, 10) : m.data;
}
export const isUnpaid = (m) => isProfIncome(m) && m.incasso === "no";

export function professione(movs, y, mo, indici) {
  const ind = { ...INDICI_DEFAULT, ...(indici || {}) };
  const mode = ind.sedute_mese;
  let inc = 0, spese = 0, sedute = 0;
  for (const m of movs) {
    if (isAnnual(m)) continue;
    if (isProfIncome(m)) {
      if (inMonth(profDate(m, mode), y, mo)) { inc += Number(m.importo || 0); sedute += 1; }
      continue;
    }
    if (!inMonth(m.data, y, mo)) continue;
    if (isProfCost(m)) spese += Number(m.importo || 0);
  }
  const sogg = inc * ind.coef * ind.sogg, integr = inc * ind.integr, imposta = inc * ind.coef * ind.aliq;
  const tasse = sogg + integr + imposta;
  return { incasso: pyRound2(inc), sedute, soggettivo: pyRound2(sogg), integrativo: pyRound2(integr),
    imposta: pyRound2(imposta), tasse: pyRound2(tasse), netto_tasse: pyRound2(inc - tasse),
    spese_prof: pyRound2(spese), netto: pyRound2(inc - tasse - spese) };
}

export function stipendioProfessione(movs, y, mo, indiciFor) {
  const [py, pm] = prevMonth(y, mo);
  return Math.max(0, professione(movs, py, pm, indiciFor(py)).netto);
}

export function taniaMonth(movs, y, mo, indiciFor) {
  const prof = professione(movs, y, mo, indiciFor(y));
  let edu = 0, altri = 0, spese = 0;
  const speseCat = {};
  for (const m of movs) {
    if (!inMonth(m.data, y, mo) || isAnnual(m)) continue;
    const tipo = m.tipo || T.USCITA, v = Number(m.importo || 0);
    if (tipo === T.STIPENDIO) edu += v;
    else if (tipo === T.ENTRATA && !isProfIncome(m)) altri += v;
    else if (tipo === T.USCITA && !isProfCost(m)) {
      spese += v;
      const c = m.categoria || "Senza categoria";
      speseCat[c] = (speseCat[c] || 0) + v;
    }
  }
  const stip = stipendioProfessione(movs, y, mo, indiciFor);
  const tot = edu + stip + altri;
  return { prof, educativa: pyRound2(edu), stip_prof: pyRound2(stip), altri: pyRound2(altri), entrate: pyRound2(tot),
    spese: pyRound2(spese), rimane: pyRound2(tot - spese), spese_cat: speseCat };
}

export const personalSpese = (movs) => movs.filter((m) => !isProfCost(m));

/** Sedute del mese per paziente: [[paziente, sedute, totale]], in ordine alfabetico. */
export function pazienti(movs, y, mo) {
  const by = new Map();
  for (const m of movs) {
    if (!isProfIncome(m) || !inMonth(m.data, y, mo) || isAnnual(m)) continue;
    const p = m.sottocategoria || "Senza nome";
    if (!by.has(p)) by.set(p, []);
    by.get(p).push(m);
  }
  return [...by.entries()].map(([p, rows]) => {
    rows.sort((a, b) => (a.data + (a.inserito || "")).localeCompare(b.data + (b.inserito || "")));
    return [p, rows, pyRound2(rows.reduce((a, r) => a + Number(r.importo || 0), 0))];
  }).sort((a, b) => a[0].toLowerCase().localeCompare(b[0].toLowerCase()));
}

// ---------------------------------------------------------------- spese fisse, scadenze, budget
// Stessi calcoli di cashflow/core/fisse.py e scadenze.py.
export const RIPETI_MESI = { "Una volta": 0, "Ogni mese": 1, "Ogni 2 mesi": 2, "Ogni 3 mesi": 3, "Ogni 6 mesi": 6, "Ogni anno": 12 };

function lastOf(movs, fid) {
  let best = null;
  for (const m of movs) {
    if (m.fissa !== fid || !m.data) continue;
    if (!best || (m.data + (m.inserito || "")) > (best.data + (best.inserito || ""))) best = m;
  }
  return best;
}

export function fissaProposal(f, movs, comune = false, quotaDef = 50, payerDef = "") {
  const last = lastOf(movs, f.id);
  const out = { importo: last ? last.importo : f.importo ?? null };
  if (comune) {
    out.pagato_da = (last && last.pagato_da) || f.pagato_da || payerDef;
    let qa = last ? last.quota_a : null;
    if (qa == null || qa === "") qa = f.quota_a;
    out.quota_a = Number(qa == null || qa === "" ? quotaDef : qa);
  }
  return out;
}

export function fisseMonth(fisse, movs, y, mo, comune = false, quotaDef = 50, payerDef = "") {
  const out = [];
  for (const f of fisse || []) {
    const here = movs.filter((x) => x.fissa === f.id && inMonth(x.data, y, mo));
    if (f.attiva === false && !here.length) continue;
    out.push({ fissa: f, voce: here[0] || null, voci: here, proposta: fissaProposal(f, movs, comune, quotaDef, payerDef) });
  }
  return out;
}

const lastDay = (y, mo) => new Date(Date.UTC(y, mo, 0)).getUTCDate();
export function fissaDate(f, y, mo, today = todayIso()) {
  if (f.giorno) return `${y}-${pad(mo)}-${pad(Math.min(Number(f.giorno), lastDay(y, mo)))}`;
  if (today.slice(0, 7) === `${y}-${pad(mo)}`) return today;
  return `${y}-${pad(mo)}-01`;
}

export function fissaRow(f, y, mo, importo, comune = false, pagatoDa = "", quotaA = 50) {
  const data = fissaDate(f, y, mo);
  if (comune) {
    return { data, tipo: T.SPESA, importo: Math.abs(importo), categoria: f.categoria || "", descrizione: f.nome || "",
      pagato_da: pagatoDa, quota_a: Number(quotaA), quota_b: pyRound2(100 - Number(quotaA)), note: "", fissa: f.id };
  }
  return { data, tipo: f.tipo || T.USCITA, importo: Math.abs(importo), categoria: f.categoria || "",
    sottocategoria: f.sottocategoria || "", descrizione: f.nome || "", metodo: f.metodo || "", note: "", fissa: f.id };
}

export function addMonthsIso(iso, n) {
  const [y, m, d] = iso.split("-").map(Number);
  const t = m - 1 + n;
  const yy = y + Math.floor(t / 12), mm = (t % 12) + 1;
  return `${yy}-${pad(mm)}-${pad(Math.min(d, lastDay(yy, mm)))}`;
}

/** Scadenze da ricordare adesso: [[scadenza, giorni che mancano]] (negativo = già passata). */
export function scadenzeDue(scadenze, today = todayIso()) {
  const t0 = Date.parse(today + "T00:00:00Z");
  const out = [];
  for (const x of scadenze || []) {
    if (x.attiva === false || !x.data) continue;
    const left = Math.round((Date.parse(x.data + "T00:00:00Z") - t0) / 864e5);
    if (left <= Number(x.anticipo || 0)) out.push([x, left]);
  }
  return out.sort((a, b) => a[1] - b[1]);
}
export function whenText(left) {
  if (left < 0) return `scaduta da ${-left} giorn${left === -1 ? "o" : "i"}`;
  if (left === 0) return "scade oggi";
  if (left === 1) return "scade domani";
  return `fra ${left} giorni`;
}

export const BUDGET_STEPS = [70, 80, 90, 100];
export function budgetStatus(spese, budget) {
  if (!budget || budget <= 0) return null;
  const pct = (spese / budget) * 100;
  const step = Math.max(0, ...BUDGET_STEPS.filter((s) => pct >= s));
  return { pct, step, resto: pyRound2(budget - spese), budget, spese: pyRound2(spese) };
}


// ---------------------------------------------------------------- obiettivi di risparmio (core/obiettivi.py)
const ymN = (iso) => Number(iso.slice(0, 4)) * 12 + Number(iso.slice(5, 7)) - 1;
const fromYmN = (n) => [Math.floor(n / 12), (n % 12) + 1];
export const ymKey = (y, m) => `${y}-${pad(m)}`;
export const OBIETTIVO_MODI = { manuale: "Versamenti a mano", percentuale: "% di quello che rimane ogni mese",
  fisso: "Cifra fissa ogni mese" };

/** rimane: {"AAAA-MM": quanto è rimasto quel mese} (serve solo al modo «percentuale»). */
export function obiettivoStato(o, versamenti, rimane = {}, today = todayIso()) {
  const modo = o.modo || "manuale", val = Number(o.valore || 0);
  const cur = ymN(today);
  const start = Math.min(o.dal ? ymN(o.dal) : cur, cur);
  const vers = (versamenti || []).filter((v) => v.obiettivo === o.id);
  const versTot = vers.reduce((a, v) => a + Number(v.importo || 0), 0);
  let auto = 0;
  const autoMesi = [];
  if (modo === "fisso" && val) {
    for (let n = start; n <= cur; n++) { auto += val; autoMesi.push(val); }
  } else if (modo === "percentuale" && val) {
    for (let n = start; n < cur; n++) {
      const [y, m] = fromYmN(n);
      const v = pyRound2(Math.max(0, Number(rimane[ymKey(y, m)] || 0)) * val / 100);
      auto += v;
      autoMesi.push(v);
    }
  }
  const saved = pyRound2(Number(o.iniziale || 0) + versTot + auto);
  const target = Number(o.obiettivo || 0);
  const rest = target ? pyRound2(Math.max(0, target - saved)) : 0;
  const pct = target > 0 ? Math.min(100, saved / target * 100) : 0;
  let mesiLeft = null, alMese = null;
  if (o.entro) {
    mesiLeft = Math.max(0, ymN(o.entro) - cur + (modo === "fisso" ? 0 : 1));
    alMese = mesiLeft ? pyRound2(rest / mesiLeft) : rest;
  }
  const elapsed = cur - start + 1;
  const manualRate = elapsed > 0 ? versTot / elapsed : 0;
  let rate = modo === "fisso" ? val + manualRate
    : modo === "percentuale" ? (autoMesi.length ? autoMesi.reduce((a, b) => a + b, 0) / autoMesi.length : 0) + manualRate
      : manualRate;
  rate = pyRound2(rate);
  let previsione = null, inTempo = null;
  if (target && rest <= 0) { previsione = today.slice(0, 8) + "01"; inTempo = true; }
  else if (target && rate > 0) {
    const n = Math.ceil(rest / rate - 1e-9);
    const [y, m] = fromYmN(cur + n);
    previsione = `${y}-${pad(m)}-01`;
    inTempo = !o.entro || ymN(previsione) <= ymN(o.entro);
  } else if (target && o.entro) inTempo = false;
  return { risparmiato: saved, versato: pyRound2(versTot), automatico: pyRound2(auto), obiettivo: target, manca: rest,
    pct: Math.round(pct * 10) / 10, mesi_rimasti: mesiLeft, al_mese: alMese, ritmo: rate, previsione,
    in_tempo: inTempo, raggiunto: !!target && rest <= 0, versamenti: vers };
}
export function previsioneText(st) {
  if (st.raggiunto) return "Obiettivo raggiunto! 🎉";
  if (!st.previsione) return "Ancora nessun ritmo per una previsione.";
  const [y, m] = ym(st.previsione);
  return `Al ritmo attuale ci arrivi a ${MESI[m - 1].toLowerCase()} ${y}${st.in_tempo === false ? " (dopo la data che hai scelto)" : ""}.`;
}

// ---------------------------------------------------------------- chiudi il mese (calc.chiudi_mese)
export function chiudiMese(movs, pa, pb, y, mo) {
  const spese = movs.filter((m) => m.tipo === T.SPESA && inMonth(m.data, y, mo));
  const pagato = { [pa]: 0, [pb]: 0 }, quota = { [pa]: 0, [pb]: 0 }, cats = {};
  let tot = 0;
  for (const m of spese) {
    const v = Number(m.importo || 0);
    tot += v;
    if (m.pagato_da in pagato) pagato[m.pagato_da] += v;
    quota[pa] += v * Number(m.quota_a || 0) / 100;
    quota[pb] += v * Number(m.quota_b || 0) / 100;
    const c = m.categoria || "Senza categoria";
    cats[c] = (cats[c] || 0) + v;
  }
  const end = mo === 12 ? `${y + 1}-01-01` : `${y}-${pad(mo + 1)}-01`;
  const r2 = (o) => Object.fromEntries(Object.entries(o).map(([k, v]) => [k, pyRound2(v)]));
  return { anno: y, mese: mo, totale: pyRound2(tot), n: spese.length, pagato: r2(pagato), quota: r2(quota),
    categorie: Object.entries(cats).map(([c, v]) => [c, pyRound2(v)]).sort((a, b) => b[1] - a[1]),
    saldo_fine_mese: comuneSaldo(movs.filter((m) => m.data && m.data < end), pa, pb), saldo_ora: comuneSaldo(movs, pa, pb) };
}
export function rimborsoRow(saldo, today = todayIso(), descrizione = "") {
  if (!saldo?.debitore) return null;
  return { data: today, tipo: T.RIMBORSO, importo: pyRound2(saldo.importo), categoria: "",
    descrizione: descrizione || "Pareggio dei conti", pagato_da: saldo.debitore, quota_a: "", quota_b: "", note: "" };
}

// ---------------------------------------------------------------- previsione di fine anno (calc.previsione_anno)
function scadOccurrences(scadenze, y) {
  const out = [];
  for (const x of scadenze || []) {
    if (x.attiva === false || !x.data || !x.importo) continue;
    let d = x.data, guard = 0;
    while (d && Number(d.slice(0, 4)) <= y && guard < 400) {
      if (Number(d.slice(0, 4)) === y) out.push([d, x]);
      const n = RIPETI_MESI[x.ripeti || ""] ?? 12;
      d = n ? addMonthsIso(d, n) : null;
      guard++;
    }
  }
  return out;
}
export function previsioneAnno(movs, y, fisse = [], scadenze = [], today = todayIso()) {
  const [ty, tm] = ym(today);
  const cm = ty === y ? tm : (y < ty ? 13 : 1);
  const fx = (fisse || []).filter((f) => f.attiva !== false && (f.tipo || T.USCITA) === T.USCITA);
  const ids = new Set(fx.map((f) => f.id));
  const extraStip = (yy, mo) => movs.filter((m) => m.tipo === T.STIPENDIO && EXTRA_STIPENDIO.includes(m.categoria)
    && inMonth(m.data, yy, mo) && !isAnnual(m)).reduce((a, m) => a + Number(m.importo || 0), 0);
  const extraCat = (yy, cat) => {
    const an = annual(movs, yy);
    return an[cat === "Tredicesima" ? "tredicesima" : "quattordicesima"] + movs.filter((m) => m.tipo === T.STIPENDIO
      && m.categoria === cat && !isAnnual(m) && inYear(m.data, yy)).reduce((a, m) => a + Number(m.importo || 0), 0);
  };
  const mesi = [], vari = [];
  for (let mo = 1; mo <= 12; mo++) {
    const t = monthTotals(movs, y, mo);
    const r = rimanenti(t).totale;
    const ex = extraStip(y, mo);
    const stip = (t.per_tipo[T.STIPENDIO] || 0) - ex;
    if (mo < cm || (mo === cm && stip > 0)) {
      mesi.push({ mese: mo, valore: pyRound2(r), stimato: false });
      if (stip > 0) {
        const f = movs.filter((m) => ids.has(m.fissa) && (m.tipo || T.USCITA) === T.USCITA && inMonth(m.data, y, mo))
          .reduce((a, m) => a + Number(m.importo || 0), 0);
        vari.push(r - ex + f);
      }
    } else mesi.push({ mese: mo, valore: 0, stimato: true });
  }
  const media = vari.length ? vari.reduce((a, b) => a + b, 0) / vari.length : 0;
  const fisseMese = fx.reduce((a, f) => a + Number(fissaProposal(f, movs).importo || 0), 0);
  const occ = scadOccurrences(scadenze, y);
  const tredi = {};
  for (const [cat, mo] of [["Tredicesima", 12], ["Quattordicesima", 7]]) {
    const got = extraCat(y, cat);
    tredi[cat] = { arrivata: got > 0, importo: pyRound2(got > 0 ? got : extraCat(y - 1, cat)), mese: mo };
  }
  const scadList = [];
  for (const x of mesi) {
    if (!x.stimato) continue;
    const sc = occ.filter(([d]) => Number(d.slice(5, 7)) === x.mese);
    const scTot = sc.reduce((a, [, s]) => a + Number(s.importo || 0), 0);
    sc.forEach(([d, s]) => scadList.push({ data: d, nome: s.nome, importo: Number(s.importo || 0) }));
    let v = media - fisseMese - scTot;
    for (const tr of Object.values(tredi)) if (tr.mese === x.mese && !tr.arrivata) v += tr.importo;
    x.valore = pyRound2(v);
  }
  const an = annual(movs, y);
  const annuali = pyRound2(an.stipendio + an.extra);
  const finora = pyRound2(mesi.filter((x) => !x.stimato).reduce((a, x) => a + x.valore, 0) + annuali);
  const resto = pyRound2(mesi.filter((x) => x.stimato).reduce((a, x) => a + x.valore, 0));
  return { anno: y, mesi, media: pyRound2(media), mesi_media: vari.length, fisse_mese: pyRound2(fisseMese),
    scadenze: scadList, tredicesime: tredi, annuali, finora, resto, fine_anno: pyRound2(finora + resto),
    mesi_stimati: mesi.filter((x) => x.stimato).length };
}

// ---------------------------------------------------------------- patrimonio (core/patrimonio.py)
export function patrimonioStoria(rows) {
  const out = [];
  let prev = null;
  for (const r of (rows || []).filter((r) => r.data).sort((a, b) => (a.data < b.data ? -1 : 1))) {
    out.push({ ...r, variazione: prev ? pyRound2(Number(r.totale || 0) - Number(prev.totale || 0)) : null });
    prev = r;
  }
  return out;
}

// ---------------------------------------------------------------- Tania (core/professione.py)
export function accantonato(movs, y, indiciFor, metodo = "indici", perc = 25) {
  const mesi = [];
  for (let mo = 1; mo <= 12; mo++) {
    const p = professione(movs, y, mo, indiciFor(y));
    const v = metodo !== "percentuale" ? p.tasse : pyRound2(p.incasso * Number(perc || 0) / 100);
    mesi.push({ mese: mo, incasso: p.incasso, accantonato: pyRound2(v) });
  }
  return { mesi, totale: pyRound2(mesi.reduce((a, x) => a + x.accantonato, 0)),
    incasso: pyRound2(mesi.reduce((a, x) => a + x.incasso, 0)) };
}
const thisYear = (iso, y) => {
  if (!iso) return null;
  const md = iso.slice(5, 10);
  return md === "02-29" && lastDay(y, 2) === 28 ? `${y}-02-28` : `${y}-${md}`;
};
const daysBetween = (a, b) => Math.round((Date.parse(b + "T00:00:00Z") - Date.parse(a + "T00:00:00Z")) / 864e5);
export function tasseAnno(movs, y, indiciFor, scadenze, versate, metodo = "indici", perc = 25, today = todayIso()) {
  const acc = accantonato(movs, y, indiciFor, metodo, perc);
  const prev = accantonato(movs, y - 1, indiciFor, metodo, perc);
  const [ty, tm] = ym(today);
  const stima = y === ty ? pyRound2(acc.totale / Math.max(1, tm) * 12) : acc.totale;
  const vers = (versate || []).filter((v) => inYear(v.data, y));
  const pagato = pyRound2(vers.reduce((a, v) => a + Number(v.importo || 0), 0));
  const items = [];
  for (const s of scadenze || []) {
    if (s.attiva === false) continue;
    const d = thisYear(s.data, y);
    const pv = s.importo ? Number(s.importo)
      : pyRound2(((s.base || "anno_prima") === "anno_prima" ? prev.totale : stima) * Number(s.percentuale || 0) / 100);
    const paid = pyRound2(vers.filter((v) => v.voce === s.id).reduce((a, v) => a + Number(v.importo || 0), 0));
    items.push({ scadenza: s, data: d, previsto: pyRound2(pv), pagato: paid, fatto: paid > 0 && paid >= pv - 0.5,
      giorni: d ? daysBetween(today, d) : null });
  }
  items.sort((a, b) => ((a.data || "9999") < (b.data || "9999") ? -1 : 1));
  const previsto = pyRound2(items.reduce((a, x) => a + x.previsto, 0));
  return { anno: y, accantonato: acc.totale, mesi: acc.mesi, incasso: acc.incasso, anno_prima: prev.totale,
    stima_anno: stima, pagato, da_parte: pyRound2(acc.totale - pagato), previsto,
    mancante: pyRound2(Math.max(0, previsto - pagato)), scadenze: items, versate: vers };
}
export const SOGLIA_STEPS = [80, 90, 100];
export function soglia(movs, y, categorie, limite, mode = null, today = todayIso()) {
  const cats = new Set(categorie && categorie.length ? categorie : [CAT_PROFESSIONE]);
  let tot = 0;
  for (const m of movs) {
    if ((m.tipo || T.USCITA) !== T.ENTRATA || !cats.has(m.categoria) || isAnnual(m)) continue;
    const d = isProfIncome(m) ? profDate(m, mode) : m.data;
    if (inYear(d, y)) tot += Number(m.importo || 0);
  }
  let prev = tot;
  if (y === ym(today)[0]) {
    const days = daysBetween(`${y}-01-01`, `${y + 1}-01-01`);
    const frac = (daysBetween(`${y}-01-01`, today) + 1) / days;
    prev = frac > 0 ? tot / frac : tot;
  }
  limite = Number(limite || 0);
  const pct = limite ? tot / limite * 100 : 0;
  return { ricavi: pyRound2(tot), previsione: pyRound2(prev), limite, pct: Math.round(pct * 10) / 10,
    pct_prev: limite ? Math.round(prev / limite * 1000) / 10 : 0,
    step: Math.max(0, ...SOGLIA_STEPS.filter((s) => pct >= s)), supera: !!limite && prev > limite,
    resto: pyRound2(limite - tot) };
}
export function sogliaText(st) {
  return `Ricavi ${fmtEur(st.ricavi)} su ${fmtEur(st.limite)} (${st.pct.toFixed(0)}%) · al ritmo attuale a dicembre `
    + `arrivi a ${fmtEur(st.previsione)}${st.supera ? " ⚠️ oltre la soglia" : ""}`;
}
export function daIncassare(movs, today = todayIso(), giorni = 30) {
  const by = {};
  for (const m of movs) if (isUnpaid(m) && m.data) (by[m.sottocategoria || "Senza nome"] ||= []).push(m);
  const out = Object.entries(by).map(([p, rows]) => {
    rows.sort((a, b) => (a.data < b.data ? -1 : 1));
    const old = daysBetween(rows[0].data, today);
    return { paziente: p, sedute: rows, totale: pyRound2(rows.reduce((a, r) => a + Number(r.importo || 0), 0)),
      giorni: old, ritardo: old >= Number(giorni || 0) };
  });
  return out.sort((a, b) => b.giorni - a.giorni || a.paziente.toLowerCase().localeCompare(b.paziente.toLowerCase()));
}

// impostazioni (schema.SETTING_DEFAULTS)
export const SETTING_DEFAULTS = { obiettivi_attivi: false, patrimonio_attivo: true, previsione_attiva: true,
  tasse_attivo: false, tasse_metodo: "indici", tasse_perc: 25, soglia_attiva: false, soglia_importo: 85000,
  soglia_categorie: ["Libera professione"], sedute_attive: true, sedute_mese: "pagamento", sedute_giorni: 30,
  dichiarazione_attiva: true, chiudi_mese_attivo: true };
export const setting = (info, k) => (info?.[k] == null || info[k] === "" ? SETTING_DEFAULTS[k] : info[k]);

// ---------------------------------------------------------------- etichette (eventi) e scontrini
export const normTag = (t) => String(t || "").replace(/\s+/g, " ").trim();
/** Etichette già usate, le più recenti per prime (come cashflow/core/eventi.py: suggerimenti). */
export function tagSuggestions(...lists) {
  const spell = new Map(), last = new Map();
  for (const movs of lists) for (const m of movs || []) {
    const t = normTag(m.etichetta);
    if (!t) continue;
    const k = t.toLowerCase();
    const s = spell.get(k) || new Map();
    s.set(t, (s.get(t) || 0) + 1);
    spell.set(k, s);
    const d = m.data || "";
    if (!last.has(k) || d > last.get(k)) last.set(k, d);
  }
  return [...spell.keys()].sort((a, b) => (last.get(b) || "").localeCompare(last.get(a) || ""))
    .map((k) => [...spell.get(k).entries()].sort((a, b) => b[1] - a[1])[0][0]);
}
const slug = (t, n = 28) => (String(t || "").normalize("NFD").replace(/[̀-ͯ]/g, "")
  .replace(/[^\w-]+/g, "_").replace(/^_+|_+$/g, "").slice(0, n).replace(/_+$/, "")) || "voce";
/** Percorso dello scontrino nella cartella dei dati (come cashflow/core/scontrini.py: rel_path). */
export function receiptPath(dataIso, descrizione) {
  const d = /^\d{4}-\d{2}-\d{2}/.test(dataIso || "") ? dataIso.slice(0, 10) : todayIso();
  const hex = Array.from(crypto.getRandomValues(new Uint8Array(3)), (b) => b.toString(16).padStart(2, "0")).join("");
  return `Scontrini/${d.slice(0, 4)}/${d}_${slug(descrizione)}_${hex}.jpg`;
}

// ---------------------------------------------------------------- cosa è cambiato (come cashflow/core/cambiamenti.py)
const CH_STOP = new Set(["pagamento", "pag", "pos", "addebito", "sdd", "carta", "bonifico", "a", "di", "del", "della",
  "il", "la", "per", "presso", "rata", "mensile", "abbonamento", "srl", "spa", "s.p.a", "s.r.l", "it", "eu", "www", "com"]);
export function nomeChiave(descr) {
  const t = String(descr || "").toLowerCase().replace(/[\d.,:/#*\-_]+/g, " ");
  return t.split(/[^\p{L}\p{N}_]+/u).filter((w) => w && !CH_STOP.has(w) && w.length > 1).slice(0, 3).join(" ");
}
const chYm = (y, m, d) => { const i = y * 12 + (m - 1) + d; return [Math.floor(i / 12), (i % 12) + 1]; };
const chK = (y, m) => `${y}-${m}`;
const median3 = (a) => [...a].sort((x, y) => x - y)[Math.floor(a.length / 2)];

export function cambiamenti(movs, y, m, mesi = 6, today = todayIso()) {
  const [ty, tm] = [Number(today.slice(0, 4)), Number(today.slice(5, 7))];
  const finito = y < ty || (y === ty && m < tm);
  const byMonth = new Map(), rec = new Map(), cnt = new Map(), label = new Map();
  for (const x of movs || []) {
    if ((x.tipo || T.USCITA) !== T.USCITA || !x.data) continue;
    const k = chK(Number(x.data.slice(0, 4)), Number(x.data.slice(5, 7)));
    const v = Number(x.importo || 0);
    const bm = byMonth.get(k) || new Map();
    const c = x.categoria || "Senza categoria";
    bm.set(c, (bm.get(c) || 0) + v);
    byMonth.set(k, bm);
    const n = nomeChiave(x.descrizione);
    if (n) {
      const r = rec.get(n) || new Map(); r.set(k, (r.get(k) || 0) + v); rec.set(n, r);
      const q = cnt.get(n) || new Map(); q.set(k, (q.get(k) || 0) + 1); cnt.set(n, q);
      if (!label.has(n)) label.set(n, String(x.descrizione || "").trim());
    }
  }
  const cur = byMonth.get(chK(y, m)) || new Map();
  const prev = [];
  for (let i = 1; i <= 24 && prev.length < mesi; i++) { const k = chK(...chYm(y, m, -i)); if (byMonth.has(k)) prev.push(k); }
  const sum = (mp) => [...mp.values()].reduce((a, b) => a + b, 0);
  const res = { anno: y, mese: m, finito, mesi_confronto: prev.length, totale: pyRound2(sum(cur)), media_totale: 0,
    variazioni: [], prezzi: [], nuove: [], sparite: [] };
  if (prev.length) res.media_totale = pyRound2(prev.reduce((a, k) => a + sum(byMonth.get(k)), 0) / prev.length);
  if (prev.length && finito) {
    const cats = new Set([...cur.keys()]);
    for (const k of prev) for (const c of byMonth.get(k).keys()) cats.add(c);
    for (const c of cats) {
      const now = cur.get(c) || 0;
      const avg = prev.reduce((a, k) => a + (byMonth.get(k).get(c) || 0), 0) / prev.length;
      const diff = now - avg;
      if (Math.abs(diff) < 20) continue;
      const pct = avg > 0 ? (diff / avg) * 100 : null;
      if (pct != null && Math.abs(pct) < 25) continue;
      res.variazioni.push({ categoria: c, ora: pyRound2(now), media: pyRound2(avg), diff: pyRound2(diff),
        pct: pct != null ? Math.round(pct) : null });
    }
    res.variazioni.sort((a, b) => Math.abs(b.diff) - Math.abs(a.diff) || (a.categoria < b.categoria ? -1 : a.categoria > b.categoria ? 1 : 0));
  }
  const [m1, m2, m3, m4] = [1, 2, 3, 4].map((i) => chK(...chYm(y, m, -i)));
  const kc = chK(y, m);
  for (const [n, months] of rec) {
    const now = months.get(kc);
    const before = [m1, m2, m3, m4].filter((k) => months.has(k)).map((k) => months.get(k));
    const cn = cnt.get(n);
    if (before.length >= 3 && months.has(m1)) {
      const b3 = before.slice(0, 3);
      const tipico = median3(b3);
      const fisso = [m1, m2, m3, m4].filter((k) => months.has(k)).every((k) => cn.get(k) === 1)
        && Math.max(...b3) - Math.min(...b3) <= 0.03 * tipico;
      if (now == null) {
        if (finito && fisso) res.sparite.push({ nome: label.get(n), prima: pyRound2(tipico) });
      } else if (fisso && cn.get(kc) === 1) {
        const d = now - tipico;
        if (Math.abs(d) >= 0.5 && (Math.abs(d) / tipico) * 100 >= 3 && Math.abs(d) / tipico < 0.6) {
          res.prezzi.push({ nome: label.get(n), prima: pyRound2(tipico), ora: pyRound2(now), diff: pyRound2(d) });
        }
      }
    } else if (now != null && months.has(m1) && months.has(m2) && !months.has(m3) && !months.has(m4)) {
      const vals = [now, months.get(m1), months.get(m2)];
      if (Math.max(...vals) - Math.min(...vals) <= 0.15 * Math.max(...vals)) res.nuove.push({ nome: label.get(n), importo: pyRound2(now) });
    }
  }
  res.prezzi.sort((a, b) => Math.abs(b.diff) - Math.abs(a.diff) || (a.nome < b.nome ? -1 : a.nome > b.nome ? 1 : 0));
  return res;
}

export function cambiamentiRighe(res, limite = 8) {
  const out = [];
  for (const p of res.prezzi) out.push(["price", `${p.nome}: da ${fmtEur(p.prima)} a ${fmtEur(p.ora)} (${p.diff > 0 ? "+" : "−"}${fmtEur(Math.abs(p.diff))})`]);
  for (const v of res.variazioni) {
    if (v.pct == null) out.push(["up", `${v.categoria}: ${fmtEur(v.ora)}, di solito niente`]);
    else out.push([v.diff > 0 ? "up" : "down", `${v.categoria} ${v.diff > 0 ? "+" : "−"}${Math.abs(v.pct).toFixed(0)}% rispetto alla tua media (${fmtEur(v.ora)} invece di ${fmtEur(v.media)})`]);
  }
  for (const n of res.nuove) out.push(["new", `Nuova spesa ricorrente: ${n.nome} (${fmtEur(n.importo)} al mese)`]);
  for (const g of res.sparite) out.push(["gone", `Non c'è più: ${g.nome} (di solito ${fmtEur(g.prima)}) — disdetta?`]);
  return out.slice(0, limite);
}

export function cambiamentiRiassunto(res) {
  if (!res.mesi_confronto) return "Servono almeno un paio di mesi di spese per fare il confronto.";
  const k = res.mesi_confronto;
  const base = k === 1 ? "confronto con il mese prima" : `confronto con i ${k} mesi prima`;
  const tot = res.totale, avg = res.media_totale;
  if (!res.finito) return `Mese in corso: finora ${fmtEur(tot)} di spese (media ${fmtEur(avg)} al mese) · ${base}.`;
  const d = tot - avg;
  if (Math.abs(d) < 1) return `Spese ${fmtEur(tot)}, come la tua media · ${base}.`;
  return `Spese ${fmtEur(tot)}, ${fmtEur(Math.abs(d))} ${d > 0 ? "in più" : "in meno"} della tua media (${fmtEur(avg)}) · ${base}.`;
}

// ---------------------------------------------------------------- eventi (come cashflow/core/eventi.py: elenco)
export function eventiElenco(movs) {
  const groups = new Map();
  for (const m of movs || []) {
    const t = normTag(m.etichetta);
    if (!t) continue;
    const k = t.toLowerCase();
    if (!groups.has(k)) groups.set(k, []);
    groups.get(k).push(m);
  }
  const out = [];
  for (const [k, voci] of groups) {
    const names = new Map();
    for (const m of voci) { const t = normTag(m.etichetta); names.set(t, (names.get(t) || 0) + 1); }
    const nome = [...names.entries()].sort((a, b) => b[1] - a[1])[0][0];
    let spese = 0, entrate = 0;
    const cats = new Map();
    for (const m of voci) {
      const v = Number(m.importo || 0);
      if ((m.tipo || T.USCITA) === T.USCITA) { spese += v; const c = m.categoria || "Senza categoria"; cats.set(c, (cats.get(c) || 0) + v); }
      else entrate += v;
    }
    const dates = voci.map((m) => m.data).filter(Boolean).sort();
    out.push({ nome, chiave: k, spese: pyRound2(spese), entrate: pyRound2(entrate), netto: pyRound2(entrate - spese), n: voci.length,
      dal: dates[0] || null, al: dates[dates.length - 1] || null,
      categorie: [...cats.entries()].map(([c, v]) => [c, pyRound2(v)]).sort((a, b) => b[1] - a[1]),
      voci: [...voci].sort((a, b) => (a.data || "").localeCompare(b.data || "") || String(a.id || "").localeCompare(String(b.id || ""))) });
  }
  out.sort((a, b) => (b.al || "").localeCompare(a.al || ""));
  return out;
}


// ---------------------------------------------------------------- spese comuni: in quale mia categoria vanno
// (come calc.comune_target / map_comune_rows sul PC)
const COMUNE_SIMILI = [["aliment", "spesa", "supermerc"], ["bollett", "utenz"], ["ristor", "bar", "pizz"],
  ["viagg", "vacanz"], ["casa", "affitt", "mutu"], ["trasport", "auto", "carbur", "benzin"],
  ["salut", "farmac", "medic"], ["svago", "hobby", "divert"], ["regal"], ["animal"],
  ["abbonam", "telefon"], ["vestit", "abbigl"], ["arred", "mobil"], ["pulizi"]];
const TARI = /\btari\b|tassa\s+(sui\s+)?rifiuti/i;
const nk = (s) => String(s || "").normalize("NFKD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^a-z0-9]/g, "");
export function comuneMappa(info) {
  const v = (info || {}).comune_mappa;
  if (v && typeof v === "object") return { ...v };
  try { const d = v ? JSON.parse(v) : {}; return d && typeof d === "object" && !Array.isArray(d) ? d : {}; } catch { return {}; }
}
function simile(a, cats) {
  const na = nk(a);
  for (const grp of COMUNE_SIMILI) {
    if (grp.some((g) => na.startsWith(g) || na.includes(g))) {
      const c = cats.find((x) => { const nc = nk(x); return grp.some((g) => nc.startsWith(g) || nc.includes(g)); });
      if (c) return c;
    }
  }
  return null;
}
export function comuneTarget(cat, sub, descr, personalCats, mappa) {
  const cats = personalCats.filter((c) => c && c !== CAT_SPESE_COMUNI && c !== CAT_PRESTITI);
  for (const k of [sub ? `${cat}/${sub}` : null, cat]) {
    if (k && Object.prototype.hasOwnProperty.call(mappa, k)) return cats.includes(mappa[k]) ? mappa[k] : CAT_SPESE_COMUNI;
  }
  if (TARI.test(`${sub} ${descr}`)) {
    const b = cats.find((c) => ["bollett", "utenz"].some((g) => nk(c).includes(g)));
    if (b) return b;
  }
  const same = cats.find((c) => nk(c) === nk(cat));
  if (same) return same;
  return simile(cat, cats) || CAT_SPESE_COMUNI;
}
export function mapComuneRows(rows, personalCats, mappa) {
  return rows.map((r) => {
    if (r.categoria !== CAT_SPESE_COMUNI) return r;
    const cat = r.sottocategoria || "", sub = r.comune_sub || "";
    const tgt = comuneTarget(cat, sub, r.descrizione || "", personalCats, mappa);
    return { ...r, categoria: tgt, sottocategoria: tgt !== CAT_SPESE_COMUNI ? sub : cat, comune_categoria: cat };
  });
}
