// Aggiunta veloce dal telefono: Mia / Comune, «le tue solite» in un tocco, importo con il tastierino sempre a
// vista, categoria a bottoni (quella suggerita per prima), le altre informazioni in una riga sola: toccandone una
// il tastierino lascia il posto alla tastiera del telefono, finita la scrittura torna il tastierino.
import * as D from "./data.js";
import * as M from "./model.js";
import { h, fill, toast, busy } from "./ui.js";
import { movimentoSheet, comuneSheet, shrinkPhoto } from "./forms.js";
import { semaforoLine } from "./semafori.js";

const ICONS = [[/alimentar|supermerc|spesa$/i, "🛒"], [/bar|caff/i, "☕"], [/ristor|pizz|cen[ae]|pasti/i, "🍕"],
  [/trasport|benzin|carbur|auto/i, "⛽"], [/casa|affitt|mutu/i, "🏠"], [/bollett|utenz|luce|gas/i, "💡"],
  [/salut|farmac|medic/i, "💊"], [/svago|hobby|cinema/i, "🎬"], [/abbonam|telefon/i, "📱"], [/regal/i, "🎁"],
  [/vestit|abbigl/i, "👕"], [/viagg|vacanz/i, "✈️"], [/sport|palestr/i, "🏋️"], [/animal/i, "🐾"], [/spese prof/i, "💼"]];
export const catIcon = (c) => (ICONS.find(([re]) => re.test(c || "")) || [null, "•"])[1];

const daysAgo = (iso) => Math.round((Date.parse(M.todayIso() + "T00:00:00Z") - Date.parse(iso + "T00:00:00Z")) / 864e5);

/** Voci di partenza: le mie spese (non le quote comuni) o le spese comuni, di tutti gli anni. */
function history(kind) {
  if (kind === "comune") return D.years("comune").flatMap((y) => D.comuneMovs(y)).filter((m) => (m.tipo || M.T.SPESA) === M.T.SPESA);
  return D.years("personal").flatMap((y) => D.personalMovs(y)).filter((m) => (m.tipo || M.T.USCITA) === M.T.USCITA);
}

/** «Le tue solite»: le spese ripetute più spesso negli ultimi 4 mesi, con l'ultimo importo. */
export function solite(kind, n = 8) {
  const groups = new Map();
  for (const m of history(kind)) {
    if (!m.data || daysAgo(m.data) > 120 || !m.categoria) continue;
    const key = M.nomeChiave(m.descrizione) || "";
    if (!key) continue;
    const k = `${key}|${m.categoria}`;
    const g = groups.get(k) || { n: 0, last: null };
    g.n += 1;
    if (!g.last || m.data >= g.last.data) g.last = m;
    groups.set(k, g);
  }
  return [...groups.values()].filter((g) => g.n >= 2).sort((a, b) => b.n - a.n || b.last.data.localeCompare(a.last.data))
    .slice(0, n).map((g) => g.last);
}

/** Categorie in ordine d'uso (ultimi 6 mesi), poi le altre. */
function catOrder(kind, cats) {
  const count = new Map();
  for (const m of history(kind)) if (m.data && daysAgo(m.data) <= 180 && m.categoria) count.set(m.categoria, (count.get(m.categoria) || 0) + 1);
  return [...cats].sort((a, b) => (count.get(b) || 0) - (count.get(a) || 0));
}

/** Categoria per la descrizione: quella usata l'ultima volta con la stessa (o simile) descrizione. */
export function guessCat(kind, descr) {
  const d = String(descr || "").trim().toLowerCase();
  if (!d) return "";
  const key = M.nomeChiave(d);
  const hist = history(kind).filter((m) => m.categoria).sort((a, b) => (b.data || "").localeCompare(a.data || ""));
  const same = hist.find((m) => (m.descrizione || "").trim().toLowerCase() === d)
    || (key && hist.find((m) => M.nomeChiave(m.descrizione) === key));
  return same ? same.categoria : "";
}

export function quickAdd(kind0 = "personal", { onDone } = {}) {
  const info = D.comuneInfo();
  let kind = kind0 === "comune" && info ? "comune" : "personal";
  const year = new Date().getFullYear();
  const st = { amount: "", cat: "", catAuto: false, descr: "", data: M.todayIso(), sub: "", metodo: "", note: "", tag: "",
    foto: null, payer: "", div: "def", editing: null };
  const me = D.meInComune();
  const wrap = h("div.qa-wrap");
  const panel = h("div.qa");
  wrap.append(panel);
  const close = () => { wrap.classList.remove("open"); setTimeout(() => wrap.remove(), 220); };
  wrap.addEventListener("click", (e) => { if (e.target === wrap) close(); });
  document.body.append(wrap);
  requestAnimationFrame(() => wrap.classList.add("open"));

  const value = () => M.parseAmount(st.amount.replace(".", ",")) || 0;
  const cats = () => (kind === "comune" ? D.comuneCategorie(year) : D.categorie(year).filter((c) => c.tipo === M.T.USCITA))
    .map((c) => c.categoria);
  const quota = () => {
    const qdef = Number(info?.quota_a ?? 50);
    const qa = { def: qdef, "50": 50, a: 100, b: 0 }[st.div];
    return qa;
  };
  const myShare = () => {
    const qa = quota();
    const mine = me === info.persona_a ? qa : 100 - qa;
    return value() * mine / 100;
  };

  // ---------------------------------------------------------------- tastierino
  const press = (k) => {
    if (k === "⌫") st.amount = st.amount.slice(0, -1);
    else if (k === ",") { if (!st.amount.includes(",")) st.amount = (st.amount || "0") + ","; }
    else {
      const [i, dec] = st.amount.split(",");
      if (dec !== undefined && dec.length >= 2) return;
      if (dec === undefined && (i || "").length >= 6) return;
      st.amount = st.amount === "0" ? k : st.amount + k;
    }
    draw();
  };

  // ---------------------------------------------------------------- campi di testo (tastiera del telefono)
  const FIELDS = {
    descr: { label: "Descrizione", ph: "es. Supermercato", list: () => M.suggestions(history(kind), "descrizione", null, 40) },
    sub: { label: "Specifica", ph: "es. Gas", list: () => M.subcategories(D.categorie(year), history("personal"), M.T.USCITA, st.cat) },
    note: { label: "Note", ph: "facoltative" },
    tag: { label: "Etichetta", ph: "es. Viaggio Lisbona", list: () => D.tags() },
  };
  const editText = (f) => { st.editing = f; draw(); };
  const doneText = () => {
    if (st.editing === "descr" && (!st.cat || st.catAuto)) {
      const g = guessCat(kind, st.descr);
      if (g) { st.cat = g; st.catAuto = true; }
    }
    st.editing = null;
    draw();
  };

  const fileIn = h("input", { type: "file", accept: "image/*", style: { display: "none" } });
  fileIn.onchange = async () => {
    const f = fileIn.files && fileIn.files[0];
    if (!f) return;
    try { st.foto = await shrinkPhoto(f); } catch (e) { toast("Non riesco a leggere la foto: " + e.message, "error"); }
    fileIn.value = "";
    draw();
  };
  const dateIn = h("input.qa-date", { type: "date", value: st.data });
  dateIn.addEventListener("change", () => { st.data = dateIn.value || M.todayIso(); draw(); });

  // ---------------------------------------------------------------- salvataggio
  const err = h("div.form-err");
  const save = async () => {
    const imp = value();
    if (!imp) { err.textContent = "Scrivi l'importo."; return; }
    if (!st.cat && kind === "personal") { err.textContent = "Scegli la categoria."; return; }
    const allegato = st.foto ? M.receiptPath(st.data, st.descr) : "";
    if (kind === "personal") {
      await D.addMov("personal", { data: st.data, tipo: M.T.USCITA, importo: imp, categoria: st.cat, sottocategoria: st.sub.trim(),
        descrizione: st.descr.trim(), metodo: st.metodo, note: st.note.trim(), etichetta: M.normTag(st.tag),
        ...(allegato ? { allegato } : {}), origine: "iPhone" });
    } else {
      const qa = quota();
      await D.addMov("comune", { data: st.data, tipo: M.T.SPESA, importo: imp, categoria: st.cat, descrizione: st.descr.trim(),
        pagato_da: st.payer || me, quota_a: qa, quota_b: M.pyRound2(100 - qa), note: st.note.trim(), etichetta: M.normTag(st.tag),
        ...(allegato ? { allegato } : {}) });
    }
    if (st.foto) { try { D.queuePhoto(kind, allegato, st.foto); } catch (e) { toast(e.message, "error"); } }
    toast(`Salvato ✓ ${M.fmtEur(imp)}${st.cat ? " · " + st.cat : ""}`, "ok");
    onDone?.();
    close();
  };

  const full = () => {
    close();
    const row = { data: st.data, importo: value() || "", categoria: st.cat, descrizione: st.descr, note: st.note, etichetta: st.tag };
    if (kind === "comune") comuneSheet(row, { onDone }); else movimentoSheet({ ...row, tipo: M.T.USCITA, sottocategoria: st.sub }, { onDone });
  };

  // ---------------------------------------------------------------- disegno
  function draw() {
    const com = kind === "comune";
    const accent = com ? "#8A4FE0" : "#3A78E8";
    const seg = h("div.qa-seg", {},
      h("button" + (!com ? ".on" : ""), { type: "button", onclick: () => { kind = "personal"; st.cat = ""; draw(); } }, "Mia"),
      info ? h("button" + (com ? ".on.com" : ""), { type: "button", onclick: () => { kind = "comune"; st.cat = ""; st.sub = ""; draw(); } }, "Comune") : null);
    const head = h("div.qa-head", {}, seg, h("div", { style: { flex: "1" } }),
      h("button.qa-x", { type: "button", onclick: close, "aria-label": "Chiudi" }, "✕"));

    // le tue solite
    const sol = solite(kind);
    const solRow = sol.length ? h("div.qa-sol", {}, h("span.qa-lbl", {}, "LE TUE SOLITE"),
      h("div.qa-scroll", {}, sol.map((m) => h("button.qa-chip.sol", { type: "button", onclick: () => {
        st.amount = String(Number(m.importo || 0).toFixed(2)).replace(".", ",").replace(/,00$/, "");
        st.descr = m.descrizione || ""; st.cat = m.categoria || ""; st.catAuto = false; st.sub = m.sottocategoria || "";
        if (com) { st.payer = m.pagato_da || st.payer; }
        draw();
      } }, `${catIcon(m.categoria)} ${m.descrizione}`, h("b", {}, M.fmtEur(m.importo).replace(",00 €", " €")))))) : null;

    // importo
    const dateTxt = st.data === M.todayIso() ? "oggi" : M.fmtDate(st.data).slice(0, 5);
    const amt = h("div.qa-amt", { style: { borderColor: accent } },
      h("span.qa-v" + (st.amount ? "" : ".ph"), {}, st.amount || "0"), h("span.qa-eur", {}, "€"),
      h("div", { style: { flex: "1" } }),
      h("label.qa-when", {}, `📅 ${dateTxt}`, dateIn));

    // spesa comune: chi ha pagato e divisione
    let comBox = null;
    if (com) {
      const other = me === info.persona_a ? info.persona_b : info.persona_a;
      const payer = st.payer || me;
      const qdef = Number(info.quota_a ?? 50);
      const chipB = (on, txt, fn) => h("button.qa-chip" + (on ? ".on.com" : ""), { type: "button", onclick: fn }, txt);
      comBox = h("div.qa-com", {},
        h("div.qa-row", {}, h("span.qa-lbl", {}, "HA PAGATO"),
          chipB(payer === me, "Io", () => { st.payer = me; draw(); }), chipB(payer === other, other, () => { st.payer = other; draw(); })),
        h("div.qa-row", {}, h("span.qa-lbl", {}, "DIVISIONE"),
          chipB(st.div === "def", `${qdef}/${100 - qdef}`, () => { st.div = "def"; draw(); }),
          qdef !== 50 ? chipB(st.div === "50", "50/50", () => { st.div = "50"; draw(); }) : null,
          chipB(st.div === (me === info.persona_a ? "a" : "b"), "solo mia", () => { st.div = me === info.persona_a ? "a" : "b"; draw(); }),
          chipB(st.div === (me === info.persona_a ? "b" : "a"), `solo di ${other}`, () => { st.div = me === info.persona_a ? "b" : "a"; draw(); })),
        value() ? h("div.qa-share", {}, "la tua parte ", h("b", {}, M.fmtEur(myShare()))) : null);
    }

    // categorie
    const order = catOrder(kind, cats());
    const shown = order.slice(0, 7);
    if (st.cat && !shown.includes(st.cat)) shown.unshift(st.cat);
    const more = h("select.qa-more", { "aria-label": "Altre categorie" }, h("option", { value: "" }, "··· altre"),
      order.map((c) => h("option", { value: c }, c)));
    more.addEventListener("change", () => { if (more.value) { st.cat = more.value; st.catAuto = false; draw(); } });
    const catRow = h("div.qa-cats", {},
      h("span.qa-lbl", {}, "CATEGORIA", st.cat && st.catAuto ? h("span.qa-sug", {}, " · suggerita") : null),
      h("div.qa-wrapchips", {}, shown.map((c) => h("button.qa-chip" + (st.cat === c ? ".on" + (com ? ".com" : "") : ""),
        { type: "button", onclick: () => { st.cat = st.cat === c ? "" : c; st.catAuto = false; draw(); } }, `${catIcon(c)} ${c}`)),
      h("label.qa-chip.more", {}, more)));

    // informazioni in una riga sola, sempre a vista
    const infoChip = (key, icon, txt, on, fn) => h("button.qa-info" + (on ? ".on" : ""), { type: "button", onclick: fn, "data-f": key },
      `${icon} ${txt}`);
    const short = (v, n = 16) => (v.length > n ? v.slice(0, n - 1) + "…" : v);
    const metodi = D.metodi(year);
    const infoRow = h("div.qa-scroll.qa-infos", {},
      infoChip("descr", "✏️", st.descr ? short(st.descr) : "descrizione", !!st.descr, () => editText("descr")),
      !com ? infoChip("sub", "🔖", st.sub ? short(st.sub) : "specifica", !!st.sub, () => editText("sub")) : null,
      !com && metodi.length ? infoChip("metodo", "💳", st.metodo || "metodo", !!st.metodo, () => {
        const i = metodi.indexOf(st.metodo);
        st.metodo = i + 1 < metodi.length ? metodi[i + 1] : "";
        draw();
      }) : null,
      infoChip("tag", "🏷", st.tag ? short(st.tag) : "etichetta", !!st.tag, () => editText("tag")),
      infoChip("note", "📝", st.note ? short(st.note) : "note", !!st.note, () => editText("note")),
      infoChip("foto", "📷", st.foto ? "scontrino ✓" : "scontrino", !!st.foto, () => {
        if (!D.photosOk()) { toast("Per le foto serve lo script nuovo nel foglio Google (dal PC: Impostazioni → App per iPhone).", "error"); return; }
        fileIn.click();
      }),
      infoChip("full", "⋯", "modulo completo", false, full));

    // in basso: il tastierino oppure il campo di testo con la tastiera del telefono
    let bottom;
    if (st.editing) {
      const f = FIELDS[st.editing];
      const listId = "qa-dl-" + st.editing;
      const input = h("input.qa-text", { type: "text", value: st[st.editing], placeholder: f.ph, autocomplete: "off",
        list: f.list ? listId : null, enterkeyhint: "done" });
      input.addEventListener("input", () => { st[st.editing] = input.value; });
      input.addEventListener("keydown", (e) => { if (e.key === "Enter") { e.preventDefault(); doneText(); } });
      bottom = h("div.qa-edit", {}, h("div.qa-lbl", {}, f.label.toUpperCase()),
        h("div.qa-edit-row", {}, input, h("button.qa-done", { type: "button", onclick: doneText }, "Fatto")),
        f.list ? h("datalist", { id: listId }, f.list().map((v) => h("option", { value: v }))) : null,
        h("div.small.muted", {}, "Fatto: torna il tastierino dell'importo"));
      setTimeout(() => { input.focus(); input.setSelectionRange(input.value.length, input.value.length); }, 30);
    } else {
      bottom = h("div.qa-keys", {}, "1 2 3 4 5 6 7 8 9 , 0 ⌫".split(" ").map((k) => h("button.qa-key", { type: "button",
        onpointerdown: (e) => { e.preventDefault(); press(k); } }, k)));
    }
    const bSave = h("button.qa-save" + (com ? ".com" : ""), { type: "button" },
      value() ? `Salva · ${M.fmtEur(value())}` : "Salva");
    bSave.onclick = () => busy(bSave, save().catch((e) => { err.textContent = e.message; }));
    fill(panel, h("div.qa-grab"), head, semaforoLine(kind), solRow, amt, comBox, catRow, infoRow, err, bottom, bSave, fileIn);
  }
  draw();
  return { close };
}
