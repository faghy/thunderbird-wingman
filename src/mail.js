// Wingman - Thunderbird add-on that learns how you file transactional mail.
// Copyright (C) 2026 Faghy
//
// This program is free software: you can redistribute it and/or modify it
// under the terms of the GNU General Public License as published by the Free
// Software Foundation, either version 3 of the License, or (at your option)
// any later version. See the LICENSE file for details.

// Thin helpers over the Thunderbird MailExtension APIs (Manifest V2, TB 140+).

const SKIPPED_ACCOUNT_TYPES = new Set(["nntp", "rss"]);
const SPECIAL_KINDS = ["inbox", "trash", "junk", "sent", "drafts", "templates", "outbox", "archives"];

// accountId -> paths of archive roots, used to fold "Archives/2025/10" into "archive".
const archiveRoots = new Map();

export async function listAccounts() {
  const accounts = await messenger.accounts.list(false);
  return accounts.filter((a) => !SKIPPED_ACCOUNT_TYPES.has(a.type));
}

export async function listFolders(accountId) {
  const folders = await messenger.folders.query({ accountId });
  const usable = folders.filter((f) => !f.isRoot && !f.isVirtual && !f.isUnified && !f.isTag);
  archiveRoots.set(
    accountId,
    usable.filter((f) => (f.specialUse || []).includes("archives")).map((f) => f.path),
  );
  return usable;
}

export async function findFolder(accountId, path) {
  const [folder] = await messenger.folders.query({ accountId, path });
  return folder || null;
}

export function folderKind(folder) {
  const uses = folder?.specialUse || [];
  const special = SPECIAL_KINDS.find((k) => uses.includes(k));
  if (special) return special;
  const roots = archiveRoots.get(folder?.accountId) || [];
  if (roots.some((root) => folder.path.startsWith(root + "/"))) return "archives";
  return "normal";
}

export async function listTags() {
  if (messenger.messages.listTags) return messenger.messages.listTags();
  return messenger.messages.tags.list();
}

// Walks every page of a MessageList (or a promise of one).
export async function* iterateMessages(listOrPromise, limit = Infinity) {
  let page = await listOrPromise;
  let count = 0;
  try {
    while (page) {
      for (const message of page.messages) {
        if (count++ >= limit) return;
        yield message;
      }
      if (!page.id) return;
      page = await messenger.messages.continueList(page.id);
    }
  } finally {
    // A list still holding an id was not read to the end: release it.
    if (page?.id && messenger.messages.abortList) {
      await messenger.messages.abortList(page.id).catch(() => {});
    }
  }
}

export async function findMessagesByHeaderId(accountId, headerMessageId) {
  const found = [];
  const list = messenger.messages.query({ accountId, headerMessageId, autoPaginationTimeout: 0 });
  for await (const message of iterateMessages(list)) found.push(message);
  return found;
}

export function parseAddress(author = "") {
  const bracketed = author.match(/<([^>]+)>/);
  const email = (bracketed ? bracketed[1] : author).trim().toLowerCase();
  return { email, domain: email.includes("@") ? email.split("@").pop() : "" };
}

// Lowercased subject with numbers collapsed, so "Order #12345" and "Order #67890" look alike.
export function subjectTemplate(subject = "") {
  return subject
    .toLowerCase()
    .replace(/^((re|fw|fwd|r|i)\s*:\s*)+/i, "")
    .replace(/\d+([.,/-]\d+)*/g, "#")
    .replace(/\s+/g, " ")
    .trim();
}

export async function getMessageInfo(messageId) {
  const full = await messenger.messages.getFull(messageId);
  const text = extractText(full).replace(/\s+/g, " ").trim();
  return { headers: full.headers || {}, snippet: text.slice(0, 800) };
}

function extractText(root) {
  let plain = "";
  let html = "";
  (function walk(part) {
    if (!part) return;
    const type = (part.contentType || "").toLowerCase();
    if (part.body && type === "text/plain" && !plain) plain = part.body;
    else if (part.body && type === "text/html" && !html) html = part.body;
    (part.parts || []).forEach(walk);
  })(root);
  if (plain) return plain;
  return html
    .replace(/<(style|script)[\s\S]*?<\/\1>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&");
}

const AUTOMATED_LOCALPART =
  /^(no-?reply|do-?not-?reply|notifications?|notify|alerts?|info|news(letter)?|billing|invoices?|fatture|orders?|ordini|receipts?|updates?|mailer|bounces?|accounts?|service|servizio|marketing|promo)\b/;

// Cheap local pre-filter: only mail that looks automated is ever sent to the AI.
export function looksTransactional(headers, email) {
  const first = (name) => (headers[name] || [])[0] || "";
  if (first("list-unsubscribe") || first("list-id")) return true;
  if (/bulk|list|junk/i.test(first("precedence"))) return true;
  const autoSubmitted = first("auto-submitted");
  if (autoSubmitted && autoSubmitted.toLowerCase() !== "no") return true;
  if (first("feedback-id") || first("x-campaign") || first("x-mailgun-tag")) return true;
  return AUTOMATED_LOCALPART.test(email.split("@")[0] || "");
}
