// Wingman - Thunderbird add-on that learns how you file transactional mail.
// Copyright (C) 2026 Faghy
//
// This program is free software: you can redistribute it and/or modify it
// under the terms of the GNU General Public License as published by the Free
// Software Foundation, either version 3 of the License, or (at your option)
// any later version. See the LICENSE file for details.

// Bundles the background script (with the Anthropic SDK) and packs the .xpi.
import { build } from "esbuild";
import { cpSync, mkdirSync, rmSync } from "node:fs";
import { execFileSync } from "node:child_process";

const outdir = "dist";
rmSync(outdir, { recursive: true, force: true });
mkdirSync(outdir);

await build({
  entryPoints: ["src/background.js"],
  outfile: `${outdir}/background.js`,
  bundle: true,
  format: "iife",
  platform: "browser",
  target: "firefox128",
  legalComments: "none",
});

for (const path of ["manifest.json", "options", "icons"]) cpSync(path, `${outdir}/${path}`, { recursive: true });

rmSync("wingman.xpi", { force: true });
execFileSync("zip", ["-qr", "../wingman.xpi", "."], { cwd: outdir });
console.log("Creato wingman.xpi");
