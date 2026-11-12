# @vermeulen.solutions/eventual-locales

Translations for the Eventual EmDash plugins (Eventual, Eventual Tickets, Eventual Attendance), plus the small message runtime they share.

Each plugin ships with English built in. Other languages are downloaded as data, so adding a language does not make a plugin bundle any larger. That matters because the EmDash sandbox limits each file to 128 KiB.

## Languages

English (built in) plus `fr`, `de`, `nl`, `es`, `it`, `pt`, `pt-BR`, `pl`, `cs`, `sv`, `da`, `nb`, `fi`, `ja`, `zh-CN`, `ko`, `tr`, `uk`, `ar` and `he`. Arabic and Hebrew are right to left.

## How a plugin gets its language

1. **Build:** `eventual-locales-pack <namespace> <outDir>` copies the runtime into the plugin source. The plugin CLI keeps npm dependencies external, so the runtime must be copied. The command also writes `manifest.ts`, which pins this package's version and a hash of every catalog for that namespace.
2. **First use:** the plugin fetches `https://cdn.jsdelivr.net/npm/@vermeulen.solutions/eventual-locales@<version>/catalogs/<namespace>/<lang>.json`. It accepts the file only if the file's SHA-256 matches the pinned hash, then stores it in plugin KV under `i18n:<namespace>:<version>:<lang>`.
3. **Later requests:** packs are read from the isolate's memory, then from KV. Eventual (Core) downloads directly when the request still has RPC budget left. Tickets and Attendance only read KV. Their `*-language-packs` cron task (every 10 minutes) downloads missing packs, the site language first.

If anything fails (no network, a hash mismatch, a missing pack, or no budget left), that request falls back to English. The pack is retried later, so localization never breaks a request.

Pinned hashes are the first 128 bits of the SHA-256, written as 22 base64 characters. That keeps 20 languages under 500 bytes in each bundle. `manifest.json` in this package keeps the full hex digests.

Site components (Astro) and host code import catalogs from this package directly, for example `import("@vermeulen.solutions/eventual-locales/catalogs/tickets-form/fr.json", { with: { type: "json" } })`, so each language becomes its own chunk.

## Namespaces

| Namespace | Used by | Format |
|---|---|---|
| `core` | Eventual admin and editor | English text → translation (`textTranslator`) |
| `tickets` | Tickets admin and emails | dotted key → ICU message |
| `tickets-form` | `TicketCheckout`, `TicketOrder`, `TicketCheckin` | dotted key → message with plain `{name}` placeholders |
| `attendance` | Attendance admin and emails | dotted key → ICU message |
| `attendance-form` | `RsvpForm`, `RsvpManage` | dotted key → message with plain `{name}` placeholders |

The form catalogs use only plain `{name}` placeholders because the browser code substitutes them with `String.replace`. For counted words (seats, people), the form catalogs carry `one`, `other`, `few` and `many` keys, and the components choose between them with `Intl.PluralRules`.

## Message syntax

The runtime handles a small ICU subset: `{arg}`, `{n, plural, =0 {…} one {# item} other {…}}` (all CLDR categories), `{x, select, a {…} other {…}}`, `{d, date, long}` and `{n, number}`.

## Working on translations

```bash
npm test                 # runtime tests + catalog check
node scripts/check.mjs   # coverage per language; errors for unknown placeholders, warnings for dropped ones
npm run manifest         # rehash catalogs after editing them
```

`en.json` in each namespace is extracted from the plugin source with each plugin's `scripts/i18n-extract.mjs`. Never edit `en.json` by hand. After you change catalogs, run `npm run manifest`, publish a new version, and run `npm run build` in each plugin, which re-runs `i18n:pack`. The pinned version and hashes only change when a plugin is rebuilt, so a published plugin release always fetches exactly the catalogs it was tested with.

`.gitattributes` forces LF line endings so the hashes are the same on every platform.

## Licence

MIT
