#!/usr/bin/env node
// Writes manifest.json: the SHA-256 of every non-English catalog. Plugins pin these hashes
// in their bundles, so a pack fetched from the CDN must match this exact published file.
// --verify fails instead of writing when manifest.json is stale.
import { createHash } from "node:crypto";
import { readdirSync, readFileSync, writeFileSync, existsSync } from "node:fs";
import { join } from "node:path";

const root = new URL("..", import.meta.url).pathname.replace(/^\/(\w:)/, "$1");
const pkg = JSON.parse(readFileSync(join(root, "package.json"), "utf8"));
const namespaces = {};
for (const namespace of readdirSync(join(root, "catalogs")).sort()) {
  const hashes = {};
  for (const file of readdirSync(join(root, "catalogs", namespace)).sort()) {
    if (!file.endsWith(".json") || file === "en.json") continue;
    const bytes = readFileSync(join(root, "catalogs", namespace, file));
    if (bytes[0] === 0xef) throw new Error(`${namespace}/${file}: remove the UTF-8 BOM`);
    JSON.parse(bytes.toString("utf8"));
    hashes[file.slice(0, -5)] = createHash("sha256").update(bytes).digest("hex");
  }
  namespaces[namespace] = hashes;
}
const manifest = JSON.stringify({ package: pkg.name, version: pkg.version, namespaces }, null, 2) + "\n";
const target = join(root, "manifest.json");
if (process.argv.includes("--verify")) {
  if (!existsSync(target) || readFileSync(target, "utf8") !== manifest) {
    console.error("manifest.json is stale: run npm run manifest and rebuild the plugins.");
    process.exit(1);
  }
} else {
  writeFileSync(target, manifest);
  console.log(`manifest.json: ${Object.entries(namespaces).map(([ns, h]) => `${ns} ${Object.keys(h).length}`).join(", ")}`);
}
