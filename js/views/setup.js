// Prima configurazione (al primo avvio) e Impostazioni.
import * as D from "../data.js";
import * as G from "../graph.js";
import * as M from "../model.js";
import { h, sheet, toast, busy, confirmBox, fill } from "../ui.js";

const PROFILI = [{ value: "michele", label: "Michele (stipendio, extra, investimenti)" }, { value: "tania", label: "Tania (entrate e spese)" }];

// ---------------------------------------------------------------- scelta di una cartella su OneDrive
export function pickFolder(title) {
  return new Promise((resolve) => {
    const s = sheet(title, { onClose: () => resolve(null) });
    const stack = [];   // [{ref, name}]
    const draw = async () => {
      const cur = stack[stack.length - 1];
      fill(s.body, h("div.muted.center", {}, "Caricamento…"));
      try {
        let entries, files = [];
        if (!cur) {
          const [mine, shared] = await Promise.all([G.children(null), G.sharedWithMe().catch(() => [])]);
          entries = mine.filter((i) => i.folder || i.remoteItem?.folder).map((i) => ({ ref: G.refOf(i), name: i.name }));
          const sh = shared.filter((i) => i.remoteItem?.folder).map((i) => ({ ref: G.refOf(i), name: i.name, shared: true }));
          entries = entries.concat(sh.filter((x) => !entries.some((e) => e.ref.id === x.ref.id)));
        } else {
          const items = await G.children(cur.ref);
          entries = items.filter((i) => i.folder || i.remoteItem?.folder).map((i) => ({ ref: G.refOf(i), name: i.name }));
          files = items.filter((i) => i.file && /\.xlsx$/i.test(i.name)).map((i) => i.name);
        }
        const path = ["OneDrive", ...stack.map((x) => x.name)].join(" › ");
        const xl = files.filter((n) => /^Cashflow_/i.test(n));
        fill(s.body, 
          h("div.crumb", {}, stack.length ? h("button.btn.small-btn", { onclick: () => { stack.pop(); draw(); } }, "‹ Su") : null,
            h("span", {}, path)),
          cur ? h("div.muted.small", {}, xl.length ? `File Cashflow qui: ${xl.join(", ")}` : "Nessun file Cashflow in questa cartella.") : null,
          h("div.list", {}, entries.length ? entries.map((e) => h("button.item", { onclick: () => { stack.push(e); draw(); } },
            h("div.item-main", {}, h("div.item-title", {}, "📁 " + e.name), e.shared ? h("div.item-sub", {}, "condivisa con te") : null),
            h("div.item-amt", {}, "›"))) : h("div.empty", {}, "Nessuna sottocartella.")),
          cur ? h("button.btn.primary.wide", { onclick: () => { resolve({ ...cur.ref, path: stack.map((x) => x.name).join("/") }); s.close(); } },
            `Usa «${cur.name}»`) : null);
      } catch (e) {
        fill(s.body, h("div.form-err", {}, e.message));
      }
    };
    draw();
  });
}

async function describeFolder(ref, kind) {
  try {
    const items = await G.children(ref);
    const ys = items.filter((i) => i.file && D.yearOfName(kind, i.name)).map((i) => D.yearOfName(kind, i.name)).sort();
    return ys.length ? `trovati gli anni ${ys.join(", ")}` : "nessun file Cashflow trovato qui";
  } catch (e) { return e.message; }
}

// ---------------------------------------------------------------- procedura guidata
export function wizard(root, done) {
  const st = { step: D.settings.clientId ? (G.isLoggedIn() ? 3 : 2) : 1 };
  const steps = ["App Microsoft", "Accesso", "Utente", "Cartelle"];
  const draw = () => {
    const head = h("div.wiz-head", {}, h("div.logo", {}, "💶"), h("h1", {}, "Cashflow"),
      h("div.steps", {}, steps.map((n, i) => h("span" + (i + 1 === st.step ? ".on" : i + 1 < st.step ? ".done" : ""), {}, `${i + 1}. ${n}`))));
    const body = h("div.card.wiz");
    fill(root, head, body);
    ({ 1: stepClient, 2: stepLogin, 3: stepUser, 4: stepFolders })[st.step](body, (n) => { st.step = n; draw(); }, done);
  };
  draw();
}

function stepClient(body, go) {
  const inp = h("input", { type: "text", value: D.settings.clientId, placeholder: "es. 1a2b3c4d-…", autocapitalize: "off", autocorrect: "off", spellcheck: false });
  const err = h("div.form-err");
  fill(body, h("h2", {}, "Collega OneDrive"),
    h("p", {}, "Incolla l'Application (client) ID dell'app «Cashflow iPhone» registrata su Microsoft Entra."),
    h("label.field", {}, h("span", {}, "Client ID"), inp),
    h("details.help", {}, h("summary", {}, "Come lo trovo?"),
      h("ol", {}, h("li", {}, "Apri entra.microsoft.com con il tuo account Microsoft."),
        h("li", {}, "App registrations → Cashflow iPhone."),
        h("li", {}, "Copia «Application (client) ID»."),
        h("li", {}, `Il Redirect URI (Single-page application) deve essere: ${G.redirectUri()}`))),
    err, h("button.btn.primary.wide", { onclick: () => {
      const v = inp.value.trim();
      if (!/^[0-9a-f-]{32,36}$/i.test(v)) { err.textContent = "Il Client ID è un codice tipo 1a2b3c4d-1234-…"; return; }
      D.saveSettings({ clientId: v });
      G.configure({ clientId: v });
      go(2);
    } }, "Avanti"));
}

function stepLogin(body, go) {
  fill(body, h("h2", {}, "Accedi"),
    h("p", {}, "Accedi con l'account Microsoft del tuo OneDrive. L'app legge e scrive solo i file Cashflow che scegli."),
    h("button.btn.primary.wide.big", { onclick: () => G.login("select_account") }, "Accedi con Microsoft"),
    h("button.btn.wide", { onclick: () => go(1) }, "‹ Cambia Client ID"));
}

async function findSettingsCopies() {
  try {
    const items = await G.search("Cashflow_impostazioni_");
    return items.filter((i) => /^Cashflow_impostazioni_.*\.json$/i.test(i.name));
  } catch { return []; }
}

function stepUser(body, go) {
  const nome = h("input", { type: "text", value: D.settings.utente || "Michele", autocapitalize: "words" });
  const prof = h("select", {}, PROFILI.map((p) => h("option", { value: p.value }, p.label)));
  prof.value = D.settings.profilo || "michele";
  const altra = h("input", { type: "text", value: D.settings.altra_persona || "Tania" });
  const found = h("div", {}, h("div.muted.small", {}, "Cerco le impostazioni dell'app sul PC…"));
  const err = h("div.form-err");
  fill(body, h("h2", {}, "Chi sei"), found,
    h("label.field", {}, h("span", {}, "Il tuo nome (come nei file: Cashflow_<Nome>_anno.xlsx)"), nome),
    h("label.field", {}, h("span", {}, "Versione"), prof),
    h("label.field", {}, h("span", {}, "L'altra persona delle spese comuni"), altra),
    err, h("button.btn.primary.wide", { onclick: () => {
      if (!nome.value.trim()) { err.textContent = "Scrivi il tuo nome."; return; }
      D.saveSettings({ utente: nome.value.trim(), profilo: prof.value, altra_persona: altra.value.trim() });
      go(4);
    } }, "Avanti"));
  // impostazioni copiate su OneDrive dall'app desktop: un tocco e sono già compilate
  findSettingsCopies().then(async (list) => {
    if (!list.length) { fill(found, h("div.muted.small", {}, "Nessuna impostazione del PC trovata: compila a mano.")); return; }
    fill(found, h("div.sub-title", {}, "Trovate le impostazioni dell'app sul PC:"),
      ...list.map((it) => h("button.item", { onclick: async (e) => {
        const b = e.currentTarget;
        b.disabled = true;
        try {
          const j = JSON.parse(new TextDecoder().decode(await G.download(it)));
          nome.value = j.utente || nome.value;
          prof.value = j.profilo === "tania" ? "tania" : "michele";
          altra.value = j.altra_persona || altra.value;
          // la copia delle impostazioni sta proprio nella cartella dei file personali
          const rel = G.oneDriveRelative(j.cartella) || "";
          const personal = { driveId: it.parentReference.driveId, id: it.parentReference.id,
            name: rel.split("/").pop() || "Cashflow", path: rel };
          let comune = null;
          const relC = G.oneDriveRelative(j.cartella_comune);
          if (relC) {
            try { const ci = await G.itemByPath(relC); comune = { ...G.refOf(ci), path: relC }; } catch { /* la sceglie a mano */ }
          }
          D.saveSettings({ utente: nome.value, profilo: prof.value, altra_persona: altra.value, personal,
            comune, comuneOff: !j.cartella_comune });
          toast("Impostazioni del PC caricate ✓", "ok");
          go(4);
        } catch (er) { err.textContent = er.message; b.disabled = false; }
      } }, h("div.item-main", {}, h("div.item-title", {}, it.name.replace(/^Cashflow_impostazioni_|\.json$/gi, "")),
        h("div.item-sub", {}, "tocca per usarle")), h("div.item-amt", {}, "›"))));
  });
}

function stepFolders(body, go, done) {
  const pInfo = h("div.muted.small", {}, "");
  const cInfo = h("div.muted.small", {}, "");
  const draw = () => {
    const p = D.settings.personal, c = D.settings.comune;
    fill(body, h("h2", {}, "Cartelle su OneDrive"),
      h("div.sub-title", {}, `File personali (Cashflow_${D.safeName(D.settings.utente)}_anno.xlsx)`),
      h("div.folder", {}, h("span", {}, p ? "📁 " + (p.path || p.name) : "non scelta"),
        h("button.btn.small-btn", { onclick: async () => { const r = await pickFolder("Cartella dei file personali"); if (r) { D.saveSettings({ personal: r }); draw(); } } }, "Scegli")),
      pInfo,
      h("div.sub-title", {}, "Spese comuni (Cashflow_Comune_anno.xlsx)"),
      h("div.folder", {}, h("span", {}, D.settings.comuneOff ? "non usate" : c ? "📁 " + (c.path || c.name) : "non scelta"),
        h("button.btn.small-btn", { onclick: async () => { const r = await pickFolder("Cartella delle spese comuni"); if (r) { D.saveSettings({ comune: r, comuneOff: false }); draw(); } } }, "Scegli")),
      cInfo,
      h("label.check", {}, h("input", { type: "checkbox", checked: D.settings.comuneOff,
        onchange: (e) => { D.saveSettings({ comuneOff: e.target.checked }); draw(); } }), " Non uso le spese comuni"),
      h("button.btn.primary.wide.big", { disabled: !p, onclick: () => { D.clearCache(); done(); } }, "Inizia"),
      h("button.btn.wide", { onclick: () => go(3) }, "‹ Indietro"));
    if (p) describeFolder(p, "personal").then((t) => { pInfo.textContent = t; });
    if (c && !D.settings.comuneOff) describeFolder(c, "comune").then((t) => { cInfo.textContent = t; });
  };
  draw();
}

// ---------------------------------------------------------------- Impostazioni
export function settingsView(root, rerender, { version, checkUpdate, restartSetup }) {
  const st = D.settings;
  const row = (k, v, btn) => h("div.set-row", {}, h("div", {}, h("div.set-k", {}, k), h("div.set-v", {}, v)), btn);
  const acc = h("span", {}, "…");
  G.me().then((u) => { acc.textContent = `${u.displayName || ""} (${u.userPrincipalName || ""})`; }).catch(() => { acc.textContent = "non collegato"; });
  const upd = h("div");
  const bUpd = h("button.btn.primary.wide", {}, "Controlla aggiornamenti");
  bUpd.onclick = () => busy(bUpd, checkUpdate(true).then((r) => {
    fill(upd, r && r.newer ? h("div.banner.green", {}, `Disponibile la versione ${r.version}`) : h("div.muted.small.center", {}, "Hai già l'ultima versione."));
  }), "Controllo…");
  const ys = D.years("personal");
  const cys = D.years("comune");
  fill(root, 
    h("div.card", {}, h("div.card-title", {}, "Utente"),
      row("Nome", st.utente, null),
      row("Versione", st.profilo === "tania" ? "Tania" : "Michele", h("button.btn.small-btn", { onclick: () => {
        D.saveSettings({ profilo: st.profilo === "tania" ? "michele" : "tania" }); rerender(); } }, "Cambia")),
      row("Altra persona (spese comuni)", st.altra_persona || "—", null),
      h("button.btn.wide", { onclick: restartSetup }, "Rifai la configurazione guidata")),
    h("div.card", {}, h("div.card-title", {}, "OneDrive"),
      row("Account", acc, h("button.btn.small-btn", { onclick: async () => {
        if (await confirmBox("Uscire dall'account Microsoft?", "Esci")) { G.logout(); location.reload(); } } }, "Esci")),
      row("File personali", `${st.personal?.path || st.personal?.name || "—"} · anni ${ys.join(", ") || "nessuno"}`,
        h("button.btn.small-btn", { onclick: async () => { const r = await pickFolder("Cartella dei file personali"); if (r) { D.saveSettings({ personal: r }); D.clearCache(); await D.sync(); rerender(); } } }, "Cambia")),
      row("Spese comuni", st.comuneOff ? "non usate" : `${st.comune?.path || st.comune?.name || "—"} · anni ${cys.join(", ") || "nessuno"}`,
        h("button.btn.small-btn", { onclick: async () => { const r = await pickFolder("Cartella delle spese comuni"); if (r) { D.saveSettings({ comune: r, comuneOff: false }); D.clearCache(); await D.sync(); rerender(); } } }, "Cambia")),
      row("Client ID app Microsoft", st.clientId, null),
      h("button.btn.wide", { onclick: async () => { D.clearCache(); await D.sync(); rerender(); toast("Dati riletti da OneDrive ✓", "ok"); } }, "Rileggi tutto da OneDrive")),
    h("div.card", {}, h("div.card-title", {}, "App"),
      row("Versione installata", version, null), bUpd, upd,
      h("details.help", {}, h("summary", {}, "Come installarla sull'iPhone"),
        h("ol", {}, h("li", {}, "Apri questa pagina con Safari."), h("li", {}, "Tocca Condividi (il quadrato con la freccia)."),
          h("li", {}, "«Aggiungi alla schermata Home»."), h("li", {}, "Apri Cashflow dall'icona: si comporta come un'app.")))),
    h("div.muted.small.center", {}, `Ultimo aggiornamento dati: ${D.status.last ? M.fmtDate(D.status.last) : "mai"}`));
}
