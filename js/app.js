// Avvio dell'app e navigazione tra le schede.
import * as D from "./data.js";
import { h, toast, fill } from "./ui.js";
import * as Mese from "./views/mese.js";
import * as Anno from "./views/anno.js";
import * as Comuni from "./views/comuni.js";
import { wizard, settingsView, conflictsSheet } from "./views/setup.js";
import { fmtDate } from "./model.js";
import * as L from "./lock.js";

export const APP_VERSION = "1.2.2";

const TABS = [
  { id: "mese", label: "Mese", icon: "📅" },
  { id: "anno", label: "Panoramica", icon: "📊" },
  { id: "comuni", label: "Comuni", icon: "👥" },
  { id: "impostazioni", label: "Impostazioni", icon: "⚙️" },
];
let tab = "mese";
try { tab = sessionStorage.getItem("cf.tab") || "mese"; } catch { /* */ }

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

function drawHeader() {
  const s = D.status;
  const st = s.syncing ? h("span.sync.spin", {}, "⟳") : s.error ? h("span.sync.err", {}, "⚠︎") : h("span.sync", {}, "⟳");
  const title = TABS.find((t) => t.id === tab)?.label || "";
  const pend = D.pendingOps().length;
  const cd = D.copyDate();
  const info = [cd ? `dati del PC del ${fmtDate(cd)}` : "dati del PC non ancora arrivati",
    pend ? `${pend} in attesa del PC` : null, D.unsentCount() ? `${D.unsentCount()} da inviare` : null].filter(Boolean).join(" · ");
  fill(header, h("div.top-title", {}, h("b", {}, "Cashflow"), h("span", {}, " · " + title),
    h("div.top-info", {}, info)),
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
  fill(nav, ...TABS.map((t) => h("button" + (t.id === tab ? ".on" : ""), { onclick: () => setTab(t.id) },
    h("span.ti", {}, t.icon), h("span.tl", {}, t.label))));
  const rerender = () => render();
  const y0 = window.scrollY;
  if (tab === "mese") Mese.render(main, rerender);
  else if (tab === "anno") Anno.render(main, rerender, goMonth);
  else if (tab === "comuni") Comuni.render(main, rerender);
  else settingsView(main, rerender, { version: APP_VERSION, checkUpdate, restartSetup });
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
  D.sync();
  wire();
}

async function boot() {
  if ("serviceWorker" in navigator) navigator.serviceWorker.register("sw.js").catch(() => {});
  // chiede al telefono di non cancellare mai i dati dell'app (codice, nome, voci non ancora inviate)
  try { navigator.storage?.persist?.(); } catch { /* */ }
  D.onChange((what) => (what === "status" ? drawHeader() : render()));
  if (!D.isLinked()) { restartSetup(); return; }
  L.wireLock(() => { D.resetAll(); restartSetup(); });
  start();
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
