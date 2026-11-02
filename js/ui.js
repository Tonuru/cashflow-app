// Piccoli strumenti per costruire l'interfaccia (niente framework).
import { fmtEur, MESI, MESI_BREVI } from "./model.js";

export function h(tag, attrs = {}, ...kids) {
  const [name, ...cls] = tag.split(".");
  const el = document.createElement(name || "div");
  if (cls.length) el.className = cls.join(" ");
  for (const [k, v] of Object.entries(attrs || {})) {
    if (v == null || v === false) continue;
    if (k.startsWith("on")) el.addEventListener(k.slice(2), v);
    else if (k === "style" && typeof v === "object") Object.assign(el.style, v);
    else if (k === "html") el.innerHTML = v;
    else if (k === "class") el.className += " " + v;
    else if (k in el && typeof v !== "string") el[k] = v;
    else el.setAttribute(k, v === true ? "" : v);
  }
  for (const k of kids.flat(Infinity)) {
    if (k == null || k === false) continue;
    el.append(k instanceof Node ? k : document.createTextNode(String(k)));
  }
  return el;
}
export const svg = (tag, attrs = {}, ...kids) => {
  const el = document.createElementNS("http://www.w3.org/2000/svg", tag);
  for (const [k, v] of Object.entries(attrs)) if (v != null) el.setAttribute(k, v);
  for (const k of kids.flat()) if (k) el.append(k);
  return el;
};

export const C = {
  green: "#3DD68C", red: "#FF6B6B", amber: "#F5B83D", accent: "#4C8DFF", muted: "#9AA6B4", text: "#F2F5F8",
  violet: "#D9A8FF", violetBg: "#2A1F3D", greenSoft: "#173326", redSoft: "#3A1E22", track: "#2A323E",
};
export const moneyColor = (v) => (v > 0.004 ? C.green : v < -0.004 ? C.red : C.text);

export function toast(msg, kind = "", ms = 0) {
  const t = h("div.toast" + (kind ? "." + kind : ""), { onclick: () => t.remove() }, msg);
  document.body.append(t);
  requestAnimationFrame(() => t.classList.add("show"));
  setTimeout(() => { t.classList.remove("show"); setTimeout(() => t.remove(), 300); }, ms || (kind === "error" ? 5000 : 2600));
}

/** Pannello che sale dal basso. Ritorna {el, close, body}. */
export function sheet(title, { onClose } = {}) {
  const body = h("div.sheet-body");
  const close = () => { wrap.classList.remove("open"); setTimeout(() => wrap.remove(), 250); onClose?.(); };
  const panel = h("div.sheet", {}, h("div.sheet-head", {}, h("div.grab"), h("h3", {}, title),
    h("button.icon-btn.sheet-x", { onclick: close, "aria-label": "Chiudi" }, "✕")), body);
  const wrap = h("div.sheet-wrap", { onclick: (e) => { if (e.target === wrap) close(); } }, panel);
  document.body.append(wrap);
  requestAnimationFrame(() => wrap.classList.add("open"));
  return { el: panel, body, close };
}

export function confirmBox(text, okText = "Conferma", danger = true) {
  return new Promise((res) => {
    const s = sheet(text, { onClose: () => res(false) });
    fill(s.body, h("div.row.gap", {},
      h("button.btn", { onclick: () => { res(false); s.close(); } }, "Annulla"),
      h("button.btn" + (danger ? ".danger" : ".primary"), { onclick: () => { res(true); s.close(); } }, okText)));
  });
}

export function busy(btn, promise, label = "Salvo…") {
  const old = btn.textContent;
  btn.disabled = true;
  btn.textContent = label;
  return promise.finally(() => { btn.disabled = false; btn.textContent = old; });
}

export function dots(n, i) {
  return h("span.dots", {}, Array.from({ length: n }, (_, k) => h("i" + (k === i ? ".on" : ""))));
}

/** Selettore del mese: ‹ [Ottobre 2026] ›; tocco sull'etichetta = calendario. */
export function monthNav(y, m, onPick, { yearOnly = false } = {}) {
  const shift = (d) => {
    if (yearOnly) return onPick(y + d, m);
    let mm = m + d, yy = y;
    if (mm < 1) { mm = 12; yy--; }
    if (mm > 12) { mm = 1; yy++; }
    onPick(yy, mm);
  };
  const label = yearOnly ? String(y) : `${MESI[m - 1]} ${y}`;
  return h("div.monthnav", {},
    h("button.nav", { onclick: () => shift(-1), "aria-label": "Precedente" }, "‹"),
    h("button.pill", { onclick: () => pickMonth(y, m, onPick, yearOnly) }, label, h("span.cal", {}, " 📅")),
    h("button.nav", { onclick: () => shift(1), "aria-label": "Successivo" }, "›"));
}

function pickMonth(y, m, onPick, yearOnly) {
  const s = sheet(yearOnly ? "Scegli l'anno" : "Scegli mese e anno");
  let yy = y;
  const render = () => {
    fill(s.body, 
      h("div.monthnav", {}, h("button.nav", { onclick: () => { yy--; render(); } }, "‹"),
        h("div.pill.static", {}, String(yy)), h("button.nav", { onclick: () => { yy++; render(); } }, "›")),
      yearOnly
        ? h("button.btn.primary.wide", { onclick: () => { s.close(); onPick(yy, m); } }, `Vai al ${yy}`)
        : h("div.mgrid", {}, MESI_BREVI.map((n, i) => h("button.mcell" + (yy === y && i + 1 === m ? ".on" : ""),
          { onclick: () => { s.close(); onPick(yy, i + 1); } }, n))),
      h("button.btn.wide", { onclick: () => { const t = new Date(); s.close(); onPick(t.getFullYear(), t.getMonth() + 1); } }, "Oggi"));
  };
  render();
}

// ---------------------------------------------------------------- grafici
export function donut(items, total, { size = 170, center = "" } = {}) {
  const r = 70, cx = 90, cy = 90, sw = 24, circ = 2 * Math.PI * r;
  const g = svg("svg", { viewBox: "0 0 180 180", width: size, height: size, class: "donut" });
  g.append(svg("circle", { cx, cy, r, fill: "none", stroke: C.track, "stroke-width": sw }));
  const label = svg("text", { x: cx, y: cy - 4, "text-anchor": "middle", class: "d-name" });
  const value = svg("text", { x: cx, y: cy + 16, "text-anchor": "middle", class: "d-val" });
  const reset = () => { label.textContent = center ? "Spese" : ""; value.textContent = center; };
  let off = 0;
  if (total > 0) {
    for (const it of items) {
      const frac = Math.max(0, it.value) / total;
      if (frac <= 0) continue;
      const seg = svg("circle", { cx, cy, r, fill: "none", stroke: it.color, "stroke-width": sw,
        "stroke-dasharray": `${Math.max(frac * circ - 1.5, 0.5)} ${circ}`, "stroke-dashoffset": -off * circ,
        transform: `rotate(-90 ${cx} ${cy})`, class: "seg" });
      const show = () => { label.textContent = it.name.length > 16 ? it.name.slice(0, 15) + "…" : it.name; value.textContent = fmtEur(it.value); };
      seg.addEventListener("pointerenter", show);
      seg.addEventListener("click", (e) => { e.stopPropagation(); show(); it.onclick?.(); });
      seg.addEventListener("pointerleave", reset);
      g.append(seg);
      off += frac;
    }
  }
  reset();
  g.append(label, value);
  return g;
}

/** Barre per mese/anno. series: [{label, a (entrate), b (spese)}]; net: barre del solo rimanente. */
export function bars(series, { net = false, sel = -1, onPick, height = 170 } = {}) {
  const W = 340, H = height, pad = 18, bottom = 20;
  const n = series.length || 1;
  const vals = net ? series.map((s) => s.a - s.b) : series.flatMap((s) => [s.a, s.b]);
  const max = Math.max(1, ...vals.map(Math.abs));
  const hasNeg = net && vals.some((v) => v < 0);
  const plotH = H - bottom - 6;
  const zero = hasNeg ? 6 + plotH / 2 : 6 + plotH;
  const scale = (hasNeg ? plotH / 2 : plotH) / max;
  const g = svg("svg", { viewBox: `0 0 ${W} ${H}`, class: "bars", preserveAspectRatio: "none" });
  g.append(svg("line", { x1: pad / 2, x2: W - pad / 2, y1: zero, y2: zero, stroke: "#2E3744" }));
  const slot = (W - pad) / n;
  series.forEach((s, i) => {
    const x0 = pad / 2 + i * slot;
    if (i === sel) g.append(svg("rect", { x: x0 + 1, y: 2, width: slot - 2, height: H - 4, rx: 4, fill: "#1E2D4A" }));
    const bw = net ? slot * 0.55 : slot * 0.34;
    const draw = (v, x, color) => {
      const hgt = Math.abs(v) * scale;
      g.append(svg("rect", { x, y: v >= 0 ? zero - hgt : zero, width: bw, height: Math.max(hgt, v ? 1 : 0), rx: 2, fill: color }));
    };
    if (net) { const v = s.a - s.b; draw(v, x0 + (slot - bw) / 2, v >= 0 ? C.green : C.red); }
    else { draw(s.a, x0 + slot / 2 - bw - 1, C.green); draw(s.b, x0 + slot / 2 + 1, C.red); }
    const t = svg("text", { x: x0 + slot / 2, y: H - 5, "text-anchor": "middle", class: "bar-lbl" });
    t.textContent = s.label;
    g.append(t);
    if (onPick) {
      const hit = svg("rect", { x: x0, y: 0, width: slot, height: H, fill: "transparent" });
      hit.addEventListener("click", () => onPick(i));
      g.append(hit);
    }
  });
  return g;
}

/** replaceChildren che ignora null/false e appiattisce gli array. */
export function fill(el, ...kids) {
  el.replaceChildren(...kids.flat(Infinity).filter((k) => k != null && k !== false)
    .map((k) => (k instanceof Node ? k : document.createTextNode(String(k)))));
}

// ---------------------------------------------------------------- riquadri apribili
// Ogni riquadro con un titolo si apre e chiude toccando il titolo. All'apertura dell'app sono tutti chiusi
// (lo stato resta solo finché l'app è aperta); i numeri principali (data-keep) restano sempre visibili.
const foldOpen = new Set();
export function foldCards(root, page) {
  for (const card of root.querySelectorAll(":scope > .card")) {
    if (card.dataset.keep != null) continue;
    const title = card.firstElementChild;
    if (!title || !title.classList.contains("card-title")) continue;
    const name = card.dataset.fold || (title.firstElementChild ? title.firstElementChild.textContent : title.textContent);
    const key = `${page}:${name}`;
    card.classList.add("fold");
    card.classList.toggle("folded", !foldOpen.has(key));
    title.setAttribute("role", "button");
    title.addEventListener("click", (e) => {
      if (e.target.closest("button, a, input, select") && !card.classList.contains("folded")) return;
      const open = card.classList.toggle("folded") === false;
      if (open) foldOpen.add(key); else foldOpen.delete(key);
    });
  }
}

// ---------------------------------------------------------------- data con calendario («A · Classico»)
const pad2 = (n) => String(n).padStart(2, "0");
const isoOf = (d) => `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
const itOf = (iso) => (iso ? `${iso.slice(8, 10)}/${iso.slice(5, 7)}/${iso.slice(0, 4)}` : "");
function parseIt(t) {
  const m = String(t || "").trim().match(/^(\d{1,2})[/.\-](\d{1,2})(?:[/.\-](\d{2,4}))?$/);
  if (!m) return null;
  let y = m[3] ? Number(m[3]) : new Date().getFullYear();
  if (y < 100) y += 2000;
  const d = new Date(y, Number(m[2]) - 1, Number(m[1]));
  return d.getMonth() === Number(m[2]) - 1 ? isoOf(d) : null;
}
const CAL_SVG = '<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="#9CC2FF" stroke-width="2" ' +
  'stroke-linecap="round"><rect x="3" y="5" width="18" height="16" rx="3"/><path d="M3 10h18M8 3v4M16 3v4"/>' +
  '<path d="M8 14h.01M12 14h.01M16 14h.01M8 17.5h.01M12 17.5h.01" stroke-width="2.6"/></svg>';

/** Campo data: si scrive a mano (gg/mm/aaaa) oppure si tocca il tasto 📅 per il calendario.
 *  Si usa come un <input type="date">: .value è la data ISO (aaaa-mm-gg) e manda l'evento «change». */
export function dateField(iso, { required = false } = {}) {
  const inp = h("input.datef-in", { type: "text", inputmode: "numeric", placeholder: "gg/mm/aaaa",
    autocomplete: "off", value: itOf(iso), "aria-label": "Data" });
  const btn = h("button.datef-btn", { type: "button", "aria-label": "Apri il calendario", html: CAL_SVG });
  const el = h("div.datef", {}, inp, btn);
  let cur = iso || "";
  const set = (v, fire) => {
    cur = v || "";
    inp.value = itOf(cur);
    inp.classList.remove("bad");
    if (fire) el.dispatchEvent(new Event("change"));
  };
  Object.defineProperty(el, "value", { get: () => cur, set: (v) => set(v, false) });
  el.required = required;
  inp.addEventListener("change", () => {
    const v = parseIt(inp.value);
    if (v) set(v, true);
    else if (!inp.value.trim()) { cur = ""; el.dispatchEvent(new Event("change")); }
    else inp.classList.add("bad");
  });
  btn.addEventListener("click", (e) => { e.preventDefault(); e.stopPropagation(); calendarPop(cur, (v) => set(v, true)); });
  el.open = () => calendarPop(cur, (v) => set(v, true));
  return el;
}

/** Calendario a comparsa: griglia del mese, ‹ ›, tocco sul mese = elenco dei mesi, in fondo Oggi / Ieri / Chiudi. */
export function calendarPop(iso, onPick) {
  const today = new Date();
  const todayIso = isoOf(today);
  const sel = iso || todayIso;
  let y = Number(sel.slice(0, 4)), m = Number(sel.slice(5, 7)) - 1;
  let months = false;
  const close = () => { wrap.classList.remove("open"); setTimeout(() => wrap.remove(), 200); };
  const pick = (v) => { close(); onPick(v); };
  const box = h("div.cal");
  const wrap = h("div.cal-wrap", { onclick: (e) => { if (e.target === wrap) close(); } }, box);
  const shift = (d) => { m += d; if (m < 0) { m = 11; y--; } if (m > 11) { m = 0; y++; } render(); };
  const render = () => {
    const head = months
      ? h("div.cal-head", {}, h("button.cal-ar", { onclick: () => { y--; render(); } }, "‹"),
        h("button.cal-title", { onclick: () => { months = false; render(); } }, `${y} ▴`),
        h("button.cal-ar", { onclick: () => { y++; render(); } }, "›"))
      : h("div.cal-head", {}, h("button.cal-ar", { onclick: () => shift(-1), "aria-label": "Mese prima" }, "‹"),
        h("button.cal-title", { onclick: () => { months = true; render(); } }, `${MESI[m]} ${y} ▾`),
        h("button.cal-ar", { onclick: () => shift(1), "aria-label": "Mese dopo" }, "›"));
    let grid;
    if (months) {
      grid = h("div.cal-months", {}, MESI.map((n, i) => h("button.cal-m" + (i === m ? ".on" : ""),
        { onclick: () => { m = i; months = false; render(); } }, n)));
    } else {
      const first = new Date(y, m, 1);
      const start = (first.getDay() + 6) % 7;            // lunedì = 0
      const cells = [];
      for (let i = 0; i < 42; i++) {
        const d = new Date(y, m, 1 - start + i);
        const v = isoOf(d);
        const wd = (d.getDay() + 6) % 7;
        const cls = ["cal-d"];
        if (d.getMonth() !== m) cls.push("out");
        else if (wd >= 5) cls.push("we");
        if (v === todayIso) cls.push("today");
        if (v === sel) cls.push("sel");
        cells.push(h("button." + cls.join("."), { onclick: () => pick(v) }, String(d.getDate())));
      }
      grid = h("div.cal-grid", {}, ["L", "M", "M", "G", "V", "S", "D"].map((w, i) => h("div.cal-wd" + (i >= 5 ? ".we" : ""), {}, w)),
        cells);
    }
    const yest = new Date(today); yest.setDate(today.getDate() - 1);
    fill(box, head, grid, h("div.cal-foot", {},
      h("button.cal-chip.on", { onclick: () => pick(todayIso) }, "Oggi"),
      h("button.cal-chip", { onclick: () => pick(isoOf(yest)) }, "Ieri"),
      h("span", { style: { flex: "1" } }),
      h("button.cal-chip", { onclick: close }, "Chiudi")));
  };
  render();
  document.body.append(wrap);
  requestAnimationFrame(() => wrap.classList.add("open"));
  return { close };
}
