// Wingman - Thunderbird add-on that learns how you file transactional mail.
// Copyright (C) 2026 Serafino Christian
//
// This program is free software: you can redistribute it and/or modify it
// under the terms of the GNU General Public License as published by the Free
// Software Foundation, either version 3 of the License, or (at your option)
// any later version. See the LICENSE file for details.

// Adds the version just built to updates.json, the file Thunderbird reads to
// update the GitHub build of Wingman. Run after `npm run build`, commit, then
// publish the GitHub release vX.Y.Z with wingman-X.Y.Z.xpi attached: the link
// below points there, and the hash must match that exact file.
import { createHash } from "node:crypto";
import { existsSync, readFileSync, writeFileSync } from "node:fs";

const KEEP = 10;
const manifest = JSON.parse(readFileSync("manifest.json", "utf8"));
const { id, strict_min_version } = manifest.browser_specific_settings.gecko;
const { version } = manifest;
const hash = createHash("sha256").update(readFileSync("wingman.xpi")).digest("hex");

const file = "updates.json";
const data = existsSync(file) ? JSON.parse(readFileSync(file, "utf8")) : { addons: {} };
const updates = (data.addons[id]?.updates || []).filter((u) => u.version !== version);
updates.unshift({
  version,
  update_link: `https://github.com/faghy/thunderbird-wingman/releases/download/v${version}/wingman-${version}.xpi`,
  update_hash: `sha256:${hash}`,
  applications: { gecko: { strict_min_version } },
});
data.addons[id] = { updates: updates.slice(0, KEEP) };
writeFileSync(file, JSON.stringify(data, null, 2) + "\n");
console.log(`updates.json: ${version} sha256:${hash}`);
