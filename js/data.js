// Stato dell'app: collegamento al Foglio Google, copia dei dati del PC, voci in attesa.
//
// Come funziona: il programma sul PC mette nel foglio una «copia» di tutti i dati; il telefono la legge.
// Le voci nuove/modificate/eliminate dal telefono vanno nella «coda» del foglio; il PC le scrive negli
// Excel su OneDrive. Se nel frattempo qualcuno aveva già cambiato la stessa voce, il PC NON sovrascrive
// e la segnala come conflitto: il telefono lo mostra in alto.
import * as M from "./model.js";

const K_SETTINGS = "cf.settings";
const K_CACHE = "cf.copy";
const K_QUEUE = "cf.queue";
const K_SEEN = "cf.seenErrors";

function load(k, d) { try { return JSON.parse(localStorage.getItem(k) || "null") ?? d; } catch { return d; } }
function save(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch { /* spazio pieno */ } }

export const settings = Object.assign({ url: "", token: "", device: "" }, load(K_SETTINGS, {}));
export function saveSettings(patch = {}) { Object.assign(settings, patch); save(K_SETTINGS, settings); }
export const isLinked = () => !!(settings.url && settings.token);

let cache = load(K_CACHE, { copia: null, coda: [], errori: [], letto: null });
let queue = load(K_QUEUE, []);           // operazioni del telefono non ancora confermate dal foglio
let seen = new Set(load(K_SEEN, []));     // conflitti già letti
const listeners = new Set();
export const onChange = (fn) => listeners.add(fn);
const emit = (what = "data") => listeners.forEach((fn) => fn(what));
export const status = { syncing: false, error: "", offline: false };

export const copia = () => cache.copia;
export const profile = () => ({ utente: cache.copia?.utente || "", profilo: cache.copia?.profilo || "michele",
  altra_persona: cache.copia?.altra_persona || "" });
export const isMichele = () => profile().profilo !== "tania";
export const lastRead = () => cache.letto;
export const copyDate = () => cache.copia?.generata || null;

// ---------------------------------------------------------------- codice di collegamento (dal PC)
export function decodeCode(code) {
  // tollera spazi e a-capo aggiunti copiando il codice da mail o messaggi
  code = String(code || "").replace(/\s+/g, "");
  const i = code.indexOf("CF1.");
  if (i > 0) code = code.slice(i);
  if (!code.startsWith("CF1.")) throw new Error("Il codice deve iniziare con CF1. — copialo da Impostazioni sul PC.");
  let b = code.slice(4).replace(/-/g, "+").replace(/_/g, "/");
  b += "=".repeat((4 - (b.length % 4)) % 4);
  const j = JSON.parse(new TextDecoder().decode(Uint8Array.from(atob(b), (c) => c.charCodeAt(0))));
  if (!j.u || !j.t) throw new Error("Codice incompleto.");
  return { url: j.u, token: j.t };
}

// ---------------------------------------------------------------- dialogo con il foglio
export async function call(payload, link = settings) {
  let r;
  try {
    // text/plain: richiesta "semplice", senza controlli preliminari del browser (come vuole Apps Script)
    r = await fetch(link.url, { method: "POST", headers: { "Content-Type": "text/plain;charset=utf-8" },
      body: JSON.stringify({ ...payload, token: link.token }), redirect: "follow" });
  } catch {
    // il telefono è online ma il foglio non risponde a questa app: quasi sempre è la distribuzione dello script
    const online = navigator.onLine !== false;
    const e = new Error(online
      ? "Il foglio Google non risponde a questa app. Di solito è l'impostazione dello script: «Chi può accedere» "
        + "deve essere «Chiunque» (non «Chiunque con un account Google»). Tocca «Prova l'indirizzo» per controllare."
      : "Nessuna connessione: le voci restano sul telefono e partono appena torna la rete.");
    e.offline = !online;
    e.unreachable = online;
    throw e;
  }
  const j = await r.json().catch(() => null);
  if (!j) throw new Error("Il foglio Google non ha risposto bene. Riprova tra poco.");
  if (!j.ok) throw new Error(j.errore || "Errore dal foglio Google.");
  return j;
}

export async function sync() {
  if (status.syncing || !isLinked()) return;
  status.syncing = true;
  status.error = "";
  emit("status");
  const before = JSON.stringify([cache.copia?.generata, cache.coda, cache.errori, queue.length]);
  try {
    const unsent = queue.filter((op) => !op.sent);
    if (unsent.length) {
      const r = await call({ azione: "invia", ops: unsent.map(strip), dispositivo: settings.device });
      const ok = new Set(r.ricevute || []);
      for (const op of queue) if (ok.has(op.qid)) op.sent = Date.now();
      save(K_QUEUE, queue);
    }
    const st = await call({ azione: "stato" });
    cache = { copia: st.copia || cache.copia, coda: st.coda || [], errori: st.errori || [], letto: M.nowIso() };
    // inviate e non più in coda = il PC le ha già scritte (o rifiutate): non servono più qui
    const inQueue = new Set(cache.coda.map((o) => o.qid));
    queue = queue.filter((op) => !op.sent || inQueue.has(op.qid));
    save(K_QUEUE, queue);
    save(K_CACHE, cache);
    status.offline = false;
  } catch (e) {
    status.error = e.message;
    status.offline = !!e.offline;
  } finally {
    status.syncing = false;
    const after = JSON.stringify([cache.copia?.generata, cache.coda, cache.errori, queue.length]);
    emit(after !== before ? "data" : "status");
  }
}
const strip = (op) => { const o = { ...op }; delete o.sent; return o; };

// ---------------------------------------------------------------- conflitti e voci rifiutate
export function newErrors() { return (cache.errori || []).filter((e) => !seen.has(e.qid)); }
export function markErrorsSeen() {
  for (const e of cache.errori || []) seen.add(e.qid);
  save(K_SEEN, [...seen].slice(-200));
  emit("status");
}

// ---------------------------------------------------------------- dati (copia del PC + voci in attesa)
const yearsOf = (kind) => Object.keys(cache.copia?.[kind] || {}).map(Number).sort();
export const years = (kind) => {
  const ys = new Set(yearsOf(kind));
  for (const op of pendingOps()) if (op.kind === kind) ys.add(Number(op.year));
  return [...ys].sort();
};
const fileData = (kind, y) => cache.copia?.[kind]?.[String(y)] || null;
export const personalData = (y) => fileData("personal", y);
export const comuneData = (y) => fileData("comune", y);

/** Operazioni non ancora scritte dal PC: quelle in coda sul foglio (anche da altri telefoni) + le mie. */
export function pendingOps() {
  const byId = new Map();
  for (const op of cache.coda || []) byId.set(op.qid, op);
  for (const op of queue) byId.set(op.qid, op);
  return [...byId.values()].sort((a, b) => (a.t || 0) - (b.t || 0));
}
export const pendingCount = () => queue.length;
export const unsentCount = () => queue.filter((op) => !op.sent).length;

function withPending(kind, y, movs) {
  let out = movs.slice();
  for (const op of pendingOps()) {
    if (op.kind !== kind) continue;
    if (op.op === "add") {
      if (Number(op.row.data.slice(0, 4)) === y && !out.some((m) => m.id === op.row.id)) out.push({ ...op.row, _pending: true });
    } else if (op.op === "edit") {
      const i = out.findIndex((m) => m.id === op.id);
      if (i >= 0) {
        const m = { ...out[i], ...op.changes, _pending: true };
        if (m.data && Number(m.data.slice(0, 4)) !== y) out.splice(i, 1); else out[i] = m;
      } else if (op.changes.data && Number(op.changes.data.slice(0, 4)) === y && op.full) {
        out.push({ ...op.full, ...op.changes, _pending: true });
      }
    } else if (op.op === "delete") out = out.filter((m) => m.id !== op.id);
  }
  return out;
}
export const personalMovs = (y) => withPending("personal", y, personalData(y)?.movimenti || []);
export const comuneMovs = (y) => withPending("comune", y, comuneData(y)?.movimenti || []);

export function comuneInfo() {
  const ys = yearsOf("comune");
  return ys.length ? comuneData(ys[ys.length - 1]).info : null;
}
export const myKey = () => M.myQuotaKey(comuneInfo(), profile().utente);
export function meInComune() {
  const i = comuneInfo(), k = myKey(), u = profile().utente;
  return !i ? u : k === "quota_a" ? i.persona_a : k === "quota_b" ? i.persona_b : u;
}
let _comRowsKey = "", _comRows = [];
/** Le spese comuni che entrano nelle mie spese (tutti gli anni insieme: un debito può essere ripagato l'anno dopo). */
function comuneRowsAll() {
  const info = comuneInfo();
  if (!info || !myKey()) return [];
  const all = years("comune").flatMap((y) => comuneMovs(y));
  const key = JSON.stringify([cache.copia?.generata, pendingOps().length, all.length, profile().utente]);
  if (key !== _comRowsKey) {
    _comRowsKey = key;
    _comRows = M.comunePersonalRows(all, meInComune(), info.persona_a, info.persona_b);
  }
  return _comRows;
}
export function allMovs(y) {
  return personalMovs(y).concat(comuneRowsAll().filter((m) => Number(m.data.slice(0, 4)) === y));
}
export function allMovsEveryYear() {
  const ys = new Set([...years("personal"), ...years("comune")]);
  return [...ys].flatMap((y) => allMovs(y));
}
/** Indici di tasse e contributi dell'anno (Tania); se l'anno non li ha, quelli dell'anno più vicino prima. */
export function indici(y) {
  const ys = yearsOf("personal");
  const order = [y, ...ys.filter((x) => x < y).reverse(), ...ys.filter((x) => x > y)];
  for (const x of order) {
    const ind = fileData("personal", x)?.info?.indici;
    if (ind && Object.keys(ind).length) return { ...M.INDICI_DEFAULT, ...ind };
  }
  return { ...M.INDICI_DEFAULT };
}
/** Tania ha tolto per sempre l'Educativa (Impostazioni sul PC). */
export const eduRemoved = () => !!cache.copia?.educativa_tolta;
/** Tutti i movimenti (tutti gli anni): servono al mese di gennaio, che usa il netto di dicembre. */
export function taniaMonth(y, m) {
  const movs = m === 1 ? allMovs(y - 1).concat(allMovs(y)) : allMovs(y);
  return M.taniaMonth(movs, y, m, indici);
}
const latest = (kind, y) => fileData(kind, y) || fileData(kind, yearsOf(kind).slice(-1)[0]);
export const categorie = (y) => latest("personal", y)?.categorie || [];
export const metodi = (y) => latest("personal", y)?.metodi || M.DEFAULT_METODI;
export const comuneCategorie = (y) => latest("comune", y)?.categorie || [];

// ---------------------------------------------------------------- scrittura (va in coda, poi al PC)
function qid() { return "q" + M.newId() + M.newId(); }
function enqueue(op) {
  op.qid = qid();
  op.t = Date.now();
  queue.push(op);
  save(K_QUEUE, queue);
  emit("data");
  sync();
}
function findMov(kind, year, id) {
  return (kind === "personal" ? personalMovs(year) : comuneMovs(year)).find((m) => m.id === id);
}
const clean = (row) => Object.fromEntries(Object.entries(row).filter(([k]) => !k.startsWith("_")));

export async function addMov(kind, row) {
  const full = { ...row, id: M.newId(), inserito: M.nowIso(), modificato: "" };
  if (kind === "personal") full.origine = full.origine || "iPhone";
  else full.inserito_da = full.inserito_da || meInComune();
  enqueue({ op: "add", kind, year: Number(full.data.slice(0, 4)), row: full });
  return full;
}

/** Modifica: manda anche i valori che avevo visto, così il PC capisce se qualcuno li ha cambiati nel frattempo. */
export async function editMov(kind, year, id, changes) {
  const cur = findMov(kind, year, id);
  if (!cur) throw new Error("Voce non trovata.");
  const before = Object.fromEntries(Object.keys(changes).map((k) => [k, cur[k] ?? ""]));
  enqueue({ op: "edit", kind, year, id, changes: { ...changes, modificato: M.nowIso() }, before, full: clean(cur) });
}

export async function deleteMov(kind, year, id) {
  const cur = findMov(kind, year, id);
  const before = cur ? Object.fromEntries(["data", "tipo", "importo", "categoria", "descrizione", "pagato_da",
    "quota_a", "quota_b"].filter((k) => k in cur).map((k) => [k, cur[k] ?? ""])) : {};
  enqueue({ op: "delete", kind, year, id, before });
}

/** Avviso se la voce che sto per toccare ha già modifiche in attesa (anche dall'altro telefono). */
export function pendingFor(id) {
  return pendingOps().filter((op) => op.id === id || op.row?.id === id);
}

export function resetAll() {
  for (const k of [K_SETTINGS, K_CACHE, K_QUEUE, K_SEEN]) localStorage.removeItem(k);
}
