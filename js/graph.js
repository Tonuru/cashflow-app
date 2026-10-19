// Accesso a OneDrive tramite Microsoft Graph, senza librerie esterne.
// Login: OAuth 2.0 "authorization code + PKCE" (app di tipo Single-page application su Azure).

import { headerMap, PERSONAL_COLS, COMUNE_COLS, isoToSerial, parsePersonal, parseComune } from "./model.js";
import { colLetter, colIndex } from "./xlsx.js";

const GRAPH = "https://graph.microsoft.com/v1.0";
const SCOPES = "openid profile offline_access User.Read Files.ReadWrite.All";
const K_TOKENS = "cf.tokens";
const K_PKCE = "cf.pkce";

export class NeedLogin extends Error {}

let cfg = { clientId: "", tenant: "consumers" };
export function configure(c) { cfg = { ...cfg, ...c }; }
export const redirectUri = () => location.origin + location.pathname.replace(/index\.html$/, "");
const authBase = () => `https://login.microsoftonline.com/${cfg.tenant || "consumers"}/oauth2/v2.0`;

const b64url = (bytes) => btoa(String.fromCharCode(...bytes)).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
function randomString(n = 32) { const b = new Uint8Array(n); crypto.getRandomValues(b); return b64url(b); }

function load(k) { try { return JSON.parse(localStorage.getItem(k) || "null"); } catch { return null; } }
function save(k, v) { try { if (v == null) localStorage.removeItem(k); else localStorage.setItem(k, JSON.stringify(v)); } catch { /* */ } }

export async function login(prompt = "select_account") {
  if (!cfg.clientId) throw new Error("Manca il Client ID dell'app Microsoft.");
  const verifier = randomString(48);
  const challenge = b64url(new Uint8Array(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(verifier))));
  const state = randomString(16);
  save(K_PKCE, { verifier, state, prompt });
  const q = new URLSearchParams({
    client_id: cfg.clientId, response_type: "code", redirect_uri: redirectUri(), scope: SCOPES,
    code_challenge: challenge, code_challenge_method: "S256", state, response_mode: "query",
  });
  if (prompt) q.set("prompt", prompt);
  location.assign(`${authBase()}/authorize?${q}`);
}

async function tokenRequest(params) {
  const r = await fetch(`${authBase()}/token`, {
    method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ client_id: cfg.clientId, scope: SCOPES, ...params }),
  });
  const j = await r.json().catch(() => ({}));
  if (!r.ok) {
    const e = new Error(j.error_description || j.error || `Errore di accesso (${r.status})`);
    e.code = j.error;
    throw e;
  }
  const now = Date.now();
  const t = {
    access_token: j.access_token, expires_at: now + (j.expires_in - 120) * 1000,
    refresh_token: j.refresh_token, refresh_until: now + 23 * 3600 * 1000,
  };
  save(K_TOKENS, t);
  return t;
}

/** Da chiamare all'avvio: completa il login se la pagina arriva dal reindirizzamento Microsoft.
 *  Ritorna null (nessun reindirizzamento), "ok" oppure un messaggio d'errore. */
export async function handleRedirect() {
  const u = new URL(location.href);
  const code = u.searchParams.get("code");
  const err = u.searchParams.get("error");
  if (!code && !err) return null;
  const pk = load(K_PKCE) || {};
  history.replaceState(null, "", redirectUri());
  save(K_PKCE, null);
  if (err) {
    // accesso silenzioso non riuscito: serve il login normale
    if (pk.prompt === "none" && ["login_required", "interaction_required", "consent_required"].includes(err)) return "login_required";
    return u.searchParams.get("error_description") || err;
  }
  if (!pk.state || u.searchParams.get("state") !== pk.state) return "Risposta di login non valida, riprova.";
  try {
    await tokenRequest({ grant_type: "authorization_code", code, redirect_uri: redirectUri(), code_verifier: pk.verifier });
    return "ok";
  } catch (e) {
    return e.message;
  }
}

export const isLoggedIn = () => { const t = load(K_TOKENS); return !!(t && (t.expires_at > Date.now() || t.refresh_token)); };
export function logout() { save(K_TOKENS, null); }

export async function getToken() {
  const t = load(K_TOKENS);
  if (!t) throw new NeedLogin("Accedi con l'account Microsoft.");
  if (t.access_token && t.expires_at > Date.now()) return t.access_token;
  if (t.refresh_token && (t.refresh_until || 0) > Date.now()) {
    try { return (await tokenRequest({ grant_type: "refresh_token", refresh_token: t.refresh_token })).access_token; }
    catch (e) { if (!navigator.onLine) throw e; }
  }
  throw new NeedLogin("Sessione scaduta: accedi di nuovo.");
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

export async function gfetch(path, opts = {}, tries = 4) {
  const url = path.startsWith("http") ? path : GRAPH + path;
  for (let i = 0; ; i++) {
    const token = await getToken();
    const headers = { Authorization: `Bearer ${token}`, ...(opts.headers || {}) };
    if (opts.json !== undefined) headers["Content-Type"] = "application/json";
    let r;
    try {
      r = await fetch(url, { method: opts.method || "GET", headers,
        body: opts.json !== undefined ? JSON.stringify(opts.json) : opts.body });
    } catch (e) {
      if (i < tries - 1) { await sleep(800 * (i + 1)); continue; }
      throw new Error("Connessione assente o OneDrive non raggiungibile.");
    }
    if ((r.status === 429 || r.status >= 500) && i < tries - 1) {
      const ra = Number(r.headers.get("Retry-After")) || i + 1;
      await sleep(Math.min(ra, 10) * 1000);
      continue;
    }
    if (r.status === 401 && i === 0) { const t = load(K_TOKENS); if (t) { t.expires_at = 0; save(K_TOKENS, t); } continue; }
    if (!r.ok) {
      const j = await r.json().catch(() => ({}));
      const e = new Error(j.error?.message || `Errore OneDrive (${r.status})`);
      e.status = r.status;
      e.code = j.error?.code;
      throw e;
    }
    if (opts.raw) return r;
    if (r.status === 204) return null;
    const ct = r.headers.get("Content-Type") || "";
    return ct.includes("json") ? r.json() : r.text();
  }
}

export const me = () => gfetch("/me?$select=displayName,userPrincipalName");

// ---------------------------------------------------------------- cartelle e file
/** Riferimento stabile a un elemento (anche di un'altra persona, condiviso): {driveId, id, name}. */
export function refOf(item) {
  if (item.remoteItem) return { driveId: item.remoteItem.parentReference.driveId, id: item.remoteItem.id, name: item.name };
  return { driveId: item.parentReference.driveId, id: item.id, name: item.name };
}
const itemPath = (ref) => `/drives/${ref.driveId}/items/${ref.id}`;

export async function itemByPath(relPath) {
  const p = relPath.replace(/\\/g, "/").replace(/^\/+|\/+$/g, "");
  const enc = p.split("/").map(encodeURIComponent).join("/");
  return gfetch(p ? `/me/drive/root:/${enc}` : "/me/drive/root");
}
export const getItem = (ref) => gfetch(itemPath(ref));
export const rootItem = () => gfetch("/me/drive/root");

export async function children(ref) {
  let url = ref ? `${itemPath(ref)}/children?$top=200` : "/me/drive/root/children?$top=200";
  const out = [];
  while (url) {
    const j = await gfetch(url);
    out.push(...j.value);
    url = j["@odata.nextLink"];
  }
  return out;
}
export async function sharedWithMe() {
  const j = await gfetch("/me/drive/sharedWithMe");
  return j.value;
}
export async function search(q) {
  const j = await gfetch(`/me/drive/root/search(q='${encodeURIComponent(q.replace(/'/g, "''"))}')?$top=50`);
  return j.value;
}

export async function download(item) {
  let url = item["@microsoft.graph.downloadUrl"];
  if (!url) url = (await gfetch(`${itemPath(refOf(item))}?select=id,@microsoft.graph.downloadUrl`))["@microsoft.graph.downloadUrl"];
  let r;
  try { r = await fetch(url); } catch { r = null; }
  if (!r || !r.ok) {
    const fresh = await gfetch(`${itemPath(refOf(item))}`);
    r = await fetch(fresh["@microsoft.graph.downloadUrl"]);
    if (!r.ok) throw new Error(`Download non riuscito (${r.status})`);
  }
  return r.arrayBuffer();
}

/** "C:\Users\Michele\OneDrive\Cashflow" (o "...\OneDrive - Personale\Cashflow") -> "Cashflow". */
export function oneDriveRelative(winPath) {
  if (!winPath) return null;
  const parts = String(winPath).split(/[\\/]+/);
  const i = parts.findIndex((p) => /^onedrive( - .*)?$/i.test(p));
  return i >= 0 ? parts.slice(i + 1).join("/") : null;
}

// ---------------------------------------------------------------- scrittura nelle celle (API workbook)
const FMT = { date: "dd/mm/yyyy", datetime: "dd/mm/yyyy hh:mm", money: '#,##0.00 "€";[Red]-#,##0.00 "€"', percent: '0" %"' };

function sheetUrl(ref, sheet) { return `${itemPath(ref)}/workbook/worksheets('${encodeURIComponent(sheet)}')`; }

async function usedRange(ref, sheet) {
  const j = await gfetch(`${sheetUrl(ref, sheet)}/usedRange(valuesOnly=true)?$select=address,values`);
  const addr = j.address.split("!").pop();
  const start = addr.split(":")[0];
  const r0 = parseInt(start.replace(/^[A-Z]+/, ""), 10);
  const c0 = colIndex(start);
  // la tabella parte sempre da A1 (intestazioni): riallinea se Excel taglia righe/colonne vuote
  const values = [];
  for (let i = 0; i < r0 - 1; i++) values.push([]);
  for (const row of j.values) values.push(Array(c0).fill("").concat(row));
  return values;
}

function cellValue(kind, v) {
  if (v == null || v === "") return "";
  if (kind === "date" || kind === "datetime") return isoToSerial(v);
  if (kind === "money" || kind === "percent") return Number(v);
  return String(v);
}

function buildRow(header, cols, quotaKeys, row) {
  const hmap = headerMap(header, cols, quotaKeys);
  const byKey = Object.fromEntries(cols.map((c) => [c.key, c]));
  const values = [], formats = [];
  for (let i = 0; i < header.length; i++) {
    const key = hmap[i];
    if (!key || !(key in row)) { values.push(null); formats.push(null); continue; }
    const kind = key.startsWith("quota") ? "percent" : byKey[key].kind;
    values.push(cellValue(kind, row[key]));
    formats.push(FMT[kind] || null);
  }
  return { values, formats };
}

const SPEC = {
  personale: { cols: PERSONAL_COLS, quota: [], parse: (rows) => parsePersonal({ Movimenti: rows }) },
  comune: { cols: COMUNE_COLS, quota: ["quota_a", "quota_b"], parse: (rows) => parseComune({ Movimenti: rows }) },
};

async function patchRow(ref, header, rowNum, built) {
  const last = colLetter(header.length - 1);
  // le colonne non gestite restano come sono: si scrive solo il blocco di colonne gestite
  await gfetch(`${sheetUrl(ref, "Movimenti")}/range(address='A${rowNum}:${last}${rowNum}')`, {
    method: "PATCH", json: { values: [built.values], numberFormat: [built.formats] },
  });
}

/** Aggiunge un movimento in fondo al foglio Movimenti. kind: "personale" | "comune". */
export async function addRow(ref, kind, row) {
  const sp = SPEC[kind];
  const rows = await usedRange(ref, "Movimenti");
  const header = rows[0] || [];
  if (!header.length) throw new Error("Il foglio Movimenti non ha le intestazioni: aprilo con l'app sul PC.");
  let last = rows.length;
  while (last > 1 && (rows[last - 1] || []).every((v) => v === "" || v == null)) last--;
  await patchRow(ref, header, last + 1, buildRow(header, sp.cols, sp.quota, row));
}

async function findRow(ref, kind, id) {
  const sp = SPEC[kind];
  const rows = await usedRange(ref, "Movimenti");
  const data = await sp.parse(rows);
  const m = data.movimenti.find((x) => x.id === id);
  if (!m) throw new Error("La voce non c'è più nel file (forse è stata cancellata da un altro dispositivo).");
  return { header: rows[0], rowNum: m._row, cur: m };
}

export async function editRow(ref, kind, id, changes) {
  const sp = SPEC[kind];
  const { header, rowNum } = await findRow(ref, kind, id);
  await patchRow(ref, header, rowNum, buildRow(header, sp.cols, sp.quota, { ...changes, id }));
}

export async function deleteRow(ref, kind, id) {
  const { header, rowNum } = await findRow(ref, kind, id);
  const last = colLetter(header.length - 1);
  await gfetch(`${sheetUrl(ref, "Movimenti")}/range(address='A${rowNum}:${last}${rowNum}')/delete`, {
    method: "POST", json: { shift: "Up" },
  });
}
