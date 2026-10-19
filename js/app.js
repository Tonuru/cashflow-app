// Avvio dell'app e navigazione tra le schede.
import * as D from "./data.js";
import * as G from "./graph.js";
import { h, toast, fill } from "./ui.js";
import * as Mese from "./views/mese.js";
import * as Anno from "./views/anno.js";
import * as Comuni from "./views/comuni.js";
import { wizard, settingsView } from "./views/setup.js";

export const APP_VERSION = "1.0.0";

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
  fill(header, h("div.top-title", {}, h("b", {}, "Cashflow"), h("span", {}, " · " + title)),
    h("button.icon-btn", { onclick: () => D.sync(), "aria-label": "Aggiorna i dati" }, st));
  if (s.error && !s.syncing) {
    header.append(h("div.top-err", { onclick: () => (s.needLogin ? G.login("") : D.sync()) },
      s.needLogin ? "Sessione scaduta — tocca per accedere di nuovo" : `${s.error} — tocca per riprovare`));
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
}

async function boot() {
  if ("serviceWorker" in navigator) navigator.serviceWorker.register("sw.js").catch(() => {});
  G.configure({ clientId: D.settings.clientId, tenant: D.settings.tenant });
  D.onChange((what) => (what === "status" ? drawHeader() : render()));
  const res = await G.handleRedirect();
  if (res && res !== "ok" && res !== "login_required") toast(res, "error");
  if (res === "ok") try { sessionStorage.removeItem("cf.silent"); } catch { /* */ }

  if (!D.isConfigured()) { restartSetup(); return; }
  // sessione scaduta (dopo 24 ore): nuovo accesso automatico senza chiedere nulla, una volta
  if (!G.isLoggedIn() && res !== "login_required") {
    let tried = false;
    try { tried = sessionStorage.getItem("cf.silent") === "1"; sessionStorage.setItem("cf.silent", "1"); } catch { /* */ }
    if (!tried && navigator.onLine) { G.login("none"); return; }
  }
  start();
  checkUpdate();
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "visible") { checkUpdate(); D.sync(); }
  });
}

boot();
