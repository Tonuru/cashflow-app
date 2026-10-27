// Finestre per aggiungere / modificare voci personali e comuni.
import { semaforoLine } from "./semafori.js";
import * as D from "./data.js";
import * as M from "./model.js";
import { h, sheet, toast, busy, confirmBox, C, fill } from "./ui.js";

const TIPI = [
  { tipo: M.T.USCITA, label: "Spesa" },
  { tipo: M.T.STIPENDIO, label: "Stipendio" },
  { tipo: M.T.ENTRATA, label: "Entrata extra" },
];
const tipiFor = () => (D.isMichele() ? TIPI : [TIPI[0], { tipo: M.T.ENTRATA, label: "Entrata" },
  ...(D.eduRemoved() ? [] : [{ tipo: M.T.STIPENDIO, label: "Educativa" }])]);

function field(label, input, extra) {
  // dentro un <label> un tocco su un pulsante "rimbalza" sul primo pulsante: per i selettori a pulsanti si usa un <div>
  const tag = input && input.classList && input.classList.contains("seg") ? "div.field" : "label.field";
  return h(tag, {}, h("span", {}, label), input, extra);
}
function datalist(id, values) { return h("datalist", { id }, values.map((v) => h("option", { value: v }))); }
function amountInput(v) {
  return h("input", { type: "text", inputmode: "decimal", placeholder: "0,00", autocomplete: "off",
    value: v != null && v !== "" ? String(v).replace(".", ",") : "" });
}
function segmented(options, value, onChange) {
  const wrap = h("div.seg");
  const render = () => fill(wrap, ...options.map((o) => h("button" + (o.value === value ? ".on" : ""),
    { type: "button", onclick: () => { value = o.value; render(); onChange(value); } }, o.label)));
  render();
  wrap.get = () => value;
  wrap.set = (v) => { value = v; render(); };
  return wrap;
}
const errBox = () => h("div.form-err");

/** Etichetta dell'evento (viaggio, trasloco…) con le etichette già usate. */
function tagField(row, id) {
  const input = h("input", { type: "text", list: id, autocomplete: "off", value: row.etichetta || "",
    placeholder: "facoltativa, es. Viaggio Lisbona" });
  return { input, el: field("Etichetta (evento)", input, datalist(id, D.tags())) };
}

/** Foto dello scontrino: si rimpicciolisce sul telefono e parte verso il PC, che la salva su OneDrive. */
function photoField(row) {
  let picked = null;                // base64 JPEG già rimpicciolita
  let removed = false;
  const file = h("input", { type: "file", accept: "image/*", style: { display: "none" } });
  const preview = h("div.photo-prev");
  const btn = h("button.btn", { type: "button" }, "📷 Foto dello scontrino");
  const del = h("button.btn.small", { type: "button", style: { display: "none" } }, "Togli");
  const note = h("div.small.muted");
  const draw = () => {
    const has = picked || (row.allegato && !removed);
    del.style.display = has ? "" : "none";
    btn.textContent = has ? "📷 Cambia foto" : "📷 Foto dello scontrino";
    fill(preview, picked ? h("img", { src: "data:image/jpeg;base64," + picked, alt: "Scontrino" }) : null);
    note.textContent = picked ? "La foto parte con la voce: il PC la salva nella cartella Scontrini su OneDrive."
      : row.allegato && !removed ? (D.photoPendingFor(row.allegato) ? "📎 Foto in viaggio verso il PC…"
        : "📎 Scontrino allegato (si apre dal PC)") : "";
  };
  btn.onclick = () => {
    if (!D.photosOk()) { toast("Per le foto serve lo script nuovo nel foglio Google: aggiornalo dal PC (Impostazioni → App per iPhone).", "error"); return; }
    file.click();
  };
  del.onclick = () => { picked = null; removed = true; draw(); };
  file.onchange = async () => {
    const f = file.files && file.files[0];
    if (!f) return;
    try {
      btn.disabled = true;
      btn.textContent = "Preparo la foto…";
      picked = await shrinkPhoto(f);
      removed = false;
    } catch (e) { toast("Non riesco a leggere la foto: " + e.message, "error"); }
    btn.disabled = false;
    file.value = "";
    draw();
  };
  draw();
  return {
    el: h("div.field.photo", {}, h("span", {}, "Scontrino"), h("div.row.gap", {}, btn, del), preview, note, file),
    /** {allegato} da scrivere nella voce; la foto va in coda al salvataggio (dopo la voce). */
    value(dataIso, descr) {
      if (picked) return { allegato: M.receiptPath(dataIso, descr), _foto: picked };
      if (removed) return { allegato: "" };
      return {};
    },
  };
}

/** JPEG al massimo 1600 px sul lato lungo (circa 150-300 KB), in base64 senza «data:». */
export async function shrinkPhoto(f, max = 1600, quality = 0.72) {
  const url = URL.createObjectURL(f);
  try {
    const img = await new Promise((ok, ko) => {
      const i = new Image();
      i.onload = () => ok(i);
      i.onerror = () => ko(new Error("formato non supportato"));
      i.src = url;
    });
    const k = Math.min(1, max / Math.max(img.naturalWidth, img.naturalHeight));
    const c = document.createElement("canvas");
    c.width = Math.round(img.naturalWidth * k);
    c.height = Math.round(img.naturalHeight * k);
    c.getContext("2d").drawImage(img, 0, 0, c.width, c.height);
    return c.toDataURL("image/jpeg", quality).split(",")[1];
  } finally { URL.revokeObjectURL(url); }
}

/** Dopo aver salvato la voce: la foto in coda verso il foglio Google. */
function sendPhoto(kind, v) {
  if (!v._foto) return;
  try { D.queuePhoto(kind, v.allegato, v._foto); } catch (e) { toast(e.message, "error"); }
}
const noPhoto = (v) => { const o = { ...v }; delete o._foto; return o; };

/** Voce personale: nuova (row = {tipo, data}) o da modificare (row con id). */
export function movimentoSheet(row, { onDone } = {}) {
  const editing = !!row.id;
  const year = Number((row.data || M.todayIso()).slice(0, 4));
  const s = sheet(editing ? "Modifica voce" : "Nuova voce");
  let tipo = row.tipo || M.T.USCITA;
  const allMovs = D.allMovsEveryYear();

  const fData = h("input", { type: "date", value: row.data || M.todayIso(), required: true });
  const fImp = amountInput(row.importo);
  const fCat = h("select");
  const fSub = h("input", { type: "text", list: "dl-sub", autocomplete: "off", value: row.sottocategoria || "",
    placeholder: "facoltativa" });
  const dlSub = h("datalist", { id: "dl-sub" });
  const fDesc = h("input", { type: "text", list: "dl-desc", autocomplete: "off", value: row.descrizione || "",
    placeholder: "es. Supermercato" });
  const fMet = h("select", {}, h("option", { value: "" }, "—"), D.metodi(year).map((m) => h("option", { value: m }, m)));
  fMet.value = row.metodo || "";
  const fNote = h("input", { type: "text", value: row.note || "", placeholder: "facoltative" });
  const fTag = tagField(row, "dl-tag");
  const fFoto = photoField(row);
  const err = errBox();

  const fillCats = () => {
    const cats = D.categorie(year).filter((c) => c.tipo === tipo).map((c) => c.categoria);
    if (row.categoria && row.tipo === tipo && !cats.includes(row.categoria)) cats.push(row.categoria);
    fill(fCat, h("option", { value: "" }, "Scegli…"), ...cats.map((c) => h("option", { value: c }, c)));
    fCat.value = row.tipo === tipo ? row.categoria || "" : "";
    if (!fCat.value && cats.length === 1) fCat.value = cats[0];
    fillSubs();
  };
  const fillSubs = () => {
    fill(dlSub, ...M.subcategories(D.categorie(year), allMovs, tipo, fCat.value).map((v) => h("option", { value: v })));
  };
  fCat.addEventListener("change", fillSubs);
  fDesc.addEventListener("change", () => {
    if (fCat.value) return;
    const d = fDesc.value.trim().toLowerCase();
    const last = allMovs.filter((m) => m.tipo === tipo && (m.descrizione || "").toLowerCase() === d && m.categoria)
      .sort((a, b) => (b.data || "").localeCompare(a.data || ""))[0];
    if (last) { fCat.value = last.categoria; fillSubs(); }
  });

  const seg = segmented(tipiFor().map((t) => ({ value: t.tipo, label: t.label })), tipo, (v) => { tipo = v; fillCats(); });
  fillCats();

  const read = () => {
    const imp = M.parseAmount(fImp.value);
    if (!fData.value) return "Scegli la data.";
    if (imp == null || imp === 0) return "Scrivi l'importo (es. 12,50).";
    if (imp < 0) return "L'importo va scritto positivo.";
    if (!fCat.value) return "Scegli la categoria.";
    return { data: fData.value, tipo, importo: imp, categoria: fCat.value, sottocategoria: fSub.value.trim(),
      descrizione: fDesc.value.trim(), metodo: fMet.value, note: fNote.value.trim(),
      etichetta: M.normTag(fTag.input.value), ...fFoto.value(fData.value, fDesc.value.trim()) };
  };

  const doSave = async (again) => {
    const v = read();
    if (typeof v === "string") { err.textContent = v; return; }
    err.textContent = "";
    try {
      if (editing) {
        const changes = {};
        for (const [k, x] of Object.entries(noPhoto(v))) if ((row[k] ?? "") !== x) changes[k] = x;
        if (Object.keys(changes).length) await D.editMov("personal", year, row.id, changes);
        toast("Modifica salvata ✓", "ok");
      } else {
        await D.addMov("personal", { ...noPhoto(v), origine: "iPhone" });
        toast("Salvato ✓", "ok");
      }
      sendPhoto("personal", v);
      onDone?.();
      if (again) {
        fImp.value = ""; fDesc.value = ""; fNote.value = ""; fSub.value = "";
        fImp.focus();
      } else s.close();
    } catch (e) { err.textContent = e.message; }
  };

  const bSave = h("button.btn.primary", { type: "button" }, editing ? "Salva" : "Salva");
  bSave.onclick = () => busy(bSave, doSave(false));
  const actions = h("div.row.gap.actions", {});
  if (editing) {
    const bDel = h("button.btn.danger", { type: "button" }, "Elimina");
    bDel.onclick = async () => {
      if (!(await confirmBox("Eliminare questa voce?", "Elimina"))) return;
      busy(bDel, D.deleteMov("personal", year, row.id).then(() => { toast("Voce eliminata"); onDone?.(); s.close(); })
        .catch((e) => { err.textContent = e.message; }), "Elimino…");
    };
    actions.append(bDel, bSave);
  } else {
    const bMore = h("button.btn", { type: "button" }, "Salva e aggiungi altra");
    bMore.onclick = () => busy(bMore, doSave(true));
    actions.append(bMore, bSave);
  }

  fill(s.body, semaforoLine("personal"), pendingWarn(row),
    editing && row.origine === M.ORIGINE_ANNUALE ? null : seg,
    h("div.grid2", {}, field("Data", fData), field("Importo €", fImp)),
    field("Categoria", fCat), field("Sottocategoria", fSub, dlSub),
    field("Descrizione", fDesc, datalist("dl-desc", M.suggestions(allMovs.filter((m) => m.tipo === tipo), "descrizione"))),
    h("div.grid2", {}, field("Metodo", fMet), field("Note", fNote)),
    fTag.el, fFoto.el,
    err, actions);
  if (!editing) setTimeout(() => fImp.focus(), 300);
}

/** Spesa comune o rimborso. rimborso = [chi deve, importo] per precompilare il pareggio. */
export function comuneSheet(row, { onDone, rimborso } = {}) {
  const info = D.comuneInfo();
  if (!info) { toast("Nessun file delle spese comuni trovato.", "error"); return; }
  const pa = info.persona_a, pb = info.persona_b;
  const editing = !!row.id;
  const year = Number((row.data || M.todayIso()).slice(0, 4));
  const s = sheet(editing ? "Modifica voce comune" : rimborso ? "Registra rimborso" : "Nuova spesa comune");
  let tipo = row.tipo || (rimborso ? M.T.RIMBORSO : M.T.SPESA);
  const me = D.meInComune();
  const fData = h("input", { type: "date", value: row.data || M.todayIso() });
  const fImp = amountInput(row.importo ?? (rimborso ? rimborso[1].toFixed(2) : ""));
  const fCat = h("select", {}, h("option", { value: "" }, "—"),
    D.comuneCategorie(year).map((c) => h("option", { value: c.categoria }, c.categoria)));
  fCat.value = row.categoria || "";
  const fDesc = h("input", { type: "text", list: "dl-cdesc", autocomplete: "off", value: row.descrizione || (rimborso ? "Rimborso" : "") });
  const fNote = h("input", { type: "text", value: row.note || "", placeholder: "facoltative" });
  const fTag = tagField(row, "dl-ctag");
  const fFoto = photoField(row);
  const payer = segmented([{ value: pa, label: pa }, { value: pb, label: pb }],
    row.pagato_da || (rimborso ? rimborso[0] : me === pb ? pb : pa), () => drawRimb());
  // divisione: "Predefinita" selezionata di base
  const qdef = Number(info.quota_a ?? 50);
  const divs = [
    { value: "def", label: `Predefinita (${qdef}/${100 - qdef})`, q: qdef },
    { value: "50", label: "50 / 50", q: 50 },
    { value: "a", label: `Solo ${pa}`, q: 100 },
    { value: "b", label: `Solo ${pb}`, q: 0 },
    { value: "x", label: "Altro…", q: null },
  ];
  let div = "def";
  const fQa = h("input", { type: "number", inputmode: "decimal", min: 0, max: 100, step: "any", value: qdef });
  if (editing && row.tipo !== M.T.RIMBORSO && row.tipo !== M.T_PRESTITO) {
    const qa = Number(row.quota_a ?? qdef);
    div = qa === qdef ? "def" : qa === 50 ? "50" : qa === 100 ? "a" : qa === 0 ? "b" : "x";
    fQa.value = qa;
  }
  const custom = field(`Quota di ${pa} %`, fQa, h("small", {}, `il resto è di ${pb}`));
  const divSel = h("select", {}, divs.map((d) => h("option", { value: d.value }, d.label)));
  divSel.value = div;
  const syncDiv = () => { custom.style.display = divSel.value === "x" ? "" : "none"; };
  divSel.addEventListener("change", syncDiv);
  syncDiv();
  const catField = field("Categoria", fCat);
  const divField = h("div", {}, field("Divisione", divSel), custom);
  const spesaOnly = h("div", {}, catField, divField);
  const payLbl = field("Pagato da", payer);
  // Spesa / Prestito / Rimborso: cambiano le etichette e cosa serve compilare
  const applyTipo = () => {
    spesaOnly.style.display = tipo === M.T.RIMBORSO ? "none" : "";
    divField.style.display = tipo === M.T.SPESA ? "" : "none";
    catField.firstChild.textContent = tipo === M.T_PRESTITO ? "Per cosa (categoria)" : "Categoria";
    payLbl.firstChild.textContent = tipo === M.T.RIMBORSO ? "Chi dà i soldi" : tipo === M.T_PRESTITO ? "Chi presta" : "Pagato da";
  };
  const tipoSeg = segmented([{ value: M.T.SPESA, label: "Spesa" }, { value: M.T_PRESTITO, label: "Prestito" },
    { value: M.T.RIMBORSO, label: "Rimborso" }], tipo, (v) => { tipo = v; applyTipo(); drawRimb(); });
  // rimborso: frase chiara su chi dà i soldi a chi e come restano i conti
  const rimbInfo = h("div.rimb-info");
  const saldo = M.comuneSaldo(D.comuneMovs(year), pa, pb);
  const drawRimb = () => {
    const who = payer.get(), to = who === pa ? pb : pa;
    const imp = M.parseAmount(fImp.value) || 0;
    if (tipo === M.T_PRESTITO) {
      fill(rimbInfo, h("div", {}, h("b", {}, who), " presta ", h("b", {}, M.fmtEur(imp)), " a ", h("b", {}, to)),
        h("div.small", {}, `A ${who} non conta come spesa. ${to} la vedrà nelle sue spese quando glieli restituisce.`));
      return;
    }
    if (tipo !== M.T.RIMBORSO) { fill(rimbInfo); return; }
    let after = "";
    if (saldo.debitore === who) {
      const rest = M.pyRound2(saldo.importo - imp);
      after = Math.abs(rest) < 0.005 ? "Dopo siete in pari ✅" : rest > 0 ? `Dopo ${who} deve ancora ${M.fmtEur(rest)} a ${to}`
        : `Attenzione: è più del dovuto, dopo sarà ${to} a dovere ${M.fmtEur(-rest)} a ${who}`;
    } else if (saldo.debitore) {
      after = `Attenzione: ora è ${to} che deve ${M.fmtEur(saldo.importo)} a ${who}: forse va invertito «Chi dà i soldi».`;
    }
    fill(rimbInfo, h("div", {}, h("b", {}, who), " dà ", h("b", {}, M.fmtEur(imp)), " a ", h("b", {}, to)),
      after ? h("div.small", {}, after) : null);
  };
  fImp.addEventListener("input", drawRimb);
  applyTipo();
  drawRimb();
  const err = errBox();

  const read = () => {
    const imp = M.parseAmount(fImp.value);
    if (!fData.value) return "Scegli la data.";
    if (imp == null || imp <= 0) return "Scrivi l'importo (es. 12,50).";
    const out = { data: fData.value, tipo, importo: imp, categoria: tipo === M.T.RIMBORSO ? "" : fCat.value,
      descrizione: fDesc.value.trim(), pagato_da: payer.get(), note: fNote.value.trim(),
      etichetta: M.normTag(fTag.input.value), ...fFoto.value(fData.value, fDesc.value.trim()) };
    if (tipo === M.T.SPESA) {
      const d = divs.find((x) => x.value === divSel.value);
      const qa = d.q ?? Number(String(fQa.value).replace(",", "."));
      if (!(qa >= 0 && qa <= 100)) return "La quota deve essere tra 0 e 100.";
      out.quota_a = qa;
      out.quota_b = M.pyRound2(100 - qa);
    } else if (tipo === M.T_PRESTITO) {
      // il prestito è tutto di chi lo riceve
      const toA = payer.get() !== pa;
      out.quota_a = toA ? 100 : 0;
      out.quota_b = toA ? 0 : 100;
    } else { out.quota_a = ""; out.quota_b = ""; }
    return out;
  };
  const doSave = async (again) => {
    const v = read();
    if (typeof v === "string") { err.textContent = v; return; }
    err.textContent = "";
    try {
      if (editing) {
        const changes = {};
        for (const [k, x] of Object.entries(noPhoto(v))) if ((row[k] ?? "") !== x) changes[k] = x;
        if (Object.keys(changes).length) await D.editMov("comune", year, row.id, changes);
      } else await D.addMov("comune", noPhoto(v));
      sendPhoto("comune", v);
      toast("Salvato ✓", "ok");
      onDone?.();
      if (again) { fImp.value = ""; fDesc.value = ""; fNote.value = ""; fImp.focus(); } else s.close();
    } catch (e) { err.textContent = e.message; }
  };
  const bSave = h("button.btn.primary", { type: "button" }, "Salva");
  bSave.onclick = () => busy(bSave, doSave(false));
  const actions = h("div.row.gap.actions");
  if (editing) {
    const bDel = h("button.btn.danger", { type: "button" }, "Elimina");
    bDel.onclick = async () => {
      if (!(await confirmBox("Eliminare questa voce comune?", "Elimina"))) return;
      busy(bDel, D.deleteMov("comune", year, row.id).then(() => { toast("Voce eliminata"); onDone?.(); s.close(); })
        .catch((e) => { err.textContent = e.message; }), "Elimino…");
    };
    actions.append(bDel, bSave);
  } else if (!rimborso) {
    const bMore = h("button.btn", { type: "button" }, "Salva e aggiungi altra");
    bMore.onclick = () => busy(bMore, doSave(true));
    actions.append(bMore, bSave);
  } else actions.append(bSave);

  const cm = D.years("comune").flatMap((y) => D.comuneMovs(y));
  fill(s.body, semaforoLine("comune"), pendingWarn(row), rimborso ? null : tipoSeg,
    h("div.grid2", {}, field("Data", fData), field("Importo €", fImp)), payLbl, rimbInfo, spesaOnly,
    field("Descrizione", fDesc, datalist("dl-cdesc", M.suggestions(cm, "descrizione"))), field("Note", fNote),
    fTag.el, fFoto.el, err, actions);
  if (!editing && !rimborso) setTimeout(() => fImp.focus(), 300);
}

/** Elenco delle voci (es. tocco su una categoria). */
export function vociSheet(title, rows, { onTap } = {}) {
  const s = sheet(title);
  const tot = rows.reduce((a, m) => a + Number(m.importo || 0), 0);
  fill(s.body, h("div.muted.center", {}, `${rows.length} voc${rows.length === 1 ? "e" : "i"} · ${M.fmtEur(tot)}`),
    h("div.list", {}, rows.map((m) => movRow(m, { onTap: onTap && ((x) => { s.close(); onTap(x); }) }))));
}

export function movRow(m, { onTap, sign = "−", showCat = true } = {}) {
  const comune = m.origine === M.ORIGINE_COMUNE;
  const v = Number(m.importo || 0);
  const neg = sign === "−" || v < 0;
  const color = comune ? C.violet : neg ? C.red : C.green;
  const cat = [m.categoria, m.sottocategoria].filter(Boolean).join(" · ");
  return h("button.item" + (comune ? ".comune" : "") + (m._pending ? ".pending" : ""),
    { type: "button", onclick: () => onTap?.(m) },
    h("div.item-main", {}, h("div.item-title", {}, (m.descrizione || cat || "—") + (m.allegato ? " 📎" : "")
      + (m.etichetta ? ` · 🏷 ${m.etichetta}` : "")),
      h("div.item-sub", {}, [M.fmtDate(m.data).slice(0, 5), showCat ? cat : "", comune ? "spesa comune" : m.metodo]
        .filter(Boolean).join(" · "))),
    h("div.item-amt", { style: { color } }, (neg ? "−" : "+") + M.fmtEur(Math.abs(v))));
}

/** Avviso se la voce ha già una modifica che il PC non ha ancora scritto (anche dall'altro telefono). */
function pendingWarn(row) {
  if (!row.id) return null;
  const n = D.pendingFor(row.id).length;
  return n ? h("div.warn", {}, "⚠️ Questa voce ha già una modifica in attesa del PC: se la cambi ancora, "
    + "vale l'ultima modifica.") : null;
}
