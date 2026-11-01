// Wingman - Thunderbird add-on that learns how you file transactional mail.
// Copyright (C) 2026 Faghy
//
// This program is free software: you can redistribute it and/or modify it
// under the terms of the GNU General Public License as published by the Free
// Software Foundation, either version 3 of the License, or (at your option)
// any later version. See the LICENSE file for details.

// Export and import of the learned rules, to move them between computers that
// have the same accounts. Account ids ("account3") depend on the order in
// which accounts were created, so the file names accounts by their addresses
// and the import maps them back. Everything stays local: no AI involved.

import { listAccounts, listFolders, listTags } from "./mail.js";
import { normalizeRule, ruleId, ruleStats } from "./rules.js";
import { save, state } from "./state.js";

const FORMAT = "wingman-rules";
const ACTIONS = ["move", "archive", "delete", "tag"];
const STATUSES = ["active", "proposed", "disabled"];
const MAX_RULES = 5000;

function describeAccount(account) {
  return {
    id: account.id,
    name: account.name,
    type: account.type,
    emails: (account.identities || []).map((i) => (i.email || "").toLowerCase()).filter(Boolean),
  };
}

export async function exportRules() {
  const accounts = (await listAccounts()).map(describeAccount);
  const tags = Object.fromEntries((await listTags()).map((t) => [t.key, t.tag]));
  const used = new Set(state.rules.map((r) => r.accountId).filter(Boolean));
  return {
    format: FORMAT,
    version: 1,
    exportedAt: new Date().toISOString(),
    accounts: accounts.filter((a) => used.has(a.id)),
    tags: Object.fromEntries(state.rules.filter((r) => r.tagKey).map((r) => [r.tagKey, tags[r.tagKey] || r.tagKey])),
    rules: state.rules.map((r) => ({
      description: r.description,
      category: r.category,
      fromAddresses: r.fromAddresses,
      fromDomains: r.fromDomains,
      subjectKeywords: r.subjectKeywords,
      accountId: r.accountId,
      action: r.action,
      folderPath: r.folderPath,
      tagKey: r.tagKey,
      status: r.status,
    })),
  };
}

const str = (v) => (typeof v === "string" ? v.slice(0, 500) : "");
const strList = (v) => (Array.isArray(v) ? v.filter((s) => typeof s === "string").slice(0, 200).map((s) => s.slice(0, 300)) : []);

// The file is untrusted input: every field is checked before it becomes a rule.
export async function importRules(data) {
  if (data?.format !== FORMAT || !Array.isArray(data.rules)) throw new Error("Il file non è un'esportazione delle regole di Wingman");
  if (data.version !== 1) throw new Error("Versione del file non supportata: aggiorna Wingman");

  const local = (await listAccounts()).map(describeAccount);
  const accountMap = new Map();
  for (const exported of Array.isArray(data.accounts) ? data.accounts : []) {
    const emails = strList(exported?.emails).map((e) => e.toLowerCase());
    const match =
      (emails.length && local.find((a) => a.emails.some((e) => emails.includes(e)))) ||
      local.find((a) => a.name === str(exported?.name) && a.type === str(exported?.type));
    if (match) accountMap.set(str(exported?.id), match.id);
  }
  const accountNames = Object.fromEntries((Array.isArray(data.accounts) ? data.accounts : []).map((a) => [str(a?.id), str(a?.name)]));

  const folders = new Set();
  for (const account of local) for (const f of await listFolders(account.id)) folders.add(`${account.id}|${f.path}`);
  const localTags = await listTags();
  const tagKeys = new Set(localTags.map((t) => t.key));
  const tagByName = new Map(localTags.map((t) => [t.tag.toLowerCase(), t.key]));
  const exportedTagNames = data.tags && typeof data.tags === "object" ? data.tags : {};

  const observations = Object.values(state.observations);
  const report = { added: 0, updated: 0, skipped: [] };
  for (const raw of data.rules.slice(0, MAX_RULES)) {
    const exportedAccount = str(raw?.accountId);
    let tagKey = str(raw?.tagKey);
    if (raw?.action === "tag" && !tagKeys.has(tagKey)) tagKey = tagByName.get(str(exportedTagNames[tagKey]).toLowerCase()) || tagKey;
    const rule = normalizeRule({
      description: str(raw?.description),
      category: str(raw?.category),
      fromAddresses: strList(raw?.fromAddresses),
      fromDomains: strList(raw?.fromDomains),
      subjectKeywords: strList(raw?.subjectKeywords),
      accountId: exportedAccount ? accountMap.get(exportedAccount) || "" : "",
      action: raw?.action,
      folderPath: str(raw?.folderPath),
      tagKey,
    });
    const status = STATUSES.includes(raw?.status) ? raw.status : "proposed";
    const reason =
      (!ACTIONS.includes(rule.action) && "azione sconosciuta") ||
      (!rule.fromAddresses.length && !rule.fromDomains.length && "nessun mittente indicato") ||
      (exportedAccount && !rule.accountId && `casella «${accountNames[exportedAccount] || exportedAccount}» non presente su questo computer`) ||
      (rule.action === "move" && !folders.has(`${rule.accountId}|${rule.folderPath}`) && `cartella ${rule.folderPath} non trovata`) ||
      (rule.action === "tag" && !tagKeys.has(rule.tagKey) && `etichetta «${str(exportedTagNames[rule.tagKey]) || rule.tagKey}» non trovata`);
    if (reason) {
      report.skipped.push({ description: rule.description, reason });
      continue;
    }

    const id = ruleId(rule);
    const existing = state.rules.find((r) => r.id === id);
    if (existing) {
      Object.assign(existing, { description: rule.description, category: rule.category, status });
      if (status === "active") {
        existing.reverts = 0;
        delete existing.disabledReason;
      }
      report.updated++;
    } else {
      state.rules.push({
        ...rule,
        ...ruleStats(rule, observations),
        id,
        status,
        createdAt: Date.now(),
        applied: 0,
        reverts: 0,
      });
      report.added++;
    }
  }
  state.meta.lastImport = { at: Date.now(), ...report };
  save("rules", "meta");
  return report;
}
