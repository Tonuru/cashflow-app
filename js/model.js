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
  let extraStip = 0;
  for (let mo = 1; mo <= 12; mo++) {
    const t = monthTotals(movs, y, mo);
    const extra = movs.filter((m) => m.tipo === T.STIPENDIO && EXTRA_STIPENDIO.includes(m.categoria)
      && inMonth(m.data, y, mo) && !isAnnual(m)).reduce((a, m) => a + Number(m.importo || 0), 0);
    extraStip += extra;
    const stip = (t.per_tipo[T.STIPENDIO] || 0) - extra;
    if (stip <= 0) continue;
    n++;
    const r = rimanenti(t);
    for (const k in rest) rest[k] += r[k] - extra;
  }
  const an = annual(movs, y);
  extraStip += an.tredicesima + an.quattordicesima;
  const out = { mesi_validi: n, tredicesima_quattordicesima: pyRound2(extraStip) };
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
      descrizione: src.descrizione || "", metodo: "", note, origine: ORIGINE_COMUNE });
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

export function professione(movs, y, mo, indici) {
  const ind = { ...INDICI_DEFAULT, ...(indici || {}) };
  let inc = 0, spese = 0, sedute = 0;
  for (const m of movs) {
    if (!inMonth(m.data, y, mo) || isAnnual(m)) continue;
    if (isProfIncome(m)) { inc += Number(m.importo || 0); sedute += 1; }
    else if (isProfCost(m)) spese += Number(m.importo || 0);
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
