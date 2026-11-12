import { test } from "node:test";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { formatMessage, resolveLocale, bindMessages, flattenMessages, textTranslator, loadPack, warmPacks, clearPackCache, localeDirection } from "../runtime/index.mjs";

test("formats arguments, plurals and selects", () => {
  assert.equal(formatMessage("Hi {name}", { name: "Ana" }), "Hi Ana");
  assert.equal(formatMessage("Hi {name}"), "Hi {name}");
  const seats = "{n, plural, =0 {no seats} one {# seat} other {# seats}}";
  assert.equal(formatMessage(seats, { n: 0 }), "no seats");
  assert.equal(formatMessage(seats, { n: 1 }), "1 seat");
  assert.equal(formatMessage(seats, { n: 1200 }, "en"), "1,200 seats");
  const pl = "{n, plural, one {# miejsce} few {# miejsca} many {# miejsc} other {# miejsca}}";
  assert.equal(formatMessage(pl, { n: 3 }, "pl"), "3 miejsca");
  assert.equal(formatMessage(pl, { n: 5 }, "pl"), "5 miejsc");
  const key = "{stored, select, true {Invalid key for {host}} other {Key required for {host}}}";
  assert.equal(formatMessage(key, { stored: true, host: "a.ch" }), "Invalid key for a.ch");
  assert.equal(formatMessage(key, { stored: false, host: "a.ch" }), "Key required for a.ch");
  assert.equal(formatMessage("You are position #{n}.", { n: 4 }), "You are position #4.");
  assert.equal(formatMessage("Nested {a, select, x {{n, plural, one {# one} other {# many}}} other {none}}", { a: "x", n: 2 }), "Nested 2 many");
});

test("resolves locales", () => {
  assert.equal(resolveLocale("de-CH"), "de");
  assert.equal(resolveLocale("pt_br"), "pt-BR");
  assert.equal(resolveLocale("pt-PT"), "pt");
  assert.equal(resolveLocale("zh-Hans-CN"), "zh-CN");
  assert.equal(resolveLocale("zh-TW"), "en");
  assert.equal(resolveLocale("no"), "nb");
  assert.equal(resolveLocale("en-GB"), "en");
  assert.equal(resolveLocale("xx"), "en");
  assert.equal(resolveLocale("not a locale!!"), "en");
  assert.equal(resolveLocale("de", ["fr"]), "en");
  assert.equal(localeDirection("ar"), "rtl");
  assert.equal(localeDirection("de"), "ltr");
});

test("binds message trees with English fallback", () => {
  const en = { a: "Save", b: ["Running on {host}", "host"], c: ["Hi {name}"], nested: { d: "Door" } };
  const t = bindMessages(en, { a: "Speichern", "nested.d": "Tür", b: "" }, "de");
  assert.equal(t.a, "Speichern");
  assert.equal(t.b("x.ch"), "Running on x.ch");
  assert.equal(t.c({ name: "Jo" }), "Hi Jo");
  assert.equal(t.nested.d, "Tür");
  assert.deepEqual(flattenMessages(en), { a: "Save", b: "Running on {host}", c: "Hi {name}", "nested.d": "Door" });
});

test("translates English text keys and templates", () => {
  const t = textTranslator({ Events: "Veranstaltungen", "Manage {name}": "{name} verwalten", "{n} dates": "{n, plural, one {# Termin} other {# Termine}}" }, "de");
  assert.equal(t("Events"), "Veranstaltungen");
  assert.equal(t("Manage Events"), "Veranstaltungen verwalten");
  assert.equal(t("Manage Talks"), "Talks verwalten");
  assert.equal(t("1 dates"), "1 Termin");
  assert.equal(t("Unknown"), "Unknown");
  assert.equal(textTranslator(null)("Events"), "Events");
});

test("loads a pinned pack once, then from KV, and refuses tampered packs", async () => {
  const body = JSON.stringify({ Events: "Événements" });
  const hash = createHash("sha256").update(body).digest("hex");
  const manifest = { package: "@x/locales", version: "1.0.0", namespace: "core", hashes: { fr: hash, de: hash } };
  const kv = new Map();
  let fetches = 0;
  const ctx = (payload) => ({
    kv: { get: async (k) => kv.get(k), set: async (k, v) => void kv.set(k, v) },
    http: { fetch: async (url) => { fetches++; assert.match(url, /^https:\/\/cdn\.jsdelivr\.net\/npm\/@x\/locales@1\.0\.0\/catalogs\/core\/(fr|de)\.json$/); return { ok: true, text: async () => payload }; } },
  });
  clearPackCache();
  assert.deepEqual(await loadPack(ctx(body), manifest, "fr-CH"), { Events: "Événements" });
  clearPackCache();
  assert.deepEqual(await loadPack(ctx(body), manifest, "fr"), { Events: "Événements" });
  assert.equal(fetches, 1);
  assert.equal(await loadPack(ctx(body.replace("É", "E")), manifest, "de"), null);
  assert.equal(fetches, 2);
  assert.equal(await loadPack(ctx(body), manifest, "de"), null, "backs off after a failure");
  assert.equal(fetches, 2);
  assert.equal(await loadPack(ctx(body), manifest, "en"), null);
  clearPackCache();
  assert.equal(await loadPack(ctx(body), manifest, "de", () => 1), null, "no download without budget");
  assert.equal(fetches, 2);
  assert.deepEqual(await loadPack(ctx(body), manifest, "de", () => 3), { Events: "Événements" });
});

test("formats dates and numbers, and translates nested captures", () => {
  assert.equal(formatMessage("until {d, date, long}", { d: "2026-11-17" }, "de"), "until 17. November 2026");
  assert.equal(formatMessage("{n, number} x", { n: 1234.5 }, "de"), "1.234,5 x");
  const t = textTranslator({
    "{rule} through {date}": "{rule} bis {date, date, long}",
    "every week on {days}": "jede Woche am {days}",
    "every {n} weeks": "alle {n} Wochen",
    Monday: "Montag", Friday: "Freitag", weekly: "wöchentlich",
  }, "de");
  assert.equal(t("every week on Monday, Friday through 2026-11-17"), "Jede Woche am Montag und Freitag bis 17. November 2026");
  assert.equal(t("every 2 weeks through 2026-01-02"), "Alle 2 Wochen bis 2. Januar 2026");
  assert.equal(t("weekly through 2026-01-02"), "Wöchentlich bis 2. Januar 2026");
});

test("captures prefer in-sentence lowercase entries", () => {
  const t = textTranslator({ Monday: "Lundi", monday: "lundi", Thursday: "Jeudi", thursday: "jeudi", "every week on {days}": "chaque semaine, le {days}" }, "fr");
  assert.equal(t("Monday"), "Lundi");
  assert.equal(t("every week on Monday, Thursday"), "Chaque semaine, le lundi et jeudi");
});

test("warms missing packs in the background, site language first, within budget", async () => {
  const bodies = { fr: JSON.stringify({ a: "fr" }), de: JSON.stringify({ a: "de" }), it: JSON.stringify({ a: "it" }) };
  const hash = (s) => createHash("sha256").update(s).digest("hex");
  const manifest = { package: "@x/l", version: "2.0.0", namespace: "tickets", hashes: Object.fromEntries(Object.entries(bodies).map(([l, b]) => [l, hash(b)])) };
  const kv = new Map();
  let calls = 0;
  const fetched = [];
  const ctx = {
    kv: { get: async (k) => { calls++; return kv.get(k); }, set: async (k, v) => { calls++; kv.set(k, v); } },
    http: { fetch: async (url) => { calls++; const lang = url.match(/\/(\w+)\.json$/)[1]; fetched.push(lang); return { ok: true, text: async () => bodies[lang] }; } },
  };
  clearPackCache();
  const first = await warmPacks(ctx, manifest, "it-CH", () => 7 - calls);
  assert.deepEqual(fetched, ["it", "fr"]);
  assert.deepEqual(first, { added: 2, missing: 1 });
  assert.deepEqual(kv.get("i18n:tickets:2.0.0:index"), ["it", "fr"]);
  calls = 0;
  assert.deepEqual(await warmPacks(ctx, manifest, "it", () => 10 - calls), { added: 1, missing: 0 });
  calls = 0;
  assert.deepEqual(await warmPacks(ctx, manifest, "it", () => 10 - calls), { added: 0, missing: 0 });
  assert.equal(calls, 1, "a full index costs one read");
  clearPackCache();
  assert.deepEqual(await loadPack({ kv: ctx.kv }, manifest, "de", () => 1), { a: "de" });
});
