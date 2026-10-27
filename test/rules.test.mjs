// Wingman - Thunderbird add-on that learns how you file transactional mail.
// Copyright (C) 2026 Faghy
//
// This program is free software: you can redistribute it and/or modify it
// under the terms of the GNU General Public License as published by the Free
// Software Foundation, either version 3 of the License, or (at your option)
// any later version. See the LICENSE file for details.

import assert from "node:assert/strict";
const root = new URL("../src/", import.meta.url).href;
const { toObservation, ruleStats, normalizeRule, ruleId, pickRules } = await import(root + "rules.js");
const { subjectTemplate, parseAddress, looksTransactional } = await import(root + "mail.js");

const old = new Date(Date.now() - 10 * 864e5);
const inbox = { accountId: "a1", path: "/INBOX", specialUse: ["inbox"] };
const fatture = { accountId: "a1", path: "/INBOX/Fatture", specialUse: [] };
const trash = { accountId: "a1", path: "/Trash", specialUse: ["trash"] };
const msg = (author, subject, extra = {}) => ({ headerMessageId: Math.random() + "", author, subject, date: old, read: true, tags: [], ...extra });

assert.equal(subjectTemplate("Re: Ordine #12345 spedito il 12/10/2026"), "ordine ## spedito il #");
assert.deepEqual(parseAddress("Amazon <No-Reply@Amazon.IT>"), { email: "no-reply@amazon.it", domain: "amazon.it" });
assert.equal(looksTransactional({ "list-unsubscribe": ["<x>"] }, "mario@x.it"), true);
assert.equal(looksTransactional({}, "mario@x.it"), false);
assert.equal(looksTransactional({}, "noreply@x.it"), true);

assert.equal(toObservation(msg("a@b.it", "x", { read: false }), inbox, "h"), null, "unread inbox ignored");
assert.equal(toObservation(msg("a@b.it", "x", { date: new Date() }), inbox, "h"), null, "fresh inbox ignored");
assert.equal(toObservation(msg("a@b.it", "x"), inbox, "h").action, "keep");
assert.equal(toObservation(msg("a@b.it", "x"), trash, "h").action, "delete");
assert.equal(toObservation(msg("a@b.it", "x"), fatture, "h").path, "/INBOX/Fatture");

const obs = [
  ...Array.from({ length: 6 }, (_, i) => toObservation(msg("fatture@enel.it", `Bolletta n. ${i}`), fatture, "h")),
  toObservation(msg("fatture@enel.it", "Bolletta n. 9"), inbox, "h"),
  ...Array.from({ length: 4 }, () => toObservation(msg("promo@enel.it", "Offerta speciale"), trash, "h")),
  ...Array.from({ length: 3 }, () => toObservation(msg("news@shop.it", "Novità", { tags: ["$label4"] }), inbox, "h")),
];

const moveRule = normalizeRule({ description: "Bollette Enel", category: "Fatture", fromAddresses: ["Fatture@enel.it"], fromDomains: [], subjectKeywords: ["Bolletta"], accountId: "a1", action: "move", folderPath: "/INBOX/Fatture", tagKey: "x" });
assert.equal(moveRule.tagKey, "");
assert.deepEqual(moveRule.subjectKeywords, ["bolletta"]);
let s = ruleStats(moveRule, obs);
assert.equal(s.support, 6); assert.equal(s.contra, 1);
assert.ok(Math.abs(s.confidence - 6 / 7) < 1e-9);

const domainDelete = normalizeRule({ fromAddresses: [], fromDomains: ["@enel.it"], subjectKeywords: [], accountId: "", action: "delete", folderPath: "", tagKey: "" });
s = ruleStats(domainDelete, obs);
assert.equal(s.support, 4); assert.equal(s.contra, 7, "domain rule contradicted by invoices");

const tagRule = normalizeRule({ fromAddresses: ["news@shop.it"], fromDomains: [], subjectKeywords: [], accountId: "", action: "tag", folderPath: "", tagKey: "$label4" });
assert.equal(ruleStats(tagRule, obs).support, 3);

assert.equal(ruleId(moveRule), ruleId(normalizeRule({ ...moveRule, fromAddresses: ["fatture@enel.it"] })));
assert.notEqual(ruleId(moveRule), ruleId(domainDelete));

const rules = [
  { ...moveRule, id: "m", support: 6 },
  { ...normalizeRule({ fromDomains: ["enel.it"], action: "archive" }), id: "a", support: 50 },
  { ...tagRule, id: "t", support: 3 },
];
let picked = pickRules(rules, { from: "fatture@enel.it", domain: "enel.it", subject: "La tua Bolletta di ottobre", accountId: "a1" });
assert.equal(picked.folderRule.id, "m", "subject-specific rule wins");
picked = pickRules(rules, { from: "x@mail.enel.it", domain: "mail.enel.it", subject: "Ciao", accountId: "a2" });
assert.equal(picked.folderRule.id, "a", "subdomain matches domain rule");
picked = pickRules(rules, { from: "news@shop.it", domain: "shop.it", subject: "x", accountId: "a1" }, ["$label4"]);
assert.equal(picked.tagRules.length, 0, "existing tag not re-applied");
console.log("all rule tests passed");
