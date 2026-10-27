// Wingman - Thunderbird add-on that learns how you file transactional mail.
// Copyright (C) 2026 Faghy
//
// This program is free software: you can redistribute it and/or modify it
// under the terms of the GNU General Public License as published by the Free
// Software Foundation, either version 3 of the License, or (at your option)
// any later version. See the LICENSE file for details.

// In-memory state backed by storage.local. The background page is persistent,
// so we load once and write back with a short debounce.

export const DEFAULT_SETTINGS = {
  apiKey: "",
  model: "claude-opus-5-5",
  mode: "auto", // "auto" applies rules, "suggest" only logs what it would do
  disabledAccounts: [],
  historyDays: 180,
  maxPerFolder: 1000,
  minSupport: 3,
  minConfidence: 0.85,
  autoActivate: true,
  autoActivateDelete: false,
  aiForUnmatched: true,
  aiMinConfidence: 0.85,
  maxAiCallsPerHour: 60,
  learnEveryHours: 24,
};

const DEFAULTS = {
  settings: DEFAULT_SETTINGS,
  observations: {}, // headerMessageId -> observation of what the user did
  rules: [],
  log: [],
  agentHids: {}, // headerMessageId -> ts, messages the agent handled (excluded from learning)
  meta: {},
};

const LOG_LIMIT = 300;
const AGENT_HIDS_LIMIT = 10000;

export const state = {};
let loading;
const timers = {};

export function init() {
  loading ||= browser.storage.local.get(Object.keys(DEFAULTS)).then((stored) => {
    for (const key of Object.keys(DEFAULTS)) {
      state[key] = stored[key] ?? structuredClone(DEFAULTS[key]);
    }
    state.settings = { ...DEFAULT_SETTINGS, ...state.settings };
  });
  return loading;
}

export function save(...keys) {
  for (const key of keys) {
    clearTimeout(timers[key]);
    timers[key] = setTimeout(() => browser.storage.local.set({ [key]: state[key] }), 1000);
  }
}

export function pushLog(entry) {
  state.log.unshift(entry);
  state.log.length = Math.min(state.log.length, LOG_LIMIT);
  save("log");
}

export function rememberAgentHid(hid) {
  state.agentHids[hid] = Date.now();
  const entries = Object.entries(state.agentHids);
  if (entries.length > AGENT_HIDS_LIMIT) {
    entries.sort((a, b) => a[1] - b[1]);
    for (const [old] of entries.slice(0, entries.length - AGENT_HIDS_LIMIT)) delete state.agentHids[old];
  }
  save("agentHids");
}

export function accountEnabled(accountId) {
  return !!accountId && !state.settings.disabledAccounts.includes(accountId);
}
