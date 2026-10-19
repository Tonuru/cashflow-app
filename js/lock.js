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
    h("p.muted", {}, "Bloccato con Face ID"), btn, msg,
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
  const tryIt = async () => {
    fill(msg);
    btn.disabled = true;
    try {
      if (await verify()) {
        wrap.remove();
        document.documentElement.classList.remove("is-locked");
        locked = false;
        return;
      }
    } catch (e) {
      fill(msg, e.name === "NotAllowedError" ? "Annullato: tocca il pulsante per riprovare." : e.message);
    } finally { btn.disabled = false; }
  };
  btn.onclick = tryIt;
  // iOS vuole un tocco per Face ID: si prova subito, altrimenti resta il pulsante
  setTimeout(tryIt, 300);
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
