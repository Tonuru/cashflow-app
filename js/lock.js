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
    allowCredentials: [{ type: "public-key", id: unb64(s.id), transports: ["internal", "hybrid"] }],
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
  const btn = h("button.btn.primary.big", {}, "Sblocca con Face ID");
  const wrap = h("div.lock", {}, h("div.lock-box", {}, h("div.logo", {}, h("img", { src: "icons/logo.png", alt: "" })), h("h2", {}, "Cashflow"),
    h("p.muted", {}, "Bloccato con Face ID · tocca per sbloccare"), btn, msg,
    h("button.btn.linkish", { onclick: async () => {
      if (confirm("Senza Face ID puoi solo ricollegare il telefono da capo (serve il codice dal PC). Le voci non ancora inviate andrebbero perse. Continuare?")) {
        disable();
        onReset?.();
        wrap.remove();
        locked = false;
      }
    } }, "Non riesco a sbloccare")));
  document.body.append(wrap);
  document.documentElement.classList.add("is-locked");
  let busy = false;
  const unlock = () => {
    wrap.remove();
    document.documentElement.classList.remove("is-locked");
    locked = false;
    for (const [ev, fn] of listeners) window.removeEventListener(ev, fn);
  };
  const tryIt = async (auto = false) => {
    if (busy || !locked) return;
    busy = true;
    if (!auto) fill(msg);
    btn.disabled = true;
    try {
      if (await verify()) unlock();
    } catch (e) {
      // il tentativo automatico può essere rifiutato da iOS: niente messaggio, basta un tocco ovunque
      if (!auto) fill(msg, e.name === "NotAllowedError" ? "Annullato: tocca per riprovare." : e.message);
    } finally { busy = false; btn.disabled = false; }
  };
  btn.onclick = (e) => { e.stopPropagation(); tryIt(false); };
  // un tocco in qualsiasi punto della schermata fa partire Face ID
  wrap.addEventListener("click", (e) => { if (!e.target.closest(".linkish")) tryIt(false); });
  // Face ID parte da solo appena l'app è aperta e in primo piano (subito, e di nuovo quando prende il focus)
  const listeners = [["focus", () => tryIt(true)], ["pageshow", () => tryIt(true)]];
  for (const [ev, fn] of listeners) window.addEventListener(ev, fn);
  tryIt(true);
  setTimeout(() => tryIt(true), 700);
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
