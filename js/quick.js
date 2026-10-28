// Aggiunta veloce dal telefono (B1 / B4): tutto a vista, senza scorrere in giro. Mia / Comune, importo grande al
// centro (tastierino numerico del telefono), descrizione sempre presente, tutte le categorie in una griglia, le
// altre informazioni in una riga di caselle uguali; per le spese comuni chi ha pagato e come si divide, con le due
// parti in euro scritte sotto.
import * as D from "./data.js";
import * as M from "./model.js";
import { h, fill, toast, busy } from "./ui.js";
import { movimentoSheet, comuneSheet, shrinkPhoto } from "./forms.js";
import { semaforoLine } from "./semafori.js";

const ICONS = [[/alimentar|supermerc|^spesa$/i, "🛒"], [/bar|caff/i, "☕"], [/ristor|pizz|cen[ae]|pasti/i, "🍕"],
  [/trasport|benzin|carbur/i, "⛽"], [/auto|moto/i, "🚗"], [/casa|affitt|mutu/i, "🏠"], [/bollett|utenz|luce|gas/i, "💡"],
  [/salut|farmac|medic/i, "💊"], [/svago|hobby|cinema/i, "🎬"], [/abbonam|telefon/i, "📱"], [/regal/i, "🎁"],
  [/vestit|abbigl/i, "👕"], [/viagg|vacanz/i, "✈️"], [/sport|palestr/i, "🏋️"], [/animal/i, "🐾"], [/spese prof/i, "💼"],
  [/libr|cors|scuol|istruz/i, "📚"], [/tass|impost/i, "🧾"], [/pulizi/i, "🧹"], [/arred|mobil/i, "🛋️"],
  [/comun/i, "🤝"], [/prestit/i, "↔️"]];
export const catIcon = (c) => (ICONS.find(([re]) => re.test(c || "")) || [null, "•"])[1];

const daysAgo = (iso) => Math.round((Date.parse(M.todayIso() + "T00:00:00Z") - Date.parse(iso + "T00:00:00Z")) / 864e5);

function history(kind) {
  if (kind === "comune") return D.years("comune").flatMap((y) => D.comuneMovs(y)).filter((m) => (m.tipo || M.T.SPESA) === M.T.SPESA);
  return D.years("personal").flatMap((y) => D.personalMovs(y)).filter((m) => (m.tipo || M.T.USCITA) === M.T.USCITA);
}

/** Categorie in ordine d'uso (ultimi 6 mesi), poi le altre nell'ordine del file. */
function catOrder(kind, cats) {
  const count = new Map();
  for (const m of history(kind)) if (m.data && daysAgo(m.data) <= 180 && m.categoria) count.set(m.categoria, (count.get(m.categoria) || 0) + 1);
  return cats.map((c, i) => [c, i]).sort((a, b) => (count.get(b[0]) || 0) - (count.get(a[0]) || 0) || a[1] - b[1]).map(([c]) => c);
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
  const me = D.meInComune();
  const other = info ? (me === info.persona_a ? info.persona_b : info.persona_a) : "";
  const qdef = Number(info?.quota_a ?? 50);
  // quota di persona_a per ogni scelta di divisione
  const myA = me === info?.persona_a;
  const st = { amount: "", cat: "", catAuto: false, descr: "", data: M.todayIso(), sub: "", metodo: "", note: "", tag: "",
    foto: null, payer: me, div: qdef === 50 ? "meta" : "def", custom: 50, editing: null };

  const wrap = h("div.qa-wrap");
  const panel = h("div.qa");
  wrap.append(panel);
  const close = () => { wrap.classList.remove("open"); setTimeout(() => wrap.remove(), 220); };
  wrap.addEventListener("click", (e) => { if (e.target === wrap) close(); });
  document.body.append(wrap);
  requestAnimationFrame(() => wrap.classList.add("open"));

  const value = () => Math.abs(M.parseAmount(String(st.amount)) || 0);
  const cats = () => (kind === "comune" ? D.comuneCategorie(year) : D.categorie(year).filter((c) => c.tipo === M.T.USCITA))
    .map((c) => c.categoria);
  /** Percentuale di persona_a per la divisione scelta. */
  const quotaA = () => {
    if (st.div === "meta") return 50;
    if (st.div === "def") return qdef;
    if (st.div === "mia") return myA ? 100 : 0;
    if (st.div === "sua") return myA ? 0 : 100;
    const mine = Math.max(0, Math.min(100, Number(st.custom) || 0));
    return myA ? mine : 100 - mine;
  };
  const shares = () => {
    const qa = quotaA();
    const mine = myA ? qa : 100 - qa;
    return { mine: value() * mine / 100, his: value() * (100 - mine) / 100, pctMine: mine };
  };

  // campi di testo che si scrivono in una riga al posto delle caselle
  const FIELDS = {
    sub: { label: "Specifica", ph: "es. Gas, Benzina…", list: () => M.subcategories(D.categorie(year), history("personal"), M.T.USCITA, st.cat) },
    note: { label: "Note", ph: "facoltative" },
    tag: { label: "Etichetta (evento)", ph: "es. Viaggio Lisbona", list: () => D.tags() },
    custom: { label: `La mia parte in %`, ph: "es. 70", num: true },
  };

  const fileIn = h("input", { type: "file", accept: "image/*", style: { display: "none" } });
  fileIn.onchange = async () => {
    const f = fileIn.files && fileIn.files[0];
    if (!f) return;
    try { st.foto = await shrinkPhoto(f); } catch (e) { toast("Non riesco a leggere la foto: " + e.message, "error"); }
    fileIn.value = "";
    draw();
  };

  // campi fissi (creati una volta: non perdono il fuoco mentre scrivi)
  const amountIn = h("input.qa-amount", { type: "text", inputmode: "decimal", placeholder: "0,00", autocomplete: "off",
    "aria-label": "Importo" });
  const fitAmount = () => { amountIn.style.width = `${Math.max(3, (amountIn.value || amountIn.placeholder).length) + 0.1}ch`; };
  amountIn.addEventListener("input", () => { st.amount = amountIn.value; fitAmount(); updateLive(); });
  const descrIn = h("input.qa-descr", { type: "text", placeholder: "✏️  Descrizione (es. Supermercato)", autocomplete: "off",
    list: "qa-dl-descr", enterkeyhint: "done", "aria-label": "Descrizione" });
  const dlDescr = h("datalist", { id: "qa-dl-descr" });
  descrIn.addEventListener("input", () => { st.descr = descrIn.value; });
  descrIn.addEventListener("change", () => {
    st.descr = descrIn.value;
    if (!st.cat || st.catAuto) {
      const g = guessCat(kind, st.descr);
      if (g && cats().includes(g)) { st.cat = g; st.catAuto = true; draw(); }
    }
  });
  descrIn.addEventListener("keydown", (e) => { if (e.key === "Enter") { e.preventDefault(); descrIn.blur(); } });
  const dateIn = h("input.qa-hidden", { type: "date", value: st.data, "aria-label": "Data" });
  dateIn.addEventListener("change", () => { st.data = dateIn.value || M.todayIso(); draw(); });
  const metIn = h("select.qa-hidden", { "aria-label": "Metodo di pagamento" });
  metIn.addEventListener("change", () => { st.metodo = metIn.value; draw(); });

  const share = h("div.qa-share");
  const bSave = h("button.qa-save", { type: "button" });
  bSave.onclick = () => busy(bSave, save().catch((e) => { err.textContent = e.message; }));
  const err = h("div.form-err");
  function updateLive() {
    const v = value();
    bSave.textContent = kind === "comune" ? (v ? `Salva spesa comune · ${M.fmtEur(v)}` : "Salva spesa comune")
      : (v ? `Salva · ${M.fmtEur(v)}` : "Salva");
    if (kind === "comune") {
      const s = shares();
      fill(share, v ? ["la tua parte ", h("b", {}, M.fmtEur(s.mine))] : "scrivi l'importo");
      if (divNote) fill(divNote, divText());
    }
  }

  // ---------------------------------------------------------------- salvataggio
  async function save() {
    const imp = value();
    if (!imp) { err.textContent = "Scrivi l'importo."; amountIn.focus(); return; }
    if (!st.cat && kind === "personal") { err.textContent = "Scegli la categoria."; return; }
    const allegato = st.foto ? M.receiptPath(st.data, st.descr) : "";
    if (kind === "personal") {
      await D.addMov("personal", { data: st.data, tipo: M.T.USCITA, importo: imp, categoria: st.cat, sottocategoria: st.sub.trim(),
        descrizione: st.descr.trim(), metodo: st.metodo, note: st.note.trim(), etichetta: M.normTag(st.tag),
        ...(allegato ? { allegato } : {}), origine: "iPhone" });
    } else {
      const qa = quotaA();
      await D.addMov("comune", { data: st.data, tipo: M.T.SPESA, importo: imp, categoria: st.cat, descrizione: st.descr.trim(),
        pagato_da: st.payer, quota_a: qa, quota_b: M.pyRound2(100 - qa), note: st.note.trim(), etichetta: M.normTag(st.tag),
        ...(allegato ? { allegato } : {}) });
    }
    if (st.foto) { try { D.queuePhoto(kind, allegato, st.foto); } catch (e) { toast(e.message, "error"); } }
    toast(`Salvato ✓ ${M.fmtEur(imp)}${st.cat ? " · " + st.cat : ""}`, "ok");
    onDone?.();
    close();
  }

  function full() {
    close();
    const row = { data: st.data, importo: value() || "", categoria: st.cat, descrizione: st.descr, note: st.note, etichetta: st.tag };
    if (kind === "comune") comuneSheet(row, { onDone }); else movimentoSheet({ ...row, tipo: M.T.USCITA, sottocategoria: st.sub }, { onDone });
  }

  // ---------------------------------------------------------------- divisione della spesa comune
  let divNote = null;
  const divOptions = () => [
    { id: "meta", label: "Metà" },
    qdef !== 50 ? { id: "def", label: `${myA ? qdef : 100 - qdef}/${myA ? 100 - qdef : qdef}` } : null,
    { id: "mia", label: "Tutta a me" },
    { id: "sua", label: `Tutta a ${other}` },
    { id: "altro", label: "Altro %" },
  ].filter(Boolean);
  function divText() {
    const s = shares();
    const v = value();
    const both = v ? `${me} ${M.fmtEur(s.mine)} · ${other} ${M.fmtEur(s.his)}` : `${me} ${s.pctMine}% · ${other} ${100 - s.pctMine}%`;
    const why = {
      meta: "metà a testa",
      def: "la divisione che usate di solito",
      mia: `è una spesa solo tua: ${other} non ti deve niente`,
      sua: `è una spesa di ${other}: ${st.payer === me ? `te la deve ridare tutta` : "non tocca a te"}`,
      altro: "parti decise da te",
    }[st.div];
    return [h("b", {}, both), h("span", {}, ` — ${why}`)];
  }

  // ---------------------------------------------------------------- disegno
  function draw() {
    const com = kind === "comune";
    panel.classList.toggle("com", com);
    const seg = h("div.qa-seg", {},
      h("button" + (!com ? ".on" : ""), { type: "button", onclick: () => { if (com) { kind = "personal"; st.cat = ""; draw(); } } }, "Mia"),
      info ? h("button" + (com ? ".on.com" : ""), { type: "button", onclick: () => { if (!com) { kind = "comune"; st.cat = ""; st.sub = ""; st.metodo = ""; draw(); } } }, "Comune") : null);
    const head = h("div.qa-head", {}, h("button.qa-x", { type: "button", onclick: close, "aria-label": "Chiudi" }, "✕"), seg,
      h("button.qa-x.qa-full", { type: "button", onclick: full, "aria-label": "Modulo completo", title: "Modulo completo" }, "⋯"));

    amountIn.value = st.amount;
    fitAmount();
    const amt = h("div.qa-amtbox", {}, h("div.qa-amtrow", {}, amountIn, h("span.qa-eur", {}, "€")), h("div.qa-line"));
    descrIn.value = st.descr;
    fill(dlDescr, M.suggestions(history(kind), "descrizione", null, 60).map((v) => h("option", { value: v })));

    let comBox = null;
    divNote = null;
    if (com) {
      const segRow = (cls, lbl, opts, cur, pick) => h("div.qa-segrow." + cls, {}, h("div.qa-lbl", {}, lbl),
        h("div.qa-seg2", {}, opts.map((o) => h("button" + (o.id === cur ? ".on" : ""), { type: "button", onclick: () => pick(o.id) }, o.label))));
      divNote = h("div.qa-divnote");
      comBox = h("div.qa-com", {},
        segRow("qa-payer", "HA PAGATO", [{ id: me, label: "Io" }, { id: other, label: other }], st.payer, (id) => { st.payer = id; draw(); }),
        segRow("qa-div", "COME SI DIVIDE", divOptions(), st.div, (id) => { st.div = id; if (id === "altro") st.editing = "custom"; draw(); }),
        divNote);
    }

    // tutte le categorie, in una griglia
    const order = catOrder(kind, cats());
    if (st.cat && !order.includes(st.cat)) order.unshift(st.cat);
    const grid = h("div.qa-cats", {},
      h("div.qa-lbl.center", {}, "CATEGORIA", st.cat && st.catAuto ? h("span.qa-sug", {}, " · suggerita dalla descrizione") : ""),
      h("div.qa-grid", {}, order.map((c) => h("button.qa-cat" + (st.cat === c ? ".on" : ""), { type: "button",
        onclick: () => { st.cat = st.cat === c ? "" : c; st.catAuto = false; draw(); } },
      h("span.qa-ci", {}, catIcon(c)), h("span.qa-cn", {}, c)))));

    // le altre informazioni: caselle uguali in una riga (o il campo di testo che si sta scrivendo)
    let infoRow;
    if (st.editing) {
      const f = FIELDS[st.editing];
      const listId = "qa-dl-" + st.editing;
      const input = h("input.qa-text", { type: "text", inputmode: f.num ? "decimal" : "text", value: String(st[st.editing] ?? ""),
        placeholder: f.ph, autocomplete: "off", list: f.list ? listId : null, enterkeyhint: "done" });
      const done = () => { st[st.editing] = input.value; st.editing = null; draw(); };
      input.addEventListener("keydown", (e) => { if (e.key === "Enter") { e.preventDefault(); done(); } });
      infoRow = h("div.qa-edit", {}, h("div.qa-lbl.center", {}, f.label.toUpperCase()),
        h("div.qa-edit-row", {}, input, h("button.qa-done", { type: "button", onclick: done }, "Fatto")),
        f.list ? h("datalist", { id: listId }, f.list().map((v) => h("option", { value: v }))) : null);
      setTimeout(() => input.focus(), 30);
    } else {
      const box = (key, icon, txt, on, onclick, extra) => h("button.qa-box" + (on ? ".on" : ""), { type: "button", "data-f": key, onclick },
        h("span.qa-bi", {}, icon), h("span.qa-bt", {}, txt), extra);
      const dateTxt = st.data === M.todayIso() ? "oggi" : M.fmtDate(st.data).slice(0, 5);
      dateIn.value = st.data;
      const metodi = D.metodi(year);
      fill(metIn, h("option", { value: "" }, "— nessuno —"), metodi.map((x) => h("option", { value: x }, x)));
      metIn.value = st.metodo;
      const photo = () => {
        if (!D.photosOk()) { toast("Per le foto serve lo script nuovo nel foglio Google (dal PC: Impostazioni → App per iPhone).", "error"); return; }
        fileIn.click();
      };
      infoRow = h("div.qa-boxes", {},
        h("label.qa-box" + (st.data !== M.todayIso() ? ".on" : ""), { "data-f": "data" }, h("span.qa-bi", {}, "📅"), h("span.qa-bt", {}, dateTxt), dateIn),
        !com ? box("sub", "🔖", st.sub || "specifica", !!st.sub, () => { st.editing = "sub"; draw(); }) : null,
        !com ? h("label.qa-box" + (st.metodo ? ".on" : ""), { "data-f": "metodo" }, h("span.qa-bi", {}, "💳"), h("span.qa-bt", {}, st.metodo || "metodo"), metIn) : null,
        box("tag", "🏷", st.tag || "etichetta", !!st.tag, () => { st.editing = "tag"; draw(); }),
        com ? box("note", "📝", st.note || "note", !!st.note, () => { st.editing = "note"; draw(); }) : null,
        box("foto", "📷", st.foto ? "scontrino ✓" : "scontrino", !!st.foto, photo));
    }

    bSave.className = com ? "qa-save com" : "qa-save";
    fill(panel, h("div.qa-grab"), head, semaforoLine(kind), amt, com ? share : null, h("div.qa-descrbox", {}, descrIn, dlDescr),
      comBox, grid, infoRow, err, bSave, fileIn);
    updateLive();
  }
  draw();
  return { close };
}
