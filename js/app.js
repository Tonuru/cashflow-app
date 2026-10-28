// Avvio dell'app e navigazione tra le schede.
import * as D from "./data.js";
import { h, toast, fill, foldCards } from "./ui.js";
import * as Mese from "./views/mese.js";
import * as Anno from "./views/anno.js";
import * as Comuni from "./views/comuni.js";
import * as Home from "./views/home.js";
import * as Dettagli from "./views/dettagli.js";
import { wizard, settingsView, conflictsSheet } from "./views/setup.js";
import { fmtDate } from "./model.js";
import * as L from "./lock.js";
import { notices } from "./views/mensile.js";
import { noticesFunzioni } from "./views/funzioni.js";
import { semaforiDots } from "./semafori.js";

export const APP_VERSION = "1.13.0";

const TABS = [
  { id: "home", label: "Home", icon: "🏠" },
  { id: "dettagli", label: "Dettagli", icon: "☰" },
  { id: "impostazioni", label: "Impostazioni", icon: "⚙️" },
];
// pagine complete, aperte da «Dettagli» (o dalla home): in basso resta acceso «Dettagli»
const SUB = new Set(["mese", "anno", "comuni", "eventi", "obiettivi", "scadenze", "cambiato"]);
let tab = "home";
try { tab = sessionStorage.getItem("cf.tab") || "home"; } catch { /* */ }
if (!TABS.some((t) => t.id === tab) && !SUB.has(tab)) tab = "home";

const app = document.getElementById("app");
const main = h("main");
const header = h("header.top");
const nav = h("nav.tabs");
const updBar = h("div.updbar");

function setTab(t) {
  tab = t;
  try { sessionStorage.setItem("cf.tab", t); } catch { /* */ }
  render();
  window.scrollTo(0, 0);
}

function goMonth(y, m) {
  Mese.view.y = y;
  Mese.view.m = m;
  setTab("mese");
}

const titleOf = (t) => TABS.find((x) => x.id === t)?.label || Dettagli.PAGES[t] || "";

function drawHeader() {
  const s = D.status;
  const st = s.syncing ? h("span.sync.spin", {}, "⟳") : s.error ? h("span.sync.err", {}, "⚠︎") : h("span.sync", {}, "⟳");
  const title = titleOf(tab);
  const pend = D.pendingOps().length;
  const cd = D.copyDate();
  const info = [cd ? `dati del PC del ${fmtDate(cd)}` : "dati del PC non ancora arrivati",
    pend ? `⏳ ${pend} non ancora negli Excel` : null, D.unsentCount() ? `${D.unsentCount()} da inviare` : null].filter(Boolean).join(" · ");
  const back = SUB.has(tab) ? h("button.top-back", { onclick: () => setTab("dettagli"), "aria-label": "Torna ai Dettagli" }, "‹") : null;
  fill(header, back, h("div.top-title", {}, h("b", {}, SUB.has(tab) ? title : "Cashflow"),
    h("span", {}, SUB.has(tab) ? "" : " · " + title),
    h("div.top-info", { onclick: () => setTab("impostazioni") }, info, tab === "home" ? null : semaforiDots())),
  h("button.icon-btn", { onclick: () => D.sync(), "aria-label": "Aggiorna i dati" }, st));
  // conflitti: in evidenza finché non li leggi
  const errs = D.newErrors();
  if (errs.length) {
    header.append(h("button.top-conflict", { onclick: conflictsSheet },
      `⚠️ ${errs.length === 1 ? "1 modifica non applicata" : errs.length + " modifiche non applicate"}: `
      + "qualcuno aveva già cambiato quella voce — tocca per vedere"));
  }
  if (s.error && !s.syncing) {
    header.append(h("div.top-err", { onclick: () => D.sync() }, s.offline ? s.error : `${s.error} — tocca per riprovare`));
  }
}

function render() {
  drawHeader();
  const navOn = SUB.has(tab) ? "dettagli" : tab;
  fill(nav, ...TABS.map((t) => h("button" + (t.id === navOn ? ".on" : ""), { onclick: () => setTab(t.id), "data-tab": t.id },
    h("span.ti", {}, t.icon), h("span.tl", {}, t.label))));
  const rerender = () => render();
  const y0 = window.scrollY;
  main.className = tab === "home" ? "home" : "";
  if (tab === "home") Home.render(main, rerender, setTab);
  else if (tab === "dettagli") Dettagli.render(main, rerender, setTab);
  else if (tab === "mese") Mese.render(main, rerender);
  else if (tab === "anno") Anno.render(main, rerender, goMonth);
  else if (tab === "comuni") Comuni.render(main, rerender);
  else if (SUB.has(tab)) Dettagli.renderPage(tab, main, rerender, setTab);
  else settingsView(main, rerender, { version: APP_VERSION, checkUpdate, restartSetup });
  foldCards(main, tab);
  window.scrollTo(0, y0);
}

function restartSetup() {
  fill(app, h("main.setup"));
  wizard(app.firstChild, start);
}

// ---------------------------------------------------------------- aggiornamenti dell'app (un tocco, come sul PC)
async function checkUpdate(manual = false) {
  try {
    const r = await fetch(`version.json?t=${Date.now()}`, { cache: "no-store" });
    const j = await r.json();
    const newer = cmp(j.version, APP_VERSION) > 0;
    if (newer) showUpdate(j);
    else if (manual) fill(updBar, );
    return { newer, version: j.version };
  } catch {
    if (manual) toast("Impossibile controllare gli aggiornamenti (sei offline?)", "error");
    return null;
  }
}
const cmp = (a, b) => {
  const pa = String(a).split(".").map(Number), pb = String(b).split(".").map(Number);
  for (let i = 0; i < 3; i++) if ((pa[i] || 0) !== (pb[i] || 0)) return (pa[i] || 0) - (pb[i] || 0);
  return 0;
};
function showUpdate(j) {
  fill(updBar, h("div.upd", {}, h("div", {}, h("b", {}, `Nuova versione ${j.version}`),
    j.notes ? h("div.small", {}, j.notes) : null),
  h("button.btn.primary", { onclick: installUpdate }, "Aggiorna")));
}
async function installUpdate() {
  fill(updBar, h("div.upd", {}, "Aggiornamento in corso…"));
  try {
    const keys = await caches.keys();
    await Promise.all(keys.filter((k) => k.startsWith("cashflow-")).map((k) => caches.delete(k)));
    const reg = await navigator.serviceWorker?.getRegistration();
    await reg?.update().catch(() => {});
  } catch { /* */ }
  location.reload();
}

// ---------------------------------------------------------------- avvio
function start() {
  fill(app, header, updBar, main, nav);
  render();
  D.sync().then(startupNotice);
  wire();
}

/** All'apertura: dice se è tutto aggiornato o cosa non è ancora stato scritto negli Excel. */
function startupNotice() {
  const s = D.status;
  if (s.error) return;          // l'errore è già in evidenza in alto
  const pend = D.notWrittenCount();
  const other = D.otherPendingCount();
  if (pend) {
    toast(`⏳ ${pend} ${pend === 1 ? "voce non ancora scritta" : "voci non ancora scritte"} negli Excel`
      + (other ? ` (${other} dall'altro telefono)` : "") + ": le vedi già qui, il PC le scrive appena è acceso.", "warn", 6000);
  } else if (s.otherError) {
    toast(`Dati aggiornati, ma il foglio dell'altra persona non risponde: ${s.otherError}`, "warn", 6000);
  } else {
    const cd = D.copyDate();
    toast(`✅ Tutto aggiornato${cd ? ` · dati del PC del ${fmtDate(cd)}` : ""}`, "ok", 3500);
  }
  // budget del mese (a gradini) e scadenze in arrivo, uno dopo l'altro
  notices().concat(noticesFunzioni()).forEach(([msg, kind], i) => setTimeout(() => toast(msg, kind, 5000), 3800 + i * 5300));
}

async function boot() {
  noZoom();
  pullToRefresh();
  if ("serviceWorker" in navigator) navigator.serviceWorker.register("sw.js").catch(() => {});
  // chiede al telefono di non cancellare mai i dati dell'app (codice, nome, voci non ancora inviate)
  try { navigator.storage?.persist?.(); } catch { /* */ }
  D.onChange((what) => (what === "status" ? drawHeader() : render()));
  if (!D.isLinked()) { restartSetup(); return; }
  L.wireLock(() => { D.resetAll(); restartSetup(); });
  start();
}

// ---------------------------------------------------------------- niente zoom, «tira giù per aggiornare»
function noZoom() {
  // iOS ignora a volte user-scalable=no: si bloccano anche i gesti di pizzico e il doppio tocco
  for (const ev of ["gesturestart", "gesturechange", "gestureend"]) {
    document.addEventListener(ev, (e) => e.preventDefault(), { passive: false });
  }
  document.addEventListener("touchmove", (e) => { if (e.touches.length > 1) e.preventDefault(); }, { passive: false });
}

/** Tirando giù la pagina quando è in cima: rilegge i dati dal foglio e controlla gli aggiornamenti
 *  (come il pulsante ⟳). */
function pullToRefresh() {
  const ind = h("div.ptr", {}, h("span.ptr-icon", {}, "⟳"), h("span.ptr-text", {}, "Tira per aggiornare"));
  document.body.append(ind);
  const LIMIT = 80;
  let y0 = null, dy = 0;
  const blocked = () => document.querySelector(".sheet-wrap, .lock") || window.scrollY > 0;
  window.addEventListener("touchstart", (e) => {
    y0 = !blocked() && e.touches.length === 1 ? e.touches[0].clientY : null;
    dy = 0;
  }, { passive: true });
  window.addEventListener("touchmove", (e) => {
    if (y0 == null) return;
    dy = e.touches[0].clientY - y0;
    if (dy <= 0 || window.scrollY > 0) { ind.style.transform = ""; ind.classList.remove("show"); return; }
    const d = Math.min(dy * 0.5, LIMIT + 20);
    ind.classList.add("show");
    ind.style.transform = `translate(-50%, ${d}px)`;
    ind.querySelector(".ptr-icon").style.transform = `rotate(${d * 4}deg)`;
    ind.querySelector(".ptr-text").textContent = dy * 0.5 >= LIMIT ? "Rilascia per aggiornare" : "Tira per aggiornare";
  }, { passive: true });
  window.addEventListener("touchend", async () => {
    if (y0 == null) return;
    const go = dy * 0.5 >= LIMIT;
    y0 = null;
    if (!go) { ind.classList.remove("show"); ind.style.transform = ""; return; }
    ind.classList.add("busy");
    ind.querySelector(".ptr-text").textContent = "Aggiorno…";
    await Promise.all([D.sync(), checkUpdate()]);
    const s = D.status;
    ind.querySelector(".ptr-text").textContent = s.error ? (s.offline ? "Nessuna connessione" : "Foglio non raggiungibile")
      : "Dati aggiornati ✓";
    setTimeout(() => { ind.classList.remove("show", "busy"); ind.style.transform = ""; }, 900);
  });
}

let wired = false;
function wire() {
  if (wired) return;
  wired = true;
  checkUpdate();
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "visible") { checkUpdate(); D.sync(); }
  });
  window.addEventListener("online", () => D.sync());
  setInterval(() => { if (document.visibilityState === "visible") D.sync(); }, 60000);
}

boot();
