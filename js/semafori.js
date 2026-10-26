// Semafori dei file sul telefono: chi sta scrivendo gli Excel adesso e quante voci aspettano un PC acceso.
// Il telefono non scrive mai gli Excel: mette le voci in coda; un PC acceso le scrive con il semaforo del file.
import * as D from "./data.js";
import { h } from "./ui.js";

const hhmm = (ms) => { const d = new Date(Number(ms)); return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`; };
const who = (chi) => String(chi || "").replace("@", " sul PC ");

/** Stato di una riga: [colore, testo]. */
export function stato(r) {
  if (r.lock) return ["red", `✍️ ${who(r.lock.chi)} sta scrivendo (fino alle ${hhmm(r.lock.scade)}): le voci nuove aspettano in coda`];
  if (r.coda == null) return ["grey", "collega il suo foglio per vederlo"];
  if (r.coda > 0) return ["amber", `⏳ ${r.coda} ${r.coda === 1 ? "voce aspetta" : "voci aspettano"} un PC acceso`];
  return ["green", "tutto scritto negli Excel"];
}

/** Riquadro con i tre semafori (Impostazioni). */
export function semaforiCard() {
  const s = D.semafori();
  return h("div.card", { "data-keep": "" }, h("div.card-title", {}, "🚦 Semafori dei file"),
    h("div.sem-list", {}, s.righe.map((r) => {
      const [col, txt] = stato(r);
      return h("div.sem-row", {}, h("i.sem-dot." + col), h("div", {}, h("b", {}, r.nome), h("div.small.muted", {}, txt)));
    })),
    h("div.muted.small", {}, s.letto ? `Controllati alle ${hhmm(s.letto)}. Il telefono non scrive mai gli Excel: mette le voci `
      + "in coda e un PC acceso le scrive, una alla volta per file." : "Stato dei semafori non ancora letto (serve lo script v3 nel foglio)."));
}

/** Una riga sola, dentro le finestre per inserire: il semaforo del file su cui finirà la voce. */
export function semaforoLine(kind) {
  const s = D.semafori();
  const r = s.righe.find((x) => x.key === (kind === "comune" ? "comune" : "mio"));
  if (!r || !s.letto) return null;
  const [col, txt] = stato(r);
  return h("div.sem-line", {}, h("i.sem-dot." + col), h("span.small", {}, `${r.nome}: ${txt}`));
}

/** Tre pallini per la barra in alto. */
export function semaforiDots() {
  const s = D.semafori();
  if (!s.letto) return null;
  return h("span.sem-dots", { title: "Semafori dei file" }, s.righe.map((r) => h("i.sem-dot." + stato(r)[0])));
}
