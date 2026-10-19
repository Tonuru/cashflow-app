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

export function toast(msg, kind = "") {
  const t = h("div.toast" + (kind ? "." + kind : ""), {}, msg);
  document.body.append(t);
  requestAnimationFrame(() => t.classList.add("show"));
  setTimeout(() => { t.classList.remove("show"); setTimeout(() => t.remove(), 300); }, kind === "error" ? 5000 : 2600);
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
