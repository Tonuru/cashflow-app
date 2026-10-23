// Primo collegamento (al primo avvio) e Impostazioni.
import * as D from "../data.js";
import * as M from "../model.js";
import { h, toast, busy, confirmBox, fill, sheet } from "../ui.js";
import * as L from "../lock.js";

export function wizard(root, done) {
  const code = h("textarea.code", { rows: 4, placeholder: "CF1.…", autocapitalize: "off", autocorrect: "off", spellcheck: false });
  const dev = h("input", { type: "text", value: D.settings.device || "", placeholder: "es. IphoneMichele" });
  const err = h("div.form-err");
  const go = h("button.btn.primary.wide.big", {}, "Collega");
  go.onclick = () => busy(go, (async () => {
    err.textContent = "";
    let link;
    try { link = D.decodeCode(code.value); } catch (e) { err.textContent = e.message; return; }
    try {
      await D.call({ azione: "stato" }, link);
    } catch (e) { showErr(err, e, link); return; }
    D.saveSettings({ ...link, device: dev.value.trim() || "iPhone" });
    await D.sync();
    toast("Collegato ✓", "ok");
    done();
  })(), "Collego…");
  fill(root,
    h("div.wiz-head", {}, h("div.logo", {}, h("img", { src: "icons/logo.png", alt: "" })), h("h1", {}, "Cashflow")),
    h("div.card.wiz", {},
      h("h2", {}, "Collega il telefono"),
      h("p", {}, "Sul PC apri Cashflow → Impostazioni → «App per iPhone» e copia il codice di collegamento "
        + "(inizia con CF1.). Mandatelo sul telefono e incollalo qui."),
      h("label.field", {}, h("span", {}, "Codice di collegamento"), code),
      h("label.field", {}, h("span", {}, "Nome di questo telefono"), dev),
      h("p.muted.small", {}, "Codice e nome si inseriscono una volta sola: poi li trovi e li cambi in Impostazioni."),
      err, go,
      h("details.help", {}, h("summary", {}, "Come funziona"),
        h("p", {}, "Il programma sul PC mette in un tuo Foglio Google una copia dei dati: il telefono la legge da solo. "
          + "Le voci che aggiungi qui vanno nel foglio e il PC le scrive negli Excel su OneDrive appena è acceso. "
          + "Se qualcuno ha già cambiato la stessa voce, il PC non sovrascrive niente e te lo segnala."))));
}

export function conflictsSheet() {
  const all = D.newErrors();
  const s = sheet(all.length ? "Modifiche non applicate" : "Nessun avviso");
  fill(s.body,
    all.length ? h("p.muted", {}, "Il PC non ha scritto queste modifiche per non sovrascrivere dati cambiati da qualcun altro. "
      + "Controlla la voce e, se serve, rifai la modifica.") : null,
    h("div.list", {}, all.map((e) => h("div.conflict", {},
      h("div.small.muted", {}, `${e.quando ? M.fmtDate(String(e.quando).slice(0, 16).replace(" ", "T")) : ""} · ${e.dispositivo || ""}`),
      h("div", {}, e.messaggio)))),
    h("button.btn.primary.wide", { onclick: () => { D.markErrorsSeen(); s.close(); } }, "Ho capito"));
}

export function settingsView(root, rerender, { version, checkUpdate, restartSetup }) {
  const p = D.profile();
  const row = (k, v, btn) => h("div.set-row", {}, h("div", {}, h("div.set-k", {}, k), h("div.set-v", {}, v)), btn);
  const upd = h("div");
  const bUpd = h("button.btn.primary.wide", {}, "Controlla aggiornamenti");
  bUpd.onclick = () => busy(bUpd, checkUpdate(true).then((r) => {
    fill(upd, r && r.newer ? h("div.banner.green", {}, `Disponibile la versione ${r.version}: tocca «Aggiorna» in alto`)
      : r ? h("div.muted.small.center", {}, "Hai già l'ultima versione.") : null);
  }), "Controllo…");
  const ys = D.years("personal"), cys = D.years("comune");
  const errs = D.newErrors().length;
  fill(root,
    h("div.card", {}, h("div.card-title", {}, "Dati"),
      row("Utente", `${p.utente || "—"} · versione ${p.profilo === "tania" ? "Tania" : "Michele"}`, null),
      row("Copia dal PC", D.copyDate() ? M.fmtDate(D.copyDate()) : "non ancora arrivata", null),
      row("Anni", `personali ${ys.join(", ") || "—"} · comuni ${cys.join(", ") || "—"}`, null),
      row("Voci non ancora negli Excel", D.pendingOps().length ? `⏳ ${D.pendingOps().length}` : "nessuna ✅", null),
      row("Avvisi", errs ? `${errs} modifiche non applicate` : "nessuno", h("button.btn.small-btn", { onclick: conflictsSheet }, "Vedi")),
      h("button.btn.wide", { onclick: () => D.sync() }, "Aggiorna adesso")),
    securityCard(rerender),
    otherCard(rerender),
    h("div.card", {}, h("div.card-title", {}, "Collegamento"),
      row("Nome di questo telefono", D.settings.device, h("button.btn.small-btn", { onclick: () => editName(rerender) }, "Cambia")),
      row("Codice di collegamento", "salvato su questo telefono", h("button.btn.small-btn", { onclick: () => editCode(rerender) }, "Cambia")),
      row("Foglio Google", "collegato", h("button.btn.small-btn.danger", { onclick: async () => {
        const n = D.unsentCount();
        const msg = n ? `Ci sono ${n} voci non ancora inviate: andrebbero perse. Scollegare lo stesso?` : "Scollegare questo telefono?";
        if (await confirmBox(msg, "Scollega")) { D.resetAll(); restartSetup(); }
      } }, "Scollega"))),
    h("div.card", {}, h("div.card-title", {}, "App"),
      row("Versione installata", version, null), bUpd, upd,
      h("details.help", {}, h("summary", {}, "Come installarla sull'iPhone"),
        h("ol", {}, h("li", {}, "Apri questa pagina con Safari."), h("li", {}, "Tocca Condividi (il quadrato con la freccia)."),
          h("li", {}, "«Aggiungi alla schermata Home»."), h("li", {}, "Apri Cashflow dall'icona: si comporta come un'app.")))));
  void rerender;
}

function otherCard(rerender) {
  const p = D.profile();
  const who = p.altra_persona || "l'altra persona";
  const card = h("div.card", {}, h("div.card-title", {}, `🤝 Foglio di ${who}`));
  const on = D.otherLinked();
  const msg = on
    ? (D.status.otherError ? `⚠️ Collegato, ma ora non risponde: ${D.status.otherError}`
      : `Collegato: vedi subito le spese comuni che ${who} aggiunge dal suo telefono, anche con i PC spenti `
        + `(${D.otherPendingCount()} non ancora negli Excel).`)
    : `Incolla il codice del telefono di ${who} (lo trova nel suo Cashflow sul PC → Impostazioni → App per iPhone → `
      + "Copia) per vedere subito le sue spese comuni, anche quando i PC sono spenti.";
  fill(card, card.firstChild, h("p.muted.small", {}, msg),
    on ? h("button.btn.wide.danger", { onclick: async () => {
      if (await confirmBox(`Scollegare il foglio di ${who}?`, "Scollega")) { D.unlinkOther(); rerender(); }
    } }, "Scollega") : h("button.btn.wide.primary", { onclick: () => linkOtherSheet(who, rerender) }, `Collega il foglio di ${who}`));
  return card;
}

function linkOtherSheet(who, rerender) {
  const s = sheet(`Foglio di ${who}`);
  const code = h("textarea.code", { rows: 4, placeholder: "CF1.…", autocapitalize: "off", autocorrect: "off", spellcheck: false });
  const err = h("div.form-err");
  const b = h("button.btn.primary.wide", {}, "Collega");
  b.onclick = () => busy(b, (async () => {
    err.textContent = "";
    try { await D.linkOther(code.value); } catch (e) { showErr(err, e, null); return; }
    toast("Collegato ✓", "ok");
    s.close();
    rerender();
  })(), "Controllo…");
  fill(s.body, h("p.muted", {}, `Il codice è quello del telefono di ${who} (inizia con CF1.). Serve solo per leggere le `
    + "sue spese comuni non ancora scritte negli Excel."), h("label.field", {}, h("span", {}, "Codice"), code), err, b);
}

function editName(rerender) {
  const s = sheet("Nome di questo telefono");
  const inp = h("input", { type: "text", value: D.settings.device || "" });
  const b = h("button.btn.primary.wide", { onclick: () => {
    D.saveSettings({ device: inp.value.trim() || "iPhone" });
    toast("Nome salvato ✓", "ok");
    s.close();
    rerender();
  } }, "Salva");
  fill(s.body, h("label.field", {}, h("span", {}, "Nome (serve solo a riconoscere da dove arrivano le voci)"), inp), b);
  setTimeout(() => inp.focus(), 300);
}

function editCode(rerender) {
  const s = sheet("Codice di collegamento");
  const code = h("textarea.code", { rows: 4, placeholder: "CF1.…", autocapitalize: "off", autocorrect: "off", spellcheck: false });
  const err = h("div.form-err");
  const b = h("button.btn.primary.wide", {}, "Salva");
  b.onclick = () => busy(b, (async () => {
    err.textContent = "";
    let link;
    try { link = D.decodeCode(code.value); await D.call({ azione: "stato" }, link); }
    catch (e) { showErr(err, e, link); return; }
    D.saveSettings(link);
    await D.sync();
    toast("Codice salvato ✓", "ok");
    s.close();
    rerender();
  })(), "Controllo…");
  fill(s.body, h("p.muted", {}, "Serve solo se hai ricollegato il foglio Google dal PC. Il codice si copia da "
    + "Cashflow sul PC → Impostazioni → App per iPhone."), h("label.field", {}, h("span", {}, "Nuovo codice"), code), err, b);
}

function securityCard(rerender) {
  const st = L.lockSettings();
  const on = L.needsLock();
  const card = h("div.card", {}, h("div.card-title", {}, "🔒 Blocco con Face ID"));
  const msg = h("div.form-err");
  const toggle = h("button.btn.wide" + (on ? "" : ".primary"), {}, on ? "Disattiva Face ID" : "Attiva Face ID");
  toggle.onclick = () => busy(toggle, (async () => {
    msg.textContent = "";
    try {
      if (on) {
        if (!(await L.verify())) return;
        L.disable();
        toast("Face ID disattivato");
      } else {
        if (!(await L.supported())) { msg.textContent = "Questo telefono non permette Face ID alle app web (serve iOS 16 o più recente e Face ID attivo)."; return; }
        await L.enable(D.settings.device || D.profile().utente);
        toast("Face ID attivo ✓", "ok");
      }
      rerender();
    } catch (e) {
      msg.textContent = e.name === "NotAllowedError" ? "Annullato." : e.message;
    }
  })(), "Attendi…");
  const opts = [[0, "Subito"], [60, "Dopo 1 minuto"], [300, "Dopo 5 minuti"], [900, "Dopo 15 minuti"]];
  const sel = h("select", { onchange: (e) => { L.setAfter(Number(e.target.value)); toast("Salvato ✓", "ok"); } },
    opts.map(([v, t]) => h("option", { value: v }, t)));
  sel.value = String(st.after ?? 60);
  fill(card, card.firstChild,
    h("p.muted.small", {}, on ? "Attivo: per aprire Cashflow serve il tuo volto (o il codice dell'iPhone se Face ID non riesce)."
      : "Per aprire Cashflow servirà il tuo volto. La prima volta l'iPhone chiede il permesso e salva una chiave d'accesso "
        + "per Cashflow nel portachiavi."),
    on ? h("label.field", {}, h("span", {}, "Quando torni nell'app, chiedi Face ID"), sel) : null,
    toggle, msg);
  return card;
}

/** Errore di collegamento: se il foglio non risponde, pulsante per aprire l'indirizzo dello script in Safari. */
function showErr(box, e, link) {
  fill(box, h("div", {}, e.message),
    e.unreachable && link?.url ? h("div.small.muted", {}, "Indirizzo nel codice: " + link.url.replace(/^https:\/\//, "").slice(0, 60) + "…") : null,
    e.unreachable && link?.url ? h("a.btn.wide", { href: link.url, target: "_blank", rel: "noopener" }, "Prova l'indirizzo") : null,
    e.unreachable ? h("div.small.muted", {}, "Se si apre una pagina con scritto «Codice segreto sbagliato o foglio non collegato», "
      + "lo script funziona: riprova. Se invece compare l'accesso a Google o un errore, sul PC va cambiata la distribuzione "
      + "dello script (Gestisci deployment → Chi può accedere: Chiunque).") : null);
}
