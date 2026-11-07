// Wingman - Thunderbird add-on that learns how you file transactional mail.
// Copyright (C) 2026 Serafino Christian
//
// This program is free software: you can redistribute it and/or modify it
// under the terms of the GNU General Public License as published by the Free
// Software Foundation, either version 3 of the License, or (at your option)
// any later version. See the LICENSE file for details.

// Bundles the background script (with the Anthropic SDK) and packs two .xpi:
// - wingman-atn.xpi for addons.thunderbird.net, exactly the files in dist/;
// - wingman.xpi for GitHub releases, the same files plus an update_url in the
//   manifest so Thunderbird updates it by itself (ATN does not allow update_url,
//   it delivers updates on its own).
import { build } from "esbuild";
import { cpSync, mkdirSync, readdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { crc32, deflateRawSync } from "node:zlib";

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

const UPDATE_URL = "https://raw.githubusercontent.com/faghy/thunderbird-wingman/main/updates.json";

writeFileSync("wingman-atn.xpi", zip(outdir));
const manifest = JSON.parse(readFileSync(`${outdir}/manifest.json`, "utf8"));
manifest.browser_specific_settings.gecko.update_url = UPDATE_URL;
writeFileSync("wingman.xpi", zip(outdir, { "manifest.json": Buffer.from(JSON.stringify(manifest, null, 2) + "\n") }));
console.log("Creati wingman.xpi (GitHub, aggiornamenti automatici) e wingman-atn.xpi (addons.thunderbird.net)");

// Minimal deterministic zip writer (sorted entries, fixed timestamps), so the
// build needs nothing besides Node and gives the same .xpi every time.
function zip(dir, overrides = {}) {
  const names = readdirSync(dir, { recursive: true, withFileTypes: true })
    .filter((e) => e.isFile())
    .map((e) => `${e.parentPath ?? e.path}/${e.name}`.slice(dir.length + 1))
    .sort();
  const DOS_DATE = (1 << 5) | 1; // 1980-01-01
  const locals = [];
  const central = [];
  let offset = 0;
  for (const name of names) {
    const data = overrides[name] ?? readFileSync(`${dir}/${name}`);
    const packed = deflateRawSync(data, { level: 9 });
    const nameBuf = Buffer.from(name, "utf8");
    const local = Buffer.alloc(30);
    local.writeUInt32LE(0x04034b50, 0);
    local.writeUInt16LE(20, 4); // version needed
    local.writeUInt16LE(0x0800, 6); // UTF-8 names
    local.writeUInt16LE(8, 8); // deflate
    local.writeUInt16LE(0, 10);
    local.writeUInt16LE(DOS_DATE, 12);
    local.writeUInt32LE(crc32(data), 14);
    local.writeUInt32LE(packed.length, 18);
    local.writeUInt32LE(data.length, 22);
    local.writeUInt16LE(nameBuf.length, 26);
    locals.push(local, nameBuf, packed);

    const entry = Buffer.alloc(46);
    entry.writeUInt32LE(0x02014b50, 0);
    entry.writeUInt16LE(20, 4);
    entry.writeUInt16LE(20, 6);
    entry.writeUInt16LE(0x0800, 8);
    entry.writeUInt16LE(8, 10);
    entry.writeUInt16LE(0, 12);
    entry.writeUInt16LE(DOS_DATE, 14);
    entry.writeUInt32LE(crc32(data), 16);
    entry.writeUInt32LE(packed.length, 20);
    entry.writeUInt32LE(data.length, 24);
    entry.writeUInt16LE(nameBuf.length, 28);
    entry.writeUInt32LE(offset, 42);
    central.push(entry, nameBuf);
    offset += local.length + nameBuf.length + packed.length;
  }
  const centralBuf = Buffer.concat(central);
  const end = Buffer.alloc(22);
  end.writeUInt32LE(0x06054b50, 0);
  end.writeUInt16LE(names.length, 8);
  end.writeUInt16LE(names.length, 10);
  end.writeUInt32LE(centralBuf.length, 12);
  end.writeUInt32LE(offset, 16);
  return Buffer.concat([...locals, centralBuf, end]);
}
