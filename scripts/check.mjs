#!/usr/bin/env node
// Validates every catalog against its namespace's en.json (the extracted English source):
// unknown keys, placeholder mismatches and unparsable messages are errors; missing keys
// are reported as coverage (errors with --strict).
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { messageArguments } from "../runtime/format.mjs";
import { LOCALES } from "../runtime/locale.mjs";

const root = new URL("..", import.meta.url).pathname.replace(/^\/(\w:)/, "$1");
const strict = process.argv.includes("--strict");
let errors = 0;
const fail = (message) => { errors++; console.error("✗ " + message); };

for (const namespace of readdirSync(join(root, "catalogs")).sort()) {
  const dir = join(root, "catalogs", namespace);
  const english = JSON.parse(readFileSync(join(dir, "en.json"), "utf8"));
  const coverage = [];
  for (const lang of LOCALES) {
    let catalog;
    try { catalog = JSON.parse(readFileSync(join(dir, `${lang}.json`), "utf8")); }
    catch { (strict ? fail : console.warn)(`${namespace}/${lang}.json missing`); continue; }
    let missing = 0;
    for (const key of Object.keys(english)) if (!catalog[key]) missing++;
    for (const [key, message] of Object.entries(catalog)) {
      if (!(key in english)) { fail(`${namespace}/${lang}: unknown key ${JSON.stringify(key)}`); continue; }
      if (typeof message !== "string") { fail(`${namespace}/${lang}: ${key} is not a string`); continue; }
      let want, got;
      try { want = messageArguments(english[key]); got = messageArguments(message); }
      catch (error) { fail(`${namespace}/${lang}: ${key} does not parse (${error.message})`); continue; }
      for (const name of got) if (!want.has(name)) fail(`${namespace}/${lang}: ${key} uses unknown {${name}}`);
      // Leaving a value out can be the better wording (grammar); flag it for review only.
      for (const name of want) if (!got.has(name)) console.warn(`! ${namespace}/${lang}: ${key} leaves out {${name}}`);
    }
    if (missing && strict) fail(`${namespace}/${lang}: ${missing} untranslated`);
    coverage.push(`${lang} ${Math.round((100 * (Object.keys(english).length - missing)) / Object.keys(english).length)}%`);
  }
  console.log(`${namespace} (${Object.keys(english).length} messages): ${coverage.join(", ")}`);
}
if (errors) process.exit(1);
