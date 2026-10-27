// Wingman - Thunderbird add-on that learns how you file transactional mail.
// Copyright (C) 2026 Faghy
//
// This program is free software: you can redistribute it and/or modify it
// under the terms of the GNU General Public License as published by the Free
// Software Foundation, either version 3 of the License, or (at your option)
// any later version. See the LICENSE file for details.

import { folderKind, parseAddress, subjectTemplate } from "./mail.js";

export const FOLDER_ACTIONS = ["move", "archive", "delete"];

const KIND_TO_ACTION = { inbox: "keep", trash: "delete", archives: "archive", normal: "move" };
const FRESH_INBOX_MS = 2 * 24 * 3600 * 1000;

// What the user did with a message, judged from where it sits now.
// Returns null when the message says nothing about the user's habits
// (sent/drafts/junk, or still unread or fresh in the inbox).
export function toObservation(message, folder, source) {
  const action = KIND_TO_ACTION[folderKind(folder)];
  if (!action) return null;
  const date = new Date(message.date).getTime() || Date.now();
  if (action === "keep" && (!message.read || Date.now() - date < FRESH_INBOX_MS)) return null;
  const { email, domain } = parseAddress(message.author);
  if (!email) return null;
  return {
    hid: message.headerMessageId,
    accountId: folder.accountId,
    from: email,
    domain,
    subject: subjectTemplate(message.subject),
    action,
    path: action === "move" ? folder.path : "",
    tags: message.tags || [],
    date,
    source,
  };
}

export function ruleMatches(rule, facts) {
  if (rule.accountId && rule.accountId !== facts.accountId) return false;
  const bySender =
    rule.fromAddresses.includes(facts.from) ||
    rule.fromDomains.some((d) => facts.domain === d || facts.domain.endsWith("." + d));
  if (!bySender) return false;
  if (!rule.subjectKeywords.length) return true;
  const subject = (facts.subject || "").toLowerCase();
  return rule.subjectKeywords.some((k) => subject.includes(k));
}

function outcomeMatches(rule, obs) {
  if (rule.action === "move") {
    return obs.action === "move" && obs.accountId === rule.accountId && obs.path === rule.folderPath;
  }
  return obs.action === rule.action;
}

// How well the user's own history backs a rule.
export function ruleStats(rule, observations) {
  let support = 0;
  let contra = 0;
  const examples = [];
  for (const obs of observations) {
    if (!ruleMatches(rule, obs)) continue;
    const agrees = rule.action === "tag" ? obs.tags.includes(rule.tagKey) : outcomeMatches(rule, obs);
    if (agrees) {
      support++;
      if (examples.length < 5 && !examples.includes(obs.subject)) examples.push(obs.subject);
    } else {
      contra++;
    }
  }
  return { support, contra, confidence: support / (support + contra || 1), examples };
}

export function normalizeRule(raw) {
  const clean = (list) => [...new Set((list || []).map((s) => s.trim().toLowerCase()).filter(Boolean))].sort();
  return {
    description: raw.description?.trim() || "",
    category: raw.category?.trim() || "",
    fromAddresses: clean(raw.fromAddresses),
    fromDomains: clean(raw.fromDomains).map((d) => d.replace(/^@/, "")),
    subjectKeywords: clean(raw.subjectKeywords),
    accountId: raw.accountId || "",
    action: raw.action,
    folderPath: raw.action === "move" ? raw.folderPath : "",
    tagKey: raw.action === "tag" ? raw.tagKey : "",
  };
}

// Stable id, so re-learning the same rule updates it instead of duplicating it.
export function ruleId(rule) {
  const key = JSON.stringify([
    rule.action, rule.accountId, rule.folderPath, rule.tagKey,
    rule.fromAddresses, rule.fromDomains, rule.subjectKeywords,
  ]);
  let hash = 0x811c9dc5;
  for (let i = 0; i < key.length; i++) {
    hash ^= key.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193) >>> 0;
  }
  return "r" + hash.toString(36);
}

function specificity(rule, facts) {
  return (
    (rule.subjectKeywords.length ? 4 : 0) +
    (rule.fromAddresses.includes(facts.from) ? 2 : 0) +
    (rule.accountId ? 1 : 0)
  );
}

// The single most specific folder rule plus every matching tag rule.
export function pickRules(rules, facts, currentTags = []) {
  const matching = rules.filter((r) => ruleMatches(r, facts));
  const folderRule = matching
    .filter((r) => FOLDER_ACTIONS.includes(r.action))
    .sort((a, b) => specificity(b, facts) - specificity(a, facts) || b.support - a.support)[0];
  const seen = new Set(currentTags);
  const tagRules = matching.filter((r) => r.action === "tag" && !seen.has(r.tagKey) && seen.add(r.tagKey));
  return { folderRule, tagRules };
}
