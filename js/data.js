// Stato dell'app: impostazioni, file per anno, copia locale (per partire subito e senza rete), modifiche.
import * as G from "./graph.js";
import * as M from "./model.js";
import { readWorkbook } from "./xlsx.js";

const K_SETTINGS = "cf.settings";
const K_CACHE = "cf.cache";
const K_OVERLAY = "cf.overlay";

function load(k, d) { try { return JSON.parse(localStorage.getItem(k) || "null") ?? d; } catch { return d; } }
function save(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch { /* spazio pieno: pazienza */ } }

export const settings = Object.assign({
  clientId: "", tenant: "consumers", utente: "", profilo: "michele", altra_persona: "",
  personal: null, comune: null, comuneOff: false,
}, load(K_SETTINGS, {}));
export function saveSettings(patch = {}) { Object.assign(settings, patch); save(K_SETTINGS, settings); }
export const isConfigured = () => !!(settings.clientId && settings.utente && settings.personal);
export const isMichele = () => settings.profilo !== "tania";

export const safeName = (s) => (String(s).trim().split("").map((ch) => (/[\p{L}\p{N}\-_ ]/u.test(ch) ? ch : "_")).join("")
  .replace(/ /g, "_")) || "Utente";

// ---------------------------------------------------------------- file per anno
// files.personal[anno] / files.comune[anno] = { ref, name, eTag, data }
export const files = { personal: {}, comune: {} };
let cache = load(K_CACHE, {});
for (const kind of ["personal", "comune"]) Object.assign(files[kind], cache[kind] || {});
let overlay = load(K_OVERLAY, []);   // modifiche scritte ma non ancora visibili nel file scaricato
const listeners = new Set();
export const onChange = (fn) => listeners.add(fn);
const emit = (what = "data") => listeners.forEach((fn) => fn(what));
export const status = { syncing: false, last: cache.last || null, error: "" };

function persistCache() {
  cache = { personal: files.personal, comune: files.comune, last: status.last };
  save(K_CACHE, cache);
}
export function clearCache() {
  files.personal = {};
  files.comune = {};
  overlay = [];
  save(K_OVERLAY, overlay);
  localStorage.removeItem(K_CACHE);
}

const prefix = (kind) => (kind === "personal" ? `Cashflow_${safeName(settings.utente)}_` : "Cashflow_Comune_");
export function yearOfName(kind, name) {
  const m = name.match(/^(.*)_(\d{4})\.xlsx$/i);
  return m && `${m[1]}_`.toLowerCase() === prefix(kind).toLowerCase() ? Number(m[2]) : null;
}

let changed = false;
async function syncKind(kind, folder) {
  if (!folder) { if (Object.keys(files[kind]).length) changed = true; files[kind] = {}; return; }
  const items = await G.children(folder);
  const seen = new Set();
  for (const it of items) {
    if (!it.file) continue;
    const y = yearOfName(kind, it.name);
    if (!y) continue;
    seen.add(String(y));
    const cur = files[kind][y];
    if (cur && cur.eTag === it.eTag && cur.data) continue;
    changed = true;
    const sheets = await readWorkbook(await G.download(it));
    const data = kind === "personal" ? await M.parsePersonal(sheets, settings.utente) : await M.parseComune(sheets);
    files[kind][y] = { ref: G.refOf(it), name: it.name, eTag: it.eTag, data, loadedAt: Date.now() };
  }
  for (const y of Object.keys(files[kind])) if (!seen.has(y)) { delete files[kind][y]; changed = true; }
}

export async function sync() {
  if (status.syncing) return;
  status.syncing = true;
  status.error = "";
  status.needLogin = false;
  changed = false;
  emit("status");
  try {
    await syncKind("personal", settings.personal);
    await syncKind("comune", settings.comuneOff ? null : settings.comune);
    status.last = M.nowIso();
    persistCache();
  } catch (e) {
    status.error = e.message;
    if (e instanceof G.NeedLogin) status.needLogin = true;
  } finally {
    status.syncing = false;
    emit(changed ? "data" : "status");
  }
}

// ---------------------------------------------------------------- vista dei dati (con le modifiche in arrivo)
function applyOverlay(kind, year, movs) {
  const now = Date.now();
  let out = movs;
  for (const op of overlay) {
    if (op.kind !== kind || op.year !== year || now - op.t > 20 * 60 * 1000) continue;
    if (op.op === "add" && !out.some((m) => m.id === op.row.id)) out = out.concat([{ ...op.row, _pending: true }]);
    else if (op.op === "edit") out = out.map((m) => (m.id === op.id ? { ...m, ...op.changes, _pending: true } : m));
    else if (op.op === "delete") out = out.filter((m) => m.id !== op.id);
  }
  return out;
}
function pruneOverlay() {
  const now = Date.now();
  overlay = overlay.filter((op) => {
    if (now - op.t > 20 * 60 * 1000) return false;
    const f = files[op.kind][op.year];
    if (!f || !f.data || f.loadedAt < op.t) return true;
    const movs = f.data.movimenti;
    if (op.op === "add") return !movs.some((m) => m.id === op.row.id);
    if (op.op === "delete") return movs.some((m) => m.id === op.id);
    const m = movs.find((x) => x.id === op.id);
    return m && Object.entries(op.changes).some(([k, v]) => k !== "modificato" && (m[k] ?? "") !== (v ?? ""));
  });
  save(K_OVERLAY, overlay);
}

export const years = (kind) => Object.keys(files[kind]).map(Number).sort();
export const personalData = (y) => files.personal[y]?.data || null;
export const comuneData = (y) => files.comune[y]?.data || null;

export function personalMovs(y) {
  const d = personalData(y);
  return d ? applyOverlay("personal", y, d.movimenti) : [];
}
export function comuneMovs(y) {
  const d = comuneData(y);
  return d ? applyOverlay("comune", y, d.movimenti) : [];
}
export function comuneInfo() {
  const ys = years("comune");
  return ys.length ? comuneData(ys[ys.length - 1]).info : null;
}
export const myKey = () => M.myQuotaKey(comuneInfo(), settings.utente);
export function meInComune() {
  const i = comuneInfo();
  const k = myKey();
  return !i ? settings.utente : k === "quota_a" ? i.persona_a : k === "quota_b" ? i.persona_b : settings.utente;
}

/** Movimenti personali + la mia quota delle spese comuni (versione Michele), per un anno. */
export function allMovs(y) {
  const own = personalMovs(y);
  if (!isMichele()) return own;
  return own.concat(M.comuneQuotaRows(comuneMovs(y), myKey()));
}
/** Tutti gli anni insieme (per confronti e grafici anno per anno). */
export function allMovsEveryYear() {
  const ys = new Set([...years("personal"), ...years("comune")]);
  return [...ys].flatMap((y) => allMovs(y));
}
export function categorie(y) {
  const d = personalData(y) || personalData(years("personal").slice(-1)[0]);
  return d ? d.categorie : [];
}
export function metodi(y) {
  const d = personalData(y) || personalData(years("personal").slice(-1)[0]);
  return d ? d.metodi : M.DEFAULT_METODI;
}
export function comuneCategorie(y) {
  const d = comuneData(y) || comuneData(years("comune").slice(-1)[0]);
  return d ? d.categorie : [];
}

// ---------------------------------------------------------------- scrittura
function fileFor(kind, year) {
  const f = files[kind][year];
  if (!f) {
    const what = kind === "personal" ? `Cashflow_${safeName(settings.utente)}_${year}.xlsx` : `Cashflow_Comune_${year}.xlsx`;
    throw new Error(`Il file ${what} non esiste ancora: crealo aprendo l'app sul PC in quell'anno.`);
  }
  return f;
}
const kindName = (kind) => (kind === "personal" ? "personale" : "comune");

async function afterWrite(op) {
  op.t = Date.now();
  overlay.push(op);
  save(K_OVERLAY, overlay);
  emit();
  // il file scaricato può arrivare in ritardo di qualche secondo: le modifiche restano visibili nel frattempo
  setTimeout(() => sync().then(pruneOverlay).then(emit), 4000);
}

export async function addMov(kind, row) {
  const year = Number(row.data.slice(0, 4));
  const f = fileFor(kind, year);
  const full = { ...row, id: M.newId(), inserito: M.nowIso(), modificato: "" };
  if (kind === "personal") full.origine = full.origine || "iPhone";
  else full.inserito_da = full.inserito_da || meInComune();
  await G.addRow(f.ref, kindName(kind), full);
  await afterWrite({ op: "add", kind, year, row: full });
  return full;
}

export async function editMov(kind, year, id, changes) {
  const newYear = changes.data ? Number(changes.data.slice(0, 4)) : year;
  if (newYear !== year) {
    // cambio d'anno: la voce passa nel file dell'altro anno
    const cur = (kind === "personal" ? personalMovs(year) : comuneMovs(year)).find((m) => m.id === id);
    const row = { ...cur, ...changes };
    delete row._row; delete row._pending; delete row.id;
    fileFor(kind, newYear);
    await addMov(kind, row);
    await deleteMov(kind, year, id);
    return;
  }
  const f = fileFor(kind, year);
  const ch = { ...changes, modificato: M.nowIso() };
  await G.editRow(f.ref, kindName(kind), id, ch);
  await afterWrite({ op: "edit", kind, year, id, changes: ch });
}

export async function deleteMov(kind, year, id) {
  const f = fileFor(kind, year);
  await G.deleteRow(f.ref, kindName(kind), id);
  await afterWrite({ op: "delete", kind, year, id });
}

