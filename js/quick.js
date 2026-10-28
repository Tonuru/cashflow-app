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

/** Specifica usata l'ultima volta con la stessa descrizione (nella stessa categoria). */
function guessSub(kind, descr, cat) {
  const d = String(descr || "").trim().toLowerCase();
  const key = M.nomeChiave(d);
  const hist = history(kind).filter((m) => m.categoria === cat && m.sottocategoria)
    .sort((a, b) => (b.data || "").localeCompare(a.data || ""));
  const same = hist.find((m) => (m.descrizione || "").trim().toLowerCase() === d) || (key && hist.find((m) => M.nomeChiave(m.descrizione) === key));
  return same ? same.sottocategoria : "";
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
    foto: null, payer: me, ctipo: "spesa", div: qdef === 50 ? "meta" : "def", custom: 50, editing: null,
    step: "cats", newCat: false, newSub: false, nuove: [] };
  // nuove: categorie/specifiche create qui ({categoria, subs}); vanno in coda solo quando si salva la voce

  const wrap = h("div.qa-wrap");
  const panel = h("div.qa");
  wrap.append(panel);
  const close = () => { wrap.classList.remove("open"); setTimeout(() => wrap.remove(), 220); };
  wrap.addEventListener("click", (e) => { if (e.target === wrap) close(); });
  document.body.append(wrap);
  requestAnimationFrame(() => wrap.classList.add("open"));

  const value = () => Math.abs(M.parseAmount(String(st.amount)) || 0);
  const cats = () => {
    const out = (kind === "comune" ? D.comuneCategorie(year) : D.categorie(year).filter((c) => c.tipo === M.T.USCITA))
      .map((c) => c.categoria);
    for (const n of st.nuove) if (n.kind === kind && !out.some((c) => c.toLowerCase() === n.categoria.toLowerCase())) out.push(n.categoria);
    return out;
  };
  /** Le specifiche della categoria scelta: quelle del file, quelle usate, quelle appena create. */
  const catList = () => (kind === "comune" ? D.comuneCategorie(year) : D.categorie(year));
  const subTipo = () => (kind === "comune" ? M.T.SPESA : M.T.USCITA);
  const subs = () => {
    const out = M.subcategories(catList(), history(kind), subTipo(), st.cat);
    for (const n of st.nuove) {
      if (n.kind !== kind || n.categoria.toLowerCase() !== st.cat.toLowerCase()) continue;
      for (const x of n.subs) if (!out.some((o) => o.toLowerCase() === x.toLowerCase())) out.push(x);
    }
    return out;
  };
  /** Ricorda una categoria (e/o specifica) nuova; se c'è già con un altro maiuscolo/minuscolo usa quella. */
  function remember(name, sub) {
    name = name.trim().replace(/\s+/g, " ");
    sub = (sub || "").trim().replace(/\s+/g, " ");
    const have = cats().find((c) => c.toLowerCase() === name.toLowerCase());
    if (have) name = have;
    const known = sub ? M.subcategories(catList(), [], subTipo(), name) : [];
    const isNewCat = !have || st.nuove.some((n) => n.kind === kind && n.categoria === name);
    const isNewSub = sub && !known.some((x) => x.toLowerCase() === sub.toLowerCase());
    if (isNewCat || isNewSub) {
      let n = st.nuove.find((x) => x.kind === kind && x.categoria === name);
      if (!n) { n = { kind, categoria: name, subs: [], nuova: !have }; st.nuove.push(n); }
      if (isNewSub && !n.subs.some((x) => x.toLowerCase() === sub.toLowerCase())) n.subs.push(sub);
    }
    if (isNewSub) sub = (subs().find((x) => x.toLowerCase() === sub.toLowerCase())) || sub;
    return [name, sub];
  }
  /** Sceglie la categoria, poi si passa alle sue specifiche. */
  function pickCat(c) {
    if (st.cat !== c) st.sub = "";
    st.cat = c;
    st.catAuto = false;
    st.newCat = false;
    st.step = "subs";
  }
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
      if (g && cats().includes(g)) {
        st.cat = g; st.catAuto = true;
        st.step = "subs"; st.sub = st.sub || guessSub(kind, st.descr, g);
        draw();
      }
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
    const what = { spesa: "Salva spesa comune", prestito: "Salva prestito", rimborso: "Salva rimborso" }[st.ctipo];
    bSave.textContent = kind === "comune" ? (v ? `${what} · ${M.fmtEur(v)}` : what) : (v ? `Salva · ${M.fmtEur(v)}` : "Salva");
    if (kind === "comune") {
      const to = st.payer === me ? other : me;
      const who = (x) => (x === me ? "tu" : x);
      if (st.ctipo === "spesa") {
        const s = shares();
        fill(share, v ? ["la tua parte ", h("b", {}, M.fmtEur(s.mine))] : "scrivi l'importo");
      } else if (st.ctipo === "prestito") {
        fill(share, v ? [h("b", {}, cap(who(st.payer))), ` ${st.payer === me ? "presti" : "presta"} `, h("b", {}, M.fmtEur(v)),
          ` a ${to === me ? "te" : to}`] : "scrivi l'importo");
      } else {
        fill(share, v ? [h("b", {}, cap(who(st.payer))), ` ${st.payer === me ? "dai" : "dà"} `, h("b", {}, M.fmtEur(v)),
          ` a ${to === me ? "te" : to}`] : "scrivi l'importo");
      }
      if (divNote) fill(divNote, divText());
      if (rimbNote) fill(rimbNote, rimbText());
    }
  }

  const cap = (t) => t.charAt(0).toUpperCase() + t.slice(1);
  const saldo = () => M.comuneSaldo(D.comuneMovs(year), info.persona_a, info.persona_b);
  let rimbNote = null;
  /** Rimborso: come stanno i conti adesso e come restano dopo. */
  function rimbText() {
    const s = saldo();
    const v = value();
    const now = s.debitore ? `Adesso ${s.debitore === me ? "tu devi" : s.debitore + " deve"} ${M.fmtEur(s.importo)} a ${s.creditore === me ? "te" : s.creditore}`
      : "Adesso siete in pari";
    let after = "";
    if (v) {
      if (s.debitore === st.payer) {
        const rest = M.pyRound2(s.importo - v);
        after = Math.abs(rest) < 0.005 ? "dopo siete in pari ✅" : rest > 0 ? `dopo restano ${M.fmtEur(rest)} da dare`
          : `attenzione: è più del dovuto, dopo il debito si inverte (${M.fmtEur(-rest)})`;
      } else if (s.debitore) after = "attenzione: chi deve i soldi è l'altra persona, forse va invertito «Chi dà i soldi»";
      else after = `dopo ${st.payer === me ? (other + " ti dovrà") : "dovrai"} ${M.fmtEur(v)}`;
    }
    return [h("b", {}, now), after ? h("span", {}, ` · ${after}`) : null];
  }

  // ---------------------------------------------------------------- salvataggio
  async function save() {
    const imp = value();
    if (!imp) { err.textContent = "Scrivi l'importo."; amountIn.focus(); return; }
    if (!st.cat && kind === "personal") { err.textContent = "Scegli la categoria."; return; }
    if (kind === "comune" && st.ctipo === "spesa" && !st.cat) { err.textContent = "Scegli la categoria."; return; }
    const allegato = st.foto ? M.receiptPath(st.data, st.descr) : "";
    // categorie e specifiche nuove: prima della voce, così il PC le trova già nel file
    for (const n of st.nuove) {
      if (n.kind !== kind || n.categoria !== st.cat) continue;
      const nuoveSub = n.subs.filter((x) => x === st.sub);
      if (!n.nuova && !nuoveSub.length) continue;
      D.addCategory(kind, Number(st.data.slice(0, 4)), { tipo: M.T.USCITA, categoria: n.categoria, sottocategorie: nuoveSub });
    }
    if (kind === "personal") {
      await D.addMov("personal", { data: st.data, tipo: M.T.USCITA, importo: imp, categoria: st.cat, sottocategoria: st.sub.trim(),
        descrizione: st.descr.trim(), metodo: st.metodo, note: st.note.trim(), etichetta: M.normTag(st.tag),
        ...(allegato ? { allegato } : {}), origine: "iPhone" });
    } else {
      let tipo = M.T.SPESA, qa = quotaA(), qb = M.pyRound2(100 - qa), cat = st.cat;
      if (st.ctipo === "prestito") {
        // il prestito è tutto di chi lo riceve
        tipo = M.T_PRESTITO;
        const toA = st.payer !== info.persona_a;
        qa = toA ? 100 : 0; qb = toA ? 0 : 100;
      } else if (st.ctipo === "rimborso") { tipo = M.T.RIMBORSO; qa = ""; qb = ""; cat = ""; }
      await D.addMov("comune", { data: st.data, tipo, importo: imp, categoria: cat, sottocategoria: cat ? st.sub.trim() : "", descrizione: st.descr.trim() || (st.ctipo === "rimborso" ? "Rimborso" : ""),
        pagato_da: st.payer, quota_a: qa, quota_b: qb, note: st.note.trim(), etichetta: M.normTag(st.tag),
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
    if (kind === "comune") comuneSheet({ ...row, sottocategoria: st.sub }, { onDone }); else movimentoSheet({ ...row, tipo: M.T.USCITA, sottocategoria: st.sub }, { onDone });
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

  // ---------------------------------------------------------------- categorie e specifiche
  /** Riquadro per scrivere un nome nuovo (categoria, oppure categoria + specifica). */
  function newForm(title, fields, onOk, onCancel) {
    const ins = fields.map((f) => h("input.qa-text", { type: "text", placeholder: f.ph, autocomplete: "off", enterkeyhint: "done",
      value: f.value || "", "aria-label": f.label }));
    const ok = () => {
      const vals = ins.map((i) => i.value.trim());
      if (!vals[0]) { ins[0].focus(); return; }
      onOk(...vals);
    };
    ins.forEach((i, k) => i.addEventListener("keydown", (e) => {
      if (e.key !== "Enter") return;
      e.preventDefault();
      if (k + 1 < ins.length && !ins[k + 1].value) ins[k + 1].focus(); else ok();
    }));
    setTimeout(() => ins[0].focus(), 30);
    return h("div.qa-new", {}, h("div.qa-lbl.center", {}, title),
      fields.map((f, k) => h("div.qa-new-f", {}, h("span.qa-new-l", {}, f.label), ins[k])),
      h("div.qa-new-btns", {}, h("button.qa-new-no", { type: "button", onclick: onCancel }, "Annulla"),
        h("button.qa-done", { type: "button", onclick: ok }, "Aggiungi")));
  }

  function catsBlock(com) {
    const prest = com && st.ctipo === "prestito";
    const isNew = (c) => st.nuove.some((n) => n.kind === kind && n.categoria === c);
    // nuova categoria
    if (st.newCat) {
      const fields = [{ label: "Categoria", ph: "es. Animali, Bambini…" }, { label: "Specifica", ph: "facoltativa, es. Veterinario" }];
      return h("div.qa-cats", {}, newForm("NUOVA CATEGORIA", fields, (name, sub) => {
        const [n, s2] = remember(name, sub);
        pickCat(n);
        if (s2) st.sub = s2;
        draw();
      }, () => { st.newCat = false; draw(); }));
    }
    // specifiche della categoria scelta
    if (st.step === "subs" && st.cat) {
      const back = h("button.qa-back", { type: "button", onclick: () => { st.step = "cats"; st.newSub = false; draw(); } },
        h("span.qa-back-a", {}, "‹"), "Categorie");
      const title = h("div.qa-subhead", {}, back,
        h("div.qa-subcat", {}, h("span.qa-ci", {}, catIcon(st.cat)), h("b", {}, st.cat)),
        h("div.qa-subsp"));
      if (st.newSub) {
        return h("div.qa-cats", {}, title, newForm(`NUOVA SPECIFICA DI ${st.cat.toUpperCase()}`,
          [{ label: "Specifica", ph: "es. Gas, Condominio…" }],
          (sub) => { const [, s2] = remember(st.cat, sub); st.sub = s2; st.newSub = false; draw(); },
          () => { st.newSub = false; draw(); }));
      }
      const list = subs();
      const chip = (val, label, extra = "") => h("button.qa-sub" + (st.sub === val ? ".on" : "") + extra, { type: "button",
        onclick: () => { st.sub = val; draw(); } }, label);
      return h("div.qa-cats", {}, title,
        h("div.qa-lbl.center", {}, "SPECIFICA", st.sub && st.catAuto ? h("span.qa-sug", {}, " · suggerita") : "",
          isNew(st.cat) ? h("span.qa-sug", {}, " · categoria nuova") : ""),
        h("div.qa-subs", {},
          list.map((x) => chip(x, x)),
          chip("", "Nessuna", ".none"),
          h("button.qa-sub.qa-plus", { type: "button", onclick: () => { st.newSub = true; draw(); } }, "＋ Nuova")),
        !list.length ? h("div.qa-hint", {}, "Nessuna specifica per ora: puoi crearne una o andare avanti senza.") : null);
    }
    const order = catOrder(kind, cats());
    if (st.cat && !order.includes(st.cat)) order.unshift(st.cat);
    return h("div.qa-cats", {},
      h("div.qa-lbl.center", {}, prest ? "PER COSA (facoltativo)" : "CATEGORIA",
        st.cat && st.catAuto ? h("span.qa-sug", {}, " · suggerita dalla descrizione") : ""),
      h("div.qa-grid", {}, order.map((c) => h("button.qa-cat" + (st.cat === c ? ".on" : ""), { type: "button",
        onclick: () => {
          pickCat(c);
          draw();
        } },
      h("span.qa-ci", {}, catIcon(c)), h("span.qa-cn", {}, c + (isNew(c) ? " ✨" : ""),
        st.cat === c && st.sub ? h("span.qa-cs", {}, st.sub) : null))),
      h("button.qa-cat.qa-plus", { type: "button", onclick: () => { st.newCat = true; draw(); } },
        h("span.qa-ci", {}, "＋"), h("span.qa-cn", {}, "Nuova"))));
  }

  // ---------------------------------------------------------------- disegno
  function draw() {
    const com = kind === "comune";
    panel.classList.toggle("com", com);
    const seg = h("div.qa-seg", {},
      h("button" + (!com ? ".on" : ""), { type: "button", onclick: () => { if (com) { kind = "personal"; st.cat = ""; st.sub = ""; st.step = "cats"; st.newCat = false; draw(); } } }, "Mia"),
      info ? h("button" + (com ? ".on.com" : ""), { type: "button", onclick: () => { if (!com) { kind = "comune"; st.cat = ""; st.sub = ""; st.metodo = ""; st.step = "cats"; st.newCat = false; draw(); } } }, "Comune") : null);
    const head = h("div.qa-head", {}, h("button.qa-x", { type: "button", onclick: close, "aria-label": "Chiudi" }, "✕"), seg,
      h("button.qa-x.qa-full", { type: "button", onclick: full, "aria-label": "Modulo completo", title: "Modulo completo" }, "⋯"));

    amountIn.value = st.amount;
    fitAmount();
    const amt = h("div.qa-amtbox", {}, h("div.qa-amtrow", {}, amountIn, h("span.qa-eur", {}, "€")), h("div.qa-line"));
    descrIn.value = st.descr;
    fill(dlDescr, M.suggestions(history(kind), "descrizione", null, 60).map((v) => h("option", { value: v })));

    let comBox = null;
    divNote = null;
    rimbNote = null;
    if (com) {
      const segRow = (cls, lbl, opts, cur, pick) => h("div.qa-segrow." + cls, {}, h("div.qa-lbl", {}, lbl),
        h("div.qa-seg2", {}, opts.map((o) => h("button" + (o.id === cur ? ".on" : ""), { type: "button", onclick: () => pick(o.id) }, o.label))));
      const TIPI = [{ id: "spesa", label: "Spesa" }, { id: "prestito", label: "Prestito" }, { id: "rimborso", label: "Rimborso" }];
      const MEANING = {
        spesa: "una spesa di tutti e due, divisa come scegli qui sotto",
        prestito: `soldi anticipati all'altro: li restituirà, non è una spesa comune`,
        rimborso: "soldi dati all'altro per pareggiare i conti",
      };
      const pickTipo = (id) => {
        st.ctipo = id;
        if (id === "rimborso") st.step = "cats";
        if (id === "rimborso") {
          const s = saldo();
          if (!st.amount && s.debitore) { st.amount = M.fmtEur(s.importo).replace(" €", "").replace(/\./g, ""); st.payer = s.debitore; }
          if (!st.descr) st.descr = "Rimborso";
        } else if (st.descr === "Rimborso") st.descr = "";
        draw();
      };
      const payLbl = { spesa: "HA PAGATO", prestito: "CHI PRESTA", rimborso: "CHI DÀ I SOLDI" }[st.ctipo];
      divNote = st.ctipo === "spesa" ? h("div.qa-divnote") : null;
      rimbNote = st.ctipo === "rimborso" ? h("div.qa-divnote") : null;
      comBox = h("div.qa-com", {},
        segRow("qa-tipo", "COS'È", TIPI, st.ctipo, pickTipo),
        h("div.qa-meaning", {}, MEANING[st.ctipo]),
        segRow("qa-payer", payLbl, [{ id: me, label: "Io" }, { id: other, label: other }], st.payer, (id) => { st.payer = id; draw(); }),
        st.ctipo === "spesa" ? segRow("qa-div", "COME SI DIVIDE", divOptions(), st.div, (id) => { st.div = id; if (id === "altro") st.editing = "custom"; draw(); }) : null,
        divNote, rimbNote);
    }

    // tutte le categorie in una griglia; nelle spese personali, scelta la categoria, al suo posto le specifiche
    const rimb = com && st.ctipo === "rimborso";
    const grid = rimb ? h("div.qa-cats") : catsBlock(com);

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
