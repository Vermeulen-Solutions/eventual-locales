# Draft feature request for EmDash: localized plugin manifest strings

*Draft only. Not filed.*

## Summary

Allow sandboxed plugins to provide translations for the static strings in `emdash-plugin.jsonc`: admin page and navigation labels, widget titles, the plugin description, and settings field labels and descriptions. Today these show in English whatever language the admin uses.

## Problem

A plugin can localize everything it renders at runtime. Block Kit pages, panels, emails and site components all receive the request locale. The strings EmDash renders directly from the manifest cannot be localized, for example:

- `admin.pages[].label` (e.g. "Tickets", "Orders" in the sidebar)
- `admin.widgets[].title`
- `settings.<field>.label` and `.description` (e.g. "Stripe secret key", with a two-sentence explanation)
- the plugin `description` shown in the plugin list

For a French or Japanese admin, the sidebar and settings form stay English while every page they open is translated. The plugin has no way to fix this. It also cannot work around it, because the strings are read before any plugin code runs.

Bundle size rules out shipping every language in the manifest itself for a 20-language plugin. A per-locale map is small, though: our three plugins need around 2–4 KB of manifest strings per language.

## Proposal

Accept an optional `i18n` map in the manifest, keyed by BCP 47 tag, holding overrides for the same paths:

```jsonc
{
  "admin": { "pages": [{ "path": "/tickets", "label": "Tickets" }] },
  "settings": { "stripeSecretKey": { "label": "Stripe secret key", "description": "…" } },
  "i18n": {
    "fr": {
      "description": "Billets payants pour les événements Eventual…",
      "admin.pages./tickets.label": "Billets",
      "settings.stripeSecretKey.label": "Clé secrète Stripe",
      "settings.stripeSecretKey.description": "…"
    }
  }
}
```

EmDash would pick the admin's locale using the same negotiation it already uses for content (exact tag, then base language, then the default) and fall back to the base string.

An alternative that also avoids manifest growth: let `i18n` reference a file in the plugin archive (e.g. `"i18n": "locales/manifest.json"`), counted toward the archive total but not the per-file code limit.

## Why not a runtime hook

A hook such as `admin:labels(locale)` would cost a sandbox invocation on every admin navigation, just to render the sidebar. Static data is cheaper and can be cached with the manifest.

## Compatibility

The change is purely additive. Plugins without `i18n` behave as today. Older EmDash versions ignore the unknown key, if manifest validation tolerates it. If not, it could be gated behind a manifest `capabilities` flag.
