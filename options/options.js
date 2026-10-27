// Wingman - Thunderbird add-on that learns how you file transactional mail.
// Copyright (C) 2026 Faghy
//
// This program is free software: you can redistribute it and/or modify it
// under the terms of the GNU General Public License as published by the Free
// Software Foundation, either version 3 of the License, or (at your option)
// any later version. See the LICENSE file for details.

// Options page. Mail subjects and senders are untrusted, so everything is
// rendered with textContent, never innerHTML.

const ACTION_LABELS = { move: "Sposta in", archive: "Archivia", delete: "Cestina", tag: "Etichetta" };
const RULE_STATUS = { active: "attiva", proposed: "proposta", disabled: "disattivata" };
const LOG_STATUS = { applied: "applicata", suggested: "suggerita", undone: "annullata", reverted: "ripristinata da te", error: "errore" };

let view = null;
let consentDismissed = false;
let pollTimer = null;

async function send(cmd, payload = {}) {
  const reply = await messenger.runtime.sendMessage({ cmd, ...payload });
  if (reply?.error) throw new Error(reply.error);
  return reply?.result;
}

function el(tag, props = {}, ...children) {
  const node = document.createElement(tag);
  for (const [key, value] of Object.entries(props)) {
    if (key === "class") node.className = value;
    else if (key.startsWith("on")) node.addEventListener(key.slice(2), value);
    else node[key] = value;
  }
  for (const child of children.flat()) {
    if (child != null && child !== false) node.append(child instanceof Node ? child : String(child));
  }
  return node;
}

function formatDate(ts) {
  return ts ? new Date(ts).toLocaleString("it-IT", { dateStyle: "short", timeStyle: "short" }) : "mai";
}

function targetLabel(rule) {
  if (rule.action === "move") return view.folderNames[`${rule.accountId}|${rule.folderPath}`] || rule.folderPath;
  if (rule.action === "tag") return view.tags[rule.tagKey]?.name || rule.tagKey;
  return "";
}

function accountLabel(id) {
  return view.accounts.find((a) => a.id === id)?.name || "";
}

function action(label, fn, cls = "small") {
  return el("button", {
    class: cls,
    onclick: async (event) => {
      event.target.disabled = true;
      try {
        await fn();
      } catch (error) {
        alert(error.message);
      }
      await refresh();
    },
  }, label);
}

function renderStatus() {
  const { meta, busy, observationCount, settings, consented } = view;
  const box = document.getElementById("status");
  box.replaceChildren(...[
    el("div", {}, busy ? `In corso: ${meta.progress || "analisi…"}` : `Messaggi osservati: ${observationCount}. Ultima analisi AI: ${formatDate(meta.lastLearnAt)}.`),
    !settings.apiKey && el("div", { class: "error" }, "Inserisci la chiave API nelle impostazioni per abilitare l'apprendimento."),
    !consented && el("div", { class: "error" }, "AI disattivata: manca il consenso all'invio dei dati. Le regole già attive continuano a funzionare."),
    meta.lastError && el("div", { class: "error" }, `Ultimo errore: ${meta.lastError}`),
  ].filter(Boolean)); // replaceChildren() would print false/undefined
  document.getElementById("learn").disabled = busy || !settings.apiKey || !consented;
  document.getElementById("scan").disabled = busy;

  const report = meta.lastLearn;
  document.getElementById("learn-report").replaceChildren(
    report
      ? el("details", {},
          el("summary", {}, `Ultimo apprendimento: ${report.accepted} regole accettate, ${report.rejected.length} scartate${report.note ? ` — ${report.note}` : ""}`),
          el("ul", {}, report.rejected.map((r) => el("li", {}, `${r.description || "(senza descrizione)"} — ${r.reason}`))))
      : "",
  );
}

function renderRules() {
  const order = { active: 0, proposed: 1, disabled: 2 };
  const rules = [...view.rules].sort((a, b) => order[a.status] - order[b.status] || b.support - a.support);
  const rows = rules.map((rule) => {
    const senders = [...rule.fromAddresses, ...rule.fromDomains.map((d) => `@${d}`)].join(", ");
    return el("tr", {},
      el("td", {},
        el("strong", {}, rule.category || "—"), " ", rule.description,
        el("small", {}, `Mittenti: ${senders}`),
        rule.subjectKeywords.length > 0 && el("small", {}, `Oggetto contiene: ${rule.subjectKeywords.join(", ")}`),
        rule.accountId && el("small", {}, `Solo casella: ${accountLabel(rule.accountId)}`),
        rule.examples?.length > 0 && el("small", {}, `Esempi: ${rule.examples.join(" · ")}`)),
      el("td", {}, ACTION_LABELS[rule.action], " ", el("em", {}, targetLabel(rule))),
      el("td", {}, `${rule.support} casi`, el("small", {}, `${Math.round(rule.confidence * 100)}% coerente`)),
      el("td", {}, rule.applied || 0, rule.reverts ? el("small", {}, `${rule.reverts} annullate`) : ""),
      el("td", {}, el("span", { class: `badge ${rule.status}` }, RULE_STATUS[rule.status]), rule.disabledReason && el("small", {}, rule.disabledReason)),
      el("td", {},
        rule.status !== "active"
          ? action("Attiva", () => send("setRuleStatus", { id: rule.id, status: "active" }))
          : action("Disattiva", () => send("setRuleStatus", { id: rule.id, status: "disabled" })),
        " ",
        action("Elimina", () => send("deleteRule", { id: rule.id }))),
    );
  });
  document.getElementById("rules").replaceChildren(
    ...(rows.length ? rows : [el("tr", {}, el("td", { colSpan: 6, class: "muted" }, "Nessuna regola ancora. Avvia un'analisi."))]),
  );
}

function renderLog() {
  const rulesById = Object.fromEntries(view.rules.map((r) => [r.id, r]));
  const rows = view.log.map((entry) => {
    const rule = rulesById[entry.ruleId];
    return el("tr", {},
      el("td", {}, formatDate(entry.ts)),
      el("td", {}, entry.subject || "(senza oggetto)", el("small", {}, entry.from)),
      el("td", {}, ACTION_LABELS[entry.action], " ", rule ? el("em", {}, targetLabel(rule)) : "",
        el("small", {}, `tramite ${entry.via}${entry.reason ? `: ${entry.reason}` : ""}`)),
      el("td", {}, el("span", { class: `badge ${entry.status}` }, LOG_STATUS[entry.status]), entry.error && el("small", {}, entry.error)),
      el("td", {},
        entry.status === "applied" && action("Annulla", () => send("undo", { id: entry.id })),
        entry.status === "suggested" && action("Applica", () => send("applySuggestion", { id: entry.id }))),
    );
  });
  document.getElementById("log").replaceChildren(
    ...(rows.length ? rows : [el("tr", {}, el("td", { colSpan: 5, class: "muted" }, "Ancora nessuna attività."))]),
  );
}

function renderConsent() {
  const { consented } = view;
  const { aiConsentAt } = view.settings;
  document.getElementById("consent").hidden = consented || consentDismissed;
  document.getElementById("consent-status").replaceChildren(
    consented
      ? el("span", { class: "muted" }, `Consenso all'invio dei dati all'AI dato il ${formatDate(aiConsentAt)}.`)
      : el("span", { class: "muted" }, "Nessun consenso all'invio dei dati all'AI: Wingman lavora solo in locale."),
    consented
      ? action("Revoca consenso", () => send("setConsent", { granted: false }))
      : action("Mostra informativa e consenso", async () => {
          consentDismissed = false;
          renderConsent();
          document.getElementById("consent").scrollIntoView();
        }),
  );
}

function renderSettings() {
  const form = document.getElementById("settings");
  if (form.dataset.loaded) return; // don't overwrite what the user is typing
  form.dataset.loaded = "1";
  const { settings } = view;
  for (const input of form.elements) {
    if (!input.name || !(input.name in settings)) continue;
    const value = settings[input.name];
    if (input.type === "checkbox") input.checked = value;
    else input.value = "percent" in input.dataset ? Math.round(value * 100) : value;
  }
  document.getElementById("accounts").replaceChildren(
    ...view.accounts.map((account) =>
      el("label", { class: "check" },
        el("input", { type: "checkbox", value: account.id, checked: !settings.disabledAccounts.includes(account.id) }),
        account.name)),
  );
}

function readSettings() {
  const form = document.getElementById("settings");
  const settings = {};
  for (const input of form.elements) {
    if (!input.name) continue;
    if (input.type === "checkbox") settings[input.name] = input.checked;
    else if (input.type === "number") settings[input.name] = Number(input.value) / ("percent" in input.dataset ? 100 : 1);
    else settings[input.name] = input.value.trim();
  }
  settings.disabledAccounts = [...document.querySelectorAll("#accounts input")].filter((i) => !i.checked).map((i) => i.value);
  return settings;
}

async function refresh() {
  view = await send("getState");
  renderStatus();
  renderRules();
  renderLog();
  renderConsent();
  renderSettings();
  clearTimeout(pollTimer);
  pollTimer = setTimeout(refresh, view.busy ? 1500 : 10000);
}

document.getElementById("settings").addEventListener("submit", async (event) => {
  event.preventDefault();
  await send("saveSettings", { settings: readSettings() });
  document.getElementById("saved").textContent = "Salvato.";
  setTimeout(() => (document.getElementById("saved").textContent = ""), 2000);
  await refresh();
});

document.getElementById("check-key").addEventListener("click", async () => {
  const { apiKey, model } = readSettings();
  try {
    await send("checkApiKey", { apiKey, model });
    alert("Chiave valida.");
  } catch (error) {
    alert(error.message);
  }
});

document.getElementById("learn").addEventListener("click", async () => {
  await send("learn");
  await refresh();
});

document.getElementById("scan").addEventListener("click", async () => {
  await send("scan");
  await refresh();
});

document.getElementById("consent-yes").addEventListener("click", async () => {
  await send("setConsent", { granted: true });
  await refresh();
});

document.getElementById("consent-no").addEventListener("click", () => {
  consentDismissed = true;
  renderConsent();
});

document.getElementById("reset").addEventListener("click", async () => {
  if (!confirm("Eliminare regole, osservazioni e attività? Le mail non vengono toccate.")) return;
  await send("resetLearning");
  await refresh();
});

refresh();
