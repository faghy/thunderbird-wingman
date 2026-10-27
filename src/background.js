// Wingman - Thunderbird add-on that learns how you file transactional mail.
// Copyright (C) 2026 Faghy
//
// This program is free software: you can redistribute it and/or modify it
// under the terms of the GNU General Public License as published by the Free
// Software Foundation, either version 3 of the License, or (at your option)
// any later version. See the LICENSE file for details.

import { applySuggestion, handleDeleted, handleMoved, handleNewMail, handleUpdated, undo } from "./agent.js";
import { checkApiKey, describeApiError } from "./llm.js";
import { learnRules, refreshRuleStats, scanHistory } from "./learner.js";
import { listAccounts, listFolders, listTags } from "./mail.js";
import { DEFAULT_SETTINGS, init, save, state } from "./state.js";

const ready = init();
const withState = (fn) => async (...args) => {
  await ready;
  return fn(...args);
};

// Listeners are registered synchronously, at the top level.
messenger.messages.onNewMailReceived.addListener(withState(handleNewMail));
messenger.messages.onMoved.addListener(withState(handleMoved));
messenger.messages.onDeleted.addListener(withState(handleDeleted));
messenger.messages.onUpdated.addListener(withState(handleUpdated));
messenger.browserAction.onClicked.addListener(() => messenger.runtime.openOptionsPage());
messenger.runtime.onInstalled.addListener(({ reason }) => {
  if (reason === "install") messenger.runtime.openOptionsPage();
});

let busy = false;

async function runLearning({ withAI }) {
  if (busy) throw new Error("Analisi già in corso");
  busy = true;
  state.meta.lastError = "";
  try {
    await scanHistory();
    if (withAI) {
      await learnRules();
      state.meta.lastLearnAt = Date.now();
    } else {
      refreshRuleStats();
    }
  } catch (error) {
    state.meta.lastError = describeApiError(error);
    throw error;
  } finally {
    busy = false;
    state.meta.progress = "";
    save("meta");
  }
}

async function maybeLearn() {
  await ready;
  const { apiKey, learnEveryHours } = state.settings;
  if (busy || !apiKey) return;
  if (Date.now() - (state.meta.lastLearnAt || 0) < learnEveryHours * 3600 * 1000) return;
  await runLearning({ withAI: true }).catch(() => {});
}
setTimeout(maybeLearn, 60 * 1000);
setInterval(maybeLearn, 30 * 60 * 1000);

async function describeMailboxes() {
  const accounts = [];
  const folderNames = {};
  for (const account of await listAccounts()) {
    accounts.push({ id: account.id, name: account.name });
    for (const folder of await listFolders(account.id)) {
      folderNames[`${account.id}|${folder.path}`] = `${account.name}${folder.path}`;
    }
  }
  const tags = Object.fromEntries((await listTags()).map((t) => [t.key, { name: t.tag, color: t.color }]));
  return { accounts, folderNames, tags };
}

const commands = {
  async getState() {
    return {
      settings: state.settings,
      rules: state.rules,
      log: state.log.slice(0, 150),
      meta: state.meta,
      busy,
      observationCount: Object.keys(state.observations).length,
      ...(await describeMailboxes()),
    };
  },
  async saveSettings({ settings }) {
    const allowed = Object.keys(DEFAULT_SETTINGS);
    for (const key of allowed) if (key in settings) state.settings[key] = settings[key];
    save("settings");
  },
  async checkApiKey({ apiKey, model }) {
    await checkApiKey(apiKey, model);
  },
  async learn() {
    runLearning({ withAI: true }).catch(() => {});
  },
  async scan() {
    runLearning({ withAI: false }).catch(() => {});
  },
  async setRuleStatus({ id, status }) {
    const rule = state.rules.find((r) => r.id === id);
    if (!rule) return;
    rule.status = status;
    if (status === "active") {
      rule.reverts = 0;
      delete rule.disabledReason;
    }
    save("rules");
  },
  async deleteRule({ id }) {
    state.rules = state.rules.filter((r) => r.id !== id);
    save("rules");
  },
  undo: ({ id }) => undo(id),
  applySuggestion: ({ id }) => applySuggestion(id),
  async resetLearning() {
    Object.assign(state, { observations: {}, rules: [], log: [], agentHids: {}, meta: {} });
    save("observations", "rules", "log", "agentHids", "meta");
  },
};

messenger.runtime.onMessage.addListener(async (message) => {
  await ready;
  const command = commands[message?.cmd];
  if (!command) return { error: "Comando sconosciuto" };
  try {
    return { ok: true, result: await command(message) };
  } catch (error) {
    return { error: describeApiError(error) };
  }
});
