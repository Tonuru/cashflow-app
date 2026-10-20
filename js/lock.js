// Blocco con Face ID (o Touch ID / codice dell'iPhone) tramite una passkey del telefono (WebAuthn).
// La passkey resta nel portachiavi dell'iPhone: l'app chiede solo «sei tu?» e iOS mostra Face ID.
import { h, fill } from "./ui.js";

const K = "cf.lock";
function load() { try { return JSON.parse(localStorage.getItem(K) || "null") || {}; } catch { return {}; } }
function save(v) { try { localStorage.setItem(K, JSON.stringify(v)); } catch { /* */ } }

export const lockSettings = () => ({ on: false, after: 60, ...load() });
const b64 = (buf) => btoa(String.fromCharCode(...new Uint8Array(buf)));
const unb64 = (s) => Uint8Array.from(atob(s), (c) => c.charCodeAt(0));
const rnd = (n) => crypto.getRandomValues(new Uint8Array(n));

export async function supported() {
  try {
    return !!(window.PublicKeyCredential
      && await PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable());
  } catch { return false; }
}

/** Crea la passkey (iOS chiede il permesso e Face ID). */
export async function enable(name) {
  const cred = await navigator.credentials.create({ publicKey: {
    challenge: rnd(32),
    rp: { name: "Cashflow", id: location.hostname },
    user: { id: rnd(16), name: name || "Cashflow", displayName: `Cashflow ${name || ""}`.trim() },
    pubKeyCredParams: [{ type: "public-key", alg: -7 }, { type: "public-key", alg: -257 }],
    authenticatorSelection: { authenticatorAttachment: "platform", userVerification: "required", residentKey: "preferred" },
    timeout: 60000,
  } });
  if (!cred) throw new Error("Face ID non attivato.");
  save({ ...lockSettings(), on: true, id: b64(cred.rawId) });
}

/** Chiede Face ID. Ritorna true se è il proprietario. */
export async function verify() {
  const s = lockSettings();
  if (!s.id) return true;
  const r = await navigator.credentials.get({ publicKey: {
    challenge: rnd(32), rpId: location.hostname, userVerification: "required", timeout: 60000,
    // solo «internal»: la passkey è su questo iPhone. Con «hybrid» iOS apre il riquadro di scelta
    // («Usa la passkey» / altro dispositivo) invece di andare dritto a Face ID
    allowCredentials: [{ type: "public-key", id: unb64(s.id), transports: ["internal"] }],
  } });
  return !!r;
}

export function disable() { save({ ...lockSettings(), on: false, id: null }); }
export function setAfter(sec) { save({ ...lockSettings(), after: sec }); }

// ---------------------------------------------------------------- schermata di blocco
let hiddenAt = 0;
let locked = false;

export function needsLock() {
  const s = lockSettings();
  return !!(s.on && s.id);
}

/** Mostra il blocco sopra l'app finché Face ID non va a buon fine. */
export function showLock(onReset) {
  if (locked) return;
  locked = true;
  const msg = h("div.lock-msg");
  const now = new Date();
  const ora = now.toLocaleTimeString("it-IT", { hour: "2-digit", minute: "2-digit" });
  const giorno = now.toLocaleDateString("it-IT", { weekday: "long", day: "numeric", month: "long" });
  const ring = h("div.lock-ring", {}, faceIcon());
  const reset = h("button.lock-reset", { type: "button", onclick: async (e) => {
    e.stopPropagation();
    if (confirm("Senza Face ID puoi solo ricollegare il telefono da capo (serve il codice dal PC). Le voci non ancora inviate andrebbero perse. Continuare?")) {
      disable();
      onReset?.();
      wrap.remove();
      document.documentElement.classList.remove("is-locked");
      locked = false;
    }
  } }, "Non riesci a entrare?");
  const wrap = h("div.lock", { role: "button", "aria-label": "Premi per accedere con Face ID" },
    h("div.lock-glow.g1"), h("div.lock-glow.g2"),
    h("div.lock-top", {}, h("div.lock-time", {}, ora), h("div.lock-date", {}, giorno)),
    h("div.lock-box", {},
      h("div.lock-brand", {}, h("img", { src: "icons/logo.png", alt: "" }), h("span", {}, "Cashflow")),
      ring,
      h("div.lock-cta", {}, "Premi per accedere"),
      h("div.lock-hint", {}, "Tocca un punto qualsiasi dello schermo"),
      msg),
    reset);
  document.body.append(wrap);
  document.documentElement.classList.add("is-locked");
  let busy = false;
  const unlock = () => {
    wrap.classList.add("out");
    document.documentElement.classList.remove("is-locked");
    locked = false;
    setTimeout(() => wrap.remove(), 350);
  };
  // Face ID parte al tocco: così iOS non mostra il riquadro «Usa la passkey»
  const tryIt = async () => {
    if (busy || !locked) return;
    busy = true;
    fill(msg);
    wrap.classList.add("busy");
    try {
      if (await verify()) { ring.classList.add("ok"); unlock(); }
    } catch (e) {
      fill(msg, e.name === "NotAllowedError" ? "Annullato · tocca per riprovare" : e.message);
    } finally { busy = false; wrap.classList.remove("busy"); }
  };
  wrap.addEventListener("click", () => tryIt());
}

/** Icona Face ID disegnata (angoli, occhi, naso, sorriso). */
function faceIcon() {
  const ns = "http://www.w3.org/2000/svg";
  const svg = document.createElementNS(ns, "svg");
  svg.setAttribute("viewBox", "0 0 64 64");
  svg.setAttribute("class", "lock-face");
  svg.innerHTML = `<g fill="none" stroke="currentColor" stroke-width="4" stroke-linecap="round" stroke-linejoin="round">
    <path d="M6 20V12a6 6 0 0 1 6-6h8M44 6h8a6 6 0 0 1 6 6v8M58 44v8a6 6 0 0 1-6 6h-8M20 58h-8a6 6 0 0 1-6-6v-8"/>
    <path d="M22 24v5M42 24v5M32 24v13a3 3 0 0 1-3 3h-1"/><path d="M23 45c5 4 13 4 18 0"/></g>`;
  return svg;
}

/** Blocca all'avvio e quando l'app torna in primo piano dopo il tempo scelto. */
export function wireLock(onReset) {
  if (needsLock()) showLock(onReset);
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "hidden") { hiddenAt = Date.now(); return; }
    const s = lockSettings();
    if (needsLock() && hiddenAt && Date.now() - hiddenAt >= (s.after || 0) * 1000) showLock(onReset);
  });
}
