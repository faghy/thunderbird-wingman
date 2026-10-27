// Wingman - Thunderbird add-on that learns how you file transactional mail.
// Copyright (C) 2026 Faghy
//
// This program is free software: you can redistribute it and/or modify it
// under the terms of the GNU General Public License as published by the Free
// Software Foundation, either version 3 of the License, or (at your option)
// any later version. See the LICENSE file for details.

import assert from "node:assert/strict";
const root = new URL("../src/", import.meta.url).href;

// --- in-memory Thunderbird ---
const folders = [
  { id: "f0", accountId: "a1", path: "/", name: "root", isRoot: true },
  { id: "f1", accountId: "a1", path: "/INBOX", name: "Inbox", specialUse: ["inbox"] },
  { id: "f2", accountId: "a1", path: "/INBOX/Fatture", name: "Fatture", specialUse: [] },
  { id: "f3", accountId: "a1", path: "/Trash", name: "Cestino", specialUse: ["trash"] },
  { id: "f4", accountId: "a1", path: "/Archives", name: "Archivio", specialUse: ["archives"] },
  { id: "f5", accountId: "a1", path: "/Archives/2026", name: "2026", specialUse: [] },
];
let nextId = 1;
const messages = [];
const old = new Date(Date.now() - 10 * 864e5);
function add(folderId, author, subject, extra = {}) {
  const m = { id: nextId++, headerMessageId: `h${nextId}`, author, subject, date: old, read: true, tags: [], folderId, ...extra };
  messages.push(m); return m;
}
const view = (m) => ({ ...m, folder: folders.find((f) => f.id === m.folderId) });
for (let i = 0; i < 5; i++) add("f2", "Enel <fatture@enel.it>", `Bolletta ${i}`);
for (let i = 0; i < 4; i++) add("f5", "Shop <news@shop.it>", `Promo ${i}`);
add("f1", "Mario <mario@gmail.com>", "Ciao");
const events = {};
const ev = (name) => ({ addListener: (fn) => (events[name] = fn) });
const storage = {};
globalThis.browser = { storage: { local: {
  get: async (keys) => Object.fromEntries(keys.filter((k) => k in storage).map((k) => [k, storage[k]])),
  set: async (o) => Object.assign(storage, o),
} } };
let llmRequests = [];
globalThis.messenger = {
  accounts: { list: async () => [{ id: "a1", name: "Lavoro", type: "imap" }] },
  folders: { query: async ({ accountId, path }) => folders.filter((f) => f.accountId === accountId && (path === undefined || f.path === path)) },
  messages: {
    listTags: async () => [{ key: "$label1", tag: "Importante", color: "#FF0000" }],
    query: async ({ folderId, headerMessageId, accountId }) => ({ id: null, messages: messages.filter((m) => (!folderId || m.folderId === folderId) && (!headerMessageId || m.headerMessageId === headerMessageId)).map(view) }),
    continueList: async () => { throw new Error("no pages"); },
    getFull: async (id) => ({ headers: { "list-unsubscribe": ["<x>"] }, contentType: "text/plain", body: "La tua bolletta luce è disponibile." }),
    move: async (ids, folderId) => {
      const moved = ids.map((id) => { const m = messages.find((x) => x.id === id); m.folderId = folderId; return view(m); });
      await events.onMoved?.({ id: null, messages: [] }, { id: null, messages: moved });
    },
    archive: async (ids) => messenger.messages.move(ids, "f5"),
    delete: async (ids) => messenger.messages.move(ids, "f3"),
    update: async (id, props) => Object.assign(messages.find((m) => m.id === id), props),
    onNewMailReceived: ev("onNewMailReceived"), onMoved: ev("onMoved"), onDeleted: ev("onDeleted"), onUpdated: ev("onUpdated"),
  },
  browserAction: { onClicked: ev("click") },
  runtime: { onInstalled: ev("installed"), onMessage: ev("msg"), openOptionsPage() {} },
};

// --- fake Claude API ---
let nextAnswer;
globalThis.fetch = async (url, init) => {
  const body = JSON.parse(init.body);
  llmRequests.push({ url: String(url), body, headers: init.headers });
  const text = JSON.stringify(nextAnswer(body));
  return new Response(JSON.stringify({ id: "msg_1", type: "message", role: "assistant", model: body.model, content: [{ type: "text", text }], stop_reason: "end_turn", stop_details: null, usage: { input_tokens: 1, output_tokens: 1 } }), { status: 200, headers: { "content-type": "application/json" } });
};

await import(root + "background.js");
const call = (cmd, extra = {}) => events.msg({ cmd, ...extra });

// Without consent nothing is sent, and the settings form cannot grant it.
await call("saveSettings", { settings: { apiKey: "sk-test", aiConsentAt: Date.now(), aiConsentVersion: 1 } });
await call("learn");
for (let i = 0; i < 50 && (await call("getState")).result.busy; i++) await new Promise((r) => setTimeout(r, 20));
assert.equal(llmRequests.length, 0, "no request before consent");
assert.match((await call("getState")).result.meta.lastError, /consenso/);
await call("setConsent", { granted: true });

nextAnswer = () => ({ rules: [
  { description: "Bollette Enel in Fatture", category: "Fatture", fromAddresses: ["fatture@enel.it"], fromDomains: [], subjectKeywords: [], accountId: "a1", action: "move", folderPath: "/INBOX/Fatture", tagKey: "" },
  { description: "Promo shop archiviate", category: "Promo", fromAddresses: ["news@shop.it"], fromDomains: [], subjectKeywords: [], accountId: "", action: "archive", folderPath: "", tagKey: "" },
  { description: "Inventata", category: "X", fromAddresses: ["fatture@enel.it"], fromDomains: [], subjectKeywords: [], accountId: "a1", action: "delete", folderPath: "", tagKey: "" },
  { description: "Cartella falsa", category: "X", fromAddresses: ["news@shop.it"], fromDomains: [], subjectKeywords: [], accountId: "a1", action: "move", folderPath: "/Nope", tagKey: "" },
]});
await call("learn");
for (let i = 0; i < 50 && (await call("getState")).result.busy; i++) await new Promise((r) => setTimeout(r, 20));
let st = (await call("getState")).result;
assert.equal(st.meta.lastError, "", st.meta.lastError);
const req = llmRequests[0];
assert.equal(req.body.model, "claude-opus-5-5");
assert.equal(req.body.fallbacks, "default");
assert.ok(String(req.headers["anthropic-beta"] ?? new Headers(req.headers).get("anthropic-beta")).includes("server-side-fallback-2026-07-01"));
const sent = JSON.parse(req.body.messages[0].content);
assert.deepEqual(sent.senders.map((s) => s.from).sort(), ["fatture@enel.it", "news@shop.it"], "personal mail not summarized");
assert.ok(sent.senders.find((s) => s.from === "news@shop.it").outcomes.archived === 4, "archive subfolder folded into archive");
assert.equal(st.rules.length, 2, JSON.stringify(st.meta.lastLearn));
assert.equal(st.meta.lastLearn.rejected.length, 2);
assert.ok(st.rules.every((r) => r.status === "active"));

// New mail from a known sender gets filed.
const newBill = add("f1", "Enel <fatture@enel.it>", "Bolletta novembre", { date: new Date(), read: false });
events.onNewMailReceived(folders[1], { id: null, messages: [view(newBill)] });
await new Promise((r) => setTimeout(r, 50));
assert.equal(newBill.folderId, "f2", "moved to Fatture");
st = (await call("getState")).result;
assert.equal(st.log[0].status, "applied");

// Unknown automated sender: the AI maps it to an existing rule.
nextAnswer = (body) => {
  const enumIds = body.output_config.format.schema.properties.ruleId.enum;
  assert.ok(enumIds.includes("none"));
  return { ruleId: st.rules.find((r) => r.action === "archive").id, confidence: 0.95, reason: "Promozione di un negozio" };
};
const promo = add("f1", "Altro <offerte@altroshop.it>", "Sconti -50%", { date: new Date(), read: false });
events.onNewMailReceived(folders[1], { id: null, messages: [view(promo)] });
await new Promise((r) => setTimeout(r, 50));
assert.equal(promo.folderId, "f5", "AI archived it");
const aiReq = llmRequests.at(-1).body;
assert.equal(aiReq.output_config.effort, "low");

// User drags the bill back to the inbox twice -> rule switched off.
for (const m of [newBill]) {
  m.folderId = "f1";
  await events.onMoved({ id: null, messages: [] }, { id: null, messages: [view(m)] });
}
st = (await call("getState")).result;
assert.equal(st.log.find((e) => e.hid === newBill.headerMessageId).status, "reverted");
// Undo of the AI action via the options page.
const aiEntry = st.log.find((e) => e.hid === promo.headerMessageId);
const undoRes = await call("undo", { id: aiEntry.id });
assert.ok(undoRes.ok, undoRes.error);
assert.equal(promo.folderId, "f1", "undo restored inbox");
st = (await call("getState")).result;
assert.equal(st.rules.find((r) => r.action === "archive").reverts, 1);

// Suggest mode only logs.
await call("saveSettings", { settings: { mode: "suggest" } });
const bill2 = add("f1", "Enel <fatture@enel.it>", "Bolletta dicembre", { date: new Date(), read: false });
events.onNewMailReceived(folders[1], { id: null, messages: [view(bill2)] });
await new Promise((r) => setTimeout(r, 50));
assert.equal(bill2.folderId, "f1");
st = (await call("getState")).result;
const sug = st.log.find((e) => e.hid === bill2.headerMessageId);
assert.equal(sug.status, "suggested");
assert.ok((await call("applySuggestion", { id: sug.id })).ok);
assert.equal(bill2.folderId, "f2");
console.log("flow test passed; requests:", llmRequests.length);
process.exit(0);
